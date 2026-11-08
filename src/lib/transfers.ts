import "server-only";
import { randomUUID } from "node:crypto";
import { activeContact, AssessError, assessFromDb, type AssessInput } from "./assess";
import { db, logEvent, toCustomer, toPayee, toTransfer, transaction } from "./db";
import { formatPKR } from "./format";
import { COOLING_OFF_HOURS, type RiskAssessment } from "./risk";
import { decideTransfer, type Intent } from "./transfer-rules";
import type { Payee, Transfer } from "./types";

const HOUR = 60 * 60 * 1000;

export interface CreateTransferInput extends AssessInput {
  purpose: string;
  intent: Intent;
}

export interface CreateTransferResult {
  transfer: Transfer;
  payee: Payee;
  assessment: RiskAssessment;
  /** When a cooling-off hold ends. */
  releaseAt: string | null;
  contactName: string | null;
}

export function coolingOffEnds(transfer: Pick<Transfer, "createdAt">): string {
  return new Date(new Date(transfer.createdAt).getTime() + COOLING_OFF_HOURS * HOUR).toISOString();
}

/**
 * Create a transfer. The risk check always runs again on the server, so the
 * outcome cannot be changed by the client.
 */
export function createTransfer(input: CreateTransferInput): CreateTransferResult {
  const purpose = input.purpose.trim().slice(0, 80) || "Transfer";
  const { payee, assessment } = assessFromDb(input);
  const decision = decideTransfer(assessment, input.intent);
  if (!decision.ok) throw new AssessError(decision.error, 409);

  const transfer: Transfer = {
    id: `t_${randomUUID().slice(0, 8)}`,
    customerId: input.customerId,
    payeeId: payee.id,
    amount: Math.round(input.amount),
    purpose,
    createdAt: new Date().toISOString(),
    status: decision.status,
    riskScore: assessment.score,
    riskLevel: assessment.level,
    reasons: assessment.reasons,
    answers: input.answers ?? {},
  };

  const contact = activeContact(input.customerId);
  const contactName = contact?.name ?? null;

  transaction((conn) => {
    conn.prepare(
      `INSERT INTO transfers (id, customer_id, payee_id, amount, purpose, created_at, status, risk_score, risk_level, reasons, answers)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      transfer.id, transfer.customerId, transfer.payeeId, transfer.amount, transfer.purpose, transfer.createdAt,
      transfer.status, transfer.riskScore, transfer.riskLevel, JSON.stringify(transfer.reasons), JSON.stringify(transfer.answers),
    );
    if (transfer.status === "completed") {
      conn.prepare("UPDATE customers SET balance = balance - ? WHERE id = ?").run(transfer.amount, transfer.customerId);
    }
    if (transfer.status === "pending_approval" && contact) {
      conn.prepare(
        "INSERT INTO approvals (id, transfer_id, contact_id, status, created_at) VALUES (?, ?, ?, 'pending', ?)",
      ).run(`a_${randomUUID().slice(0, 8)}`, transfer.id, contact.id, transfer.createdAt);
    }
  });

  logEvent("customer", `transfer_${transfer.status}`, transfer.id, describe(transfer, payee, contactName));

  return {
    transfer,
    payee,
    assessment,
    releaseAt: transfer.status === "cooling_off" ? coolingOffEnds(transfer) : null,
    contactName,
  };
}

function describe(t: Transfer, payee: Payee, contactName: string | null): string {
  const what = `${formatPKR(t.amount)} to ${payee.title}`;
  switch (t.status) {
    case "completed":
      return t.riskLevel === "pause" ? `Sent ${what} after a warning` : `Sent ${what}`;
    case "pending_approval":
      return `Held ${what} for approval by ${contactName}`;
    case "cooling_off":
      return `Held ${what} for a ${COOLING_OFF_HOURS}-hour cooling-off period`;
    case "stopped":
      return `Stopped ${what}: confirmed mule account`;
    case "cancelled":
      return `Customer decided not to send ${what} after the check`;
    default:
      return `${what}: ${t.status}`;
  }
}

function getTransfer(id: string): Transfer {
  const row = db().prepare("SELECT * FROM transfers WHERE id = ?").get(id);
  if (!row) throw new AssessError("Transfer not found", 404);
  return toTransfer(row);
}

/** The customer withdraws a transfer that is still on hold. */
export function cancelHeldTransfer(id: string, customerId: string): Transfer {
  const transfer = getTransfer(id);
  if (transfer.customerId !== customerId) throw new AssessError("Transfer not found", 404);
  if (transfer.status !== "pending_approval" && transfer.status !== "cooling_off") {
    throw new AssessError("Only held transfers can be cancelled", 409);
  }
  transaction((conn) => {
    conn.prepare("UPDATE transfers SET status = 'cancelled' WHERE id = ?").run(id);
    conn.prepare("UPDATE approvals SET status = 'withdrawn', decided_at = ? WHERE transfer_id = ? AND status = 'pending'")
      .run(new Date().toISOString(), id);
  });
  logEvent("customer", "transfer_cancelled", id, `Customer cancelled a held transfer of ${formatPKR(transfer.amount)}`);
  return { ...transfer, status: "cancelled" };
}

/**
 * Complete a held transfer, re-checking the payee first: if it was confirmed as a
 * mule account while the money was held, the transfer is stopped instead.
 */
export function releaseHeldTransfer(id: string, actor: string, note: string): Transfer {
  const transfer = getTransfer(id);
  if (transfer.status !== "pending_approval" && transfer.status !== "cooling_off") {
    throw new AssessError("Transfer is not on hold", 409);
  }
  const conn = db();
  const payee = toPayee(conn.prepare("SELECT * FROM payees WHERE id = ?").get(transfer.payeeId)!);
  const customer = toCustomer(conn.prepare("SELECT * FROM customers WHERE id = ?").get(transfer.customerId)!);

  let status: Transfer["status"] = "completed";
  let detail = `${note}: sent ${formatPKR(transfer.amount)} to ${payee.title}`;
  if (payee.status === "confirmed_mule") {
    status = "stopped";
    detail = `Stopped ${formatPKR(transfer.amount)} to ${payee.title}: payee confirmed as a mule while the transfer was held`;
  } else if (customer.balance < transfer.amount) {
    status = "cancelled";
    detail = `Cancelled ${formatPKR(transfer.amount)} to ${payee.title}: insufficient balance at release`;
  }

  transaction((tx) => {
    tx.prepare("UPDATE transfers SET status = ? WHERE id = ?").run(status, id);
    if (status === "completed") {
      tx.prepare("UPDATE customers SET balance = balance - ? WHERE id = ?").run(transfer.amount, transfer.customerId);
    }
  });
  logEvent(actor, `transfer_${status}`, id, detail);
  return { ...transfer, status };
}

/** Release every cooling-off transfer whose period has ended. Called whenever state is read. */
export function settleCoolingOff(now = Date.now()): void {
  const cutoff = new Date(now - COOLING_OFF_HOURS * HOUR).toISOString();
  const due = db()
    .prepare("SELECT id FROM transfers WHERE status = 'cooling_off' AND created_at <= ?")
    .all(cutoff) as { id: string }[];
  for (const { id } of due) releaseHeldTransfer(id, "system", "Cooling-off period ended");
}
