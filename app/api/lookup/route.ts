import { normaliseCode, getPhase } from "@/lib/db";
import { getPlayerByCode, getSignableView } from "@/lib/game";
import { fail, handle, ok } from "@/lib/http";
import { currentPlayer } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const me = await currentPlayer();
    if (!me) return fail("You're not in the game yet.", 401);

    const code = normaliseCode(new URL(req.url).searchParams.get("code") ?? "");
    if (code.length !== 4) return fail("A join code is 4 characters.");

    const target = getPlayerByCode(code);
    if (!target) return fail("No one has that code. Check the four characters again.", 404);
    if (target.id === me.id) return fail("That's your own code — show it to someone else!");

    return ok({ ...getSignableView(me, target), phase: getPhase() });
  } catch (err) {
    return handle(err);
  }
}
