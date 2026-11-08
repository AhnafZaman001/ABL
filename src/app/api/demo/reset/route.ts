import { resetDemo } from "@/lib/db";
import { getSnapshot } from "@/lib/queries";

export async function POST() {
  resetDemo();
  return Response.json(getSnapshot());
}
