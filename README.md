# KeyGap

> **Find out what your mistakes actually cost you.**  
> A 100% client-side typing analyzer that measures post-error recovery latency, per-key error rates with Bayesian smoothing, keystroke velocity, multi-layout physical heatmaps, and adaptive practice drills.

![KeyGap Preview](https://img.shields.io/badge/Status-Complete-34d399?style=for-the-badge)
![Tech Stack](https://img.shields.io/badge/Stack-Vanilla_HTML_•_CSS_•_JS-38bdf8?style=for-the-badge)
![Privacy](https://img.shields.io/badge/Privacy-100%25_Client--side-818cf8?style=for-the-badge)

---

## ⚡ What Makes KeyGap Different?

Most typing platforms only tell you your gross WPM. KeyGap analyzes micro-latencies, post-mistake recovery hesitation, and statistical weaknesses behind every keypress:

1. **Recovery Cost Analysis (Headline Feature)**:
   - Measures the extra time lost after a mistake from the instant of an error until your keystroke velocity returns to your rolling baseline speed (rolling average of the last 5 correct keystrokes).
   - Identifies which specific keys cause the greatest hesitation when mistyped.
2. **Bayesian-Smoothed Weak-Key Diagnostics**:
   - Eliminates statistical noise from small samples using Laplace/Bayesian smoothing: $\text{Rate} = \frac{\text{misses} + 1}{\text{attempts} + 10}$.
   - Enforces a minimum attempt threshold (20 attempts for all-time stats, 5 for current round) so 1 accidental typo doesn't dominate rankings.
3. **Keystroke Velocity & Latency Ranking**:
   - Tracks correct-keystroke latency per key to identify your slowest individual keys and hesitations.
4. **Interactive Multi-Layout Heatmap**:
   - Supports **QWERTY**, **Dvorak**, and **Colemak** keyboard layouts mapped by character produced (`event.key`).
   - Switchable metric views: **Error Rate**, **Latency (Speed)**, and **Recovery Cost**.
   - Hover tooltips display attempt counts, misses, and calibrated error percentages.
5. **Virtualized Large-Text Engine**:
   - Capable of handling **500,000+ characters** (novels, documentation, large codebases) without freezing by using sliding-window DOM virtualization.
6. **Data Portability**:
   - Complete JSON Export and Import with schema versioning (`schemaVersion: 1`), allowing you to back up your statistics or merge data across devices.
7. **100% Client-Side Privacy & Offline Capability**:
   - Zero external trackers, zero server dependencies. Safe fallback handles situations where browser storage is blocked or full.

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
| **Timer Modes** | Toggle **Untimed (Accuracy)**, **60s Timed**, or **120s Timed** |
| **Next Paragraph** | Click **Next Passage** |
| **Weak-Key Drill** | Click **Practice Weak Keys** |
| **Custom Text Mode** | Paste text into textarea & click **Start With My Text**, **Untimed**, or **60s Timed** |
| **Heatmap View** | Toggle **Error Rate**, **Latency (Speed)**, or **Recovery Cost** |
| **Keyboard Layout** | Select **QWERTY**, **Dvorak**, or **Colemak** in the heatmap header |
| **Data Backup** | Click **Export My Data** or **Import Data** in footer |
| **Reset Data** | Click **Reset My Stats** (with confirmation) |

---

## 🔬 How the Intelligence Engine Works

1. **Keystroke Telemetry**: Every keypress logs `{ expected, typed, correct, latency }`.
2. **Bayesian Weak-Key Ranking**:
   $$\text{Smoothed Error Rate} = \frac{\text{Misses} + 1}{\text{Attempts} + 10}$$
   Keys below the minimum sample threshold (20 attempts for all-time, 5 for round) are filtered out.
3. **Recovery Cost Algorithm**:
   Measures time lost after typos relative to your rolling baseline pace ($\bar{t}_{\text{baseline}}$):
   $$\text{Penalty per Mistake} = \sum_{k=1}^{5} \max(0, t_k - \bar{t}_{\text{baseline}})$$
   until velocity recovers to within 15% of baseline.
4. **Heatmap Color Gradients**:
   - **Errors**: $0\%$ (Emerald $120^\circ$) to $\ge 30\%$ (Red $0^\circ$).
   - **Latency**: $< 160\text{ms}$ (Cyan/Green $140^\circ$) to $> 380\text{ms}$ (Red $0^\circ$).
   - **Recovery Delay**: $< 100\text{ms}$ (Green $120^\circ$) to $> 380\text{ms}$ (Red $0^\circ$).

---

## 📄 License
This project is licensed under the MIT License.
