import "server-only";
import { randomUUID } from "node:crypto";
import { AssessError } from "./assess";
import { db, logEvent, toPayee, toReport, toTransfer, transaction } from "./db";
import { formatPKR } from "./format";
import { SCAM_TYPES } from "./scam-types";
import type { ScamReport, ScamType } from "./types";

/** Independent open reports needed before a payee is automatically put under review. */
export const AUTO_REVIEW_REPORTS = 2;

/** Transfers a customer can report: money that left, or an attempt that was blocked. */
const REPORTABLE = new Set(["completed", "stopped", "declined", "cancelled"]);

const MOBILE = /^03\d{9}$/;

export interface ReportInput {
  customerId: string;
  transferId: string;
  scamType: ScamType;
  callerNumber?: string;
  description?: string;
}

function openReportCount(payeeId: string): number {
  const { n } = db()
    .prepare("SELECT COUNT(*) AS n FROM reports WHERE payee_id = ? AND status IN ('new', 'investigating')")
    .get(payeeId) as { n: number };
  return n;
}

export function createReport(input: ReportInput): ScamReport {
  const row = db().prepare("SELECT * FROM transfers WHERE id = ?").get(input.transferId);
  const transfer = row ? toTransfer(row) : null;
  if (!transfer || transfer.customerId !== input.customerId) throw new AssessError("Transfer not found", 404);
  if (!REPORTABLE.has(transfer.status)) throw new AssessError("This transfer is still on hold; cancel it instead", 409);
  if (db().prepare("SELECT id FROM reports WHERE transfer_id = ?").get(transfer.id)) {
    throw new AssessError("You have already reported this transfer", 409);
  }

  let callerNumber: string | null = null;
  if (input.callerNumber?.trim()) {
    const digits = input.callerNumber.replace(/\s/g, "");
    if (!MOBILE.test(digits)) throw new AssessError("Enter the caller's number like 0300 1234567, or leave it blank");
    callerNumber = `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }

  const report: ScamReport = {
    id: `r_${randomUUID().slice(0, 8)}`,
    customerId: input.customerId,
    transferId: transfer.id,
    payeeId: transfer.payeeId,
    channel: "app",
    scamType: input.scamType,
    callerNumber,
    amount: transfer.amount,
    description: input.description?.trim().slice(0, 500) ?? "",
    createdAt: new Date().toISOString(),
    status: "new",
    deskNote: null,
  };

  const payee = toPayee(db().prepare("SELECT * FROM payees WHERE id = ?").get(transfer.payeeId)!);
  transaction((conn) => {
    conn.prepare(
      `INSERT INTO reports (id, customer_id, transfer_id, payee_id, channel, scam_type, caller_number, amount, description, created_at, status, desk_note)
       VALUES (?, ?, ?, ?, 'app', ?, ?, ?, ?, ?, 'new', NULL)`,
    ).run(
      report.id, report.customerId, report.transferId, report.payeeId, report.scamType,
      report.callerNumber, report.amount, report.description, report.createdAt,
    );
  });
  logEvent(
    "customer", "report_created", report.id,
    `Scam reported in app: ${SCAM_TYPES[report.scamType].short}, ${formatPKR(report.amount)} to ${payee.title}`,
  );

  if (payee.status === "active" && openReportCount(payee.id) >= AUTO_REVIEW_REPORTS) {
    db().prepare("UPDATE payees SET status = 'under_review' WHERE id = ?").run(payee.id);
    logEvent("system", "payee_under_review", payee.id, `${payee.title} put under review after ${AUTO_REVIEW_REPORTS} reports`);
  }
  return report;
}

function getReport(id: string): ScamReport {
  const row = db().prepare("SELECT * FROM reports WHERE id = ?").get(id);
  if (!row) throw new AssessError("Case not found", 404);
  return toReport(row);
}

export type DeskAction = "investigate" | "confirm" | "reject";

export function actOnReport(id: string, action: DeskAction, note?: string): ScamReport {
  const report = getReport(id);
  const deskNote = note?.trim().slice(0, 500) || report.deskNote;
  const payee = toPayee(db().prepare("SELECT * FROM payees WHERE id = ?").get(report.payeeId)!);

  if (action === "investigate") {
    if (report.status !== "new") throw new AssessError("Only new cases can be opened", 409);
    db().prepare("UPDATE reports SET status = 'investigating', desk_note = ? WHERE id = ?").run(deskNote, id);
    logEvent("desk", "case_investigating", id, `Investigation opened on report against ${payee.title}`);
    return { ...report, status: "investigating", deskNote };
  }

  if (report.status === "confirmed" || report.status === "rejected") {
    throw new AssessError("This case is already closed", 409);
  }

  if (action === "confirm") {
    // Confirming one case confirms every open report against the same account.
    const linked = transaction((conn) => {
      const open = conn
        .prepare("SELECT id FROM reports WHERE payee_id = ? AND status IN ('new', 'investigating')")
        .all(report.payeeId) as { id: string }[];
      conn.prepare("UPDATE reports SET status = 'confirmed' WHERE payee_id = ? AND status IN ('new', 'investigating')")
        .run(report.payeeId);
      conn.prepare("UPDATE reports SET desk_note = ? WHERE id = ?").run(deskNote, id);
      conn.prepare("UPDATE payees SET status = 'confirmed_mule' WHERE id = ?").run(report.payeeId);
      return open.length;
    });
    logEvent(
      "desk", "payee_confirmed_mule", report.payeeId,
      `${payee.title} confirmed as a mule account (${linked} report${linked === 1 ? "" : "s"} closed). Future transfers to it are stopped`,
    );
    return { ...report, status: "confirmed", deskNote };
  }

  db().prepare("UPDATE reports SET status = 'rejected', desk_note = ? WHERE id = ?").run(deskNote, id);
  logEvent("desk", "case_rejected", id, `Report against ${payee.title} closed as not a scam`);
  if (payee.status === "under_review" && openReportCount(payee.id) === 0) {
    db().prepare("UPDATE payees SET status = 'active' WHERE id = ?").run(payee.id);
    logEvent("desk", "payee_cleared", payee.id, `${payee.title} cleared: no open reports remain`);
  }
  return { ...report, status: "rejected", deskNote };
}
