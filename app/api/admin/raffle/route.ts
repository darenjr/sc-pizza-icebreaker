import { drawRaffle } from "@/lib/game";
import { fail, handle, ok, readJson } from "@/lib/http";
import { isAdmin } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    if (!(await isAdmin())) return fail("Locked.", 401);
    const body = await readJson(req);
    const winner = drawRaffle(body.strict !== false);
    if (!winner) return fail("No completed pizzas in the pool yet.");
    return ok({ winner });
  } catch (err) {
    return handle(err);
  }
}
