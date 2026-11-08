// Pre-payment risk engine. Pure functions only: everything it needs is passed in,
// so the same rules run in tests, in the API and (later) against live bank data.

import { formatPKR } from "./format";
import type { Customer, Payee, ProtectionMode, RiskLevel, RiskReason, Transfer } from "./types";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const HISTORY_WINDOW_DAYS = 90;
export const COOLING_OFF_HOURS = 4;
/** Baseline score at which the customer is asked how the payment request reached them. */
export const QUESTION_THRESHOLD = 15;

/** Score at or above which each level applies. Guarded mode reacts earlier. */
export const THRESHOLDS: Record<ProtectionMode, { pause: number; hold: number }> = {
  standard: { pause: 30, hold: 60 },
  guarded: { pause: 20, hold: 40 },
};

export const WEIGHTS = {
  payeeUnderReview: 35,
  payeeReported: 20,
  firstTimePayee: 15,
  accountUnder30Days: 20,
  accountUnder90Days: 10,
  amountOverTwiceMax: 20,
  amountOverMax: 8,
  largeWithoutHistory: 10,
  halfOfBalance: 15,
  deviceChange24h: 30,
  deviceChange72h: 20,
  lateNight: 5,
  onCall: 40,
  claimedAuthority: 35,
  feeToReceive: 35,
  otpShared: 35,
  safeAccountPattern: 20,
} as const;

const LARGE_AMOUNT = 50_000;

export type QuestionId = "on_call" | "claimed_authority" | "fee_to_receive" | "otp_shared";

export interface Question {
  id: QuestionId;
  en: string;
  ur: string;
}

export const QUESTIONS: Record<QuestionId, Question> = {
  on_call: {
    id: "on_call",
    en: "Is someone on a call or chat with you right now, telling you to make this payment?",
    ur: "کیا اس وقت کوئی کال یا چیٹ پر آپ کو یہ ادائیگی کرنے کا کہہ رہا ہے؟",
  },
  claimed_authority: {
    id: "claimed_authority",
    en: "Did the person say they are from a bank, the State Bank, BISP, the police or a government office?",
    ur: "کیا اس شخص نے بینک، اسٹیٹ بینک، بی آئی ایس پی، پولیس یا کسی سرکاری ادارے سے ہونے کا دعویٰ کیا؟",
  },
  fee_to_receive: {
    id: "fee_to_receive",
    en: "Are you paying a fee to receive a prize, loan, job or government payment?",
    ur: "کیا آپ کوئی انعام، قرض، نوکری یا سرکاری رقم وصول کرنے کے لیے فیس ادا کر رہے ہیں؟",
  },
  otp_shared: {
    id: "otp_shared",
    en: "Have you shared an OTP, PIN or password with anyone today?",
    ur: "کیا آپ نے آج کسی کو او ٹی پی، پن یا پاس ورڈ بتایا ہے؟",
  },
};

export type Answers = Partial<Record<QuestionId, boolean>>;

export interface RiskContext {
  now: number;
  customer: Customer;
  payee: Payee;
  amount: number;
  /** The customer's own transfers, any status. Only completed ones count as history. */
  history: Transfer[];
  /** Reports against the payee that are not yet confirmed or rejected. */
  openReports: number;
  hasTrustedContact: boolean;
}

export type HoldMode = "trusted_contact" | "cooling_off";

export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  holdMode: HoldMode | null;
  reasons: RiskReason[];
  /** Questions the customer must answer before the result is final. Empty once answered or not needed. */
  questions: Question[];
  final: boolean;
}

export const HEADLINES: Record<RiskLevel, { en: string; ur: string }> = {
  allow: { en: "No warning signs found.", ur: "کوئی خطرے کی علامت نہیں ملی۔" },
  pause: { en: "Please check before you send.", ur: "بھیجنے سے پہلے تسلی کر لیں۔" },
  hold: { en: "This transfer has been put on hold.", ur: "یہ ٹرانسفر روک لی گئی ہے۔" },
  stop: { en: "This transfer has been stopped.", ur: "یہ ٹرانسفر بند کر دی گئی ہے۔" },
};

function karachiHour(now: number): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", hour: "numeric", hourCycle: "h23" }).format(now),
  );
}

/** Reasons that come from account data alone, before any questions. */
export function signalReasons(ctx: RiskContext): RiskReason[] {
  const { now, customer, payee, amount } = ctx;
  const reasons: RiskReason[] = [];
  const add = (code: string, weight: number, en: string, ur: string) =>
    reasons.push({ code, weight, source: "signal", en, ur });

  if (payee.status === "confirmed_mule") {
    add(
      "payee_confirmed_mule", 100,
      "This account has been confirmed as used in scams. The payment has not been sent.",
      "اس اکاؤنٹ کے فراڈ میں استعمال ہونے کی تصدیق ہو چکی ہے۔ یہ رقم نہیں بھیجی گئی۔",
    );
    return reasons;
  }

  if (payee.status === "under_review") {
    add(
      "payee_under_review", WEIGHTS.payeeUnderReview,
      `This account has ${ctx.openReports} scam report${ctx.openReports === 1 ? "" : "s"} and is under review.`,
      `اس اکاؤنٹ کے خلاف فراڈ کی ${ctx.openReports} شکایات ہیں اور اس کی جانچ جاری ہے۔`,
    );
  } else if (ctx.openReports > 0) {
    add(
      "payee_reported", WEIGHTS.payeeReported,
      `This account has ${ctx.openReports} scam report${ctx.openReports === 1 ? "" : "s"} that have not been reviewed yet.`,
      `اس اکاؤنٹ کے خلاف فراڈ کی ${ctx.openReports} شکایات موصول ہوئی ہیں جن کی ابھی جانچ نہیں ہوئی۔`,
    );
  }

  const completed = ctx.history.filter((t) => t.status === "completed");
  if (!completed.some((t) => t.payeeId === payee.id)) {
    add(
      "first_time_payee", WEIGHTS.firstTimePayee,
      "You have never sent money to this account before.",
      "آپ نے اس اکاؤنٹ میں پہلے کبھی رقم نہیں بھیجی۔",
    );
  }

  const accountDays = Math.floor((now - new Date(payee.openedAt).getTime()) / DAY);
  if (accountDays < 30) {
    add(
      "new_account", WEIGHTS.accountUnder30Days,
      `This account was opened only ${accountDays} day${accountDays === 1 ? "" : "s"} ago.`,
      `یہ اکاؤنٹ صرف ${accountDays} دن پہلے کھولا گیا ہے۔`,
    );
  } else if (accountDays < 90) {
    add(
      "young_account", WEIGHTS.accountUnder90Days,
      "This account was opened less than three months ago.",
      "یہ اکاؤنٹ تین ماہ سے کم عرصہ پہلے کھولا گیا ہے۔",
    );
  }

  const windowStart = now - HISTORY_WINDOW_DAYS * DAY;
  const recent = completed.filter((t) => new Date(t.createdAt).getTime() >= windowStart);
  const largest = recent.reduce((max, t) => Math.max(max, t.amount), 0);
  if (recent.length === 0) {
    if (amount >= LARGE_AMOUNT) {
      add(
        "large_without_history", WEIGHTS.largeWithoutHistory,
        "This is a large amount and you have no recent transfer history.",
        "یہ بڑی رقم ہے اور آپ کی حالیہ ٹرانسفر کی کوئی ہسٹری نہیں ہے۔",
      );
    }
  } else if (amount > 2 * largest) {
    add(
      "amount_over_twice_max", WEIGHTS.amountOverTwiceMax,
      `This is more than twice your largest transfer in the last ${HISTORY_WINDOW_DAYS} days (${formatPKR(largest)}).`,
      `یہ رقم پچھلے ${HISTORY_WINDOW_DAYS} دنوں میں آپ کی سب سے بڑی ٹرانسفر (${formatPKR(largest)}) سے دو گنا سے زیادہ ہے۔`,
    );
  } else if (amount > largest) {
    add(
      "amount_over_max", WEIGHTS.amountOverMax,
      `This is larger than any transfer you have made in the last ${HISTORY_WINDOW_DAYS} days.`,
      `یہ رقم پچھلے ${HISTORY_WINDOW_DAYS} دنوں میں آپ کی کسی بھی ٹرانسفر سے زیادہ ہے۔`,
    );
  }

  if (customer.balance > 0 && amount >= customer.balance / 2) {
    add(
      "half_of_balance", WEIGHTS.halfOfBalance,
      "This would send half or more of your available balance.",
      "اس سے آپ کے موجودہ بیلنس کا آدھا یا اس سے زیادہ حصہ چلا جائے گا۔",
    );
  }

  if (customer.deviceChangedAt) {
    const hours = Math.floor((now - new Date(customer.deviceChangedAt).getTime()) / HOUR);
    if (hours < 72) {
      add(
        "recent_device_change", hours < 24 ? WEIGHTS.deviceChange24h : WEIGHTS.deviceChange72h,
        `Your phone or SIM was changed ${hours < 1 ? "less than an hour" : `${hours} hour${hours === 1 ? "" : "s"}`} ago. Scammers often take over accounts this way.`,
        `آپ کا فون یا سم ${hours < 1 ? "ایک گھنٹے سے کم" : `${hours} گھنٹے`} پہلے تبدیل ہوئی ہے۔ دھوکے باز اکثر اسی طریقے سے اکاؤنٹ پر قبضہ کرتے ہیں۔`,
      );
    }
  }

  if (karachiHour(now) < 5) {
    add(
      "late_night", WEIGHTS.lateNight,
      "Transfers late at night are more often linked to scams.",
      "رات گئے کی جانے والی ٹرانسفر کا تعلق اکثر فراڈ سے ہوتا ہے۔",
    );
  }

  return reasons;
}

/** Up to three questions, chosen for the situation. */
export function questionsFor(reasons: RiskReason[]): Question[] {
  const deviceChanged = reasons.some((r) => r.code === "recent_device_change");
  return deviceChanged
    ? [QUESTIONS.on_call, QUESTIONS.claimed_authority, QUESTIONS.otp_shared]
    : [QUESTIONS.on_call, QUESTIONS.claimed_authority, QUESTIONS.fee_to_receive];
}

export function answerReasons(answers: Answers): RiskReason[] {
  const reasons: RiskReason[] = [];
  const add = (code: string, weight: number, en: string, ur: string) =>
    reasons.push({ code, weight, source: "answer", en, ur });

  if (answers.on_call) {
    add(
      "on_call", WEIGHTS.onCall,
      "Someone is guiding you on a call or chat. Banks never ask you to move money this way.",
      "کوئی آپ کو کال یا چیٹ پر ہدایات دے رہا ہے۔ بینک کبھی اس طرح رقم منتقل کرنے کو نہیں کہتا۔",
    );
  }
  if (answers.claimed_authority) {
    add(
      "claimed_authority", WEIGHTS.claimedAuthority,
      "The person claimed to be from a bank, BISP, the police or a government office. Real officials never ask you to transfer money.",
      "اس شخص نے بینک، بی آئی ایس پی، پولیس یا کسی سرکاری ادارے سے ہونے کا دعویٰ کیا۔ اصل اہلکار کبھی رقم منتقل کرنے کو نہیں کہتے۔",
    );
  }
  if (answers.on_call && answers.claimed_authority) {
    add(
      "safe_account_pattern", WEIGHTS.safeAccountPattern,
      "This matches the common 'safe account' scam: a caller posing as an official asks you to move your money.",
      "یہ عام 'محفوظ اکاؤنٹ' فراڈ سے ملتا ہے: کوئی سرکاری اہلکار بن کر آپ سے رقم منتقل کرنے کو کہتا ہے۔",
    );
  }
  if (answers.fee_to_receive) {
    add(
      "fee_to_receive", WEIGHTS.feeToReceive,
      "You are paying a fee to receive money. Genuine prizes, loans and government payments do not require an upfront fee.",
      "آپ رقم وصول کرنے کے لیے فیس ادا کر رہے ہیں۔ اصلی انعام، قرض یا سرکاری ادائیگی کے لیے پیشگی فیس نہیں لی جاتی۔",
    );
  }
  if (answers.otp_shared) {
    add(
      "otp_shared", WEIGHTS.otpShared,
      "You shared an OTP, PIN or password today. Anyone who has it can control your account.",
      "آپ نے آج کسی کو او ٹی پی، پن یا پاس ورڈ بتایا ہے۔ جس کے پاس یہ ہو وہ آپ کے اکاؤنٹ پر قابو پا سکتا ہے۔",
    );
  }
  return reasons;
}

function levelFor(score: number, mode: ProtectionMode): RiskLevel {
  const t = THRESHOLDS[mode];
  if (score >= t.hold) return "hold";
  if (score >= t.pause) return "pause";
  return "allow";
}

/**
 * Assess a transfer. Call without `answers` first: if the result is not final,
 * show `questions` to the customer and call again with their answers.
 */
export function assessTransfer(ctx: RiskContext, answers?: Answers): RiskAssessment {
  const signals = signalReasons(ctx);

  if (signals.some((r) => r.code === "payee_confirmed_mule")) {
    return { score: 100, level: "stop", holdMode: null, reasons: signals, questions: [], final: true };
  }

  const baseScore = signals.reduce((sum, r) => sum + r.weight, 0);
  const needsQuestions = baseScore >= QUESTION_THRESHOLD;

  if (needsQuestions && !answers) {
    const level = levelFor(baseScore, ctx.customer.protectionMode);
    return {
      score: Math.min(100, baseScore),
      level,
      holdMode: null,
      reasons: signals,
      questions: questionsFor(signals),
      final: false,
    };
  }

  const reasons = needsQuestions && answers ? [...signals, ...answerReasons(answers)] : signals;
  const score = Math.min(100, reasons.reduce((sum, r) => sum + r.weight, 0));
  const level = levelFor(score, ctx.customer.protectionMode);
  const holdMode: HoldMode | null =
    level === "hold" ? (ctx.hasTrustedContact ? "trusted_contact" : "cooling_off") : null;

  // Strongest reasons first, so the customer reads the most important warning first.
  reasons.sort((a, b) => b.weight - a.weight);
  return { score, level, holdMode, reasons, questions: [], final: true };
}
