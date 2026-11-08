import "server-only";
import { db, toApproval, toContact, toCustomer, toEvent, toPayee, toReport, toTransfer } from "./db";
import { settleContacts } from "./contacts";
import { settleCoolingOff } from "./transfers";
import type { Approval, AuditEvent, Customer, Payee, ScamReport, Transfer, TrustedContact } from "./types";

export interface DemoSnapshot {
  customers: Customer[];
  contacts: TrustedContact[];
  payees: Payee[];
  transfers: Transfer[];
  approvals: Approval[];
  reports: ScamReport[];
  events: AuditEvent[];
  /** Server time of the snapshot, so views can compute ages without reading the clock during render. */
  now: string;
}

export function getSnapshot(): DemoSnapshot {
  settleCoolingOff();
  settleContacts();
  const conn = db();
  const all = (sql: string) => conn.prepare(sql).all() as Record<string, unknown>[];
  return {
    customers: all("SELECT * FROM customers ORDER BY rowid").map(toCustomer),
    contacts: all("SELECT * FROM trusted_contacts").map(toContact),
    payees: all("SELECT * FROM payees ORDER BY title").map(toPayee),
    transfers: all("SELECT * FROM transfers ORDER BY created_at DESC").map(toTransfer),
    approvals: all("SELECT * FROM approvals ORDER BY created_at DESC").map(toApproval),
    reports: all("SELECT * FROM reports ORDER BY created_at DESC").map(toReport),
    events: all("SELECT * FROM events ORDER BY id DESC LIMIT 100").map(toEvent),
    now: new Date().toISOString(),
  };
}
