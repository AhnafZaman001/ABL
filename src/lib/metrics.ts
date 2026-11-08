import type { Payee, ScamReport, Transfer } from "./types";

export interface ImpactMetrics {
  /** Transfers that went through the pre-payment check. */
  checked: number;
  /** Checked transfers that got a pause, hold or stop. */
  warned: number;
  /** Warned transfers that were never sent: cancelled by the customer, stopped by the contact, or blocked. */
  keptSafe: number;
  keptSafeAmount: number;
  openCases: number;
  confirmedMules: number;
  /** Median minutes from transfer to in-app report, or null without app reports. */
  medianReportMinutes: number | null;
}

const NOT_SENT = new Set(["cancelled", "declined", "stopped"]);

export function computeMetrics(transfers: Transfer[], reports: ScamReport[], payees: Payee[]): ImpactMetrics {
  const checked = transfers.filter((t) => t.riskLevel !== null);
  const warned = checked.filter((t) => t.riskLevel !== "allow");
  const keptSafe = warned.filter((t) => NOT_SENT.has(t.status));

  const delays = reports
    .filter((r) => r.channel === "app" && r.transferId)
    .map((r) => {
      const t = transfers.find((x) => x.id === r.transferId);
      return t ? (new Date(r.createdAt).getTime() - new Date(t.createdAt).getTime()) / 60_000 : null;
    })
    .filter((m): m is number => m !== null)
    .sort((a, b) => a - b);
  const mid = Math.floor(delays.length / 2);
  const median = delays.length === 0 ? null : delays.length % 2 ? delays[mid] : (delays[mid - 1] + delays[mid]) / 2;

  return {
    checked: checked.length,
    warned: warned.length,
    keptSafe: keptSafe.length,
    keptSafeAmount: keptSafe.reduce((sum, t) => sum + t.amount, 0),
    openCases: reports.filter((r) => r.status === "new" || r.status === "investigating").length,
    confirmedMules: payees.filter((p) => p.status === "confirmed_mule").length,
    medianReportMinutes: median === null ? null : Math.round(median),
  };
}
