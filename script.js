const sentences = [
    "The quick brown fox jumps over the lazy dog.",
    "Pack my box with five dozen liquor jugs.",
    "How vexingly quick daft zebras jump!",
    "Sphinx of black quartz, judge my vow.",
    "Two driven jocks help fax my big quiz.",
    "A wizard's job is to vex chumps quickly in fog.",
    "Watch Jeopardy, Alex Trebek's fun TV quiz game.",
    "By Jove, my quick study of lexicography won a prize!",
    "Woven silk pyjamas exchanged for blue quartz.",
    "Brawny gods just flocked up to quiz and vex him."
];

const typingArea = document.getElementById('typing-area');
const timeEl = document.getElementById('time');
const wpmEl = document.getElementById('wpm');
const accuracyEl = document.getElementById('accuracy');
const restartBtn = document.getElementById('restart-btn');

let currentText = "";
let characters = [];
let charIndex = 0;
let timer = null;
let startTime = null;
let isPlaying = false;
let totalKeystrokes = 0;
let totalErrors = 0;

function initRound() {
    // Reset state
    charIndex = 0;
    isPlaying = false;
    totalKeystrokes = 0;
    totalErrors = 0;
    startTime = null;
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    
    timeEl.innerText = "0s";
    wpmEl.innerText = "0";
    accuracyEl.innerText = "100%";
    
    // Pick text
    currentText = sentences[Math.floor(Math.random() * sentences.length)];
    
    // Render text
    typingArea.innerHTML = "";
    characters = currentText.split('').map((char, index) => {
        const span = document.createElement('span');
        span.innerText = char;
        if (index === 0) span.classList.add('active');
        typingArea.appendChild(span);
        return span;
    });
    
    // Focus typing area and add listener
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
    
    // Ignore modifiers and other special keys
    if (e.ctrlKey || e.altKey || e.metaKey || (e.key.length > 1 && e.key !== 'Backspace')) {
        return;
    }
    
    if (!isPlaying && e.key !== 'Backspace') {
        isPlaying = true;
        startTime = Date.now();
        timer = setInterval(updateStats, 100);
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
        }
        
        charIndex++;
        
        if (charIndex < characters.length) {
            characters[charIndex].classList.add('active');
        } else {
            endRound();
        }
        
        updateStats(); // Instant update on type
    }
}

function updateStats() {
    if (!startTime) return;
    
    const elapsedMs = Date.now() - startTime;
    const elapsedMinutes = elapsedMs / 60000;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    
    timeEl.innerText = `${elapsedSeconds}s`;
    
    // WPM = (correct characters ÷ 5) ÷ minutes elapsed
    const correctCount = document.querySelectorAll('.typing-area span.correct').length;
    const wpm = elapsedMinutes > 0 ? Math.round((correctCount / 5) / elapsedMinutes) : 0;
    wpmEl.innerText = wpm;
    
    // Accuracy = correct keystrokes ÷ total keystrokes × 100
    const correctHits = totalKeystrokes - totalErrors;
    let accuracy = 100;
    if (totalKeystrokes > 0) {
        // Floor to prevent rounding up to 100% if there is an error
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
    updateStats(); // Final update
}

function restartRound() {
    document.removeEventListener('keydown', handleKeyDown);
    initRound();
}

restartBtn.addEventListener('click', () => {
    restartRound();
});

// Start initially
initRound();
