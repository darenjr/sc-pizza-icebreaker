import QRCode from "qrcode";
import { getPhase } from "@/lib/db";
import { getPizza } from "@/lib/game";
import { handle, ok, originOf } from "@/lib/http";
import { currentPlayer } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const player = await currentPlayer();
    if (!player) return ok({ player: null });

    const pizza = getPizza(player);
    const signUrl = `${originOf(req)}/sign?code=${player.code}`;
    const qr = await QRCode.toDataURL(signUrl, {
      margin: 1,
      width: 320,
      color: { dark: "#2B1B12", light: "#FFFFFF" },
    });

    return ok({ ...pizza, phase: getPhase(), signUrl, qr });
  } catch (err) {
    return handle(err);
  }
}
