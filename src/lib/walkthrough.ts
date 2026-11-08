// The presentation storyline: each step names the screen to open, what to click,
// and the one point it proves. Run it in order after "Reset demo data".

export interface WalkthroughStep {
  title: string;
  href: string;
  view: string;
  steps: string[];
  point: string;
}

export const WALKTHROUGH: WalkthroughStep[] = [
  {
    title: "Normal payments stay fast",
    href: "/customer?customer=c_usman",
    view: "Customer app · Usman",
    steps: ["Try a scenario → Routine supplier payment → Load in app", "Press Send"],
    point: "No questions, no friction: the check only speaks up when something looks wrong.",
  },
  {
    title: "A first-time payment gets a clear warning",
    href: "/customer?customer=c_hira",
    view: "Customer app · Hira",
    steps: [
      "Load 'First payment to an online seller' and press Send",
      "Answer No to all three questions",
      "Switch to اردو to show the Urdu explanation, then choose Don't send",
    ],
    point: "Every warning says why, in plain English or Urdu, and not sending is the easy choice.",
  },
  {
    title: "A fake bank call is held for family",
    href: "/customer?customer=c_nasreen",
    view: "Customer app · Nasreen, then Trusted contact · Bilal",
    steps: [
      "Load 'Fake bank-security call' and press Send",
      "Answer Yes to the call and to the official claim",
      "Open the Trusted contact page in a second window: Bilal sees the amount, the reasons and Nasreen's answers",
      "Press Stop transfer and watch Nasreen's phone update",
    ],
    point: "Questions catch what account data cannot see, and family can step in before money leaves.",
  },
  {
    title: "When a scam gets through, reporting takes a minute",
    href: "/customer?customer=c_kamran",
    view: "Customer app · Kamran",
    steps: [
      "Load 'Large transfer after a SIM change', answer the questions, and see the cooling-off hold",
      "Use Demo control → Skip cooling-off to let it go through",
      "On the home screen press Report scam on that transfer: OTP theft, caller 0300 118 7720",
    ],
    point: "The report arrives as a structured, time-stamped case instead of a helpline note.",
  },
  {
    title: "The fraud desk closes the loop",
    href: "/desk",
    view: "Fraud desk",
    steps: [
      "Open Kamran's case: it is flagged as within the hour",
      "Point out that the caller number appears in two other reports",
      "Press Confirm scam and flag account",
    ],
    point: "One confirmed report protects every other customer who tries to pay that account.",
  },
  {
    title: "The next customer is protected",
    href: "/customer?customer=c_usman",
    view: "Customer app · Usman",
    steps: [
      "Send money → New recipient → type 0345 0071 2296 (Shahid Mehmood)",
      "Enter any amount and press Send: the transfer is stopped",
      "Return to the Fraud desk to show the impact numbers",
    ],
    point: "Kamran's report stopped Usman's payment. That is the loop a bank cannot get from monitoring alone.",
  },
];
