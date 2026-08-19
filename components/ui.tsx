"use client";

import { useEffect, useState } from "react";

export function Masthead({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <header className="masthead">
      <div className="masthead__title">
        <span className="masthead__logo" aria-hidden>
          🍕
        </span>
        <span>{title}</span>
      </div>
      {right}
    </header>
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
