# 🍕 Know Your Slice

A phone-first icebreaker for ~60 people. Scan a QR, fill in eight pizza slices, find people who
answered the same as you, and get eight different people to sign one slice each. A full pizza means
eight real conversations.

No database to set up and nothing to host — SQLite is built into Node.

```bash
npm install          # needs Node 24+
npm run dev          # http://localhost:3000
npm run seed         # fake players to test against, in a second terminal
```

Then join at `http://localhost:3000`, and open `/admin` (passcode `pizza2026`) to run the game.
To fill your own pizza, copy your 4-character code and run `npm run seed -- --sign-for YOURCODE`.

**[CLAUDE.md](./CLAUDE.md) is the full brief** — game rules, architecture, deployment, the pre-event
checklist, and the run of show for the day.
