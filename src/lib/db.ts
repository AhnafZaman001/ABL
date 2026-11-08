import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { buildSeed } from "./seed";
import type {
  Approval,
  AuditEvent,
  Customer,
  Payee,
  ScamReport,
  Transfer,
  TrustedContact,
} from "./types";

/** Bump when the schema changes; older demo databases are rebuilt from the seed. */
const SCHEMA_VERSION = 2;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  city TEXT NOT NULL,
  segment TEXT NOT NULL,
  balance INTEGER NOT NULL,
  protection_mode TEXT NOT NULL,
  device_changed_at TEXT,
  persona TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS trusted_contacts (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  name TEXT NOT NULL,
  relation TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL,
  invited_at TEXT NOT NULL,
  removes_at TEXT
);
CREATE TABLE IF NOT EXISTS payees (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  bank TEXT NOT NULL,
  account_number TEXT NOT NULL UNIQUE,
  opened_at TEXT NOT NULL,
  status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS transfers (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  payee_id TEXT NOT NULL REFERENCES payees(id),
  amount INTEGER NOT NULL,
  purpose TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL,
  risk_score INTEGER,
  risk_level TEXT,
  reasons TEXT NOT NULL DEFAULT '[]',
  answers TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  transfer_id TEXT NOT NULL REFERENCES transfers(id),
  contact_id TEXT NOT NULL REFERENCES trusted_contacts(id),
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  decided_at TEXT,
  note TEXT
);
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id),
  transfer_id TEXT REFERENCES transfers(id),
  payee_id TEXT NOT NULL REFERENCES payees(id),
  channel TEXT NOT NULL,
  scam_type TEXT NOT NULL,
  caller_number TEXT,
  amount INTEGER NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL,
  desk_note TEXT
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  type TEXT NOT NULL,
  ref TEXT,
  detail TEXT NOT NULL
);
`;

const TABLES = ["events", "approvals", "reports", "transfers", "trusted_contacts", "payees", "customers"];

// Reuse one connection across hot reloads in development.
const globalForDb = globalThis as unknown as { hifazatDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (!globalForDb.hifazatDb) {
    // Tests point HIFAZAT_DB_PATH at a temporary file.
    const dbPath = process.env.HIFAZAT_DB_PATH ?? path.join(process.cwd(), "data", "hifazat.db");
    mkdirSync(path.dirname(dbPath), { recursive: true });
    const conn = new DatabaseSync(dbPath);
    conn.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
    const { user_version } = conn.prepare("PRAGMA user_version").get() as { user_version: number };
    if (user_version !== SCHEMA_VERSION) {
      for (const table of TABLES) conn.exec(`DROP TABLE IF EXISTS ${table}`);
      conn.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    }
    conn.exec(SCHEMA);
    globalForDb.hifazatDb = conn;
    const { n } = conn.prepare("SELECT COUNT(*) AS n FROM customers").get() as { n: number };
    if (n === 0) seed(conn);
  }
  return globalForDb.hifazatDb;
}

/** Run `fn` inside a transaction, rolling back if it throws. */
export function transaction<T>(fn: (conn: DatabaseSync) => T): T {
  const conn = db();
  conn.exec("BEGIN");
  try {
    const result = fn(conn);
    conn.exec("COMMIT");
    return result;
  } catch (err) {
    conn.exec("ROLLBACK");
    throw err;
  }
}

/** Wipe all demo data and restore the sample scenarios. */
export function resetDemo(): void {
  transaction((conn) => {
    for (const table of TABLES) conn.exec(`DELETE FROM ${table}`);
    seed(conn);
  });
}

function seed(conn: DatabaseSync): void {
  const data = buildSeed();
  const insertCustomer = conn.prepare(
    `INSERT INTO customers (id, name, age, city, segment, balance, protection_mode, device_changed_at, persona)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const c of data.customers) {
    insertCustomer.run(c.id, c.name, c.age, c.city, c.segment, c.balance, c.protectionMode, c.deviceChangedAt, c.persona);
  }
  const insertContact = conn.prepare(
    `INSERT INTO trusted_contacts (id, customer_id, name, relation, phone, status, invited_at, removes_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const tc of data.contacts) {
    insertContact.run(tc.id, tc.customerId, tc.name, tc.relation, tc.phone, tc.status, tc.invitedAt, tc.removesAt);
  }

  const insertPayee = conn.prepare(
    "INSERT INTO payees (id, title, bank, account_number, opened_at, status) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const p of data.payees) insertPayee.run(p.id, p.title, p.bank, p.accountNumber, p.openedAt, p.status);

  const insertTransfer = conn.prepare(
    `INSERT INTO transfers (id, customer_id, payee_id, amount, purpose, created_at, status, risk_score, risk_level, reasons, answers)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const t of data.transfers) {
    insertTransfer.run(
      t.id, t.customerId, t.payeeId, t.amount, t.purpose, t.createdAt, t.status,
      t.riskScore, t.riskLevel, JSON.stringify(t.reasons), JSON.stringify(t.answers),
    );
  }
  const insertReport = conn.prepare(
    `INSERT INTO reports (id, customer_id, transfer_id, payee_id, channel, scam_type, caller_number, amount, description, created_at, status, desk_note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const r of data.reports) {
    insertReport.run(
      r.id, r.customerId, r.transferId, r.payeeId, r.channel, r.scamType, r.callerNumber,
      r.amount, r.description, r.createdAt, r.status, r.deskNote,
    );
  }
  conn.prepare("INSERT INTO events (at, actor, type, ref, detail) VALUES (?, ?, ?, ?, ?)").run(
    new Date().toISOString(), "system", "demo_reset", null, "Sample data loaded",
  );
}

// Row mappers: SQLite rows use snake_case columns.
type Row = Record<string, unknown>;

export const toCustomer = (r: Row): Customer => ({
  id: r.id as string,
  name: r.name as string,
  age: r.age as number,
  city: r.city as string,
  segment: r.segment as Customer["segment"],
  balance: r.balance as number,
  protectionMode: r.protection_mode as Customer["protectionMode"],
  deviceChangedAt: (r.device_changed_at as string | null) ?? null,
  persona: r.persona as string,
});

export const toContact = (r: Row): TrustedContact => ({
  id: r.id as string,
  customerId: r.customer_id as string,
  name: r.name as string,
  relation: r.relation as string,
  phone: r.phone as string,
  status: r.status as TrustedContact["status"],
  invitedAt: r.invited_at as string,
  removesAt: (r.removes_at as string | null) ?? null,
});

export const toPayee = (r: Row): Payee => ({
  id: r.id as string,
  title: r.title as string,
  bank: r.bank as string,
  accountNumber: r.account_number as string,
  openedAt: r.opened_at as string,
  status: r.status as Payee["status"],
});

export const toTransfer = (r: Row): Transfer => ({
  id: r.id as string,
  customerId: r.customer_id as string,
  payeeId: r.payee_id as string,
  amount: r.amount as number,
  purpose: r.purpose as string,
  createdAt: r.created_at as string,
  status: r.status as Transfer["status"],
  riskScore: (r.risk_score as number | null) ?? null,
  riskLevel: (r.risk_level as Transfer["riskLevel"]) ?? null,
  reasons: JSON.parse(r.reasons as string),
  answers: JSON.parse(r.answers as string),
});

export const toApproval = (r: Row): Approval => ({
  id: r.id as string,
  transferId: r.transfer_id as string,
  contactId: r.contact_id as string,
  status: r.status as Approval["status"],
  createdAt: r.created_at as string,
  decidedAt: (r.decided_at as string | null) ?? null,
  note: (r.note as string | null) ?? null,
});

export const toReport = (r: Row): ScamReport => ({
  id: r.id as string,
  customerId: (r.customer_id as string | null) ?? null,
  transferId: (r.transfer_id as string | null) ?? null,
  payeeId: r.payee_id as string,
  channel: r.channel as ScamReport["channel"],
  scamType: r.scam_type as ScamReport["scamType"],
  callerNumber: (r.caller_number as string | null) ?? null,
  amount: r.amount as number,
  description: r.description as string,
  createdAt: r.created_at as string,
  status: r.status as ScamReport["status"],
  deskNote: (r.desk_note as string | null) ?? null,
});

export const toEvent = (r: Row): AuditEvent => ({
  id: r.id as number,
  at: r.at as string,
  actor: r.actor as string,
  type: r.type as string,
  ref: (r.ref as string | null) ?? null,
  detail: r.detail as string,
});

export function logEvent(actor: string, type: string, ref: string | null, detail: string): void {
  db().prepare("INSERT INTO events (at, actor, type, ref, detail) VALUES (?, ?, ?, ?, ?)").run(
    new Date().toISOString(), actor, type, ref, detail,
  );
}
