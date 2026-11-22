// Generates dark_mode.svg + light_mode.svg — a neofetch-style terminal card with live GitHub stats.
// Usage:  GH_TOKEN=xxx GH_USER=ABHINAVJINDAL26 node scripts/profile-card.mjs
//         node scripts/profile-card.mjs --sample   (offline preview with sample numbers)
import { writeFileSync } from "node:fs";

const USER = process.env.GH_USER || "ABHINAVJINDAL26";
const TOKEN = process.env.GH_TOKEN;
const SAMPLE = process.argv.includes("--sample");

// ─────────────────────────── edit your info here ───────────────────────────
const HANDLE = "abhinav@jindal";
const INFO = [
  ["OS", "Windows 11, Ubuntu, Android"],
  ["Host", "Lovely Professional University"],
  ["Kernel", "B.Tech CSE (Final Year) + Data Science"],
  ["Shell", "Full-Stack · Cloud · GenAI"],
  ["IDE", "VS Code, IntelliJ IDEA, Jupyter"],
  null,
  ["Languages.Programming", "Java, C++, TypeScript, Python"],
  ["Languages.Web", "React, Next.js, Node.js, Tailwind"],
  ["Languages.Real", "English, Hindi"],
  null,
  ["Hobbies.Software", "LLM apps, RAG, Agentic AI"],
  ["Hobbies.Learning", "System Design, Microservices"],
];
const ACHIEVEMENTS = [
  ["Hackathon", "2nd Place — IIT Ropar"],
  ["LeetCode", "400+ solved"],
  ["HackerRank", "5 Star · Problem Solving"],
  ["Oracle", "Java Fnd · OCI AI Fnd"],
];
const CONTACT = [
  ["Email", "jabhinav198@gmail.com"],
  ["LinkedIn", "abhinav-jindal"],
  ["LeetCode", "abhinavjindal"],
];
// ───────────────────────────────────────────────────────────────────────────

async function gql(query, variables = {}) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json", "User-Agent": "profile-card" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function fetchStats() {
  if (SAMPLE) {
    return { repos: 42, contributed: 18, stars: 96, followers: 120, commits: 1534, contribYear: 812, prs: 64, issues: 21, createdAt: "2022-01-15T00:00:00Z" };
  }
  if (!TOKEN) throw new Error("GH_TOKEN is not set");

  const base = await gql(
    `query($login:String!){ user(login:$login){
        createdAt
        followers{ totalCount }
        pullRequests{ totalCount }
        issues{ totalCount }
        repositoriesContributedTo(contributionTypes:[COMMIT,PULL_REQUEST,ISSUE,REPOSITORY]){ totalCount }
        contributionsCollection{ contributionCalendar{ totalContributions } }
    }}`,
    { login: USER }
  );
  const u = base.user;

  // Stars across all owned repos (paginated)
  let stars = 0, repos = 0, after = null;
  do {
    const d = await gql(
      `query($login:String!,$after:String){ user(login:$login){
          repositories(ownerAffiliations:OWNER, first:100, after:$after){
            totalCount pageInfo{ hasNextPage endCursor } nodes{ stargazerCount }
          } } }`,
      { login: USER, after }
    );
    const r = d.user.repositories;
    repos = r.totalCount;
    stars += r.nodes.reduce((s, n) => s + n.stargazerCount, 0);
    after = r.pageInfo.hasNextPage ? r.pageInfo.endCursor : null;
  } while (after);

  // All-time commits: one aliased contributionsCollection per year since account creation
  const startYear = new Date(u.createdAt).getUTCFullYear();
  const nowYear = new Date().getUTCFullYear();
  const parts = [];
  for (let y = startYear; y <= nowYear; y++) {
    parts.push(`y${y}: contributionsCollection(from:"${y}-01-01T00:00:00Z", to:"${y}-12-31T23:59:59Z"){ totalCommitContributions restrictedContributionsCount }`);
  }
  const years = (await gql(`query($login:String!){ user(login:$login){ ${parts.join("\n")} } }`, { login: USER })).user;
  const commits = Object.values(years).reduce((s, c) => s + c.totalCommitContributions + c.restrictedContributionsCount, 0);

  return {
    repos, stars, commits,
    contributed: u.repositoriesContributedTo.totalCount,
    followers: u.followers.totalCount,
    prs: u.pullRequests.totalCount,
    issues: u.issues.totalCount,
    contribYear: u.contributionsCollection.contributionCalendar.totalContributions,
    createdAt: u.createdAt,
  };
}

function age(fromIso) {
  const from = new Date(fromIso), now = new Date();
  let y = now.getUTCFullYear() - from.getUTCFullYear();
  let m = now.getUTCMonth() - from.getUTCMonth();
  let d = now.getUTCDate() - from.getUTCDate();
  if (d < 0) { m--; d += new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)).getUTCDate(); }
  if (m < 0) { y--; m += 12; }
  const p = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  return `${p(y, "year")}, ${p(m, "month")}, ${p(d, "day")}`;
}

// ─────────────────────────── SVG rendering ───────────────────────────
const W = 60; // characters per right-column line
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmt = (n) => Number(n).toLocaleString("en-US");

// A "line" is an array of [cssClass, text] segments
function kv(key, value) {
  const left = `. ${key}:`;
  const dots = Math.max(1, W - left.length - String(value).length - 2);
  return [["cc", ". "], ["key", key], ["cc", ":"], ["cc", " " + ".".repeat(dots) + " "], ["value", value]];
}
function kv2(k1, v1, k2, v2) {
  // two pairs on one line, separated by " | "
  const half = 30;
  const l1 = `. ${k1}:`;
  const d1 = Math.max(1, half - l1.length - String(v1).length - 2);
  const l2 = `${k2}:`;
  const d2 = Math.max(1, W - half - 3 - l2.length - String(v2).length - 2);
  return [["cc", ". "], ["key", k1], ["cc", ":"], ["cc", " " + ".".repeat(d1) + " "], ["value", v1],
          ["cc", " | "], ["key", k2], ["cc", ":"], ["cc", " " + ".".repeat(d2) + " "], ["value", v2]];
}
const header = (title) => [["cc", "- "], ["title", title], ["cc", " " + "—".repeat(Math.max(1, W - title.length - 3))]];
const blank = () => [["cc", ""]];

const ART = [
  [["art", "  █████╗      ██╗"]],
  [["art", " ██╔══██╗     ██║"]],
  [["art", " ███████║     ██║"]],
  [["art", " ██╔══██║██   ██║"]],
  [["art", " ██║  ██║╚█████╔╝"]],
  [["art", " ╚═╝  ╚═╝ ╚════╝ "]],
  blank(),
  [["cc", "┌─────────────────────────┐"]],
  [["cc", "│ "], ["key", "$ "], ["value", "whoami"], ["cc", "                │"]],
  [["cc", "│ "], ["text", "> abhinav jindal"], ["cc", "        │"]],
  [["cc", "│ "], ["key", "$ "], ["value", "cat focus.txt"], ["cc", "         │"]],
  [["cc", "│ "], ["text", "> full-stack + genai"], ["cc", "    │"]],
  [["cc", "│ "], ["key", "$ "], ["value", "./build --future"], ["cc", "      │"]],
  [["cc", "│ "], ["text", "> shipping"], ["cursor", "▌"], ["cc", "             │"]],
  [["cc", "└─────────────────────────┘"]],
  blank(),
  [["cc", "   ~ code with purpose ~"]],
];

function buildRight(s) {
  const updated = new Date().toISOString().slice(0, 10);
  return [
    [["title", HANDLE], ["cc", " " + "—".repeat(W - HANDLE.length - 1)]],
    ...INFO.map((r) => (r ? kv(...r) : blank())),
    kv("Uptime", age(s.createdAt)),
    blank(),
    header("Achievements"),
    ...ACHIEVEMENTS.map((r) => kv(...r)),
    blank(),
    header("Contact"),
    ...CONTACT.map((r) => kv(...r)),
    blank(),
    header("GitHub Stats"),
    kv2("Repos", fmt(s.repos), "Contributed", fmt(s.contributed)),
    kv2("Stars", fmt(s.stars), "Followers", fmt(s.followers)),
    kv2("Commits", fmt(s.commits), "Pull Requests", fmt(s.prs)),
    kv2("Issues", fmt(s.issues), "Contrib (1y)", fmt(s.contribYear)),
    [["cc", ". "], ["cc", `last sync: ${updated} (auto-updated daily)`]],
  ];
}

const THEMES = {
  dark:  { bg: "#0d1117", border: "#30363d", text: "#c9d1d9", key: "#ffa657", value: "#a5d6ff", cc: "#616e7f", title: "#d2a8ff", art: "#a78bfa", bar: "#161b22" },
  light: { bg: "#f6f8fa", border: "#d0d7de", text: "#24292f", key: "#953800", value: "#0a3069", cc: "#8c959f", title: "#8250df", art: "#6639ba", bar: "#eaeef2" },
};

function renderLine(segs, x, y, extra = "") {
  const spans = segs.map(([c, t]) => `<tspan class="${c}">${esc(t)}</tspan>`).join("");
  return `<text x="${x}" y="${y}"${extra}>${spans}</text>`;
}

function render(theme, s) {
  const t = THEMES[theme];
  const right = buildRight(s);
  const LH = 20, TOP = 62, BAR = 34;
  const H = TOP + Math.max(right.length, ART.length) * LH + 18;
  const Wpx = 985;
  const ALH = 18; // tighter line height so block letters touch
  const artRows = ART.filter((l) => l[0][0] === "art").length;
  const artHeight = artRows * ALH + (ART.length - artRows) * LH;
  const artTop = TOP + Math.round((right.length * LH - artHeight) / 2);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${Wpx}" height="${H}" viewBox="0 0 ${Wpx} ${H}" font-family="ConsolasFallback,Consolas,'SFMono-Regular','Liberation Mono',Menlo,monospace" font-size="16px">
<style>
  text { white-space: pre; fill: ${t.text}; }
  .key { fill: ${t.key}; } .value { fill: ${t.value}; } .cc { fill: ${t.cc}; }
  .title { fill: ${t.title}; font-weight: bold; } .art { fill: ${t.art}; } .text { fill: ${t.text}; }
  .cursor { fill: ${t.value}; animation: blink 1s step-end infinite; }
  @keyframes blink { 50% { opacity: 0; } }
</style>
<rect x="0.5" y="0.5" width="${Wpx - 1}" height="${H - 1}" rx="12" fill="${t.bg}" stroke="${t.border}"/>
<path d="M0.5 12.5 a12 12 0 0 1 12 -12 h${Wpx - 25} a12 12 0 0 1 12 12 v${BAR - 12} h-${Wpx - 1} z" fill="${t.bar}"/>
<line x1="0.5" y1="${BAR + 0.5}" x2="${Wpx - 0.5}" y2="${BAR + 0.5}" stroke="${t.border}"/>
<circle cx="22" cy="17.5" r="6" fill="#ff5f57"/><circle cx="42" cy="17.5" r="6" fill="#febc2e"/><circle cx="62" cy="17.5" r="6" fill="#28c840"/>
<text x="${Wpx / 2}" y="22" text-anchor="middle" font-size="13px" class="cc">${esc(HANDLE)}: ~ — neofetch</text>
${(() => {
  // block-letter rows use a tighter step + bigger font so the blocks join up
  let y = artTop;
  return ART.map((l) => {
    const isArt = l[0][0] === "art";
    const out = renderLine(l, 60, y, isArt ? ' font-size="18px"' : "");
    y += isArt ? ALH : LH;
    return out;
  }).join("\n");
})()}
${right.map((l, i) => renderLine(l, 375, TOP + i * LH)).join("\n")}
</svg>
`;
}

const stats = await fetchStats();
writeFileSync("dark_mode.svg", render("dark", stats));
writeFileSync("light_mode.svg", render("light", stats));
console.log("Wrote dark_mode.svg + light_mode.svg", stats);
