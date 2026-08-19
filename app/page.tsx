"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, post } from "@/lib/client";
import { Alert, Masthead } from "@/components/ui";
import type { MeDto, PlayerDto } from "@/lib/types";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="shell">
          <p className="muted center">Warming the oven…</p>
        </main>
      }
    >
      <JoinPage />
    </Suspense>
  );
}

function JoinPage() {
  const router = useRouter();
  const params = useSearchParams();
  // Set when someone scanned a friend's QR before joining — send them back there afterwards.
  const nextPath = params.get("next")?.startsWith("/") ? (params.get("next") as string) : "/play";
  const [checking, setChecking] = useState(true);
  const [name, setName] = useState("");
  const [tableNo, setTableNo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<MeDto>("/api/me")
      .then((me) => {
        if (me.player) router.replace(nextPath);
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router, nextPath]);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await post<{ player: PlayerDto }>("/api/join", { name, tableNo });
      router.replace(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join.");
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <main className="shell">
        <p className="muted center">Warming the oven…</p>
      </main>
    );
  }

  return (
    <main className="shell">
      <Masthead title="Build Your Pizza" />

      <section className="card card--hero stack">
        <h1>
          Five slices.
          <br />
          Five new friends.
        </h1>
        <p className="muted">
          Fill in your five slices, then get five different people to sign one each. A finished pizza
          gets you into the raffle.
        </p>
      </section>

      <section className="card stack">
        <h2>How it works</h2>
        <ol className="stack" style={{ margin: 0, paddingLeft: "1.2em" }}>
          <li>
            <strong>Fill your slices.</strong> Five quick prompts — commute, ministry, kopi order, hot
            take, Sunday plans.
          </li>
          <li>
            <strong>Go find someone new.</strong> Chat for 60 seconds about an answer you share or
            strongly disagree with.
          </li>
          <li>
            <strong>Sign each other&rsquo;s slice.</strong> They enter your 4-character code, you enter
            theirs. One slice each.
          </li>
        </ol>
      </section>

      <form className="card stack" onSubmit={join}>
        <h2>Join the game</h2>
        {error && <Alert kind="error">{error}</Alert>}

        <label className="field">
          Your name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="How people know you"
            autoComplete="name"
            maxLength={40}
            required
          />
        </label>

        <label className="field">
          Your table number <span className="muted tiny">— powers the &ldquo;meet other tables&rdquo; rule</span>
          <input
            value={tableNo}
            onChange={(e) => setTableNo(e.target.value)}
            placeholder="e.g. 7"
            inputMode="text"
            maxLength={16}
          />
        </label>

        <button className="btn btn--primary btn--block" disabled={busy || name.trim().length < 2}>
          {busy ? "Rolling the dough…" : "Start my pizza 🍕"}
        </button>
        <p className="tiny muted center">
          Stay on this phone and this browser — your pizza lives in this device&rsquo;s session.
        </p>
      </form>
    </main>
  );
}
