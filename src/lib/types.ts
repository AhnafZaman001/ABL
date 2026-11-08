export type Segment = "senior" | "new_digital" | "regular";
export type ProtectionMode = "standard" | "guarded";

export interface Customer {
  id: string;
  name: string;
  age: number;
  city: string;
  segment: Segment;
  balance: number;
  protectionMode: ProtectionMode;
  /** ISO time of the last device or SIM change, if any (simulated signal). */
  deviceChangedAt: string | null;
  persona: string;
}

/** A contact must accept the invitation before held transfers are routed to them. */
export type ContactStatus = "invited" | "active";

export interface TrustedContact {
  id: string;
  customerId: string;
  name: string;
  relation: string;
  phone: string;
  status: ContactStatus;
  invitedAt: string;
  /** Removal is delayed so a scammer controlling the phone cannot switch protection off instantly. */
  removesAt: string | null;
}

export type PayeeStatus = "active" | "under_review" | "confirmed_mule";

/** An account at any bank, as the payee directory would describe it (simulated). */
export interface Payee {
  id: string;
  title: string;
  bank: string;
  accountNumber: string;
  openedAt: string;
  status: PayeeStatus;
}

export type TransferStatus =
  | "completed"
  | "pending_approval"
  | "cooling_off"
  | "stopped"
  | "cancelled"
  | "declined";

export type RiskLevel = "allow" | "pause" | "hold" | "stop";

export interface RiskReason {
  code: string;
  weight: number;
  /** Whether the reason came from account data or from the customer's answers. */
  source: "signal" | "answer";
  en: string;
  ur: string;
}

export interface Transfer {
  id: string;
  customerId: string;
  payeeId: string;
  amount: number;
  purpose: string;
  createdAt: string;
  status: TransferStatus;
  riskScore: number | null;
  riskLevel: RiskLevel | null;
  reasons: RiskReason[];
  answers: Record<string, boolean>;
}

/**
 * "withdrawn": the customer cancelled the transfer before the contact decided.
 * "expired": the contact did not respond in time, so the transfer was cancelled.
 */
export type ApprovalStatus = "pending" | "approved" | "declined" | "withdrawn" | "expired";

export interface Approval {
  id: string;
  transferId: string;
  contactId: string;
  status: ApprovalStatus;
  createdAt: string;
  decidedAt: string | null;
  note: string | null;
}

export type ScamType =
  | "fake_bank_call"
  | "prize_or_bisp"
  | "otp_theft"
  | "impersonation"
  | "fake_seller"
  | "other";

export type ReportStatus = "new" | "investigating" | "confirmed" | "rejected";

export type ReportChannel = "app" | "helpline";

export interface ScamReport {
  id: string;
  /** Null when the report came from outside the demo customers, e.g. the helpline. */
  customerId: string | null;
  transferId: string | null;
  payeeId: string;
  channel: ReportChannel;
  scamType: ScamType;
  callerNumber: string | null;
  amount: number;
  description: string;
  createdAt: string;
  status: ReportStatus;
  deskNote: string | null;
}

export interface AuditEvent {
  id: number;
  at: string;
  actor: string;
  type: string;
  ref: string | null;
  detail: string;
}
