import { handle } from "@/lib/api";
import { AssessError } from "@/lib/assess";
import { db, toTransfer } from "@/lib/db";
import { releaseHeldTransfer } from "@/lib/transfers";

/** Demo control: end a cooling-off period now instead of waiting four hours. */
export async function POST(_request: Request, ctx: RouteContext<"/api/transfers/[id]/skip-cooling-off">) {
  return handle(async () => {
    const { id } = await ctx.params;
    const row = db().prepare("SELECT * FROM transfers WHERE id = ?").get(id);
    if (!row || toTransfer(row).status !== "cooling_off") throw new AssessError("Transfer is not cooling off", 409);
    return releaseHeldTransfer(id, "demo", "Cooling-off skipped (demo control)");
  });
}
