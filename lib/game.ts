import { db, getPhase, getSetting, newCode, newId, newToken } from "./db";
import { SLICE_COUNT, SLICE_PROMPTS } from "./prompts";

export type Player = {
  id: string;
  code: string;
  name: string;
  createdAt: number;
};

export type SliceView = {
  idx: number;
  emoji: string;
  title: string;
  prompt: string;
  hint: string;
  quickPicks: string[];
  answer: string;
  signerName: string | null;
  signedAt: number | null;
};

export type PizzaView = {
  player: Player;
  slices: SliceView[];
  signedCount: number;
  answeredCount: number;
  complete: boolean;
  /** How many slices this player has signed on other people's pizzas. */
  givenCount: number;
};

type PlayerRow = {
  id: string;
  code: string;
  token: string;
  name: string;
  created_at: number;
};

type SliceRow = {
  idx: number;
  answer: string;
  signer_id: string | null;
  signer_name: string | null;
  signed_at: number | null;
};

function toPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    createdAt: row.created_at,
  };
}

/* ------------------------------------------------------------------ */
/* Players                                                             */
/* ------------------------------------------------------------------ */

export function createPlayer(name: string): { player: Player; token: string } {
  const id = newId();
  const token = newToken();
  const code = newCode();
  const now = Date.now();

  db.prepare(
    "INSERT INTO players (id, code, token, name, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(id, code, token, name, now);

  const insertSlice = db.prepare("INSERT INTO slices (id, player_id, idx) VALUES (?, ?, ?)");
  for (let i = 0; i < SLICE_COUNT; i++) insertSlice.run(newId(), id, i);

  return { player: { id, code, name, createdAt: now }, token };
}

export function getPlayerByToken(token: string): Player | null {
  const row = db.prepare("SELECT * FROM players WHERE token = ?").get(token) as
    | PlayerRow
    | undefined;
  return row ? toPlayer(row) : null;
}

export function getPlayerByCode(code: string): Player | null {
  const row = db.prepare("SELECT * FROM players WHERE code = ?").get(code) as
    | PlayerRow
    | undefined;
  return row ? toPlayer(row) : null;
}

export function countPlayers(): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM players").get() as { n: number };
  return row.n;
}

/* ------------------------------------------------------------------ */
/* Pizzas                                                              */
/* ------------------------------------------------------------------ */

export function getPizza(player: Player): PizzaView {
  const rows = db
    .prepare(
      "SELECT idx, answer, signer_id, signer_name, signed_at FROM slices WHERE player_id = ? ORDER BY idx",
    )
    .all(player.id) as unknown as SliceRow[];

  const byIdx = new Map(rows.map((r) => [r.idx, r]));
  const slices: SliceView[] = SLICE_PROMPTS.map((p) => {
    const row = byIdx.get(p.idx);
    return {
      idx: p.idx,
      emoji: p.emoji,
      title: p.title,
      prompt: p.prompt,
      hint: p.hint,
      quickPicks: p.quickPicks ?? [],
      answer: row?.answer ?? "",
      signerName: row?.signer_name ?? null,
      signedAt: row?.signed_at ?? null,
    };
  });

  const signedCount = slices.filter((s) => s.signerName).length;
  const answeredCount = slices.filter((s) => s.answer.trim().length > 0).length;

  const given = db
    .prepare("SELECT COUNT(*) AS n FROM slices WHERE signer_id = ?")
    .get(player.id) as { n: number };

  return {
    player,
    slices,
    signedCount,
    answeredCount,
    complete: signedCount >= SLICE_COUNT,
    givenCount: given.n,
  };
}

export function saveAnswer(player: Player, idx: number, answer: string): void {
  if (!Number.isInteger(idx) || idx < 0 || idx >= SLICE_COUNT) {
    throw new GameError("That slice doesn't exist.");
  }
  if (getPhase() === "closed") {
    throw new GameError("The game is closed — answers are locked.");
  }
  const row = db
    .prepare("SELECT signer_id FROM slices WHERE player_id = ? AND idx = ?")
    .get(player.id, idx) as { signer_id: string | null } | undefined;
  if (!row) throw new GameError("That slice doesn't exist.");
  if (row.signer_id) {
    throw new GameError("This slice is already signed — you can't change the answer now.");
  }
  db.prepare("UPDATE slices SET answer = ? WHERE player_id = ? AND idx = ?").run(
    answer.slice(0, 280),
    player.id,
    idx,
  );
}

/* ------------------------------------------------------------------ */
/* Signing                                                             */
/* ------------------------------------------------------------------ */

export class GameError extends Error {}

export function signSlice(
  signer: Player,
  targetCode: string,
  idx: number,
): { target: Player; slice: SliceView } {
  if (getPhase() !== "trade") {
    throw new GameError(
      getPhase() === "build"
        ? "Trading hasn't started yet — your host will open it."
        : "The game is closed. No more signatures.",
    );
  }

  const target = getPlayerByCode(targetCode);
  if (!target) throw new GameError("No one has that code. Check the four characters again.");
  if (target.id === signer.id) throw new GameError("You can't sign your own pizza.");
  if (!Number.isInteger(idx) || idx < 0 || idx >= SLICE_COUNT) {
    throw new GameError("That slice doesn't exist.");
  }

  const slice = db
    .prepare("SELECT idx, answer, signer_id, signer_name FROM slices WHERE player_id = ? AND idx = ?")
    .get(target.id, idx) as
    | { idx: number; answer: string; signer_id: string | null; signer_name: string | null }
    | undefined;
  if (!slice) throw new GameError("That slice doesn't exist.");
  // Checked before the per-slice state so someone who has already signed this
  // pizza is told that, rather than "pick another slice" — there isn't one.
  const already = db
    .prepare("SELECT idx FROM slices WHERE player_id = ? AND signer_id = ?")
    .get(target.id, signer.id) as { idx: number } | undefined;
  if (already) {
    const p = SLICE_PROMPTS[already.idx];
    throw new GameError(
      `You already signed ${target.name}'s "${p.title}" slice. Each pizza needs ${SLICE_COUNT} different people — go find someone new!`,
    );
  }

  if (!slice.answer.trim()) {
    throw new GameError(`${target.name} hasn't filled in this slice yet — ask them to write it first.`);
  }
  if (slice.signer_id) {
    throw new GameError(`Already signed by ${slice.signer_name}. Pick another slice.`);
  }

  const now = Date.now();
  let result;
  try {
    result = db
      .prepare(
        `UPDATE slices SET signer_id = ?, signer_name = ?, signed_at = ?
         WHERE player_id = ? AND idx = ? AND signer_id IS NULL`,
      )
      .run(signer.id, signer.name, now, target.id, idx);
  } catch {
    // The partial unique index caught a double-tap racing the check above.
    throw new GameError(`You already signed one of ${target.name}'s slices.`);
  }
  if (result.changes === 0) {
    throw new GameError("Someone just signed that slice. Pick another one.");
  }

  const p = SLICE_PROMPTS[idx];
  return {
    target,
    slice: {
      idx,
      emoji: p.emoji,
      title: p.title,
      prompt: p.prompt,
      hint: p.hint,
      quickPicks: p.quickPicks ?? [],
      answer: slice.answer,
      signerName: signer.name,
      signedAt: now,
    },
  };
}

/** What a signer sees when they look up someone else's pizza. */
export function getSignableView(signer: Player, target: Player) {
  const rows = db
    .prepare(
      "SELECT idx, answer, signer_id, signer_name FROM slices WHERE player_id = ? ORDER BY idx",
    )
    .all(target.id) as unknown as {
    idx: number;
    answer: string;
    signer_id: string | null;
    signer_name: string | null;
  }[];

  const mine = rows.find((r) => r.signer_id === signer.id) ?? null;

  return {
    target: { name: target.name, code: target.code },
    alreadySignedIdx: mine ? mine.idx : null,
    slices: rows.map((r) => {
      const p = SLICE_PROMPTS[r.idx];
      return {
        idx: r.idx,
        emoji: p.emoji,
        title: p.title,
        prompt: p.prompt,
        answer: r.answer,
        signerName: r.signer_name,
        signable: !r.signer_id && r.answer.trim().length > 0 && !mine,
      };
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Admin views                                                         */
/* ------------------------------------------------------------------ */

export type AdminStats = {
  phase: string;
  eventName: string;
  sliceCount: number;
  players: number;
  answeredSlices: number;
  totalSlices: number;
  signatures: number;
  completed: number;
  noSignaturesYet: number;
  board: {
    id: string;
    name: string;
    code: string;
    answered: number;
    signed: number;
    given: number;
    complete: boolean;
  }[];
  feed: { at: number; signer: string; target: string; title: string }[];
};

export function adminStats(): AdminStats {
  const players = db
    .prepare("SELECT * FROM players ORDER BY created_at")
    .all() as unknown as PlayerRow[];

  const board = players.map((p) => {
    const rows = db
      .prepare("SELECT answer, signer_id FROM slices WHERE player_id = ?")
      .all(p.id) as unknown as { answer: string; signer_id: string | null }[];
    const answered = rows.filter((r) => r.answer.trim().length > 0).length;
    const signed = rows.filter((r) => r.signer_id).length;
    const given = db.prepare("SELECT COUNT(*) AS n FROM slices WHERE signer_id = ?").get(p.id) as {
      n: number;
    };
    return {
      id: p.id,
      name: p.name,
      code: p.code,
      answered,
      signed,
      given: given.n,
      complete: signed >= SLICE_COUNT,
    };
  });

  board.sort((a, b) => b.signed - a.signed || b.answered - a.answered || a.name.localeCompare(b.name));

  const totals = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN TRIM(answer) <> '' THEN 1 ELSE 0 END) AS answered,
         SUM(CASE WHEN signer_id IS NOT NULL THEN 1 ELSE 0 END) AS signed
       FROM slices`,
    )
    .get() as { total: number; answered: number | null; signed: number | null };

  const feed = db
    .prepare(
      `SELECT s.signed_at AS at, s.signer_name AS signer, p.name AS target, s.idx AS idx
       FROM slices s JOIN players p ON p.id = s.player_id
       WHERE s.signed_at IS NOT NULL
       ORDER BY s.signed_at DESC LIMIT 25`,
    )
    .all() as unknown as { at: number; signer: string; target: string; idx: number }[];

  return {
    phase: getPhase(),
    eventName: getSetting("event_name"),
    sliceCount: SLICE_COUNT,
    players: players.length,
    answeredSlices: totals.answered ?? 0,
    totalSlices: totals.total,
    signatures: totals.signed ?? 0,
    completed: board.filter((b) => b.complete).length,
    noSignaturesYet: board.filter((b) => b.signed === 0).length,
    board,
    feed: feed.map((f) => ({
      at: f.at,
      signer: f.signer,
      target: f.target,
      title: SLICE_PROMPTS[f.idx]?.title ?? `Slice ${f.idx + 1}`,
    })),
  };
}

export function drawRaffle(): { name: string; code: string } | null {
  const pool = adminStats().board.filter((b) => b.complete);
  if (pool.length === 0) return null;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return { name: pick.name, code: pick.code };
}

export function exportCsv(): string {
  const rows = db
    .prepare(
      `SELECT p.name AS owner, p.code AS code, s.idx AS idx,
              s.answer AS answer, s.signer_name AS signer, s.signed_at AS signed_at
       FROM players p JOIN slices s ON s.player_id = p.id
       ORDER BY p.created_at, s.idx`,
    )
    .all() as unknown as {
    owner: string;
    code: string;
    idx: number;
    answer: string;
    signer: string | null;
    signed_at: number | null;
  }[];

  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = ["owner,code,slice,prompt,answer,signed_by,signed_at"];
  for (const r of rows) {
    lines.push(
      [
        esc(r.owner),
        esc(r.code),
        String(r.idx + 1),
        esc(SLICE_PROMPTS[r.idx]?.title ?? ""),
        esc(r.answer),
        esc(r.signer ?? ""),
        esc(r.signed_at ? new Date(r.signed_at).toISOString() : ""),
      ].join(","),
    );
  }
  return lines.join("\n");
}

export function resetEverything(): void {
  db.exec("DELETE FROM slices; DELETE FROM players;");
}
