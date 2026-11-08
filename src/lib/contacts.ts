import "server-only";
import { randomUUID } from "node:crypto";
import { AssessError } from "./assess";
import { db, logEvent, toApproval, toContact, toCustomer, toTransfer, transaction } from "./db";
import { formatPKR } from "./format";
import { releaseHeldTransfer } from "./transfers";
import type { Approval, ProtectionMode, TrustedContact } from "./types";

const HOUR = 60 * 60 * 1000;
export const REMOVAL_DELAY_HOURS = 24;
export const APPROVAL_EXPIRY_HOURS = 24;

/** Pakistani mobile number: 03XX XXXXXXX, spaces optional. */
const MOBILE = /^03\d{9}$/;

function customerName(id: string): string {
  const row = db().prepare("SELECT * FROM customers WHERE id = ?").get(id);
  if (!row) throw new AssessError("Unknown customer", 404);
  return toCustomer(row).name;
}

function getContact(id: string): TrustedContact {
  const row = db().prepare("SELECT * FROM trusted_contacts WHERE id = ?").get(id);
  if (!row) throw new AssessError("Contact not found", 404);
  return toContact(row);
}

export function inviteContact(customerId: string, input: { name: string; relation: string; phone: string }): TrustedContact {
  const who = customerName(customerId);
  const name = input.name.trim();
  const relation = input.relation.trim();
  const phone = input.phone.replace(/\s/g, "");
  if (name.length < 2) throw new AssessError("Enter the contact's full name");
  if (!relation) throw new AssessError("Choose how you know this person");
  if (!MOBILE.test(phone)) throw new AssessError("Enter a mobile number like 0300 1234567");

  const existing = db().prepare("SELECT id FROM trusted_contacts WHERE customer_id = ?").get(customerId);
  if (existing) throw new AssessError("You already have a trusted contact", 409);

  const contact: TrustedContact = {
    id: `tc_${randomUUID().slice(0, 8)}`,
    customerId,
    name,
    relation,
    phone: `${phone.slice(0, 4)} ${phone.slice(4)}`,
    status: "invited",
    invitedAt: new Date().toISOString(),
    removesAt: null,
  };
  db().prepare(
    `INSERT INTO trusted_contacts (id, customer_id, name, relation, phone, status, invited_at, removes_at)
     VALUES (?, ?, ?, ?, ?, 'invited', ?, NULL)`,
  ).run(contact.id, customerId, contact.name, contact.relation, contact.phone, contact.invitedAt);
  logEvent("customer", "contact_invited", contact.id, `${who} invited ${contact.name} as trusted contact`);
  return contact;
}

export function respondToInvite(contactId: string, accept: boolean): TrustedContact | null {
  const contact = getContact(contactId);
  if (contact.status !== "invited") throw new AssessError("This invitation has already been answered", 409);
  const who = customerName(contact.customerId);
  if (accept) {
    db().prepare("UPDATE trusted_contacts SET status = 'active' WHERE id = ?").run(contactId);
    logEvent("contact", "contact_accepted", contactId, `${contact.name} became ${who}'s trusted contact`);
    return { ...contact, status: "active" };
  }
  db().prepare("DELETE FROM trusted_contacts WHERE id = ?").run(contactId);
  logEvent("contact", "contact_declined", contactId, `${contact.name} declined to be ${who}'s trusted contact`);
  return null;
}

/**
 * Removing an active contact takes effect after a delay and the contact is told,
 * so someone who has taken over the customer's phone cannot quietly switch it off.
 */
export function requestRemoval(customerId: string, contactId: string): TrustedContact | null {
  const contact = getContact(contactId);
  if (contact.customerId !== customerId) throw new AssessError("Contact not found", 404);
  if (contact.status === "invited") {
    db().prepare("DELETE FROM trusted_contacts WHERE id = ?").run(contactId);
    logEvent("customer", "contact_invite_withdrawn", contactId, `Invitation to ${contact.name} withdrawn`);
    return null;
  }
  if (contact.removesAt) throw new AssessError("Removal is already scheduled", 409);
  const removesAt = new Date(Date.now() + REMOVAL_DELAY_HOURS * HOUR).toISOString();
  db().prepare("UPDATE trusted_contacts SET removes_at = ? WHERE id = ?").run(removesAt, contactId);
  logEvent(
    "customer", "contact_removal_requested", contactId,
    `Removal of ${contact.name} requested; takes effect in ${REMOVAL_DELAY_HOURS} hours and ${contact.name} has been told`,
  );
  return { ...contact, removesAt };
}

/** The contact can keep protecting the customer by cancelling a removal they did not expect. */
export function cancelRemoval(contactId: string): TrustedContact {
  const contact = getContact(contactId);
  if (!contact.removesAt) throw new AssessError("No removal is scheduled", 409);
  db().prepare("UPDATE trusted_contacts SET removes_at = NULL WHERE id = ?").run(contactId);
  logEvent("contact", "contact_removal_cancelled", contactId, `${contact.name} kept their role as trusted contact`);
  return { ...contact, removesAt: null };
}

export function setProtectionMode(customerId: string, mode: ProtectionMode): void {
  const who = customerName(customerId);
  if (mode === "standard") {
    const active = db()
      .prepare("SELECT id FROM trusted_contacts WHERE customer_id = ? AND status = 'active'")
      .get(customerId);
    if (active) throw new AssessError("Remove your trusted contact before switching guarded mode off", 409);
  }
  db().prepare("UPDATE customers SET protection_mode = ? WHERE id = ?").run(mode, customerId);
  logEvent("customer", "protection_mode", customerId, `${who} switched to ${mode} protection`);
}

export interface ApprovalDecision {
  decision: "approve" | "decline";
  /** The contact confirms they spoke to the customer directly before approving. */
  spokeToCustomer: boolean;
  note?: string;
}

export function decideApproval(approvalId: string, contactId: string, input: ApprovalDecision): Approval {
  const row = db().prepare("SELECT * FROM approvals WHERE id = ?").get(approvalId);
  if (!row) throw new AssessError("Request not found", 404);
  const approval = toApproval(row);
  if (approval.contactId !== contactId) throw new AssessError("Request not found", 404);
  if (approval.status !== "pending") throw new AssessError("This request has already been decided", 409);
  if (input.decision === "approve" && !input.spokeToCustomer) {
    throw new AssessError("Call the customer on their usual number before approving", 409);
  }

  const contact = getContact(contactId);
  const transfer = toTransfer(db().prepare("SELECT * FROM transfers WHERE id = ?").get(approval.transferId)!);
  const note = input.note?.trim().slice(0, 200) || null;
  const decidedAt = new Date().toISOString();
  const status = input.decision === "approve" ? "approved" : "declined";

  db().prepare("UPDATE approvals SET status = ?, decided_at = ?, note = ? WHERE id = ?").run(status, decidedAt, note, approvalId);
  if (input.decision === "approve") {
    releaseHeldTransfer(transfer.id, "contact", `Approved by ${contact.name}`);
  } else {
    db().prepare("UPDATE transfers SET status = 'declined' WHERE id = ?").run(transfer.id);
    logEvent("contact", "transfer_declined", transfer.id, `${contact.name} stopped ${formatPKR(transfer.amount)}`);
  }
  return { ...approval, status, decidedAt, note };
}

/** Apply removals and approval expiries that are due. Called whenever state is read. */
export function settleContacts(now = Date.now()): void {
  const nowIso = new Date(now).toISOString();
  const due = db()
    .prepare("SELECT * FROM trusted_contacts WHERE removes_at IS NOT NULL AND removes_at <= ?")
    .all(nowIso)
    .map(toContact);
  for (const contact of due) {
    transaction((conn) => {
      // Requests still waiting on this contact can no longer be decided; cancel them.
      const pending = conn.prepare("SELECT * FROM approvals WHERE contact_id = ? AND status = 'pending'").all(contact.id).map(toApproval);
      for (const a of pending) {
        conn.prepare("UPDATE approvals SET status = 'expired', decided_at = ? WHERE id = ?").run(nowIso, a.id);
        conn.prepare("UPDATE transfers SET status = 'cancelled' WHERE id = ?").run(a.transferId);
      }
      conn.prepare("DELETE FROM approvals WHERE contact_id = ?").run(contact.id);
      conn.prepare("DELETE FROM trusted_contacts WHERE id = ?").run(contact.id);
    });
    logEvent("system", "contact_removed", contact.id, `${contact.name} is no longer a trusted contact`);
  }

  const cutoff = new Date(now - APPROVAL_EXPIRY_HOURS * HOUR).toISOString();
  const expired = db()
    .prepare("SELECT * FROM approvals WHERE status = 'pending' AND created_at <= ?")
    .all(cutoff)
    .map(toApproval);
  for (const a of expired) {
    transaction((conn) => {
      conn.prepare("UPDATE approvals SET status = 'expired', decided_at = ? WHERE id = ?").run(nowIso, a.id);
      conn.prepare("UPDATE transfers SET status = 'cancelled' WHERE id = ?").run(a.transferId);
    });
    logEvent("system", "approval_expired", a.transferId, `No response within ${APPROVAL_EXPIRY_HOURS} hours; transfer cancelled`);
  }
}
