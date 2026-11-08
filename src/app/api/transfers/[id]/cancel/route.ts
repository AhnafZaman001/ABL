import { handle } from "@/lib/api";
import { cancelHeldTransfer } from "@/lib/transfers";

export async function POST(request: Request, ctx: RouteContext<"/api/transfers/[id]/cancel">) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = await request.json();
    return cancelHeldTransfer(id, String(body.customerId ?? ""));
  });
}
