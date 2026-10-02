# KeyGap: Task List

Work on **one phase at a time**. Don't start the next phase until the "Done when" line is true.
After every phase: test it, then `git commit` with a clear message.

---

## Phase 1: Show text on the screen
**Learn:** HTML basics (`div`, `span`, `button`), JavaScript variables and strings, `for` loop

- [ ] Create `index.html`, `style.css`, `script.js` and link them together
- [ ] Add an empty `<div id="text">` in the HTML
- [ ] Store a sentence in a JavaScript variable
- [ ] Loop through the sentence and create one `<span>` per letter
- [ ] Put the spans inside the `div`

**Done when:** the sentence appears in the browser and each letter is its own `<span>` (check with F12 → Elements).

---

## Phase 2: Detect key presses
**Learn:** events, `addEventListener`, `keydown`, `event.key`, the browser console

- [ ] Listen for the `keydown` event on the page
- [ ] Print `event.key` with `console.log`
- [ ] Ignore keys like Shift, Ctrl, Alt (they are not typing)

**Done when:** pressing letters prints them in the console, and pressing Shift prints nothing.

---

## Phase 3: Check right or wrong
**Learn:** `if / else`, comparing values, changing CSS classes with JavaScript

- [ ] Create a variable `currentIndex` that starts at 0
- [ ] On key press, compare the key to the letter at `currentIndex`
- [ ] If correct: add a `correct` class (green) and move `currentIndex` forward
- [ ] If wrong: add a `wrong` class (red) and do not move forward
- [ ] Highlight the current letter so the user knows where they are
- [ ] Stop the test when the last letter is reached

**Done when:** you can type the whole sentence and see green and red letters.

---

## Phase 4: Timer, WPM, accuracy
**Learn:** `Date.now()`, basic math, updating text on the page

- [ ] Start the timer on the first key press (not on page load)
- [ ] Count total key presses and wrong key presses
- [ ] When finished, calculate time taken in minutes
- [ ] WPM = (characters typed ÷ 5) ÷ minutes
- [ ] Accuracy = correct presses ÷ total presses × 100
- [ ] Show WPM and accuracy in a results area
- [ ] Add a Restart button that resets everything

**Done when:** your WPM is close to what Monkeytype shows for the same kind of text.

**Milestone:** you now have a working typing test. Push it to GitHub.

---

## Phase 5: Record every key press
**Learn:** arrays, objects, `push`

- [ ] Create an empty array `records`
- [ ] On every key press, save an object: `expected`, `typed`, `correct`, `latency`
- [ ] `latency` = time since the previous key press (skip it for the first key)
- [ ] Clear `records` on restart
- [ ] At the end of the test, `console.log(records)` and read it

**Done when:** the console shows one record for every key you pressed.

---

## Phase 6: Find weak keys
**Learn:** objects used as counters, looping over arrays, sorting

- [ ] Loop through `records` and count attempts and misses per expected key
- [ ] Calculate error rate = misses ÷ attempts for each key
- [ ] Ignore keys with fewer than about 10 attempts
- [ ] Sort keys by error rate, highest first
- [ ] Show the top 5 weakest keys on the results screen, with attempts shown next to each

**Done when:** after a test the page shows "Your weakest keys" with real numbers.

---

## Phase 7: Save stats
**Learn:** `localStorage`, `JSON.stringify`, `JSON.parse`

- [ ] After each test, add the new counts to the saved counts
- [ ] Save the totals to `localStorage`
- [ ] Load saved stats when the page opens
- [ ] Add a "Reset my stats" button

**Done when:** you refresh the page and your weak-key stats are still there.

**Milestone:** this is version 1. Deploy it (Phase 10) before adding extras if you want.

---

## Phase 8: Practice with your own text (feature 1)
**Learn:** `<textarea>`, reading input values, string cleanup

- [ ] Add a textarea where the user can paste their own text
- [ ] Add a "Start with my text" button
- [ ] Clean the text: turn line breaks and repeated spaces into a single space
- [ ] Cut it to about 300 characters
- [ ] Use it as the test sentence
- [ ] Make sure symbols like `{`, `(`, `;` work (compare to `event.key`)
- [ ] Lower the minimum attempts for keys (about 5) and show the attempt count

**Done when:** you can paste a few lines of code, type them, and see which symbols you miss most.

---

## Phase 9: Recovery cost (feature 2)
**Learn:** loops with conditions, averages, handling bad data

- [ ] For each wrong key, mark the next 3 records
- [ ] Ignore latencies over 2000 ms (the user looked away)
- [ ] Average the latency of marked keys and of normal keys
- [ ] Recovery cost = marked average − normal average
- [ ] Show it as "Each mistake costs you about X seconds"
- [ ] If there are fewer than about 10 mistakes, show "Not enough mistakes yet"

**Done when:** the results screen shows a recovery cost after a test with enough mistakes.

---

## Phase 10: Make it better and put it online

- [ ] Practice text that includes more of your weak keys
- [ ] Keyboard picture with weak keys colored red
- [ ] Tidy the design (CSS)
- [ ] Deploy on GitHub Pages
- [ ] Add a screenshot or GIF to the README
- [ ] Update the README checkboxes to match what really works
- [ ] Add a `LICENSE` file and a repo description with topics

**Done when:** a stranger can open the link and use it with no setup.

---

## Rules for myself

1. One phase at a time.
2. Commit after every phase.
3. When stuck, break the problem smaller and use `console.log` to see what the code is doing.
4. Type code myself instead of copy-pasting, then change something to see what happens.
5. Don't add the leaderboard, PHP, or MySQL. Not needed.

## Notes / problems I hit

*(write what went wrong and how you fixed it here. It makes a great LinkedIn post later.)*

-
