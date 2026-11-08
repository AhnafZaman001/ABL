import { handle } from "@/lib/api";
import { requestRemoval } from "@/lib/contacts";

export async function POST(request: Request, ctx: RouteContext<"/api/contacts/[id]/remove">) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = await request.json();
    return { contact: requestRemoval(String(body.customerId ?? ""), id) };
  });
}
