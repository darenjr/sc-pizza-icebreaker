import { exportCsv } from "@/lib/game";
import { fail, handle } from "@/lib/http";
import { isAdmin } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!(await isAdmin())) return fail("Locked.", 401);
    return new Response(exportCsv(), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="pizza-${new Date().toISOString().slice(0, 10)}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return handle(err);
  }
}
