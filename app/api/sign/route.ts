import { normaliseCode } from "@/lib/db";
import { getSignableView, signSlice } from "@/lib/game";
import { fail, handle, ok, readJson, str } from "@/lib/http";
import { currentPlayer } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const me = await currentPlayer();
    if (!me) return fail("You're not in the game yet.", 401);

    const body = await readJson(req);
    const code = normaliseCode(str(body.code, 8));
    const idx = Number(body.idx);

    const { target } = signSlice(me, code, idx);
    return ok({
      signed: true,
      targetName: target.name,
      myCode: me.code,
      view: getSignableView(me, target),
    });
  } catch (err) {
    return handle(err);
  }
}
