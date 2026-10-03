# KeyGap

> **Keystroke Latency & Weak-Key Intelligence Analyzer**  
> A client-side typing diagnostic tool that detects which keys slow you down, computes post-mistake recovery cost, and renders an interactive physical keyboard error heatmap.

![KeyGap Preview](https://img.shields.io/badge/Status-Complete-34d399?style=for-the-badge)
![Tech Stack](https://img.shields.io/badge/Stack-Vanilla_HTML_•_CSS_•_JS-38bdf8?style=for-the-badge)
![Privacy](https://img.shields.io/badge/Privacy-100%25_Client--side-818cf8?style=for-the-badge)

---

## ⚡ What Makes KeyGap Different?

Most typing platforms only tell you your overall WPM. KeyGap analyzes the micro-latencies and behavioral hesitations behind every keypress:

1. **Per-Key Mistake Diagnostics**: Tracks exact attempts, misses, and error rates per key across both individual sessions and all-time career history.
2. **Recovery Cost Analysis**: Measures hesitation latency following a typo (analyzing the latency window of keys directly succeeding a mistake vs. normal keystrokes) to calculate exact seconds lost per error.
3. **Flexible Timer Modes**: Switch seamlessly between **Untimed Mode** (accuracy across full paragraph), **60s Timed**, and **120s Timed** countdown tests.
4. **Dynamic Paragraph Pool**: Substantial, engaging paragraphs that automatically refresh between tests without repetitive back-to-back sentences.
5. **Interactive Physical Heatmap**: Color-coded QWERTY mechanical keyboard visualization dynamically shaded from emerald green (0% errors) to crimson red (high miss rate) with per-key attempt stats.
6. **Adaptive Practice Generator**: Automatically generates typing drills weighted with your weakest keys to systematically eliminate muscle memory blindspots.
7. **Custom Code & Text Lab**: Test yourself on actual code snippets, formulas, or tricky prose with automatic sanitization and character counting.
8. **Zero External Dependencies**: Fast, lightweight vanilla HTML5, CSS3, and modern JavaScript. All telemetry remains 100% private in `localStorage`.

---

## 🚀 Getting Started

### Local Setup
Clone the repository and open `index.html` in any modern web browser:

```bash
git clone https://github.com/Misari-Vadalia-13/KeyGap.git
cd KeyGap
```

Run with a local server (optional):
```bash
# Python
python3 -m http.server 8000

# or Node
npx serve .
```
Visit `http://localhost:8000` in your browser.

---

## ⌨️ Controls & Shortcuts

| Action | Control |
| :--- | :--- |
| **Instant Restart** | Press <kbd>Esc</kbd> or click **Restart** |
| **Timer Mode** | Toggle **Untimed (Accuracy)**, **60s Timed**, or **120s Timed** |
| **Next Paragraph** | Click **Next Passage** |
| **Weak-Key Drill** | Click **Practice Weak Keys** |
| **Custom Text Mode** | Paste text into textarea & click **Start With My Text** |
| **Reset Saved Data** | Click **Reset My Stats** |

---

## 🔬 How the Intelligence Engine Works

1. **Keystroke Recording**: Every keypress logs `{ expected, typed, correct, latency }`.
2. **Error Rate Ranking**: $\text{Error Rate} = \frac{\text{Misses}}{\text{Attempts}}$. Keys below minimum attempt thresholds are filtered out to prevent statistical anomalies.
3. **Recovery Cost Algorithm**:
   $$\text{Penalty per Mistake} = \frac{(\bar{t}_{\text{post-mistake}} - \bar{t}_{\text{normal}}) \times N_{\text{post-mistake}}}{N_{\text{mistakes}}}$$
4. **Heatmap Color Gradient**: Maps error rates between 0% and 30%+ to HSL hues (120° down to 0°), providing instant visual feedback on typing weaknesses.

---

## 📄 License
This project is licensed under the MIT License.
