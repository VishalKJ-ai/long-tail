// Build Long Tail from src/: validates every card, then writes the website and the Claude artifact body.
//   node src/build.js                      -> checks only
//   node src/build.js --site index.html    -> website (full page)
//   node src/build.js --artifact out.html  -> artifact body (no <html> skeleton)
const fs = require("fs");
const path = require("path");
require("./engine.js");
const LT = globalThis.LT;
const SRC = __dirname;
const KEYS = LT.TIERS.map((t) => t.key);
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };

// ---------- load ----------
const dirs = [path.join(SRC, "cards"), ...(arg("--extra") ? arg("--extra").split(",") : [])];
let cards = [];
for (const dir of dirs) {
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    try {
      const arr = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      cards.push(...arr);
    } catch (e) { console.log(`!! ${f}: ${e.message}`); }
  }
}

// ---------- validate and clean ----------
const warn = [];
const ids = new Set();
const clean = [];
const wordsIn = (needle, hay) => {
  const aw = LT.words(needle), tw = LT.words(hay || "");
  if (!aw.length) return false;
  for (let i = 0; i + aw.length <= tw.length; i++) if (aw.every((w, j) => tw[i + j] === w || tw[i + j] === w + "s")) return true;
  return false;
};
for (const p of cards) {
  if (!p || !p.id || !p.q || !p.tiers) { warn.push(`skip malformed ${p && p.id}`); continue; }
  if (ids.has(p.id)) { warn.push(`dup id ${p.id}`); continue; }
  ids.add(p.id);
  const seen = new Map();
  const tiers = {};
  for (const k of KEYS) {
    tiers[k] = [];
    for (const name of p.tiers[k] || []) {
      const n = String(name).trim();
      const kk = LT.key(n);
      if (!kk || seen.has(kk)) continue;
      seen.set(kk, k);
      tiers[k].push(n);
    }
  }
  if (!tiers.head.length && tiers.body.length) tiers.head.push(tiers.body.shift());
  if (!tiers.outlier.length && tiers.deep.length) tiers.outlier.push(tiers.deep.pop());
  const total = KEYS.reduce((a, k) => a + tiers[k].length, 0);
  if (total < 5) { warn.push(`${p.id}: only ${total} answers, dropped`); continue; }
  const canon = new Set(KEYS.flatMap((k) => tiers[k]));
  const alias = {};
  for (const [name, list] of Object.entries(p.alias || {})) {
    if (!canon.has(name)) continue;
    const ok = [];
    for (const a of list || []) {
      const ak = LT.key(a);
      if (!ak || ak === LT.key(name) || seen.has(ak)) continue;
      ok.push(a);
      seen.set(ak, "alias");
    }
    if (ok.length) alias[name] = ok;
  }
  const traps = {};
  for (const [name, why] of Object.entries(p.traps || {})) {
    if (!LT.key(name) || seen.has(LT.key(name))) continue;
    traps[name] = String(why || "");
  }
  if (/^name\b/i.test(p.q)) warn.push(`${p.id}: q starts with "Name"`);
  const o = { id: p.id, cat: p.cat || "", title: p.title || "", q: p.q, rule: p.rule || "", tiers, fact: p.fact || "" };
  if (p.surnames) o.surnames = true;
  if (p.daily === false) o.daily = false;
  o.level = p.level === 1 || p.level === 3 ? p.level : 2;
  if (Object.keys(alias).length) o.alias = alias;
  if (Object.keys(traps).length) o.traps = traps;
  // visible text must never contain an answer
  for (const k of KEYS) for (const a of tiers[k]) for (const form of [a, ...(alias[a] || [])]) {
    for (const f of ["title", "q", "rule"]) if (wordsIn(form, o[f])) warn.push(`GIVEAWAY ${p.id}: ${f} contains "${form}"`);
  }
  clean.push(o);
}
// challenge links identify cards and answers by short hashes
const seenP = new Map();
for (const p of clean) {
  const h = LT.hash36(p.id, 5);
  if (seenP.has(h)) warn.push(`hash collision ${p.id} / ${seenP.get(h)}`);
  seenP.set(h, p.id);
  const seenA = new Map();
  for (const k of KEYS) for (const a of p.tiers[k]) {
    const ha = LT.hash36(a, 4);
    if (seenA.has(ha)) warn.push(`${p.id}: answer hash collision ${a} / ${seenA.get(ha)}`);
    seenA.set(ha, a);
  }
}
const answers = clean.reduce((a, p) => a + KEYS.reduce((b, k) => b + p.tiers[k].length, 0), 0);
const byGroup = {}, byLevel = {};
for (const p of clean) { byGroup[LT.groupOf(p)] = (byGroup[LT.groupOf(p)] || 0) + 1; byLevel[p.level] = (byLevel[p.level] || 0) + 1; }
console.log(`${clean.length} cards, ${answers} answers`, byGroup, "levels", byLevel, "daily pool", LT.dailyPool(clean).length);
if (warn.length) console.log("warnings:\n  " + warn.join("\n  "));
module.exports = { cards: clean };

// ---------- output ----------
const body = () => fs.readFileSync(path.join(SRC, "template.html"), "utf8")
  .replace("/*__ENGINE__*/", () => fs.readFileSync(path.join(SRC, "engine.js"), "utf8"))
  .replace("/*__PROMPTS__*/[]", () => JSON.stringify(clean).replace(/<\//g, "<\\/").split(String.fromCharCode(0x2028)).join("\\u2028").split(String.fromCharCode(0x2029)).join("\\u2029"));

if (arg("--artifact")) {
  fs.writeFileSync(arg("--artifact"), body());
  console.log("artifact ->", arg("--artifact"));
}
if (arg("--site")) {
  const html = body();
  const cut = html.indexOf('<div class="wrap">');
  const head = html.slice(0, cut), rest = html.slice(cut);
  const icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="5" fill="#FF48B0"/><rect x="4" y="5" width="4" height="20" fill="#161412"/><rect x="8.6" y="10" width="4" height="15" fill="#94604F"/><rect x="13.2" y="14" width="4" height="11" fill="#00A95C"/><rect x="17.8" y="17.5" width="3.8" height="7.5" fill="#0078BF"/><rect x="22.2" y="20" width="3.4" height="5" fill="#7A4FCF"/><rect x="26.2" y="22" width="2.8" height="3" fill="#FFE800"/><rect x="3" y="25" width="26.5" height="2" fill="#161412"/></svg>';
  const desc = "Everyone knows the hits. Name the deep cut. A daily rarity game: five categories, one answer each, and the rarer your answer the more it's worth.";
  const site = "https://vishalkj-ai.github.io/long-tail/";
  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="${desc}">
<meta property="og:title" content="Long Tail">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="website">
<meta property="og:url" content="${site}">
<meta property="og:image" content="${site}og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${site}og.jpg">
<meta name="theme-color" content="#161412">
<link rel="apple-touch-icon" href="${site}icon-180.png">
<link rel="manifest" href="${site}manifest.webmanifest">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(icon)}">
<script>
  // Settings. To switch on analytics, put your GoatCounter code (the "xyz" in xyz.goatcounter.com)
  // or your Plausible site domain below. Leave both empty to keep tracking off.
  window.LT_CONFIG = { siteUrl: "https://vishalkj-ai.github.io/long-tail/", goatcounter: "", plausible: "" };
</script>
${head.trim()}
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}</style>
</head>
<body>
${rest.trim()}
</body>
</html>
`;
  fs.writeFileSync(arg("--site"), page);
  console.log("site ->", arg("--site"), Math.round(page.length / 1024), "KB");
}
