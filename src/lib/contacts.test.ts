import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  decideApproval,
  inviteContact,
  requestRemoval,
  respondToInvite,
  setProtectionMode,
  settleContacts,
} from "./contacts";
import { db, resetDemo, toApproval, toContact, toCustomer, toTransfer } from "./db";
import { createTransfer } from "./transfers";

const HOUR = 60 * 60 * 1000;
const SCAM_ANSWERS = { on_call: true, claimed_authority: true, fee_to_receive: false };
const NO = { on_call: false, claimed_authority: false, fee_to_receive: false };

beforeAll(() => {
  process.env.HIFAZAT_DB_PATH = path.join(mkdtempSync(path.join(tmpdir(), "hifazat-")), "test.db");
});
beforeEach(() => resetDemo());

const balance = (id: string) => toCustomer(db().prepare("SELECT * FROM customers WHERE id = ?").get(id)!).balance;
const transferStatus = (id: string) => toTransfer(db().prepare("SELECT * FROM transfers WHERE id = ?").get(id)!).status;
const approvalFor = (transferId: string) =>
  toApproval(db().prepare("SELECT * FROM approvals WHERE transfer_id = ?").get(transferId)!);

function holdNasreenTransfer() {
  return createTransfer({
    customerId: "c_nasreen",
    payeeId: "p_asif",
    amount: 185_000,
    purpose: "Other",
    answers: SCAM_ANSWERS,
    intent: "send",
  });
}

describe("approval by the trusted contact", () => {
  it("routes a held transfer to the active contact", () => {
    const { transfer } = holdNasreenTransfer();
    expect(transfer.status).toBe("pending_approval");
    expect(approvalFor(transfer.id)).toMatchObject({ contactId: "tc_bilal", status: "pending" });
  });

  it("stops the transfer when the contact declines, leaving the balance untouched", () => {
    const before = balance("c_nasreen");
    const { transfer } = holdNasreenTransfer();
    decideApproval(approvalFor(transfer.id).id, "tc_bilal", { decision: "decline", spokeToCustomer: false });
    expect(transferStatus(transfer.id)).toBe("declined");
    expect(balance("c_nasreen")).toBe(before);
  });

  it("requires the contact to have spoken to the customer before approving", () => {
    const { transfer } = holdNasreenTransfer();
    const approval = approvalFor(transfer.id);
    expect(() => decideApproval(approval.id, "tc_bilal", { decision: "approve", spokeToCustomer: false })).toThrow(
      /Call the customer/,
    );
    const before = balance("c_nasreen");
    decideApproval(approval.id, "tc_bilal", { decision: "approve", spokeToCustomer: true, note: "Confirmed by phone" });
    expect(transferStatus(transfer.id)).toBe("completed");
    expect(balance("c_nasreen")).toBe(before - 185_000);
    expect(approvalFor(transfer.id)).toMatchObject({ status: "approved", note: "Confirmed by phone" });
  });

  it("stops an approved transfer if the payee was confirmed as a mule while it was held", () => {
    const { transfer } = holdNasreenTransfer();
    db().prepare("UPDATE payees SET status = 'confirmed_mule' WHERE id = 'p_asif'").run();
    decideApproval(approvalFor(transfer.id).id, "tc_bilal", { decision: "approve", spokeToCustomer: true });
    expect(transferStatus(transfer.id)).toBe("stopped");
  });

  it("does not let another contact decide, or decide twice", () => {
    const { transfer } = holdNasreenTransfer();
    const approval = approvalFor(transfer.id);
    expect(() => decideApproval(approval.id, "tc_other", { decision: "decline", spokeToCustomer: false })).toThrow(/not found/);
    decideApproval(approval.id, "tc_bilal", { decision: "decline", spokeToCustomer: false });
    expect(() => decideApproval(approval.id, "tc_bilal", { decision: "decline", spokeToCustomer: false })).toThrow(/already/);
  });

  it("cancels the transfer if nobody responds within 24 hours", () => {
    const { transfer } = holdNasreenTransfer();
    settleContacts(Date.now() + 25 * HOUR);
    expect(transferStatus(transfer.id)).toBe("cancelled");
    expect(approvalFor(transfer.id).status).toBe("expired");
  });
});

describe("enrolment", () => {
  const sana = { name: "Sana Baig", relation: "Sister", phone: "0333 444 5566" };

  it("only routes holds to a contact after they accept", () => {
    const contact = inviteContact("c_kamran", sana);
    expect(contact.status).toBe("invited");
    const scam = { customerId: "c_kamran", payeeId: "p_shahid", amount: 250_000, purpose: "Other", intent: "send" as const };
    const before = createTransfer({ ...scam, answers: { ...NO, otp_shared: false } });
    expect(before.transfer.status).toBe("cooling_off");

    respondToInvite(contact.id, true);
    const after = createTransfer({ ...scam, answers: { ...NO, otp_shared: false } });
    expect(after.transfer.status).toBe("pending_approval");
    expect(after.contactName).toBe("Sana Baig");
  });

  it("removes the contact when the invitation is declined", () => {
    const contact = inviteContact("c_hira", sana);
    expect(respondToInvite(contact.id, false)).toBeNull();
    expect(db().prepare("SELECT * FROM trusted_contacts WHERE customer_id = 'c_hira'").get()).toBeUndefined();
  });

  it("validates the details and allows one contact per customer", () => {
    expect(() => inviteContact("c_hira", { ...sana, phone: "12345" })).toThrow(/mobile number/);
    expect(() => inviteContact("c_hira", { ...sana, name: "S" })).toThrow(/full name/);
    expect(() => inviteContact("c_nasreen", sana)).toThrow(/already have/);
  });
});

describe("removing protection", () => {
  it("delays removal by 24 hours, keeping the contact active until then", () => {
    const { transfer } = holdNasreenTransfer();
    const scheduled = requestRemoval("c_nasreen", "tc_bilal")!;
    expect(scheduled.removesAt).not.toBeNull();

    settleContacts(Date.now() + 1 * HOUR);
    const stillThere = toContact(db().prepare("SELECT * FROM trusted_contacts WHERE id = 'tc_bilal'").get()!);
    expect(stillThere.status).toBe("active");

    settleContacts(Date.now() + 25 * HOUR);
    expect(db().prepare("SELECT * FROM trusted_contacts WHERE id = 'tc_bilal'").get()).toBeUndefined();
    expect(transferStatus(transfer.id)).toBe("cancelled");
  });

  it("will not switch guarded mode off while a contact is active", () => {
    expect(() => setProtectionMode("c_nasreen", "standard")).toThrow(/Remove your trusted contact/);
    setProtectionMode("c_hira", "guarded");
    setProtectionMode("c_hira", "standard");
    expect(toCustomer(db().prepare("SELECT * FROM customers WHERE id = 'c_hira'").get()!).protectionMode).toBe("standard");
  });

  it("only lets the customer remove their own contact", () => {
    expect(() => requestRemoval("c_usman", "tc_bilal")).toThrow(/not found/);
  });
});
