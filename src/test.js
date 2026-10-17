// Matching tests over the whole bank: every answer and alias matches itself exactly,
// every trap is recognised as a trap, and typos of real answers in OTHER cards don't sneak in.
//   node src/test.js [--extra dir1,dir2]
const { cards } = require("./build.js");
const LT = globalThis.LT;
LT.setLexicon(new Set(cards.flatMap((p) => LT.TIERS.flatMap((t) => p.tiers[t.key]).flatMap((n) => [n, ...((p.alias && p.alias[n]) || [])])).map(LT.key)));
let bad = 0, n = 0, nt = 0;
for (const p of cards) {
  const ix = LT.buildIndex(p);
  for (const t of LT.TIERS) for (const name of p.tiers[t.key]) {
    for (const form of [name, ...((p.alias && p.alias[name]) || [])]) {
      n++;
      const m = LT.match(ix, form);
      if (!m || m.status !== "exact" || m.entry.name !== name) { bad++; console.log(`  ${p.id}: "${form}" -> ${m ? m.status + " " + (m.entry ? m.entry.name : m.options.map((e) => e.name).join("/")) : "REJECT"}`); }
    }
  }
  for (const t of Object.keys(p.traps || {})) {
    nt++;
    const m = LT.match(ix, t);
    if (!m || m.status !== "trap") { bad++; console.log(`  ${p.id}: trap "${t}" -> ${m ? m.status : "null"}`); }
  }
}
console.log(`${n} answers/aliases and ${nt} traps checked, ${bad} problems`);
process.exitCode = bad ? 1 : 0;
