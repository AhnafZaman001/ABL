"use client";

import { useState } from "react";
import { karachiTime, postJson } from "@/lib/client";
import { accountAge, formatPKR, timeAgo } from "@/lib/format";
import type { DemoSnapshot } from "@/lib/queries";
import { QUESTIONS, type QuestionId } from "@/lib/risk";
import type { Approval, Customer, TrustedContact } from "@/lib/types";
import { useDemo } from "@/lib/use-demo";
import { PhoneFrame } from "./phone-frame";
import { LangToggle, ReasonList, type Lang } from "./reason-list";
import { Badge, Button, Card, PayeeStatusBadge, SimulatedNote, TransferStatusBadge } from "./ui";

const firstName = (name: string) => name.split(" ")[0];

export function ContactApp() {
  const { data, refresh } = useDemo();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!data) return <p className="p-8 text-sm text-muted">Loading…</p>;

  const contact = data.contacts.find((tc) => tc.id === selectedId) ?? data.contacts[0] ?? null;
  const customer = contact ? data.customers.find((c) => c.id === contact.customerId) ?? null : null;
  const approvals = contact ? data.approvals.filter((a) => a.contactId === contact.id) : [];
  const pending = approvals.filter((a) => a.status === "pending");
  const history = approvals.filter((a) => a.status !== "pending");

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_auto]">
      <div className="space-y-4">
        <Card title="Whose phone is this?">
          {data.contacts.length === 0 ? (
            <p className="text-sm text-muted">
              No trusted contacts yet. Invite one from Scam protection in the customer app.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {data.contacts.map((tc) => {
                const of = data.customers.find((c) => c.id === tc.customerId);
                return (
                  <button
                    key={tc.id}
                    onClick={() => setSelectedId(tc.id)}
                    className={`rounded-lg border p-3 text-left transition ${
                      tc.id === contact?.id ? "border-brand bg-brand-soft" : "border-line hover:bg-canvas"
                    }`}
                  >
                    <div className="font-medium">{tc.name}</div>
                    <div className="text-xs text-muted">
                      {tc.relation} of {of?.name} · {tc.status === "invited" ? "invited" : "active"}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
        <SimulatedNote>
          In a live product these requests would arrive as push notifications in the contact&apos;s own banking app.
          Open this page in a second window next to the customer app to see both sides update live.
        </SimulatedNote>
      </div>

      <PhoneFrame label={contact ? `${contact.name}'s phone (sample)` : "Trusted contact's phone"}>
        <div className="space-y-4 p-4">
          {!contact || !customer ? (
            <Empty>No trusted contact selected.</Empty>
          ) : contact.status === "invited" ? (
            <Invitation contact={contact} customer={customer} onDone={refresh} />
          ) : (
            <>
              <div>
                <p className="text-xs text-muted">Trusted contact for</p>
                <p className="font-semibold">{customer.name}</p>
              </div>
              {contact.removesAt && <RemovalNotice contact={contact} customer={customer} onDone={refresh} />}
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                Waiting for you ({pending.length})
              </h3>
              {pending.length === 0 ? (
                <Empty>Nothing waiting for your approval.</Empty>
              ) : (
                pending.map((a) => (
                  <ApprovalRequest key={a.id} approval={a} contact={contact} customer={customer} data={data} onDone={refresh} />
                ))
              )}
              {history.length > 0 && (
                <>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Earlier requests</h3>
                  <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
                    {history.map((a) => {
                      const t = data.transfers.find((x) => x.id === a.transferId);
                      const p = data.payees.find((x) => x.id === t?.payeeId);
                      return (
                        <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                          <div className="min-w-0">
                            <p className="truncate">{t && formatPKR(t.amount)} to {p?.title}</p>
                            <p className="text-[11px] text-muted">
                              {APPROVAL_LABEL[a.status]} · {timeAgo(a.decidedAt ?? a.createdAt)}
                            </p>
                          </div>
                          {t && <TransferStatusBadge status={t.status} />}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      </PhoneFrame>
    </div>
  );
}

const APPROVAL_LABEL: Record<Approval["status"], string> = {
  pending: "Waiting",
  approved: "You approved",
  declined: "You stopped it",
  withdrawn: "Cancelled by the customer",
  expired: "Expired without a decision",
};

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-sm text-muted">
      {children}
    </div>
  );
}

function useAction(onDone: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, act };
}

function Invitation({ contact, customer, onDone }: { contact: TrustedContact; customer: Customer; onDone: () => Promise<void> }) {
  const { busy, error, act } = useAction(onDone);
  const respond = (accept: boolean) => act(() => postJson(`/api/contacts/${contact.id}/respond`, { accept }));
  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <Badge tone="brand">Invitation</Badge>
      <p className="font-semibold">{customer.name} has asked you to be their trusted contact</p>
      <ul className="space-y-1.5 text-sm text-muted">
        <li>• You will be asked to approve transfers the bank holds as risky.</li>
        <li>• You cannot see {firstName(customer.name)}&apos;s balance or move their money.</li>
        <li>• If you don&apos;t respond within 24 hours, a held transfer is cancelled.</li>
      </ul>
      {error && <p className="text-sm text-stop">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => respond(false)}>Decline</Button>
        <Button disabled={busy} onClick={() => respond(true)}>Accept</Button>
      </div>
    </div>
  );
}

function RemovalNotice({ contact, customer, onDone }: { contact: TrustedContact; customer: Customer; onDone: () => Promise<void> }) {
  const { busy, error, act } = useAction(onDone);
  return (
    <div className="space-y-2 rounded-xl bg-hold-soft p-3 text-sm">
      <p className="font-medium text-hold">{customer.name} asked to remove you as trusted contact</p>
      <p className="text-ink">
        This takes effect at {karachiTime(contact.removesAt!)}. If you did not expect this, call{" "}
        {firstName(customer.name)}: scammers sometimes ask victims to remove family protection first.
      </p>
      {error && <p className="text-stop">{error}</p>}
      <Button variant="secondary" className="w-full" disabled={busy} onClick={() => act(() => postJson(`/api/contacts/${contact.id}/keep`))}>
        Keep me as trusted contact
      </Button>
    </div>
  );
}

function ApprovalRequest({ approval, contact, customer, data, onDone }: {
  approval: Approval;
  contact: TrustedContact;
  customer: Customer;
  data: DemoSnapshot;
  onDone: () => Promise<void>;
}) {
  const [lang, setLang] = useState<Lang>("en");
  const [spoke, setSpoke] = useState(false);
  const [note, setNote] = useState("");
  const { busy, error, act } = useAction(onDone);

  const transfer = data.transfers.find((t) => t.id === approval.transferId);
  const payee = data.payees.find((p) => p.id === transfer?.payeeId);
  if (!transfer || !payee) return null;

  const name = firstName(customer.name);
  const answered = Object.entries(transfer.answers) as [QuestionId, boolean][];
  const decide = (decision: "approve" | "decline") =>
    act(() => postJson(`/api/approvals/${approval.id}/decide`, { contactId: contact.id, decision, spokeToCustomer: spoke, note }));

  return (
    <article className="space-y-3 rounded-xl border border-hold/30 bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-2xl font-semibold">{formatPKR(transfer.amount)}</p>
          <p className="text-xs text-muted">from {customer.name} · held {timeAgo(approval.createdAt)}</p>
        </div>
        <Badge tone="hold">Risk {transfer.riskScore}/100</Badge>
      </div>

      <div className="rounded-lg bg-canvas p-3 text-sm">
        <p className="text-[11px] text-muted">To</p>
        <p className="font-medium">{payee.title}</p>
        <p className="text-xs text-muted">{payee.bank} · {accountAge(payee.openedAt)}</p>
        <div className="mt-1.5"><PayeeStatusBadge status={payee.status} /></div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Why it was held</h4>
          <LangToggle lang={lang} onChange={setLang} />
        </div>
        <ReasonList reasons={transfer.reasons} lang={lang} />
      </div>

      {answered.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{name}&apos;s answers</h4>
          <ul className="space-y-1 text-xs">
            {answered.map(([id, yes]) => (
              <li key={id} className="flex justify-between gap-3">
                <span className="text-muted">{QUESTIONS[id].en}</span>
                <span className={`shrink-0 font-semibold ${yes ? "text-stop" : "text-ink"}`}>{yes ? "Yes" : "No"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg bg-brand-soft p-3 text-xs text-brand-strong">
        Before deciding, call {name} on the number you normally use, not one given in a message. If someone is on the
        line telling {name} what to do, ask {name} to hang up.
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={spoke} onChange={(e) => setSpoke(e.target.checked)} className="mt-1" />
        <span>I have spoken to {name} directly and they want to make this payment.</span>
      </label>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        rows={2}
        className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand"
      />

      {error && <p className="text-sm text-stop">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="danger" disabled={busy} onClick={() => decide("decline")}>Stop transfer</Button>
        <Button variant="secondary" disabled={busy || !spoke} onClick={() => decide("approve")}>Approve</Button>
      </div>
    </article>
  );
}
