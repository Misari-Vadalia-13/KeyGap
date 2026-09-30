# KeyGap

A typing test that tracks which keys you get wrong and shows you your weakest ones.



## Why this exists

Most typing tests show a speed number and stop there. KeyGap is built around a different question: **which keys are holding you back?** It measures error rate and speed per key, then reports the ones that need work.

## Features

**Core typing test**
- [ ] Random text with per-character feedback (correct / incorrect / current)
- [ ] Live timer that starts on the first keypress
- [ ] WPM and accuracy (every wrong keystroke counts, even if corrected)
- [ ] Results panel and instant restart

**Weak-key tracker**
- [ ] Per-key attempts, misses, and average keystroke time
- [ ] Weakness ranked by **error rate** (not raw miss count) with a minimum sample size, so common letters like `e` don't dominate
- [ ] Stats saved in the browser between visits

**Leaderboard (PHP + MySQL)**
- [ ] Top 10 scores stored on a server
- [ ] Server-side validation: the server issues the text, receives a keystroke log, and recomputes WPM itself instead of trusting the client

**Planned**
- [ ] Weighted practice text that includes more of your weak keys (about 30-40% targeted words)
- [ ] 60-second mode, difficulty levels, dark mode

## Tech stack

- HTML, CSS, vanilla JavaScript (front end)
- PHP and MySQL (leaderboard, planned)
- GitHub Pages / Netlify for the static front end (hosting for the PHP part is undecided)

## Run locally

No build step for the front end.

```bash
git clone https://github.com/Misari-Vadalia-13/keygap.git
cd keygap
```

Then either open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# visit http://localhost:8000
```

The leaderboard setup (PHP, MySQL, schema) will be documented here once that phase is built.

## How the weak-key score works

1. Every keystroke is recorded against the character that was expected.
2. For each key: `error rate = misses / attempts`.
3. Keys with fewer than about 20 attempts are ignored because there isn't enough data.
4. The remaining keys are ranked by error rate, optionally combined with how slowly you type them.

Known limitation: many mistakes come from letter pairs (like "th" or "ou"), not single keys. Per-key tracking can miss those.

## Anti-cheat: what it does and doesn't do

The browser is untrusted, since anyone can send a fake score directly to the server. The planned approach:

- The server generates the text and a single-use round ID.
- The client sends a keystroke log; the server replays it and computes the score.
- Impossible results (unrealistic speed, mismatched text, robotic timing) are rejected, and submissions are rate limited.

This raises the bar but does **not** stop a script that fakes realistic keystroke timing. It's a learning exercise in never trusting client data, not a tamper-proof system.

## Project plan

The full step-by-step plan is in [`task.md`](task.md).

## Roadmap

1. Basic typing test
2. Deploy
3. Weak-key tracker
4. PHP leaderboard with server-side validation

## License

MIT. Add a `LICENSE` file to the repo root if you keep this.
