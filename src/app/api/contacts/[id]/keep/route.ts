import { handle } from "@/lib/api";
import { cancelRemoval } from "@/lib/contacts";

/** The contact cancels a removal they did not expect. */
export async function POST(_request: Request, ctx: RouteContext<"/api/contacts/[id]/keep">) {
  return handle(async () => {
    const { id } = await ctx.params;
    return cancelRemoval(id);
  });
}
