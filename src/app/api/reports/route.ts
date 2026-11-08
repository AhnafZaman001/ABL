import { handle } from "@/lib/api";
import { AssessError } from "@/lib/assess";
import { createReport } from "@/lib/reports";
import { isScamType } from "@/lib/scam-types";

export async function POST(request: Request) {
  return handle(async () => {
    const body = await request.json();
    if (!isScamType(body.scamType)) throw new AssessError("Choose what happened");
    return createReport({
      customerId: String(body.customerId ?? ""),
      transferId: String(body.transferId ?? ""),
      scamType: body.scamType,
      callerNumber: body.callerNumber ? String(body.callerNumber) : undefined,
      description: body.description ? String(body.description) : undefined,
    });
  });
}
