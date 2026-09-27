/**
 * CardioPulse - High-Performance Heart Rate Analytics Engine
 * Vanilla JavaScript implementation with zero dependencies
 */

(function () {
  'use strict';

  // =========================================================================
  // Application State
  // =========================================================================
  const state = {
    summary: null,
    currentMonth: null,     // e.g. '2026-08'
    currentDate: null,      // e.g. '2026-08-15'
    currentDayData: null,   // Detail JSON for currentDate
    currentHour: 14,        // 0..23
    currentView: 'monthly', // 'monthly' | 'daily' | 'minute'
    monthSubView: 'calendar', // 'calendar' | 'list' | 'chart'
    dayListFilter: 'all',    // 'all' | 'flagged'
    minuteFilter: 'all',    // 'all' | 'flagged' | 'high' | 'low'
    thresholds: {
      low: 60,
      high: 100
    },
    dayCache: {},
    allAnomalies: []
  };

  // DOM Elements Cache
  const el = {};

  // =========================================================================
  // Initialization
  // =========================================================================
  async function init() {
    cacheDomElements();
    setupEventListeners();

    try {
      showLoading(true);
      const res = await fetch('./data/summary.json');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      state.summary = await res.json();

      populateMonthDropdown();

      // Pick default month (prefer August 2026 if present, else first month)
      const availableMonths = state.summary.months.map(m => m.month);
      state.currentMonth = availableMonths.includes('2026-08') ? '2026-08' : availableMonths[0];
      el.monthDropdown.value = state.currentMonth;

      // On mobile screens <= 640px, default to 'list' view for best legibility
      if (window.innerWidth <= 640) {
        state.monthSubView = 'list';
      }

      updateThresholdIndicators();
      computeMonthAnomalies();
      setMonthSubView(state.monthSubView);
      showLoading(false);
    } catch (err) {
      console.error('Failed to load heart rate summary:', err);
      showGlobalError('Could not load heart rate summary data. Ensure server is running.');
    }
  }

  function cacheDomElements() {
    // Header & Nav
    el.monthDropdown = document.getElementById('month-dropdown');
    el.btnPrevMonth = document.getElementById('btn-prev-month');
    el.btnNextMonth = document.getElementById('btn-next-month');
    el.crumbMonth = document.getElementById('crumb-month');
    el.crumbDay = document.getElementById('crumb-day');
    el.crumbMinute = document.getElementById('crumb-minute');
    el.crumbDayLabel = document.getElementById('crumb-day-label');
    el.crumbMinuteLabel = document.getElementById('crumb-minute-label');
    el.crumbSep1 = document.getElementById('crumb-sep-1');
    el.crumbSep2 = document.getElementById('crumb-sep-2');
    el.totalFlagCounter = document.getElementById('total-flag-counter');
    el.btnOpenThresholds = document.getElementById('btn-open-thresholds');
    el.btnOpenAnomalies = document.getElementById('btn-open-anomalies');
    el.labelLowThreshold = document.getElementById('label-low-threshold');
    el.labelHighThreshold = document.getElementById('label-high-threshold');

    // Views
    el.viewMonthly = document.getElementById('view-monthly');
    el.viewDaily = document.getElementById('view-daily');
    el.viewMinute = document.getElementById('view-minute');

    // Monthly View elements
    el.btnToggleCalendar = document.getElementById('btn-toggle-calendar');
    el.btnToggleDayList = document.getElementById('btn-toggle-day-list');
    el.btnToggleMonthChart = document.getElementById('btn-toggle-month-chart');
    el.calendarViewContainer = document.getElementById('calendar-view-container');
    el.dayListViewContainer = document.getElementById('day-list-view-container');
    el.monthChartContainer = document.getElementById('month-chart-container');
    el.dayListMonthTitle = document.getElementById('day-list-month-title');
    el.monthlyDayListItems = document.getElementById('monthly-day-list-items');
    el.filterDaylistAll = document.getElementById('filter-daylist-all');
    el.filterDaylistFlagged = document.getElementById('filter-daylist-flagged');
    el.monthKpiMin = document.getElementById('month-kpi-min');
    el.monthKpiMinDate = document.getElementById('month-kpi-min-date');
    el.monthKpiAvg = document.getElementById('month-kpi-avg');
    el.monthKpiReadings = document.getElementById('month-kpi-readings-count');
    el.monthKpiMax = document.getElementById('month-kpi-max');
    el.monthKpiMaxDate = document.getElementById('month-kpi-max-date');
    el.monthKpiFlags = document.getElementById('month-kpi-flags');
    el.monthKpiFlagBreakdown = document.getElementById('month-kpi-flag-breakdown');
    el.calendarMonthTitle = document.getElementById('calendar-month-title');
    el.monthlyCalendarDays = document.getElementById('monthly-calendar-days');
    el.canvasMonthTrend = document.getElementById('canvas-month-trend');
    el.btnViewMonthFlags = document.getElementById('btn-view-month-flags');

    // Daily View elements
    el.btnBackToMonth = document.getElementById('btn-back-to-month');
    el.btnPrevDay = document.getElementById('btn-prev-day');
    el.btnNextDay = document.getElementById('btn-next-day');
    el.dailyHeading = document.getElementById('daily-heading');
    el.labelPrevDay = document.getElementById('label-prev-day');
    el.labelNextDay = document.getElementById('label-next-day');
    el.dayKpiMin = document.getElementById('day-kpi-min');
    el.dayKpiMinTime = document.getElementById('day-kpi-min-time');
    el.dayKpiAvg = document.getElementById('day-kpi-avg');
    el.dayKpiTotalPoints = document.getElementById('day-kpi-total-points');
    el.dayKpiMax = document.getElementById('day-kpi-max');
    el.dayKpiMaxTime = document.getElementById('day-kpi-max-time');
    el.dayKpiFlagCount = document.getElementById('day-kpi-flag-count');
    el.dayKpiFlagsBreakdown = document.getElementById('day-kpi-flags-breakdown');
    el.canvasDayHourly = document.getElementById('canvas-day-hourly');
    el.hourlyCardsContainer = document.getElementById('hourly-cards-container');
    el.chkFilterFlaggedHours = document.getElementById('chk-filter-flagged-hours');

    // Minute View elements
    el.btnBackToDay = document.getElementById('btn-back-to-day');
    el.btnPrevHour = document.getElementById('btn-prev-hour');
    el.btnNextHour = document.getElementById('btn-next-hour');
    el.minuteHeading = document.getElementById('minute-heading');
    el.hourQuickSelect = document.getElementById('hour-quick-select');
    el.minKpiLow = document.getElementById('min-kpi-low');
    el.minKpiLowTime = document.getElementById('min-kpi-low-time');
    el.minKpiAvg = document.getElementById('min-kpi-avg');
    el.minKpiCount = document.getElementById('min-kpi-count');
    el.minKpiHigh = document.getElementById('min-kpi-high');
    el.minKpiHighTime = document.getElementById('min-kpi-high-time');
    el.minKpiFlags = document.getElementById('min-kpi-flags');
    el.canvasMinuteTrace = document.getElementById('canvas-minute-trace');
    el.minuteTableBody = document.getElementById('minute-table-body');
    el.btnFilterAllMins = document.getElementById('btn-filter-all-mins');
    el.btnFilterFlaggedMins = document.getElementById('btn-filter-flagged-mins');
    el.btnFilterHighMins = document.getElementById('btn-filter-high-mins');
    el.btnFilterLowMins = document.getElementById('btn-filter-low-mins');

    // Modals & Drawer
    el.drawerOverlay = document.getElementById('drawer-overlay');
    el.sideDrawerAnomalies = document.getElementById('side-drawer-anomalies');
    el.btnCloseDrawer = document.getElementById('btn-close-drawer');
    el.anomaliesListContainer = document.getElementById('anomalies-list-container');
    el.tabAnomAll = document.getElementById('tab-anom-all');
    el.tabAnomHigh = document.getElementById('tab-anom-high');
    el.tabAnomLow = document.getElementById('tab-anom-low');
    el.countAnomAll = document.getElementById('count-anom-all');
    el.countAnomHigh = document.getElementById('count-anom-high');
    el.countAnomLow = document.getElementById('count-anom-low');

    el.modalThresholds = document.getElementById('modal-thresholds');
    el.btnCloseThresholds = document.getElementById('btn-close-thresholds-modal');
    el.rangeLowThresh = document.getElementById('range-low-thresh');
    el.inputLowThresh = document.getElementById('input-low-thresh');
    el.rangeHighThresh = document.getElementById('range-high-thresh');
    el.inputHighThresh = document.getElementById('input-high-thresh');
    el.presetStandard = document.getElementById('preset-standard');
    el.presetAthlete = document.getElementById('preset-athlete');
    el.presetStrict = document.getElementById('preset-strict');
    el.btnResetThresholds = document.getElementById('btn-reset-thresholds');
    el.btnApplyThresholds = document.getElementById('btn-apply-thresholds');

    el.modalSensorSamples = document.getElementById('modal-sensor-samples');
    el.btnCloseSamplesModal = document.getElementById('btn-close-samples-modal');
    el.sensorSamplesList = document.getElementById('sensor-samples-list');
    el.modalSamplesSubtitle = document.getElementById('modal-samples-subtitle');

    el.tooltip = document.getElementById('chart-floating-tooltip');
  }

  // =========================================================================
  // Event Listeners
  // =========================================================================
  function setupEventListeners() {
    // Month Dropdown & Nav
    el.monthDropdown.addEventListener('change', (e) => {
      state.currentMonth = e.target.value;
      computeMonthAnomalies();
      renderMonthlyView();
    });

    el.btnPrevMonth.addEventListener('click', () => stepMonth(-1));
    el.btnNextMonth.addEventListener('click', () => stepMonth(1));

    // Breadcrumbs
    el.crumbMonth.addEventListener('click', () => showView('monthly'));
    el.crumbDay.addEventListener('click', () => showView('daily'));
    el.crumbMinute.addEventListener('click', () => showView('minute'));

    // View sub-toggles
    el.btnToggleCalendar.addEventListener('click', () => setMonthSubView('calendar'));
    if (el.btnToggleDayList) {
      el.btnToggleDayList.addEventListener('click', () => setMonthSubView('list'));
    }
    el.btnToggleMonthChart.addEventListener('click', () => setMonthSubView('chart'));

    if (el.filterDaylistAll) {
      el.filterDaylistAll.addEventListener('click', () => setDayListFilter('all'));
    }
    if (el.filterDaylistFlagged) {
      el.filterDaylistFlagged.addEventListener('click', () => setDayListFilter('flagged'));
    }

    // Day View controls
    el.btnBackToMonth.addEventListener('click', () => showView('monthly'));
    el.btnPrevDay.addEventListener('click', () => stepDay(-1));
    el.btnNextDay.addEventListener('click', () => stepDay(1));
    el.chkFilterFlaggedHours.addEventListener('change', () => renderHourlyCards());

    // Minute View controls
    el.btnBackToDay.addEventListener('click', () => showView('daily'));
    el.btnPrevHour.addEventListener('click', () => stepHour(-1));
    el.btnNextHour.addEventListener('click', () => stepHour(1));
    el.hourQuickSelect.addEventListener('change', (e) => {
      state.currentHour = parseInt(e.target.value, 10);
      renderMinuteView();
    });

    // Minute table filters
    el.btnFilterAllMins.addEventListener('click', () => setMinuteFilter('all'));
    el.btnFilterFlaggedMins.addEventListener('click', () => setMinuteFilter('flagged'));
    el.btnFilterHighMins.addEventListener('click', () => setMinuteFilter('high'));
    el.btnFilterLowMins.addEventListener('click', () => setMinuteFilter('low'));

    // Thresholds Modal
    el.btnOpenThresholds.addEventListener('click', () => openThresholdsModal());
    el.btnCloseThresholds.addEventListener('click', () => closeThresholdsModal());
    el.modalThresholds.addEventListener('click', (e) => {
      if (e.target === el.modalThresholds) closeThresholdsModal();
    });

    // Two-way slider & input binding
    el.rangeLowThresh.addEventListener('input', (e) => {
      el.inputLowThresh.value = e.target.value;
      updateActivePresetHighlight();
    });
    el.inputLowThresh.addEventListener('input', (e) => {
      el.rangeLowThresh.value = e.target.value;
      updateActivePresetHighlight();
    });

    el.rangeHighThresh.addEventListener('input', (e) => {
      el.inputHighThresh.value = e.target.value;
      updateActivePresetHighlight();
    });
    el.inputHighThresh.addEventListener('input', (e) => {
      el.rangeHighThresh.value = e.target.value;
      updateActivePresetHighlight();
    });

    // Preset buttons
    el.presetStandard.addEventListener('click', () => setPresetThresholds(60, 100));
    el.presetAthlete.addEventListener('click', () => setPresetThresholds(50, 100));
    el.presetStrict.addEventListener('click', () => setPresetThresholds(60, 90));

    el.btnResetThresholds.addEventListener('click', () => setPresetThresholds(60, 100));
    el.btnApplyThresholds.addEventListener('click', () => {
      state.thresholds.low = parseInt(el.inputLowThresh.value, 10) || 60;
      state.thresholds.high = parseInt(el.inputHighThresh.value, 10) || 100;
      updateThresholdIndicators();
      computeMonthAnomalies();
      closeThresholdsModal();
      refreshCurrentView();
    });

    // Anomalies Drawer
    el.btnOpenAnomalies.addEventListener('click', () => openAnomaliesDrawer());
    el.btnViewMonthFlags.addEventListener('click', () => openAnomaliesDrawer());
    el.btnCloseDrawer.addEventListener('click', () => closeAnomaliesDrawer());
    el.drawerOverlay.addEventListener('click', () => closeAnomaliesDrawer());

    el.tabAnomAll.addEventListener('click', () => renderAnomaliesList('all'));
    el.tabAnomHigh.addEventListener('click', () => renderAnomaliesList('high'));
    el.tabAnomLow.addEventListener('click', () => renderAnomaliesList('low'));

    // Samples Modal
    el.btnCloseSamplesModal.addEventListener('click', () => {
      el.modalSensorSamples.style.display = 'none';
    });
    el.modalSensorSamples.addEventListener('click', (e) => {
      if (e.target === el.modalSensorSamples) el.modalSensorSamples.style.display = 'none';
    });

    // Window Resize -> Re-render active canvas
    window.addEventListener('resize', debounce(() => {
      if (state.currentView === 'monthly' && state.monthSubView === 'chart') {
        renderMonthTrendChart();
      } else if (state.currentView === 'daily') {
        renderDayHourlyChart();
      } else if (state.currentView === 'minute') {
        renderMinuteChart();
      }
    }, 150));
  }

  // =========================================================================
  // View Switcher & Navigation
  // =========================================================================
  function showView(viewName) {
    state.currentView = viewName;

    // Update Section Visibility
    el.viewMonthly.style.display = viewName === 'monthly' ? 'flex' : 'none';
    el.viewDaily.style.display = viewName === 'daily' ? 'flex' : 'none';
    el.viewMinute.style.display = viewName === 'minute' ? 'flex' : 'none';

    // Update Breadcrumbs
    el.crumbMonth.classList.toggle('active', viewName === 'monthly');
    el.crumbDay.classList.toggle('active', viewName === 'daily');
    el.crumbMinute.classList.toggle('active', viewName === 'minute');

    if (viewName === 'monthly') {
      el.crumbSep1.style.display = 'none';
      el.crumbDay.style.display = 'none';
      el.crumbSep2.style.display = 'none';
      el.crumbMinute.style.display = 'none';
      renderMonthlyView();
    } else if (viewName === 'daily') {
      el.crumbSep1.style.display = 'inline';
      el.crumbDay.style.display = 'inline-flex';
      el.crumbSep2.style.display = 'none';
      el.crumbMinute.style.display = 'none';
      el.crumbDayLabel.textContent = formatShortDate(state.currentDate);
      renderDailyView();
    } else if (viewName === 'minute') {
      el.crumbSep1.style.display = 'inline';
      el.crumbDay.style.display = 'inline-flex';
      el.crumbSep2.style.display = 'inline';
      el.crumbMinute.style.display = 'inline-flex';
      el.crumbDayLabel.textContent = formatShortDate(state.currentDate);
      el.crumbMinuteLabel.textContent = `${String(state.currentHour).padStart(2, '0')}:00`;
      renderMinuteView();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function refreshCurrentView() {
    if (state.currentView === 'monthly') renderMonthlyView();
    else if (state.currentView === 'daily') renderDailyView();
    else if (state.currentView === 'minute') renderMinuteView();
  }

  function stepMonth(direction) {
    const months = state.summary.months.map(m => m.month);
    const idx = months.indexOf(state.currentMonth);
    const nextIdx = idx + direction;
    if (nextIdx >= 0 && nextIdx < months.length) {
      state.currentMonth = months[nextIdx];
      el.monthDropdown.value = state.currentMonth;
      computeMonthAnomalies();
      renderMonthlyView();
    }
  }

  function stepDay(direction) {
    const monthObj = getCurrentMonthObj();
    if (!monthObj || !monthObj.days.length) return;
    const dates = monthObj.days.map(d => d.date);
    const idx = dates.indexOf(state.currentDate);
    const nextIdx = idx + direction;
    if (nextIdx >= 0 && nextIdx < dates.length) {
      drillToDay(dates[nextIdx]);
    }
  }

  function stepHour(direction) {
    const nextH = state.currentHour + direction;
    if (nextH >= 0 && nextH <= 23) {
      state.currentHour = nextH;
      renderMinuteView();
    }
  }

  // =========================================================================
  // VIEW 1: MONTHLY VIEW
  // =========================================================================
  function renderMonthlyView() {
    const monthObj = getCurrentMonthObj();
    if (!monthObj) return;

    // Title & Legend
    el.calendarMonthTitle.textContent = `${monthObj.label} Breakdown`;
    document.querySelectorAll('.legend-low-val').forEach(e => e.textContent = state.thresholds.low);
    document.querySelectorAll('.legend-high-val').forEach(e => e.textContent = state.thresholds.high);

    // Compute dynamic monthly stats based on current thresholds
    let mMin = 999;
    let mMax = 0;
    let mSum = 0;
    let mCount = 0;
    let mMinDate = '';
    let mMaxDate = '';
    let flaggedDaysCount = 0;
    let totalHighFlags = 0;
    let totalLowFlags = 0;

    monthObj.days.forEach(d => {
      if (d.count > 0) {
        if (d.min < mMin) {
          mMin = d.min;
          mMinDate = d.date;
        }
        if (d.max > mMax) {
          mMax = d.max;
          mMaxDate = d.date;
        }
        mSum += d.avg * d.count;
        mCount += d.count;

        const isLow = d.min < state.thresholds.low;
        const isHigh = d.max > state.thresholds.high;
        if (isLow || isHigh) flaggedDaysCount++;
        if (isHigh) totalHighFlags += d.highCount || 1;
        if (isLow) totalLowFlags += d.lowCount || 1;
      }
    });

    const mAvg = mCount > 0 ? (mSum / mCount).toFixed(1) : '--';

    el.monthKpiMin.textContent = mMin < 999 ? mMin : '--';
    el.monthKpiMinDate.textContent = mMinDate ? `Lowest on ${formatShortDate(mMinDate)}` : '--';
    el.monthKpiAvg.textContent = mAvg;
    el.monthKpiReadings.textContent = `Based on ${(mCount).toLocaleString()} readings`;
    el.monthKpiMax.textContent = mMax > 0 ? mMax : '--';
    el.monthKpiMaxDate.textContent = mMaxDate ? `Peak on ${formatShortDate(mMaxDate)}` : '--';
    el.monthKpiFlags.textContent = flaggedDaysCount;
    el.monthKpiFlagBreakdown.textContent = `${totalHighFlags} High | ${totalLowFlags} Low events`;

    // Render appropriate sub-view
    if (state.monthSubView === 'calendar') {
      renderCalendarGrid(monthObj);
    } else if (state.monthSubView === 'list') {
      renderDayListView(monthObj);
    } else if (state.monthSubView === 'chart') {
      renderMonthTrendChart();
    }
  }

  function setMonthSubView(subView) {
    state.monthSubView = subView;
    if (el.btnToggleCalendar) el.btnToggleCalendar.classList.toggle('active', subView === 'calendar');
    if (el.btnToggleDayList) el.btnToggleDayList.classList.toggle('active', subView === 'list');
    if (el.btnToggleMonthChart) el.btnToggleMonthChart.classList.toggle('active', subView === 'chart');

    if (el.calendarViewContainer) el.calendarViewContainer.style.display = subView === 'calendar' ? 'flex' : 'none';
    if (el.dayListViewContainer) el.dayListViewContainer.style.display = subView === 'list' ? 'flex' : 'none';
    if (el.monthChartContainer) el.monthChartContainer.style.display = subView === 'chart' ? 'flex' : 'none';

    renderMonthlyView();
  }

  function setDayListFilter(filter) {
    state.dayListFilter = filter;
    if (el.filterDaylistAll) el.filterDaylistAll.classList.toggle('active', filter === 'all');
    if (el.filterDaylistFlagged) el.filterDaylistFlagged.classList.toggle('active', filter === 'flagged');
    const monthObj = getCurrentMonthObj();
    if (monthObj) renderDayListView(monthObj);
  }

  function renderDayListView(monthObj) {
    if (!el.monthlyDayListItems) return;
    el.monthlyDayListItems.innerHTML = '';
    if (el.dayListMonthTitle) {
      el.dayListMonthTitle.textContent = `${monthObj.label} — Day-by-Day Feed`;
    }

    let daysToRender = monthObj.days.slice().sort((a, b) => a.date.localeCompare(b.date));

    if (state.dayListFilter === 'flagged') {
      daysToRender = daysToRender.filter(d => d.max > state.thresholds.high || d.min < state.thresholds.low);
    }

    if (daysToRender.length === 0) {
      el.monthlyDayListItems.innerHTML = `
        <div class="day-list-empty">
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
          <h4>No Flagged Days in ${monthObj.label}</h4>
          <p>All recorded days in this month are within your active threshold boundaries (${state.thresholds.low} – ${state.thresholds.high} BPM).</p>
        </div>
      `;
      return;
    }

    daysToRender.forEach(d => {
      const isHighFlag = d.max > state.thresholds.high;
      const isLowFlag = d.min < state.thresholds.low;

      // Range Bar calculation
      const minBound = 40;
      const maxBound = 170;
      const clampedMin = Math.max(minBound, Math.min(maxBound, d.min));
      const clampedMax = Math.max(minBound, Math.min(maxBound, d.max));
      const leftPct = ((clampedMin - minBound) / (maxBound - minBound)) * 100;
      const widthPct = Math.max(4, ((clampedMax - clampedMin) / (maxBound - minBound)) * 100);

      // Date formatting
      const dateParts = d.date.split('-');
      const dObj = new Date(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10));
      const weekday = dObj.toLocaleDateString('en-US', { weekday: 'short' });
      const dayFormatted = dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      // Badges
      let badgesHtml = '';
      if (isHighFlag) {
        badgesHtml += `<span class="day-card-badge badge-high">⚡ High: ${d.max} BPM</span>`;
      }
      if (isLowFlag) {
        badgesHtml += `<span class="day-card-badge badge-low">❄ Low: ${d.min} BPM</span>`;
      }
      if (!isHighFlag && !isLowFlag) {
        badgesHtml += `<span class="day-card-badge badge-normal">✓ In Range</span>`;
      }

      const card = document.createElement('div');
      card.className = `day-list-card ${isHighFlag ? 'has-high-flag' : ''} ${isLowFlag ? 'has-low-flag' : ''}`;
      card.innerHTML = `
        <div class="day-card-top">
          <div class="day-card-date-wrap">
            <span class="day-card-weekday">${weekday}</span>
            <span class="day-card-date">${dayFormatted}</span>
          </div>
          <div class="day-card-badges">
            ${badgesHtml}
          </div>
        </div>

        <div class="day-card-metrics-grid">
          <div class="day-card-metric card-metric-min">
            <span class="metric-label">Lowest</span>
            <span class="metric-value ${isLowFlag ? 'val-low' : ''}">${d.min} <small>BPM</small></span>
          </div>
          <div class="day-card-metric card-metric-avg">
            <span class="metric-label">Daily Average</span>
            <span class="metric-value val-avg">${d.avg} <small>BPM</small></span>
          </div>
          <div class="day-card-metric card-metric-max">
            <span class="metric-label">Peak</span>
            <span class="metric-value ${isHighFlag ? 'val-high' : ''}">${d.max} <small>BPM</small></span>
          </div>
        </div>

        <div class="day-card-range-section">
          <div class="day-card-range-labels">
            <span>Range: ${d.min} – ${d.max} BPM</span>
            <span>${d.count ? (d.count).toLocaleString() + ' readings' : ''}</span>
          </div>
          <div class="cal-range-bar-wrapper" style="height: 6px;">
            <div class="cal-range-fill" style="left:${leftPct}%; width:${widthPct}%;"></div>
          </div>
        </div>

        <div class="day-card-footer">
          <span class="day-card-cta">View 24h Hourly Breakdown &rarr;</span>
        </div>
      `;

      card.addEventListener('click', () => drillToDay(d.date));
      el.monthlyDayListItems.appendChild(card);
    });
  }

  function renderCalendarGrid(monthObj) {
    el.monthlyCalendarDays.innerHTML = '';

    const [yearStr, monthStr] = monthObj.month.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1; // 0-indexed

    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Map day strings
    const dayMap = {};
    monthObj.days.forEach(d => {
      dayMap[d.date] = d;
    });

    // Empty offset cells
    for (let i = 0; i < firstDay; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'cal-day-cell empty';
      el.monthlyCalendarDays.appendChild(emptyCell);
    }

    // Days of month
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dateStr = `${yearStr}-${monthStr}-${String(dayNum).padStart(2, '0')}`;
      const dayData = dayMap[dateStr];
      const cell = document.createElement('div');
      cell.className = 'cal-day-cell';

      if (!dayData) {
        cell.classList.add('empty');
        cell.innerHTML = `
          <div class="cal-day-head"><span class="cal-day-num">${dayNum}</span></div>
          <div class="cal-metrics-row cal-desktop-metrics"><span style="color:var(--text-muted);font-size:0.75rem;">No data</span></div>
          <div class="cal-mobile-metrics"><span class="cal-mobile-no-data">--</span></div>
        `;
        el.monthlyCalendarDays.appendChild(cell);
        continue;
      }

      // Check threshold flags
      const isHighFlag = dayData.max > state.thresholds.high;
      const isLowFlag = dayData.min < state.thresholds.low;

      if (isHighFlag) cell.classList.add('has-high-flag');
      if (isLowFlag) cell.classList.add('has-low-flag');

      // Visual range bar: relative to 40..170 bpm
      const minBound = 40;
      const maxBound = 170;
      const clampedMin = Math.max(minBound, Math.min(maxBound, dayData.min));
      const clampedMax = Math.max(minBound, Math.min(maxBound, dayData.max));
      const leftPct = ((clampedMin - minBound) / (maxBound - minBound)) * 100;
      const widthPct = Math.max(4, ((clampedMax - clampedMin) / (maxBound - minBound)) * 100);

      // Full text pills for desktop, glowing alert dots for mobile
      let pillsHtml = '';
      let dotsHtml = '';
      if (isHighFlag) {
        pillsHtml += `<span class="cal-pill cal-pill-high" title="Peak exceeds ${state.thresholds.high} BPM">⚡ High</span>`;
        dotsHtml += `<span class="cal-dot dot-high" title="High: ${dayData.max} BPM"></span>`;
      }
      if (isLowFlag) {
        pillsHtml += `<span class="cal-pill cal-pill-low" title="Dip below ${state.thresholds.low} BPM">❄ Low</span>`;
        dotsHtml += `<span class="cal-dot dot-low" title="Low: ${dayData.min} BPM"></span>`;
      }

      cell.innerHTML = `
        <div class="cal-day-head">
          <span class="cal-day-num">${dayNum}</span>
          <div class="cal-flag-pills">${pillsHtml}</div>
          <div class="cal-flag-dots">${dotsHtml}</div>
        </div>
        <!-- Desktop Metrics (Shown on >= 769px) -->
        <div class="cal-metrics-row cal-desktop-metrics">
          <div class="cal-metric-item">
            <span class="cal-metric-label">Min</span>
            <span class="cal-metric-value ${isLowFlag ? 'val-low' : ''}">${dayData.min} <small>BPM</small></span>
          </div>
          <div class="cal-metric-item">
            <span class="cal-metric-label">Avg</span>
            <span class="cal-metric-value val-avg">${dayData.avg} <small>BPM</small></span>
          </div>
          <div class="cal-metric-item">
            <span class="cal-metric-label">Max</span>
            <span class="cal-metric-value ${isHighFlag ? 'val-high' : ''}">${dayData.max} <small>BPM</small></span>
          </div>
        </div>
        <!-- Mobile Metrics (Clean, legible, zero text overlap) -->
        <div class="cal-mobile-metrics">
          <div class="cal-mobile-avg ${isHighFlag ? 'val-high' : isLowFlag ? 'val-low' : 'val-avg'}">
            ${Math.round(dayData.avg)}<span class="cal-mobile-unit">bpm</span>
          </div>
          <div class="cal-mobile-range">
            <span class="${isLowFlag ? 'val-low' : ''}">${dayData.min}</span>·<span class="${isHighFlag ? 'val-high' : ''}">${dayData.max}</span>
          </div>
        </div>
        <div class="cal-range-bar-wrapper" title="Range: ${dayData.min} to ${dayData.max} BPM">
          <div class="cal-range-fill" style="left:${leftPct}%; width:${widthPct}%;"></div>
        </div>
        <div class="cal-day-action-hint">Drilldown &rarr;</div>
      `;

      cell.addEventListener('click', () => drillToDay(dateStr));
      el.monthlyCalendarDays.appendChild(cell);
    }
  }

  function renderMonthTrendChart() {
    const monthObj = getCurrentMonthObj();
    if (!monthObj || !el.canvasMonthTrend) return;

    const canvas = el.canvasMonthTrend;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const padding = { top: 25, right: 30, bottom: 40, left: 45 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    ctx.clearRect(0, 0, w, h);

    const days = monthObj.days;
    if (!days.length) return;

    // Y scale range
    const yMin = 40;
    const yMax = 180;
    const getY = (val) => padding.top + chartH - ((val - yMin) / (yMax - yMin)) * chartH;
    const getX = (i) => padding.left + (i / (days.length - 1 || 1)) * chartW;

    // Draw background threshold danger zones
    const yHighThresh = getY(state.thresholds.high);
    const yLowThresh = getY(state.thresholds.low);

    // High HR zone (> high)
    ctx.fillStyle = 'rgba(244, 63, 94, 0.07)';
    ctx.fillRect(padding.left, padding.top, chartW, Math.max(0, yHighThresh - padding.top));

    // Low HR zone (< low)
    ctx.fillStyle = 'rgba(6, 182, 212, 0.07)';
    ctx.fillRect(padding.left, yLowThresh, chartW, Math.max(0, padding.top + chartH - yLowThresh));

    // Grid lines & labels
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right';

    [50, 70, 90, 110, 130, 150, 170].forEach(bpm => {
      const y = getY(bpm);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
      ctx.fillText(`${bpm}`, padding.left - 8, y + 3);
    });

    // Threshold dashed reference lines
    ctx.setLineDash([4, 4]);

    // High threshold line
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padding.left, yHighThresh);
    ctx.lineTo(w - padding.right, yHighThresh);
    ctx.stroke();

    // Low threshold line
    ctx.strokeStyle = '#06b6d4';
    ctx.beginPath();
    ctx.moveTo(padding.left, yLowThresh);
    ctx.lineTo(w - padding.right, yLowThresh);
    ctx.stroke();

    ctx.setLineDash([]); // Reset dash

    // Draw Min-Max Envelope / Range Bar
    days.forEach((d, i) => {
      const x = getX(i);
      const y1 = getY(d.max);
      const y2 = getY(d.min);

      // Floating range bar
      const isHigh = d.max > state.thresholds.high;
      const isLow = d.min < state.thresholds.low;
      const barColor = isHigh ? 'rgba(244, 63, 94, 0.45)' : isLow ? 'rgba(6, 182, 212, 0.45)' : 'rgba(99, 102, 241, 0.35)';

      ctx.fillStyle = barColor;
      const barW = Math.max(6, Math.min(18, chartW / days.length - 4));
      ctx.beginPath();
      roundRect(ctx, x - barW / 2, y1, barW, Math.max(3, y2 - y1), 3);
      ctx.fill();

      // Top dot (Max)
      ctx.fillStyle = isHigh ? '#f43f5e' : '#818cf8';
      ctx.beginPath();
      ctx.arc(x, y1, 3, 0, Math.PI * 2);
      ctx.fill();

      // Bottom dot (Min)
      ctx.fillStyle = isLow ? '#06b6d4' : '#818cf8';
      ctx.beginPath();
      ctx.arc(x, y2, 3, 0, Math.PI * 2);
      ctx.fill();

      // X label (every few days)
      if (i % 3 === 0 || i === days.length - 1) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        const dNum = d.date.split('-')[2];
        ctx.fillText(`${dNum}`, x, h - padding.bottom + 16);
      }
    });

    // Draw Average Line connecting days
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    days.forEach((d, i) => {
      const x = getX(i);
      const y = getY(d.avg);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Average Nodes
    days.forEach((d, i) => {
      const x = getX(i);
      const y = getY(d.avg);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Interactive Hover & Click Handling on Month Canvas
    canvas.onmousemove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let closestIdx = -1;
      let minDistance = 999;
      days.forEach((d, i) => {
        const x = getX(i);
        const dist = Math.abs(mouseX - x);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = i;
        }
      });

      if (closestIdx !== -1 && minDistance < 25) {
        const d = days[closestIdx];
        const isHigh = d.max > state.thresholds.high;
        const isLow = d.min < state.thresholds.low;
        let flagText = '';
        if (isHigh && isLow) flagText = '<div class="tooltip-flag-pill badge-warn">⚡ High & ❄ Low Episodes</div>';
        else if (isHigh) flagText = '<div class="tooltip-flag-pill badge-high">⚡ Tachycardia Spike</div>';
        else if (isLow) flagText = '<div class="tooltip-flag-pill badge-low">❄ Bradycardia Dip</div>';
        else flagText = '<div class="tooltip-flag-pill badge-normal">✓ Healthy Resting Zone</div>';

        showTooltip(e.clientX, e.clientY, `
          <div class="tooltip-title">${formatFullDate(d.date)}</div>
          <div class="tooltip-row"><span class="tooltip-label">Min HR:</span> <span class="tooltip-val ${isLow ? 'val-low' : ''}">${d.min} BPM</span></div>
          <div class="tooltip-row"><span class="tooltip-label">Avg HR:</span> <span class="tooltip-val">${d.avg} BPM</span></div>
          <div class="tooltip-row"><span class="tooltip-label">Max HR:</span> <span class="tooltip-val ${isHigh ? 'val-high' : ''}">${d.max} BPM</span></div>
          <div class="tooltip-row"><span class="tooltip-label">Readings:</span> <span class="tooltip-val">${(d.count).toLocaleString()}</span></div>
          ${flagText}
          <div style="font-size:0.7rem; color:#818cf8; text-align:center; margin-top:4px;">Click to drill down &rarr;</div>
        `);
      } else {
        hideTooltip();
      }
    };

    canvas.onmouseleave = hideTooltip;

    canvas.onclick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      let closestIdx = -1;
      let minDistance = 999;
      days.forEach((d, i) => {
        const x = getX(i);
        const dist = Math.abs(mouseX - x);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = i;
        }
      });
      if (closestIdx !== -1 && minDistance < 25) {
        hideTooltip();
        drillToDay(days[closestIdx].date);
      }
    };
  }

  // =========================================================================
  // VIEW 2: DAILY VIEW (BROKEN DOWN BY HOUR)
  // =========================================================================
  async function drillToDay(dateStr) {
    state.currentDate = dateStr;
    showLoading(true);

    try {
      if (!state.dayCache[dateStr]) {
        const res = await fetch(`/data/days/${dateStr}.json`);
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        state.dayCache[dateStr] = await res.json();
      }
      state.currentDayData = state.dayCache[dateStr];
      showView('daily');
    } catch (err) {
      console.error(`Failed to load day data for ${dateStr}:`, err);
      showGlobalError(`Could not load hourly detail for ${dateStr}.`);
    } finally {
      showLoading(false);
    }
  }

  function renderDailyView() {
    const data = state.currentDayData;
    if (!data) return;

    el.dailyHeading.textContent = formatFullDate(data.date);

    // Prev / Next Day Button Labels
    const monthObj = getCurrentMonthObj();
    if (monthObj) {
      const dates = monthObj.days.map(d => d.date);
      const idx = dates.indexOf(data.date);
      el.btnPrevDay.disabled = idx <= 0;
      el.btnNextDay.disabled = idx >= dates.length - 1;
      el.labelPrevDay.textContent = idx > 0 ? formatShortDate(dates[idx - 1]) : 'Prev';
      el.labelNextDay.textContent = idx < dates.length - 1 ? formatShortDate(dates[idx + 1]) : 'Next';
    }

    // Dynamic stats based on active thresholds
    let dMin = 999;
    let dMax = 0;
    let dSum = 0;
    let dCount = 0;
    let flaggedHours = 0;
    let lowReadingsCount = 0;
    let highReadingsCount = 0;

    data.hourly.forEach(h => {
      if (h.count > 0) {
        if (h.min < dMin) dMin = h.min;
        if (h.max > dMax) dMax = h.max;
        dSum += h.avg * h.count;
        dCount += h.count;

        const isLow = h.min < state.thresholds.low;
        const isHigh = h.max > state.thresholds.high;
        if (isLow || isHigh) flaggedHours++;
        if (isHigh) highReadingsCount += h.highCount || 1;
        if (isLow) lowReadingsCount += h.lowCount || 1;
      }
    });

    const dAvg = dCount > 0 ? (dSum / dCount).toFixed(1) : '--';

    el.dayKpiMin.textContent = dMin < 999 ? dMin : '--';
    el.dayKpiMinTime.textContent = data.lowestReading ? `Recorded at ${data.lowestReading.time}` : 'Time: --:--:--';
    el.dayKpiAvg.textContent = dAvg;
    el.dayKpiTotalPoints.textContent = `${(dCount).toLocaleString()} sensor readings`;
    el.dayKpiMax.textContent = dMax > 0 ? dMax : '--';
    el.dayKpiMaxTime.textContent = data.highestReading ? `Recorded at ${data.highestReading.time}` : 'Time: --:--:--';
    el.dayKpiFlagCount.textContent = flaggedHours;
    el.dayKpiFlagsBreakdown.textContent = `${highReadingsCount} Readings > ${state.thresholds.high} • ${lowReadingsCount} Readings < ${state.thresholds.low}`;

    // Render 24-hour timeline chart and cards
    renderDayHourlyChart();
    renderHourlyCards();
  }

  function renderDayHourlyChart() {
    const data = state.currentDayData;
    if (!data || !el.canvasDayHourly) return;

    const canvas = el.canvasDayHourly;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const padding = { top: 25, right: 30, bottom: 40, left: 45 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    ctx.clearRect(0, 0, w, h);

    const hours = data.hourly;
    const yMin = 40;
    const yMax = 180;
    const getY = (val) => padding.top + chartH - ((val - yMin) / (yMax - yMin)) * chartH;
    const getX = (hourNum) => padding.left + (hourNum / 23) * chartW;

    // Threshold Alert Zones (shaded background)
    const yHighThresh = getY(state.thresholds.high);
    const yLowThresh = getY(state.thresholds.low);

    ctx.fillStyle = 'rgba(244, 63, 94, 0.08)';
    ctx.fillRect(padding.left, padding.top, chartW, Math.max(0, yHighThresh - padding.top));

    ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
    ctx.fillRect(padding.left, yLowThresh, chartW, Math.max(0, padding.top + chartH - yLowThresh));

    // Horizontal Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right';

    [50, 70, 90, 110, 130, 150, 170].forEach(bpm => {
      const y = getY(bpm);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
      ctx.fillText(`${bpm}`, padding.left - 8, y + 3);
    });

    // Dashed threshold lines
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padding.left, yHighThresh);
    ctx.lineTo(w - padding.right, yHighThresh);
    ctx.stroke();

    ctx.strokeStyle = '#06b6d4';
    ctx.beginPath();
    ctx.moveTo(padding.left, yLowThresh);
    ctx.lineTo(w - padding.right, yLowThresh);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Hourly Range Bars (Min to Max)
    const barWidth = Math.max(8, Math.min(22, (chartW / 24) - 4));

    hours.forEach(hItem => {
      if (hItem.count === 0) return;
      const x = getX(hItem.hour);
      const yMaxVal = getY(hItem.max);
      const yMinVal = getY(hItem.min);

      const isHigh = hItem.max > state.thresholds.high;
      const isLow = hItem.min < state.thresholds.low;
      let barFill = 'rgba(99, 102, 241, 0.4)';
      if (isHigh && isLow) barFill = 'rgba(168, 85, 247, 0.55)';
      else if (isHigh) barFill = 'rgba(244, 63, 94, 0.55)';
      else if (isLow) barFill = 'rgba(6, 182, 212, 0.55)';

      ctx.fillStyle = barFill;
      ctx.beginPath();
      roundRect(ctx, x - barWidth / 2, yMaxVal, barWidth, Math.max(3, yMinVal - yMaxVal), 4);
      ctx.fill();

      // Top dot
      ctx.fillStyle = isHigh ? '#f43f5e' : '#818cf8';
      ctx.beginPath();
      ctx.arc(x, yMaxVal, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Bottom dot
      ctx.fillStyle = isLow ? '#06b6d4' : '#818cf8';
      ctx.beginPath();
      ctx.arc(x, yMinVal, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Average Curve
    const validHours = hours.filter(h => h.count > 0);
    if (validHours.length > 1) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      validHours.forEach((hItem, idx) => {
        const x = getX(hItem.hour);
        const y = getY(hItem.avg);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      validHours.forEach(hItem => {
        const x = getX(hItem.hour);
        const y = getY(hItem.avg);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1e1b4b';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    // X Axis Labels (Hours 00:00 to 23:00)
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    hours.forEach(hItem => {
      if (hItem.hour % 2 === 0 || hItem.hour === 23) {
        const x = getX(hItem.hour);
        ctx.fillText(`${String(hItem.hour).padStart(2, '0')}:00`, x, h - padding.bottom + 16);
      }
    });

    // Interactive Hover on Hourly Canvas
    canvas.onmousemove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;

      let closestH = null;
      let minDistance = 999;
      hours.forEach(hItem => {
        if (hItem.count === 0) return;
        const x = getX(hItem.hour);
        const dist = Math.abs(mouseX - x);
        if (dist < minDistance) {
          minDistance = dist;
          closestH = hItem;
        }
      });

      if (closestH && minDistance < 22) {
        const isHigh = closestH.max > state.thresholds.high;
        const isLow = closestH.min < state.thresholds.low;
        let flagText = '';
        if (isHigh && isLow) flagText = '<div class="tooltip-flag-pill badge-warn">⚡ High & ❄ Low Spikes</div>';
        else if (isHigh) flagText = '<div class="tooltip-flag-pill badge-high">⚡ Tachycardia Breached</div>';
        else if (isLow) flagText = '<div class="tooltip-flag-pill badge-low">❄ Bradycardia Breached</div>';
        else flagText = '<div class="tooltip-flag-pill badge-normal">✓ Normal Zone</div>';

        showTooltip(e.clientX, e.clientY, `
          <div class="tooltip-title">Hour ${String(closestH.hour).padStart(2, '0')}:00 – ${String(closestH.hour).padStart(2, '0')}:59</div>
          <div class="tooltip-row"><span class="tooltip-label">Min BPM:</span> <span class="tooltip-val ${isLow ? 'val-low' : ''}">${closestH.min} BPM</span></div>
          <div class="tooltip-row"><span class="tooltip-label">Avg BPM:</span> <span class="tooltip-val">${closestH.avg} BPM</span></div>
          <div class="tooltip-row"><span class="tooltip-label">Max BPM:</span> <span class="tooltip-val ${isHigh ? 'val-high' : ''}">${closestH.max} BPM</span></div>
          <div class="tooltip-row"><span class="tooltip-label">Readings:</span> <span class="tooltip-val">${(closestH.count).toLocaleString()}</span></div>
          ${flagText}
          <div style="font-size:0.7rem; color:#818cf8; text-align:center; margin-top:4px;">Click to drill into minute view &rarr;</div>
        `);
      } else {
        hideTooltip();
      }
    };

    canvas.onmouseleave = hideTooltip;

    canvas.onclick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      let closestH = null;
      let minDistance = 999;
      hours.forEach(hItem => {
        if (hItem.count === 0) return;
        const x = getX(hItem.hour);
        const dist = Math.abs(mouseX - x);
        if (dist < minDistance) {
          minDistance = dist;
          closestH = hItem;
        }
      });
      if (closestH && minDistance < 22) {
        hideTooltip();
        drillToMinute(closestH.hour);
      }
    };
  }

  function renderHourlyCards() {
    const data = state.currentDayData;
    if (!data) return;

    el.hourlyCardsContainer.innerHTML = '';
    const filterFlaggedOnly = el.chkFilterFlaggedHours.checked;

    data.hourly.forEach(hItem => {
      if (hItem.count === 0) return;

      const isHigh = hItem.max > state.thresholds.high;
      const isLow = hItem.min < state.thresholds.low;

      if (filterFlaggedOnly && !isHigh && !isLow) return;

      const card = document.createElement('div');
      card.className = 'hour-card';
      if (isHigh) card.classList.add('flag-high');
      if (isLow) card.classList.add('flag-low');

      let statusBadge = '<span class="badge-indicator badge-normal">Normal</span>';
      if (isHigh && isLow) statusBadge = '<span class="badge-indicator badge-warn">⚡ High & ❄ Low</span>';
      else if (isHigh) statusBadge = `<span class="badge-indicator badge-high">⚡ High (${hItem.max})</span>`;
      else if (isLow) statusBadge = `<span class="badge-indicator badge-low">❄ Low (${hItem.min})</span>`;

      card.innerHTML = `
        <div class="hour-card-header">
          <span class="hour-label">${String(hItem.hour).padStart(2, '0')}:00 – ${String(hItem.hour).padStart(2, '0')}:59</span>
          ${statusBadge}
        </div>
        <div class="hour-kpis">
          <div class="hour-kpi-box">
            <span class="hour-kpi-sub">Min</span>
            <span class="hour-kpi-val ${isLow ? 'val-low' : ''}">${hItem.min}</span>
          </div>
          <div class="hour-kpi-box">
            <span class="hour-kpi-sub">Avg</span>
            <span class="hour-kpi-val">${hItem.avg}</span>
          </div>
          <div class="hour-kpi-box">
            <span class="hour-kpi-sub">Max</span>
            <span class="hour-kpi-val ${isHigh ? 'val-high' : ''}">${hItem.max}</span>
          </div>
        </div>
        <div class="hour-card-foot">
          <span style="color:var(--text-muted);">${(hItem.count).toLocaleString()} readings</span>
          <button class="hour-drill-btn">Inspect Minutes &rarr;</button>
        </div>
      `;

      card.addEventListener('click', () => drillToMinute(hItem.hour));
      el.hourlyCardsContainer.appendChild(card);
    });

    if (el.hourlyCardsContainer.children.length === 0) {
      el.hourlyCardsContainer.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-muted);">No hours meet the active filter.</div>';
    }
  }

  // =========================================================================
  // VIEW 3: MINUTE VIEW (BROKEN DOWN BY MINUTE)
  // =========================================================================
  function drillToMinute(hour) {
    state.currentHour = hour;
    showView('minute');
  }

  function renderMinuteView() {
    const data = state.currentDayData;
    if (!data) return;

    const hourData = data.hourly[state.currentHour];
    if (!hourData) return;

    el.minuteHeading.textContent = `Hour ${String(state.currentHour).padStart(2, '0')}:00 – ${String(state.currentHour).padStart(2, '0')}:59 Breakdown`;
    populateHourDropdown();
    el.hourQuickSelect.value = state.currentHour;

    // Previous / Next Hour Buttons
    el.btnPrevHour.disabled = state.currentHour <= 0;
    el.btnNextHour.disabled = state.currentHour >= 23;

    // Dynamic stats for this hour based on thresholds
    let minLow = 999;
    let minHigh = 0;
    let minSum = 0;
    let minCount = 0;
    let lowTime = '';
    let highTime = '';
    let flaggedMinsCount = 0;

    hourData.minutes.forEach(m => {
      if (m.count > 0) {
        if (m.min < minLow) {
          minLow = m.min;
          lowTime = m.time;
        }
        if (m.max > minHigh) {
          minHigh = m.max;
          highTime = m.time;
        }
        minSum += m.avg * m.count;
        minCount += m.count;

        const isLow = m.min < state.thresholds.low;
        const isHigh = m.max > state.thresholds.high;
        if (isLow || isHigh) flaggedMinsCount++;
      }
    });

    const hourAvg = minCount > 0 ? (minSum / minCount).toFixed(1) : '--';
    const isHourLow = minLow < state.thresholds.low;
    const isHourHigh = minHigh > state.thresholds.high;

    el.minKpiLow.textContent = minLow < 999 ? minLow : '--';
    el.minKpiLowTime.textContent = lowTime ? `Recorded at ${lowTime}` : 'At --:--';
    el.minKpiLow.className = `kpi-val ${isHourLow ? 'val-low' : ''}`;

    el.minKpiAvg.textContent = hourAvg;
    el.minKpiCount.textContent = `${(minCount).toLocaleString()} readings in hour`;

    el.minKpiHigh.textContent = minHigh > 0 ? minHigh : '--';
    el.minKpiHighTime.textContent = highTime ? `Recorded at ${highTime}` : 'At --:--';
    el.minKpiHigh.className = `kpi-val ${isHourHigh ? 'val-high' : ''}`;

    el.minKpiFlags.textContent = flaggedMinsCount;

    // Update threshold badges on buttons
    document.querySelectorAll('.btn-thresh-high').forEach(e => e.textContent = state.thresholds.high);
    document.querySelectorAll('.btn-thresh-low').forEach(e => e.textContent = state.thresholds.low);

    renderMinuteChart();
    renderMinuteTable();
  }

  function renderMinuteChart() {
    const data = state.currentDayData;
    if (!data || !el.canvasMinuteTrace) return;

    const hourData = data.hourly[state.currentHour];
    if (!hourData) return;

    const canvas = el.canvasMinuteTrace;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const padding = { top: 25, right: 30, bottom: 40, left: 45 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    ctx.clearRect(0, 0, w, h);

    const minutes = hourData.minutes;
    const yMin = 40;
    const yMax = 180;
    const getY = (val) => padding.top + chartH - ((val - yMin) / (yMax - yMin)) * chartH;
    const getX = (minNum) => padding.left + (minNum / 59) * chartW;

    // Threshold Alert Zones
    const yHighThresh = getY(state.thresholds.high);
    const yLowThresh = getY(state.thresholds.low);

    ctx.fillStyle = 'rgba(244, 63, 94, 0.08)';
    ctx.fillRect(padding.left, padding.top, chartW, Math.max(0, yHighThresh - padding.top));

    ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
    ctx.fillRect(padding.left, yLowThresh, chartW, Math.max(0, padding.top + chartH - yLowThresh));

    // Horizontal Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right';

    [50, 70, 90, 110, 130, 150, 170].forEach(bpm => {
      const y = getY(bpm);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
      ctx.fillText(`${bpm}`, padding.left - 8, y + 3);
    });

    // Dashed threshold lines
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padding.left, yHighThresh);
    ctx.lineTo(w - padding.right, yHighThresh);
    ctx.stroke();

    ctx.strokeStyle = '#06b6d4';
    ctx.beginPath();
    ctx.moveTo(padding.left, yLowThresh);
    ctx.lineTo(w - padding.right, yLowThresh);
    ctx.stroke();
    ctx.setLineDash([]);

    if (minutes.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No readings recorded in this hour.', w / 2, h / 2);
      return;
    }

    // Draw Min-Max Shaded Band
    ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
    ctx.beginPath();
    // Top boundary (Max)
    minutes.forEach((m, idx) => {
      const x = getX(m.minute);
      const y = getY(m.max);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    // Bottom boundary (Min, in reverse)
    for (let i = minutes.length - 1; i >= 0; i--) {
      const m = minutes[i];
      const x = getX(m.minute);
      const y = getY(m.min);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // Average Curve Line
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    minutes.forEach((m, idx) => {
      const x = getX(m.minute);
      const y = getY(m.avg);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Highlight Dots & Spikes
    minutes.forEach(m => {
      const x = getX(m.minute);
      const yAvg = getY(m.avg);
      const isHigh = m.max > state.thresholds.high;
      const isLow = m.min < state.thresholds.low;

      if (isHigh || isLow) {
        // Glowing alert dot
        ctx.fillStyle = isHigh ? '#f43f5e' : '#06b6d4';
        ctx.shadowColor = isHigh ? 'rgba(244, 63, 94, 0.7)' : 'rgba(6, 182, 212, 0.7)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(x, isHigh ? getY(m.max) : getY(m.min), 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // reset
      } else {
        // Subtle avg node
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(x, yAvg, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // X Axis Minute Labels (every 5 or 10 mins)
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    [0, 10, 20, 30, 40, 50, 59].forEach(minNum => {
      const x = getX(minNum);
      const label = `${String(state.currentHour).padStart(2, '0')}:${String(minNum).padStart(2, '0')}`;
      ctx.fillText(label, x, h - padding.bottom + 16);
    });

    // Interactive Hover on Minute Chart
    canvas.onmousemove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;

      let closestM = null;
      let minDistance = 999;
      minutes.forEach(m => {
        const x = getX(m.minute);
        const dist = Math.abs(mouseX - x);
        if (dist < minDistance) {
          minDistance = dist;
          closestM = m;
        }
      });

      if (closestM && minDistance < 15) {
        const isHigh = closestM.max > state.thresholds.high;
        const isLow = closestM.min < state.thresholds.low;
        let flagText = '';
        if (isHigh && isLow) flagText = '<div class="tooltip-flag-pill badge-warn">⚡ High & ❄ Low in Minute</div>';
        else if (isHigh) flagText = `<div class="tooltip-flag-pill badge-high">⚡ Tachycardia (${closestM.max} BPM)</div>`;
        else if (isLow) flagText = `<div class="tooltip-flag-pill badge-low">❄ Bradycardia (${closestM.min} BPM)</div>`;
        else flagText = '<div class="tooltip-flag-pill badge-normal">✓ Normal Rhythm</div>';

        showTooltip(e.clientX, e.clientY, `
          <div class="tooltip-title">${closestM.time} Telemetry</div>
          <div class="tooltip-row"><span class="tooltip-label">Min:</span> <span class="tooltip-val ${isLow ? 'val-low' : ''}">${closestM.min} BPM</span></div>
          <div class="tooltip-row"><span class="tooltip-label">Avg:</span> <span class="tooltip-val">${closestM.avg} BPM</span></div>
          <div class="tooltip-row"><span class="tooltip-label">Max:</span> <span class="tooltip-val ${isHigh ? 'val-high' : ''}">${closestM.max} BPM</span></div>
          <div class="tooltip-row"><span class="tooltip-label">Samples:</span> <span class="tooltip-val">${closestM.count} readings</span></div>
          ${flagText}
          <div style="font-size:0.7rem; color:#818cf8; text-align:center; margin-top:4px;">Click to view raw sensor beats &rarr;</div>
        `);
      } else {
        hideTooltip();
      }
    };

    canvas.onmouseleave = hideTooltip;

    canvas.onclick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      let closestM = null;
      let minDistance = 999;
      minutes.forEach(m => {
        const x = getX(m.minute);
        const dist = Math.abs(mouseX - x);
        if (dist < minDistance) {
          minDistance = dist;
          closestM = m;
        }
      });
      if (closestM && minDistance < 15) {
        hideTooltip();
        openSensorSamplesModal(closestM);
      }
    };
  }

  function renderMinuteTable() {
    const data = state.currentDayData;
    if (!data) return;

    const hourData = data.hourly[state.currentHour];
    if (!hourData) return;

    el.minuteTableBody.innerHTML = '';
    let filteredMinutes = hourData.minutes;

    if (state.minuteFilter === 'flagged') {
      filteredMinutes = filteredMinutes.filter(m => m.max > state.thresholds.high || m.min < state.thresholds.low);
    } else if (state.minuteFilter === 'high') {
      filteredMinutes = filteredMinutes.filter(m => m.max > state.thresholds.high);
    } else if (state.minuteFilter === 'low') {
      filteredMinutes = filteredMinutes.filter(m => m.min < state.thresholds.low);
    }

    if (filteredMinutes.length === 0) {
      el.minuteTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text-muted);">No minute readings match the selected filter.</td></tr>';
      return;
    }

    filteredMinutes.forEach(m => {
      const isHigh = m.max > state.thresholds.high;
      const isLow = m.min < state.thresholds.low;
      const spread = m.max - m.min;

      const tr = document.createElement('tr');
      if (isHigh) tr.classList.add('row-high');
      else if (isLow) tr.classList.add('row-low');

      let statusHtml = '<span class="badge-indicator badge-normal">Normal</span>';
      if (isHigh && isLow) statusHtml = '<span class="badge-indicator badge-warn">⚡ High & ❄ Low</span>';
      else if (isHigh) statusHtml = `<span class="badge-indicator badge-high">⚡ High Peak (${m.max})</span>`;
      else if (isLow) statusHtml = `<span class="badge-indicator badge-low">❄ Low Dip (${m.min})</span>`;

      tr.innerHTML = `
        <td class="cell-time">${m.time}</td>
        <td class="${isLow ? 'val-low' : ''}">${m.min} BPM</td>
        <td class="val-avg">${m.avg} BPM</td>
        <td class="${isHigh ? 'val-high' : ''}">${m.max} BPM</td>
        <td>&plusmn;${spread} BPM</td>
        <td>${m.count}</td>
        <td>${statusHtml}</td>
        <td><button class="inspect-btn">Raw Beats &rarr;</button></td>
      `;

      tr.querySelector('.inspect-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openSensorSamplesModal(m);
      });

      tr.addEventListener('click', () => openSensorSamplesModal(m));
      el.minuteTableBody.appendChild(tr);
    });
  }

  function setMinuteFilter(filter) {
    state.minuteFilter = filter;
    el.btnFilterAllMins.classList.toggle('active', filter === 'all');
    el.btnFilterFlaggedMins.classList.toggle('active', filter === 'flagged');
    el.btnFilterHighMins.classList.toggle('active', filter === 'high');
    el.btnFilterLowMins.classList.toggle('active', filter === 'low');
    renderMinuteTable();
  }

  // =========================================================================
  // SUB-MINUTE SENSOR SAMPLES MODAL
  // =========================================================================
  function openSensorSamplesModal(minuteItem) {
    el.modalSamplesSubtitle.textContent = `Timestamp ${minuteItem.time} • ${minuteItem.count} beats recorded (Sample view)`;
    el.sensorSamplesList.innerHTML = '';

    if (!minuteItem.samples || minuteItem.samples.length === 0) {
      el.sensorSamplesList.innerHTML = '<div style="color:var(--text-muted);padding:1rem;">No individual beat samples stored for this minute.</div>';
    } else {
      minuteItem.samples.forEach(s => {
        const isHigh = s.bpm > state.thresholds.high;
        const isLow = s.bpm < state.thresholds.low;
        const card = document.createElement('div');
        card.className = `sensor-sample-card ${isHigh ? 'card-flag-high' : isLow ? 'card-flag-low' : ''}`;
        card.innerHTML = `
          <div class="sample-time">${s.time}</div>
          <div class="sample-bpm ${isHigh ? 'val-high' : isLow ? 'val-low' : ''}">${s.bpm} <span style="font-size:0.75rem;font-weight:400;color:var(--text-secondary);">BPM</span></div>
          <div class="sample-conf">Confidence: ${s.confidence !== null ? s.confidence : 'N/A'}/3</div>
        `;
        el.sensorSamplesList.appendChild(card);
      });
    }

    el.modalSensorSamples.style.display = 'flex';
  }

  // =========================================================================
  // FLAGGED ANOMALIES DRAWER & LOGIC
  // =========================================================================
  function computeMonthAnomalies() {
    const monthObj = getCurrentMonthObj();
    if (!monthObj) return;

    state.allAnomalies = [];

    monthObj.days.forEach(d => {
      if (d.max > state.thresholds.high) {
        state.allAnomalies.push({
          date: d.date,
          bpm: d.max,
          time: d.highestReading ? d.highestReading.time : 'Unknown',
          type: 'high',
          label: 'Tachycardia High Peak'
        });
      }
      if (d.min < state.thresholds.low) {
        state.allAnomalies.push({
          date: d.date,
          bpm: d.min,
          time: d.lowestReading ? d.lowestReading.time : 'Unknown',
          type: 'low',
          label: 'Bradycardia Low Dip'
        });
      }
    });

    state.allAnomalies.sort((a, b) => b.bpm - a.bpm);

    // Update Counter badge in header
    el.totalFlagCounter.textContent = state.allAnomalies.length;
    el.countAnomAll.textContent = state.allAnomalies.length;
    el.countAnomHigh.textContent = state.allAnomalies.filter(a => a.type === 'high').length;
    el.countAnomLow.textContent = state.allAnomalies.filter(a => a.type === 'low').length;
  }

  function openAnomaliesDrawer() {
    renderAnomaliesList('all');
    el.sideDrawerAnomalies.classList.add('open');
    el.drawerOverlay.style.display = 'block';
  }

  function closeAnomaliesDrawer() {
    el.sideDrawerAnomalies.classList.remove('open');
    el.drawerOverlay.style.display = 'none';
  }

  function renderAnomaliesList(filterType) {
    el.tabAnomAll.classList.toggle('active', filterType === 'all');
    el.tabAnomHigh.classList.toggle('active', filterType === 'high');
    el.tabAnomLow.classList.toggle('active', filterType === 'low');

    el.anomaliesListContainer.innerHTML = '';
    let list = state.allAnomalies;
    if (filterType !== 'all') {
      list = list.filter(a => a.type === filterType);
    }

    if (list.length === 0) {
      el.anomaliesListContainer.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted);">No flagged anomalies detected under current thresholds.</div>';
      return;
    }

    list.forEach(item => {
      const isHigh = item.type === 'high';
      const div = document.createElement('div');
      div.className = `anomaly-item ${isHigh ? 'item-high' : 'item-low'}`;
      div.innerHTML = `
        <div class="anomaly-info">
          <span class="anomaly-date">${formatFullDate(item.date)}</span>
          <span class="anomaly-time-badge">Time: ${item.time}</span>
          <div class="anomaly-bpm-stat">
            <span class="anomaly-val ${isHigh ? 'val-high' : 'val-low'}">${item.bpm} BPM</span>
            <span class="badge-indicator ${isHigh ? 'badge-high' : 'badge-low'}">${isHigh ? `> ${state.thresholds.high}` : `< ${state.thresholds.low}`}</span>
          </div>
        </div>
        <button class="jump-moment-btn">Jump to Day &rarr;</button>
      `;

      div.querySelector('.jump-moment-btn').addEventListener('click', () => {
        closeAnomaliesDrawer();
        drillToDay(item.date);
      });

      el.anomaliesListContainer.appendChild(div);
    });
  }

  // =========================================================================
  // THRESHOLDS CONFIGURATION MODAL
  // =========================================================================
  function openThresholdsModal() {
    el.rangeLowThresh.value = state.thresholds.low;
    el.inputLowThresh.value = state.thresholds.low;
    el.rangeHighThresh.value = state.thresholds.high;
    el.inputHighThresh.value = state.thresholds.high;
    updateActivePresetHighlight();
    el.modalThresholds.style.display = 'flex';
  }

  function closeThresholdsModal() {
    el.modalThresholds.style.display = 'none';
  }

  function setPresetThresholds(low, high) {
    el.rangeLowThresh.value = low;
    el.inputLowThresh.value = low;
    el.rangeHighThresh.value = high;
    el.inputHighThresh.value = high;
    updateActivePresetHighlight();
  }

  function updateActivePresetHighlight() {
    const low = parseInt(el.inputLowThresh.value, 10);
    const high = parseInt(el.inputHighThresh.value, 10);
    el.presetStandard.classList.toggle('active', low === 60 && high === 100);
    el.presetAthlete.classList.toggle('active', low === 50 && high === 100);
    el.presetStrict.classList.toggle('active', low === 60 && high === 90);
  }

  function updateThresholdIndicators() {
    el.labelLowThreshold.textContent = `< ${state.thresholds.low}`;
    el.labelHighThreshold.textContent = `> ${state.thresholds.high}`;
  }

  // =========================================================================
  // Tooltip Helper
  // =========================================================================
  function showTooltip(clientX, clientY, html) {
    el.tooltip.innerHTML = html;
    el.tooltip.style.left = `${clientX}px`;
    el.tooltip.style.top = `${clientY}px`;
    el.tooltip.style.display = 'flex';
  }

  function hideTooltip() {
    el.tooltip.style.display = 'none';
  }

  // =========================================================================
  // Helper Utilities
  // =========================================================================
  function getCurrentMonthObj() {
    if (!state.summary || !state.summary.months) return null;
    return state.summary.months.find(m => m.month === state.currentMonth) || state.summary.months[0];
  }

  function populateMonthDropdown() {
    el.monthDropdown.innerHTML = '';
    state.summary.months.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.month;
      opt.textContent = m.label;
      el.monthDropdown.appendChild(opt);
    });
  }

  function populateHourDropdown() {
    el.hourQuickSelect.innerHTML = '';
    for (let h = 0; h < 24; h++) {
      const opt = document.createElement('option');
      opt.value = h;
      opt.textContent = `${String(h).padStart(2, '0')}:00`;
      el.hourQuickSelect.appendChild(opt);
    }
  }

  function formatShortDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function formatFullDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  function roundRect(ctx, x, y, width, height, radius) {
    if (width < 2 * radius) radius = width / 2;
    if (height < 2 * radius) radius = height / 2;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }

  function debounce(fn, ms) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function showLoading(isLoading) {
    document.body.style.cursor = isLoading ? 'wait' : 'default';
  }

  function showGlobalError(msg) {
    alert(msg);
  }

  // Start application on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
