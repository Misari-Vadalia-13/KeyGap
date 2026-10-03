// ===================================================================
// KeyGap — script.js (Keystroke Intelligence Engine)
// ===================================================================

// ---------- Settings ----------
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

// ---------- Rich Paragraph Pool (Longer, non-repeating passages) ----------
const PARAGRAPHS = [
    "The craft of software development is not merely about writing code that machines can execute, but designing resilient architectures that other humans can comprehend, maintain, and build upon with enduring confidence.",
    "Deep focus has become the rarest superpower of our modern digital era. When you ruthlessly eliminate external distractions, your mind enters a frictionless state of flow where complex engineering hurdles yield to crystal clarity.",
    "Every deliberate keystroke carries intent. As velocity and rhythmic cadence align, typing ceases to be a conscious mechanical effort and evolves into a seamless conduit translating raw thought directly into the terminal.",
    "Clean code reads like carefully edited prose. Every variable identifier, function signature, and high-level abstraction should weave an intuitive narrative that exposes its core architectural intent without requiring decipherment.",
    "In the crucible of rapid innovation lies the patience to iterate relentlessly. Incremental, compounding daily improvements quietly outdistance sporadic bursts of chaotic brilliance across any meaningful career timeline.",
    "Mistakes are never indicators of personal inadequacy, but rather precise diagnostic signals. By observing exactly where hesitation and micro-latencies occur, you expose the mechanical bottlenecks standing between practice and fluency.",
    "A digital computer represents a bicycle for the human intellect. It magnifies cognitive bandwidth and creative imagination, empowering curious minds to construct global platforms and unravel mysteries once deemed utterly impenetrable.",
    "True technical mastery requires humility before fundamentals. Just as the seasoned concert pianist studies subtle chord voicings, the disciplined typist cultivates relaxed finger placement and accuracy before pursuing blistering speed.",
    "Under the ambient luminescence of the workstation display, abstract blueprints crystallize into interactive reality. What originates as an isolated script in an editor eventually becomes a living system depended upon by thousands.",
    "Resilience is forged during those quiet stretches when tangible progress feels elusive. Trusting the systematic repetition of disciplined craft invariably produces breakthroughs that appear effortless to casual observers.",
    "Software architecture resembles living thought crystallized into structure. Exceptional systems adapt gracefully to unforeseen operational demands while faithfully preserving the elegance of their underlying design."
];

let lastParagraphIndex = -1;

function getRandomParagraph() {
    let index;
    if (PARAGRAPHS.length <= 1) {
        index = 0;
    } else {
        do {
            index = Math.floor(Math.random() * PARAGRAPHS.length);
        } while (index === lastParagraphIndex);
    }
    lastParagraphIndex = index;
    return PARAGRAPHS[index];
}

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

// Controls & Mode Buttons
const restartBtn = document.getElementById("restart");
const defaultBtn = document.getElementById("default-text");
const default60sBtn = document.getElementById("default-60s");
const practiceBtn = document.getElementById("practice");
const refreshTextBtn = document.getElementById("refresh-text");
const useCustomBtn = document.getElementById("use-custom");
const customUntimedBtn = document.getElementById("custom-untimed");
const custom60sBtn = document.getElementById("custom-60s");
const resetBtn = document.getElementById("reset-stats");

// Mode / Timer Segmented Buttons
const modeUntimedBtn = document.getElementById("mode-untimed");
const mode60sBtn = document.getElementById("mode-60s");
const mode120sBtn = document.getElementById("mode-120s");
const segmentBtns = [modeUntimedBtn, mode60sBtn, mode120sBtn];

// ---------- State ----------
let sentence = getRandomParagraph();
let currentModeName = "Standard";
let timerLimit = 0; // 0 = Untimed (full text accuracy check), 60 = 60s, 120 = 120s
let letters = [];
let currentIndex = 0;
let startTime = null;
let totalPresses = 0;
let wrongPresses = 0;
let records = [];
let lastKeyTime = null;
let liveInterval = null;
let isTestActive = false;

// =====================================================
// Setting up a test
// =====================================================
function startTest(forceNewSentence = false) {
    if (liveInterval) {
        clearInterval(liveInterval);
        liveInterval = null;
    }

    // If forced or if previous test completed in Standard mode, load a fresh new paragraph
    if (forceNewSentence && currentModeName === "Standard") {
        sentence = getRandomParagraph();
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
    isTestActive = true;

    if (letters.length > 0) {
        letters[0].classList.add("current");
    }

    // Reset HUD
    if (hudWpm) hudWpm.textContent = "0";
    if (hudAcc) hudAcc.innerHTML = "100<small>%</small>";
    if (hudTime) {
        hudTime.classList.remove("time-warning");
        if (timerLimit > 0) {
            hudTime.innerHTML = `${timerLimit}.0<small>s</small>`;
        } else {
            hudTime.innerHTML = "0.0<small>s</small>";
        }
    }
    updateModeDisplay();
    if (arenaStatus) {
        if (timerLimit > 0) {
            arenaStatus.textContent = `Ready. Start typing to initiate the ${timerLimit}s countdown timer.`;
        } else {
            arenaStatus.textContent = "Untimed Mode: Type through the entire passage to evaluate your accuracy.";
        }
    }
}

function updateModeDisplay() {
    if (!hudMode) return;
    if (timerLimit === 60) {
        hudMode.textContent = "60s Timed";
    } else if (timerLimit === 120) {
        hudMode.textContent = "120s Timed";
    } else {
        hudMode.textContent = currentModeName === "Standard" ? "Untimed" : currentModeName;
    }
}

function setSentence(text, modeName = "Standard") {
    currentModeName = modeName;
    sentence = text;
    startTest(false);
}

// Live timer tick for real-time HUD responsiveness
function updateLiveHud() {
    if (!startTime || !isTestActive) return;
    const now = Date.now();
    const elapsedSeconds = (now - startTime) / 1000;
    const minutes = elapsedSeconds / 60;
    
    // Live WPM based on characters typed so far
    const wpm = minutes > 0.005 ? Math.max(0, Math.round((currentIndex / 5) / minutes)) : 0;
    const accuracy = totalPresses > 0 ? Math.round(((totalPresses - wrongPresses) / totalPresses) * 100) : 100;

    if (hudWpm) hudWpm.textContent = wpm;
    if (hudAcc) hudAcc.innerHTML = `${accuracy}<small>%</small>`;

    if (timerLimit > 0) {
        const remaining = Math.max(0, timerLimit - elapsedSeconds);
        if (hudTime) {
            hudTime.innerHTML = `${remaining.toFixed(1)}<small>s</small>`;
            if (remaining <= 10) {
                hudTime.classList.add("time-warning");
            } else {
                hudTime.classList.remove("time-warning");
            }
        }

        // Time up check
        if (remaining <= 0) {
            showResults(true); // Timed out
            return;
        }
    } else {
        if (hudTime) {
            hudTime.innerHTML = `${elapsedSeconds.toFixed(1)}<small>s</small>`;
        }
    }
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
// Text sanitization (Unlimited length)
// =====================================================
function cleanText(raw) {
    let text = raw.replace(/\s+/g, " ");
    text = text.replace(/[^\x20-\x7E]/g, "");
    return text.trim();
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
function showResults(isTimedOut = false) {
    isTestActive = false;
    if (liveInterval) {
        clearInterval(liveInterval);
        liveInterval = null;
    }

    const elapsedSeconds = startTime ? (Date.now() - startTime) / 1000 : 0;
    const finalSeconds = isTimedOut ? timerLimit : Math.max(0.1, elapsedSeconds);
    const minutes = Math.max(0.005, finalSeconds / 60);

    // Characters typed so far divided by 5 words per minute
    const wpm = Math.max(0, Math.round((currentIndex / 5) / minutes));
    const typedWords = sentence.slice(0, currentIndex).trim().split(/\s+/).filter(Boolean).length;
    const correctPresses = totalPresses - wrongPresses;
    const accuracy = totalPresses > 0 ? Math.round((correctPresses / totalPresses) * 100) : 100;

    const bannerTitle = isTimedOut
        ? `<strong style="color:var(--accent-rose); font-size: 22px;">⏱️ Time's Up! (${timerLimit}s Session)</strong>`
        : `<strong style="color:var(--accent-emerald); font-size: 22px;">🎉 Passage Completed!</strong>`;

    results.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
            <div>
                ${bannerTitle}
                <div style="margin-top: 4px;">
                    <span style="color:var(--accent-cyan); font-size: 26px; font-weight:800;">${wpm} WPM</span>
                    <span style="margin: 0 10px; color: var(--border-subtle);">|</span>
                    <span style="color:var(--accent-emerald); font-size: 20px; font-weight: 700;">${accuracy}% Accuracy</span>
                </div>
            </div>
            <div style="font-size: 14px; color: var(--text-secondary); text-align: right;">
                <div>${currentIndex} / ${sentence.length} characters typed (${typedWords} words)</div>
                <div>${finalSeconds.toFixed(1)}s elapsed • ${wrongPresses} mistakes</div>
            </div>
        </div>
    `;

    if (hudWpm) hudWpm.textContent = wpm;
    if (hudAcc) hudAcc.innerHTML = `${accuracy}<small>%</small>`;
    if (hudTime) {
        hudTime.classList.remove("time-warning");
        hudTime.innerHTML = `${finalSeconds.toFixed(1)}<small>s</small>`;
    }
    if (arenaStatus) {
        arenaStatus.textContent = "Test Completed! New paragraph ready. Press Esc or click Restart to begin.";
    }

    const roundStats = countKeys(records);
    showRoundWeakKeys(roundStats);

    saveStats(addStats(loadStats(), roundStats));
    saveRecovery(addRecovery(loadRecovery(), measureRecovery(records)));
    showAllTime();

    // Prepare fresh next passage automatically for subsequent test in Standard mode
    if (currentModeName === "Standard") {
        sentence = getRandomParagraph();
    }
}

// =====================================================
// Keyboard Listener
// =====================================================
document.addEventListener("keydown", function (event) {
    // Quick restart shortcut with Escape (loads fresh text if current test finished)
    if (event.key === "Escape") {
        event.preventDefault();
        startTest(!isTestActive);
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

    if (!isTestActive || currentIndex >= sentence.length) {
        return;
    }

    // Prevent spacebar scrolling page down
    if (event.key === " ") {
        event.preventDefault();
    }

    const now = Date.now();
    if (startTime === null) {
        startTime = now;
        if (arenaStatus) {
            if (timerLimit > 0) {
                arenaStatus.textContent = `Timing active! ${timerLimit}s countdown running...`;
            } else {
                arenaStatus.textContent = "Untimed mode: Testing accuracy across full passage...";
            }
        }
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
            letters[currentIndex].scrollIntoView({ block: "nearest", inline: "nearest" });
        } else {
            showResults(false); // Completed passage
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
        // If restarting after completion, give a new passage; otherwise reset current
        startTest(!isTestActive);
        restartBtn.blur();
    });
}

if (refreshTextBtn) {
    refreshTextBtn.addEventListener("click", function () {
        setSentence(getRandomParagraph(), "Standard");
        refreshTextBtn.blur();
    });
}

if (defaultBtn) {
    defaultBtn.addEventListener("click", function () {
        setTimerMode(0, modeUntimedBtn);
        setSentence(getRandomParagraph(), "Standard");
        defaultBtn.blur();
    });
}

if (default60sBtn) {
    default60sBtn.addEventListener("click", function () {
        setTimerMode(60, mode60sBtn);
        setSentence(getRandomParagraph(), "60s Timed");
        default60sBtn.blur();
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

// Mode & Timer Segmented Controls
function setTimerMode(seconds, activeBtn) {
    timerLimit = seconds;
    segmentBtns.forEach(btn => {
        if (btn) btn.classList.remove("active");
    });
    if (activeBtn) activeBtn.classList.add("active");
    updateModeDisplay();
    startTest(false);
}

if (modeUntimedBtn) {
    modeUntimedBtn.addEventListener("click", () => setTimerMode(0, modeUntimedBtn));
}

if (mode60sBtn) {
    mode60sBtn.addEventListener("click", () => setTimerMode(60, mode60sBtn));
}

if (mode120sBtn) {
    mode120sBtn.addEventListener("click", () => setTimerMode(120, mode120sBtn));
}

// Custom text launch handlers
function loadCustomText(targetTimerSeconds, activeSegmentBtn) {
    if (!customBox) return;
    const text = cleanText(customBox.value);
    if (text.length < MIN_CUSTOM_LENGTH) {
        alert(`Please paste or enter at least ${MIN_CUSTOM_LENGTH} valid characters.`);
        return;
    }

    if (targetTimerSeconds !== null) {
        timerLimit = targetTimerSeconds;
        segmentBtns.forEach(btn => {
            if (btn) btn.classList.remove("active");
        });
        if (activeSegmentBtn) activeSegmentBtn.classList.add("active");
    }

    const modeLabel = timerLimit > 0 ? `Custom (${timerLimit}s)` : "Custom (Untimed)";
    setSentence(text, modeLabel);
    textbox.scrollIntoView({ behavior: "smooth", block: "center" });
}

if (useCustomBtn) {
    useCustomBtn.addEventListener("click", function () {
        loadCustomText(null, null);
        useCustomBtn.blur();
    });
}

if (customUntimedBtn) {
    customUntimedBtn.addEventListener("click", function () {
        loadCustomText(0, modeUntimedBtn);
        customUntimedBtn.blur();
    });
}

if (custom60sBtn) {
    custom60sBtn.addEventListener("click", function () {
        loadCustomText(60, mode60sBtn);
        custom60sBtn.blur();
    });
}

if (customBox && charCounter) {
    customBox.addEventListener("input", function () {
        const len = customBox.value.length;
        charCounter.textContent = `${len.toLocaleString()} characters`;
        charCounter.style.color = "var(--text-muted)";
    });
}

if (resetBtn) {
    resetBtn.addEventListener("click", function () {
        if (confirm("Reset all stored typing statistics and calibration data?")) {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(RECOVERY_KEY);
            showAllTime();
            startTest(false);
        }
        resetBtn.blur();
    });
}

// =====================================================
// Initialize on page load
// =====================================================
startTest(false);
showAllTime();