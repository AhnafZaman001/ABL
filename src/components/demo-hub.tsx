"use client";

import Link from "next/link";
import { useState } from "react";
import { formatPKR, timeAgo } from "@/lib/format";
import { SCENARIOS } from "@/lib/scenarios";
import { useDemo } from "@/lib/use-demo";
import { WALKTHROUGH } from "@/lib/walkthrough";
import { Badge, Button, Card, RISK_LEVEL_TONE } from "./ui";

const VIEWS = [
  {
    href: "/customer",
    title: "Customer app",
    body: "Send money as one of the sample customers, answer the safety questions, manage protection and report scams.",
  },
  {
    href: "/contact",
    title: "Trusted contact",
    body: "The family member's phone. Accept an invitation, then approve or stop transfers that were held.",
  },
  {
    href: "/desk",
    title: "Fraud desk",
    body: "Bank staff view: case queue, linked reports, payee registry, impact numbers and the audit log.",
  },
];

const REAL = [
  "Risk rules, scoring and English/Urdu explanations, re-run on the server for every transfer",
  "Send-money journey with allow, pause, hold and stop outcomes",
  "Trusted-contact invitations, live approval across windows, and a 24-hour delay on removal",
  "In-app scam reports and fraud-desk case handling",
  "Confirmed accounts stop future transfers, including ones already on hold",
  "Impact numbers and an audit log of every decision",
  "50 automated tests covering the rules and workflows",
];

const SIMULATED = [
  "Customers, balances, history and device or SIM events (fictional sample data)",
  "Payee name and account age from other banks (would need 1LINK or Raast data)",
  "Money movement: no funds are transferred",
  "Fund holds and account freezes at receiving banks",
  "SMS and push notifications (shown on the screens instead)",
  "Embedding in a real banking app (shown in a phone frame)",
];

export function DemoHub() {
  const { data, error, reset } = useDemo(4000);
  const [resetting, setResetting] = useState(false);
  const [done, setDone] = useState<Set<number>>(new Set());
  const customerName = (id: string) => data?.customers.find((c) => c.id === id)?.name ?? id;
  const payeeTitle = (id: string) => data?.payees.find((p) => p.id === id)?.title ?? id;

  async function onReset() {
    setResetting(true);
    await reset();
    setDone(new Set());
    setResetting(false);
  }

  const toggle = (i: number) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Scam protection at the moment of payment</h1>
        <p className="max-w-3xl text-muted">
          Hifazat is a mini app designed to sit inside a bank&apos;s payment journey. It checks a transfer for
          warning signs before the money leaves, brings in a trusted family contact for risky payments, and
          turns scam reports into structured cases that protect the next customer.
        </p>
        <p className="max-w-3xl text-sm text-muted">
          Independent hackathon proof of concept. Not an Allied Bank product and not connected to any bank.
          All people, banks and accounts are fictional.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {VIEWS.map((view) => (
          <Link
            key={view.href}
            href={view.href}
            className="group rounded-xl border border-line bg-surface p-5 transition hover:border-brand"
          >
            <h2 className="font-semibold group-hover:text-brand">{view.title} →</h2>
            <p className="mt-2 text-sm text-muted">{view.body}</p>
          </Link>
        ))}
      </section>

      <Card
        title="Demo walkthrough (about 5 minutes)"
        action={
          <Button variant="secondary" onClick={onReset} disabled={resetting} className="px-3 py-1 text-xs">
            {resetting ? "Resetting…" : "Reset demo data"}
          </Button>
        }
      >
        <p className="mb-4 text-sm text-muted">
          Reset first, then follow the steps in order. Each step builds on the one before. Keep the trusted contact
          page open in a second window for step 3.
        </p>
        <ol className="space-y-3">
          {WALKTHROUGH.map((step, i) => (
            <li
              key={step.title}
              className={`rounded-lg border p-4 transition ${done.has(i) ? "border-allow/40 bg-allow-soft/50" : "border-line"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 gap-3">
                  <button
                    onClick={() => toggle(i)}
                    aria-pressed={done.has(i)}
                    aria-label={`Mark step ${i + 1} done`}
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      done.has(i) ? "bg-allow text-white" : "bg-brand-soft text-brand-strong"
                    }`}
                  >
                    {done.has(i) ? "✓" : i + 1}
                  </button>
                  <div className="min-w-0 space-y-1.5">
                    <p className="font-medium">{step.title}</p>
                    <p className="text-xs text-muted">{step.view}</p>
                    <ul className="list-disc space-y-0.5 pl-4 text-sm">
                      {step.steps.map((s) => <li key={s}>{s}</li>)}
                    </ul>
                    <p className="text-sm text-brand-strong">
                      <span className="font-semibold">Point: </span>{step.point}
                    </p>
                  </div>
                </div>
                <Link
                  href={step.href}
                  className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-canvas"
                >
                  Open →
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Scenario reference">
          <ul className="divide-y divide-line">
            {SCENARIOS.map((s) => (
              <li key={s.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{s.title}</span>
                  <Badge tone={RISK_LEVEL_TONE[s.expected]}>Expected: {s.expected}</Badge>
                </div>
                <p className="text-sm text-muted">{s.story}</p>
                <p className="text-xs text-muted">
                  {customerName(s.customerId)} → {payeeTitle(s.payeeId)} · {formatPKR(s.amount)}
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Recent activity">
          {error && <p className="text-sm text-stop">{error}</p>}
          {!data && !error && <p className="text-sm text-muted">Loading…</p>}
          <ul className="space-y-2 text-sm">
            {data?.events.slice(0, 10).map((e) => (
              <li key={e.id} className="flex justify-between gap-3">
                <span>{e.detail}</span>
                <span className="shrink-0 text-xs text-muted">{timeAgo(e.at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="What is real and what is simulated">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-allow">Working in this proof of concept</h3>
            <ul className="space-y-1.5 text-sm">
              {REAL.map((item) => (
                <li key={item} className="flex gap-2"><span className="text-allow">✓</span>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-pause">Simulated</h3>
            <ul className="space-y-1.5 text-sm">
              {SIMULATED.map((item) => (
                <li key={item} className="flex gap-2"><span className="text-pause">◇</span>{item}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted">
          Risk weights are starting values, not calibrated on real fraud data. Customer demand has not yet been
          validated with interviews.
        </p>
      </Card>
    </div>
  );
}
