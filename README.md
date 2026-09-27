# ❤️ CardioPulse - Heart Rate Web Interface

An interactive, responsive web-based analytics dashboard built to explore continuous heart rate telemetry across multiple granularities: **Monthly**, **Daily (Hourly)**, and **Minute-by-Minute (Sub-minute samples)**, featuring real-time clinical anomaly detection and flagging.

---

## 🚀 Quick Start

The server is already running! You can open your browser directly at:
```
http://localhost:3000
```

### Running or Restarting the Server
To start or run the server at any time:
```bash
npm start
```
Or:
```bash
node server.js
```

### Re-processing Data
If you add more `.json` files to the `data/` directory, update the aggregated index with:
```bash
npm run preprocess
```

---

## 🌟 Key Features

### 1. 📅 Monthly View
- **Daily Low, Average, and Max**: Every day displays the lowest recorded heart rate, daily average, and peak heart rate.
- **Visual Range Spread**: Each calendar day features an embedded range bar illustrating the day's minimum-to-maximum span relative to resting/active zones.
- **Monthly Overview KPIs**:
  - Lowest Heart Rate detected in the month (with exact date)
  - Monthly Average Heart Rate
  - Peak Heart Rate detected (with exact date)
  - Flagged Days & Episode counters
- **Dual View Modes**:
  - **Calendar View**: Intuitive monthly grid with weekday headers, interactive day cards, and quick drilldown cues.
  - **Trend Range Chart**: Continuous multi-day range envelope (min-to-max shaded band) with average curve and threshold reference lines.
- **Month Switcher**: Seamlessly switch between all available months (July 2026, August 2026, September 2026).

### 2. ⏰ Daily View (Broken Down by Hour)
- **Click any day** to drill down into the 24-hour timeline.
- **24-Hour Timeline Profile**:
  - Interactive Canvas chart showing min, avg, and max for each hour (00:00 to 23:00).
  - Shaded clinical alert zones (High Tachycardia zone and Low Bradycardia zone).
  - Hover tooltips detailing exact hourly metrics and flag reasons.
- **Hourly Breakdown Cards**:
  - 24 individual hourly cards with min, avg, max, and readings count.
  - Color-coded badges for hours exceeding low or high boundaries.
  - "Show only flagged hours" quick filter toggle.
- **Day Stepper**: Quick `< Prev Day` and `Next Day >` buttons for rapid exploration.

### 3. ⏱️ Minute View (Broken Down by Minute)
- **Click any hour** (or hour card) to drill down into high-resolution minute analysis.
- **60-Minute Continuous Waveform**:
  - Plots all 60 minutes with min-max fluctuation envelope and average curve.
  - Glowing alert markers on minutes with anomalous readings.
  - Interactive scrub crosshair with real-time value inspection.
- **Minute Telemetry Log**:
  - Comprehensive table with sortable columns: Timestamp, Min BPM, Avg BPM, Max BPM, Spread ($\pm$ BPM), Readings, and Clinical Status.
  - Filterable by: *All Minutes*, *Flagged Only*, *High Only*, *Low Only*.
- **Sub-Minute Sensor Telemetry Inspection**:
  - Clicking "Raw Beats" reveals beat-by-beat timestamped sensor records with sensor confidence ratings.

### 4. 🚨 Automatic Flagging of Low & High Heart Rate
- **Clinical Default Thresholds**:
  - **Bradycardia (Low HR)**: $< 60\text{ BPM}$ (Cyan / Frost Blue indicators)
  - **Tachycardia (High HR)**: $> 100\text{ BPM}$ (Rose / Coral Red indicators)
  - **Normal Resting Zone**: $60 - 100\text{ BPM}$ (Emerald Green indicators)
- **Dynamic Threshold Configuration**:
  - Click the **Thresholds** button in the top navigation to adjust boundaries using dual range sliders or numeric inputs.
  - Built-in clinical presets: *Standard Adult (60–100)*, *Endurance Athlete (50–100)*, *Strict Resting (60–90)*.
  - **Real-Time Reactivity**: Updating thresholds instantly recalculates flags, calendar badges, charts, and anomaly lists without page reloads.
- **Flagged Anomalies Drawer**:
  - Click the **Flagged** bell in the top nav to slide open the Anomalies Inspector.
  - Filter by *All*, *High HR*, or *Low HR*.
  - 1-click **Jump to Day** buttons to immediately focus on any detected anomaly.

---

## 📁 Project Structure

```
├── data/                      # 69 original raw JSON files (~2.5M readings)
│   ├── heart_rate-2026-07-21.json
│   └── ...
├── public/                    # Web Application frontend
│   ├── index.html             # Semantic HTML5 dashboard layout
│   ├── styles.css             # Vanilla CSS design system (Dark mode & glassmorphism)
│   ├── app.js                 # Frontend application & chart rendering logic
│   └── data/                  # Preprocessed JSON cache for sub-millisecond response
│       ├── summary.json       # Monthly aggregated metadata (~59 KB)
│       └── days/              # Per-day hourly & minute telemetry (~600-800 KB each)
├── scripts/
│   └── preprocess.js          # Fast offline data preprocessor
├── server.js                  # Zero-dependency local Node.js HTTP server
└── package.json               # Project manifest
```
