const commonWords = ["the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for", "not", "on", "with", "he", "as", "you", "do", "at", "this", "but", "his", "by", "from", "they", "we", "say", "her", "she", "or", "an", "will", "my", "one", "all", "would", "there", "their", "what", "so", "up", "out", "if", "about", "who", "get", "which", "go", "me", "when", "make", "can", "like", "time", "no", "just", "him", "know", "take", "people", "into", "year", "your", "good", "some", "could", "them", "see", "other", "than", "then", "now", "look", "only", "come", "its", "over", "think", "also", "back", "after", "use", "two", "how", "our", "work", "first", "well", "way", "even", "new", "want", "because", "any", "these", "give", "day", "most", "us"];

const textBanks = {
    easy: [
        "the quick brown fox jumps",
        "pack my box with jugs",
        "daft zebras jump up",
        "judge my vow now",
        "help fax my big quiz",
        "we run and we jump high",
        "they see the red cat",
        "a good day to be outside",
        "play the game with me"
    ],
    medium: [
        "The quick brown fox jumps over the lazy dog.",
        "Pack my box with five dozen liquor jugs.",
        "How vexingly quick daft zebras jump!",
        "Sphinx of black quartz, judge my vow.",
        "Two driven jocks help fax my big quiz.",
        "A wizard's job is to vex chumps quickly in fog.",
        "Watch Jeopardy, Alex Trebek's fun TV quiz game.",
        "By Jove, my quick study of lexicography won a prize!"
    ],
    hard: [
        "The recipe calls for 1.5 cups of sugar & 2 eggs!",
        "Contact me at user_123@example.com for 50% off.",
        "Error 404: The page 'http://site.org' was not found.",
        "If (x >= 10 && y <= 20) { return true; }",
        "My password is P@$$w0rd_2023! Don't tell anyone...",
        "Revenue grew by 15.7% (+$1,200,000) in Q3.",
        "He said, \"It's a beautiful day!\" and smiled."
    ]
};

const typingArea = document.getElementById('typing-area');
const timeEl = document.getElementById('time');
const wpmEl = document.getElementById('wpm');
const accuracyEl = document.getElementById('accuracy');
const restartBtn = document.getElementById('restart-btn');
const pbValue = document.getElementById('personal-best');

const modeSelect = document.getElementById('mode-select');
const diffSelect = document.getElementById('diff-select');
const themeToggle = document.getElementById('theme-toggle');
const soundToggle = document.getElementById('sound-toggle');

const weakKeysPanel = document.getElementById('weak-keys-panel');
const weakKeysList = document.getElementById('weak-keys-list');
const resetStatsBtn = document.getElementById('reset-stats-btn');

let currentText = "";
let characters = [];
let charIndex = 0;
let timer = null;
let startTime = null;
let isPlaying = false;
let totalKeystrokes = 0;
let totalErrors = 0;
let is60sMode = false;
let timeLeft = 60;
let soundEnabled = true;

let keyStats = JSON.parse(localStorage.getItem('keygap-stats')) || {};
let lastKeyTime = null;

let AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

// Initialize theme
const savedTheme = localStorage.getItem('keygap-theme') || 'dark';
document.body.setAttribute('data-theme', savedTheme);
updateThemeIcon();

// Initialize sound
const savedSound = localStorage.getItem('keygap-sound');
if (savedSound === 'off') {
    soundEnabled = false;
}
updateSoundIcon();

// Initialize Personal Best
let personalBest = localStorage.getItem('keygap-pb') || 0;
pbValue.innerText = `${personalBest} WPM`;

updateWeakKeysDisplay();

function playErrorSound() {
    if (!soundEnabled) return;
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(150, audioCtx.currentTime); 
    oscillator.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
}

function getWeakKeys() {
    const weakKeys = [];
    for (const [key, stats] of Object.entries(keyStats)) {
        if (stats.attempts >= 20) {
            const errorRate = stats.misses / stats.attempts;
            if (errorRate > 0.05) { // Threshold for considering it "weak" (e.g. >5% error)
                weakKeys.push({ key, errorRate });
            }
        }
    }
    weakKeys.sort((a, b) => b.errorRate - a.errorRate);
    return weakKeys;
}

function updateWeakKeysDisplay() {
    const weakKeys = getWeakKeys().slice(0, 5); // top 5
    
    if (weakKeys.length > 0) {
        weakKeysPanel.style.display = 'flex';
        weakKeysList.innerHTML = '';
        weakKeys.forEach(item => {
            const div = document.createElement('div');
            div.className = 'weak-key-item';
            div.innerText = `${item.key} (${Math.round(item.errorRate * 100)}%)`;
            weakKeysList.appendChild(div);
        });
    } else {
        weakKeysPanel.style.display = 'none';
    }
}

function getRandomText() {
    const diff = diffSelect.value;
    const weakKeys = getWeakKeys().map(w => w.key);
    
    // Weighted practice: 30-40% targeted words if we have weak keys
    if (weakKeys.length > 0 && Math.random() < 0.6) {
        let generatedWords = [];
        const length = diff === 'easy' ? 6 : diff === 'medium' ? 10 : 12;
        
        for (let i = 0; i < length; i++) {
            if (i % 3 === 0) { // ~33% targeted words
                const targetKey = weakKeys[Math.floor(Math.random() * weakKeys.length)];
                const matchingWords = commonWords.filter(w => w.includes(targetKey));
                if (matchingWords.length > 0) {
                    generatedWords.push(matchingWords[Math.floor(Math.random() * matchingWords.length)]);
                } else {
                    generatedWords.push(commonWords[Math.floor(Math.random() * commonWords.length)]);
                }
            } else {
                generatedWords.push(commonWords[Math.floor(Math.random() * commonWords.length)]);
            }
        }
        
        let text = generatedWords.join(" ");
        if (diff === 'medium') {
            text = text.charAt(0).toUpperCase() + text.slice(1) + ".";
        } else if (diff === 'hard') {
            text = text.charAt(0).toUpperCase() + text.slice(1) + "! " + Math.floor(Math.random() * 100);
        }
        return text;
    }
    
    const bank = textBanks[diff];
    return bank[Math.floor(Math.random() * bank.length)];
}

function appendMoreText() {
    const extraText = " " + getRandomText();
    currentText += extraText;
    
    for (let i = 0; i < extraText.length; i++) {
        const span = document.createElement('span');
        span.innerText = extraText[i];
        typingArea.appendChild(span);
        characters.push(span);
    }
}

function initRound() {
    is60sMode = modeSelect.value === '60s';
    
    // Reset state
    charIndex = 0;
    isPlaying = false;
    totalKeystrokes = 0;
    totalErrors = 0;
    startTime = null;
    timeLeft = 60;
    lastKeyTime = null;
    
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    
    timeEl.innerText = is60sMode ? "60s" : "0s";
    wpmEl.innerText = "0";
    accuracyEl.innerText = "100%";
    
    currentText = getRandomText();
    
    typingArea.innerHTML = "";
    characters = currentText.split('').map((char, index) => {
        const span = document.createElement('span');
        span.innerText = char;
        if (index === 0) span.classList.add('active');
        typingArea.appendChild(span);
        return span;
    });
    
    document.addEventListener('keydown', handleKeyDown);
    typingArea.focus();
}

function handleKeyDown(e) {
    if (e.key === 'Tab' || e.key === 'Escape') {
        e.preventDefault();
        restartRound();
        return;
    }
    
    if (e.key === 'Enter') {
        e.preventDefault();
        restartRound();
        return;
    }
    
    if (e.ctrlKey || e.altKey || e.metaKey || (e.key.length > 1 && e.key !== 'Backspace')) {
        return;
    }
    
    if (!isPlaying && e.key !== 'Backspace') {
        isPlaying = true;
        startTime = Date.now();
        timer = setInterval(updateTimerTick, 100);
        
        if (soundEnabled && !audioCtx) {
            audioCtx = new AudioContext();
        }
    }
    
    if (e.key === 'Backspace') {
        if (charIndex > 0) {
            characters[charIndex].classList.remove('active');
            charIndex--;
            characters[charIndex].classList.remove('correct', 'incorrect');
            characters[charIndex].classList.add('active');
        }
        return;
    }
    
    // Character typed
    if (charIndex < characters.length) {
        totalKeystrokes++;
        const expectedChar = currentText[charIndex];
        const actualChar = e.key;
        const span = characters[charIndex];
        
        // Track key stats
        const now = Date.now();
        const timeSinceLast = lastKeyTime ? now - lastKeyTime : 0;
        lastKeyTime = now;
        
        const lowerExpected = expectedChar.toLowerCase();
        if (lowerExpected.match(/[a-z0-9]/)) {
            if (!keyStats[lowerExpected]) {
                keyStats[lowerExpected] = { attempts: 0, misses: 0, totalMs: 0 };
            }
            keyStats[lowerExpected].attempts++;
            keyStats[lowerExpected].totalMs += timeSinceLast;
            
            if (actualChar !== expectedChar) {
                keyStats[lowerExpected].misses++;
            }
        }
        
        span.classList.remove('active');
        
        if (actualChar === expectedChar) {
            span.classList.add('correct');
        } else {
            span.classList.add('incorrect');
            totalErrors++;
            playErrorSound();
        }
        
        charIndex++;
        
        if (is60sMode && charIndex >= characters.length - 10) {
            appendMoreText();
        }
        
        if (charIndex < characters.length) {
            characters[charIndex].classList.add('active');
        } else if (!is60sMode) {
            endRound();
        }
        
        updateStats();
    }
}

function updateTimerTick() {
    if (!isPlaying) return;
    
    if (is60sMode) {
        const elapsedMs = Date.now() - startTime;
        timeLeft = 60 - Math.floor(elapsedMs / 1000);
        
        if (timeLeft <= 0) {
            timeLeft = 0;
            endRound();
        }
        
        timeEl.innerText = `${timeLeft}s`;
    } else {
        const elapsedMs = Date.now() - startTime;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        timeEl.innerText = `${elapsedSeconds}s`;
    }
    
    updateStats();
}

function updateStats() {
    if (!startTime || !isPlaying) return;
    
    const elapsedMs = Date.now() - startTime;
    const elapsedMinutes = elapsedMs / 60000;
    
    const correctCount = document.querySelectorAll('.typing-area span.correct').length;
    let wpm = 0;
    if (elapsedMinutes > 0) {
        wpm = Math.round((correctCount / 5) / elapsedMinutes);
    }
    wpmEl.innerText = wpm;
    
    const correctHits = totalKeystrokes - totalErrors;
    let accuracy = 100;
    if (totalKeystrokes > 0) {
        accuracy = Math.floor((correctHits / totalKeystrokes) * 100);
        if (accuracy < 0) accuracy = 0;
    }
    accuracyEl.innerText = `${accuracy}%`;
}

function endRound() {
    isPlaying = false;
    clearInterval(timer);
    timer = null;
    document.removeEventListener('keydown', handleKeyDown);
    
    // Save personal best
    const currentWpm = parseInt(wpmEl.innerText);
    if (currentWpm > personalBest) {
        personalBest = currentWpm;
        localStorage.setItem('keygap-pb', personalBest);
        pbValue.innerText = `${personalBest} WPM`;
    }
    
    // Save key stats
    localStorage.setItem('keygap-stats', JSON.stringify(keyStats));
    updateWeakKeysDisplay();
}

function restartRound() {
    document.removeEventListener('keydown', handleKeyDown);
    initRound();
}

restartBtn.addEventListener('click', () => {
    restartRound();
});

resetStatsBtn.addEventListener('click', () => {
    keyStats = {};
    localStorage.removeItem('keygap-stats');
    updateWeakKeysDisplay();
    resetStatsBtn.blur();
});

modeSelect.addEventListener('change', () => {
    restartRound();
    modeSelect.blur();
});

diffSelect.addEventListener('change', () => {
    restartRound();
    diffSelect.blur();
});

function updateThemeIcon() {
    const isLight = document.body.getAttribute('data-theme') === 'light';
    themeToggle.innerText = isLight ? '🌙' : '☀️';
}

themeToggle.addEventListener('click', () => {
    const isLight = document.body.getAttribute('data-theme') === 'light';
    const newTheme = isLight ? 'dark' : 'light';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('keygap-theme', newTheme);
    updateThemeIcon();
    themeToggle.blur();
});

function updateSoundIcon() {
    soundToggle.innerText = soundEnabled ? '🔊' : '🔇';
}

soundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem('keygap-sound', soundEnabled ? 'on' : 'off');
    updateSoundIcon();
    soundToggle.blur();
});

typingArea.addEventListener('click', () => {
    typingArea.focus();
});

// Start initially
initRound();
