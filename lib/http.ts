import { NextResponse } from "next/server";
import { GameError } from "./game";

export function ok<T>(data: T) {
  return NextResponse.json(data, {
    headers: { "cache-control": "no-store" },
  });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

/** Turns expected rule violations into a friendly 400 and anything else into a 500. */
export function handle(err: unknown) {
  if (err instanceof GameError) return fail(err.message, 400);
  console.error("[pizza]", err);
  return fail("Something broke on our side. Try again.", 500);
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function str(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function originOf(req: Request): string {
  const h = req.headers;
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}
