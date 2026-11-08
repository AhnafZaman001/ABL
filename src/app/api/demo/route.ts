import { connection } from "next/server";
import { getSnapshot } from "@/lib/queries";

export async function GET() {
  await connection();
  return Response.json(getSnapshot());
}
