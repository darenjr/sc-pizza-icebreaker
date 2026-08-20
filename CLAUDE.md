# 🍕 Know Your Slice — icebreaker web app

A phone-first version of the paper pizza-building lunch icebreaker, sized for **~60 people in
one room**. People scan a QR code, fill in eight slices, then walk around finding people who gave
the *same* answer on a slice, chatting, and signing each other's slices. A full pizza = eight new
conversations.

This file is the working brief for the project: what the game is, how the app is built, how to set
it up, and how to run it on the day.

---

## 1. The game, exactly as the app enforces it

The paper version had people physically swap slices. That needs two-sided state and a lot of
fiddling on a phone, so the app replaces the swap with a **signature**, which is one-directional and
trivially verifiable:

| Paper version | App version |
| --- | --- |
| Write your name on the crust | Your name is on your own pizza automatically |
| Fill in eight prompts | Fill in eight prompts, tap a slice to edit |
| Trade a slice with someone | They sign one of your slices, you sign one of theirs |
| Glue slices onto a paper plate | Your pizza fills in live as people sign |
| Hand in a completed pizza | Completed pizzas appear in the host's raffle pool |

**Rules the server enforces.** These are not suggestions — the API rejects violations:

1. A pizza has **5 slices**, each with a fixed prompt.
2. You **cannot sign your own** pizza.
3. **One signature per person per pizza.** A full pizza therefore always carries eight *different*
   names. This is enforced by a partial unique index in SQLite, not just by application code, so
   double-taps and race conditions cannot slip through.
4. You **cannot sign a blank slice.** The owner must have written an answer first — this forces
   people to actually read something before signing.
5. Once a slice is signed, its **answer is frozen**. No rewriting history to match your new friend.
6. Signing only works during the **trade** phase (see §7).

**Two rules the app shows but does not enforce.** Both are social, and both are printed on the join
screen, the poster, and the sign screen:

- **Connect on a matching answer.** Find someone whose answer on a slice is the same as yours, talk
  about that, then sign. The app can't check this, and shouldn't — the point is the conversation.
- **Different CG only.** You may only connect with someone from a different cell group. The app
  collects no CG data, so this lives entirely in the copy and the host script. If you ever want it
  tracked or warned on, that means a CG field at join and a check in `getSignableView` — see §10.

There is no seating model: people mill around a room rather than sit at numbered tables, so joining
asks for a name and nothing else.

**The eight prompts** live in `lib/prompts.ts` and are the single source of truth:

| # | Slice | Prompt |
| --- | --- | --- |
| 1 | 🚇 The Commute | What MRT line do you stay on? |
| 2 | 🥤 The Drink | Coffee, tea, matcha, or water? |
| 3 | 🎯 The Hobby | What's your hobby? |
| 4 | 😀 The Smile | What made you smile this week? |
| 5 | 🤗 The Gratitude | What are you grateful for in church? |
| 6 | 🍕 The Favourite | What is your favourite food? |
| 7 | 📍 The Beginning | When did you join church? (IM · Singpost · Dhoby Ghaut) |
| 8 | 🏠 The New Building | What are you looking forward to in the new building? |

`quickPicks` carry more weight than they look: players connect by finding a *matching* answer, and
tap-to-fill chips make matches far likelier than free text where everyone types "coffee" eight
different ways. Slices 7 and 8 were both 🏠 as briefed — slice 7 uses 📍 instead, because the emoji
is a wedge's only label on the pizza and two identical ones are indistinguishable.

---

## 2. The player flow

```
QR code on a poster
        │
        ▼
   /  (join)          just your name  ──►  session cookie, 4-char code
        │
        ▼
   /play              your pizza: tap a wedge to answer, watch signatures land live
        │
        ├──► "Show my QR code"   ──►  the other person scans it
        │
        ▼
   /sign              type their 4-char code (or arrive pre-filled from their QR)
        │             read their answers, chat, tap "Sign this slice"
        ▼
   "Signed!" screen   immediately shows YOUR code so they can sign you back
```

The reciprocal step is the one that breaks down in practice, so the success screen leads with *your*
code rather than a generic "done" message.

**Why a 4-character code and not in-app QR scanning?** A camera scanner needs a JS library, camera
permission, and HTTPS, and it fails in dim rooms. The QR here is a plain link
(`/sign?code=ABCD`) that the **native camera app** opens — no scanner in our code — and the typed
code is the always-works fallback. The alphabet excludes lookalikes (`B/8 I/1 O/0 S/5 G/6 Z/2`), and
input is normalised server-side.

---

## 3. Architecture, and why it is this small

The whole thing is **one Next.js app with a SQLite file**. No database service, no auth provider, no
websocket server, no native modules.

- **Next.js 16 (App Router), React 19, TypeScript.** Pages are client components that talk to
  route handlers under `/app/api`.
- **`node:sqlite`** — Node's *built-in* SQLite, stable since Node 24. This is the key simplification:
  no `better-sqlite3` to compile, no Postgres to provision, no connection pooling. A finished
  60-person event is a ~200 KB file you can copy off the server.
- **Polling, not websockets.** Phones poll `/api/me` every 5 s and on window focus. At 60 players
  that is 12 requests/second — measured at **437 ms for all 60 concurrent polls**, so there is no
  reason to add socket infrastructure.
- **Cookie sessions, no passwords.** Joining mints an opaque 48-hex-char token in an httpOnly
  cookie. Nobody wants to make an account to eat lunch.
- **Hand-written CSS** in `app/globals.css` (no Tailwind). One committed warm/light theme — the app
  is used in a bright hall and mirrored on a projector, so it deliberately ignores the device's dark
  mode.

**Measured at event scale** (60 players on one laptop, production build):

| Operation | Time |
| --- | --- |
| 60 joins + 300 answer writes, concurrent | 903 ms |
| 300 signatures, concurrent | 803 ms |
| 60 concurrent `/api/me` polls | 437 ms |
| Admin dashboard for 67 players | 25 ms |
| Database size, full event | 192 KB |

**The one deployment constraint this buys:** SQLite needs a real filesystem, so the app runs on a
host with a persistent disk (Render, Railway, Fly, a VPS, or a laptop). **It will not work on
Vercel**, whose filesystem is ephemeral. See §6.

---

## 4. Project map

```
app/
  layout.tsx            fonts, metadata, one global stylesheet, the flying-pizza layer
  globals.css           the entire design system (~600 lines, no framework)
  page.tsx              join screen — name only, honours ?next= for QR-first arrivals
  play/page.tsx         the player's pizza: SVG, slice list, code + QR, edit sheet
  sign/page.tsx         look up a code, read their answers, sign one slice
  admin/page.tsx        host console: phase control, live metrics, feed, raffle, CSV, reset
  api/
    join/ me/ answer/ lookup/ sign/ leave/
    admin/ login/ stats/ settings/ raffle/ export/ reset/
components/
  Pizza.tsx             the SVG pizza — wedge geometry, curved crust names, pepperoni
  ui.tsx                Masthead, FlyingPizzas, Pips, Sheet, Confetti, Alert
lib/
  prompts.ts            the eight prompts  ← edit here to change the game
  db.ts                 SQLite handle, schema, settings, code generation
  game.ts               all game rules and queries (the only place rules live)
  session.ts            cookie helpers for players and the host
  http.ts               JSON helpers, error mapping
  types.ts              DTOs shared with client components (no server imports)
  client.ts             fetch wrapper + haptics
docs/                   GitHub Pages redirect — permanent link for a rotating tunnel URL
scripts/seed.mjs        fake players for solo testing, via the real API
scripts/make-poster.mjs printable A4 QR poster generator
scripts/update-link.mjs repoints the Pages redirect at the current tunnel URL
Dockerfile              standalone build with a /data volume
```

**Where to make changes:** game rules go in `lib/game.ts` and nowhere else. Route handlers only
parse input, call a rule function, and map `GameError` to a 400. `SLICE_PROMPTS.length` drives the
pizza geometry, the completion check, and the copy — changing the number of prompts changes the game
everywhere, correctly.

---

## 5. Data model

```sql
players(id, code UNIQUE, token UNIQUE, name, created_at)
slices (id, player_id → players, idx, answer,
        signer_id → players, signer_name, signed_at,
        UNIQUE(player_id, idx))
settings(key, value)          -- phase, event_name

-- The rule that makes the game work, enforced by the database:
CREATE UNIQUE INDEX ux_slices_one_sign_per_pair
  ON slices(player_id, signer_id) WHERE signer_id IS NOT NULL;
```

`signer_name` is denormalised on purpose: it is a **signature**, a record of who signed at that
moment. If someone later edits their name, the crust should still read what was signed.

### API surface

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/join` | Create a player, set the cookie. Idempotent — returns the existing player if already joined. |
| GET | `/api/me` | Your pizza, phase, join code, and QR data URL. The poll endpoint. |
| POST | `/api/answer` | Save one slice's answer. Rejected once signed. |
| GET | `/api/lookup?code=` | Someone else's slices, with `signable` flags computed for you. |
| POST | `/api/sign` | Sign one slice. Every rule in §1 is checked here. |
| POST | `/api/leave` | Sign this device out without deleting the pizza. |
| POST | `/api/admin/login` | Exchange the passcode for a 12-hour host cookie. |
| GET | `/api/admin/stats` | Metrics, per-player board, last 25 connections. |
| POST | `/api/admin/settings` | Change phase and event name. |
| POST | `/api/admin/raffle` | Draw a winner from completed pizzas. |
| GET | `/api/admin/export` | CSV of every answer and signature. |
| POST | `/api/admin/reset` | Delete everything. Requires `{"confirm":"RESET"}`. |

---

## 6. Setup

### Local — nothing to install but the packages

There is **no database to set up and nothing to host**. SQLite is built into Node, so the app creates
`data/pizza.db` by itself on first use. Requires **Node 24 or newer** (`node:sqlite` is built in from
24; the app will not start on 20/22).

```bash
npm install
npm run dev                    # http://localhost:3000
```

`.env.local` is optional — the passcode defaults to `pizza2026` locally. Create one from
`.env.example` when you want to change it.

### Testing the game by yourself

The game needs other people, which makes solo testing awkward. `npm run seed` solves that by
creating fake players through the real API — same rules, same validation:

```bash
npm run seed                      # 8 players with answers filled, trading opened
npm run seed -- --players 20      # a bigger room
npm run seed -- --sign-for AB3D   # eight fake players sign YOUR pizza
```

A full solo run-through:

1. `npm run dev`, then `npm run seed` in a second terminal. It prints eight join codes.
2. Open `http://localhost:3000`, join as yourself, fill in your eight answers.
3. Tap **Sign someone's slice** and enter one of the seeded codes — that exercises the real signing
   path, including the "you already signed this pizza" rule if you try the same person twice.
4. Copy your own 4-character code off `/play` and run `npm run seed -- --sign-for YOURCODE`. Your
   pizza fills in, the crust shows eight names, and the confetti fires.
5. Open `/admin` (passcode `pizza2026`) to watch the metrics, feed, raffle, and CSV export.

**Gotchas when testing alone:**

- **Signing is locked in the `build` phase.** `npm run seed` opens trading for you; if you skip the
  seed, open `/admin` and tap **Open trading** first. This is the single most common "why isn't it
  working" moment.
- **One browser is one player.** The session is a cookie, so a second tab is still you. For a second
  human player use a different browser (Chrome vs. Safari), a separate Chrome profile, or
  `curl -X POST localhost:3000/api/leave` to drop this device's session and join again.
- **To start over**, either `/admin → Reset the whole event` (type `RESET`), or stop the server and
  `rm -rf data`.

To test on real phones, `npm run dev` prints a `Network:` URL — open that on any phone on the same
wifi. No hosting, no tunnel needed.

### Deploy — free options

The app needs a **persistent disk**, and that is exactly the thing free tiers stopped giving away.
As of 2026: Render's free web services cannot attach a disk (disks are paid-instance only), and
Fly.io and Railway are trial/usage-billed rather than always-free. So "free" means one of these
three, in the order most people should try them.

**1. Your laptop + a Cloudflare quick tunnel — free, no account, best for a one-off event**

```bash
npm run build
ADMIN_PASSCODE=something-secret npm start          # terminal 1
cloudflared tunnel --url http://localhost:3000     # terminal 2 → prints a https://….trycloudflare.com URL
```

Players hit that HTTPS URL over mobile data, so venue wifi stops mattering. The database is
`data/pizza.db` on your own disk. Two things to know: the URL changes every time you restart the
tunnel, so **start the tunnel before generating the poster**, and the laptop must stay awake and
online for the whole lunch (`caffeinate -i` on macOS).

**2. Oracle Cloud Always Free VM — free forever, if you want it to outlive the event**

A real VM with a real disk. Install Node 24+, `git clone`, `npm ci && npm run build`, run it behind
`systemd`. More setup, and free ARM capacity is not always available in every region, but nothing
expires.

**3. Render free web service — free, but the disk is ephemeral**

It deploys in two clicks and will survive an event where nothing restarts, but any redeploy, crash,
or platform move wipes every pizza. If you use it, **download the CSV during the event, not after**.
Paying $7/month for a Starter instance plus a 1 GB disk at $0.25/month removes the risk entirely,
and you can delete the service the same afternoon.

Whatever you pick, set `ADMIN_PASSCODE` and point `DATA_DIR` at the persistent disk.

| Option | How |
| --- | --- |
| **Docker** (VPS, Oracle, anywhere) | `docker build -t pizza . && docker run -p 3000:3000 -v pizza-data:/data -e ADMIN_PASSCODE=... pizza` — the Dockerfile sets `BUILD_STANDALONE=1` for a minimal image |
| **Render / Railway (paid)** | Connect the repo, add a disk mounted at `/data`, set `DATA_DIR=/data` |
| **Laptop on venue wifi** | `npm run build && npm start`, share the `Network:` URL — no tunnel, but everyone must stay on that wifi |

> **Not Vercel.** Serverless filesystems are ephemeral — the SQLite file would vanish between
> requests. If you must use Vercel, replace `lib/db.ts` with a hosted Postgres (Neon/Supabase) or
> Turso; the rest of the app is unaffected because every query is already behind `lib/game.ts`.

### A permanent link for a temporary tunnel

A Cloudflare quick tunnel gets a new hostname every restart, which would mean reprinting the poster.
`docs/` is a GitHub Pages redirect that fixes the entrance: the QR points at the Pages URL forever,
and the Pages page forwards to whatever `docs/target.txt` currently holds.

```bash
npm run link -- https://new-url.trycloudflare.com   # updates docs/target.txt via the GitHub API
```

Pages redeploys in ~30–60 s. `docs/404.html` is a byte-for-byte copy of `docs/index.html` — Pages
serves only files that exist, so without it a deep link like `/sign?code=ABCD` would 404 before any
script ran. If you edit one, copy it to the other. `BASE_PATH` at the top of both files must match
the repo name.

> **This fixes the poster, not the session.** Player cookies are bound to the tunnel's hostname, so
> when the tunnel URL changes *everyone who already joined loses their pizza* and rejoins as a new
> player. The permanent link only helps people scanning after the change. Treat a mid-event tunnel
> restart as a restart of the event.

**Free-tier note:** GitHub Pages only serves public repositories on the free plan. Pages on a private
repo needs GitHub Pro. Either make this repo public, or put `docs/` in a separate public repo and
point `LINK_REPO` at it.

### The QR poster

```bash
PUBLIC_URL=https://yourname.github.io/sc-pizza-icebreaker/ npm run poster
```

Point `PUBLIC_URL` at the **Pages redirect**, not the tunnel — then the poster is printed once and
never goes stale.

Writes `public/poster/index.html` (open and print A4) and `public/poster/join-qr.png` for slides and
table tents. Once deployed it is also live at `/poster/`.

---

## 7. Phases

The host controls the phase from `/admin`. It is the only lever that changes during the event.

| Phase | Join | Fill answers | Sign | Use it for |
| --- | --- | --- | --- | --- |
| **build** *(default)* | ✅ | ✅ | ❌ | Before lunch. Everyone arrives and writes their eight answers, so the trading window is spent talking rather than typing. |
| **trade** | ✅ | ✅ | ✅ | Lunch. The actual game. |
| **closed** | ❌ | ❌ | ❌ | After the raffle. Freezes the results for the CSV export. |

It starts in **build** deliberately: if the app opened in trade, the first ten minutes would be
people signing blank pizzas.

---

## 8. Before the event

**A week out**

- [ ] Deploy, open the URL on a phone, join as a test player.
- [ ] Change `ADMIN_PASSCODE` from the default. Anyone who guesses it can close the game.
- [ ] Generate and print the QR poster — a few A4s around the room, plus a big one at the entrance.
- [ ] Edit the prompts in `lib/prompts.ts` if your crowd needs different ones, and redeploy.

**A day out — rehearsal**

- [ ] Run through with 3–4 people on real phones: join, answer, sign both directions.
- [ ] Confirm the completion confetti fires and the pizza shows eight names.
- [ ] Check `/admin` shows them, then **Reset the whole event** (type `RESET`) so the real event
      starts clean.

**On the morning**

- [ ] Phase is **build**.
- [ ] Posters up around the room, `/admin` open on the host's phone, projector on `/admin` if you
      want a live board.
- [ ] Venue wifi works, or tell people to use mobile data. Test it standing where people will stand,
      not next to the router.

---

## 9. Run of show

| When | Who | What |
| --- | --- | --- |
| **T‑5 min** | Host | "Scan the QR, put in your name." Phase stays **build**. |
| **T‑0** | Host | Explain the game in four sentences: eight slices, find a matching answer, chat, sign each other. Different CG only. Complete pizzas win dessert pizza. |
| **T+2** | Everyone | Fill all eight answers. Host watches "Answers filled" on `/admin` climb toward 8× the player count. |
| **T+7** | Host | Tap **Open trading**. Say both rules out loud: *one signature per person, so eight signatures means eight different people* — and *different CG only*. |
| **T+8 → T+35** | Everyone | Trade. Chat 60 seconds, sign one slice each way. |
| **T+20** | Host | Check **"Nobody signed yet"** on `/admin`. If it's above zero, go find those people and physically introduce them — this is the highest-value thing a host does all lunch. |
| **T+35** | Host | Two-minute warning. |
| **T+38** | Host | Tap **Close game**. |
| **T+40** | Host | **Draw a winner** on the projector. Announce it. Draw again for more prizes. |
| **After** | Host | **Download CSV** — it is the only backup of everyone's answers. |

**Host script for the trading rules** (the part people get wrong):

> "Find someone whose answer matches yours on any slice — same MRT line, same drink, same food.
> That's your connection: talk about it, then sign each other's slice. You need eight signatures
> from eight *different* people, you can't sign your own, and you can only sign each person once —
> so no camping with your best friend. And it has to be someone from a **different CG**."

---

## 10. Customising

**Change the prompts** — edit `lib/prompts.ts`. Each entry has `title`, `prompt`, `hint`, and
optional `quickPicks` (tap-to-fill chips that dramatically speed up the build phase on a phone).

**Change the number of slices** — add or remove entries in `SLICE_PROMPTS`. Everything else follows:
the SVG divides 360° by the count, completion requires that many signatures, and the seed script
asks the server how many there are. Four to eight works visually — past six, `Pizza.tsx` drops the
crust font to 11px and pulls the pepperoni toward each wedge's centre line so nothing spills over the
boundary. Beyond eight the crust names get genuinely cramped. Note that the count is also how many
people each player must meet, so raising it makes the game longer, not just busier.

**Enforce the different-CG rule** — currently copy only. To make it real: add a `cg` column
alongside `name` in `lib/db.ts`, collect it on the join screen, and have `getSignableView` return a
`sameCg` flag that `/sign` shows as a warning. Keep it a warning, not a rejection (see §12).

**Change the look** — everything is CSS custom properties at the top of `app/globals.css`. The
pizza's own colours are in `components/Pizza.tsx`.

**How see-through the cards are** — `--paper-glass` and `--paper-glass-soft` at the top of
`app/globals.css`, plus the gradient on `.card--hero` and the three `.alert--*` colours. Raise the
alpha to hide the pizzas behind cards, lower it to show more. It is alpha on the background, never
the `opacity` property, which would fade the text with it. `--muted` was darkened to `#735c4c` to
hold contrast when secondary text sits over a passing pizza.

**The drifting pizzas** — `FlyingPizzas` renders once in `app/layout.tsx`, so it sits behind every
screen's `.shell`. Paths are a fixed array in `components/ui.tsx` (fixed, not random, so server and
client render the same markup). Remove the one line in the layout to turn it off everywhere, or trim
the array if it stutters on older phones. It hides itself under `prefers-reduced-motion`.

**The logo easter egg** — tapping the 🍕 in the masthead fires a burst of pizza from wherever the
logo is, on every screen. It's `pop()` in `Masthead`; taps stack, and each burst cleans itself up
after 2.2 s.

---

## 11. Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| "Trading hasn't started yet" | Phase is **build**. Open `/admin` → **Open trading**. |
| Someone lost their pizza | The session is per-browser. If they cleared cookies or switched browsers, they get a new pizza — find their old code in `/admin` and have people re-sign, or let them start fresh early on. |
| "No one has that code" | Typo, or they haven't joined. Codes exclude lookalike characters; `G` is auto-corrected to `6`. Have them show the QR instead. |
| Two people can't sign each other | Check they aren't the same person on two devices, and that neither has already signed the other. The error message says which. |
| App won't start, `node:sqlite` error | Node is older than 24. Check with `node -v`. |
| Data vanished after deploy | The host has no persistent disk, or `DATA_DIR` doesn't point at it. |
| Wifi is dying under load | The app polls every 5 s and payloads are small, but venue wifi is venue wifi. Tell people to use mobile data — the app works fine on 4G. |

---

## 12. Conventions for future changes

- **Rules live in `lib/game.ts`.** Route handlers parse input and map errors; they do not decide
  anything. Any new rule should be expressible as a `GameError` with a message a player can act on.
- **Player-facing errors are instructions, not diagnostics.** "Ask them to write it first" beats
  "validation failed on slice.answer".
- **Never block a conversation.** People are standing in front of each other when they tap sign, so
  a new rule that can reject them needs a very good reason and an error that says what to do next.
- **`lib/types.ts` has no server imports** so client components can import from it freely.
- **Assume a crowded, slow network.** Polls fail silently and retry; nothing shows a scary error
  because one request timed out.
- Verify changes with `npm run build` (typechecks as part of the build) and a manual pass through
  join → answer → sign → complete on two browser profiles.
