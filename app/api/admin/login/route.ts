import { fail, handle, ok, readJson, str } from "@/lib/http";
import { adminPasscode, setAdminCookie } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    if (str(body.passcode, 64) !== adminPasscode()) {
      return fail("Wrong passcode.", 401);
    }
    await setAdminCookie();
    return ok({ ok: true });
  } catch (err) {
    return handle(err);
  }
}
