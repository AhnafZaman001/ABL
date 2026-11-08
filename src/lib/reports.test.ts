import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { decideApproval } from "./contacts";
import { db, resetDemo, toApproval, toPayee, toReport, toTransfer } from "./db";
import { computeMetrics } from "./metrics";
import { getSnapshot } from "./queries";
import { actOnReport, createReport } from "./reports";
import { createTransfer, releaseHeldTransfer } from "./transfers";

beforeAll(() => {
  process.env.HIFAZAT_DB_PATH = path.join(mkdtempSync(path.join(tmpdir(), "hifazat-")), "test.db");
});
beforeEach(() => resetDemo());

const NO = { on_call: false, claimed_authority: false, fee_to_receive: false };
const payeeStatus = (id: string) => toPayee(db().prepare("SELECT * FROM payees WHERE id = ?").get(id)!).status;
const reportsFor = (payeeId: string) =>
  db().prepare("SELECT * FROM reports WHERE payee_id = ?").all(payeeId).map(toReport);

/** Kamran sends Rs 250,000 to Shahid: held for cooling-off, then released. */
function kamranPaysShahid() {
  const { transfer } = createTransfer({
    customerId: "c_kamran", payeeId: "p_shahid", amount: 250_000, purpose: "Other",
    answers: { on_call: false, claimed_authority: false, otp_shared: false }, intent: "send",
  });
  releaseHeldTransfer(transfer.id, "demo", "test");
  return transfer.id;
}

/** Hira pays Shahid; once Shahid has a report this is held, so release it the way the cooling-off would. */
function hiraPaysShahid() {
  const { transfer } = createTransfer({
    customerId: "c_hira", payeeId: "p_shahid", amount: 9_000, purpose: "Other", answers: NO, intent: "send_after_warning",
  });
  if (transfer.status === "cooling_off") releaseHeldTransfer(transfer.id, "demo", "test");
  return transfer.id;
}

describe("customer reports", () => {
  it("records the report against the transfer's payee with its amount", () => {
    const transferId = kamranPaysShahid();
    const report = createReport({
      customerId: "c_kamran", transferId, scamType: "otp_theft", callerNumber: "0300 1112233", description: "Asked for my OTP",
    });
    expect(report).toMatchObject({ payeeId: "p_shahid", amount: 250_000, channel: "app", status: "new", callerNumber: "0300 111 2233" });
  });

  it("only accepts the customer's own, finished transfers, once", () => {
    const transferId = kamranPaysShahid();
    expect(() => createReport({ customerId: "c_hira", transferId, scamType: "other" })).toThrow(/not found/);
    createReport({ customerId: "c_kamran", transferId, scamType: "other" });
    expect(() => createReport({ customerId: "c_kamran", transferId, scamType: "other" })).toThrow(/already reported/);
  });

  it("does not accept a report on a transfer that is still held", () => {
    const { transfer } = createTransfer({
      customerId: "c_nasreen", payeeId: "p_asif", amount: 185_000, purpose: "Other",
      answers: { on_call: true, claimed_authority: true, fee_to_receive: false }, intent: "send",
    });
    expect(() => createReport({ customerId: "c_nasreen", transferId: transfer.id, scamType: "fake_bank_call" })).toThrow(/on hold/);
  });

  it("rejects a malformed caller number", () => {
    const transferId = kamranPaysShahid();
    expect(() => createReport({ customerId: "c_kamran", transferId, scamType: "other", callerNumber: "12" })).toThrow(/caller's number/);
  });

  it("puts a payee under review after two independent reports", () => {
    createReport({ customerId: "c_kamran", transferId: kamranPaysShahid(), scamType: "otp_theft" });
    expect(payeeStatus("p_shahid")).toBe("active");
    createReport({ customerId: "c_hira", transferId: hiraPaysShahid(), scamType: "prize_or_bisp" });
    expect(payeeStatus("p_shahid")).toBe("under_review");
  });
});

describe("fraud desk", () => {
  it("confirming a case flags the payee and closes every open report against it", () => {
    const [first] = reportsFor("p_asif");
    actOnReport(first.id, "confirm", "Same caller as two other complaints");
    expect(payeeStatus("p_asif")).toBe("confirmed_mule");
    expect(reportsFor("p_asif").every((r) => r.status === "confirmed")).toBe(true);
  });

  it("closes the loop: the next customer paying a confirmed account is stopped", () => {
    actOnReport(reportsFor("p_asif")[0].id, "confirm");
    const { transfer, assessment } = createTransfer({
      customerId: "c_usman", payeeId: "p_asif", amount: 10_000, purpose: "Other", intent: "send_after_warning",
    });
    expect(assessment.level).toBe("stop");
    expect(transfer.status).toBe("stopped");
  });

  it("stops a transfer that was waiting for approval when its payee is confirmed", () => {
    const { transfer } = createTransfer({
      customerId: "c_nasreen", payeeId: "p_asif", amount: 185_000, purpose: "Other",
      answers: { on_call: true, claimed_authority: true, fee_to_receive: false }, intent: "send",
    });
    actOnReport(reportsFor("p_asif")[0].id, "confirm");
    const approval = toApproval(db().prepare("SELECT * FROM approvals WHERE transfer_id = ?").get(transfer.id)!);
    decideApproval(approval.id, "tc_bilal", { decision: "approve", spokeToCustomer: true });
    expect(toTransfer(db().prepare("SELECT * FROM transfers WHERE id = ?").get(transfer.id)!).status).toBe("stopped");
  });

  it("clears a payee once every report is rejected", () => {
    const [a, b] = reportsFor("p_asif");
    actOnReport(a.id, "reject");
    expect(payeeStatus("p_asif")).toBe("under_review");
    actOnReport(b.id, "reject");
    expect(payeeStatus("p_asif")).toBe("active");
  });

  it("enforces case states", () => {
    const report = reportsFor("p_asif").find((r) => r.status === "investigating")!;
    expect(() => actOnReport(report.id, "investigate")).toThrow(/Only new cases/);
    const confirmed = reportsFor("p_zubair")[0];
    expect(() => actOnReport(confirmed.id, "reject")).toThrow(/already closed/);
  });
});

describe("impact metrics", () => {
  it("counts checked, warned and kept-safe transfers from this session only", () => {
    createTransfer({ customerId: "c_usman", payeeId: "p_alnoor", amount: 70_000, purpose: "Supplier payment", intent: "send" });
    createTransfer({ customerId: "c_hira", payeeId: "p_faraz", amount: 14_500, purpose: "Purchase", answers: NO, intent: "cancel" });
    createTransfer({ customerId: "c_hira", payeeId: "p_zubair", amount: 6_000, purpose: "Other", intent: "send" });
    const transferId = kamranPaysShahid();
    createReport({ customerId: "c_kamran", transferId, scamType: "otp_theft" });

    const snap = getSnapshot();
    const m = computeMetrics(snap.transfers, snap.reports, snap.payees);
    expect(m.checked).toBe(4);
    expect(m.warned).toBe(3);
    expect(m.keptSafe).toBe(2);
    expect(m.keptSafeAmount).toBe(20_500);
    expect(m.openCases).toBe(3);
    expect(m.confirmedMules).toBe(1);
    expect(m.medianReportMinutes).toBe(0);
  });
});
