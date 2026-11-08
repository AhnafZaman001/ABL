import { handle } from "@/lib/api";
import { respondToInvite } from "@/lib/contacts";

export async function POST(request: Request, ctx: RouteContext<"/api/contacts/[id]/respond">) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = await request.json();
    return { contact: respondToInvite(id, body.accept === true) };
  });
}
