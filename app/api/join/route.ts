import { createPlayer, countPlayers } from "@/lib/game";
import { getPhase } from "@/lib/db";
import { fail, handle, ok, readJson, str } from "@/lib/http";
import { currentPlayer, setPlayerCookie } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PLAYERS = 300;

export async function POST(req: Request) {
  try {
    const existing = await currentPlayer();
    if (existing) return ok({ player: existing, resumed: true });

    if (getPhase() === "closed") return fail("The game has closed. Find your host!", 403);
    if (countPlayers() >= MAX_PLAYERS) return fail("This event is full.", 403);

    const body = await readJson(req);
    const name = str(body.name, 40);

    if (name.length < 2) return fail("Please enter your name (at least 2 characters).");

    const { player, token } = createPlayer(name);
    await setPlayerCookie(token);
    return ok({ player, resumed: false });
  } catch (err) {
    return handle(err);
  }
}
