# Hifazat — scam protection at the moment of payment

Hackathon concept for the 5th Allied Bank Fintech Hackathon 2026 (Mini Apps theme, Early-Stage category).
This is an independent proof of concept. It is not an Allied Bank product and has no live bank integration.

## Users

| User | Who | What they need |
|---|---|---|
| Customer (primary) | A retail mobile-banking customer sending money, especially senior citizens and first-time digital users | A clear warning before sending money to a scammer, and a fast way to report a scam |
| Trusted contact | A family member nominated by the customer | To approve or stop a risky transfer, with enough context to decide |
| Fraud desk analyst | Bank staff who handle fraud complaints | Structured, time-stamped cases instead of helpline notes, and a way to flag mule accounts |

## Problem

In social-engineering scams (fake helpline calls, prize or BISP messages, OTP theft, impersonation)
the customer authorises the transfer themselves. Bank-side monitoring is invisible to the customer at
the moment they decide, and reporting usually happens by phone after the money has moved on.

## Core workflow

1. **Pre-payment check.** When a customer confirms a transfer, Hifazat evaluates account signals
   (first-time payee, payee account age, reports against the payee, amount versus the customer's history,
   recent device or SIM change, time of day) and asks up to three questions about how the request arrived.
   It returns one of four outcomes, each with plain-language reasons in English and Urdu:
   - **Allow** — no meaningful risk.
   - **Pause** — show the warning, customer may continue after reading it.
   - **Hold** — transfer waits for trusted-contact approval (if enrolled) or a cooling-off delay.
   - **Stop** — payee is a confirmed mule account; transfer is not sent.
2. **Trusted contact.** Customers can nominate a family member. Held transfers create an approval
   request on the contact's device, showing amount, payee, reasons and the customer's answers.
3. **Scam report.** From any recent transfer, the customer can report a scam in about a minute.
   The report captures transaction, payee, scam type, caller number and a short description, and
   opens a time-stamped case for the fraud desk.
4. **Fraud desk.** Analysts see cases ordered by time since the transfer, review the payee, and can
   mark it as a confirmed mule. That immediately changes the outcome for any other customer paying it.

## Real vs simulated

| Real in this proof of concept | Simulated |
|---|---|
| Risk rules, scoring and bilingual explanations | Customer balances, transaction history and device/SIM events (sample data) |
| Transfer journey with allow / pause / hold / stop | Payee account details from other banks (would need 1LINK / Raast data) |
| Trusted-contact enrolment and live approval across devices | Money movement — no funds are transferred |
| Scam report flow and fraud-desk case handling | Freezing or blocking accounts at other banks |
| Payee registry fed by confirmed reports | SMS / push notification delivery (shown in-app instead) |
| Audit log of every decision | Embedding inside a real banking app (shown in a phone frame) |

Customer demand has not been validated with interviews yet. Do not claim it until it has.

## Build modules

1. Project setup, data model, labelled sample data, app shell
2. Risk engine with bilingual explanations and tests
3. Customer transfer journey with the pre-payment check
4. Trusted-contact enrolment and approval
5. Scam report flow and fraud-desk console (closes the loop)
6. Demo scenarios, reset, polish, demo script

## Registration drafts

### Solution brief (192 words, limit 200)

Hifazat is a scam-protection mini app designed to sit inside a bank's payment journey. The State Bank has repeatedly warned about social-engineering fraud: fake helpline calls, prize and BISP messages, OTP theft and impersonation. In these scams the customer authorises the transfer, so bank-side monitoring often acts after the money has moved, and victims report through helpline calls while funds pass through mule accounts.

Hifazat helps at three moments. Before paying, it checks the transfer for warning signs, such as a first-time payee, a recently opened or reported account, an unusual amount or a recent device change. It asks short questions about how the request arrived, then allows, pauses or holds the payment with a plain-language explanation in English or Urdu. Vulnerable customers can nominate a trusted contact who must approve risky transfers. After a scam, a guided report captures the transaction, payee, caller number and evidence in about a minute and sends a structured case to the bank's fraud team; confirmed mule accounts then trigger holds for other customers.

Our proof of concept works end to end on clearly labelled sample data. Account data, payee information and account freezing are simulated.

### What makes it innovative (85 words, limit 100)

Bank fraud systems typically score transactions in the background; the customer sees an OTP and little else. Hifazat adds a customer-facing layer at the moment of decision. It combines account signals with the context only the customer knows, such as whether someone is on the phone guiding them, and explains every warning in plain language. Trusted-contact approval brings family protection into digital payments, and structured scam reports close the loop: one victim's confirmed report can protect the next customer before they pay the same account.

### Go-to-market strategy (95 words, limit 100)

Hifazat is designed for banks rather than direct consumer download. We would pilot it with Allied Bank inside myABL, starting with customers likely most exposed to scams: senior citizens, first-time digital users and customers who recently changed devices. Trusted-contact enrolment would be offered at account opening and in branches, where staff can set it up for elderly customers. Success would be measured by warnings heeded, report time and recovered funds. After a pilot, the same module could be licensed to other banks and wallets, since shared mule-account intelligence becomes more valuable as more institutions participate.
