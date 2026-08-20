/**
 * Points the permanent GitHub Pages link at the current tunnel URL.
 *
 *   npm run link -- https://something.trycloudflare.com
 *   npm run link                      # reads the URL from a running cloudflared
 *
 * Writes target.txt in the public link repo through the GitHub API, so there is
 * no second working copy to keep in sync. Needs the `gh` CLI, already
 * authenticated (`gh auth status`).
 *
 * Defaults to this repo's own GitHub remote; override with LINK_REPO.
 */

import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);

/** Defaults to this repo's own GitHub remote, so there is nothing to configure. */
function repoFromGitRemote() {
  try {
    const url = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" }).trim();
    const m = url.match(/github\.com[:/](.+?)(?:\.git)?$/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

const REPO =
  process.env.LINK_REPO ||
  args.find((a) => a.includes("/") && !a.startsWith("http")) ||
  repoFromGitRemote();

function gh(cliArgs, input) {
  return execFileSync("gh", cliArgs, {
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function die(msg) {
  console.error(`\n${msg}\n`);
  process.exit(1);
}

if (!REPO) {
  die(
    "Couldn't work out which GitHub repo to update.\n" +
      "Pass it explicitly:\n" +
      "  npm run link -- yourname/reponame https://xxx.trycloudflare.com",
  );
}

/** Falls back to asking the running cloudflared what URL it got. */
function detectTunnelUrl() {
  try {
    const out = execFileSync("bash", [
      "-lc",
      "ps -Ao args | grep -m1 '[c]loudflared tunnel' >/dev/null && " +
        "curl -s --max-time 3 http://127.0.0.1:20241/metrics | grep -oE 'https://[a-z0-9-]+\\.trycloudflare\\.com' | head -1",
    ]).toString().trim();
    return out || null;
  } catch {
    return null;
  }
}

let url = args.find((a) => a.startsWith("http")) || detectTunnelUrl();
if (!url) {
  die(
    "No URL given and none detected.\n" +
      "Pass it explicitly:\n" +
      "  npm run link -- https://xxx.trycloudflare.com",
  );
}
url = url.replace(/\/+$/, "");

// Read the existing file so we can send its sha (the API needs it to update).
let sha = null;
try {
  const meta = JSON.parse(gh(["api", `repos/${REPO}/contents/docs/target.txt`]));
  sha = meta.sha;
} catch {
  console.log("docs/target.txt doesn't exist yet — creating it.");
}

const body = {
  message: `Point at ${url}`,
  content: Buffer.from(url + "\n", "utf8").toString("base64"),
  ...(sha ? { sha } : {}),
};

try {
  gh(["api", `repos/${REPO}/contents/docs/target.txt`, "-X", "PUT", "--input", "-"], JSON.stringify(body));
} catch (err) {
  die(`Could not update ${REPO} docs/target.txt:\n${err.stderr || err.message}`);
}

const owner = REPO.split("/")[0];
const name = REPO.split("/")[1];
const pagesUrl = name.toLowerCase() === `${owner.toLowerCase()}.github.io`
  ? `https://${owner.toLowerCase()}.github.io/`
  : `https://${owner.toLowerCase()}.github.io/${name}/`;

console.log(`\n✅ ${REPO} docs/target.txt now points at:\n   ${url}`);
console.log(`\nPermanent link (this is what goes on the poster):\n   ${pagesUrl}`);
console.log(`\nGitHub Pages takes ~30–60s to redeploy. Check with:\n   curl -s ${pagesUrl}target.txt\n`);
