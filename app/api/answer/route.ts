import { getPizza, saveAnswer } from "@/lib/game";
import { fail, handle, ok, readJson, str } from "@/lib/http";
import { currentPlayer } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const player = await currentPlayer();
    if (!player) return fail("You're not in the game yet.", 401);

    const body = await readJson(req);
    const idx = Number(body.idx);
    const answer = str(body.answer, 280);

    saveAnswer(player, idx, answer);
    return ok(getPizza(player));
  } catch (err) {
    return handle(err);
  }
}
