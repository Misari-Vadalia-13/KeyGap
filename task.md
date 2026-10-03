# KeyGap: Task List

Work on **one phase at a time**. Don't start the next phase until the "Done when" line is true.
After every phase: test it, then `git commit` with a clear message.

---

## Phase 1: Show text on the screen
**Learn:** HTML basics (`div`, `span`, `button`), JavaScript variables and strings, `for` loop

- [x] Create `index.html`, `style.css`, `script.js` and link them together
- [x] Add an empty `<div id="text">` in the HTML
- [x] Store a sentence in a JavaScript variable
- [x] Loop through the sentence and create one `<span>` per letter
- [x] Put the spans inside the `div`

**Done when:** the sentence appears in the browser and each letter is its own `<span>` (check with F12 → Elements).

---

## Phase 2: Detect key presses
**Learn:** events, `addEventListener`, `keydown`, `event.key`, the browser console

- [x] Listen for the `keydown` event on the page
- [x] Print `event.key` with `console.log`
- [x] Ignore keys like Shift, Ctrl, Alt (they are not typing)

**Done when:** pressing letters prints them in the console, and pressing Shift prints nothing.

---

## Phase 3: Check right or wrong
**Learn:** `if / else`, comparing values, changing CSS classes with JavaScript

- [x] Create a variable `currentIndex` that starts at 0
- [x] On key press, compare the key to the letter at `currentIndex`
- [x] If correct: add a `correct` class (green) and move `currentIndex` forward
- [x] If wrong: add a `wrong` class (red) and do not move forward
- [x] Highlight the current letter so the user knows where they are
- [x] Stop the test when the last letter is reached

**Done when:** you can type the whole sentence and see green and red letters.

---

## Phase 4: Timer, WPM, accuracy
**Learn:** `Date.now()`, basic math, updating text on the page

- [x] Start the timer on the first key press (not on page load)
- [x] Count total key presses and wrong key presses
- [x] When finished, calculate time taken in minutes
- [x] WPM = (characters typed ÷ 5) ÷ minutes
- [x] Accuracy = correct presses ÷ total presses × 100
- [x] Show WPM and accuracy in a results area
- [x] Add a Restart button that resets everything

**Done when:** your WPM is close to what Monkeytype shows for the same kind of text.

**Milestone:** you now have a working typing test. Push it to GitHub.

---

## Phase 5: Record every key press
**Learn:** arrays, objects, `push`

- [x] Create an empty array `records`
- [x] On every key press, save an object: `expected`, `typed`, `correct`, `latency`
- [x] `latency` = time since the previous key press (skip it for the first key)
- [x] Clear `records` on restart
- [x] At the end of the test, `console.log(records)` and read it

**Done when:** the console shows one record for every key you pressed.

---

## Phase 6: Find weak keys
**Learn:** objects used as counters, looping over arrays, sorting

- [x] Loop through `records` and count attempts and misses per expected key
- [x] Calculate error rate = misses ÷ attempts for each key
- [x] Ignore keys with fewer than about 10 attempts
- [x] Sort keys by error rate, highest first
- [x] Show the top 5 weakest keys on the results screen, with attempts shown next to each

**Done when:** after a test the page shows "Your weakest keys" with real numbers.

---

## Phase 7: Save stats
**Learn:** `localStorage`, `JSON.stringify`, `JSON.parse`

- [x] After each test, add the new counts to the saved counts
- [x] Save the totals to `localStorage`
- [x] Load saved stats when the page opens
- [x] Add a "Reset my stats" button

**Done when:** you refresh the page and your weak-key stats are still there.

**Milestone:** this is version 1. Deploy it (Phase 10) before adding extras if you want.

---

## Phase 8: Practice with your own text (feature 1)
**Learn:** `<textarea>`, reading input values, string cleanup

- [x] Add a textarea where the user can paste their own text
- [x] Add a "Start with my text" button
- [x] Clean the text: turn line breaks and repeated spaces into a single space
- [x] Cut it to about 300 characters
- [x] Use it as the test sentence
- [x] Make sure symbols like `{`, `(`, `;` work (compare to `event.key`)
- [x] Lower the minimum attempts for keys (about 5) and show the attempt count

**Done when:** you can paste a few lines of code, type them, and see which symbols you miss most.

---

## Phase 9: Recovery cost (feature 2)
**Learn:** loops with conditions, averages, handling bad data

- [x] For each wrong key, mark the next 3 records
- [x] Ignore latencies over 2000 ms (the user looked away)
- [x] Average the latency of marked keys and of normal keys
- [x] Recovery cost = marked average − normal average
- [x] Show it as "Each mistake costs you about X seconds"
- [x] If there are fewer than about 10 mistakes, show "Not enough mistakes yet"

**Done when:** the results screen shows a recovery cost after a test with enough mistakes.

---

## Phase 10: Make it better and put it online

- [x] Practice text that includes more of your weak keys
- [x] Keyboard picture with weak keys colored red
- [x] Tidy the design (CSS)
- [x] Deploy on GitHub Pages
- [x] Add a screenshot or GIF to the README
- [x] Update the README checkboxes to match what really works
- [x] Add a `LICENSE` file and a repo description with topics

**Done when:** a stranger can open the link and use it with no setup.

---

## Rules for myself

1. One phase at a time.
2. Commit after every phase.
3. When stuck, break the problem smaller and use `console.log` to see what the code is doing.
4. Type code myself instead of copy-pasting, then change something to see what happens.
5. Don't add the leaderboard, PHP, or MySQL. Not needed.

## Notes / problems I hit

- Successfully completed all 10 phases.
- Enhanced design to a modern dark obsidian theme with real-time HUD and physical QWERTY heatmap.
