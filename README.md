# Hifazat — scam protection at the moment of payment

A proof of concept for the **5th Allied Bank Fintech Hackathon 2026** (Mini Apps theme, Early-Stage category).

Hifazat is a mini app designed to sit inside a bank's payment journey. It checks a transfer for warning signs
before the money leaves, brings in a trusted family contact for risky payments, and turns scam reports into
structured cases that protect the next customer.

> Independent hackathon project. Not an Allied Bank product and not connected to any bank. All people, banks and
> accounts in the demo are fictional.

## What it does

| Moment | What happens |
|---|---|
| **Before paying** | Each transfer is scored on account signals (new payee, young or reported account, unusual amount, recent SIM change). Above 15 points the customer answers up to three questions, such as "Is someone on a call telling you to make this payment?" The result is **allow**, **pause**, **hold** or **stop**, explained in English and Urdu. |
| **With family** | A customer can nominate a trusted contact. Held transfers wait for that person, who sees the reasons and the customer's answers and must confirm they spoke to the customer before approving. Removing a contact takes 24 hours and the contact is told. |
| **After a scam** | The customer reports in about four taps. The fraud desk sees a time-stamped case with the pre-payment check, linked reports and matching caller numbers. Confirming a case flags the account, and every later transfer to it is stopped. |

## Run it

Requires Node.js 22.13 or later (uses the built-in `node:sqlite`).

```bash
npm install
npm run dev
```

Open http://localhost:3000. The demo hub has a step-by-step walkthrough and a **Reset demo data** button.
Sample data is created automatically in `data/hifazat.db` (git-ignored).

```bash
npm test        # 50 tests: risk rules, transfer decisions, approvals, reports, metrics
npm run lint
npm run build
```

## Screens

- `/` — demo hub: walkthrough, scenarios, recent activity, real vs simulated
- `/customer` — customer phone: send money, scam protection settings, report a scam
- `/contact` — trusted contact phone: invitations and approval requests
- `/desk` — fraud desk: impact numbers, case queue, payee registry, audit log, risk rules

## Real vs simulated

| Real in this proof of concept | Simulated |
|---|---|
| Risk rules and bilingual explanations, re-run on the server for every transfer | Customers, balances, history and device/SIM events (fictional) |
| Send-money journey with allow / pause / hold / stop | Payee name and account age from other banks (would need 1LINK / Raast) |
| Trusted-contact invitations, live approval, delayed removal | Money movement |
| Scam reports and fraud-desk case handling | Fund holds and freezes at receiving banks |
| Confirmed accounts stop future and held transfers | SMS and push notifications (shown on screen) |
| Impact numbers and audit log | Embedding in a real banking app (phone frame) |

Risk weights are starting values, not calibrated on real fraud data. Customer demand has not yet been validated.

## Project layout

```
src/lib/risk.ts            risk engine (pure functions)
src/lib/transfer-rules.ts  maps a risk result and the customer's choice to a transfer status
src/lib/transfers.ts       create, cancel and release transfers
src/lib/contacts.ts        trusted-contact enrolment, removal and approvals
src/lib/reports.ts         scam reports and fraud-desk actions
src/lib/metrics.ts         impact numbers
src/lib/seed.ts            fictional sample data
src/app/api/               route handlers
src/components/            customer, contact and desk screens
docs/PRODUCT.md            product definition and registration answers
docs/DEMO_SCRIPT.md        presentation script and likely judge questions
```

Built with Next.js 16, React 19, Tailwind CSS 4, SQLite (`node:sqlite`) and Vitest.
