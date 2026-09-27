const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const outDir = path.join(__dirname, '..', 'public', 'data');
const daysOutDir = path.join(outDir, 'days');

if (!fs.existsSync(daysOutDir)) {
  fs.mkdirSync(daysOutDir, { recursive: true });
}

console.log('Starting data pre-processing...');
const start = Date.now();

const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json')).sort();
console.log(`Found ${files.length} data files.`);

const monthsMap = {};
let globalTotalReadings = 0;
let globalMin = 999;
let globalMax = 0;
let globalSum = 0;

for (let i = 0; i < files.length; i++) {
  const file = files[i];
  const dateMatch = file.match(/heart_rate-(\d{4}-\d{2}-\d{2})\.json/);
  if (!dateMatch) continue;
  const dateStr = dateMatch[1]; // e.g. "2026-07-21"
  const monthStr = dateStr.slice(0, 7); // e.g. "2026-07"

  const raw = fs.readFileSync(path.join(dataDir, file), 'utf-8');
  const items = JSON.parse(raw);

  let dayMin = 999;
  let dayMax = 0;
  let daySum = 0;
  let dayCount = 0;
  let dayLowCount = 0; // < 60
  let dayHighCount = 0; // > 100
  let lowestReading = null;
  let highestReading = null;

  // 24 hours
  const hourlyBuckets = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: `${String(h).padStart(2, '0')}:00`,
    min: 999,
    max: 0,
    sum: 0,
    count: 0,
    lowCount: 0,
    highCount: 0,
    // 60 minutes
    minutes: Array.from({ length: 60 }, (_, m) => ({
      minute: m,
      time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      min: 999,
      max: 0,
      sum: 0,
      count: 0,
      lowCount: 0,
      highCount: 0,
      samples: []
    }))
  }));

  for (const item of items) {
    const bpm = item.value?.bpm;
    if (typeof bpm !== 'number' || bpm <= 0 || bpm > 300) continue;
    const dt = item.dateTime; // e.g. "07/21/26 06:45:32"
    const timeParts = dt.split(' ')[1];
    if (!timeParts) continue;
    const [hStr, mStr, sStr] = timeParts.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || h < 0 || h > 23 || isNaN(m) || m < 0 || m > 59) continue;

    dayCount++;
    daySum += bpm;
    if (bpm < dayMin) {
      dayMin = bpm;
      lowestReading = { time: timeParts, bpm };
    }
    if (bpm > dayMax) {
      dayMax = bpm;
      highestReading = { time: timeParts, bpm };
    }
    if (bpm < 60) dayLowCount++;
    if (bpm > 100) dayHighCount++;

    const hBucket = hourlyBuckets[h];
    hBucket.count++;
    hBucket.sum += bpm;
    if (bpm < hBucket.min) hBucket.min = bpm;
    if (bpm > hBucket.max) hBucket.max = bpm;
    if (bpm < 60) hBucket.lowCount++;
    if (bpm > 100) hBucket.highCount++;

    const mBucket = hBucket.minutes[m];
    mBucket.count++;
    mBucket.sum += bpm;
    if (bpm < mBucket.min) mBucket.min = bpm;
    if (bpm > mBucket.max) mBucket.max = bpm;
    if (bpm < 60) mBucket.lowCount++;
    if (bpm > 100) mBucket.highCount++;

    // keep a sample of raw points for high resolution drilldown (up to 12 points per minute = ~every 5s)
    if (mBucket.samples.length < 12) {
      mBucket.samples.push({
        time: timeParts,
        bpm,
        confidence: item.value?.confidence ?? null
      });
    }
  }

  if (dayCount > 0) {
    if (dayMin < globalMin) globalMin = dayMin;
    if (dayMax > globalMax) globalMax = dayMax;
    globalTotalReadings += dayCount;
    globalSum += daySum;
  }

  // Format hourly & minutes
  const formattedHourly = hourlyBuckets.map(h => {
    const hasData = h.count > 0;
    const avg = hasData ? +(h.sum / h.count).toFixed(1) : null;
    const formattedMinutes = h.minutes
      .filter(m => m.count > 0)
      .map(m => ({
        minute: m.minute,
        time: m.time,
        min: m.min,
        max: m.max,
        avg: +(m.sum / m.count).toFixed(1),
        count: m.count,
        lowCount: m.lowCount,
        highCount: m.highCount,
        samples: m.samples
      }));

    return {
      hour: h.hour,
      label: h.label,
      min: hasData ? h.min : null,
      max: hasData ? h.max : null,
      avg: avg,
      count: h.count,
      lowCount: h.lowCount,
      highCount: h.highCount,
      minutes: formattedMinutes
    };
  });

  const daySummary = {
    date: dateStr,
    min: dayCount > 0 ? dayMin : null,
    max: dayCount > 0 ? dayMax : null,
    avg: dayCount > 0 ? +(daySum / dayCount).toFixed(1) : null,
    count: dayCount,
    lowCount: dayLowCount,
    highCount: dayHighCount,
    lowestReading,
    highestReading,
    hourlySparkline: formattedHourly.map(h => (h.count > 0 ? h.avg : null))
  };

  // Write individual day file
  const dayDetail = {
    ...daySummary,
    hourly: formattedHourly
  };
  fs.writeFileSync(
    path.join(daysOutDir, `${dateStr}.json`),
    JSON.stringify(dayDetail)
  );

  // Add to month map
  if (!monthsMap[monthStr]) {
    monthsMap[monthStr] = {
      month: monthStr,
      label: new Date(`${monthStr}-01T12:00:00Z`).toLocaleString('en-US', {
        month: 'long',
        year: 'numeric'
      }),
      days: []
    };
  }
  monthsMap[monthStr].days.push(daySummary);

  if ((i + 1) % 10 === 0 || i === files.length - 1) {
    console.log(`Processed ${i + 1}/${files.length} days...`);
  }
}

// Compute monthly totals
const monthsList = Object.keys(monthsMap).sort().map(mKey => {
  const m = monthsMap[mKey];
  let mMin = 999;
  let mMax = 0;
  let mSum = 0;
  let mCount = 0;
  let mLowCount = 0;
  let mHighCount = 0;

  for (const d of m.days) {
    if (d.count > 0) {
      if (d.min < mMin) mMin = d.min;
      if (d.max > mMax) mMax = d.max;
      mSum += d.avg * d.count;
      mCount += d.count;
      mLowCount += d.lowCount;
      mHighCount += d.highCount;
    }
  }

  return {
    month: m.month,
    label: m.label,
    daysCount: m.days.length,
    min: mCount > 0 ? mMin : null,
    max: mCount > 0 ? mMax : null,
    avg: mCount > 0 ? +(mSum / mCount).toFixed(1) : null,
    totalReadings: mCount,
    lowCount: mLowCount,
    highCount: mHighCount,
    days: m.days.sort((a, b) => a.date.localeCompare(b.date))
  };
});

const globalSummary = {
  meta: {
    generatedAt: new Date().toISOString(),
    totalFiles: files.length,
    totalReadings: globalTotalReadings,
    globalMin,
    globalMax,
    globalAvg: +(globalSum / globalTotalReadings).toFixed(1),
    dateRange: {
      start: files[0].match(/heart_rate-(\d{4}-\d{2}-\d{2})\.json/)[1],
      end: files[files.length - 1].match(/heart_rate-(\d{4}-\d{2}-\d{2})\.json/)[1]
    }
  },
  months: monthsList
};

fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(globalSummary, null, 2));
console.log(`Pre-processing complete in ${(Date.now() - start) / 1000}s!`);
