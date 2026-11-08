import { handle } from "@/lib/api";
import { AssessError } from "@/lib/assess";
import { setProtectionMode } from "@/lib/contacts";

export async function POST(request: Request, ctx: RouteContext<"/api/customers/[id]/protection">) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = await request.json();
    if (body.mode !== "standard" && body.mode !== "guarded") throw new AssessError("Unknown protection mode");
    setProtectionMode(id, body.mode);
    return { mode: body.mode };
  });
}
