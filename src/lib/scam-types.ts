import type { ScamType } from "./types";

export const SCAM_TYPES: Record<ScamType, { en: string; ur: string; short: string }> = {
  fake_bank_call: {
    short: "Fake bank call",
    en: "Caller said they were from my bank",
    ur: "کال کرنے والے نے خود کو بینک کا نمائندہ بتایا",
  },
  prize_or_bisp: {
    short: "Prize / BISP message",
    en: "Prize, lottery or BISP message",
    ur: "انعام، لاٹری یا بی آئی ایس پی کا پیغام",
  },
  otp_theft: {
    short: "OTP theft",
    en: "Someone got my OTP or PIN",
    ur: "کسی نے میرا او ٹی پی یا پن حاصل کر لیا",
  },
  impersonation: {
    short: "Impersonation",
    en: "Someone pretended to be family or a friend",
    ur: "کسی نے رشتہ دار یا دوست بن کر رابطہ کیا",
  },
  fake_seller: {
    short: "Fake seller or job",
    en: "Online seller or job offer",
    ur: "آن لائن خریداری یا نوکری کی پیشکش",
  },
  other: { short: "Other", en: "Something else", ur: "کچھ اور" },
};

export const isScamType = (value: unknown): value is ScamType =>
  typeof value === "string" && value in SCAM_TYPES;
