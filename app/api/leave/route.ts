import { handle, ok } from "@/lib/http";
import { clearPlayerCookie } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Signs this device out without deleting the pizza — handy for shared phones and testing. */
export async function POST() {
  try {
    await clearPlayerCookie();
    return ok({ ok: true });
  } catch (err) {
    return handle(err);
  }
}
