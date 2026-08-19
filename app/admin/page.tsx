"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Masthead } from "@/components/ui";
import { api, post } from "@/lib/client";
import type { Phase, StatsDto } from "@/lib/types";

const POLL_MS = 5000;

export default function AdminPage() {
  const [stats, setStats] = useState<StatsDto | null>(null);
  const [locked, setLocked] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [winner, setWinner] = useState<{ name: string; code: string; tableNo: string } | null>(null);
  const [showReset, setShowReset] = useState(false);
  const [resetText, setResetText] = useState("");

  const load = useCallback(async () => {
    try {
      setStats(await api<StatsDto>("/api/admin/stats"));
      setLocked(false);
    } catch {
      setLocked(true);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await post("/api/admin/login", { passcode });
      setPasscode("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    }
  }

  async function setPhase(phase: Phase) {
    setError(null);
    try {
      setStats(await post<StatsDto>("/api/admin/settings", { phase }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change phase.");
    }
  }

  async function setRule(minOtherTables: number) {
    try {
      setStats(await post<StatsDto>("/api/admin/settings", { minOtherTables }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the rule.");
    }
  }

  async function draw(strict: boolean) {
    setError(null);
    setWinner(null);
    try {
      const res = await post<{ winner: { name: string; code: string; tableNo: string } }>(
        "/api/admin/raffle",
        { strict },
      );
      setWinner(res.winner);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not draw.");
    }
  }

  async function doReset() {
    try {
      await post("/api/admin/reset", { confirm: resetText });
      setShowReset(false);
      setResetText("");
      setWinner(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed.");
    }
  }

  if (locked) {
    return (
      <main className="shell">
        <Masthead title="Host controls" />
        <form className="card stack" onSubmit={login}>
          <h2>Passcode</h2>
          {error && <Alert kind="error">{error}</Alert>}
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Host passcode"
            autoComplete="current-password"
          />
          <button className="btn btn--primary btn--block">Unlock</button>
        </form>
      </main>
    );
  }

  if (!stats) {
    return (
      <main className="shell">
        <p className="muted center">Loading…</p>
      </main>
    );
  }

  const pct = stats.totalSlices ? Math.round((stats.signatures / stats.totalSlices) * 100) : 0;

  return (
    <main className="shell shell--wide">
      <Masthead
        title="Host controls"
        right={<span className="badge badge--live">Live · refreshes every 5s</span>}
      />

      {error && <Alert kind="error">{error}</Alert>}

      <section className="card stack">
        <div className="row row--between row--wrap">
          <div>
            <span className="card__label">Current phase</span>
            <h2>
              {stats.phase === "build"
                ? "🍳 Prep — signing is locked"
                : stats.phase === "trade"
                  ? "🔥 Trading is open"
                  : "🧊 Closed"}
            </h2>
          </div>
        </div>
        <div className="row row--wrap">
          <button
            className={`btn btn--sm${stats.phase === "build" ? " btn--gold" : ""}`}
            onClick={() => setPhase("build")}
          >
            Prep only
          </button>
          <button
            className={`btn btn--sm${stats.phase === "trade" ? " btn--primary" : ""}`}
            onClick={() => setPhase("trade")}
          >
            Open trading
          </button>
          <button
            className={`btn btn--sm${stats.phase === "closed" ? " btn--danger" : ""}`}
            onClick={() => setPhase("closed")}
          >
            Close game
          </button>
        </div>
        <p className="tiny muted">
          Players can join and fill answers in every phase except Closed. Signatures only work while
          trading is open.
        </p>
      </section>

      <section className="metrics">
        <Metric label="Players joined" value={stats.players} />
        <Metric label="Signatures" value={`${stats.signatures}/${stats.totalSlices}`} sub={`${pct}%`} />
        <Metric label="Complete pizzas" value={stats.completed} />
        <Metric
          label={`Meet ${stats.minOtherTables}-table rule`}
          value={stats.completedStrict}
        />
        <Metric label="Answers filled" value={`${stats.answeredSlices}/${stats.totalSlices}`} />
        <Metric label="Nobody signed yet" value={stats.noSignaturesYet} />
      </section>

      {stats.noSignaturesYet > 0 && stats.phase === "trade" && (
        <Alert kind="info">
          {stats.noSignaturesYet} {stats.noSignaturesYet === 1 ? "person has" : "people have"} no
          signatures at all. Grab a host and go introduce them — that&rsquo;s the whole point of the
          game.
        </Alert>
      )}

      <section className="card stack">
        <div className="row row--between row--wrap">
          <h2>🎁 Raffle</h2>
          <div className="row row--wrap">
            <button className="btn btn--sm btn--gold" onClick={() => draw(true)}>
              Draw (rule-abiding)
            </button>
            <button className="btn btn--sm" onClick={() => draw(false)}>
              Draw (any complete)
            </button>
          </div>
        </div>
        {winner ? (
          <Alert kind="good">
            🏆 <strong>{winner.name}</strong> ({winner.code})
            {winner.tableNo ? ` — table ${winner.tableNo}` : ""}
          </Alert>
        ) : (
          <p className="tiny muted">
            &ldquo;Rule-abiding&rdquo; only includes pizzas with at least {stats.minOtherTables}{" "}
            signatures from other tables.
          </p>
        )}
        <label className="field">
          Out-of-table rule: {stats.minOtherTables} of {stats.sliceCount} signatures must come from
          other tables
          <input
            type="range"
            min={0}
            max={stats.sliceCount}
            value={stats.minOtherTables}
            onChange={(e) => setRule(Number(e.target.value))}
            style={{ minHeight: 0, padding: 0, background: "transparent", border: "none" }}
          />
        </label>
      </section>

      <section className="card stack">
        <h2>Latest connections</h2>
        {stats.feed.length === 0 ? (
          <p className="muted small">Nothing yet.</p>
        ) : (
          <div className="stack" style={{ gap: 6 }}>
            {stats.feed.map((f, i) => (
              <p key={i} className="small">
                <strong>{f.signer}</strong> signed <strong>{f.target}</strong>&rsquo;s{" "}
                <span className="muted">{f.title}</span>{" "}
                <span className="tiny muted">
                  {new Date(f.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </p>
            ))}
          </div>
        )}
      </section>

      <section className="card stack">
        <div className="row row--between row--wrap">
          <h2>Everyone ({stats.board.length})</h2>
          <a className="btn btn--sm" href="/api/admin/export">
            Download CSV
          </a>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Table</th>
                <th>Answers</th>
                <th>Signed</th>
                <th>Other tables</th>
                <th>Given</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.board.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="mono">{r.code}</td>
                  <td>{r.tableNo || "—"}</td>
                  <td>
                    {r.answered}/{stats.sliceCount}
                  </td>
                  <td>
                    {r.signed}/{stats.sliceCount}
                  </td>
                  <td>{r.outsideTables}</td>
                  <td>{r.given}</td>
                  <td>
                    {r.strict ? (
                      <span className="badge badge--live">Complete ✓</span>
                    ) : r.complete ? (
                      <span className="badge">Full, rule short</span>
                    ) : r.signed === 0 ? (
                      <span className="badge badge--hot">Needs a nudge</span>
                    ) : (
                      <span className="badge">In progress</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card stack">
        <h2>Danger zone</h2>
        {showReset ? (
          <>
            <Alert kind="error">
              This deletes every player and every pizza. Use it only between a rehearsal and the real
              event.
            </Alert>
            <input
              value={resetText}
              onChange={(e) => setResetText(e.target.value)}
              placeholder="Type RESET to confirm"
            />
            <div className="row">
              <button className="btn btn--danger grow" onClick={doReset} disabled={resetText !== "RESET"}>
                Delete everything
              </button>
              <button className="btn grow" onClick={() => setShowReset(false)}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <button className="btn btn--danger btn--sm" onClick={() => setShowReset(true)}>
            Reset the whole event
          </button>
        )}
      </section>
    </main>
  );
}

function Metric({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="metric">
      <div className="card__label">{label}</div>
      <div className="metric__value">{value}</div>
      {sub && <div className="tiny muted">{sub}</div>}
    </div>
  );
}
