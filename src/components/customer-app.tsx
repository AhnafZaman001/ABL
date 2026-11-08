"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { formatPKR, initials, timeAgo } from "@/lib/format";
import { SCENARIOS } from "@/lib/scenarios";
import { useDemo } from "@/lib/use-demo";
import { PhoneFrame } from "./phone-frame";
import { ProtectionSettings } from "./protection-settings";
import { ReportScam } from "./report-scam";
import { SendMoney, type SendPrefill } from "./send-money";
import { Badge, Button, Card, RISK_LEVEL_TONE, SimulatedNote, TransferStatusBadge } from "./ui";

interface FlowState {
  key: number;
  prefill?: SendPrefill;
}

/** Reads ?customer= so walkthrough links open the right person; the key resets state when it changes. */
export function CustomerApp() {
  const initial = useSearchParams().get("customer") ?? "c_nasreen";
  return <CustomerView key={initial} initialCustomerId={initial} />;
}

function CustomerView({ initialCustomerId }: { initialCustomerId: string }) {
  const { data, refresh } = useDemo();
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [flow, setFlow] = useState<FlowState | null>(null);
  const [showProtection, setShowProtection] = useState(false);
  const [report, setReport] = useState<{ transferId?: string } | null>(null);
  const [skipping, setSkipping] = useState<string | null>(null);

  if (!data) return <p className="p-8 text-sm text-muted">Loading…</p>;

  const customer = data.customers.find((c) => c.id === customerId) ?? data.customers[0];
  const contact = data.contacts.find((tc) => tc.customerId === customer.id) ?? null;
  const activeContact = contact?.status === "active" ? contact : null;
  const transfers = data.transfers.filter((t) => t.customerId === customer.id);
  const coolingOff = transfers.filter((t) => t.status === "cooling_off");
  const scenarios = SCENARIOS.filter((s) => s.customerId === customer.id);
  const payee = (id: string) => data.payees.find((p) => p.id === id);
  const reportedTransfers = new Set(data.reports.map((r) => r.transferId));
  const canReport = (status: string) => ["completed", "stopped", "declined", "cancelled"].includes(status);

  // A new key remounts the flow, so loading another scenario starts from a clean state.
  const openFlow = (prefill?: SendPrefill) => setFlow((prev) => ({ key: (prev?.key ?? 0) + 1, prefill }));

  async function skipCoolingOff(id: string) {
    setSkipping(id);
    await fetch(`/api/transfers/${id}/skip-cooling-off`, { method: "POST" });
    await refresh();
    setSkipping(null);
  }

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-8 lg:grid-cols-[1fr_auto]">
      <div className="space-y-4">
        <Card title="Sample customer">
          <div className="grid gap-2 sm:grid-cols-2">
            {data.customers.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setCustomerId(c.id);
                  setFlow(null);
                  setShowProtection(false);
                  setReport(null);
                }}
                className={`rounded-lg border p-3 text-left transition ${
                  c.id === customer.id ? "border-brand bg-brand-soft" : "border-line hover:bg-canvas"
                }`}
              >
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted">{c.age} · {c.city}</div>
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted">{customer.persona}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone={customer.protectionMode === "guarded" ? "brand" : "neutral"}>
              {customer.protectionMode === "guarded" ? "Guarded mode" : "Standard protection"}
            </Badge>
            {activeContact && <Badge tone="brand">Trusted contact: {activeContact.name}</Badge>}
            {contact?.status === "invited" && <Badge tone="pause">Invited: {contact.name}</Badge>}
            {customer.deviceChangedAt && <Badge tone="hold">Device changed {timeAgo(customer.deviceChangedAt)}</Badge>}
          </div>
        </Card>

        {scenarios.length > 0 && (
          <Card title="Try a scenario">
            <ul className="space-y-3">
              {scenarios.map((s) => (
                <li key={s.id} className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{s.title}</span>
                      <Badge tone={RISK_LEVEL_TONE[s.expected]}>Expected: {s.expected}</Badge>
                    </div>
                    <p className="text-xs text-muted">{s.story}</p>
                  </div>
                  <Button
                    variant="secondary"
                    className="px-3 py-1.5 text-xs"
                    onClick={() => openFlow({ payeeId: s.payeeId, amount: s.amount, purpose: "Other" })}
                  >
                    Load in app
                  </Button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              Loading a scenario fills in the recipient and amount. The customer still goes through every step.
            </p>
          </Card>
        )}

        {coolingOff.length > 0 && (
          <Card title="Demo control">
            <ul className="space-y-2">
              {coolingOff.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>{formatPKR(t.amount)} to {payee(t.payeeId)?.title} is cooling off</span>
                  <Button
                    variant="secondary"
                    className="px-3 py-1.5 text-xs"
                    disabled={skipping === t.id}
                    onClick={() => skipCoolingOff(t.id)}
                  >
                    Skip cooling-off
                  </Button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">Skips the four-hour wait so the release can be shown live.</p>
          </Card>
        )}

        <SimulatedNote>
          Balances, history and device events are sample data, and no money moves. The phone frame stands in for the
          bank&apos;s own app.
        </SimulatedNote>
      </div>

      <PhoneFrame label={`Signed in as ${customer.name} (sample)`}>
        {flow ? (
          <SendMoney
            key={`${customer.id}-${flow.key}`}
            customer={customer}
            data={data}
            prefill={flow.prefill}
            onClose={() => setFlow(null)}
            onReport={(transferId) => {
              setFlow(null);
              setReport({ transferId });
            }}
          />
        ) : report ? (
          <ReportScam customer={customer} data={data} transferId={report.transferId} onClose={() => setReport(null)} />
        ) : showProtection ? (
          <ProtectionSettings
            customer={customer}
            contact={contact}
            onBack={() => setShowProtection(false)}
            onChanged={refresh}
          />
        ) : (
          <>
            <div className="bg-brand px-5 pb-6 pt-3 text-white">
              <p className="text-xs text-white/70">Available balance</p>
              <p className="text-2xl font-semibold">{formatPKR(customer.balance)}</p>
            </div>
            <div className="space-y-4 p-4">
              <Button className="w-full" onClick={() => openFlow()}>
                Send money
              </Button>
              <button
                onClick={() => setShowProtection(true)}
                className="flex w-full items-center justify-between rounded-xl border border-line bg-surface px-3 py-2.5 text-left hover:bg-canvas"
              >
                <span>
                  <span className="block text-sm font-medium">Scam protection</span>
                  <span className="block text-[11px] text-muted">
                    {customer.protectionMode === "guarded" ? "Guarded mode" : "Standard"} ·{" "}
                    {activeContact ? `Trusted contact: ${activeContact.name}` : contact ? "Invitation pending" : "No trusted contact"}
                  </span>
                </span>
                <span className="text-muted">›</span>
              </button>
              <Button variant="secondary" className="w-full text-stop" onClick={() => setReport({})}>
                Report a scam
              </Button>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Recent transfers</h3>
                <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
                  {transfers.map((t) => {
                    const p = payee(t.payeeId);
                    return (
                      <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-strong">
                          {initials(p?.title ?? "?")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{p?.title}</p>
                          <p className="text-[11px] text-muted">{timeAgo(t.createdAt)} · {t.purpose}</p>
                          {reportedTransfers.has(t.id) ? (
                            <p className="text-[11px] font-medium text-hold">Reported</p>
                          ) : canReport(t.status) && (
                            <button
                              onClick={() => setReport({ transferId: t.id })}
                              className="text-[11px] text-stop hover:underline"
                            >
                              Report scam
                            </button>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{formatPKR(t.amount)}</p>
                          <TransferStatusBadge status={t.status} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </>
        )}
      </PhoneFrame>
    </div>
  );
}
