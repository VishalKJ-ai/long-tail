(function (root) {
  "use strict";

  // Rarity tiers. weight = estimated share of players, used only to draw the curve.
  const TIERS = [
    { key: "head",    pts: 10,  name: "Chart hit",  weight: 100, bonus: 3,  sq: "⬜", sym: "●" },
    { key: "hipster", pts: 15,  name: "Overplayed", weight: 58,  bonus: 3,  sq: "🟫", sym: "◑" },
    { key: "body",    pts: 25,  name: "Album track", weight: 30,  bonus: 5,  sq: "🟩", sym: "◆" },
    { key: "tail",    pts: 50,  name: "B-side",     weight: 11,  bonus: 7,  sq: "🟦", sym: "★" },
    { key: "deep",    pts: 75,  name: "Deep cut",   weight: 3.6, bonus: 9,  sq: "🟪", sym: "✦" },
    { key: "outlier", pts: 100, name: "Holy grail", weight: 1.1, bonus: 12, sq: "🟨", sym: "✹" },
  ];
  const TIER = Object.fromEntries(TIERS.map((t) => [t.key, t]));
  const MISS_SQ = "⬛";

  const GROUPS = {
    geo: "Geography", sci: "Science", cul: "Culture", spo: "Sport", his: "History",
  };
  const groupOf = (p) => String(p.id).split("-")[0];

  // ---------- normalisation ----------
  const ROM = [[10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
  function roman(n) {
    let s = "";
    for (const [v, r] of ROM) while (n >= v) { s += r; n -= v; }
    return s;
  }
  const ORDINALS = {
    first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8,
    ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14,
    fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18,
  };

  function words(s) {
    s = String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
    s = s
      .replace(/ß/g, "ss").replace(/æ/g, "ae").replace(/œ/g, "oe").replace(/ø/g, "o")
      .replace(/ł/g, "l").replace(/đ/g, "d").replace(/ı/g, "i").replace(/þ/g, "th")
      .replace(/&/g, " and ").replace(/\+/g, " plus ")
      .replace(/['’‘`´ʻ]/g, "")
      .replace(/(\d)(st|nd|rd|th)\b/g, "$1")
      .replace(/[^a-z0-9#]+/g, " ").trim();
    let w = s.split(" ").filter(Boolean);
    // "Henry the Eighth" -> "henry viii"; "Henry 8" / "Henry 8th" -> "henry viii"
    w = w.map((t) => (ORDINALS[t] ? roman(ORDINALS[t]) : t));
    w = w.map((t) => (/^\d+$/.test(t) && +t > 0 && +t < 40 ? roman(+t) : t));
    const out = [];
    for (let i = 0; i < w.length; i++) {
      if (w[i] === "the" && i + 1 < w.length && /^[ivx]+$/.test(w[i + 1]) && i > 0) continue;
      out.push(w[i]);
    }
    if (out.length > 1 && out[0] === "the") out.shift();
    return out;
  }
  const key = (s) => words(s).join("");

  function variants(k) {
    const v = [k];
    if (k.length > 3 && k.endsWith("s")) v.push(k.slice(0, -1));
    // "-es" only where English plurals use it (boxes, churches, heroes), so "mares" never becomes "mar"
    if (k.length > 4 && /(s|x|z|ch|sh|o)es$/.test(k)) v.push(k.slice(0, -2));
    return v;
  }

  // ---------- index ----------
  const PARTICLES = new Set(["van", "von", "de", "da", "di", "du", "del", "der", "le", "la", "dos", "das", "mac", "st", "ter", "ten", "lloyd"]);
  const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv"]);

  function buildIndex(p, learned) {
    const entries = [];
    for (const t of TIERS) {
      for (const name of (p.tiers && p.tiers[t.key]) || []) {
        entries.push({ name, tier: t.key, pts: t.pts });
      }
    }
    for (const x of learned || []) {
      if (TIER[x.tier]) entries.push({ name: x.name, tier: x.tier, pts: TIER[x.tier].pts, learned: true });
    }
    const map = new Map(); // key -> [{entry, strength}]
    const add = (k, e, strength) => {
      if (!k) return;
      for (const v of strength >= 2 ? variants(k) : [k]) {
        const s = v === k ? strength : strength - 0.25;
        const list = map.get(v) || [];
        const existing = list.find((x) => x.e === e);
        if (existing) existing.s = Math.max(existing.s, s);
        else list.push({ e, s });
        map.set(v, list);
      }
    };
    const aliases = p.alias || {};
    for (const e of entries) {
      add(key(e.name), e, 3);
      // "Lyndon Johnson", "Chester Arthur": the name without middle initials
      const wn = words(e.name);
      const bare = wn.filter((t, i) => i === 0 || i === wn.length - 1 || t.length > 1);
      if (bare.length < wn.length) add(bare.join(""), e, 2.5);
      for (const a of aliases[e.name] || []) add(key(a), e, 2);
      if (p.surnames) {
        const w = words(e.name).filter((t) => !SUFFIXES.has(t));
        if (w.length >= 2) {
          add(w[w.length - 1], e, 1);
          if (w.length >= 3 && PARTICLES.has(w[w.length - 2])) add(w[w.length - 2] + w[w.length - 1], e, 1.5);
        }
      }
    }
    // tempting wrong answers, each with a reason
    const traps = new Map();
    for (const [name, why] of Object.entries(p.traps || {})) {
      const t = { name, why };
      for (const v of variants(key(name))) if (!map.has(v)) traps.set(v, t);
      // "UK" for United Kingdom
      const ini = words(name).filter((w) => !["of", "the", "and"].includes(w)).map((w) => w[0]).join("");
      if (ini.length >= 2 && words(name).length >= 2 && !map.has(ini)) traps.set(ini, t);
      if (p.surnames) {
        const w = words(name);
        if (w.length >= 2 && !map.has(w[w.length - 1])) traps.set(w[w.length - 1], t);
      }
    }
    return { entries, map, traps, surnames: !!p.surnames };
  }

  // Optimal string alignment distance: insert, delete, substitute, or swap two adjacent letters.
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let pp = null;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let rowMin = i;
      for (let j = 1; j <= b.length; j++) {
        let c = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (pp && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) c = Math.min(c, pp[j - 2] + 1);
        cur.push(c);
        if (c < rowMin) rowMin = c;
      }
      if (rowMin > max) return max + 1;
      pp = prev;
      prev = cur;
    }
    return prev[b.length];
  }

  // Sequel numbers and regnal numbers must match exactly; typo tolerance never bridges "Cars 2" and "Cars 3".
  const numSig = (s) => words(s).filter((t) => /^[ivx]+$/.test(t) || /^\d+$/.test(t)).join(",");

  // Every answer and alias in the whole bank. An input that exactly names something real elsewhere
  // ("Iceland", "Boris Johnson") never gets typo or surname leniency here.
  let LEX = null;
  const setLexicon = (set) => { LEX = set; };

  const commonest = (list) => list.slice().sort((x, y) => x.e.pts - y.e.pts || y.s - x.s)[0];

  // Returns null, or {status, entry, options}:
  //   "exact"     accept now
  //   "suggest"   a near miss (typo or nickname): ask "Did you mean <entry>?"
  //   "ambiguous" a surname shared by several answers (options): ask for a first name
  //   "trap"      a known wrong answer, with the reason (trap)
  function match(index, input) {
    const k = key(input);
    if (!k) return null;
    let best = [];
    let bestS = -1;
    for (const v of variants(k)) {
      for (const c of index.map.get(v) || []) {
        const s = v === k ? c.s : c.s - 0.25;
        if (s > bestS) { best = [{ e: c.e, s }]; bestS = s; }
        else if (s === bestS && !best.some((b) => b.e === c.e)) best.push({ e: c.e, s });
      }
    }
    if (best.length) {
      if (best.length > 1) {
        // a bare surname goes to the famous one ("Mozart", "Bach") when exactly one is far commoner than the rest
        const byPts = best.slice().sort((x, y) => x.e.pts - y.e.pts);
        if (bestS <= 1.5 && byPts[0].e.pts < byPts[1].e.pts && byPts[0].e.pts <= 25) return { status: "exact", entry: byPts[0].e, options: [] };
        return { status: "ambiguous", entry: null, options: best.map((b) => b.e) };
      }
      return { status: "exact", entry: commonest(best).e, options: [] };
    }
    for (const v of variants(k)) {
      const t = index.traps && index.traps.get(v);
      if (t) return { status: "trap", entry: null, options: [], trap: t };
    }
    if (LEX && LEX.has(k)) return null;
    // "Abe Lincoln": a nickname in front of a known surname (first initial must agree)
    if (index.surnames) {
      const w = words(input);
      if (w.length >= 2) {
        const hits = (index.map.get(w[w.length - 1]) || []).filter((c) => c.s <= 1 && words(c.e.name)[0][0] === w[0][0]);
        if (hits.length) return { status: "suggest", entry: commonest(hits).e, options: [] };
      }
    }
    // typo tolerance, scaled by length; the player confirms before it counts
    const max = k.length >= 13 ? 3 : k.length >= 8 ? 2 : k.length >= 4 ? 1 : 0;
    if (!max) return null;
    const sig = numSig(input);
    let bestD = max + 1;
    let cands = [];
    for (const [mk, list] of index.map) {
      if (mk.length < 4 || mk[0] !== k[0]) continue;
      const d = lev(k, mk, max);
      if (d > max) continue;
      // surname-only keys take typos only when they're long enough to be distinctive
      const strong = list.filter((c) => (c.s >= 1.5 || mk.length >= 6) && numSig(c.e.name) === sig);
      if (!strong.length) continue;
      if (d < bestD) { bestD = d; cands = strong.slice(); }
      else if (d === bestD) for (const c of strong) if (!cands.some((x) => x.e === c.e)) cands.push(c);
    }
    if (!cands.length) return null;
    return { status: "suggest", entry: commonest(cands).e, options: [] };
  }

  // ---------- seeded selection ----------
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, r) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  // Daily cards come from broad cards with a real long tail (40+ answers). Cards of one family
  // (food, music, places...) are spread evenly through each cycle so a day rarely repeats a theme.
  const family = (p) => String(p.id).split("-").slice(0, 2).join("-");
  const size = (p) => TIERS.reduce((a, t) => a + ((p.tiers && p.tiers[t.key]) || []).length, 0);
  const levelOf = (p) => (p.level === 1 || p.level === 3 ? p.level : 2);
  const dailyPool = (prompts) => prompts.filter((p) => !p.curveball && p.daily !== false && levelOf(p) < 3 && size(p) >= 40);
  // Curveballs are lateral-thinking categories ("both a fruit and a colour"); one closes each day as the hidden track.
  const curvePool = (prompts) => prompts.filter((p) => p.curveball && size(p) >= 15);
  function cycleOrder(pool, cycle) {
    const r = rng(0x9e3779b1 ^ (cycle * 7919 + 17));
    const fams = {};
    for (const p of pool) (fams[family(p)] = fams[family(p)] || []).push(p);
    const keyed = [];
    for (const f of Object.keys(fams).sort()) {
      const list = shuffle(fams[f].sort((a, b) => (a.id < b.id ? -1 : 1)), r);
      const off = r();
      list.forEach((p, i) => keyed.push([p, (i + off) / list.length]));
    }
    return keyed.sort((a, b) => a[1] - b[1]).map((x) => x[0]);
  }
  // Each cycle is dealt into hands of n with no theme twice in a hand; leftovers wait for the next cycle.
  const handCache = {};
  function hands(pool, c, n) {
    const k = c + ":" + n + ":" + pool.length;
    if (handCache[k]) return handCache[k];
    const queue = cycleOrder(pool, c);
    const out = [];
    while (queue.length >= n) {
      const hand = [], fams = new Set();
      while (hand.length < n) {
        let j = queue.findIndex((p) => !fams.has(family(p)));
        if (j < 0) j = 0;
        const [p] = queue.splice(j, 1);
        hand.push(p); fams.add(family(p));
      }
      out.push(hand);
    }
    return (handCache[k] = out);
  }
  // Day d's hand, easiest and broadest first.
  function dailySet(prompts, day, n) {
    n = n || 9;
    const curves = curvePool(prompts).sort((x, y) => (x.id < y.id ? -1 : 1));
    const reg = n - (curves.length ? 1 : 0);
    const pool = dailyPool(prompts);
    let hand = pool.slice(0, reg);
    if (pool.length >= reg) {
      const per = Math.floor(pool.length / reg);
      hand = hands(pool, Math.floor(day / per), reg)[day % per];
    }
    hand = hand.slice().sort((a, b) => levelOf(a) - levelOf(b) || size(b) - size(a));
    if (curves.length) {
      const cycle = Math.floor(day / curves.length);
      hand.push(shuffle(curves, rng(0x5eed + cycle * 977))[day % curves.length]);
    }
    return hand;
  }
  // Endless and other shuffles: easier cards tend to come first, with some randomness.
  const rampShuffle = (prompts, r) => prompts.map((p) => [p, levelOf(p) + r() * 1.8]).sort((a, b) => a[1] - b[1]).map((x) => x[0]);

  // ---------- curve data ----------
  // Every accepted answer, most common first, with an estimated share for drawing.
  function curve(p) {
    const out = [];
    for (const t of TIERS) {
      const list = (p.tiers && p.tiers[t.key]) || [];
      const next = TIERS[TIERS.indexOf(t) + 1];
      const floor = next ? next.weight : t.weight * 0.6;
      list.forEach((name, i) => {
        const f = list.length > 1 ? i / (list.length - 1) : 0;
        out.push({ name, tier: t.key, w: t.weight - (t.weight - floor) * 0.55 * f });
      });
    }
    return out;
  }

  // Short stable hash (FNV-1a, base 36) for challenge links: prompt ids and answer names.
  function hash36(str, len) {
    let h = 2166136261;
    for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
    let h2 = h ^ 0x9e3779b9;
    for (const ch of String(str)) { h2 ^= ch.codePointAt(0); h2 = Math.imul(h2, 2246822519) >>> 0; }
    return (h.toString(36) + h2.toString(36)).padStart(len, "0").slice(-len);
  }

  // Daily ranks by average points per card, so they scale with the number of cards in a day.
  const RANKS = [
    { per: 82, name: "Unicorn", emoji: "🦄", tag: "Nobody else would." },
    { per: 66, name: "Bat",     emoji: "🦇", tag: "You hear what others can't." },
    { per: 52, name: "Owl",     emoji: "🦉", tag: "Up late with the B-sides." },
    { per: 40, name: "Badger",  emoji: "🦡", tag: "You dug up some good ones." },
    { per: 28, name: "Fox",     emoji: "🦊", tag: "A few crafty picks." },
    { per: 16, name: "Sheep",   emoji: "🐑", tag: "You followed the flock." },
    { per: 0,  name: "Parrot",  emoji: "🦜", tag: "You repeated the hits." },
  ];
  const rankMin = (r, n) => Math.round((r.per * (n || 9)) / 10) * 10;
  const rank = (score, n) => RANKS.find((r) => score >= rankMin(r, n));

  root.LT = { levelOf, rampShuffle, hash36, setLexicon, TIERS, TIER, MISS_SQ, GROUPS, groupOf, family, size, words, key, buildIndex, match, rng, shuffle, dailyPool, curvePool, dailySet, curve, RANKS, rank, rankMin };
})(typeof window !== "undefined" ? window : globalThis);

