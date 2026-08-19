import { setSetting } from "@/lib/db";
import { adminStats } from "@/lib/game";
import { fail, handle, ok, readJson, str } from "@/lib/http";
import { isAdmin } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PHASES = new Set(["build", "trade", "closed"]);

export async function POST(req: Request) {
  try {
    if (!(await isAdmin())) return fail("Locked.", 401);
    const body = await readJson(req);

    const phase = str(body.phase, 16);
    if (phase) {
      if (!PHASES.has(phase)) return fail("Unknown phase.");
      setSetting("phase", phase);
    }

    const eventName = str(body.eventName, 60);
    if (eventName) setSetting("event_name", eventName);

    if (body.minOtherTables !== undefined) {
      const n = Number(body.minOtherTables);
      if (!Number.isInteger(n) || n < 0 || n > 5) return fail("Out-of-table rule must be 0–5.");
      setSetting("min_other_tables", String(n));
    }

    return ok(adminStats());
  } catch (err) {
    return handle(err);
  }
}
