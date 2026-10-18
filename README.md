# Long Tail

Everyone knows the hits. Name the deep cut. A daily rarity game: nine categories, one answer each, 30 seconds a card. Obvious answers score 10, deep cuts score up to 100. Finish with a rank from Parrot to Unicorn and a spoiler-free share line that doubles as a challenge link.

Play: https://vishalkj-ai.github.io/long-tail/

## How it plays
- Nine cards a day in three rows that get harder, the same for everyone, new at midnight UTC. Each day's nine come from nine different themes.
- The first right answer locks in. Wrong guesses cost 3 seconds. Close spellings get a "did you mean" check.
- Record-shop theme, plain Wordle-style UI. Tiers: Chart hit 10, Overplayed 15, Album track 25, B-side 50, Deep cut 75, Holy grail 100.
- Daily ranks by average points per card: Parrot, Sheep, Fox, Badger, Owl, Bat, Unicorn.
- Share: `Long Tail No. 11 🐺 Lone Wolf / 260/500 🟪⬜🟦🟩🟧 / Beat me: <link>`. The share is a 3x3 grid. The link makes friends play the same nine; everyone who plays from it and shares again joins the link, so a group chat builds a leaderboard with "who said what" for every card.
- Past puzzles: play any earlier day (no effect on streak or stats).
- Streak freezes (earn one per 7-day streak) and milestones; a secret Double Track card each day; a lifetime crate and taste profile; friends remembered from boards; a daily goal.
- Practice mode after the daily: one 45-second clock, rarer answers add more time.

## Source
- `src/cards/*.json`: the card bank (only cards with 40+ answers go into the daily rotation).
- `src/engine.js`: matching (typos, surnames, aliases, traps), daily selection, ranks.
- `src/template.html`: the game.
- `node src/test.js`: checks every answer, alias and trap matches as expected.
- `node src/build.js --site index.html`: builds the site. `--site beta/index.html` builds the staging copy.

## Analytics
Off by default. In `src/build.js`, set `goatcounter` (your GoatCounter code) or `plausible` (your Plausible domain) in `window.LT_CONFIG`. Events: start, resume, finish, share, practice, challenge_open. No personal data is sent.
