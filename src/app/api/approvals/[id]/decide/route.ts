import { handle } from "@/lib/api";
import { AssessError } from "@/lib/assess";
import { decideApproval } from "@/lib/contacts";

export async function POST(request: Request, ctx: RouteContext<"/api/approvals/[id]/decide">) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = await request.json();
    if (body.decision !== "approve" && body.decision !== "decline") throw new AssessError("Unknown decision");
    return decideApproval(id, String(body.contactId ?? ""), {
      decision: body.decision,
      spokeToCustomer: body.spokeToCustomer === true,
      note: body.note ? String(body.note) : undefined,
    });
  });
}
