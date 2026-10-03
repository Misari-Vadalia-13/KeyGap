// ===================================================================
// KeyGap — script.js (Keystroke Intelligence Engine)
// ===================================================================

// ---------- Settings ----------
const DEFAULT_SENTENCE = "the quick brown fox jumps over the lazy dog";
const MAX_LENGTH = 300;          // longest custom text we accept
const MIN_CUSTOM_LENGTH = 5;     // shortest custom text we accept
const MIN_ROUND = 2;             // tries a key needs to be ranked in one round
const MIN_ALL_TIME = 10;         // tries a key needs to be ranked in all-time stats
const MIN_PRACTICE = 3;          // tries a key needs to be used for practice text
const MIN_HEAT = 3;              // tries a key needs to get a color on the keyboard
const RECOVERY_WINDOW = 3;       // how many keys after a mistake we look at
const MAX_LATENCY = 2000;        // ignore pauses longer than this (ms)
const MIN_MISTAKES = 10;         // mistakes needed before showing recovery cost

const STORAGE_KEY = "keygap-stats";
const RECOVERY_KEY = "keygap-recovery";

// Curated words used to build dynamic weak-key practice drills
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

// Standard QWERTY physical keyboard rows
const KEY_ROWS = ["1234567890-=", "qwertyuiop[]", "asdfghjkl;'", "zxcvbnm,./"];

// ---------- Page DOM Elements ----------
const textbox = document.getElementById("text");
const results = document.getElementById("results");
const weakBox = document.getElementById("weak");
const allTimeBox = document.getElementById("alltime");
const recoveryBox = document.getElementById("recovery");
const keyboardBox = document.getElementById("keyboard");
const customBox = document.getElementById("custom");
const charCounter = document.getElementById("char-counter");

// Live HUD Elements
const hudWpm = document.getElementById("hud-wpm");
const hudAcc = document.getElementById("hud-acc");
const hudTime = document.getElementById("hud-time");
const hudMode = document.getElementById("hud-mode");
const arenaStatus = document.getElementById("arena-status");

// Buttons
const restartBtn = document.getElementById("restart");
const defaultBtn = document.getElementById("default-text");
const practiceBtn = document.getElementById("practice");
const useCustomBtn = document.getElementById("use-custom");
const resetBtn = document.getElementById("reset-stats");

// ---------- State ----------
let sentence = DEFAULT_SENTENCE;
let currentModeName = "Standard";
let letters;
let currentIndex;
let startTime = null;
let totalPresses = 0;
let wrongPresses = 0;
let records = [];
let lastKeyTime = null;
let liveInterval = null;

// =====================================================
// Setting up a test
// =====================================================
function startTest() {
    if (liveInterval) {
        clearInterval(liveInterval);
        liveInterval = null;
    }

    textbox.innerHTML = "";
    results.innerHTML = "";
    weakBox.innerHTML = "<span style='color:var(--text-muted);'>Complete a test round to view your weakest keys for this session.</span>";

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

    if (letters.length > 0) {
        letters[0].classList.add("current");
    }

    // Reset HUD
    if (hudWpm) hudWpm.textContent = "0";
    if (hudAcc) hudAcc.innerHTML = "100<small>%</small>";
    if (hudTime) hudTime.innerHTML = "0.0<small>s</small>";
    if (hudMode) hudMode.textContent = currentModeName;
    if (arenaStatus) arenaStatus.textContent = "Ready. Start typing to begin timing.";
}

function setSentence(text, modeName = "Standard") {
    currentModeName = modeName;
    sentence = text;
    startTest();
}

// Live timer tick for real-time responsiveness
function updateLiveHud() {
    if (!startTime) return;
    const elapsedSeconds = (Date.now() - startTime) / 1000;
    const minutes = elapsedSeconds / 60;
    
    // Live WPM based on characters typed so far
    const wpm = minutes > 0.01 ? Math.max(0, Math.round((currentIndex / 5) / minutes)) : 0;
    const accuracy = totalPresses > 0 ? Math.round(((totalPresses - wrongPresses) / totalPresses) * 100) : 100;

    if (hudWpm) hudWpm.textContent = wpm;
    if (hudAcc) hudAcc.innerHTML = `${accuracy}<small>%</small>`;
    if (hudTime) hudTime.innerHTML = `${elapsedSeconds.toFixed(1)}<small>s</small>`;
}

// =====================================================
// Saving and loading (localStorage)
// =====================================================
function loadStats() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === null) return {};
        return JSON.parse(raw) || {};
    } catch (error) {
        return {};
    }
}

function saveStats(stats) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (error) {
        console.warn("Could not save stats:", error);
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
        // damaged data fallback
    }
    return data;
}

function saveRecovery(data) {
    try {
        localStorage.setItem(RECOVERY_KEY, JSON.stringify(data));
    } catch (error) {
        console.warn("Could not save recovery data:", error);
    }
}

// =====================================================
// Weak keys analysis
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

    list.sort((a, b) => b.rate - a.rate);
    return list.slice(0, 5);
}

// Render formatted badges for weakest keys
function renderWeakKeysHtml(weak) {
    let html = '<div class="stat-pill-list">';
    for (let i = 0; i < weak.length; i++) {
        let name = weak[i].key;
        if (name === " ") name = "␣ Space";
        const percent = Math.round(weak[i].rate * 100);
        html += `
            <div class="stat-pill-item">
                <span class="key-badge">${name}</span>
                <span class="stat-rate">${percent}% error</span>
                <span class="stat-sub">${weak[i].misses} misses / ${weak[i].attempts} tries</span>
            </div>
        `;
    }
    html += '</div>';
    return html;
}

function showRoundWeakKeys(roundStats) {
    const weak = rankWeakKeys(roundStats, MIN_ROUND);

    if (weak.length === 0) {
        weakBox.innerHTML = "<span style='color:var(--accent-emerald);'>Outstanding accuracy! No weak keys identified this round.</span>";
        return;
    }
    weakBox.innerHTML = renderWeakKeysHtml(weak);
}

// =====================================================
// Recovery cost calculation (Mistake Latency)
// =====================================================
function measureRecovery(list) {
    const marked = new Array(list.length).fill(false);
    let mistakes = 0;

    // Mark the keys that follow immediately after a mistake
    for (let i = 0; i < list.length; i++) {
        if (!list[i].correct) {
            mistakes++;
            for (let j = i + 1; j <= i + RECOVERY_WINDOW && j < list.length; j++) {
                marked[j] = true;
            }
        }
    }

    const data = emptyRecovery();
    data.mistakes = mistakes;

    for (let i = 0; i < list.length; i++) {
        const t = list[i].latency;
        if (t === null || t > MAX_LATENCY) continue;

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
        recoveryBox.innerHTML = `
            <div style="padding: 8px 0; color: var(--text-muted);">
                Calibrating recovery metrics...<br>
                Requires <strong>${MIN_MISTAKES}</strong> mistakes to accurately compute hesitation delay.<br>
                Progress: <strong style="color:var(--accent-cyan);">${d.mistakes} / ${MIN_MISTAKES}</strong> mistakes logged.
            </div>
        `;
        return;
    }

    if (d.afterCount === 0 || d.normalCount === 0) {
        recoveryBox.innerHTML = "<span style='color:var(--text-muted);'>Not enough timing data recorded yet.</span>";
        return;
    }

    const afterAvg = d.afterSum / d.afterCount;
    const normalAvg = d.normalSum / d.normalCount;
    const diff = afterAvg - normalAvg;

    if (diff <= 0) {
        recoveryBox.innerHTML = `
            <div class="stat-pill-list">
                <div class="stat-pill-item">
                    <span>Average Keystroke</span>
                    <strong style="color:var(--accent-cyan);">${Math.round(normalAvg)} ms</strong>
                </div>
                <div class="stat-pill-item">
                    <span>Post-Mistake Keystroke</span>
                    <strong style="color:var(--accent-emerald);">${Math.round(afterAvg)} ms</strong>
                </div>
            </div>
            <p style="margin-top: 10px; color: var(--accent-emerald); font-size: 12px;">
                ✓ Flawless recovery! You do not hesitate after mistakes.
            </p>
        `;
        return;
    }

    const lostPerMistake = (diff * d.afterCount) / d.mistakes / 1000;

    recoveryBox.innerHTML = `
        <div class="stat-pill-list">
            <div class="stat-pill-item">
                <span>Normal Pace</span>
                <strong style="color:var(--accent-cyan);">${Math.round(normalAvg)} ms</strong>
            </div>
            <div class="stat-pill-item">
                <span>Post-Mistake Pace</span>
                <strong style="color:var(--accent-rose);">${Math.round(afterAvg)} ms (+${Math.round(diff)}ms)</strong>
            </div>
            <div class="stat-pill-item" style="border-color: rgba(251, 113, 133, 0.3); background: rgba(251, 113, 133, 0.08);">
                <span>Penalty per Mistake</span>
                <strong style="color:var(--accent-rose); font-size: 15px;">~${lostPerMistake.toFixed(2)}s lost</strong>
            </div>
        </div>
    `;
}

// =====================================================
// Keyboard Heatmap
// =====================================================
function makeKeyElement(key, saved) {
    const el = document.createElement("div");
    el.className = "kb-key";
    el.textContent = key === " " ? "space" : key;

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
        el.title = `Key: '${key}' (Needs at least ${MIN_HEAT} attempts)`;
    } else {
        const rate = misses / attempts;
        // 0% error = hue 120 (emerald green), 30%+ error = hue 0 (crimson red)
        const hue = 120 * (1 - Math.min(rate / 0.3, 1));
        el.style.backgroundColor = `hsl(${hue}, 68%, 38%)`;
        el.style.color = "#ffffff";
        el.style.borderColor = `hsl(${hue}, 80%, 55%)`;
        el.title = `Key: '${key}' | ${Math.round(rate * 100)}% errors (${misses} misses in ${attempts} attempts)`;
    }
    return el;
}

function drawKeyboard() {
    const saved = loadStats();
    keyboardBox.innerHTML = "";

    for (let r = 0; r < KEY_ROWS.length; r++) {
        const row = document.createElement("div");
        row.className = "kb-row";
        row.style.marginLeft = `${r * 18}px`;

        for (let c = 0; c < KEY_ROWS[r].length; c++) {
            row.appendChild(makeKeyElement(KEY_ROWS[r][c], saved));
        }
        keyboardBox.appendChild(row);
    }

    // Spacebar row
    const spaceRow = document.createElement("div");
    spaceRow.className = "kb-row";
    spaceRow.style.marginLeft = "105px";
    const spaceKey = makeKeyElement(" ", saved);
    spaceKey.classList.add("space");
    spaceRow.appendChild(spaceKey);
    keyboardBox.appendChild(spaceRow);
}

// =====================================================
// Showing all-time stats
// =====================================================
function showAllTime() {
    const saved = loadStats();
    const weak = rankWeakKeys(saved, MIN_ALL_TIME);

    if (weak.length === 0) {
        allTimeBox.innerHTML = `
            <div style="color: var(--text-muted); padding: 6px 0;">
                Accumulating key metrics...<br>
                A key requires at least <strong>${MIN_ALL_TIME}</strong> attempts to qualify for all-time rankings.
            </div>
        `;
    } else {
        allTimeBox.innerHTML = renderWeakKeysHtml(weak);
    }

    showRecovery();
    drawKeyboard();
}

// =====================================================
// Text sanitization
// =====================================================
function cleanText(raw) {
    let text = raw.replace(/\s+/g, " ");
    text = text.replace(/[^\x20-\x7E]/g, "");
    text = text.trim();
    if (text.length > MAX_LENGTH) {
        text = text.slice(0, MAX_LENGTH).trim();
    }
    return text;
}

// =====================================================
// Dynamic weak-key practice drill generator
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
    if (weak.length === 0) return null;

    const weights = {};
    for (let i = 0; i < weak.length; i++) {
        weights[weak[i].key] = weak[i].rate;
    }

    const scored = [];
    for (let i = 0; i < WORDS.length; i++) {
        let score = 0;
        for (let c = 0; c < WORDS[i].length; c++) {
            const w = weights[WORDS[i][c]];
            if (w !== undefined) score += w;
        }
        scored.push({ word: WORDS[i], score: score + Math.random() * 0.2 });
    }

    scored.sort((a, b) => b.score - a.score);

    const chosen = [];
    for (let i = 0; i < Math.min(8, scored.length); i++) {
        chosen.push(scored[i].word);
    }

    for (let i = 0; i < weak.length; i++) {
        const key = weak[i].key;
        if ((key >= "a" && key <= "z") || key === " ") continue;

        if (key >= "A" && key <= "Z") {
            const pool = WORDS.filter(w => w[0] === key.toLowerCase());
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
// Finishing a test
// =====================================================
function showResults() {
    if (liveInterval) {
        clearInterval(liveInterval);
        liveInterval = null;
    }

    const seconds = (Date.now() - startTime) / 1000;
    const minutes = seconds / 60;
    const wpm = Math.max(0, Math.round((sentence.length / 5) / minutes));
    const words = sentence.split(" ").length;
    const correctPresses = totalPresses - wrongPresses;
    const accuracy = totalPresses > 0 ? Math.round((correctPresses / totalPresses) * 100) : 100;

    results.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div>
                <strong style="color:var(--accent-cyan); font-size: 24px;">${wpm} WPM</strong>
                <span style="margin: 0 10px; color: var(--border-subtle);">|</span>
                <span style="color:var(--accent-emerald); font-weight: 700;">${accuracy}% Accuracy</span>
            </div>
            <div style="font-size: 14px; color: var(--text-secondary);">
                <span>${words} words</span> • <span>${seconds.toFixed(1)}s elapsed</span> • <span>${wrongPresses} mistakes</span>
            </div>
        </div>
    `;

    if (hudWpm) hudWpm.textContent = wpm;
    if (hudAcc) hudAcc.innerHTML = `${accuracy}<small>%</small>`;
    if (hudTime) hudTime.innerHTML = `${seconds.toFixed(1)}<small>s</small>`;
    if (arenaStatus) arenaStatus.textContent = "Test Completed! Check diagnostics below or press Esc to restart.";

    const roundStats = countKeys(records);
    showRoundWeakKeys(roundStats);

    saveStats(addStats(loadStats(), roundStats));
    saveRecovery(addRecovery(loadRecovery(), measureRecovery(records)));
    showAllTime();
}

// =====================================================
// Keyboard Listener
// =====================================================
document.addEventListener("keydown", function (event) {
    // Quick restart shortcut with Escape
    if (event.key === "Escape") {
        event.preventDefault();
        startTest();
        return;
    }

    // Ignore keystrokes when typing inside the custom textarea
    if (event.target.tagName === "TEXTAREA") {
        return;
    }

    // Ignore browser shortcuts
    if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
    }

    // Ignore special non-character keys
    if (event.key.length > 1) {
        return;
    }

    if (currentIndex >= sentence.length) {
        return;
    }

    // Prevent spacebar scrolling page down
    if (event.key === " ") {
        event.preventDefault();
    }

    const now = Date.now();
    if (startTime === null) {
        startTime = now;
        if (arenaStatus) arenaStatus.textContent = "Test in progress...";
        // Start live ticking timer
        liveInterval = setInterval(updateLiveHud, 100);
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

    updateLiveHud();
});

// =====================================================
// Interactive UI Handlers & Buttons
// =====================================================
if (restartBtn) {
    restartBtn.addEventListener("click", function () {
        startTest();
        restartBtn.blur();
    });
}

if (defaultBtn) {
    defaultBtn.addEventListener("click", function () {
        setSentence(DEFAULT_SENTENCE, "Standard");
        defaultBtn.blur();
    });
}

if (practiceBtn) {
    practiceBtn.addEventListener("click", function () {
        const text = buildPracticeText();
        if (text === null) {
            alert("No weak keys identified yet. Complete a few test rounds first!");
        } else {
            setSentence(text, "Weak-Key Drill");
        }
        practiceBtn.blur();
    });
}

if (useCustomBtn && customBox) {
    useCustomBtn.addEventListener("click", function () {
        const text = cleanText(customBox.value);
        if (text.length < MIN_CUSTOM_LENGTH) {
            alert(`Please input at least ${MIN_CUSTOM_LENGTH} valid characters.`);
            return;
        }
        setSentence(text, "Custom Text");
        useCustomBtn.blur();
    });
}

if (customBox && charCounter) {
    customBox.addEventListener("input", function () {
        const len = customBox.value.length;
        charCounter.textContent = `${len} / ${MAX_LENGTH}`;
        if (len > MAX_LENGTH) {
            charCounter.style.color = "var(--accent-rose)";
        } else {
            charCounter.style.color = "var(--text-muted)";
        }
    });
}

if (resetBtn) {
    resetBtn.addEventListener("click", function () {
        if (confirm("Reset all stored typing statistics and calibration data?")) {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(RECOVERY_KEY);
            showAllTime();
            startTest();
        }
        resetBtn.blur();
    });
}

// =====================================================
// Initialize on page load
// =====================================================
startTest();
showAllTime();