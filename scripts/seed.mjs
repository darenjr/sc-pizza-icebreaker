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
// once — so --sign-for creates exactly one signer per slice. The real count
// comes off the server below; this is just the starting guess.
const DEFAULT_COUNT = SIGN_FOR ? 8 : 8;
const COUNT = args.includes("--players")
  ? Math.max(1, Math.min(60, Number(flag("players", DEFAULT_COUNT)) || DEFAULT_COUNT))
  : DEFAULT_COUNT;
const PASSCODE = process.env.ADMIN_PASSCODE || "pizza2026";

// Answers are in slice order: MRT, drink, hobby, smile, grateful, food,
// joined, new building. Overlaps are deliberate — players are meant to find
// someone with the *same* answer, so the seed data has to contain matches.
const PEOPLE = [
  ["Priscilla Tan", ["North East 🟣", "Coffee ☕", "Music 🎸", "My cat sat on my laptop", "The worship team", "Chicken rice", "2019, at Singpost", "The new cafe"]],
  ["Wei Ming", ["East–West 🟢", "Tea 🍵", "Sports 🏀", "Finally cleared my inbox", "My CG leader", "Laksa", "2015, at IM", "More room for youth"]],
  ["Joanne Lim", ["Circle 🟡", "Matcha 🍡", "Baking 🧁", "My nephew called me auntie", "Kids ministry", "Pizza 🍕", "2021, at Dhoby Ghaut", "The natural light"]],
  ["Daniel Ong", ["Downtown 🔵", "Coffee ☕", "Gaming 🎮", "Beat my brother at FIFA", "The sound crew", "Bak chor mee", "2018, at Singpost", "Proper sound system"]],
  ["Rachel Koh", ["Thomson–East Coast 🟤", "Water 💧", "Reading 📚", "A stranger held the lift", "The welcome team", "Korean BBQ", "2020, at Dhoby Ghaut", "Somewhere to linger after service"]],
  ["Marcus Chua", ["North–South 🔴", "Coffee ☕", "Sports 🏀", "Sunday lunch with my CG", "My small group", "Chicken rice", "2016, at IM", "The basketball court"]],
  ["Hui Shan", ["East–West 🟢", "Matcha 🍡", "Photography 📷", "Golden hour on the way home", "Being prayed for", "Nasi lemak", "2022, at Dhoby Ghaut", "Better lighting for photos"]],
  ["Nathanael", ["North East 🟣", "Tea 🍵", "Music 🎸", "Nailed a drum fill", "The worship team", "Pizza 🍕", "2017, at Singpost", "A real green room"]],
  ["Cheryl Ng", ["Circle 🟡", "Water 💧", "Reading 📚", "Finished a book in one sitting", "The prayer team", "Laksa", "2019, at Singpost", "A quiet prayer room"]],
  ["Isaac Lee", ["Downtown 🔵", "Coffee ☕", "Gaming 🎮", "My team shipped on time", "The media team", "Korean BBQ", "2023, at Dhoby Ghaut", "The bigger screens"]],
  ["Grace Wong", ["North–South 🔴", "Tea 🍵", "Baking 🧁", "My sourdough finally rose", "Hospitality", "Chicken rice", "2014, at IM", "A proper kitchen"]],
  ["Benjamin Sim", ["East–West 🟢", "Matcha 🍡", "Photography 📷", "Found $10 in an old jacket", "My CG", "Bak chor mee", "2021, at Dhoby Ghaut", "More parking honestly"]],
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
  let sliceCount = null;
  for (let i = 0; i < COUNT; i++) {
    const [name, answers] = PEOPLE[i % PEOPLE.length];
    const label = i < PEOPLE.length ? name : `${name} ${Math.floor(i / PEOPLE.length) + 1}`;

    const join = await call("/api/join", { method: "POST", body: { name: label } });
    if (!join.ok) {
      console.error(`  ${label}: ${join.data?.error ?? "join failed"}`);
      continue;
    }
    const cookie = playerCookie(join.setCookie);

    // The server owns the slice count, so ask it once rather than hardcoding.
    if (sliceCount === null) {
      const me = await call("/api/me", { cookie });
      sliceCount = me.data?.slices?.length ?? answers.length;
    }

    for (let idx = 0; idx < sliceCount; idx++) {
      const answer = answers[idx % answers.length];
      await call("/api/answer", { method: "POST", body: { idx, answer }, cookie });
    }
    created.push({ name: label, code: join.data.player.code, cookie });
  }

  console.log(
    SIGN_FOR
      ? `Created ${created.length} signers, all ${sliceCount} answers filled:\n`
      : `Created ${created.length} players, all ${sliceCount} answers filled:\n`,
  );
  for (const p of created) {
    console.log(`  ${p.code}   ${p.name}`);
  }

  // 4. Optionally have them sign the tester's own pizza.
  if (SIGN_FOR) {
    console.log(`\nSigning ${SIGN_FOR}'s pizza...`);
    const pool = [...created];
    let signed = 0;
    let lastError = null;

    // One slice at a time, walking the pool until someone is eligible — each
    // fake player may only sign this pizza once, same as a real player.
    for (let idx = 0; idx < sliceCount; idx++) {
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
      signed >= sliceCount
        ? "\nPizza complete. Reload /play to watch the confetti."
        : `\nSigned ${signed} of ${sliceCount}. Fill in the remaining answers on that pizza, then run this again.`,
    );
  } else {
    console.log(
      `\nNext:\n` +
        `  1. Open ${BASE} and join as yourself.\n` +
        `  2. Fill in your eight answers.\n` +
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
