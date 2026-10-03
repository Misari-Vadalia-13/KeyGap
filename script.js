// =====================================================
// KeyGap - script.js  (Phases 1-10)
// =====================================================

// ---------- Settings (values you can change) ----------
const DEFAULT_SENTENCE = "the quick brown fox jumps over the lazy dog";
const MAX_LENGTH = 300;          // longest custom text we use
const MIN_CUSTOM_LENGTH = 5;     // shortest custom text we accept
const MIN_ROUND = 2;             // tries a key needs to be ranked in one round
const MIN_ALL_TIME = 10;         // tries a key needs to be ranked in all-time stats
const MIN_PRACTICE = 3;          // tries a key needs to be used for practice text
const MIN_HEAT = 3;              // tries a key needs to get a color on the keyboard
const RECOVERY_WINDOW = 3;       // how many keys after a mistake we look at
const MAX_LATENCY = 2000;        // ignore gaps longer than this (ms), you looked away
const MIN_MISTAKES = 10;         // mistakes needed before showing recovery cost

const STORAGE_KEY = "keygap-stats";
const RECOVERY_KEY = "keygap-recovery";

// Words used to build practice text
const WORDS = [
    "the", "quick", "brown", "fox", "jumps", "over", "lazy", "dog",
    "about", "after", "again", "always", "because", "before", "between",
    "change", "company", "different", "every", "example", "follow", "great",
    "group", "house", "important", "keep", "large", "little", "money",
    "never", "number", "other", "people", "place", "question", "right",
    "school", "small", "system", "thought", "through", "under", "water",
    "world", "would", "young", "zebra", "puzzle", "jazz", "wizard", "quiet",
    "expert", "maximum", "vivid", "kayak", "fix", "quarter", "exact", "extra",
    "oxygen", "jewel", "joke", "knock", "pack", "quote", "wax", "zone", "zero",
    "hazy", "fuzzy", "pixel", "quartz", "jacket", "bridge", "market", "pocket",
    "puppy", "happy", "upper", "apple", "paper", "simple", "purple", "kitchen",
    "window", "yellow", "flower", "garden", "hammer", "island", "jungle",
    "lemon", "monkey", "orange", "pencil", "rabbit", "silver", "tiger",
    "umbrella", "violin", "winter", "yogurt", "dragon", "blanket", "castle",
    "danger", "freedom", "gravity", "helmet", "kingdom", "ladder", "mirror"
];

// Keyboard rows for the heatmap (QWERTY)
const KEY_ROWS = ["1234567890-=", "qwertyuiop[]", "asdfghjkl;'", "zxcvbnm,./"];

// ---------- Page elements ----------
const textbox = document.getElementById("text");
const results = document.getElementById("results");
const weakBox = document.getElementById("weak");
const allTimeBox = document.getElementById("alltime");
const recoveryBox = document.getElementById("recovery");
const keyboardBox = document.getElementById("keyboard");
const customBox = document.getElementById("custom");

const restartBtn = document.getElementById("restart");
const defaultBtn = document.getElementById("default-text");
const practiceBtn = document.getElementById("practice");
const useCustomBtn = document.getElementById("use-custom");
const resetBtn = document.getElementById("reset-stats");

// ---------- State (values that change while you type) ----------
let sentence = DEFAULT_SENTENCE;
let letters;
let currentIndex;
let startTime;
let totalPresses;
let wrongPresses;
let records;
let lastKeyTime;

// =====================================================
// Setting up a test
// =====================================================
function startTest() {
    textbox.innerHTML = "";
    results.textContent = "";
    weakBox.textContent = "";

    for (let i = 0; i < sentence.length; i++) {
        const letter = document.createElement("span");
        letter.textContent = sentence[i];
        textbox.appendChild(letter);
    }

    letters = textbox.querySelectorAll("span");
    currentIndex = 0;
    startTime = null;
    totalPresses = 0;
    wrongPresses = 0;
    records = [];
    lastKeyTime = null;
    letters[0].classList.add("current");
}

function setSentence(text) {
    sentence = text;
    startTest();
}

// =====================================================
// Saving and loading (localStorage)
// =====================================================
function loadStats() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === null) {
            return {};
        }
        return JSON.parse(raw) || {};
    } catch (error) {
        return {};
    }
}

function saveStats(stats) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (error) {
        console.log("Could not save stats:", error);
    }
}

function emptyRecovery() {
    return { afterSum: 0, afterCount: 0, normalSum: 0, normalCount: 0, mistakes: 0 };
}

function loadRecovery() {
    const data = emptyRecovery();
    try {
        const raw = localStorage.getItem(RECOVERY_KEY);
        if (raw !== null) {
            const parsed = JSON.parse(raw);
            for (const field in data) {
                if (typeof parsed[field] === "number") {
                    data[field] = parsed[field];
                }
            }
        }
    } catch (error) {
        // damaged data: just use the empty values
    }
    return data;
}

function saveRecovery(data) {
    try {
        localStorage.setItem(RECOVERY_KEY, JSON.stringify(data));
    } catch (error) {
        console.log("Could not save recovery data:", error);
    }
}

// =====================================================
// Weak keys (Phases 6-7)
// =====================================================
function countKeys(list) {
    const stats = {};

    for (let i = 0; i < list.length; i++) {
        const key = list[i].expected;

        if (stats[key] === undefined) {
            stats[key] = { attempts: 0, misses: 0 };
        }
        stats[key].attempts++;
        if (!list[i].correct) {
            stats[key].misses++;
        }
    }
    return stats;
}

function addStats(saved, fresh) {
    for (const key in fresh) {
        if (saved[key] === undefined) {
            saved[key] = { attempts: 0, misses: 0 };
        }
        saved[key].attempts += fresh[key].attempts;
        saved[key].misses += fresh[key].misses;
    }
    return saved;
}

function rankWeakKeys(stats, minAttempts) {
    const list = [];

    for (const key in stats) {
        if (stats[key].attempts >= minAttempts && stats[key].misses > 0) {
            list.push({
                key: key,
                attempts: stats[key].attempts,
                misses: stats[key].misses,
                rate: stats[key].misses / stats[key].attempts
            });
        }
    }

    list.sort(function (a, b) {
        return b.rate - a.rate;
    });

    return list.slice(0, 5);
}

function weakKeysText(title, weak) {
    let text = title + "\n";
    for (let i = 0; i < weak.length; i++) {
        let name = weak[i].key;
        if (name === " ") {
            name = "space";
        }
        const percent = Math.round(weak[i].rate * 100);
        text += name + ": " + percent + "% (" + weak[i].misses + " misses in " + weak[i].attempts + " tries)\n";
    }
    return text;
}

function showRoundWeakKeys(roundStats) {
    const weak = rankWeakKeys(roundStats, MIN_ROUND);

    if (weak.length === 0) {
        weakBox.textContent = "No weak keys found this round.";
        return;
    }
    weakBox.textContent = weakKeysText("This round's weakest keys:", weak);
}

// =====================================================
// Phase 9: recovery cost
// =====================================================
// Looks at one round and returns sums we can add to the saved totals.
function measureRecovery(list) {
    const marked = new Array(list.length).fill(false);
    let mistakes = 0;

    // Step 1: mark the keys that come right after each mistake
    for (let i = 0; i < list.length; i++) {
        if (!list[i].correct) {
            mistakes++;
            for (let j = i + 1; j <= i + RECOVERY_WINDOW && j < list.length; j++) {
                marked[j] = true;
            }
        }
    }

    // Step 2: add up the gaps (latency) for the two groups
    const data = emptyRecovery();
    data.mistakes = mistakes;

    for (let i = 0; i < list.length; i++) {
        const t = list[i].latency;
        if (t === null || t > MAX_LATENCY) {
            continue;
        }
        if (marked[i]) {
            data.afterSum += t;
            data.afterCount++;
        } else if (list[i].correct) {
            data.normalSum += t;
            data.normalCount++;
        }
    }
    return data;
}

function addRecovery(saved, fresh) {
    for (const field in saved) {
        saved[field] += fresh[field];
    }
    return saved;
}

function showRecovery() {
    const d = loadRecovery();

    if (d.mistakes < MIN_MISTAKES) {
        recoveryBox.textContent =
            "Recovery cost: needs " + MIN_MISTAKES + " mistakes to measure (you have " + d.mistakes + " so far).";
        return;
    }
    if (d.afterCount === 0 || d.normalCount === 0) {
        recoveryBox.textContent = "Recovery cost: not enough timing data yet.";
        return;
    }

    const afterAvg = d.afterSum / d.afterCount;
    const normalAvg = d.normalSum / d.normalCount;
    const diff = afterAvg - normalAvg;

    if (diff <= 0) {
        recoveryBox.textContent =
            "Recovery cost: none detected. Your keys after a mistake (" + Math.round(afterAvg) +
            " ms) are not slower than normal (" + Math.round(normalAvg) + " ms).";
        return;
    }

    // total extra time spent on the marked keys, shared out per mistake
    const lostPerMistake = (diff * d.afterCount) / d.mistakes / 1000;

    recoveryBox.textContent =
        "Recovery cost (based on " + d.mistakes + " mistakes):\n" +
        "Normal key: " + Math.round(normalAvg) + " ms  |  Right after a mistake: " + Math.round(afterAvg) + " ms\n" +
        "Each mistake costs you about " + lostPerMistake.toFixed(2) + " seconds.";
}

// =====================================================
// Phase 10: keyboard heatmap
// =====================================================
function makeKeyElement(key, saved) {
    const el = document.createElement("div");
    el.className = "kb-key";
    el.textContent = key === " " ? "space" : key;

    // Add together the lowercase and uppercase version of the key
    const names = [key];
    if (key.toUpperCase() !== key) {
        names.push(key.toUpperCase());
    }

    let attempts = 0;
    let misses = 0;
    for (let i = 0; i < names.length; i++) {
        const s = saved[names[i]];
        if (s !== undefined) {
            attempts += s.attempts;
            misses += s.misses;
        }
    }

    if (attempts < MIN_HEAT) {
        el.classList.add("nodata");
        el.title = "Not enough data yet";
    } else {
        const rate = misses / attempts;
        // 0% errors = green (hue 120), 30% or more = red (hue 0)
        const hue = 120 * (1 - Math.min(rate / 0.3, 1));
        el.style.backgroundColor = "hsl(" + hue + ", 70%, 60%)";
        el.title = Math.round(rate * 100) + "% errors (" + misses + " misses in " + attempts + " tries)";
    }
    return el;
}

function drawKeyboard() {
    const saved = loadStats();
    keyboardBox.innerHTML = "";

    for (let r = 0; r < KEY_ROWS.length; r++) {
        const row = document.createElement("div");
        row.className = "kb-row";
        row.style.marginLeft = (r * 18) + "px";

        for (let c = 0; c < KEY_ROWS[r].length; c++) {
            row.appendChild(makeKeyElement(KEY_ROWS[r][c], saved));
        }
        keyboardBox.appendChild(row);
    }

    const spaceRow = document.createElement("div");
    spaceRow.className = "kb-row";
    spaceRow.style.marginLeft = "90px";
    const spaceKey = makeKeyElement(" ", saved);
    spaceKey.classList.add("space");
    spaceRow.appendChild(spaceKey);
    keyboardBox.appendChild(spaceRow);
}

// =====================================================
// Showing all-time stats (calls the pieces above)
// =====================================================
function showAllTime() {
    const saved = loadStats();
    const weak = rankWeakKeys(saved, MIN_ALL_TIME);

    if (weak.length === 0) {
        allTimeBox.textContent =
            "Not enough data yet (a key needs " + MIN_ALL_TIME + " tries and at least one miss).";
    } else {
        allTimeBox.textContent = weakKeysText("All-time weakest keys:", weak);
    }

    showRecovery();
    drawKeyboard();
}

// =====================================================
// Phase 8: your own text
// =====================================================
function cleanText(raw) {
    let text = raw.replace(/\s+/g, " ");        // line breaks and tabs become one space
    text = text.replace(/[^\x20-\x7E]/g, "");   // remove characters not on a normal keyboard
    text = text.trim();
    if (text.length > MAX_LENGTH) {
        text = text.slice(0, MAX_LENGTH).trim();
    }
    return text;
}

// =====================================================
// Phase 10: practice text built from your weak keys
// =====================================================
function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = list[i];
        list[i] = list[j];
        list[j] = temp;
    }
    return list;
}

function buildPracticeText() {
    const weak = rankWeakKeys(loadStats(), MIN_PRACTICE);
    if (weak.length === 0) {
        return null;
    }

    // weight of each weak key = its error rate
    const weights = {};
    for (let i = 0; i < weak.length; i++) {
        weights[weak[i].key] = weak[i].rate;
    }

    // give every word a score: more weak letters = higher score
    const scored = [];
    for (let i = 0; i < WORDS.length; i++) {
        let score = 0;
        for (let c = 0; c < WORDS[i].length; c++) {
            const w = weights[WORDS[i][c]];
            if (w !== undefined) {
                score += w;
            }
        }
        scored.push({ word: WORDS[i], score: score + Math.random() * 0.2 });
    }
    scored.sort(function (a, b) {
        return b.score - a.score;
    });

    const chosen = [];
    for (let i = 0; i < 8; i++) {
        chosen.push(scored[i].word);
    }

    // weak keys that are not lowercase letters need their own small pieces
    for (let i = 0; i < weak.length; i++) {
        const key = weak[i].key;

        if (key >= "a" && key <= "z") {
            continue;
        }
        if (key === " ") {
            continue;
        }
        if (key >= "A" && key <= "Z") {
            const pool = WORDS.filter(function (w) {
                return w[0] === key.toLowerCase();
            });
            if (pool.length > 0) {
                chosen.push(key + pickRandom(pool).slice(1));
            } else {
                chosen.push(key + pickRandom(WORDS));
            }
        } else {
            chosen.push(pickRandom(WORDS) + key + pickRandom(WORDS));
        }
    }

    return shuffle(chosen).join(" ");
}

// =====================================================
// Finishing a test (Phases 4-9)
// =====================================================
function showResults() {
    const seconds = (Date.now() - startTime) / 1000;
    const minutes = seconds / 60;
    const wpm = Math.round((sentence.length / 5) / minutes);
    const words = sentence.split(" ").length;
    const correctPresses = totalPresses - wrongPresses;
    const accuracy = Math.round((correctPresses / totalPresses) * 100);

    results.textContent =
        "WPM: " + wpm + "  |  Accuracy: " + accuracy + "%\n" +
        "Words: " + words + "  |  Time: " + seconds.toFixed(1) + "s";

    const roundStats = countKeys(records);
    showRoundWeakKeys(roundStats);

    saveStats(addStats(loadStats(), roundStats));
    saveRecovery(addRecovery(loadRecovery(), measureRecovery(records)));
    showAllTime();
}

// =====================================================
// Listening to the keyboard (Phases 2-5)
// =====================================================
document.addEventListener("keydown", function (event) {
    // don't count typing inside the text box
    if (event.target.tagName === "TEXTAREA") {
        return;
    }
    // don't count shortcuts like Ctrl+C
    if (event.ctrlKey || event.metaKey) {
        return;
    }
    // ignore Shift, Enter, Backspace and other special keys
    if (event.key.length > 1) {
        return;
    }
    if (currentIndex >= sentence.length) {
        return;
    }
    if (event.key === " ") {
        event.preventDefault();
    }

    const now = Date.now();
    if (startTime === null) {
        startTime = now;
    }

    let latency = null;
    if (lastKeyTime !== null) {
        latency = now - lastKeyTime;
    }
    lastKeyTime = now;

    totalPresses++;

    const expected = sentence[currentIndex];
    const isCorrect = event.key === expected;

    records.push({
        expected: expected,
        typed: event.key,
        correct: isCorrect,
        latency: latency
    });

    if (isCorrect) {
        letters[currentIndex].classList.remove("current");
        letters[currentIndex].classList.remove("wrong");
        letters[currentIndex].classList.add("correct");
        currentIndex++;

        if (currentIndex < sentence.length) {
            letters[currentIndex].classList.add("current");
        } else {
            showResults();
        }
    } else {
        wrongPresses++;
        letters[currentIndex].classList.add("wrong");
    }
});

// =====================================================
// Buttons
// =====================================================
restartBtn.addEventListener("click", function () {
    startTest();
    restartBtn.blur();
});

defaultBtn.addEventListener("click", function () {
    setSentence(DEFAULT_SENTENCE);
    defaultBtn.blur();
});

useCustomBtn.addEventListener("click", function () {
    const text = cleanText(customBox.value);
    if (text.length < MIN_CUSTOM_LENGTH) {
        alert("Please paste at least " + MIN_CUSTOM_LENGTH + " typeable characters.");
        return;
    }
    setSentence(text);
    useCustomBtn.blur();
});

practiceBtn.addEventListener("click", function () {
    const text = buildPracticeText();
    if (text === null) {
        alert("No weak keys found yet. Finish a few tests first.");
    } else {
        setSentence(text);
    }
    practiceBtn.blur();
});

resetBtn.addEventListener("click", function () {
    if (confirm("Delete all saved stats?")) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(RECOVERY_KEY);
        showAllTime();
    }
    resetBtn.blur();
});

// =====================================================
// Start
// =====================================================
startTest();
showAllTime();