// Scripted demo scenarios. Each one pairs a sample customer with a transfer that
// exercises a different outcome of the pre-payment check.

export interface Scenario {
  id: string;
  customerId: string;
  payeeId: string;
  amount: number;
  title: string;
  story: string;
  expected: "allow" | "pause" | "hold" | "stop";
}

export const SCENARIOS: Scenario[] = [
  {
    id: "safe_account",
    customerId: "c_nasreen",
    payeeId: "p_asif",
    amount: 185_000,
    title: "Fake bank-security call",
    story: "A caller claiming to be from the bank tells Nasreen her account is compromised and she must move her savings to a 'safe account'.",
    expected: "hold",
  },
  {
    id: "routine_supplier",
    customerId: "c_usman",
    payeeId: "p_alnoor",
    amount: 78_000,
    title: "Routine supplier payment",
    story: "Usman pays the supplier he has paid every few weeks for years.",
    expected: "allow",
  },
  {
    id: "new_device",
    customerId: "c_kamran",
    payeeId: "p_shahid",
    amount: 250_000,
    title: "Large transfer after a SIM change",
    story: "Three hours after Kamran's SIM was replaced, a large transfer goes to a wallet opened 11 days ago.",
    expected: "hold",
  },
  {
    id: "online_seller",
    customerId: "c_hira",
    payeeId: "p_faraz",
    amount: 14_500,
    title: "First payment to an online seller",
    story: "Hira pays an established electronics seller for the first time.",
    expected: "pause",
  },
  {
    id: "known_mule",
    customerId: "c_hira",
    payeeId: "p_zubair",
    amount: 6_000,
    title: "BISP 'processing fee'",
    story: "An SMS tells Hira she has won a BISP payment and must first pay a fee to an account already confirmed as a mule.",
    expected: "stop",
  },
];
