/**
 * Fills a local game with fake players so one person can test the whole flow.
 *
 *   npm run seed                      # 8 players, answers filled, trading opened
 *   npm run seed -- --players 20      # a bigger room
 *   npm run seed -- --sign-for AB3D   # the fake players sign YOUR pizza
 *
 * Talks to the running dev server over HTTP, so it exercises the real rules
 * rather than writing to the database behind their back.
 */

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = flag("url", process.env.SEED_URL || "http://localhost:3000").replace(/\/$/, "");
const SIGN_FOR = (flag("sign-for", "") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// Signing needs a fresh player per slice — each may sign a given pizza only
// once — so --sign-for defaults to exactly five rather than a full room.
const DEFAULT_COUNT = SIGN_FOR ? 5 : 8;
const COUNT = args.includes("--players")
  ? Math.max(1, Math.min(60, Number(flag("players", DEFAULT_COUNT)) || DEFAULT_COUNT))
  : DEFAULT_COUNT;
const PASSCODE = process.env.ADMIN_PASSCODE || "pizza2026";

const PEOPLE = [
  ["Priscilla Tan", "1", ["North East 🟣", "Worship — keys", "Kopi C siew dai", "Pineapple = genius 🍍", "Nap 😴"]],
  ["Wei Ming", "1", ["East–West 🟢", "Ushering", "Chicken rice", "McSpicy is mid", "Cafe hopping ☕"]],
  ["Joanne Lim", "2", ["Circle 🟡", "Kids ministry", "Teh peng", "Snooze 5x forever", "Studying 📚"]],
  ["Daniel Ong", "2", ["Downtown 🔵", "Sound crew", "Laksa, every single day", "Pineapple = crime 🚫", "Sports 🏀"]],
  ["Rachel Koh", "3", ["Thomson–East Coast 🟤", "Welcome team", "Milo dinosaur", "Up at first alarm", "Family lunch 🍚"]],
  ["Marcus Chua", "3", ["North–South 🔴", "Youth small group", "Kopi O, no sugar", "McSpicy is mid", "Nap 😴"]],
  ["Hui Shan", "4", ["East–West 🟢", "Photography — the hidden talent is beatboxing", "Bak chor mee", "Pineapple = genius 🍍", "Cafe hopping ☕"]],
  ["Nathanael", "4", ["North East 🟣", "Worship — drums", "Teh halia", "Snooze 5x forever", "Sports 🏀"]],
  ["Cheryl Ng", "5", ["Circle 🟡", "Prayer team", "Kopi peng", "Up at first alarm", "Studying 📚"]],
  ["Isaac Lee", "5", ["Downtown 🔵", "Media", "Wanton mee", "Pineapple = crime 🚫", "Nap 😴"]],
  ["Grace Wong", "6", ["North–South 🔴", "Hospitality", "Teh C kosong", "McSpicy is mid", "Family lunch 🍚"]],
  ["Benjamin Sim", "6", ["East–West 🟢", "Can juggle, badly", "Nasi lemak", "Snooze 5x forever", "Cafe hopping ☕"]],
];

async function call(path, { method = "GET", body, cookie } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  return { ok: res.ok, status: res.status, data, setCookie: res.headers.getSetCookie?.() ?? [] };
}

function playerCookie(setCookie) {
  const raw = setCookie.find((c) => c.startsWith("pizza_player="));
  return raw ? raw.split(";")[0] : null;
}

async function main() {
  // 1. Is the server actually up?
  try {
    await call("/api/me");
  } catch {
    console.error(`Can't reach ${BASE}. Start the server first:\n\n  npm run dev\n`);
    process.exit(1);
  }

  // 2. Open trading, so signatures are allowed.
  const login = await call("/api/admin/login", { method: "POST", body: { passcode: PASSCODE } });
  let adminCookie = null;
  if (login.ok) {
    adminCookie = (login.setCookie.find((c) => c.startsWith("pizza_admin=")) ?? "").split(";")[0] || null;
    await call("/api/admin/settings", {
      method: "POST",
      body: { phase: "trade" },
      cookie: adminCookie,
    });
    console.log("Phase set to TRADE — signing is open.\n");
  } else {
    console.log(
      `Could not log in to /admin (passcode "${PASSCODE}").\n` +
        `Players will still be created, but open trading yourself at ${BASE}/admin.\n`,
    );
  }

  // 3. Create the players and fill in every answer.
  const created = [];
  for (let i = 0; i < COUNT; i++) {
    const [name, table, answers] = PEOPLE[i % PEOPLE.length];
    const label = i < PEOPLE.length ? name : `${name} ${Math.floor(i / PEOPLE.length) + 1}`;

    const join = await call("/api/join", { method: "POST", body: { name: label, tableNo: table } });
    if (!join.ok) {
      console.error(`  ${label}: ${join.data?.error ?? "join failed"}`);
      continue;
    }
    const cookie = playerCookie(join.setCookie);
    for (let idx = 0; idx < answers.length; idx++) {
      await call("/api/answer", { method: "POST", body: { idx, answer: answers[idx] }, cookie });
    }
    created.push({ name: label, table, code: join.data.player.code, cookie });
  }

  console.log(
    SIGN_FOR
      ? `Created ${created.length} signers, all five answers filled:\n`
      : `Created ${created.length} players, all five answers filled:\n`,
  );
  for (const p of created) {
    console.log(`  ${p.code}   ${p.name.padEnd(18)} table ${p.table}`);
  }

  // 4. Optionally have them sign the tester's own pizza.
  if (SIGN_FOR) {
    console.log(`\nSigning ${SIGN_FOR}'s pizza...`);
    const pool = [...created];
    let signed = 0;
    let lastError = null;

    // One slice at a time, walking the pool until someone is eligible — each
    // fake player may only sign this pizza once, same as a real player.
    for (let idx = 0; idx < 5; idx++) {
      if (pool.length === 0) break;
      let done = false;
      for (let k = 0; k < pool.length && !done; k++) {
        const p = pool[k];
        const res = await call("/api/sign", {
          method: "POST",
          body: { code: SIGN_FOR, idx },
          cookie: p.cookie,
        });
        if (res.ok) {
          console.log(`  slice ${idx + 1}  signed by ${p.name}`);
          pool.splice(k, 1);
          signed++;
          done = true;
        } else {
          lastError = res.data?.error ?? `HTTP ${res.status}`;
        }
      }
      if (!done) console.log(`  slice ${idx + 1}  skipped — ${lastError}`);
    }

    console.log(
      signed >= 5
        ? "\nPizza complete. Reload /play to watch the confetti."
        : `\nSigned ${signed} of 5. Fill in the remaining answers on that pizza, then run this again.`,
    );
  } else {
    console.log(
      `\nNext:\n` +
        `  1. Open ${BASE} and join as yourself.\n` +
        `  2. Fill in your five answers.\n` +
        `  3. Tap "Sign someone's slice" and enter one of the codes above.\n` +
        `  4. To fill your own pizza, copy your code and run:\n` +
        `       npm run seed -- --sign-for YOURCODE\n`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
