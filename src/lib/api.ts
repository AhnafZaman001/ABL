import "server-only";
import { AssessError } from "./assess";

/** Run a route body and turn expected errors into JSON responses. */
export async function handle(fn: () => unknown | Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await fn());
  } catch (err) {
    if (err instanceof AssessError) return Response.json({ error: err.message }, { status: err.status });
    if (err instanceof SyntaxError) return Response.json({ error: "Invalid JSON" }, { status: 400 });
    throw err;
  }
}
