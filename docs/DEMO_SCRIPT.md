# Hifazat demo script

About 5 minutes of demo inside a 7–8 minute pitch. The same steps are on the demo hub (`/`) with an
**Open →** link for each one.

## Before you present

1. Run `npm run dev` and open the demo hub.
2. Press **Reset demo data**.
3. Open two browser windows side by side: the **Customer app** on the left, **Trusted contact** on the right.
4. Rehearse at the time of day you will present. Between midnight and 5 am (Karachi time) the late-night rule adds
   5 points and an extra reason line; outcomes do not change, but the screens look slightly different.
5. Have one sentence ready for "is this real data?": *Everything you see is fictional sample data. The rules,
   workflows and decisions are real code; bank data, money movement and notifications are simulated.*

## Opening (30 seconds)

> In social-engineering scams, the customer sends the money themselves. A caller says they are from the bank, or a
> message promises a BISP payment, and the customer authorises the transfer. The bank's monitoring runs in the
> background, so at the moment of decision the customer gets an OTP and nothing else. Afterwards they report by
> calling a helpline while the money moves on. Hifazat is a mini app inside the payment journey that helps at three
> moments: before paying, with family, and after a scam.

## The walkthrough

### 1. Normal payments stay fast (20 s)
Customer app → Usman → *Routine supplier payment* → Load in app → Send.

> Usman pays the supplier he pays every month. No questions, no delay. If protection slows down every payment,
> people switch it off.

### 2. A first-time payment gets a clear warning (40 s)
Hira → *First payment to an online seller* → Send → answer **No** three times.

> The account looks fine, but it is Hira's first payment there and three times her usual amount. She gets a pause,
> with the reasons in plain language.

Switch to **اردو**.

> Every explanation is also in Urdu. "Don't send" is the main button.

Press **Don't send**.

### 3. A fake bank call is held for family (75 s)
Nasreen → *Fake bank-security call* → Send.

> Nasreen is 67. A caller says her account is compromised and she must move Rs 185,000 to a safe account. The
> account was opened six days ago and already has two scam reports. Then we ask what only she knows.

Answer **Yes** to "on a call" and **Yes** to "claimed to be from a bank". Show the hold screen.

> This is the classic safe-account scam. The money stays in her account and her son Bilal is asked to decide.

Right window (Bilal's phone):

> Bilal sees the amount, the account, why it was held, and Nasreen's answers. He is told to call her on her usual
> number. He cannot approve without confirming he spoke to her.

Press **Stop transfer**. Point at Nasreen's phone updating.

### 4. When a scam gets through, reporting takes a minute (50 s)
Kamran → *Large transfer after a SIM change* → Send → answer the questions → cooling-off hold.

> Kamran's SIM was replaced three hours ago and he has no trusted contact, so the transfer waits four hours.

Use **Demo control → Skip cooling-off**.

> Not every scam is caught. When one gets through, speed matters.

Home screen → **Report scam** on the Shahid transfer → *Someone got my OTP or PIN* → caller `0300 118 7720` → Send.

> Four taps. The bank gets a structured, time-stamped case instead of helpline notes.

### 5. The fraud desk closes the loop (45 s)
Fraud desk → Kamran's case is at the top, marked **Within the hour**.

> The desk sees the check that ran before Kamran paid, his answers, and that this caller number appears in two
> other reports.

Press **Confirm scam and flag account**.

### 6. The next customer is protected (30 s)
Customer app → Usman → Send money → New recipient → `0345 0071 2296` → any amount → Send → **Stopped**.

> Kamran's report just protected Usman. Monitoring alone can't create that loop. It needs the customer's report and
> the customer-facing check working together.

Back to the fraud desk numbers.

## Close (20 seconds)

> Hifazat is designed to sit inside myABL. A pilot would start with senior citizens, first-time digital users and
> customers who recently changed devices, measured by warnings heeded, report time and money kept in accounts.

## Likely questions

**Doesn't the bank already have fraud monitoring?**
Yes, and Hifazat does not replace it. Monitoring scores transactions in the background. Hifazat is the
customer-facing layer: it asks what only the customer knows, explains warnings, involves family, and feeds
structured reports back to the fraud team.

**Won't scammers just tell victims to answer "No"?**
Some will. That is why account signals alone can hold a transfer (Nasreen's would be held even with all "No"
answers), and why trusted contacts must call the customer directly before approving.

**What if the scammer controls the phone and removes the trusted contact?**
Removal takes 24 hours, the contact is told, and the contact can cancel it. Guarded mode cannot be switched off
while a contact is active.

**Where do payee account age and reports come from?**
In the demo, from sample data. Live, account age and title would come through interbank rails such as 1LINK or
Raast, and reports from the bank's own fraud desk. That integration is the main dependency on Allied Bank.

**How were the risk weights chosen?**
They are starting values chosen to make the scenarios behave sensibly. In a pilot they would be calibrated on the
bank's own fraud data. Every weight is visible on the fraud desk.

**Does this add friction?**
Routine payments to known payees see nothing. Questions appear only from 15 risk points, and holds only for clearly
risky transfers.

**Is the Urdu reviewed?**
Not yet by a native-speaker reviewer. Say so if asked.

## Do not claim

- Live Allied Bank integration, real customers, or real money movement.
- Customer demand or pilot results (none yet).
- Recovered funds: the desk can only *request* a hold from the receiving bank, and that is simulated.
- That the weights are tuned on real fraud data.

## If something goes wrong

- Screens out of sync: press **Reset demo data** on the hub and restart from step 1.
- Live demo impossible: the automated tests (`npm test`, 50 tests) show the same scenarios passing.
