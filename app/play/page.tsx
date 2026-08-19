"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Pizza from "@/components/Pizza";
import { Alert, Confetti, Masthead, Pips, Sheet } from "@/components/ui";
import { api, buzz, post } from "@/lib/client";
import type { MeDto } from "@/lib/types";

const POLL_MS = 5000;

export default function PlayPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const wasComplete = useRef(false);
  const signedCount = useRef(0);
  const misses = useRef(0);

  const load = useCallback(async () => {
    try {
      const data = await api<MeDto>("/api/me");
      if (!data.player) {
        router.replace("/");
        return;
      }
      misses.current = 0;
      setError(null);
      setMe(data);

      if (data.signedCount > signedCount.current && signedCount.current !== 0) buzz(18);
      signedCount.current = data.signedCount;

      if (data.complete && !wasComplete.current) {
        wasComplete.current = true;
        setCelebrate(true);
        buzz([30, 60, 30]);
      }
    } catch {
      // One dropped poll on crowded venue wifi is normal; only say something
      // once it has clearly stopped working.
      misses.current += 1;
      if (misses.current >= 3) {
        setError("Can't reach the server right now. Your pizza is safe — we'll keep trying.");
      }
    }
  }, [router]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  if (!me?.player) {
    return (
      <main className="shell">
        <p className="muted center">Loading your pizza…</p>
      </main>
    );
  }

  const { player, slices, phase } = me;
  const unanswered = slices.filter((s) => !s.answer.trim()).length;
  const editingSlice = editing === null ? null : slices.find((s) => s.idx === editing) ?? null;

  return (
    <main className="shell">
      <Confetti run={celebrate} />

      <Masthead
        title={player.name}
        right={
          <span className={`badge ${phase === "trade" ? "badge--live" : ""}`}>
            {phase === "build" ? "Prep time" : phase === "trade" ? "Trading open" : "Closed"}
          </span>
        }
      />

      {error && <Alert kind="error">{error}</Alert>}

      <section className="card card--hero stack">
        <Pizza slices={slices} activeIdx={editing} onSelect={(i) => setEditing(i)} />
        <Pips total={slices.length} done={me.signedCount} />
        <p className="center">
          {me.complete ? (
            <strong>🎉 Pizza complete — {slices.length} signatures. Go claim your raffle entry!</strong>
          ) : unanswered > 0 ? (
            <>
              <strong>{unanswered} slice{unanswered === 1 ? "" : "s"} still blank.</strong>{" "}
              <span className="muted">Tap a slice to fill it in.</span>
            </>
          ) : (
            <>
              <strong>{slices.length - me.signedCount} more signature{slices.length - me.signedCount === 1 ? "" : "s"} to go.</strong>{" "}
              <span className="muted">Show your code to someone new.</span>
            </>
          )}
        </p>

        {me.minOtherTables > 0 && (
          <p className="tiny muted center">
            Out-of-table rule: {me.outsideTableCount}/{me.minOtherTables} signatures from other tables
            {me.meetsTableRule ? " ✅" : ""}
          </p>
        )}
      </section>

      {phase === "build" && (
        <Alert kind="info">
          Trading hasn&rsquo;t opened yet — fill in all five answers now so you&rsquo;re ready the second
          lunch starts.
        </Alert>
      )}

      <section className="stack">
        <h2>Your slices</h2>
        {slices.map((s) => {
          const state = s.signerName ? "signed" : s.answer.trim() ? "ready" : "todo";
          return (
            <button
              key={s.idx}
              className={`slice-item slice-item--${state}`}
              onClick={() => setEditing(s.idx)}
            >
              <span className="slice-item__emoji" aria-hidden>
                {s.emoji}
              </span>
              <span className="grow stack" style={{ gap: 3 }}>
                <span className="card__label">{s.title}</span>
                {s.answer.trim() ? (
                  <span className="slice-item__answer">{s.answer}</span>
                ) : (
                  <span className="muted">Tap to answer: {s.prompt}</span>
                )}
                {s.signerName ? (
                  <span className="tiny" style={{ color: "var(--basil)", fontWeight: 800 }}>
                    ✍️ Signed by {s.signerName}
                    {s.signerTable ? ` (table ${s.signerTable})` : ""}
                  </span>
                ) : s.answer.trim() ? (
                  <span className="tiny muted">Waiting for a signature</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </section>

      <section className="card stack center">
        <span className="card__label">Your code — people type this to sign your slice</span>
        <div className="bigcode">{player.code}</div>
        <button className="btn btn--gold btn--block" onClick={() => setShowCode(true)}>
          Show my QR code
        </button>
      </section>

      <p className="tiny muted center">
        You&rsquo;ve signed {me.givenCount} slice{me.givenCount === 1 ? "" : "s"} for other people.
      </p>

      {editingSlice && (
        <SliceEditor
          slice={editingSlice}
          locked={Boolean(editingSlice.signerName) || phase === "closed"}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            setError(null);
            await load();
          }}
        />
      )}

      {showCode && (
        <Sheet onClose={() => setShowCode(false)}>
          <div className="stack center">
            <h2>Let them scan or type this</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="qr" src={me.qr} alt={`QR code for join code ${player.code}`} />
            <div className="bigcode">{player.code}</div>
            <p className="muted small">
              Their phone camera opens the sign-off page. Or they type the 4 characters into
              &ldquo;Sign a slice&rdquo;.
            </p>
            <button className="btn btn--block" onClick={() => setShowCode(false)}>
              Done
            </button>
          </div>
        </Sheet>
      )}

      <div className="dock">
        <div className="dock__inner">
          <Link
            href="/sign"
            className="btn btn--primary btn--block"
            style={{
              textAlign: "center",
              pointerEvents: phase === "trade" ? undefined : "none",
              opacity: phase === "trade" ? 1 : 0.5,
            }}
            aria-disabled={phase !== "trade"}
          >
            ✍️ Sign someone&rsquo;s slice
          </Link>
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */

function SliceEditor({
  slice,
  locked,
  onClose,
  onSaved,
}: {
  slice: MeDto["slices"][number];
  locked: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [value, setValue] = useState(slice.answer);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setLocalError(null);
    try {
      await post("/api/answer", { idx: slice.idx, answer: value });
      await onSaved();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not save.");
      setBusy(false);
    }
  }

  return (
    <Sheet onClose={onClose}>
      <div className="stack">
        <div className="row">
          <span style={{ fontSize: "2rem" }} aria-hidden>
            {slice.emoji}
          </span>
          <div className="grow">
            <span className="card__label">Slice {slice.idx + 1}</span>
            <h2>{slice.title}</h2>
          </div>
        </div>

        <p>{slice.prompt}</p>
        <p className="small muted">{slice.hint}</p>

        {localError && <Alert kind="error">{localError}</Alert>}

        {locked ? (
          <>
            <div className="card card--flat">
              <p className="slice-item__answer">{slice.answer || "(blank)"}</p>
            </div>
            <Alert kind="good">
              {slice.signerName
                ? `Signed by ${slice.signerName} — this slice is set in stone.`
                : "The game is closed, so answers are locked."}
            </Alert>
          </>
        ) : (
          <>
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={3}
              maxLength={280}
              placeholder="Keep it short and specific — that's what starts conversations."
              autoFocus
            />
            {slice.quickPicks.length > 0 && (
              <div className="chips">
                {slice.quickPicks.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className={`chip${value === q ? " chip--on" : ""}`}
                    onClick={() => setValue(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            <button className="btn btn--primary btn--block" onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save slice"}
            </button>
          </>
        )}

        <button className="btn btn--ghost btn--block" onClick={onClose}>
          Close
        </button>
      </div>
    </Sheet>
  );
}
