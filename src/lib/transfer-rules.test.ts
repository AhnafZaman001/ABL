import { describe, expect, it } from "vitest";
import type { RiskAssessment } from "./risk";
import { decideTransfer } from "./transfer-rules";

const assessment = (overrides: Partial<RiskAssessment>): RiskAssessment => ({
  score: 0,
  level: "allow",
  holdMode: null,
  reasons: [],
  questions: [],
  final: true,
  ...overrides,
});

describe("decideTransfer", () => {
  it("refuses to decide before the questions are answered", () => {
    expect(decideTransfer(assessment({ final: false }), "send")).toEqual({
      ok: false,
      error: "Answer the safety questions first",
    });
  });

  it("completes an allowed transfer", () => {
    expect(decideTransfer(assessment({}), "send")).toEqual({ ok: true, status: "completed" });
  });

  it("requires the customer to confirm a pause warning", () => {
    const pause = assessment({ level: "pause", score: 35 });
    expect(decideTransfer(pause, "send").ok).toBe(false);
    expect(decideTransfer(pause, "send_after_warning")).toEqual({ ok: true, status: "completed" });
  });

  it("routes holds to the trusted contact or a cooling-off period", () => {
    expect(decideTransfer(assessment({ level: "hold", holdMode: "trusted_contact" }), "send")).toEqual({
      ok: true,
      status: "pending_approval",
    });
    expect(decideTransfer(assessment({ level: "hold", holdMode: "cooling_off" }), "send")).toEqual({
      ok: true,
      status: "cooling_off",
    });
  });

  it("never sends to a confirmed mule, even after a warning", () => {
    expect(decideTransfer(assessment({ level: "stop", score: 100 }), "send_after_warning")).toEqual({
      ok: true,
      status: "stopped",
    });
  });

  it("records a cancellation at any level", () => {
    for (const level of ["allow", "pause", "hold", "stop"] as const) {
      expect(decideTransfer(assessment({ level }), "cancel")).toEqual({ ok: true, status: "cancelled" });
    }
  });
});
