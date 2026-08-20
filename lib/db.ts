import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * Uses Node's built-in SQLite (Node >= 24) so the app has no database service
 * and no native module to compile. The whole event lives in one file on disk.
 */

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "pizza.db");

function init(): DatabaseSync {
  mkdirSync(DATA_DIR, { recursive: true });
  // WAL lets the pollers read while a signature is being written; the busy
  // timeout absorbs the brief contention when a whole room signs at once.
  const db = new DatabaseSync(DB_FILE, { timeout: 5000 });
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id          TEXT PRIMARY KEY,
      code        TEXT NOT NULL UNIQUE,
      token       TEXT NOT NULL UNIQUE,
      name        TEXT NOT NULL,
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS slices (
      id           TEXT PRIMARY KEY,
      player_id    TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      idx          INTEGER NOT NULL,
      answer       TEXT NOT NULL DEFAULT '',
      signer_id    TEXT REFERENCES players(id) ON DELETE SET NULL,
      signer_name  TEXT,
      signed_at    INTEGER,
      UNIQUE (player_id, idx)
    );

    -- One person may sign at most one slice per pizza, so a full pizza always
    -- carries eight *different* names on the crust.
    CREATE UNIQUE INDEX IF NOT EXISTS ux_slices_one_sign_per_pair
      ON slices (player_id, signer_id) WHERE signer_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS ix_slices_player ON slices (player_id);
    CREATE INDEX IF NOT EXISTS ix_slices_signer ON slices (signer_id);

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  return db;
}

// Next.js hot-reloads modules in dev; keep one handle per process.
const globalForDb = globalThis as unknown as { __pizzaDb?: DatabaseSync };

function getDb(): DatabaseSync {
  if (!globalForDb.__pizzaDb) globalForDb.__pizzaDb = init();
  return globalForDb.__pizzaDb;
}

/**
 * Opened lazily on first query rather than at import time. `next build` imports
 * every route module across parallel workers to collect page data, and eagerly
 * opening the file there makes those workers race for the same lock.
 */
export const db: DatabaseSync = new Proxy({} as DatabaseSync, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export type Phase = "build" | "trade" | "closed";

const DEFAULT_SETTINGS: Record<string, string> = {
  phase: "build",
  event_name: "Know Your Slice",
  event_subtitle: "Lunch icebreaker",
};

export function getSetting(key: string): string {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? DEFAULT_SETTINGS[key] ?? "";
}

export function setSetting(key: string, value: string): void {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, value);
}

export function getPhase(): Phase {
  const p = getSetting("phase");
  return p === "trade" || p === "closed" ? p : "build";
}

/* ------------------------------------------------------------------ */
/* Ids and join codes                                                  */
/* ------------------------------------------------------------------ */

/** No B/8, I/1, O/0, S/5, G/6, Z/2 — these get misread when shouted across a room. */
const CODE_ALPHABET = "ACDEFHJKLMNPQRTUVWXY34679";

export function newId(): string {
  return crypto.randomUUID();
}

export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function newCode(): string {
  for (let attempt = 0; attempt < 200; attempt++) {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    const code = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
    const taken = db.prepare("SELECT 1 FROM players WHERE code = ?").get(code);
    if (!taken) return code;
  }
  throw new Error("Could not allocate a free join code");
}

/**
 * Players type codes with stray spaces and the one lookalike the alphabet still
 * allows: 6 is a valid character, G is not, and handwriting blurs the two.
 */
export function normaliseCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/G/g, "6")
    .slice(0, 4);
}
