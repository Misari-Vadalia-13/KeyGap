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

function playErrorSound() {
    if (!soundEnabled) return;
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    
    // Resume context if suspended
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

function getRandomText() {
    const diff = diffSelect.value;
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
        const span = characters[charIndex];
        
        span.classList.remove('active');
        
        if (e.key === expectedChar) {
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
    // Don't calculate WPM before at least some time has passed to prevent infinity
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
}

function restartRound() {
    document.removeEventListener('keydown', handleKeyDown);
    initRound();
}

restartBtn.addEventListener('click', () => {
    restartRound();
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
