import { cookies } from "next/headers";
import { getPlayerByToken, type Player } from "./game";

export const PLAYER_COOKIE = "pizza_player";
export const ADMIN_COOKIE = "pizza_admin";

const YEAR = 60 * 60 * 24 * 365;

export async function setPlayerCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(PLAYER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: YEAR,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function currentPlayer(): Promise<Player | null> {
  const token = (await cookies()).get(PLAYER_COOKIE)?.value;
  if (!token) return null;
  return getPlayerByToken(token);
}

export async function clearPlayerCookie(): Promise<void> {
  (await cookies()).delete(PLAYER_COOKIE);
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export function adminPasscode(): string {
  return process.env.ADMIN_PASSCODE || "pizza2026";
}

export async function setAdminCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, adminPasscode(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function isAdmin(): Promise<boolean> {
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  return typeof value === "string" && value.length > 0 && value === adminPasscode();
}
