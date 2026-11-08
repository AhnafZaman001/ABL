import "server-only";
import { db, toContact, toCustomer, toPayee, toTransfer } from "./db";
import { assessTransfer, QUESTIONS, type Answers, type QuestionId, type RiskAssessment } from "./risk";
import type { Payee, TrustedContact } from "./types";

export class AssessError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export interface AssessInput {
  customerId: string;
  payeeId?: string;
  accountNumber?: string;
  amount: number;
  answers?: Answers;
}

/** The contact that held transfers go to: only one who has accepted the invitation. */
export function activeContact(customerId: string): TrustedContact | null {
  const row = db().prepare("SELECT * FROM trusted_contacts WHERE customer_id = ? AND status = 'active'").get(customerId);
  return row ? toContact(row) : null;
}

/** Normalise an account number so "0081 4417 2209" and "008144172209" match. */
const digits = (value: string) => value.replace(/\D/g, "");

export function findPayee(input: { payeeId?: string; accountNumber?: string }): Payee | null {
  const conn = db();
  if (input.payeeId) {
    const row = conn.prepare("SELECT * FROM payees WHERE id = ?").get(input.payeeId);
    return row ? toPayee(row) : null;
  }
  if (input.accountNumber) {
    const wanted = digits(input.accountNumber);
    const rows = conn.prepare("SELECT * FROM payees").all().map(toPayee);
    return rows.find((p) => digits(p.accountNumber) === wanted) ?? null;
  }
  return null;
}

/** Load everything the risk engine needs from the database and assess the transfer. */
export function assessFromDb(input: AssessInput, now = Date.now()): { payee: Payee; assessment: RiskAssessment } {
  const conn = db();
  const customerRow = conn.prepare("SELECT * FROM customers WHERE id = ?").get(input.customerId);
  if (!customerRow) throw new AssessError("Unknown customer", 404);
  const customer = toCustomer(customerRow);

  const payee = findPayee(input);
  if (!payee) throw new AssessError("No account found with those details", 404);

  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new AssessError("Enter an amount above zero");
  if (input.amount > customer.balance) throw new AssessError("Amount is more than the available balance");

  const history = conn.prepare("SELECT * FROM transfers WHERE customer_id = ?").all(customer.id).map(toTransfer);
  const { n: openReports } = conn
    .prepare("SELECT COUNT(*) AS n FROM reports WHERE payee_id = ? AND status IN ('new', 'investigating')")
    .get(payee.id) as { n: number };
  const hasTrustedContact = activeContact(customer.id) !== null;

  const assessment = assessTransfer(
    { now, customer, payee, amount: input.amount, history, openReports, hasTrustedContact },
    input.answers,
  );
  return { payee, assessment };
}

/** Accept only known question ids with boolean values. */
export function parseAnswers(value: unknown): Answers | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object") throw new AssessError("Answers must be an object");
  const answers: Answers = {};
  for (const [key, answer] of Object.entries(value)) {
    if (!(key in QUESTIONS)) throw new AssessError(`Unknown question: ${key}`);
    if (typeof answer !== "boolean") throw new AssessError(`Answer to ${key} must be yes or no`);
    answers[key as QuestionId] = answer;
  }
  return answers;
}
