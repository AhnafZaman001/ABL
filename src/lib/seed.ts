// Sample data for the demo. Every person, bank and account here is fictional.
// Times are relative to the moment the database is seeded so the scenarios stay realistic.

import type { Customer, Payee, ScamReport, Transfer, TrustedContact } from "./types";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export interface SeedData {
  customers: Customer[];
  contacts: TrustedContact[];
  payees: Payee[];
  transfers: Transfer[];
  reports: ScamReport[];
}

export function buildSeed(now = Date.now()): SeedData {
  const ago = (ms: number) => new Date(now - ms).toISOString();

  const customers: Customer[] = [
    {
      id: "c_nasreen",
      name: "Nasreen Akhtar",
      age: 67,
      city: "Lahore",
      segment: "senior",
      balance: 412_500,
      protectionMode: "guarded",
      deviceChangedAt: null,
      persona: "Retired teacher. Uses the app for her pension and to send money to her children.",
    },
    {
      id: "c_usman",
      name: "Usman Tariq",
      age: 34,
      city: "Karachi",
      segment: "regular",
      balance: 238_900,
      protectionMode: "standard",
      deviceChangedAt: null,
      persona: "Runs a hardware shop. Pays the same suppliers every few weeks.",
    },
    {
      id: "c_kamran",
      name: "Kamran Siddiqui",
      age: 46,
      city: "Islamabad",
      segment: "regular",
      balance: 690_000,
      protectionMode: "standard",
      deviceChangedAt: ago(3 * HOUR),
      persona: "Government employee. His phone and SIM were replaced three hours ago.",
    },
    {
      id: "c_hira",
      name: "Hira Baig",
      age: 22,
      city: "Faisalabad",
      segment: "new_digital",
      balance: 58_400,
      protectionMode: "standard",
      deviceChangedAt: null,
      persona: "University student. Opened her account digitally two months ago.",
    },
  ];

  const contacts: TrustedContact[] = [
    {
      id: "tc_bilal",
      customerId: "c_nasreen",
      name: "Bilal Akhtar",
      relation: "Son",
      phone: "0321 555 0142",
      status: "active",
      invitedAt: ago(40 * DAY),
      removesAt: null,
    },
  ];

  const payees: Payee[] = [
    { id: "p_bilal", title: "Bilal Akhtar", bank: "Northgate Bank", accountNumber: "0081 4417 2209", openedAt: ago(9 * 365 * DAY), status: "active" },
    { id: "p_ayesha", title: "Ayesha Akhtar", bank: "Margalla Bank", accountNumber: "2204 9930 1185", openedAt: ago(6 * 365 * DAY), status: "active" },
    { id: "p_alnoor", title: "Al-Noor Traders", bank: "Margalla Bank", accountNumber: "1190 3376 0042", openedAt: ago(5 * 365 * DAY), status: "active" },
    { id: "p_imran", title: "Imran Tariq", bank: "Northgate Bank", accountNumber: "0081 2290 7731", openedAt: ago(4 * 365 * DAY), status: "active" },
    { id: "p_rana", title: "Rana Property Services", bank: "Northgate Bank", accountNumber: "0081 9902 4410", openedAt: ago(7 * 365 * DAY), status: "active" },
    { id: "p_sana", title: "Sana Baig", bank: "Margalla Bank", accountNumber: "2204 1173 6650", openedAt: ago(3 * 365 * DAY), status: "active" },
    { id: "p_faraz", title: "Faraz Electronics", bank: "Northgate Bank", accountNumber: "0081 6634 0918", openedAt: ago(2 * 365 * DAY), status: "active" },
    // Scam-linked accounts used in the demo scenarios.
    { id: "p_asif", title: "Muhammad Asif", bank: "Ravi Microfinance Bank", accountNumber: "7710 0452 8831", openedAt: ago(6 * DAY), status: "under_review" },
    { id: "p_shahid", title: "Shahid Mehmood", bank: "Indus Digital Wallet", accountNumber: "0345 0071 2296", openedAt: ago(11 * DAY), status: "active" },
    { id: "p_zubair", title: "Zubair Khan", bank: "Indus Digital Wallet", accountNumber: "0312 0098 4417", openedAt: ago(19 * DAY), status: "confirmed_mule" },
  ];

  let n = 0;
  const done = (customerId: string, payeeId: string, amount: number, daysAgo: number, purpose: string): Transfer => ({
    id: `t_seed_${++n}`,
    customerId,
    payeeId,
    amount,
    purpose,
    createdAt: ago(daysAgo * DAY),
    status: "completed",
    riskScore: null,
    riskLevel: null,
    reasons: [],
    answers: {},
  });

  const transfers: Transfer[] = [
    done("c_nasreen", "p_bilal", 25_000, 62, "Family support"),
    done("c_nasreen", "p_ayesha", 15_000, 45, "Family support"),
    done("c_nasreen", "p_bilal", 25_000, 31, "Family support"),
    done("c_nasreen", "p_ayesha", 15_000, 15, "Family support"),
    done("c_nasreen", "p_bilal", 30_000, 2, "Family support"),
    done("c_usman", "p_alnoor", 80_000, 40, "Supplier payment"),
    done("c_usman", "p_imran", 20_000, 25, "Family support"),
    done("c_usman", "p_alnoor", 95_000, 20, "Supplier payment"),
    done("c_usman", "p_alnoor", 72_000, 5, "Supplier payment"),
    done("c_kamran", "p_rana", 120_000, 62, "Rent"),
    done("c_kamran", "p_rana", 120_000, 31, "Rent"),
    done("c_kamran", "p_rana", 120_000, 1, "Rent"),
    done("c_hira", "p_sana", 5_000, 20, "Family support"),
    done("c_hira", "p_sana", 3_000, 8, "Family support"),
  ];

  // Reports that reached the bank through other channels before the demo starts.
  const reports: ScamReport[] = [
    {
      id: "r_seed_1",
      customerId: null,
      transferId: null,
      payeeId: "p_asif",
      channel: "helpline",
      scamType: "fake_bank_call",
      callerNumber: "0300 118 7720",
      amount: 140_000,
      description: "Caller said he was from the bank's security team and asked me to move my savings to a 'safe account'.",
      createdAt: ago(2 * DAY),
      status: "investigating",
      deskNote: null,
    },
    {
      id: "r_seed_2",
      customerId: null,
      transferId: null,
      payeeId: "p_asif",
      channel: "helpline",
      scamType: "fake_bank_call",
      callerNumber: "0300 118 7720",
      amount: 65_000,
      description: "Same story: my account was 'compromised' and I had to transfer the balance to protect it.",
      createdAt: ago(20 * HOUR),
      status: "new",
      deskNote: null,
    },
    {
      id: "r_seed_3",
      customerId: null,
      transferId: null,
      payeeId: "p_zubair",
      channel: "helpline",
      scamType: "prize_or_bisp",
      callerNumber: "0311 402 9918",
      amount: 18_500,
      description: "SMS said I had won a BISP payment and needed to pay a processing fee first.",
      createdAt: ago(9 * DAY),
      status: "confirmed",
      deskNote: "Linked to three other complaints. Account flagged to the receiving bank.",
    },
  ];

  return { customers, contacts, payees, transfers, reports };
}
