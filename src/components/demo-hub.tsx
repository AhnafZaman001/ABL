"use client";

import Link from "next/link";
import { useState } from "react";
import { formatPKR, timeAgo } from "@/lib/format";
import { SCENARIOS } from "@/lib/scenarios";
import { useDemo } from "@/lib/use-demo";
import { Badge, Button, Card, RISK_LEVEL_TONE } from "./ui";

const VIEWS = [
  {
    href: "/customer",
    title: "Customer app",
    body: "Send money as one of the sample customers and see the pre-payment check, warnings and scam reporting.",
  },
  {
    href: "/contact",
    title: "Trusted contact",
    body: "The family member's phone. Approve or stop transfers that were held for review.",
  },
  {
    href: "/desk",
    title: "Fraud desk",
    body: "Bank staff view of scam reports, the payee registry and the audit log.",
  },
];

const REAL = [
  "Risk rules, scoring and bilingual explanations",
  "Transfer journey with allow, pause, hold and stop outcomes",
  "Trusted-contact approval across devices",
  "Scam reports and fraud-desk case handling",
  "Payee registry updated by confirmed reports",
  "Audit log of every decision",
];

const SIMULATED = [
  "Balances, history and device or SIM events (sample data)",
  "Payee details from other banks (would need 1LINK or Raast data)",
  "Money movement: no funds are transferred",
  "Freezing accounts at other banks",
  "SMS and push notifications (shown in-app)",
  "Embedding in a real banking app (shown in a phone frame)",
];

export function DemoHub() {
  const { data, error, reset } = useDemo(4000);
  const [resetting, setResetting] = useState(false);
  const customerName = (id: string) => data?.customers.find((c) => c.id === id)?.name ?? id;
  const payeeTitle = (id: string) => data?.payees.find((p) => p.id === id)?.title ?? id;

  async function onReset() {
    setResetting(true);
    await reset();
    setResetting(false);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Scam protection at the moment of payment</h1>
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

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card
          title="Demo scenarios"
          action={
            <Button variant="secondary" onClick={onReset} disabled={resetting} className="px-3 py-1 text-xs">
              {resetting ? "Resetting…" : "Reset demo data"}
            </Button>
          }
        >
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
            {data?.events.slice(0, 8).map((e) => (
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
            <h3 className="mb-2 text-sm font-semibold text-allow">Real logic (built module by module)</h3>
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
      </Card>
    </div>
  );
}
