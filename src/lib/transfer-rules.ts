import type { RiskAssessment } from "./risk";
import type { TransferStatus } from "./types";

/**
 * What the customer chose on the result screen.
 * - send: confirm a transfer that showed no warning
 * - send_after_warning: continue after reading a pause warning
 * - cancel: decide not to send (recorded so heeded warnings can be measured)
 */
export type Intent = "send" | "send_after_warning" | "cancel";

export type Decision = { ok: true; status: TransferStatus } | { ok: false; error: string };

/** Map a final risk assessment and the customer's choice to the transfer's status. */
export function decideTransfer(assessment: RiskAssessment, intent: Intent): Decision {
  if (!assessment.final) return { ok: false, error: "Answer the safety questions first" };
  if (intent === "cancel") return { ok: true, status: "cancelled" };

  switch (assessment.level) {
    case "stop":
      return { ok: true, status: "stopped" };
    case "hold":
      return { ok: true, status: assessment.holdMode === "trusted_contact" ? "pending_approval" : "cooling_off" };
    case "pause":
      return intent === "send_after_warning"
        ? { ok: true, status: "completed" }
        : { ok: false, error: "Read and confirm the warning before sending" };
    case "allow":
      return { ok: true, status: "completed" };
  }
}
