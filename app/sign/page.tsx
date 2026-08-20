"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Masthead, Sheet } from "@/components/ui";
import { api, buzz, post } from "@/lib/client";
import type { LookupDto, MeDto } from "@/lib/types";

export default function SignPage() {
  return (
    <Suspense
      fallback={
        <main className="shell">
          <p className="muted center">Loading…</p>
        </main>
      }
    >
      <SignInner />
    </Suspense>
  );
}

function SignInner() {
  const router = useRouter();
  const params = useSearchParams();
  const prefill = (params.get("code") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);

  const [me, setMe] = useState<MeDto | null>(null);
  const [code, setCode] = useState(prefill);
  const [view, setView] = useState<LookupDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [justSigned, setJustSigned] = useState<string | null>(null);
  const [showMine, setShowMine] = useState(false);

  const lookup = useCallback(
    async (value: string) => {
      setError(null);
      setBusy(true);
      try {
        setView(await api<LookupDto>(`/api/lookup?code=${encodeURIComponent(value)}`));
      } catch (err) {
        setView(null);
        setError(err instanceof Error ? err.message : "Lookup failed.");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  useEffect(() => {
    api<MeDto>("/api/me")
      .then((data) => {
        if (!data.player) {
          const next = prefill ? `/sign?code=${prefill}` : "/sign";
          router.replace(`/?next=${encodeURIComponent(next)}`);
          return;
        }
        setMe(data);
        if (prefill.length === 4) lookup(prefill);
      })
      .catch(() => setError("Could not reach the server. Check your signal and try again."));
  }, [prefill, router, lookup]);

  async function sign(idx: number) {
    setBusy(true);
    setError(null);
    try {
      const res = await post<{ targetName: string; view: LookupDto }>("/api/sign", { code, idx });
      buzz([20, 50, 20]);
      setView({ ...res.view, phase: view?.phase ?? "trade" });
      setJustSigned(res.targetName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign.");
      if (code.length === 4) lookup(code);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setCode("");
    setView(null);
    setJustSigned(null);
    setError(null);
  }

  if (!me?.player) {
    return (
      <main className="shell">
        <p className="muted center">Loading…</p>
        {error && <Alert kind="error">{error}</Alert>}
      </main>
    );
  }

  return (
    <main className="shell">
      <Masthead
        title="Sign a slice"
        right={
          <Link href="/play" className="btn btn--ghost">
            ← My pizza
          </Link>
        }
      />

      {justSigned ? (
        <section className="card card--hero stack center">
          <h1>✍️ Signed!</h1>
          <p>
            You&rsquo;re now on <strong>{justSigned}</strong>&rsquo;s crust.
          </p>
          <Alert kind="info">
            Now it&rsquo;s their turn — give them <strong>your</strong> code so they can sign one of
            yours.
          </Alert>
          <div className="bigcode">{me.player.code}</div>
          <button className="btn btn--gold btn--block" onClick={() => setShowMine(true)}>
            Show my QR code
          </button>
          <button className="btn btn--primary btn--block" onClick={reset}>
            Sign someone else
          </button>
          <Link href="/play" className="btn btn--ghost btn--block" style={{ textAlign: "center" }}>
            Back to my pizza
          </Link>
        </section>
      ) : (
        <>
          {me.phase !== "trade" && (
            <Alert kind="info">
              {me.phase === "build"
                ? "Trading hasn't opened yet. Fill in your own slices while you wait."
                : "The game is closed — no more signatures."}
            </Alert>
          )}

          <form
            className="card stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length === 4) lookup(code);
            }}
          >
            <span className="card__label">Their 4-character code</span>
            <input
              className="code-input"
              value={code}
              onChange={(e) => {
                const next = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
                setCode(next);
                if (next.length < 4) setView(null);
              }}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="––––"
              aria-label="Their four character code"
            />
            <button className="btn btn--primary btn--block" disabled={code.length !== 4 || busy}>
              {busy ? "Looking…" : "Find their pizza"}
            </button>
            <p className="tiny muted center">
              Or point your camera at their QR code — it opens this page already filled in.
            </p>
          </form>

          {error && <Alert kind="error">{error}</Alert>}

          {view && (
            <section className="stack">
              <div className="card card--hero stack">
                <div className="row row--between">
                  <div>
                    <span className="card__label">Signing for</span>
                    <h2>{view.target.name}</h2>
                  </div>
                </div>
              </div>

              {view.alreadySignedIdx !== null ? (
                <Alert kind="good">
                  You&rsquo;ve already signed {view.target.name}&rsquo;s &ldquo;
                  {view.slices[view.alreadySignedIdx]?.title}&rdquo; slice. One signature per pizza —
                  go find someone new!
                </Alert>
              ) : (
                <p className="small muted">
                  Find the slice where their answer matches yours, share more about yourself, then
                  sign that one. <strong>Different CG only</strong> — if you&rsquo;re in the same CG,
                  go find someone else.
                </p>
              )}

              {view.slices.map((s) => (
                <div key={s.idx} className={`slice-item slice-item--${s.signerName ? "signed" : s.signable ? "ready" : "todo"}`}>
                  <span className="slice-item__emoji" aria-hidden>
                    {s.emoji}
                  </span>
                  <div className="grow stack" style={{ gap: 4 }}>
                    <span className="card__label">{s.title}</span>
                    <span className="slice-item__answer">
                      {s.answer.trim() || <span className="muted">Not filled in yet</span>}
                    </span>
                    {s.signerName ? (
                      <span className="tiny muted">Signed by {s.signerName}</span>
                    ) : s.signable && me.phase === "trade" ? (
                      <button
                        className="btn btn--gold btn--sm"
                        style={{ alignSelf: "flex-start", marginTop: 4 }}
                        onClick={() => sign(s.idx)}
                        disabled={busy}
                      >
                        Sign this slice
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {showMine && (
        <Sheet onClose={() => setShowMine(false)}>
          <div className="stack center">
            <h2>Your code</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="qr" src={me.qr} alt={`QR code for join code ${me.player.code}`} />
            <div className="bigcode">{me.player.code}</div>
            <button className="btn btn--block" onClick={() => setShowMine(false)}>
              Done
            </button>
          </div>
        </Sheet>
      )}
    </main>
  );
}
