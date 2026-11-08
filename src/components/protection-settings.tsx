"use client";

import { useState } from "react";
import { karachiTime, postJson } from "@/lib/client";
import type { Customer, TrustedContact } from "@/lib/types";
import { Badge, Button } from "./ui";

const RELATIONS = ["Son", "Daughter", "Spouse", "Brother", "Sister", "Parent", "Friend", "Other"];

export function ProtectionSettings({ customer, contact, onBack, onChanged }: {
  customer: Customer;
  contact: TrustedContact | null;
  onBack: () => void;
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [relation, setRelation] = useState(RELATIONS[0]);
  const [phone, setPhone] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const guarded = customer.protectionMode === "guarded";

  return (
    <div className="flex min-h-full flex-col bg-canvas">
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
        <button onClick={onBack} className="text-sm text-muted hover:text-ink">Back</button>
        <span className="text-sm font-semibold">Scam protection</span>
        <span className="w-8" />
      </div>

      <div className="space-y-4 p-4">
        {error && <p className="rounded-lg bg-stop-soft px-3 py-2 text-sm text-stop">{error}</p>}

        <section className="rounded-xl border border-line bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Guarded mode</h3>
              <p className="mt-1 text-xs text-muted">
                Warns earlier and holds risky transfers sooner. Recommended for senior citizens and new users.
              </p>
            </div>
            <button
              role="switch"
              aria-checked={guarded}
              disabled={busy}
              onClick={() => act(() => postJson(`/api/customers/${customer.id}/protection`, { mode: guarded ? "standard" : "guarded" }))}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${guarded ? "bg-brand" : "bg-line"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${guarded ? "left-5" : "left-0.5"}`} />
            </button>
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <div>
            <h3 className="text-sm font-semibold">Trusted contact</h3>
            <p className="mt-1 text-xs text-muted">
              Someone you trust is asked to approve transfers we hold as risky. They cannot see your balance or move
              your money.
            </p>
          </div>

          {!contact && (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                act(() => postJson("/api/contacts", { customerId: customer.id, name, relation, phone }));
              }}
            >
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <select
                value={relation}
                onChange={(e) => setRelation(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              >
                {RELATIONS.map((r) => <option key={r}>{r}</option>)}
              </select>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Mobile number, e.g. 0300 1234567"
                inputMode="tel"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <Button type="submit" className="w-full" disabled={busy || !name || !phone}>
                Send invitation
              </Button>
            </form>
          )}

          {contact && (
            <div className="rounded-lg bg-canvas p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{contact.name}</p>
                  <p className="text-xs text-muted">{contact.relation} · {contact.phone}</p>
                </div>
                {contact.status === "invited" ? (
                  <Badge tone="pause">Invitation sent</Badge>
                ) : contact.removesAt ? (
                  <Badge tone="hold">Removal scheduled</Badge>
                ) : (
                  <Badge tone="allow">Active</Badge>
                )}
              </div>

              {contact.status === "invited" && (
                <p className="mt-2 text-xs text-muted">Waiting for {contact.name} to accept. Until then, holds use a cooling-off period.</p>
              )}
              {contact.removesAt && (
                <p className="mt-2 text-xs text-muted">
                  {contact.name} stays your trusted contact until {karachiTime(contact.removesAt)} and has been told about
                  this change. The delay protects you if someone else is using your phone.
                </p>
              )}

              {!contact.removesAt && !confirmRemove && (
                <button className="mt-3 text-xs text-stop" onClick={() => setConfirmRemove(true)} disabled={busy}>
                  {contact.status === "invited" ? "Withdraw invitation" : "Remove trusted contact"}
                </button>
              )}
              {confirmRemove && !contact.removesAt && (
                <div className="mt-3 space-y-2 rounded-lg border border-stop/30 bg-stop-soft p-3 text-xs text-stop">
                  <p>
                    {contact.status === "invited"
                      ? "Withdraw the invitation?"
                      : `Removing ${contact.name} takes effect after 24 hours and they will be told. If someone asked you to do this, stop and call your bank.`}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="danger"
                      className="px-3 py-1.5 text-xs"
                      disabled={busy}
                      onClick={() => act(async () => {
                        await postJson(`/api/contacts/${contact.id}/remove`, { customerId: customer.id });
                        setConfirmRemove(false);
                      })}
                    >
                      {contact.status === "invited" ? "Withdraw" : "Remove"}
                    </Button>
                    <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => setConfirmRemove(false)}>
                      Keep
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <p className="text-[11px] text-muted">
          Simulated: invitations and notices appear on the trusted contact screen instead of being sent by SMS.
        </p>
      </div>
    </div>
  );
}
