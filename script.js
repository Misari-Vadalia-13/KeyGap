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

// ---------- Wikipedia Paragraph Pool & Dynamic Fetching Engine ----------
// Sourced and structured so average typists (~45-55 WPM) will not finish within 120 seconds.
const WIKI_FALLBACK_PARAGRAPHS = [
    {
        title: "James Webb Space Telescope",
        text: "The James Webb Space Telescope is a space telescope designed primarily to conduct infrared astronomy. As the largest optical telescope in space, its high resolution and sensitivity allow it to view objects too old, distant, or faint for the Hubble Space Telescope. This enables investigations across many fields of astronomy and cosmology, such as observation of the first stars and the formation of the first galaxies, and detailed atmospheric characterization of potentially habitable exoplanets. The telescope was launched on 25 December 2021 on an Ariane 5 rocket from Kourou, French Guiana, and arrived at the Sun-Earth L2 Lagrange point in January 2022. The first image from Webb was released to the public on 11 July 2022. The telescope's primary mirror consists of 18 hexagonal mirror segments made of gold-plated beryllium, which together create a 6.5-meter diameter mirror compared to Hubble's 2.4-meter mirror. Unlike Hubble, which observes in the near ultraviolet and optical spectra, Webb observes in a lower frequency range, from long-wavelength visible light through mid-infrared. The telescope must be kept extremely cold, below 50 Kelvin, to observe faint infrared signals without interference from any other thermal sources."
    },
    {
        title: "Alan Turing & Modern Computing",
        text: "Alan Mathison Turing was an English mathematician, computer scientist, logician, cryptanalyst, philosopher, and theoretical biologist. Turing was highly influential in the development of theoretical computer science, providing a formalisation of the concepts of algorithm and computation with the Turing machine, which can be considered a model of a general-purpose computer. He is widely considered to be the father of theoretical computer science and artificial intelligence. During the Second World War, Turing was a leading participant in war-time codebreaking at Bletchley Park. He played a pivotal role in cracking intercepted coded messages that enabled the Allies to defeat the Axis powers in many critical engagements, including the Battle of the Atlantic. After the war, Turing designed the Automatic Computing Engine, which was one of the first designs for a stored-program computer. In 1948, Turing joined Max Newman's Computing Machine Laboratory at the Victoria University of Manchester, where he helped develop the Manchester computers and became interested in mathematical biology. He wrote a landmark paper on the chemical basis of morphogenesis and predicted oscillating chemical reactions such as the Belousov-Zhabotinsky reaction."
    },
    {
        title: "Voyager 1 & Interstellar Mission",
        text: "Voyager 1 is a space probe launched by NASA on 5 September 1977 as part of the Voyager program to study the outer Solar System and interstellar space beyond the Sun's heliosphere. Launched 16 days after its twin Voyager 2, Voyager 1 operated for nearly five decades and continues to communicate with the Deep Space Network to receive routine commands and transmit science data. At a distance of over 160 astronomical units from Earth, it is the most distant human-made object from Earth. The probe made flybys of Jupiter, Saturn, and Saturn's largest moon, Titan. NASA opted to emphasize the Titan flyby because the moon was known to possess a dense atmosphere. Voyager 1 studied the weather, magnetic fields, and rings of the two gas giants and was the first probe to provide detailed images of their moons. After completing its primary planetary exploration mission with the flyby of Saturn in November 1980, Voyager 1 began an extended mission to explore the outer reaches of the Solar System. On 25 August 2012, Voyager 1 crossed the heliopause and entered interstellar space, making it the first spacecraft to leave the gravitational and magnetic dominance of the Sun."
    },
    {
        title: "The Great Barrier Reef",
        text: "The Great Barrier Reef is the world's largest coral reef system, composed of over 2,900 individual reefs and 900 islands stretching for over 2,300 kilometres over an area of approximately 344,400 square kilometres. The reef is located in the Coral Sea, off the coast of Queensland, Australia, separated from the coast by a channel 160 kilometres wide in places and over 61 metres deep. The Great Barrier Reef can be seen from outer space and is the world's biggest single structure made by living organisms. This reef structure is composed of and built by billions of tiny organisms, known as coral polyps. It supports a wide diversity of life and was selected as a World Heritage Site in 1981. A large part of the reef is protected by the Great Barrier Reef Marine Park, which helps to limit the impact of human use, such as fishing and tourism. Environmental pressures on the reef and its ecosystem include runoff, climate change accompanied by mass coral bleaching, dumping of dredge sludge and cyclic population outbreaks of the crown-of-thorns starfish. According to a study published in October 2020, the reef had lost more than half of its corals since 1995 due to warming sea temperatures driven by global climate change."
    },
    {
        title: "The Printing Press",
        text: "A printing press is a mechanical device for applying pressure to an inked surface resting upon a print medium, such as paper or cloth, thereby transferring the ink. It marked a dramatic improvement on earlier printing methods in which the cloth, paper or other medium was brushed or rubbed repeatedly to achieve the transfer of ink, and accelerated the process. Typically used for texts, the invention and global spread of the movable type printing press was one of the most influential events in the second millennium. In the mid-fifteenth century, Johannes Gutenberg introduced the mechanical movable type printing system to Europe, creating the Gutenberg Bible which was acclaimed for its aesthetic and technical quality. The rapid arrival of mechanical movable type printing across Renaissance Europe initiated the era of mass communication, which permanently altered the structure of society. The relatively unrestricted circulation of information and revolutionary ideas captured the masses in the Reformation and threatened the power of political and religious authorities. The sharp increase in literacy broke the monopoly of the literate elite on education and learning and bolstered the emerging middle class across the continent."
    },
    {
        title: "The Mariana Trench",
        text: "The Mariana Trench is an oceanic trench located in the western Pacific Ocean, about 200 kilometres east of the Mariana Islands. It is the deepest oceanic trench on Earth, crescent-shaped and measuring about 2,550 kilometres in length and 69 kilometres in width. The maximum known depth is 10,984 metres at the southern end of a small slot-shaped valley in its floor known as the Challenger Deep. If Mount Everest were placed into the trench at its deepest point, its peak would still be underwater by more than two kilometres. At the bottom of the trench, the water column above exerts a hydrostatic pressure of 1,086 bar, more than one thousand times the standard atmospheric pressure at sea level. At this extreme depth, the density of water is increased by nearly five percent. The temperature at the seabed is between one and four degrees Celsius. Despite the total absence of sunlight and immense pressure, organisms including microorganisms, xenophyophores, amphipods, and sea cucumbers thrive in the hadal zone. Expedition submersibles such as the Trieste in 1960 and the Deepsea Challenger in 2012 have successfully descended to the trench floor to map its topography and document extreme biological adaptations."
    },
    {
        title: "Solar Energy & Photovoltaics",
        text: "Solar energy is radiant light and heat from the Sun that is harnessed using a range of technologies such as solar power to generate electricity, solar thermal energy including solar water heating, and solar architecture. It is an essential source of renewable energy, and its technologies are broadly characterized as either passive solar or active solar depending on how they capture and distribute solar energy or convert it into solar power. Active solar techniques include the use of photovoltaic systems, concentrated solar power, and solar water heating to harness the energy. Passive solar techniques include orienting a building to the Sun, selecting materials with favourable thermal mass or light-dispersing properties, and designing spaces that naturally circulate air. The large magnitude of solar energy available makes it a highly appealing source of electricity. Photovoltaic solar cells convert sunlight directly into electricity by the photovoltaic effect, which generates electric current in a semiconductor material when exposed to photons of light. Rapid manufacturing advances and economies of scale have driven down the cost of photovoltaic installations dramatically, making solar generation one of the most cost-effective methods for clean power generation globally."
    },
    {
        title: "Apollo 11 & The Moon Landing",
        text: "Apollo 11 was the American spaceflight that first landed humans on the Moon. Commander Neil Armstrong and Lunar Module Pilot Buzz Aldrin landed the Apollo Lunar Module Eagle on 20 July 1969, and Armstrong became the first person to step onto the lunar surface six hours and 39 minutes later on 21 July. Aldrin joined him 19 minutes later, and they spent about two and a quarter hours together exploring the site they had named Tranquility Base upon landing. Armstrong and Aldrin collected 21.5 kilograms of lunar material to bring back to Earth as Command Module Pilot Michael Collins flew the Command Module Columbia in lunar orbit. The mission was launched by a Saturn V rocket from Kennedy Space Center on Merritt Island, Florida, on 16 July, and was the fifth crewed mission of NASA's Apollo program. Apollo 11 effectively ended the Space Race and fulfilled a national goal proposed in 1961 by President John F. Kennedy to land a man on the Moon and return him safely to the Earth before the decade was out. The event was broadcast live on worldwide television to an estimated audience of 650 million viewers, marking an unprecedented milestone in human exploration and technological achievement."
    },
    {
        title: "Photosynthesis & Planetary Oxygen",
        text: "Photosynthesis is a biological process used by plants, algae, and certain bacteria to convert light energy into chemical energy that, through cellular respiration, can later be released to fuel the organism's metabolic activities. Some of this chemical energy is stored in carbohydrate molecules, such as sugars and starches, which are synthesized from carbon dioxide and water. In most cases, oxygen is also released as a waste product. Most plants, algae, and cyanobacteria perform oxygenic photosynthesis, which is largely responsible for producing and maintaining the oxygen content of the Earth's atmosphere, and supplies most of the biological energy necessary for complex life on Earth. Although photosynthesis is performed differently by different species, the process always begins when energy from light is absorbed by proteins called reaction centres that contain green chlorophyll pigments. The emergence of photosynthetic organisms more than two billion years ago triggered the Great Oxidation Event, dramatically transforming the chemistry of Earth's atmosphere and oceans, and paving the way for the evolution of multicellular aerobic organisms across the planet."
    },
    {
        title: "Bioluminescence",
        text: "Bioluminescence is the production and emission of light by a living organism. It is a form of chemiluminescence in which energy is released by a chemical reaction in the form of light emission. Bioluminescence occurs widely in marine vertebrates and invertebrates, as well as in some fungi, microorganisms including some bioluminescent bacteria, and terrestrial arthropods such as fireflies. In a general sense, the principal chemical reaction in bioluminescence involves a light-emitting molecule and an enzyme, commonly referred to as a luciferin and a luciferase, respectively. Because these are generic names, the specific luciferins and luciferases are often distinguished by including the species or group. In all characterized cases, the enzyme catalyzes the oxidation of the luciferin, occasionally requiring other cofactors such as adenosine triphosphate or calcium ions. In deep ocean environments where sunlight cannot penetrate, bioluminescence serves essential ecological functions including counterillumination camouflage, mimicry to lure prey, communication, and warning coloration to deter deep-sea predators."
    },
    {
        title: "History of Writing Systems",
        text: "The history of writing traces the development of expressing language by systems of markings and how these markings were used for various purposes in different societies, thereby transforming social organization. Writing systems emerged in multiple different civilizations around the world, beginning in the Bronze Age. The earliest known scripts include cuneiform in ancient Mesopotamia, Egyptian hieroglyphs, the Indus script, and Chinese oracle bone script. Cuneiform, created by the Sumerians around 3400 BC, began as a system of pictograms used for recording agricultural goods and temple accounts, later evolving into a sophisticated phonetic script impressed into wet clay tablets with a reed stylus. The invention of the alphabet, where individual characters represent single phonemes rather than syllables or entire words, arose among Semitic workers in ancient Egypt around 1800 BC. This innovation was adopted and refined by the Phoenicians, whose maritime trading network distributed the alphabetic system throughout the Mediterranean basin, directly giving rise to the Greek, Latin, Cyrillic, and Arabic writing systems used across the world today."
    },
    {
        title: "Antarctic Ice Sheet Dynamics",
        text: "The Antarctic ice sheet is one of the two polar ice sheets of Earth. It covers about 98 percent of the Antarctic continent and is the largest single mass of ice on Earth. It covers an area of almost 14 million square kilometres and contains approximately 27 million cubic kilometres of ice. Around 61 percent of all fresh water on the Earth is held in the Antarctic ice sheet, which is equivalent to about 58 metres of global sea-level rise if entirely melted. The ice sheet is divided by the Transantarctic Mountains into two main sections: the larger East Antarctic Ice Sheet and the smaller West Antarctic Ice Sheet. The East Antarctic sheet rests on a major land mass, while the bed of the West Antarctic sheet is in places more than 2,500 metres below sea level. Ice moves continuously outward from the high interior plateaus toward the coast through large ice streams and glaciers, feeding floating ice shelves such as the Ross Ice Shelf and the Ronne Ice Shelf. Scientific monitoring of the ice sheet through satellite gravimetry and altimetry provides vital data on cryospheric mass balance and global ocean circulation patterns in response to modern climate change."
    }
];

const WIKI_TOPICS = [
    "astronomy", "space exploration", "computer science", "ancient history",
    "marine biology", "renewable energy", "quantum mechanics", "renaissance architecture",
    "evolutionary biology", "neuroscience", "classical physics", "linguistics",
    "inventions", "oceanography", "robotics", "paleontology", "particle physics"
];

let lastFallbackIndex = -1;
let wikiQueue = [];
let isFetchingWiki = false;

function cleanWikiText(raw) {
    if (!raw) return "";
    let text = raw;
    // Remove phonetic transcriptions
    text = text.replace(/\s*\([/\[][^)]*[/\]]\)/g, "");
    // Remove citation markers and references
    text = text.replace(/\[\d+\]|\[citation needed\]|\[note \d+\]/gi, "");
    // Normalize punctuation
    text = text.replace(/[\u2018\u2019]/g, "'");
    text = text.replace(/[\u201C\u201D]/g, '"');
    text = text.replace(/[\u2013\u2014]/g, "-");
    text = text.replace(/[\u00A0\u200B]/g, " ");
    // Keep standard ASCII printable range
    text = text.replace(/[^\x20-\x7E]/g, "");
    // Collapse spacing
    text = text.replace(/\s+/g, " ");
    return text.trim();
}

function truncateToSentence(text, minLen = 1000, maxLen = 1400) {
    if (text.length <= maxLen && text.length >= minLen) {
        if (text.endsWith(".")) return text;
        const lastP = text.lastIndexOf(". ");
        if (lastP >= minLen - 100) return text.slice(0, lastP + 1);
    }

    const searchSlice = text.slice(0, maxLen + 150);
    const lastPeriod = searchSlice.lastIndexOf(". ");
    if (lastPeriod >= minLen - 150) {
        return searchSlice.slice(0, lastPeriod + 1);
    }

    const nextPeriod = text.indexOf(". ", minLen - 100);
    if (nextPeriod !== -1 && nextPeriod <= maxLen + 250) {
        return text.slice(0, nextPeriod + 1);
    }

    const sub = text.slice(0, maxLen);
    const lastSpace = sub.lastIndexOf(" ");
    return (lastSpace > minLen - 150 ? sub.slice(0, lastSpace) : sub) + ".";
}

async function refillWikiQueue() {
    if (isFetchingWiki) return;
    isFetchingWiki = true;

    try {
        const topic = WIKI_TOPICS[Math.floor(Math.random() * WIKI_TOPICS.length)];
        const offset = Math.floor(Math.random() * 40);
        const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(topic)}&gsrlimit=8&gsroffset=${offset}&prop=extracts&exintro=1&explaintext=1`;

        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 3500) : null;

        const res = await fetch(url, {
            signal: controller ? controller.signal : undefined,
            headers: { 'User-Agent': 'KeyGapTypingTest/1.0' }
        });
        if (timeoutId) clearTimeout(timeoutId);

        const data = await res.json();
        if (data && data.query && data.query.pages) {
            const pages = Object.values(data.query.pages);
            for (const page of pages) {
                const cleaned = cleanWikiText(page.extract || "");
                if (cleaned.length >= 850) {
                    const passage = truncateToSentence(cleaned, 1000, 1400);
                    if (passage.length >= 950) {
                        wikiQueue.push({
                            title: page.title,
                            text: passage
                        });
                    }
                }
            }
        }
    } catch (e) {
        // Silently fall back to curated offline Wikipedia passages
    } finally {
        isFetchingWiki = false;
    }
}

function getRandomOfflineParagraph() {
    let index;
    if (WIKI_FALLBACK_PARAGRAPHS.length <= 1) {
        index = 0;
    } else {
        do {
            index = Math.floor(Math.random() * WIKI_FALLBACK_PARAGRAPHS.length);
        } while (index === lastFallbackIndex);
    }
    lastFallbackIndex = index;
    return WIKI_FALLBACK_PARAGRAPHS[index];
}

function getNextPassage() {
    if (wikiQueue.length > 0) {
        const item = wikiQueue.shift();
        if (wikiQueue.length < 3) {
            refillWikiQueue();
        }
        return item;
    }

    // Trigger background refill for subsequent passages
    refillWikiQueue();
    return getRandomOfflineParagraph();
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
const initialPassage = getNextPassage();
let sentence = initialPassage.text;
let currentArticleTitle = initialPassage.title || "Wikipedia Article";
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

// Virtualized text window state for massive text performance (500k+ chars)
const VIRTUAL_THRESHOLD = 2000;
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
        const nextP = getNextPassage();
        sentence = nextP.text;
        currentArticleTitle = nextP.title || "Wikipedia Article";
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
        const titleBadge = currentArticleTitle ? `Wikipedia: "${currentArticleTitle}"` : (currentModeName || "Passage");
        arenaStatus.innerHTML = timerLimit > 0
            ? `<span style="color:var(--accent-cyan); font-weight:700;">${titleBadge}</span> • Ready. Start typing to begin the ${timerLimit}s countdown.`
            : `<span style="color:var(--accent-cyan); font-weight:700;">${titleBadge}</span> • Untimed (~${Math.round(sentence.length / 5)} words). Type to start.`;
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

function setSentence(text, modeName = "Standard", articleTitle = "") {
    currentModeName = modeName;
    sentence = text;
    currentArticleTitle = articleTitle;
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
        const nextP = getNextPassage();
        sentence = nextP.text;
        currentArticleTitle = nextP.title || "Wikipedia Article";
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
            const titleBadge = currentArticleTitle ? `Wikipedia: "${currentArticleTitle}"` : (currentModeName || "Active Test");
            arenaStatus.innerHTML = timerLimit > 0
                ? `<span style="color:var(--accent-cyan); font-weight:700;">${titleBadge}</span> • Timing active! ${timerLimit}s countdown running...`
                : `<span style="color:var(--accent-cyan); font-weight:700;">${titleBadge}</span> • Measuring accuracy & keystroke latency across passage...`;
        }
        liveInterval = setInterval(updateLiveHud, 100);
    }

    let latency = null;
    if (lastKeyTime !== null) {
        latency = now - lastKeyTime;
    }
    lastKeyTime = now;

    totalPresses++;

    const expected = sentence[currentIndex];
    // Map strictly by produced character (event.key) for layout independence
    const isCorrect = event.key === expected;

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
        const nextP = getNextPassage();
        setSentence(nextP.text, "Standard", nextP.title);
        refreshTextBtn.blur();
    });
}

if (defaultBtn) {
    defaultBtn.addEventListener("click", function () {
        const nextP = getNextPassage();
        setTimerMode(0, modeUntimedBtn);
        setSentence(nextP.text, "Standard", nextP.title);
        defaultBtn.blur();
    });
}

if (default60sBtn) {
    default60sBtn.addEventListener("click", function () {
        const nextP = getNextPassage();
        setTimerMode(60, mode60sBtn);
        setSentence(nextP.text, "60s Timed", nextP.title);
        default60sBtn.blur();
    });
}

if (practiceBtn) {
    practiceBtn.addEventListener("click", function () {
        const text = buildPracticeText();
        if (text === null) {
            alert(`No weak keys identified yet. Complete test rounds until keys have at least ${MIN_PRACTICE} attempts!`);
        } else {
            setSentence(text, "Weak-Key Drill", "Targeted Weak-Key Drill");
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
    setSentence(text, modeLabel, "Custom Passage");
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
refillWikiQueue(); // Asynchronously pre-fetch Wikipedia articles into queue
startTest(false);
updateHeatmapControls();
showAllTime();