// ===================================================================
// KeyGap — script.js (Keystroke Intelligence & Recovery Engine)
// ===================================================================

// ---------- Settings & Smoothing Constants ----------
const MIN_CUSTOM_LENGTH = 5;     // shortest custom text we accept
const MIN_ROUND = 5;             // minimum tries for a key to be ranked in one round
const MIN_ALL_TIME = 20;         // minimum tries for a key to be ranked in all-time stats
const MIN_PRACTICE = 5;          // tries a key needs to be included in practice drills
const MIN_HEAT = 5;              // tries a key needs before receiving a heatmap color
const MIN_HEAT_ALL = 15;         // tries needed for all-time heatmap calibration
const RECOVERY_LOOKAHEAD = 5;    // max keystrokes monitored to measure post-mistake recovery
const BASELINE_WINDOW = 5;       // rolling window of recent correct keystrokes to compute baseline speed
const MAX_LATENCY = 2000;        // ignore pauses longer than this (ms) - user looked away
const MIN_MISTAKES = 5;          // mistakes needed before displaying recovery cost

// Bayesian / Laplace smoothing priors for error rate: (misses + ALPHA) / (attempts + BETA)
// Prior Design Note:
// Currently uses fixed Laplace hyperparameters (alpha = 1, beta = 10), which assumes a prior error rate of 10% (1/10).
// Architectural Proposal: In a future iteration, compute an empirical Bayes prior directly from the user's overall
// session/all-time error rate (priorRate = totalMisses / totalAttempts). The hyperparameters would then scale as
// alpha = priorRate * M and beta = M (where M is a pseudo-observation strength parameter, e.g., M = 10).
// This dynamically calibrates priors without penalizing typists whose baseline accuracy is 99%+.
const SMOOTH_ALPHA = 1;
const SMOOTH_BETA = 10;

// Storage Keys
const STORAGE_KEY = "keygap-stats";
const RECOVERY_KEY = "keygap-recovery";
const RECOVERY_BY_KEY = "keygap-recovery-by-key";
const LATENCY_KEY = "keygap-latency";
const LAYOUT_KEY = "keygap-layout";
const SCHEMA_VERSION = 1;

// In-memory fallback if localStorage is blocked or full
let memoryStorage = {};
let storageAlertShown = false;

function safeGet(key, defaultVal) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return defaultVal;
        return JSON.parse(raw) ?? defaultVal;
    } catch (e) {
        showStorageWarning();
        return memoryStorage[key] ?? defaultVal;
    }
}

function safeSet(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        showStorageWarning();
        memoryStorage[key] = value;
    }
}

function showStorageWarning() {
    if (storageAlertShown) return;
    storageAlertShown = true;
    const alertBox = document.getElementById("storage-alert");
    if (alertBox) {
        alertBox.style.display = "flex";
    }
}

// ---------- Keyboard Physical Layout Definitions ----------
const LAYOUTS = {
    qwerty: ["1234567890-=", "qwertyuiop[]", "asdfghjkl;'", "zxcvbnm,./"],
    dvorak: ["1234567890[]", "',.pyfgcrl/=", "aoeuidhtns-", ";qjkxbwmvz"],
    colemak: ["1234567890-=", "qwfpgjluy;[]", "arstdhneio'", "zxcvbkm,./"]
};

let currentLayout = safeGet(LAYOUT_KEY, "qwerty");
if (!LAYOUTS[currentLayout]) currentLayout = "qwerty";

// ---------- Rich Paragraph Pool ----------
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

// Words for practice drills
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

// ---------- DOM Elements ----------
const textbox = document.getElementById("text");
const results = document.getElementById("results");
const recoveryBox = document.getElementById("recovery");
const weakBox = document.getElementById("weak");
const allTimeBox = document.getElementById("alltime");
const latencyRankBox = document.getElementById("latency-rank");
const keyboardBox = document.getElementById("keyboard");
const customBox = document.getElementById("custom");
const charCounter = document.getElementById("char-counter");
const largeTextAlert = document.getElementById("large-text-alert");
const largeTextMsg = document.getElementById("large-text-msg");

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

// Data Management Buttons
const resetBtn = document.getElementById("reset-stats");
const exportBtn = document.getElementById("export-stats");
const importBtn = document.getElementById("import-stats");
const importFileInput = document.getElementById("import-file");
const dismissStorageAlertBtn = document.getElementById("dismiss-storage-alert");

// Mode & Timer Segmented Controls
const modeUntimedBtn = document.getElementById("mode-untimed");
const mode60sBtn = document.getElementById("mode-60s");
const mode120sBtn = document.getElementById("mode-120s");
const segmentBtns = [modeUntimedBtn, mode60sBtn, mode120sBtn];

// Heatmap Mode & Layout Selectors
const heatModeErrorBtn = document.getElementById("heat-mode-error");
const heatModeLatencyBtn = document.getElementById("heat-mode-latency");
const heatModeRecoveryBtn = document.getElementById("heat-mode-recovery");
const heatmapDescNote = document.getElementById("heatmap-desc-note");
const heatmapDynamicLegend = document.getElementById("heatmap-dynamic-legend");
const layoutDropdown = document.getElementById("keyboard-layout");

// ---------- State ----------
let sentence = getRandomParagraph();
let currentModeName = "Untimed";
let timerLimit = 0; // 0 = Untimed (full text accuracy check), 60 = 60s, 120 = 120s
let currentIndex = 0;
let startTime = null;
let totalPresses = 0;
let wrongPresses = 0;
let records = [];
let lastKeyTime = null;
let liveInterval = null;
let isTestActive = false;
let heatmapMetric = "error"; // "error" | "latency" | "recovery"

// Rolling baseline speed of recent correct keystrokes
let recentCorrectLatencies = [];

// Virtualized text window state for massive text performance
const VIRTUAL_THRESHOLD = 500;
const WINDOW_BEFORE = 35;
const WINDOW_AFTER = 145;
let isVirtualized = false;
let windowStartIndex = 0;
let windowEndIndex = 0;

// =====================================================
// Text Rendering (Virtualized Sliding Window for 500k+ Chars)
// =====================================================
function renderTextDisplay() {
    isVirtualized = sentence.length > VIRTUAL_THRESHOLD;

    if (largeTextAlert) {
        if (isVirtualized) {
            largeTextAlert.style.display = "flex";
            if (largeTextMsg) {
                largeTextMsg.textContent = `Large text (${sentence.length.toLocaleString()} characters). Virtualized 180-character sliding buffer active for 60fps typing.`;
            }
        } else {
            largeTextAlert.style.display = "none";
        }
    }

    if (!isVirtualized) {
        // Direct full DOM render for normal passages
        windowStartIndex = 0;
        windowEndIndex = sentence.length;
        textbox.innerHTML = "";
        for (let i = 0; i < sentence.length; i++) {
            const letter = document.createElement("span");
            letter.textContent = sentence[i];
            textbox.appendChild(letter);
        }
    } else {
        // Sliding window render
        renderSlidingWindow();
    }
}

function renderSlidingWindow() {
    const start = Math.max(0, currentIndex - WINDOW_BEFORE);
    const end = Math.min(sentence.length, start + WINDOW_BEFORE + WINDOW_AFTER);
    windowStartIndex = start;
    windowEndIndex = end;

    textbox.innerHTML = "";

    if (start > 0) {
        const prefix = document.createElement("span");
        prefix.style.color = "var(--text-muted)";
        prefix.style.fontSize = "16px";
        prefix.textContent = `... [${start} chars prior] `;
        textbox.appendChild(prefix);
    }

    for (let i = start; i < end; i++) {
        const letter = document.createElement("span");
        letter.textContent = sentence[i];
        if (i < currentIndex) {
            letter.className = "correct";
        }
        textbox.appendChild(letter);
    }

    if (end < sentence.length) {
        const suffix = document.createElement("span");
        suffix.style.color = "var(--text-muted)";
        suffix.style.fontSize = "16px";
        suffix.textContent = ` ... [${(sentence.length - end).toLocaleString()} more]`;
        textbox.appendChild(suffix);
    }

    updateSpanCursor();
}

function updateSpanCursor() {
    const spans = textbox.querySelectorAll("span:not([style*='font-size'])");
    spans.forEach(s => s.classList.remove("current"));

    const localIndex = currentIndex - windowStartIndex;
    if (localIndex >= 0 && localIndex < spans.length) {
        spans[localIndex].classList.add("current");
        spans[localIndex].scrollIntoView({ block: "nearest", inline: "nearest" });
    }
}

// =====================================================
// Setting up a test
// =====================================================
function startTest(forceNewSentence = false) {
    if (liveInterval) {
        clearInterval(liveInterval);
        liveInterval = null;
    }

    if (forceNewSentence && currentModeName === "Standard") {
        sentence = getRandomParagraph();
    }

    results.innerHTML = "";
    weakBox.innerHTML = "<span style='color:var(--text-muted);'>Complete a test round to view your weakest keys.</span>";

    currentIndex = 0;
    startTime = null;
    totalPresses = 0;
    wrongPresses = 0;
    records = [];
    lastKeyTime = null;
    recentCorrectLatencies = [];
    isTestActive = true;

    renderTextDisplay();
    updateSpanCursor();

    // Reset HUD
    if (hudWpm) hudWpm.textContent = "0";
    if (hudAcc) hudAcc.innerHTML = "100<small>%</small>";
    if (hudTime) {
        hudTime.classList.remove("time-warning");
        hudTime.innerHTML = timerLimit > 0 ? `${timerLimit}.0<small>s</small>` : "0.0<small>s</small>";
    }
    updateModeDisplay();

    if (arenaStatus) {
        arenaStatus.textContent = timerLimit > 0
            ? `Ready. Start typing to begin the ${timerLimit}s countdown.`
            : "Untimed Mode: Type through the passage to measure accuracy & recovery cost.";
    }
}

function updateModeDisplay() {
    if (!hudMode) return;
    if (timerLimit === 60) {
        hudMode.textContent = "60s Timed";
    } else if (timerLimit === 120) {
        hudMode.textContent = "120s Timed";
    } else {
        hudMode.textContent = currentModeName;
    }
}

function setSentence(text, modeName = "Standard") {
    currentModeName = modeName;
    sentence = text;
    startTest(false);
}

// Live timer tick for real-time HUD updates
function updateLiveHud() {
    if (!startTime || !isTestActive) return;
    const now = Date.now();
    const elapsedSeconds = (now - startTime) / 1000;
    const minutes = elapsedSeconds / 60;

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
        if (remaining <= 0) {
            showResults(true); // Timed out
        }
    } else {
        if (hudTime) {
            hudTime.innerHTML = `${elapsedSeconds.toFixed(1)}<small>s</small>`;
        }
    }
}

// =====================================================
// Data Persistence (Robust LocalStorage & Fallback)
// =====================================================
function loadStats() {
    return safeGet(STORAGE_KEY, {});
}

function saveStats(stats) {
    safeSet(STORAGE_KEY, stats);
}

function emptyRecovery() {
    return { totalLostMs: 0, mistakes: 0, baselineSum: 0, baselineCount: 0 };
}

function loadRecovery() {
    return safeGet(RECOVERY_KEY, emptyRecovery());
}

function saveRecovery(data) {
    safeSet(RECOVERY_KEY, data);
}

function loadRecoveryByKey() {
    return safeGet(RECOVERY_BY_KEY, {});
}

function saveRecoveryByKey(data) {
    safeSet(RECOVERY_BY_KEY, data);
}

function loadLatency() {
    return safeGet(LATENCY_KEY, {});
}

function saveLatency(data) {
    safeSet(LATENCY_KEY, data);
}

// =====================================================
// Statistical Noise Fix: Bayesian/Laplace Weak-Key Ranking
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

// Applies Laplace/Bayesian smoothing: (misses + ALPHA) / (attempts + BETA)
function rankWeakKeys(stats, minAttempts) {
    const list = [];
    for (const key in stats) {
        if (stats[key].attempts >= minAttempts && stats[key].misses > 0) {
            const rawRate = stats[key].misses / stats[key].attempts;
            // Bayesian smoothed rate prevents a 1/2 from beating a 9/30
            const smoothedRate = (stats[key].misses + SMOOTH_ALPHA) / (stats[key].attempts + SMOOTH_BETA);
            list.push({
                key: key,
                attempts: stats[key].attempts,
                misses: stats[key].misses,
                rate: rawRate,
                smoothedRate: smoothedRate
            });
        }
    }

    // Sort by smoothed rate descending
    list.sort((a, b) => b.smoothedRate - a.smoothedRate);
    return list.slice(0, 5);
}

function renderWeakKeysHtml(weak, emptyMsg) {
    if (weak.length === 0) {
        return `<span style="color:var(--accent-emerald);">${emptyMsg}</span>`;
    }

    let html = '<div class="stat-pill-list">';
    for (let i = 0; i < weak.length; i++) {
        let name = weak[i].key === " " ? "␣ Space" : weak[i].key;
        const percent = Math.round(weak[i].rate * 100);
        html += `
            <div class="stat-pill-item">
                <span class="key-badge">${name}</span>
                <span class="stat-rate">${percent}% error</span>
                <span class="stat-sub">${weak[i].misses} misses in ${weak[i].attempts} attempts</span>
            </div>
        `;
    }
    html += '</div>';
    return html;
}

function showRoundWeakKeys(roundStats) {
    const weak = rankWeakKeys(roundStats, MIN_ROUND);
    weakBox.innerHTML = renderWeakKeysHtml(
        weak,
        `No weak keys met the ${MIN_ROUND}-attempt threshold with mistakes this round.`
    );
}

// =====================================================
// Headline Feature: Recovery Cost (Hesitation Latency)
// =====================================================
function measureRecovery(list) {
    const roundByKey = {};
    let totalLostMs = 0;
    let mistakes = 0;
    let baselineSum = 0;
    let baselineCount = 0;

    for (let i = 0; i < list.length; i++) {
        if (list[i].correct && list[i].latency !== null && list[i].latency <= MAX_LATENCY) {
            baselineSum += list[i].latency;
            baselineCount++;
        }
    }

    const roundFallbackBaseline = baselineCount > 0 ? (baselineSum / baselineCount) : 220;

    for (let i = 0; i < list.length; i++) {
        if (!list[i].correct) {
            mistakes++;
            const mistypedKey = list[i].expected;
            if (!roundByKey[mistypedKey]) {
                roundByKey[mistypedKey] = { totalLostMs: 0, count: 0 };
            }

            // Baseline frozen at the exact moment of this mistake (excludes post-error keystrokes)
            const baseline = (list[i].baselineAtError !== undefined && list[i].baselineAtError !== null)
                ? list[i].baselineAtError
                : roundFallbackBaseline;

            let extraLost = 0;
            // Measure subsequent keystrokes up to RECOVERY_LOOKAHEAD (5) or until velocity recovers within 15%
            for (let j = i + 1; j <= i + RECOVERY_LOOKAHEAD && j < list.length; j++) {
                const t = list[j].latency;
                if (t === null || t > MAX_LATENCY) continue;

                if (t > baseline) {
                    extraLost += (t - baseline);
                }
                // Stopped hesitating once keystroke reaches baseline pace (within 15%)
                if (t <= baseline * 1.15) break;
            }

            totalLostMs += extraLost;
            roundByKey[mistypedKey].totalLostMs += extraLost;
            roundByKey[mistypedKey].count++;
        }
    }

    return {
        totals: { totalLostMs, mistakes, baselineSum, baselineCount },
        byKey: roundByKey
    };
}

function addRecovery(saved, fresh) {
    return {
        totalLostMs: saved.totalLostMs + fresh.totalLostMs,
        mistakes: saved.mistakes + fresh.mistakes,
        baselineSum: saved.baselineSum + fresh.baselineSum,
        baselineCount: saved.baselineCount + fresh.baselineCount
    };
}

function addRecoveryByKey(saved, fresh) {
    for (const key in fresh) {
        if (!saved[key]) {
            saved[key] = { totalLostMs: 0, count: 0 };
        }
        saved[key].totalLostMs += fresh[key].totalLostMs;
        saved[key].count += fresh[key].count;
    }
    return saved;
}

function showRecovery() {
    const d = loadRecovery();
    const byKey = loadRecoveryByKey();

    if (d.mistakes < MIN_MISTAKES) {
        recoveryBox.innerHTML = `
            <div style="padding: 10px 0; color: var(--text-muted);">
                Calibrating baseline recovery data...<br>
                Requires <strong>${MIN_MISTAKES}</strong> logged mistakes to reliably calculate hesitation cost.<br>
                Progress: <strong style="color:var(--accent-cyan);">${d.mistakes} / ${MIN_MISTAKES}</strong> mistakes logged.
            </div>
        `;
        return;
    }

    const avgBaseline = d.baselineCount > 0 ? (d.baselineSum / d.baselineCount) : 220;
    const avgLostPerMistake = d.totalLostMs / d.mistakes;

    // Rank keys that trigger the greatest recovery hesitation
    const worstKeys = [];
    for (const k in byKey) {
        if (byKey[k].count >= 2 && byKey[k].totalLostMs > 0) {
            worstKeys.push({
                key: k,
                avgLost: byKey[k].totalLostMs / byKey[k].count,
                count: byKey[k].count
            });
        }
    }
    worstKeys.sort((a, b) => b.avgLost - a.avgLost);

    let worstKeySnippet = "";
    if (worstKeys.length > 0) {
        const top = worstKeys.slice(0, 3);
        worstKeySnippet = `
            <div style="margin-top: 14px;">
                <div style="font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px; text-transform: uppercase;">
                    Top Hesitation Triggers (Highest delay after typo):
                </div>
                <div class="stat-pill-list">
                    ${top.map(item => `
                        <div class="stat-pill-item">
                            <span class="key-badge recovery-badge">${item.key === " " ? "␣ Space" : item.key}</span>
                            <span class="stat-rate" style="color:var(--accent-rose);">+${Math.round(item.avgLost)} ms lost</span>
                            <span class="stat-sub">${item.count} errors analyzed</span>
                        </div>
                    `).join("")}
                </div>
            </div>
        `;
    }

    recoveryBox.innerHTML = `
        <div class="stat-pill-list">
            <div class="stat-pill-item" style="background: rgba(99, 102, 241, 0.12); border-color: rgba(99, 102, 241, 0.35);">
                <div>
                    <span style="font-weight: 700; color: #ffffff;">Average Recovery Penalty</span>
                    <div style="font-size: 12px; color: #a5b4fc;">Extra delay after every mistake before returning to baseline</div>
                </div>
                <strong style="color:var(--accent-rose); font-size: 18px;">+${Math.round(avgLostPerMistake)} ms / typo</strong>
            </div>
            <div class="stat-pill-item">
                <span>Baseline Typing Cadence (Rolling median of correct keystrokes)</span>
                <strong style="color:var(--accent-cyan); font-size: 15px;">${Math.round(avgBaseline)} ms / key</strong>
            </div>
        </div>
        ${worstKeySnippet}
    `;
}

// =====================================================
// Feature: Per-Key Latency Tracking & Ranking
// =====================================================
function countLatency(list) {
    const fresh = {};
    for (let i = 0; i < list.length; i++) {
        if (list[i].correct && list[i].latency !== null && list[i].latency <= MAX_LATENCY) {
            const key = list[i].expected;
            if (!fresh[key]) {
                fresh[key] = { totalMs: 0, count: 0 };
            }
            fresh[key].totalMs += list[i].latency;
            fresh[key].count++;
        }
    }
    return fresh;
}

function addLatency(saved, fresh) {
    for (const key in fresh) {
        if (!saved[key]) {
            saved[key] = { totalMs: 0, count: 0 };
        }
        saved[key].totalMs += fresh[key].totalMs;
        saved[key].count += fresh[key].count;
    }
    return saved;
}

function showLatencyRank() {
    const latStats = loadLatency();
    const ranked = [];

    for (const k in latStats) {
        if (latStats[k].count >= 10) {
            ranked.push({
                key: k,
                avgMs: latStats[k].totalMs / latStats[k].count,
                count: latStats[k].count
            });
        }
    }

    ranked.sort((a, b) => b.avgMs - a.avgMs);

    if (ranked.length === 0) {
        latencyRankBox.innerHTML = `
            <div style="color: var(--text-muted); padding: 8px 0;">
                Calibrating speed metrics...<br>
                Requires at least <strong>10</strong> correct keystrokes per key.
            </div>
        `;
        return;
    }

    const topSlow = ranked.slice(0, 5);
    let html = '<div class="stat-pill-list">';
    for (let i = 0; i < topSlow.length; i++) {
        const name = topSlow[i].key === " " ? "␣ Space" : topSlow[i].key;
        html += `
            <div class="stat-pill-item">
                <span class="key-badge latency-badge">${name}</span>
                <span class="stat-rate" style="color:var(--accent-cyan);">${Math.round(topSlow[i].avgMs)} ms</span>
                <span class="stat-sub">${topSlow[i].count} correct samples</span>
            </div>
        `;
    }
    html += '</div>';
    latencyRankBox.innerHTML = html;
}

// =====================================================
// Keyboard Heatmap (Error Rate, Latency & Recovery Modes)
// =====================================================
function makeKeyElement(key, savedStats, savedLatency, savedRecoveryByKey) {
    const el = document.createElement("div");
    el.className = "kb-key";
    el.textContent = key === " " ? "space" : key;

    const names = [key];
    if (key.toUpperCase() !== key) names.push(key.toUpperCase());

    // Aggregate attempts and misses across case variants
    let attempts = 0;
    let misses = 0;
    let totalLatencyMs = 0;
    let latencyCount = 0;
    let recoveryPenaltyMs = 0;
    let recoveryCount = 0;

    for (let i = 0; i < names.length; i++) {
        const s = savedStats[names[i]];
        if (s) {
            attempts += s.attempts;
            misses += s.misses;
        }
        const l = savedLatency[names[i]];
        if (l) {
            totalLatencyMs += l.totalMs;
            latencyCount += l.count;
        }
        const r = savedRecoveryByKey[names[i]];
        if (r) {
            recoveryPenaltyMs += r.totalLostMs;
            recoveryCount += r.count;
        }
    }

    const minRequired = MIN_HEAT;

    if (heatmapMetric === "error") {
        if (attempts < minRequired) {
            el.classList.add("nodata");
            el.title = `Key: '${key}' | ${attempts} attempts (${misses} misses)\nNeeds at least ${minRequired} attempts for calibration.`;
        } else {
            const rawRate = misses / attempts;
            const smoothedRate = (misses + SMOOTH_ALPHA) / (attempts + SMOOTH_BETA);
            // 0% error = Hue 120 (emerald green), 30%+ error = Hue 0 (crimson red)
            const hue = 120 * (1 - Math.min(rawRate / 0.30, 1));
            el.style.backgroundColor = `hsl(${hue}, 68%, 38%)`;
            el.style.color = "#ffffff";
            el.style.borderColor = `hsl(${hue}, 80%, 55%)`;
            el.title = `Key: '${key}' | ${Math.round(rawRate * 100)}% error rate (smoothed: ${(smoothedRate * 100).toFixed(1)}%) • ${misses} misses in ${attempts} attempts`;
        }
    } else if (heatmapMetric === "latency") {
        if (latencyCount < minRequired) {
            el.classList.add("nodata");
            el.title = `Key: '${key}' | ${latencyCount} samples\nNeeds at least ${minRequired} samples to evaluate speed.`;
        } else {
            const avgMs = totalLatencyMs / latencyCount;
            // Fast (<160ms = Green/Cyan Hue 140) down to Slow (>380ms = Rose/Red Hue 0)
            const clamped = Math.max(140, Math.min(avgMs, 380));
            const hue = 140 * (1 - (clamped - 140) / (380 - 140));
            el.style.backgroundColor = `hsl(${hue}, 70%, 36%)`;
            el.style.color = "#ffffff";
            el.style.borderColor = `hsl(${hue}, 80%, 55%)`;
            el.title = `Key: '${key}' | ${Math.round(avgMs)} ms average latency (${latencyCount} correct keypresses)`;
        }
    } else if (heatmapMetric === "recovery") {
        if (recoveryCount < 2) {
            el.classList.add("nodata");
            el.title = `Key: '${key}' | ${recoveryCount} mistake samples\nNeeds more mistake occurrences to measure recovery delay.`;
        } else {
            const avgPenalty = recoveryPenaltyMs / recoveryCount;
            // Low penalty (<100ms = Green Hue 120) to High penalty (>400ms = Red Hue 0)
            const clamped = Math.max(80, Math.min(avgPenalty, 400));
            const hue = 120 * (1 - (clamped - 80) / (400 - 80));
            el.style.backgroundColor = `hsl(${hue}, 70%, 36%)`;
            el.style.color = "#ffffff";
            el.style.borderColor = `hsl(${hue}, 80%, 55%)`;
            el.title = `Key: '${key}' | +${Math.round(avgPenalty)} ms hesitation delay after mistakes (${recoveryCount} typos)`;
        }
    }

    return el;
}

function drawKeyboard() {
    const savedStats = loadStats();
    const savedLatency = loadLatency();
    const savedRecoveryByKey = loadRecoveryByKey();

    keyboardBox.innerHTML = "";
    const activeLayoutRows = LAYOUTS[currentLayout] || LAYOUTS.qwerty;

    for (let r = 0; r < activeLayoutRows.length; r++) {
        const row = document.createElement("div");
        row.className = "kb-row";
        row.style.marginLeft = `${r * 18}px`;

        for (let c = 0; c < activeLayoutRows[r].length; c++) {
            row.appendChild(makeKeyElement(activeLayoutRows[r][c], savedStats, savedLatency, savedRecoveryByKey));
        }
        keyboardBox.appendChild(row);
    }

    // Spacebar row
    const spaceRow = document.createElement("div");
    spaceRow.className = "kb-row";
    spaceRow.style.marginLeft = "105px";
    const spaceKey = makeKeyElement(" ", savedStats, savedLatency, savedRecoveryByKey);
    spaceKey.classList.add("space");
    spaceRow.appendChild(spaceKey);
    keyboardBox.appendChild(spaceRow);
}

function updateHeatmapControls() {
    [heatModeErrorBtn, heatModeLatencyBtn, heatModeRecoveryBtn].forEach(b => {
        if (b) b.classList.remove("active");
    });

    if (heatmapMetric === "error" && heatModeErrorBtn) {
        heatModeErrorBtn.classList.add("active");
        if (heatmapDescNote) heatmapDescNote.textContent = "Live error rate heatmap based on Bayesian-smoothed keystroke accuracy";
        if (heatmapDynamicLegend) {
            heatmapDynamicLegend.innerHTML = `
                <div class="legend-item"><span class="legend-chip chip-good"></span> Clean (0% error)</div>
                <div class="legend-item"><span class="legend-chip chip-mid"></span> Moderate error</div>
                <div class="legend-item"><span class="legend-chip chip-bad"></span> High error rate</div>
                <div class="legend-item"><span class="legend-chip chip-none"></span> Not enough data (&lt; ${MIN_HEAT} attempts)</div>
            `;
        }
    } else if (heatmapMetric === "latency" && heatModeLatencyBtn) {
        heatModeLatencyBtn.classList.add("active");
        if (heatmapDescNote) heatmapDescNote.textContent = "Keystroke velocity heatmap (time between keystrokes on correct presses)";
        if (heatmapDynamicLegend) {
            heatmapDynamicLegend.innerHTML = `
                <div class="legend-item"><span class="legend-chip chip-good"></span> Fast (&lt; 160 ms)</div>
                <div class="legend-item"><span class="legend-chip chip-mid"></span> Average (~250 ms)</div>
                <div class="legend-item"><span class="legend-chip chip-bad"></span> Slow (&gt; 380 ms)</div>
                <div class="legend-item"><span class="legend-chip chip-none"></span> Not enough data (&lt; ${MIN_HEAT} samples)</div>
            `;
        }
    } else if (heatmapMetric === "recovery" && heatModeRecoveryBtn) {
        heatModeRecoveryBtn.classList.add("active");
        if (heatmapDescNote) heatmapDescNote.textContent = "Post-error recovery hesitation delay caused when this key is mistyped";
        if (heatmapDynamicLegend) {
            heatmapDynamicLegend.innerHTML = `
                <div class="legend-item"><span class="legend-chip chip-good"></span> Fast recovery (&lt; 100 ms lost)</div>
                <div class="legend-item"><span class="legend-chip chip-mid"></span> Moderate delay (~220 ms)</div>
                <div class="legend-item"><span class="legend-chip chip-bad"></span> Heavy hesitation (&gt; 380 ms lost)</div>
                <div class="legend-item"><span class="legend-chip chip-none"></span> No mistake data</div>
            `;
        }
    }

    drawKeyboard();
}

// =====================================================
// Showing All Diagnostics
// =====================================================
function showAllTime() {
    const saved = loadStats();
    const weak = rankWeakKeys(saved, MIN_ALL_TIME);

    allTimeBox.innerHTML = renderWeakKeysHtml(
        weak,
        `Accumulating data... Keys require at least ${MIN_ALL_TIME} attempts to qualify for all-time rankings.`
    );

    showRecovery();
    showLatencyRank();
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
            chosen.push(pool.length > 0 ? (key + pickRandom(pool).slice(1)) : (key + pickRandom(WORDS)));
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
                <div>${currentIndex.toLocaleString()} / ${sentence.length.toLocaleString()} characters typed (${typedWords} words)</div>
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

    // Process diagnostics
    const roundStats = countKeys(records);
    showRoundWeakKeys(roundStats);

    const recResult = measureRecovery(records);
    const roundLatency = countLatency(records);

    saveStats(addStats(loadStats(), roundStats));
    saveRecovery(addRecovery(loadRecovery(), recResult.totals));
    saveRecoveryByKey(addRecoveryByKey(loadRecoveryByKey(), recResult.byKey));
    saveLatency(addLatency(loadLatency(), roundLatency));

    showAllTime();

    if (currentModeName === "Standard") {
        sentence = getRandomParagraph();
    }
}

// =====================================================
// Keyboard Listener (Mapping by character, not physical scancode)
// =====================================================
document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        event.preventDefault();
        startTest(!isTestActive);
        return;
    }

    if (event.target.tagName === "TEXTAREA" || event.target.tagName === "SELECT") {
        return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
    }

    if (event.key.length > 1) {
        return;
    }

    if (!isTestActive || currentIndex >= sentence.length) {
        return;
    }

    if (event.key === " ") {
        event.preventDefault();
    }

    const now = Date.now();
    if (startTime === null) {
        startTime = now;
        if (arenaStatus) {
            arenaStatus.textContent = timerLimit > 0
                ? `Timing active! ${timerLimit}s countdown running...`
                : "Untimed mode: Testing accuracy & keystroke latency across passage...";
        }
        liveInterval = setInterval(updateLiveHud, 100);
    }

    let latency = null;
    if (lastKeyTime !== null) {
        latency = now - lastKeyTime;
    }
    lastKeyTime = now;

    totalPresses++;

    let baselineAtError = null;
    if (!isCorrect) {
        if (recentCorrectLatencies.length > 0) {
            const sum = recentCorrectLatencies.reduce((acc, val) => acc + val, 0);
            baselineAtError = sum / recentCorrectLatencies.length;
        } else {
            baselineAtError = 220; // Default baseline cadence before sufficient correct keystrokes
        }
    }

    records.push({
        expected: expected,
        typed: event.key,
        correct: isCorrect,
        latency: latency,
        baselineAtError: baselineAtError
    });

    if (isCorrect) {
        if (latency !== null && latency <= MAX_LATENCY) {
            recentCorrectLatencies.push(latency);
            if (recentCorrectLatencies.length > BASELINE_WINDOW) {
                recentCorrectLatencies.shift();
            }
        }

        currentIndex++;

        if (isVirtualized) {
            // If near edge of rendered window, slide the window
            if (currentIndex >= windowEndIndex - 15 || currentIndex <= windowStartIndex + 5) {
                renderSlidingWindow();
            } else {
                updateSpanCursor();
            }
        } else {
            const spans = textbox.querySelectorAll("span");
            if (spans[currentIndex - 1]) {
                spans[currentIndex - 1].className = "correct";
            }
            if (currentIndex < sentence.length && spans[currentIndex]) {
                spans[currentIndex].classList.add("current");
                spans[currentIndex].scrollIntoView({ block: "nearest", inline: "nearest" });
            }
        }

        if (currentIndex >= sentence.length) {
            showResults(false);
        }
    } else {
        wrongPresses++;
        if (!isVirtualized) {
            const spans = textbox.querySelectorAll("span");
            if (spans[currentIndex]) {
                spans[currentIndex].classList.add("wrong");
            }
        }
    }

    updateLiveHud();
});

// =====================================================
// Data Export & Import Handlers (JSON with schema version)
// =====================================================
if (exportBtn) {
    exportBtn.addEventListener("click", function () {
        const backupData = {
            schemaVersion: SCHEMA_VERSION,
            app: "KeyGap",
            exportedAt: new Date().toISOString(),
            stats: loadStats(),
            recovery: loadRecovery(),
            recoveryByKey: loadRecoveryByKey(),
            latency: loadLatency(),
            layout: currentLayout
        };

        const jsonStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const dateStr = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `keygap-backup-${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        exportBtn.blur();
    });
}

if (importBtn && importFileInput) {
    importBtn.addEventListener("click", function () {
        importFileInput.click();
        importBtn.blur();
    });

    importFileInput.addEventListener("change", function (e) {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (event) {
            try {
                const parsed = JSON.parse(event.target.result);

                if (!parsed || typeof parsed !== "object" || parsed.schemaVersion !== SCHEMA_VERSION) {
                    alert("Invalid backup file: Unrecognized schema version or damaged JSON format.");
                    return;
                }

                const mergeChoice = confirm(
                    "KeyGap Data Import:\n\n" +
                    "Click OK to MERGE imported statistics with your existing data.\n" +
                    "Click Cancel to REPLACE all existing statistics with the backup file."
                );

                if (mergeChoice) {
                    // Merge
                    const mergedStats = addStats(loadStats(), parsed.stats || {});
                    const mergedRecovery = addRecovery(loadRecovery(), parsed.recovery || emptyRecovery());
                    const mergedRecoveryByKey = addRecoveryByKey(loadRecoveryByKey(), parsed.recoveryByKey || {});
                    const mergedLatency = addLatency(loadLatency(), parsed.latency || {});

                    saveStats(mergedStats);
                    saveRecovery(mergedRecovery);
                    saveRecoveryByKey(mergedRecoveryByKey);
                    saveLatency(mergedLatency);
                } else {
                    // Replace
                    saveStats(parsed.stats || {});
                    saveRecovery(parsed.recovery || emptyRecovery());
                    saveRecoveryByKey(parsed.recoveryByKey || {});
                    saveLatency(parsed.latency || {});
                }

                if (parsed.layout && LAYOUTS[parsed.layout]) {
                    currentLayout = parsed.layout;
                    safeSet(LAYOUT_KEY, currentLayout);
                    if (layoutDropdown) layoutDropdown.value = currentLayout;
                }

                showAllTime();
                alert("Data imported successfully!");
            } catch (err) {
                alert("Error importing file: Could not parse JSON. " + err.message);
            } finally {
                importFileInput.value = "";
            }
        };
        reader.readAsText(file);
    });
}

if (resetBtn) {
    resetBtn.addEventListener("click", function () {
        if (confirm("Are you sure you want to permanently reset all KeyGap typing statistics? This cannot be undone.")) {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(RECOVERY_KEY);
            localStorage.removeItem(RECOVERY_BY_KEY);
            localStorage.removeItem(LATENCY_KEY);
            memoryStorage = {};
            showAllTime();
            startTest(false);
        }
        resetBtn.blur();
    });
}

if (dismissStorageAlertBtn) {
    dismissStorageAlertBtn.addEventListener("click", function () {
        const alertBox = document.getElementById("storage-alert");
        if (alertBox) alertBox.style.display = "none";
    });
}

// =====================================================
// Layout & Heatmap Metric Listeners
// =====================================================
if (layoutDropdown) {
    layoutDropdown.value = currentLayout;
    layoutDropdown.addEventListener("change", function () {
        const val = layoutDropdown.value;
        if (LAYOUTS[val]) {
            currentLayout = val;
            safeSet(LAYOUT_KEY, currentLayout);
            drawKeyboard();
        }
    });
}

if (heatModeErrorBtn) {
    heatModeErrorBtn.addEventListener("click", function () {
        heatmapMetric = "error";
        updateHeatmapControls();
    });
}

if (heatModeLatencyBtn) {
    heatModeLatencyBtn.addEventListener("click", function () {
        heatmapMetric = "latency";
        updateHeatmapControls();
    });
}

if (heatModeRecoveryBtn) {
    heatModeRecoveryBtn.addEventListener("click", function () {
        heatmapMetric = "recovery";
        updateHeatmapControls();
    });
}

// =====================================================
// Controls & Custom Text Handlers
// =====================================================
if (restartBtn) {
    restartBtn.addEventListener("click", function () {
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
            alert(`No weak keys identified yet. Complete test rounds until keys have at least ${MIN_PRACTICE} attempts!`);
        } else {
            setSentence(text, "Weak-Key Drill");
        }
        practiceBtn.blur();
    });
}

function setTimerMode(seconds, activeBtn) {
    timerLimit = seconds;
    segmentBtns.forEach(btn => {
        if (btn) btn.classList.remove("active");
    });
    if (activeBtn) activeBtn.classList.add("active");
    updateModeDisplay();
    startTest(false);
}

if (modeUntimedBtn) modeUntimedBtn.addEventListener("click", () => setTimerMode(0, modeUntimedBtn));
if (mode60sBtn) mode60sBtn.addEventListener("click", () => setTimerMode(60, mode60sBtn));
if (mode120sBtn) mode120sBtn.addEventListener("click", () => setTimerMode(120, mode120sBtn));

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

// =====================================================
// Initialization
// =====================================================
startTest(false);
updateHeatmapControls();
showAllTime();