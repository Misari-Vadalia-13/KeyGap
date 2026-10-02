# KeyGap

A typing test that finds **which keys slow you down**, not just how fast you type.

> **Status: work in progress.** I'm building this as my first project and learning as I go. The checklist below shows exactly what works today.

## Why I'm building this

Most typing tests give you one number (WPM) and stop. I wanted to know *why* I'm not faster. Which keys do I miss most? Which ones do I hesitate on? KeyGap records every keystroke and shows the weak spots.

## Planned features

**Core typing test**
- [ ] Show text with per-letter feedback (correct / wrong / current)
- [ ] Timer that starts on the first key press
- [ ] WPM and accuracy (every wrong key counts, even if corrected)
- [ ] Restart button

**Weak-key tracking**
- [ ] Record every keystroke (expected key, typed key, time)
- [ ] Per-key attempts and misses
- [ ] Rank weakest keys by error rate (with a minimum number of attempts, so one miss doesn't dominate)
- [ ] Save stats in the browser between visits

**What I want to make different**
- [ ] **Practice with your own text:** paste your code or writing and find your weak keys in what you actually type (symbols like `{ } ( ) ; _` are rarely covered by normal tests)
- [ ] **Recovery cost:** measure how much slower you type right after a mistake
- [ ] Practice text that includes more of your weak keys
- [ ] Keyboard picture with weak keys highlighted

## Tech stack

- HTML, CSS, and vanilla JavaScript
- No framework, no backend, no build step
- All data stays in your browser (`localStorage`). Nothing is sent anywhere.

## Run it locally

```bash
git clone https://github.com/Misari-Vadalia-13/KeyGap.git
cd KeyGap
```

Then open `index.html` in your browser.

Or serve it with a local server:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## How the weak-key score works

1. Every key press is recorded against the key you were *supposed* to press.
2. For each key: `error rate = misses / attempts`.
3. Keys with too few attempts are ignored, because a few samples aren't reliable.
4. The rest are ranked by error rate.

## Known limitations

- Assumes a **QWERTY** keyboard layout.
- Tracking single keys can miss mistakes that come from letter pairs (like "th" or "ou").
- Stats live in your browser, so clearing site data erases them.
- No leaderboard for now. A score board needs a server and anti-cheat checks, which is out of scope for a first version.

## Roadmap

1. Basic typing test
2. Record keystrokes
3. Weak-key stats and saving
4. Custom text practice
5. Recovery cost
6. Deploy (GitHub Pages)

## What I'm learning

This is my first project, so I'm learning JavaScript events, arrays, objects, and `localStorage` while building it. Feedback and suggestions are welcome through Issues.

## License

MIT. Add a `LICENSE` file to the repo root.
