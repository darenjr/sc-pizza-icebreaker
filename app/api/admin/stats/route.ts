import { adminStats } from "@/lib/game";
import { fail, handle, ok } from "@/lib/http";
import { isAdmin } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!(await isAdmin())) return fail("Locked.", 401);
    return ok(adminStats());
  } catch (err) {
    return handle(err);
  }
}
