"use client";

export type PizzaSlice = {
  idx: number;
  emoji: string;
  answer: string;
  signerName: string | null;
};

type Props = {
  slices: PizzaSlice[];
  activeIdx?: number | null;
  onSelect?: (idx: number) => void;
  /** Suppresses the tap affordance for read-only views (e.g. the projector). */
  readOnly?: boolean;
};

const SIZE = 400;
const C = SIZE / 2;
const R_OUT = 188; // outer edge of crust
const R_IN = 150; // where cheese ends and crust begins
const R_TEXT = (R_OUT + R_IN) / 2 + 4; // baseline for the signer's name
const GAP = 1.6; // degrees of char between slices

/** Angles run clockwise from 12 o'clock, which is how the slices read on screen. */
function pt(angle: number, r: number): [number, number] {
  const rad = (angle * Math.PI) / 180;
  return [C + r * Math.sin(rad), C - r * Math.cos(rad)];
}

function f([x, y]: [number, number]): string {
  return `${x.toFixed(2)} ${y.toFixed(2)}`;
}

function wedgePath(a0: number, a1: number): string {
  return `M ${C} ${C} L ${f(pt(a0, R_IN))} A ${R_IN} ${R_IN} 0 0 1 ${f(pt(a1, R_IN))} Z`;
}

function crustPath(a0: number, a1: number): string {
  return [
    `M ${f(pt(a0, R_IN))}`,
    `L ${f(pt(a0, R_OUT))}`,
    `A ${R_OUT} ${R_OUT} 0 0 1 ${f(pt(a1, R_OUT))}`,
    `L ${f(pt(a1, R_IN))}`,
    `A ${R_IN} ${R_IN} 0 0 0 ${f(pt(a0, R_IN))}`,
    "Z",
  ].join(" ");
}

/** Flips the text arc for bottom-half slices so names never read upside down. */
function textArcPath(a0: number, a1: number): string {
  const mid = (a0 + a1) / 2;
  const flipped = mid > 90 && mid < 270;
  return flipped
    ? `M ${f(pt(a1, R_TEXT - 9))} A ${R_TEXT - 9} ${R_TEXT - 9} 0 0 0 ${f(pt(a0, R_TEXT - 9))}`
    : `M ${f(pt(a0, R_TEXT))} A ${R_TEXT} ${R_TEXT} 0 0 1 ${f(pt(a1, R_TEXT))}`;
}

/** [radius, angle offset from the wedge's centre line], tuned against a 72° wedge. */
const PEPPERONI: [number, number][] = [
  [72, -15],
  [104, 13],
  [124, -17],
];

/** Reference wedge width the pepperoni and crust text were laid out against. */
const REF_STEP = 72;

export default function Pizza({ slices, activeIdx, onSelect, readOnly }: Props) {
  const n = slices.length;
  const step = 360 / n;
  // Narrower wedges need the toppings pulled toward the centre line and the
  // crust name set smaller, or both spill over the slice boundary.
  const angleScale = Math.min(1, step / REF_STEP);
  const crustFontSize = step >= 60 ? 13 : 11;

  return (
    <div className="pizza-wrap">
      <svg
        className="pizza"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`Your pizza: ${slices.filter((s) => s.signerName).length} of ${n} slices signed`}
      >
        <defs>
          <radialGradient id="cheeseGrad" cx="42%" cy="36%">
            <stop offset="0%" stopColor="#FBDA8E" />
            <stop offset="100%" stopColor="#F0BC4A" />
          </radialGradient>
          <radialGradient id="doughGrad" cx="42%" cy="36%">
            <stop offset="0%" stopColor="#F7EAD2" />
            <stop offset="100%" stopColor="#EBD9B6" />
          </radialGradient>
        </defs>

        {/* Plate */}
        <circle cx={C} cy={C} r={R_OUT + 8} fill="#ffffff" stroke="#ECDFCC" strokeWidth="2" />

        {slices.map((slice, i) => {
          const a0 = i * step + GAP;
          const a1 = (i + 1) * step - GAP;
          const mid = (a0 + a1) / 2;
          const signed = Boolean(slice.signerName);
          const answered = slice.answer.trim().length > 0;
          const active = activeIdx === slice.idx;

          const fill = signed
            ? "url(#cheeseGrad)"
            : answered
              ? "url(#cheeseGrad)"
              : "url(#doughGrad)";

          const name = (slice.signerName ?? "").slice(0, 16);

          return (
            <g
              key={slice.idx}
              className={readOnly ? undefined : "pizza__wedge"}
              onClick={readOnly ? undefined : () => onSelect?.(slice.idx)}
              role={readOnly ? undefined : "button"}
              tabIndex={readOnly ? undefined : 0}
              onKeyDown={
                readOnly
                  ? undefined
                  : (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect?.(slice.idx);
                      }
                    }
              }
              aria-label={`Slice ${slice.idx + 1}${signed ? `, signed by ${slice.signerName}` : answered ? ", filled in, waiting for a signature" : ", empty"}`}
            >
              <path
                d={wedgePath(a0, a1)}
                fill={fill}
                stroke={active ? "#C8442E" : "#DCC08A"}
                strokeWidth={active ? 4 : 1.5}
              />

              {signed &&
                PEPPERONI.map(([r, off], k) => {
                  const [px, py] = pt(mid + off * angleScale, r);
                  return (
                    <circle
                      key={k}
                      cx={px}
                      cy={py}
                      r={11}
                      fill="#C8442E"
                      stroke="#A5331F"
                      strokeWidth="1.5"
                    />
                  );
                })}

              <path
                d={crustPath(a0, a1)}
                fill={signed ? "#E3A852" : "#F2DDBA"}
                stroke="#C98B36"
                strokeWidth="1.5"
              />

              <path id={`arc-${slice.idx}`} d={textArcPath(a0, a1)} fill="none" />
              {signed ? (
                <text className="pizza__crust-text" fontSize={crustFontSize}>
                  <textPath href={`#arc-${slice.idx}`} startOffset="50%" textAnchor="middle">
                    {name}
                  </textPath>
                </text>
              ) : (
                <text className="pizza__num" fontSize={crustFontSize}>
                  <textPath href={`#arc-${slice.idx}`} startOffset="50%" textAnchor="middle">
                    {answered ? "NEEDS A SIGN" : `SLICE ${slice.idx + 1}`}
                  </textPath>
                </text>
              )}

              <text className="pizza__emoji" x={pt(mid, 92)[0]} y={pt(mid, 92)[1]}>
                {slice.emoji}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
