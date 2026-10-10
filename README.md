# Long Tail

A daily rarity trivia game played as trading cards. Seven prompt cards a day: call your shot (Safe, Bold or All-in), flip the card, and name any correct answer in 25 seconds. Rarer answers score more.

Play: https://vishalkj-ai.github.io/long-tail/

## Features
- Daily draw of seven cards, the same for everyone, new at midnight UTC
- Call your shot: ×1 for any answer, ×2 for Rare or rarer, ×3 for Epic or rarer
- Traps that explain common wrong answers
- Challenge links: share your score and a friend plays the same seven cards against you
- A binder that collects every answer you find, plus Hunt and Endless modes

Everything runs in one static `index.html`. Progress is stored in the player's browser.

## Analytics
Off by default. Open `index.html`, find `window.LT_CONFIG` near the top, and set `goatcounter` (your GoatCounter code) or `plausible` (your Plausible domain). Events tracked: daily_start, daily_complete, archive_start, challenge_open, challenge_start, challenge_complete, share_click, return_visit, endless_start, hunt_start, tutorial_complete. No personal data is sent.
