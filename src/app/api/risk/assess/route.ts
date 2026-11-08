import { handle } from "@/lib/api";
import { assessFromDb, parseAnswers } from "@/lib/assess";

/** Preview the risk assessment for a transfer. Nothing is written. */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await request.json();
    return assessFromDb({
      customerId: String(body.customerId ?? ""),
      payeeId: body.payeeId ? String(body.payeeId) : undefined,
      accountNumber: body.accountNumber ? String(body.accountNumber) : undefined,
      amount: Number(body.amount),
      answers: parseAnswers(body.answers),
    });
  });
}
