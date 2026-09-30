# KeyGap: Task Plan

**KeyGap** is a typing trainer that finds the keys you fumble and drills them.

Rule: finish each phase before starting the next. Add one feature at a time. Commit to Git after every working step.

**Stack:** HTML, CSS, JavaScript (front end). PHP + MySQL (Phase 5 only).

---

## Phase 1: Basic version (must fully work before anything else)

### Step 1: Page layout
- [ ] Create `index.html`, `style.css`, `script.js`
- [ ] Add: text display area, input field (or key capture), timer, WPM, accuracy, Restart button
- [ ] Style with a monospace font and readable spacing

**Done when:** page loads with no console errors and looks usable on desktop and phone.

### Step 2: Display the text and read input
- [ ] Hardcode an array of 10+ sentences; pick one at random
- [ ] Render each character in its own `<span>`
- [ ] On each keypress, compare to the expected character
- [ ] Mark spans `correct` or `incorrect`; highlight the current character
- [ ] Handle Backspace correctly

**Done when:** you can type a full sentence and every character is coloured right, including after corrections.

### Step 3: Timer, WPM, accuracy
- [ ] Start the timer on the **first keypress**, not on page load
- [ ] Stop when the last character is typed
- [ ] WPM = (correct characters ÷ 5) ÷ minutes elapsed
- [ ] Accuracy = correct keystrokes ÷ total keystrokes × 100
- [ ] Count every wrong keystroke even if later corrected (otherwise accuracy is inflated)

**Done when:** typing the same sentence slowly and quickly gives clearly different WPM, and deliberate mistakes lower accuracy.

### Step 4: Results and restart
- [ ] Show a results panel: WPM, accuracy, time
- [ ] Restart button resets all state (timer, counters, spans, input)
- [ ] Pressing Tab/Enter also restarts

**Done when:** you can run 5 rounds back to back with no stale state from earlier rounds.

**Checkpoint:** commit `v1-basic`. Do not continue until Steps 1-4 are solid.

---

## Phase 2: Deploy early

Doing this now surfaces breakage while the project is small.

- [ ] Check the name `keygap` is free on GitHub and Netlify (or your chosen host) before deploying; renaming later breaks the live link
- [ ] Push to a GitHub repo named `keygap` with a clear README (what it is, screenshot, how to run)
- [ ] Deploy the static version to GitHub Pages or Netlify
- [ ] Test the live link on your phone
- [ ] **Decision point:** the leaderboard in Phase 5 needs PHP + MySQL. Static hosts cannot run it. Choose now: (a) a PHP-capable host for the whole project, or (b) keep the front end static and host the PHP API separately (this needs CORS set up correctly)

**Done when:** anyone can open the link and play.

---

## Phase 3: Easy upgrades (pick as needed, one at a time)

- [ ] **60-second mode:** countdown using `setInterval`; the game ends at 0, and the text keeps refilling if the user finishes early
- [ ] **Difficulty levels:** short words / long words / sentences with punctuation and numbers
- [ ] **Best score:** save to `localStorage`. Note: this is per browser and will conflict with a server leaderboard later. Label it "personal best on this device"
- [ ] **Dark mode toggle:** use CSS variables; remember the choice
- [ ] **Mistake sound:** short audio on wrong key, with a mute option

Clean up timers with `clearInterval` on restart, or you will get duplicate countdowns.

---

## Phase 4: Weak-key tracker (the main feature)

### Step 1: Record data per key
- [ ] For each character, store `attempts` and `misses`
- [ ] Also store average time since the previous keystroke (per key) to catch slow keys, not just wrong ones
- [ ] Keep in a plain object: `{ e: {attempts, misses, totalMs}, ... }`

### Step 2: Compute weakness correctly
- [ ] Use **error rate** = misses ÷ attempts, not raw miss counts (common letters like `e` would always win otherwise)
- [ ] Ignore any key with fewer than about 20 attempts (too little data)
- [ ] Rank by error rate; optionally combine with slowness

### Step 3: Persist and display
- [ ] Save aggregated stats in `localStorage` across sessions
- [ ] Results panel shows: "Weakest keys: q (18%), p (12%), z (11%)"
- [ ] Add a "Reset stats" button

### Step 4 (optional, only after Step 3 data looks reliable): Weighted practice
- [ ] Pick words that contain weak keys with higher probability
- [ ] Keep it to **30-40% targeted words**, the rest normal, so the text stays natural
- [ ] Describe it honestly in the README: "weighted word selection based on per-key error rates". Do not call it AI

**Known limit:** many errors come from letter pairs ("th", "ou"), not single keys. Consider tracking bigrams later.

**Done when:** after a few rounds, the reported weak keys match what you actually struggle with.

---

## Phase 5: Leaderboard with PHP + MySQL

### Step 1: Database
- [ ] Table `scores`: `id`, `username`, `wpm`, `accuracy`, `duration`, `created_at`
- [ ] Use a dedicated DB user with minimal privileges

### Step 2: API
- [ ] `submit_score.php`: accepts a score, validates, inserts
- [ ] `leaderboard.php`: returns the top 10 as JSON
- [ ] Use **prepared statements** (PDO or mysqli) for every query; never concatenate input into SQL
- [ ] Sanitise usernames (length limit, allowed characters) and escape on output to prevent XSS

### Step 3: Front end
- [ ] Submit the score with `fetch` after a round
- [ ] Render the top 10; handle server errors gracefully

### Step 4: Server-side validation (the security lesson)
Understand this first: anything from the browser can be faked. Someone can POST a fake score directly and skip your page entirely. Client-side paste detection is not security.

Do what the server can actually do:
- [ ] **Server issues the text:** generate a round ID + text on the server and store it
- [ ] Client submits the round ID plus a **keystroke log** (character + timestamp)
- [ ] Server replays the log against the stored text and **recomputes** WPM and accuracy itself; ignore any client-reported WPM
- [ ] Reject impossible data: WPM above a plausible ceiling, uniform or zero inter-key timing, log doesn't match text, duration too short for the length
- [ ] Rate limit submissions per IP; make each round ID single-use with an expiry
- [ ] Write down honestly in the README what this does and doesn't prevent (a scripted bot with realistic timing can still get through)

**Done when:** a hand-crafted `curl` POST with a fake 400 WPM score is rejected.

---

## Phase 6: Optional extras (only if everything above works)

- [ ] Live WPM graph (Chart.js or canvas)
- [ ] On-screen keyboard that highlights the next key
- [ ] Random quotes from an API. Keep a hardcoded fallback list for when the API is down or rate limited
- [ ] Multiplayer race (WebSockets); a large jump in difficulty, treat as a separate project

---

## Order of work

1. Phase 1: basic version
2. Phase 2: deploy
3. Phase 4: weak-key tracker
4. Phase 5: PHP leaderboard with server validation
5. Phase 3 and 6 items as time allows

## Testing checklist (run before each commit)

- [ ] Fast typing, slow typing, and long pauses give sensible WPM
- [ ] Holding a key, pasting, and switching tabs don't break state
- [ ] Restart mid-round leaves no leftover timers
- [ ] Works on mobile and in at least two browsers
- [ ] No console errors

## README must include

- [ ] Title: KeyGap, with a one-line description
- [ ] Live link and screenshot
- [ ] Feature list, described accurately
- [ ] How to run locally, including DB setup for the leaderboard
- [ ] Known limitations (especially anti-cheat)
