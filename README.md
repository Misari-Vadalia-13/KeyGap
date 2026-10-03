# KeyGap

[https://keygap.vercel.app](https://keygap.vercel.app)

> **Find out what your mistakes actually cost you.**  
> A 100% client-side typing analyzer that measures post-error recovery latency, per-key error rates with Bayesian smoothing, keystroke velocity, and multi-layout keyboard heatmaps.

<!-- TODO: Capture a GIF or high-resolution screenshot of the physical heatmap in action (showing the "Recovery Cost" or "Error Rate" mode with hover tooltip displaying raw and smoothed rates) and place it here as: ![KeyGap Keyboard Heatmap](heatmap-preview.png) -->

![KeyGap Status](https://img.shields.io/badge/Status-Complete-34d399?style=for-the-badge)
![Tech Stack](https://img.shields.io/badge/Stack-Vanilla_HTML_•_CSS_•_JS-38bdf8?style=for-the-badge)
![Privacy](https://img.shields.io/badge/Privacy-100%25_Client--side-818cf8?style=for-the-badge)

---

## ⚡ What Makes KeyGap Different?

Established typing platforms like **keybr** and **Monkeytype** already offer per-key accuracy, typing speeds, and customized practice. KeyGap focuses specifically on **Recovery Cost**—the post-mistake cognitive delay and hesitation that follows an error.

When you mistype a letter, the cost is rarely just the incorrect keypress itself. Typists typically freeze, hesitate, backtrack, and suffer degraded rhythm across subsequent keystrokes before regaining their normal pace. KeyGap instruments every keypress at millisecond resolution to isolate, quantify, and visualize this recovery penalty alongside smoothed error diagnostics.

---

## ⏱️ Recovery Cost: The Core Metric

### Definition
**Recovery Cost** is the extra time (in milliseconds) lost after an error before your typing speed returns to your baseline pace.

### The Algorithm
KeyGap computes recovery cost per mistake using a bounded lookahead search:

1. **Frozen Baseline ($\bar{t}_{\text{base}}$)**: At the exact instant an error occurs, KeyGap captures the typist's rolling baseline cadence: the mean latency of the last 5 correct keystrokes prior to the mistake ($N = 5$). If fewer than 2 correct keystrokes have occurred in the session, a default baseline of $220\text{ ms}$ is used. Post-error keystrokes are strictly excluded from this baseline calculation to prevent diluting the baseline.
2. **Post-Mistake Search Window**: Following the error, KeyGap evaluates subsequent keystrokes $k = 1, 2, \dots, K$ up to a maximum lookahead limit of $K = 5$ keystrokes (`RECOVERY_LOOKAHEAD`). Pauses longer than $2000\text{ ms}$ (e.g., looking away from the screen) are ignored.
3. **Recovery Termination Condition**: For each subsequent keystroke $k$, if the latency $t_k \le 1.15 \times \bar{t}_{\text{base}}$ (speed has recovered to within 15% of the baseline), the typist is considered recovered, and the lookahead loop terminates immediately.
4. **Excess Latency Accumulation**: For each keystroke $k$ examined prior to termination, any latency exceeding the baseline is added to the mistake's recovery penalty:

$$C_{\text{mistake}} = \sum_{k=1}^{M} \max(0, t_k - \bar{t}_{\text{base}})$$

where:
- $C_{\text{mistake}}$ is the total hesitation penalty for this typo (in ms).
- $\bar{t}_{\text{base}}$ is the baseline latency frozen at the instant of the mistake (mean of up to 5 preceding correct keystrokes).
- $t_k$ is the latency of the $k$-th keystroke following the error.
- $M \le 5$ is the index of the first keystroke where $t_M \le 1.15 \times \bar{t}_{\text{base}}$ (or 5 if the typist has not yet recovered).

### Worked Numerical Example
Suppose a typist has established a frozen baseline of $\bar{t}_{\text{base}} = 200\text{ ms}$ across their preceding correct keystrokes. They mistype the character `'e'`. The subsequent keystrokes register the following latencies:

- **Keystroke 1 ($k=1$)**: $t_1 = 340\text{ ms}$.
  - Is $t_1 \le 200 \times 1.15 = 230\text{ ms}$? No ($340 > 230$).
  - Excess time added: $340 - 200 = 140\text{ ms}$.
- **Keystroke 2 ($k=2$)**: $t_2 = 260\text{ ms}$.
  - Is $t_2 \le 230\text{ ms}$? No ($260 > 230$).
  - Excess time added: $260 - 200 = 60\text{ ms}$.
- **Keystroke 3 ($k=3$)**: $t_3 = 210\text{ ms}$.
  - Is $t_3 \le 230\text{ ms}$? Yes ($210 \le 230$). Typist has recovered to within 15% of baseline cadence.
  - Excess time added: $210 - 200 = 10\text{ ms}$.
  - **Loop terminates immediately** (keystrokes 4 and 5 are not penalized).

$$\text{Total Recovery Penalty for this error} = 140 + 60 + 10 = 210\text{ ms}$$

KeyGap sums these penalties across all mistakes in the session and breaks down the recovery cost by the specific key mistyped to highlight which letters trigger the longest cognitive pauses.

---

## 📊 Bayesian Smoothing for Weak-Key Diagnostics

### The Low-Sample Noise Problem
In raw percentage calculations, small sample sizes introduce misleading spikes: a key pressed 2 times with 1 error registers a 50% error rate, unfairly dominating a key pressed 30 times with 9 errors (30% error rate).

### The Laplace / Bayesian Formula
KeyGap applies Laplace smoothing with fixed hyperparameters $\alpha = 1$ and $\beta = 10$:

$$\text{Smoothed Error Rate} = \frac{\text{misses} + 1}{\text{attempts} + 10}$$

Under this formula:
- A key with 1 miss in 2 attempts has a raw rate of $50\%$, but a smoothed rate of $\frac{1+1}{2+10} = \frac{2}{12} \approx 16.7\%$.
- A key with 9 misses in 30 attempts has a raw rate of $30\%$, but a smoothed rate of $\frac{9+1}{30+10} = \frac{10}{40} = 25.0\%$.
- The 9/30 key correctly outranks the 1/2 key because it represents consistent, statistically significant difficulty rather than an isolated misclick.

### Raw vs. Smoothed Rates in the UI
Because $\alpha = 1$, a key with zero errors will never compute to $0.0\%$ smoothed error rate (e.g., 0 misses in 10 attempts yields $\frac{1}{20} = 5\%$). To maintain intuitive feedback:
1. **Weak-Key Rankings**: Keys are sorted by `smoothedRate` to filter out low-sample flukes, but only keys with **at least one actual mistake** (`misses > 0`) and meeting the sample threshold (20 attempts for all-time, 5 for round) are eligible.
2. **Heatmap Colors & Legend**: Heatmap keys use the **raw error rate** ($\frac{\text{misses}}{\text{attempts}}$) for their color gradient ($0\%$ error maps directly to emerald green, matching the legend "Clean (0% error)").
3. **Hover Tooltip**: Displays both values side by side (e.g., `0% error rate (smoothed: 4.8%) • 0 misses in 11 attempts`).

> **Architectural Note on Empirical Bayes Prior**:  
> The current formula uses fixed constants ($\alpha = 1, \beta = 10$), which assumes a prior error expectation of $10\%$. A proposed enhancement for future revisions is to derive an empirical Bayes prior from each user's overall cumulative error rate ($\text{prior} = \frac{\text{totalMisses}}{\text{totalAttempts}}$), scaling $\alpha = \text{prior} \times M$ and $\beta = M$ (with pseudo-observation weight $M = 10$). This would automatically adapt priors for typists who type at 99%+ accuracy without skewing their rankings.

---

## ⌨️ Keyboard Heatmap: Layouts & Thresholds

### Character Mapping (`event.key`)
KeyGap maps keystrokes using `event.key` (the logical character produced by the browser/OS), rather than physical hardware scancodes (`event.code`).

- **Layout Independence**: The application includes visual chassis arrangements for **QWERTY**, **Dvorak**, and **Colemak**.
- **Important OS Layout Alignment**: The on-screen keycap shows stats for the letter printed on that key. If your physical keyboard and OS layout are set to QWERTY, but you select "Dvorak" in KeyGap's dropdown, pressing the physical 'S' key outputs `event.key = "s"`. KeyGap will display that stat on the Dvorak 's' keycap (located on the bottom row), not where your finger physically struck the keyboard. To view a physically accurate finger-position heatmap, your operating system layout must match the layout selected in the dropdown.

### Heatmap Modes & Thresholds
The heatmap supports three diagnostic overlays using fixed absolute thresholds:

1. **Error Rate Mode**:
   - $\text{Hue} = 120 \times \left(1 - \min\left(\frac{\text{rawRate}}{0.30}, 1\right)\right)$
   - $0\%$ error is Emerald Green ($120^\circ$); $\ge 30\%$ error is Crimson Red ($0^\circ$).
2. **Latency (Speed) Mode**:
   - Evaluates average time between keystrokes for correct presses.
   - Fixed clamping bounds: $140\text{ ms}$ (Fast / Cyan-Green, $140^\circ$) to $380\text{ ms}$ (Slow / Red, $0^\circ$).
3. **Recovery Cost Mode**:
   - Evaluates average hesitation penalty triggered when that specific key is mistyped.
   - Fixed clamping bounds: $80\text{ ms}$ lost (Fast Recovery / Green, $120^\circ$) to $400\text{ ms}$ lost (Severe Delay / Red, $0^\circ$). Keys require at least 2 logged mistakes to display recovery heat.

*Note: Latency and recovery thresholds use fixed millisecond ranges rather than being normalized to each individual's personal median speed.*

---

## 🔬 How the Analysis Works

1. **Keystroke Telemetry**: Every keypress logs `{ expected, typed, correct, latency, baselineAtError }`.
2. **Baseline Calibration**: Tracks a sliding window of the last 5 correct keystrokes (`BASELINE_WINDOW = 5`) to freeze an accurate baseline when an error occurs.
3. **Weak-Key Filtering**:
   - **Current Round**: Requires $\ge 5$ attempts on a key to appear in round weak keys.
   - **All-Time Stats**: Requires $\ge 20$ attempts on a key to qualify for all-time weakest keys.
   - **Heatmap Minimum**: Requires $\ge 5$ attempts (or 2 mistakes for recovery mode); keys below threshold display neutral gray styling ("Not enough data").
4. **Wikipedia-Sourced Test Passages**:
   - Expanded text passages: each passage is calibrated to **1,100 to 1,400 characters** (~180 to 220 words).
   - Engineered so that typists averaging 45–55 WPM will not complete the text within 120 seconds, allowing sustained rhythm and uninterrupted recovery measurement across 60s, 120s, and untimed sessions.
   - Dynamically pre-fetches and cleans encyclopedia articles via Wikipedia's public CORS Action API across science, history, nature, and technology.
   - Automatically falls back to an offline pool of 12 curated Wikipedia excerpts (e.g., *James Webb Space Telescope*, *Alan Turing*, *Voyager 1*, *The Great Barrier Reef*) ensuring instant loading and offline support.
5. **Targeted Weak-Key Drills**:
   - Clicking **Practice Weak Keys** queries your accumulated weakest keys.
   - It filters an embedded 100-word vocabulary dictionary, scores words according to the error weights of your weakest keys, and constructs a targeted practice drill focusing on your most error-prone characters. *(Note: Drills are generated statically at the start of the round based on stored stats; they do not dynamically alter the text during mid-test typing).*
6. **DOM Virtualization for Massive Passages**:
   - Standard texts (up to 2,000 characters) render all characters directly into the DOM with smooth line-by-line scrolling.
   - For custom text exceeding 2,000 characters, KeyGap switches to a virtualized sliding window (rendering 35 characters prior and 145 characters ahead of the active cursor).
   - **Benchmark (Tested on AMD Ryzen 5 8645HS, 16 GB RAM, Windows 11)**:
     - Input size: **500,076 characters** (~488 KB string).
     - Calculation time per sliding window slice: **$0.0014\text{ ms}$ ($1.4\ \mu\text{s}$)**.
     - DOM updates execute in under $0.5\text{ ms}$, maintaining a consistent 60 FPS typing experience without interface stutter.

---

## ⚠️ Known Limitations

1. **Local Browser Storage Only**: All statistics, latency data, and recovery metrics live inside browser `localStorage`. Browsing in incognito mode or clearing site data permanently deletes all history. Use the built-in **Export My Data** button to create portable JSON backups.
2. **Sample Size Warm-Up**: KeyGap intentionally suppresses noisy metrics until minimum thresholds are met. A new user will see "Calibrating..." and neutral gray keys on the heatmap until 5–20 attempts are registered.
3. **Desktop Hardware Keyboard Required**: The typing arena captures physical keyboard `keydown` events. Mobile virtual keyboards (touchscreens on iOS and Android) do not trigger reliable keystroke latencies and are not supported.
4. **Non-ASCII Text Stripping**: In custom text mode, non-ASCII characters (`[^\x20-\x7E]`) such as curly quotes, accented letters, or emojis are stripped out or sanitized.
5. **Fixed Heatmap Speed Thresholds**: Latency and recovery color bands use fixed millisecond scales ($140\text{--}380\text{ ms}$ for speed, $80\text{--}400\text{ ms}$ for recovery). A typist averaging 120 WPM will see mostly green keys, while a 40 WPM typist will see predominantly yellow/orange keys.
6. **External Font Dependency**: KeyGap requires zero backend servers, zero analytics, and zero external runtime libraries. However, `index.html` loads two Google Web Fonts (`Plus Jakarta Sans` and `JetBrains Mono`) via Google CDN. If opened completely offline without cached fonts, the app gracefully falls back to system monospace and sans-serif fonts.

---

## 🚀 Getting Started

### Local Setup
Clone the repository and open `index.html` in any modern web browser:

```bash
git clone https://github.com/Misari-Vadalia-13/KeyGap.git
cd KeyGap
```

Run with a local development server (optional):
```bash
# Using Python
python -m http.server 8000

# or using Node
npx serve .
```
Visit `http://localhost:8000` in your browser.

---

## ⌨️ Controls & Shortcuts

| Action | Control / UI Button |
| :--- | :--- |
| **Instant Restart** | Press <kbd>Esc</kbd> or click **Restart** |
| **Timer Modes** | Select **Untimed (Accuracy)**, **60s Timed**, or **120s Timed** |
| **Next Paragraph** | Click **Next Passage** |
| **Weak-Key Drill** | Click **Practice Weak Keys** |
| **Quick Presets** | Click **Default Text (Untimed)** or **60s Timed Text** |
| **Custom Text Mode** | Paste text into textarea & click **Start With My Text**, **Untimed (Full Text)**, or **60s Timed** |
| **Heatmap View Modes** | Toggle **Error Rate**, **Latency (Speed)**, or **Recovery Cost** |
| **Keyboard Layout** | Select **QWERTY**, **Dvorak**, or **Colemak** from the **Layout** dropdown |
| **Export Data** | Click **Export My Data** (downloads `keygap-backup-YYYY-MM-DD.json`) |
| **Import Data** | Click **Import Data** (imports JSON backup with schema validation) |
| **Reset Data** | Click **Reset My Stats** (prompts for confirmation before clearing `localStorage`) |

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
