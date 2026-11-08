import { handle } from "@/lib/api";
import { AssessError, parseAnswers } from "@/lib/assess";
import type { Intent } from "@/lib/transfer-rules";
import { createTransfer } from "@/lib/transfers";

const INTENTS: Intent[] = ["send", "send_after_warning", "cancel"];

export async function POST(request: Request) {
  return handle(async () => {
    const body = await request.json();
    if (!INTENTS.includes(body.intent)) throw new AssessError("Unknown intent");
    return createTransfer({
      customerId: String(body.customerId ?? ""),
      payeeId: body.payeeId ? String(body.payeeId) : undefined,
      accountNumber: body.accountNumber ? String(body.accountNumber) : undefined,
      amount: Number(body.amount),
      purpose: String(body.purpose ?? ""),
      answers: parseAnswers(body.answers),
      intent: body.intent,
    });
  });
}
