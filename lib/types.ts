/** Shapes exchanged over the API. Kept free of server imports so client components can use them. */

export type Phase = "build" | "trade" | "closed";

export type PlayerDto = {
  id: string;
  code: string;
  name: string;
  createdAt: number;
};

export type SliceDto = {
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

export type MeDto = {
  player: PlayerDto | null;
  slices: SliceDto[];
  signedCount: number;
  answeredCount: number;
  complete: boolean;
  givenCount: number;
  phase: Phase;
  signUrl: string;
  qr: string;
};

export type LookupSliceDto = {
  idx: number;
  emoji: string;
  title: string;
  prompt: string;
  answer: string;
  signerName: string | null;
  signable: boolean;
};

export type LookupDto = {
  target: { name: string; code: string };
  alreadySignedIdx: number | null;
  slices: LookupSliceDto[];
  phase: Phase;
};

export type BoardRow = {
  id: string;
  name: string;
  code: string;
  answered: number;
  signed: number;
  given: number;
  complete: boolean;
};

export type StatsDto = {
  phase: Phase;
  eventName: string;
  sliceCount: number;
  players: number;
  answeredSlices: number;
  totalSlices: number;
  signatures: number;
  completed: number;
  noSignaturesYet: number;
  board: BoardRow[];
  feed: { at: number; signer: string; target: string; title: string }[];
};
