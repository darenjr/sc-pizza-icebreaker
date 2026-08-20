"use client";

import { useEffect, useRef, useState } from "react";
import { buzz } from "@/lib/client";

/** Mostly pizza, with a few toppings thrown clear for variety. */
const BURST_PIECES = ["🍕", "🍕", "🍕", "🍕", "🍕", "🧀", "🍅", "🌶️", "🫒"];

type Burst = {
  id: number;
  x: number;
  y: number;
  bits: { dx: number; dy: number; rot: number; size: number; dur: number; ch: string }[];
};

export function Masthead({
  title,
  right,
  hero,
}: {
  title: string;
  right?: React.ReactNode;
  /** Big centred lockup for the join screen. Every other page uses the compact bar. */
  hero?: boolean;
}) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const nextId = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  /** Easter egg: tap the logo for a pizza firework. Repeat taps stack. */
  function pop(e: React.MouseEvent<HTMLButtonElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const id = nextId.current++;
    const bits = Array.from({ length: 22 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 90 + Math.random() * 160;
      return {
        dx: Math.cos(angle) * dist,
        // Biased downward so the pieces arc and fall rather than hanging in a ring.
        dy: Math.sin(angle) * dist + 70,
        rot: Math.random() * 900 - 450,
        size: 0.9 + Math.random() * 1.6,
        dur: 1 + Math.random() * 0.7,
        ch: BURST_PIECES[Math.floor(Math.random() * BURST_PIECES.length)],
      };
    });

    setBursts((b) => [...b, { id, x: box.left + box.width / 2, y: box.top + box.height / 2, bits }]);
    buzz([12, 28, 12]);
    timers.current.push(setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 2200));
  }

  return (
    <>
      <header className={`masthead${hero ? " masthead--hero" : ""}`}>
        <div className="masthead__title">
          <button
            type="button"
            className="masthead__logo"
            onClick={pop}
            aria-label="Pizza fireworks"
          >
            🍕
          </button>
          <span>{title}</span>
        </div>
        {right}
      </header>

      {bursts.length > 0 && (
        <div className="burst" aria-hidden>
          {bursts.map((b) =>
            b.bits.map((p, i) => (
              <span
                key={`${b.id}-${i}`}
                style={
                  {
                    left: b.x,
                    top: b.y,
                    "--dx": `${p.dx}px`,
                    "--dy": `${p.dy}px`,
                    "--rot": `${p.rot}deg`,
                    "--size": `${p.size}rem`,
                    "--dur": `${p.dur}s`,
                  } as React.CSSProperties
                }
              >
                {p.ch}
              </span>
            )),
          )}
        </div>
      )}
    </>
  );
}

/**
 * Decorative pizzas drifting across the join screen. Fixed values rather than
 * Math.random() so the server and client render the same thing, and pure
 * transform/opacity so phones composite it on the GPU. Hidden outright when the
 * visitor asks for reduced motion.
 *
 * The layer sits behind the cards, so paths are weighted toward the open hero
 * area at the top — pizzas crossing the middle of the page are hidden behind
 * opaque cards and read as nothing at all.
 */
const FLYERS = [
  { from: -18, to: 118, top: "5%", size: "2.5rem", dur: "24s", delay: "0s", drift: "26px", bob: "3.1s", spin: "360deg" },
  { from: 118, to: -18, top: "12%", size: "1.7rem", dur: "31s", delay: "-5s", drift: "-20px", bob: "2.4s", spin: "-300deg" },
  { from: -16, to: 116, top: "20%", size: "3.2rem", dur: "37s", delay: "-13s", drift: "34px", bob: "4.2s", spin: "300deg" },
  { from: 118, to: -16, top: "28%", size: "2rem", dur: "27s", delay: "-3s", drift: "-28px", bob: "2.8s", spin: "-420deg" },
  { from: -14, to: 118, top: "36%", size: "2.8rem", dur: "42s", delay: "-19s", drift: "22px", bob: "3.6s", spin: "420deg" },
  { from: 116, to: -18, top: "52%", size: "1.6rem", dur: "29s", delay: "-8s", drift: "-18px", bob: "2.2s", spin: "-360deg" },
  { from: -18, to: 116, top: "66%", size: "2.3rem", dur: "35s", delay: "-24s", drift: "30px", bob: "3.9s", spin: "330deg" },
  { from: 118, to: -14, top: "80%", size: "2.9rem", dur: "45s", delay: "-11s", drift: "-24px", bob: "3.3s", spin: "-390deg" },
  { from: -16, to: 118, top: "92%", size: "1.8rem", dur: "26s", delay: "-17s", drift: "20px", bob: "2.6s", spin: "360deg" },
];

export function FlyingPizzas() {
  return (
    <div className="flyers" aria-hidden>
      {FLYERS.map((f, i) => (
        <span
          key={i}
          style={
            {
              "--from": f.from,
              "--to": f.to,
              "--top": f.top,
              "--size": f.size,
              "--dur": f.dur,
              "--delay": f.delay,
              "--spin": f.spin,
            } as React.CSSProperties
          }
        >
          <i style={{ "--drift": f.drift, "--bob": f.bob } as React.CSSProperties}>🍕</i>
        </span>
      ))}
    </div>
  );
}

export function Pips({ total, done }: { total: number; done: number }) {
  return (
    <div className="pips" aria-label={`${done} of ${total} slices signed`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`pip${i < done ? " pip--on" : ""}`} />
      ))}
    </div>
  );
}

export function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grip" />
        {children}
      </div>
    </div>
  );
}

const PIECES = ["🍕", "🧀", "🍍", "🌶️", "🎉", "🫒"];

export function Confetti({ run }: { run: boolean }) {
  const [bits, setBits] = useState<{ id: number; left: number; delay: number; dur: number; ch: string }[]>(
    [],
  );

  useEffect(() => {
    if (!run) return;
    setBits(
      Array.from({ length: 34 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.7,
        dur: 2.4 + Math.random() * 1.8,
        ch: PIECES[Math.floor(Math.random() * PIECES.length)],
      })),
    );
    const t = setTimeout(() => setBits([]), 5200);
    return () => clearTimeout(t);
  }, [run]);

  if (bits.length === 0) return null;
  return (
    <div className="confetti" aria-hidden>
      {bits.map((b) => (
        <span
          key={b.id}
          style={{ left: `${b.left}%`, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s` }}
        >
          {b.ch}
        </span>
      ))}
    </div>
  );
}

export function Alert({ kind, children }: { kind: "error" | "good" | "info"; children: React.ReactNode }) {
  return (
    <div className={`alert alert--${kind}`} role={kind === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}
