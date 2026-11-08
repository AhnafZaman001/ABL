"use client";

import { useState } from "react";
import { karachiTime, postJson } from "@/lib/client";
import { formatPKR, timeAgo } from "@/lib/format";
import type { DemoSnapshot } from "@/lib/queries";
import { SCAM_TYPES } from "@/lib/scam-types";
import type { Customer, ScamReport, ScamType } from "@/lib/types";
import { LangToggle, T, type Lang } from "./reason-list";
import { Button, TransferStatusBadge } from "./ui";

const REPORTABLE = new Set(["completed", "stopped", "declined", "cancelled"]);

type Step = "pick" | "type" | "details" | "done";

const ADVICE = [
  {
    en: "Never share your OTP or PIN, even with someone who says they are from the bank.",
    ur: "اپنا او ٹی پی یا پن کسی کو نہ بتائیں، چاہے وہ خود کو بینک کا نمائندہ کہے۔",
  },
  {
    en: "If you shared your PIN or password, change it now.",
    ur: "اگر آپ نے اپنا پن یا پاس ورڈ کسی کو بتایا ہے تو ابھی تبدیل کریں۔",
  },
  {
    en: "The bank will only contact you about this case from the number printed on your card.",
    ur: "اس کیس کے بارے میں بینک صرف آپ کے کارڈ پر لکھے نمبر سے رابطہ کرے گا۔",
  },
];

export function ReportScam({ customer, data, transferId, onClose }: {
  customer: Customer;
  data: DemoSnapshot;
  transferId?: string;
  onClose: () => void;
}) {
  const [lang, setLang] = useState<Lang>("en");
  const [step, setStep] = useState<Step>(transferId ? "type" : "pick");
  const [selected, setSelected] = useState<string | undefined>(transferId);
  const [scamType, setScamType] = useState<ScamType | null>(null);
  const [callerNumber, setCallerNumber] = useState("");
  const [description, setDescription] = useState("");
  const [report, setReport] = useState<ScamReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reported = new Set(data.reports.map((r) => r.transferId));
  const candidates = data.transfers.filter(
    (t) => t.customerId === customer.id && REPORTABLE.has(t.status) && !reported.has(t.id),
  );
  const transfer = data.transfers.find((t) => t.id === selected);
  const payee = data.payees.find((p) => p.id === transfer?.payeeId);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const created = await postJson<ScamReport>("/api/reports", {
        customerId: customer.id,
        transferId: selected,
        scamType,
        callerNumber,
        description,
      });
      setReport(created);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-canvas">
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
        <button onClick={onClose} className="text-sm text-muted hover:text-ink" disabled={busy}>
          {step === "done" ? "Done" : "Cancel"}
        </button>
        <span className="text-sm font-semibold">Report a scam</span>
        <LangToggle lang={lang} onChange={setLang} />
      </div>

      <div className="flex-1 space-y-4 p-4">
        {error && <p className="rounded-lg bg-stop-soft px-3 py-2 text-sm text-stop">{error}</p>}

        {transfer && payee && step !== "pick" && (
          <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{formatPKR(transfer.amount)} to {payee.title}</p>
              <p className="text-[11px] text-muted">{timeAgo(transfer.createdAt)}</p>
            </div>
            <TransferStatusBadge status={transfer.status} />
          </div>
        )}

        {step === "pick" && (
          <>
            <T lang={lang} en="Which transfer is this about?" ur="یہ کس ٹرانسفر کے بارے میں ہے؟" className="text-sm font-medium" />
            {candidates.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-sm text-muted">
                No transfers to report.
              </p>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
                {candidates.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => {
                        setSelected(t.id);
                        setStep("type");
                      }}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-canvas"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {data.payees.find((p) => p.id === t.payeeId)?.title}
                        </span>
                        <span className="block text-[11px] text-muted">{timeAgo(t.createdAt)} · {formatPKR(t.amount)}</span>
                      </span>
                      <TransferStatusBadge status={t.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {step === "type" && (
          <>
            <T lang={lang} en="What happened?" ur="کیا ہوا؟" className="text-sm font-medium" />
            <div className="space-y-2">
              {(Object.keys(SCAM_TYPES) as ScamType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setScamType(type)}
                  aria-pressed={scamType === type}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm ${
                    scamType === type ? "border-brand bg-brand-soft" : "border-line bg-surface hover:bg-canvas"
                  }`}
                >
                  <T lang={lang} en={SCAM_TYPES[type].en} ur={SCAM_TYPES[type].ur} />
                </button>
              ))}
            </div>
            <Button className="w-full" disabled={!scamType} onClick={() => setStep("details")}>
              {lang === "ur" ? "جاری رکھیں" : "Continue"}
            </Button>
          </>
        )}

        {step === "details" && (
          <>
            <label className="block space-y-1">
              <T lang={lang} en="Caller's number, if any" ur="کال کرنے والے کا نمبر (اگر ہو)" className="text-xs font-medium text-muted" />
              <input
                value={callerNumber}
                onChange={(e) => setCallerNumber(e.target.value)}
                placeholder="0300 1234567"
                inputMode="tel"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="block space-y-1">
              <T lang={lang} en="What did they say? (optional)" ur="انہوں نے کیا کہا؟ (اختیاری)" className="text-xs font-medium text-muted" />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={500}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
            <Button className="w-full" disabled={busy} onClick={submit}>
              {busy ? "Sending…" : lang === "ur" ? "رپورٹ بھیجیں" : "Send report"}
            </Button>
          </>
        )}

        {step === "done" && report && (
          <>
            <div className="rounded-xl bg-allow-soft p-4">
              <T lang={lang} en="Report received" ur="رپورٹ موصول ہو گئی" className="text-base font-semibold text-allow" />
              <p className="mt-1 font-mono text-xs text-ink">
                Case {report.id.toUpperCase()} · {karachiTime(report.createdAt)}
              </p>
              <T
                lang={lang}
                className="mt-2 text-sm text-ink"
                en="Your case has gone to the bank's fraud team with the time of your transfer. Acting quickly gives the bank the best chance to ask the receiving bank to hold the money. Recovery is not guaranteed."
                ur="آپ کا کیس ٹرانسفر کے وقت کے ساتھ بینک کی فراڈ ٹیم کو بھیج دیا گیا ہے۔ جلد کارروائی سے بینک وصول کرنے والے بینک سے رقم روکنے کی درخواست کر سکتا ہے۔ رقم کی واپسی کی ضمانت نہیں۔"
              />
            </div>
            <div className="space-y-2">
              <T lang={lang} en="Stay safe now" ur="ابھی محفوظ رہیں" className="text-xs font-semibold uppercase tracking-wide text-muted" />
              {ADVICE.map((a) => (
                <T key={a.en} lang={lang} en={a.en} ur={a.ur} className="rounded-lg bg-surface px-3 py-2 text-sm" />
              ))}
            </div>
            <p className="text-[11px] text-muted">Simulated: no request is sent to any real bank.</p>
          </>
        )}
      </div>
    </div>
  );
}
