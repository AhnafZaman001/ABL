import { describe, expect, it } from "vitest";
import { assessTransfer, type RiskContext } from "./risk";
import { buildSeed } from "./seed";
import { SCENARIOS } from "./scenarios";

// 12:00 in Karachi (UTC+5), so the late-night rule stays out of the way unless a test wants it.
const NOON_PKT = Date.UTC(2026, 10, 9, 7, 0, 0);

function contextFor(customerId: string, payeeId: string, amount: number, now = NOON_PKT): RiskContext {
  const seed = buildSeed(now);
  const customer = seed.customers.find((c) => c.id === customerId)!;
  const payee = seed.payees.find((p) => p.id === payeeId)!;
  return {
    now,
    customer,
    payee,
    amount,
    history: seed.transfers.filter((t) => t.customerId === customerId),
    openReports: seed.reports.filter(
      (r) => r.payeeId === payeeId && (r.status === "new" || r.status === "investigating"),
    ).length,
    hasTrustedContact: seed.contacts.some((tc) => tc.customerId === customerId),
  };
}

const codes = (reasons: { code: string }[]) => reasons.map((r) => r.code);
const NO = { on_call: false, claimed_authority: false, fee_to_receive: false, otp_shared: false };

describe("demo scenarios", () => {
  it.each(SCENARIOS)("$title ends in $expected when the customer answers no", (s) => {
    const result = assessTransfer(contextFor(s.customerId, s.payeeId, s.amount), NO);
    expect(result.level).toBe(s.expected);
    expect(result.final).toBe(true);
  });
});

describe("fake bank-security call", () => {
  const ctx = contextFor("c_nasreen", "p_asif", 185_000);

  it("asks questions before deciding", () => {
    const first = assessTransfer(ctx);
    expect(first.final).toBe(false);
    expect(first.questions.map((q) => q.id)).toEqual(["on_call", "claimed_authority", "fee_to_receive"]);
    expect(codes(first.reasons)).toEqual(
      expect.arrayContaining(["payee_under_review", "first_time_payee", "new_account", "amount_over_twice_max"]),
    );
  });

  it("holds for the trusted contact and names the safe-account pattern", () => {
    const result = assessTransfer(ctx, { on_call: true, claimed_authority: true, fee_to_receive: false });
    expect(result.level).toBe("hold");
    expect(result.holdMode).toBe("trusted_contact");
    expect(result.score).toBe(100);
    expect(codes(result.reasons)).toContain("safe_account_pattern");
    expect(result.reasons[0].code).toBe("on_call");
  });

  it("reports the number of open reports", () => {
    const reason = assessTransfer(ctx).reasons.find((r) => r.code === "payee_under_review")!;
    expect(reason.en).toContain("2 scam reports");
  });
});

describe("routine supplier payment", () => {
  it("is allowed without questions", () => {
    const result = assessTransfer(contextFor("c_usman", "p_alnoor", 78_000));
    expect(result).toMatchObject({ level: "allow", final: true, score: 0, questions: [] });
  });

  it("flags an amount above the usual range", () => {
    const result = assessTransfer(contextFor("c_usman", "p_alnoor", 100_000));
    expect(codes(result.reasons)).toEqual(["amount_over_max"]);
    expect(result.level).toBe("allow");
  });
});

describe("transfer after a SIM change", () => {
  const ctx = contextFor("c_kamran", "p_shahid", 250_000);

  it("asks about OTP sharing instead of fees", () => {
    expect(assessTransfer(ctx).questions.map((q) => q.id)).toContain("otp_shared");
  });

  it("uses a cooling-off hold when there is no trusted contact", () => {
    const result = assessTransfer(ctx, NO);
    expect(result.level).toBe("hold");
    expect(result.holdMode).toBe("cooling_off");
    expect(codes(result.reasons)).toContain("recent_device_change");
  });

  it("stops weighting the device change after 72 hours", () => {
    const later = contextFor("c_kamran", "p_shahid", 250_000);
    later.customer = { ...later.customer, deviceChangedAt: new Date(NOON_PKT - 80 * 3_600_000).toISOString() };
    expect(codes(assessTransfer(later, NO).reasons)).not.toContain("recent_device_change");
  });
});

describe("first payment to an online seller", () => {
  const ctx = contextFor("c_hira", "p_faraz", 14_500);

  it("pauses with an explanation", () => {
    const result = assessTransfer(ctx, NO);
    expect(result.level).toBe("pause");
    expect(codes(result.reasons)).toEqual(["amount_over_twice_max", "first_time_payee"]);
  });

  it("escalates to a hold when the customer is paying a fee to receive money", () => {
    const result = assessTransfer(ctx, { ...NO, fee_to_receive: true });
    expect(result.level).toBe("hold");
    expect(result.holdMode).toBe("cooling_off");
  });

  it("reacts earlier in guarded mode", () => {
    const guarded = { ...ctx, customer: { ...ctx.customer, protectionMode: "guarded" as const } };
    // 35 points: pause in standard mode, but still below guarded hold (40).
    expect(assessTransfer(guarded, NO).level).toBe("pause");
    const withFee = assessTransfer(guarded, { ...NO, on_call: true });
    expect(withFee.level).toBe("hold");
  });
});

describe("confirmed mule account", () => {
  it("stops the transfer without asking questions", () => {
    const result = assessTransfer(contextFor("c_hira", "p_zubair", 6_000));
    expect(result).toMatchObject({ level: "stop", final: true, questions: [], score: 100 });
    expect(codes(result.reasons)).toEqual(["payee_confirmed_mule"]);
  });
});

describe("general rules", () => {
  it("adds the late-night signal between midnight and 5 am Karachi time", () => {
    const threeAm = Date.UTC(2026, 10, 8, 22, 0, 0); // 03:00 PKT
    const result = assessTransfer(contextFor("c_usman", "p_alnoor", 50_000, threeAm));
    expect(codes(result.reasons)).toContain("late_night");
  });

  it("flags sending half the balance", () => {
    const result = assessTransfer(contextFor("c_hira", "p_sana", 30_000), NO);
    expect(codes(result.reasons)).toContain("half_of_balance");
  });

  it("gives every reason an English and an Urdu explanation", () => {
    const all = [
      assessTransfer(contextFor("c_nasreen", "p_asif", 185_000), { on_call: true, claimed_authority: true, fee_to_receive: true }),
      assessTransfer(contextFor("c_kamran", "p_shahid", 250_000), { on_call: true, claimed_authority: true, otp_shared: true }),
      assessTransfer(contextFor("c_hira", "p_zubair", 6_000)),
    ].flatMap((r) => r.reasons);
    for (const reason of all) {
      expect(reason.en.length).toBeGreaterThan(10);
      expect(reason.ur).toMatch(/[؀-ۿ]/);
    }
  });

  it("caps the score at 100", () => {
    const result = assessTransfer(contextFor("c_nasreen", "p_asif", 400_000), {
      on_call: true,
      claimed_authority: true,
      fee_to_receive: true,
    });
    expect(result.score).toBe(100);
  });
});
