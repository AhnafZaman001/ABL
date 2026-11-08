import { handle } from "@/lib/api";
import { AssessError } from "@/lib/assess";
import { actOnReport, type DeskAction } from "@/lib/reports";

const ACTIONS: DeskAction[] = ["investigate", "confirm", "reject"];

export async function POST(request: Request, ctx: RouteContext<"/api/reports/[id]/action">) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = await request.json();
    if (!ACTIONS.includes(body.action)) throw new AssessError("Unknown action");
    return actOnReport(id, body.action, body.note ? String(body.note) : undefined);
  });
}
