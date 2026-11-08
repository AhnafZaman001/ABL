"use client";

import { useState } from "react";
import { karachiTime, postJson } from "@/lib/client";
import { accountAge, formatPKR, timeAgo } from "@/lib/format";
import { computeMetrics } from "@/lib/metrics";
import type { DemoSnapshot } from "@/lib/queries";
import { COOLING_OFF_HOURS, QUESTION_THRESHOLD, QUESTIONS, THRESHOLDS, WEIGHTS, type QuestionId } from "@/lib/risk";
import { SCAM_TYPES } from "@/lib/scam-types";
import type { ScamReport } from "@/lib/types";
import { useDemo } from "@/lib/use-demo";
import { ReasonList } from "./reason-list";
import {
  Badge,
  Button,
  Card,
  PayeeStatusBadge,
  ReportStatusBadge,
  RISK_LEVEL_TONE,
  SimulatedNote,
  TransferStatusBadge,
} from "./ui";

const isOpen = (r: ScamReport) => r.status === "new" || r.status === "investigating";
const HOUR = 60 * 60 * 1000;

export function FraudDesk() {
  const { data, refresh } = useDemo();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (!data) return <p className="p-8 text-sm text-muted">Loading…</p>;

  const metrics = computeMetrics(data.transfers, data.reports, data.payees);
  const queue = [...data.reports].sort((a, b) => {
    if (isOpen(a) !== isOpen(b)) return isOpen(a) ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
  const selected = queue.find((r) => r.id === selectedId) ?? queue.find(isOpen) ?? queue[0] ?? null;
  const payee = (id: string) => data.payees.find((p) => p.id === id);
  const reportCount = (payeeId: string) => data.reports.filter((r) => r.payeeId === payeeId).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fraud desk</h1>
          <p className="text-sm text-muted">Scam cases, payee intelligence and impact (sample data).</p>
        </div>
        <SimulatedNote>Payee details from other banks, fund holds and account freezing are simulated.</SimulatedNote>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Metric label="Transfers checked" value={metrics.checked} />
        <Metric label="Warnings shown" value={metrics.warned} />
        <Metric label="Not sent after a warning" value={metrics.keptSafe} />
        <Metric label="Amount kept in accounts" value={formatPKR(metrics.keptSafeAmount)} />
        <Metric label="Open cases" value={metrics.openCases} />
        <Metric
          label="Median time to report (app)"
          value={metrics.medianReportMinutes === null ? "—" : `${metrics.medianReportMinutes} min`}
        />
      </section>
      <p className="-mt-3 text-xs text-muted">
        Counts transfers made in this demo session; the seeded history was not checked.
      </p>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_1.15fr]">
        <Card title={`Case queue (${metrics.openCases} open)`}>
          <ul className="-mx-4 -my-4 divide-y divide-line">
            {queue.map((r) => {
              const transfer = data.transfers.find((t) => t.id === r.transferId);
              const since = new Date(transfer?.createdAt ?? r.createdAt).getTime();
              const urgent = isOpen(r) && new Date(data.now).getTime() - since < HOUR;
              return (
                <li key={r.id}>
                  <button
                    onClick={() => setSelectedId(r.id)}
                    className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left ${
                      selected?.id === r.id ? "bg-brand-soft" : "hover:bg-canvas"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {SCAM_TYPES[r.scamType].short} · {payee(r.payeeId)?.title}
                      </p>
                      <p className="text-xs text-muted">
                        {formatPKR(r.amount)} · {r.channel === "app" ? "In-app report" : "Helpline"} · {timeAgo(r.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <ReportStatusBadge status={r.status} />
                      {urgent && <Badge tone="stop">Within the hour</Badge>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        {selected ? (
          <CaseDetail key={selected.id} report={selected} data={data} onDone={refresh} />
        ) : (
          <Card><p className="text-sm text-muted">No cases.</p></Card>
        )}
      </div>

      <Card title="Payee registry">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                <th className="py-2 pr-3 font-medium">Account title</th>
                <th className="py-2 pr-3 font-medium">Bank</th>
                <th className="py-2 pr-3 font-medium">Account</th>
                <th className="py-2 pr-3 font-medium">Age</th>
                <th className="py-2 pr-3 font-medium">Reports</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.payees.map((p) => (
                <tr key={p.id}>
                  <td className="py-2.5 pr-3 font-medium">{p.title}</td>
                  <td className="py-2.5 pr-3 text-muted">{p.bank}</td>
                  <td className="py-2.5 pr-3 font-mono text-xs">{p.accountNumber}</td>
                  <td className="py-2.5 pr-3 text-muted">{accountAge(p.openedAt)}</td>
                  <td className="py-2.5 pr-3">{reportCount(p.id)}</td>
                  <td className="py-2.5"><PayeeStatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Audit log">
        <ul className="max-h-72 space-y-1.5 overflow-y-auto text-sm">
          {data.events.map((e) => (
            <li key={e.id} className="flex gap-3">
              <span className="w-28 shrink-0 text-xs text-muted">{karachiTime(e.at)}</span>
              <span className="w-16 shrink-0 text-xs capitalize text-muted">{e.actor}</span>
              <span>{e.detail}</span>
            </li>
          ))}
        </ul>
      </Card>

      <RiskRules />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function CaseDetail({ report, data, onDone }: { report: ScamReport; data: DemoSnapshot; onDone: () => Promise<void> }) {
  const [note, setNote] = useState(report.deskNote ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const customer = data.customers.find((c) => c.id === report.customerId);
  const transfer = data.transfers.find((t) => t.id === report.transferId);
  const payee = data.payees.find((p) => p.id === report.payeeId)!;
  const linked = data.reports.filter((r) => r.payeeId === report.payeeId && r.id !== report.id);
  const sameCaller = report.callerNumber
    ? data.reports.filter((r) => r.id !== report.id && r.callerNumber === report.callerNumber).length
    : 0;
  const heldToPayee = data.transfers.filter(
    (t) => t.payeeId === payee.id && (t.status === "pending_approval" || t.status === "cooling_off"),
  );
  const answers = transfer ? (Object.entries(transfer.answers) as [QuestionId, boolean][]) : [];
  const open = isOpen(report);

  async function act(action: "investigate" | "confirm" | "reject") {
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/reports/${report.id}/action`, { action, note });
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title={`Case ${report.id.toUpperCase()}`}
      action={<ReportStatusBadge status={report.status} />}
    >
      <div className="space-y-5 text-sm">
        <section className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
          <Field label="Type">{SCAM_TYPES[report.scamType].short}</Field>
          <Field label="Received">{karachiTime(report.createdAt)} · {report.channel === "app" ? "in app" : "helpline"}</Field>
          <Field label="Reported by">{customer ? customer.name : "Helpline caller (not a demo customer)"}</Field>
          <Field label="Caller number">{report.callerNumber ?? "Not given"}</Field>
        </section>

        {report.description && (
          <blockquote className="border-l-2 border-line pl-3 text-muted">“{report.description}”</blockquote>
        )}

        {transfer && (
          <section className="space-y-2 rounded-lg bg-canvas p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{formatPKR(transfer.amount)} · {karachiTime(transfer.createdAt)}</p>
              <TransferStatusBadge status={transfer.status} />
            </div>
            {transfer.riskLevel ? (
              <>
                <p className="text-xs text-muted">
                  Pre-payment check: <Badge tone={RISK_LEVEL_TONE[transfer.riskLevel]}>{transfer.riskLevel}</Badge>{" "}
                  score {transfer.riskScore}/100
                  {transfer.riskLevel === "pause" && transfer.status === "completed" && " · customer continued after the warning"}
                </p>
                <ReasonList reasons={transfer.reasons} lang="en" />
                {answers.length > 0 && (
                  <ul className="space-y-0.5 text-xs">
                    {answers.map(([id, yes]) => (
                      <li key={id} className="flex justify-between gap-3">
                        <span className="text-muted">{QUESTIONS[id].en}</span>
                        <span className={yes ? "font-semibold text-stop" : ""}>{yes ? "Yes" : "No"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-xs text-muted">Made before the check was in place (seeded history).</p>
            )}
          </section>
        )}

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Receiving account</h3>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium">{payee.title}</p>
              <p className="text-xs text-muted">
                {payee.bank} · <span className="font-mono">{payee.accountNumber}</span> · {accountAge(payee.openedAt)}
              </p>
            </div>
            <PayeeStatusBadge status={payee.status} />
          </div>
          <ul className="space-y-1 text-xs">
            <li>{linked.length} other report{linked.length === 1 ? "" : "s"} against this account</li>
            {sameCaller > 0 && (
              <li className="text-hold">Caller number appears in {sameCaller} other report{sameCaller === 1 ? "" : "s"}</li>
            )}
            {heldToPayee.length > 0 && (
              <li className="text-hold">
                {heldToPayee.length} transfer{heldToPayee.length === 1 ? " is" : "s are"} currently held to this account
                and will be stopped if it is confirmed
              </li>
            )}
          </ul>
        </section>

        {open ? (
          <section className="space-y-2">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Analyst note"
              rows={2}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand"
            />
            {error && <p className="text-stop">{error}</p>}
            <div className="flex flex-wrap gap-2">
              {report.status === "new" && (
                <Button variant="secondary" disabled={busy} onClick={() => act("investigate")}>Open investigation</Button>
              )}
              <Button variant="danger" disabled={busy} onClick={() => act("confirm")}>Confirm scam and flag account</Button>
              <Button variant="ghost" disabled={busy} onClick={() => act("reject")}>Not a scam</Button>
            </div>
            <p className="text-xs text-muted">
              Confirming closes every open report against this account and stops all future transfers to it from
              customers using Hifazat.
            </p>
          </section>
        ) : (
          <section className="space-y-1 rounded-lg bg-canvas p-3 text-xs">
            {report.deskNote && <p><span className="font-medium">Note:</span> {report.deskNote}</p>}
            {report.status === "confirmed" && (
              <p className="text-muted">
                Simulated: a request to hold the funds would go to the receiving bank through the interbank fraud channel.
              </p>
            )}
          </section>
        )}
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p>
      <span className="text-xs text-muted">{label}: </span>
      {children}
    </p>
  );
}

const SIGNAL_RULES: [string, number | string][] = [
  ["Payee confirmed as a mule account", "Stop"],
  ["Payee under review after scam reports", WEIGHTS.payeeUnderReview],
  ["Payee has unreviewed scam reports", WEIGHTS.payeeReported],
  ["First transfer to this payee", WEIGHTS.firstTimePayee],
  ["Payee account opened under 30 days ago", WEIGHTS.accountUnder30Days],
  ["Payee account opened under 90 days ago", WEIGHTS.accountUnder90Days],
  ["Amount over twice the largest transfer in 90 days", WEIGHTS.amountOverTwiceMax],
  ["Amount above the largest transfer in 90 days", WEIGHTS.amountOverMax],
  ["Rs 50,000 or more with no recent history", WEIGHTS.largeWithoutHistory],
  ["Half or more of the available balance", WEIGHTS.halfOfBalance],
  ["Phone or SIM changed in the last 24 hours", WEIGHTS.deviceChange24h],
  ["Phone or SIM changed in the last 72 hours", WEIGHTS.deviceChange72h],
  ["Between midnight and 5 am (Karachi time)", WEIGHTS.lateNight],
];

const ANSWER_RULES: [string, number][] = [
  [QUESTIONS.on_call.en, WEIGHTS.onCall],
  [QUESTIONS.claimed_authority.en, WEIGHTS.claimedAuthority],
  [QUESTIONS.fee_to_receive.en, WEIGHTS.feeToReceive],
  [QUESTIONS.otp_shared.en, WEIGHTS.otpShared],
  ["On a call and the caller claimed authority ('safe account' pattern)", WEIGHTS.safeAccountPattern],
];

function RiskRules() {
  return (
    <Card title="Risk rules">
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Account signals</h3>
          <RuleTable rows={SIGNAL_RULES} />
        </div>
        <div className="space-y-5">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Customer answers (asked from {QUESTION_THRESHOLD} points)
            </h3>
            <RuleTable rows={ANSWER_RULES} />
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Outcomes</h3>
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="py-1.5 font-medium">Mode</th>
                  <th className="py-1.5 font-medium">Pause from</th>
                  <th className="py-1.5 font-medium">Hold from</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <tr><td className="py-1.5">Standard</td><td>{THRESHOLDS.standard.pause}</td><td>{THRESHOLDS.standard.hold}</td></tr>
                <tr><td className="py-1.5">Guarded</td><td>{THRESHOLDS.guarded.pause}</td><td>{THRESHOLDS.guarded.hold}</td></tr>
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted">
              A hold waits for the trusted contact if one is enrolled, otherwise a {COOLING_OFF_HOURS}-hour cooling-off
              period. Weights are starting values for the proof of concept, not calibrated on real fraud data.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function RuleTable({ rows }: { rows: [string, number | string][] }) {
  return (
    <table className="w-full text-left text-sm">
      <tbody className="divide-y divide-line">
        {rows.map(([label, weight]) => (
          <tr key={label}>
            <td className="py-1.5 pr-3">{label}</td>
            <td className="py-1.5 text-right font-mono text-xs">{typeof weight === "number" ? `+${weight}` : weight}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
