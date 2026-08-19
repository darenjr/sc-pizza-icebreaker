import { resetEverything } from "@/lib/game";
import { fail, handle, ok, readJson, str } from "@/lib/http";
import { isAdmin } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Wipes every player and slice. Used between a rehearsal and the real event. */
export async function POST(req: Request) {
  try {
    if (!(await isAdmin())) return fail("Locked.", 401);
    const body = await readJson(req);
    if (str(body.confirm, 16) !== "RESET") {
      return fail("Type RESET to confirm — this deletes every pizza.");
    }
    resetEverything();
    return ok({ ok: true });
  } catch (err) {
    return handle(err);
  }
}
