"use client";

/** Every API call returns JSON; errors arrive as { error: string }. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}

export function post<T>(path: string, data: unknown): Promise<T> {
  return api<T>(path, { method: "POST", body: JSON.stringify(data) });
}

export function buzz(pattern: number | number[] = 12): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}
