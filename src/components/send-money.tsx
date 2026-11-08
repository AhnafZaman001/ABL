"use client";

import { useState } from "react";
import { postJson } from "@/lib/client";
import { accountAge, formatPKR, initials } from "@/lib/format";
import type { DemoSnapshot } from "@/lib/queries";
import { HEADLINES, type Answers, type QuestionId, type RiskAssessment } from "@/lib/risk";
import type { Intent } from "@/lib/transfer-rules";
import type { Customer, Payee, Transfer } from "@/lib/types";
import { LangToggle, ReasonList, T, type Lang } from "./reason-list";
import { Button, TransferStatusBadge } from "./ui";

export interface SendPrefill {
  payeeId: string;
  amount: number;
  purpose: string;
}

const PURPOSES = ["Family support", "Bills", "Purchase", "Supplier payment", "Rent", "Other"];

type Step = "recipient" | "amount" | "questions" | "warning" | "outcome";

interface Outcome {
  transfer: Transfer;
  payee: Payee;
  assessment: RiskAssessment;
  releaseAt: string | null;
  contactName: string | null;
}

const digits = (v: string) => v.replace(/\D/g, "");

const releaseTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Karachi" });

export function SendMoney({ customer, data, prefill, onClose, onReport }: {
  customer: Customer;
  data: DemoSnapshot;
  prefill?: SendPrefill;
  onClose: () => void;
  onReport: (transferId: string) => void;
}) {
  const [step, setStep] = useState<Step>(prefill ? "amount" : "recipient");
  const [lang, setLang] = useState<Lang>("en");
  const [payee, setPayee] = useState<Payee | null>(data.payees.find((p) => p.id === prefill?.payeeId) ?? null);
  const [accountInput, setAccountInput] = useState("");
  const [amount, setAmount] = useState(prefill ? String(prefill.amount) : "");
  const [purpose, setPurpose] = useState(prefill?.purpose ?? PURPOSES[0]);
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savedPayees = Array.from(
    new Set(data.transfers.filter((t) => t.customerId === customer.id && t.status === "completed").map((t) => t.payeeId)),
  )
    .map((id) => data.payees.find((p) => p.id === id))
    .filter((p): p is Payee => Boolean(p));

  const lookedUp = accountInput.trim()
    ? data.payees.find((p) => digits(p.accountNumber) === digits(accountInput)) ?? null
    : null;

  const base = { customerId: customer.id, payeeId: payee?.id, amount: Number(amount), purpose };

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function submit(intent: Intent, finalAnswers: Answers) {
    const result = await run(() => postJson<Outcome>("/api/transfers", { ...base, answers: finalAnswers, intent }));
    if (result) {
      setOutcome(result);
      setStep("outcome");
    }
  }

  /** Allow, hold and stop are recorded straight away; a pause waits for the customer's choice. */
  async function afterFinal(result: RiskAssessment, finalAnswers: Answers) {
    setAssessment(result);
    if (result.level === "pause") setStep("warning");
    else await submit("send", finalAnswers);
  }

  async function check() {
    const result = await run(() => postJson<{ assessment: RiskAssessment }>("/api/risk/assess", base));
    if (!result) return;
    if (result.assessment.final) await afterFinal(result.assessment, {});
    else {
      setAssessment(result.assessment);
      setAnswers({});
      setStep("questions");
    }
  }

  async function submitAnswers() {
    const result = await run(() => postJson<{ assessment: RiskAssessment }>("/api/risk/assess", { ...base, answers }));
    if (result) await afterFinal(result.assessment, answers);
  }

  const amountValue = Number(amount);
  const amountError =
    amount && (!Number.isFinite(amountValue) || amountValue <= 0)
      ? "Enter an amount above zero"
      : amountValue > customer.balance
        ? "More than your available balance"
        : null;

  return (
    <div className="flex min-h-full flex-col bg-canvas">
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
        <button onClick={onClose} className="text-sm text-muted hover:text-ink" disabled={busy}>
          {step === "outcome" ? "Done" : "Cancel"}
        </button>
        <span className="text-sm font-semibold">Send money</span>
        <LangToggle lang={lang} onChange={setLang} />
      </div>

      <div className="flex-1 space-y-4 p-4">
        {error && <p className="rounded-lg bg-stop-soft px-3 py-2 text-sm text-stop">{error}</p>}

        {step === "recipient" && (
          <>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Saved recipients</h3>
              <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
                {savedPayees.map((p) => (
                  <li key={p.id}>
                    <button
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-canvas"
                      onClick={() => {
                        setPayee(p);
                        setStep("amount");
                      }}
                    >
                      <Avatar name={p.title} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.title}</span>
                        <span className="block text-[11px] text-muted">{p.bank} · {p.accountNumber}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">New recipient</h3>
              <input
                value={accountInput}
                onChange={(e) => setAccountInput(e.target.value)}
                placeholder="Account or wallet number"
                inputMode="numeric"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
              />
              {accountInput.trim() && (
                lookedUp ? (
                  <div className="rounded-lg border border-line bg-surface p-3">
                    <p className="text-[11px] text-muted">Account title (simulated directory lookup)</p>
                    <p className="font-medium">{lookedUp.title}</p>
                    <p className="text-xs text-muted">{lookedUp.bank} · {accountAge(lookedUp.openedAt)}</p>
                    <Button
                      className="mt-3 w-full"
                      onClick={() => {
                        setPayee(lookedUp);
                        setStep("amount");
                      }}
                    >
                      Continue
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted">No account found in the sample directory.</p>
                )
              )}
            </div>
          </>
        )}

        {step === "amount" && payee && (
          <>
            <PayeeCard payee={payee} onChange={prefill ? undefined : () => setStep("recipient")} />
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted">Amount (Rs)</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="0"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-2xl font-semibold outline-none focus:border-brand"
              />
              <span className={`text-xs ${amountError ? "text-stop" : "text-muted"}`}>
                {amountError ?? `Available: ${formatPKR(customer.balance)}`}
              </span>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted">Purpose</span>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              >
                {PURPOSES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </label>
            <Button className="w-full" disabled={!amount || Boolean(amountError) || busy} onClick={check}>
              {busy ? <T lang={lang} en="Checking this transfer…" ur="ٹرانسفر کی جانچ ہو رہی ہے…" /> : `Send ${amount ? formatPKR(amountValue) : ""}`}
            </Button>
          </>
        )}

        {step === "questions" && assessment && (
          <>
            <div className="rounded-xl bg-brand-soft p-3 text-sm text-brand-strong">
              <T
                lang={lang}
                en="Before we send this, please answer three quick questions. Scammers often tell people to lie to their bank, so answer honestly."
                ur="بھیجنے سے پہلے تین مختصر سوالوں کے جواب دیں۔ دھوکے باز اکثر لوگوں کو بینک سے جھوٹ بولنے کو کہتے ہیں، اس لیے سچ بتائیں۔"
              />
            </div>
            {assessment.questions.map((q) => (
              <div key={q.id} className="rounded-xl border border-line bg-surface p-3">
                <T lang={lang} en={q.en} ur={q.ur} className="text-sm font-medium" />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {([true, false] as const).map((value) => (
                    <button
                      key={String(value)}
                      onClick={() => setAnswers((a) => ({ ...a, [q.id as QuestionId]: value }))}
                      aria-pressed={answers[q.id] === value}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        answers[q.id] === value ? "border-brand bg-brand text-white" : "border-line hover:bg-canvas"
                      }`}
                    >
                      {value ? (lang === "ur" ? "ہاں" : "Yes") : lang === "ur" ? "نہیں" : "No"}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <Button
              className="w-full"
              disabled={busy || assessment.questions.some((q) => answers[q.id] === undefined)}
              onClick={submitAnswers}
            >
              {lang === "ur" ? "جاری رکھیں" : "Continue"}
            </Button>
          </>
        )}

        {step === "warning" && assessment && payee && (
          <>
            <Banner tone="pause" lang={lang} title={HEADLINES.pause} />
            <p className="text-sm text-muted">{formatPKR(amountValue)} to {payee.title}</p>
            <ReasonList reasons={assessment.reasons} lang={lang} />
            <Button className="w-full" disabled={busy} onClick={() => submit("cancel", answers)}>
              {lang === "ur" ? "نہیں بھیجنا" : "Don't send"}
            </Button>
            <Button variant="secondary" className="w-full" disabled={busy} onClick={() => submit("send_after_warning", answers)}>
              {lang === "ur" ? "خطرہ سمجھ لیا، پھر بھی بھیجیں" : "I understand the risk, send anyway"}
            </Button>
          </>
        )}

        {step === "outcome" && outcome && (
          <OutcomeView
            outcome={outcome}
            live={data.transfers.find((t) => t.id === outcome.transfer.id) ?? outcome.transfer}
            lang={lang}
            busy={busy}
            onCancel={async () => {
              await run(() => postJson(`/api/transfers/${outcome.transfer.id}/cancel`, { customerId: customer.id }));
            }}
            onReport={() => onReport(outcome.transfer.id)}
          />
        )}
      </div>
    </div>
  );
}

function OutcomeView({ outcome, live, lang, busy, onCancel, onReport }: {
  outcome: Outcome;
  live: Transfer;
  lang: Lang;
  busy: boolean;
  onCancel: () => void;
  onReport: () => void;
}) {
  const { payee, assessment, contactName, releaseAt } = outcome;
  const what = `${formatPKR(live.amount)} to ${payee.title}`;
  const held = live.status === "pending_approval" || live.status === "cooling_off";

  return (
    <div className="space-y-4">
      {live.status === "completed" && (
        <Banner tone="allow" lang={lang} title={{ en: "Money sent", ur: "رقم بھیج دی گئی" }} />
      )}
      {live.status === "pending_approval" && (
        <Banner
          tone="hold"
          lang={lang}
          title={{ en: `Waiting for ${contactName} to approve`, ur: `${contactName} کی منظوری کا انتظار ہے` }}
          body={{
            en: `We have asked ${contactName}, your trusted contact, to review this transfer. The money stays in your account until they approve.`,
            ur: `ہم نے آپ کے بھروسے کے رابطے ${contactName} سے اس ٹرانسفر کا جائزہ لینے کو کہا ہے۔ منظوری تک رقم آپ کے اکاؤنٹ میں ہی رہے گی۔`,
          }}
        />
      )}
      {live.status === "cooling_off" && releaseAt && (
        <Banner
          tone="hold"
          lang={lang}
          title={{ en: `On hold until ${releaseTime(releaseAt)}`, ur: `${releaseTime(releaseAt)} تک روک دی گئی` }}
          body={{
            en: "The money stays in your account during this time. If anyone is pressuring you to hurry, that is a warning sign.",
            ur: "اس دوران رقم آپ کے اکاؤنٹ میں ہی رہے گی۔ اگر کوئی آپ پر جلدی کرنے کا دباؤ ڈال رہا ہے تو یہ خطرے کی علامت ہے۔",
          }}
        />
      )}
      {live.status === "stopped" && (
        <Banner
          tone="stop"
          lang={lang}
          title={HEADLINES.stop}
          body={{
            en: "Do not send money to this account another way. If someone is on the phone with you, hang up and call your bank on the number printed on your card.",
            ur: "اس اکاؤنٹ میں کسی اور طریقے سے رقم نہ بھیجیں۔ اگر کوئی فون پر آپ سے بات کر رہا ہے تو کال بند کریں اور اپنے کارڈ پر لکھے نمبر پر بینک کو فون کریں۔",
          }}
        />
      )}
      {(live.status === "cancelled" || live.status === "declined") && (
        <Banner
          tone="allow"
          lang={lang}
          title={
            live.status === "declined"
              ? { en: `${contactName} stopped this transfer`, ur: `${contactName} نے یہ ٹرانسفر روک دی` }
              : { en: "Transfer cancelled", ur: "ٹرانسفر منسوخ کر دی گئی" }
          }
          body={{ en: "No money has left your account.", ur: "آپ کے اکاؤنٹ سے کوئی رقم نہیں گئی۔" }}
        />
      )}

      <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2.5 text-sm">
        <span>{what}</span>
        <TransferStatusBadge status={live.status} />
      </div>

      {assessment.reasons.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            <T lang={lang} en="Why we checked this" ur="ہم نے یہ جانچ کیوں کی" />
          </h3>
          <ReasonList reasons={assessment.reasons} lang={lang} />
        </div>
      )}

      {held && (
        <Button variant="secondary" className="w-full" disabled={busy} onClick={onCancel}>
          {lang === "ur" ? "ٹرانسفر منسوخ کریں" : "Cancel this transfer"}
        </Button>
      )}
      {(live.status === "stopped" || live.status === "declined") && (
        <Button variant="secondary" className="w-full" onClick={onReport}>
          {lang === "ur" ? "اس فراڈ کی اطلاع دیں" : "Report this scam attempt"}
        </Button>
      )}
    </div>
  );
}

type Text = { en: string; ur: string };

function Banner({ tone, lang, title, body }: { tone: "allow" | "pause" | "hold" | "stop"; lang: Lang; title: Text; body?: Text }) {
  const styles = {
    allow: "bg-allow-soft text-allow",
    pause: "bg-pause-soft text-pause",
    hold: "bg-hold-soft text-hold",
    stop: "bg-stop-soft text-stop",
  }[tone];
  return (
    <div className={`rounded-xl p-4 ${styles}`}>
      <T lang={lang} en={title.en} ur={title.ur} className="text-base font-semibold" />
      {body && <T lang={lang} en={body.en} ur={body.ur} className="mt-1 text-sm text-ink" />}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-strong">
      {initials(name)}
    </span>
  );
}

function PayeeCard({ payee, onChange }: { payee: Payee; onChange?: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
      <Avatar name={payee.title} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{payee.title}</p>
        <p className="text-[11px] text-muted">{payee.bank} · {payee.accountNumber}</p>
      </div>
      {onChange && (
        <button onClick={onChange} className="text-xs text-brand">Change</button>
      )}
    </div>
  );
}
