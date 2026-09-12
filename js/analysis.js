/**
 * ============================================================================
 * DATASPHERE ANALYTICS - ANALYSIS MODULE (analysis.js)
 * Descriptive Statistical Engine, Correlation Matrix, Chart.js EDA Visualizer,
 * Plot Explanations, Alternative Plot Guides, Custom Interactive Studio & Actionable Summaries
 * ============================================================================
 */

let chartDistributionInstance = null;
let chartRelationshipInstance = null;
let chartCompositionInstance = null;
let chartCustomStudioInstance = null;

const THEME_PALETTES = {
  neon: ['#6366f1', '#06b6d4', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#3b82f6', '#14b8a6'],
  emerald: ['#10b981', '#059669', '#34d399', '#047857', '#6ee7b7', '#065f46', '#a7f3d0'],
  sunset: ['#f59e0b', '#f97316', '#ef4444', '#ec4899', '#8b5cf6', '#d97706', '#b45309'],
  corporate: ['#3b82f6', '#6366f1', '#475569', '#64748b', '#0284c7', '#1e293b', '#94a3b8']
};

document.addEventListener('DOMContentLoaded', () => {
  initAnalysisEvents();
});

function initAnalysisEvents() {
  const selectTarget = document.getElementById('selectTargetAttr');
  const selectSecondary = document.getElementById('selectSecondaryAttr');
  const selectTheme = document.getElementById('selectChartTheme');
  const btnRefresh = document.getElementById('btnRefreshAnalysis');
  const btnDownload1 = document.getElementById('btnDownloadChart1');
  const btnDownload2 = document.getElementById('btnDownloadChart2');
  const btnDownloadCustom = document.getElementById('btnDownloadCustomChart');
  const btnGenerateCustom = document.getElementById('btnGenerateCustomPlot');

  if (selectTarget) {
    selectTarget.addEventListener('change', (e) => {
      window.AppState.targetAttribute = e.target.value;
      window.renderAnalysis();
    });
  }

  if (selectSecondary) {
    selectSecondary.addEventListener('change', () => {
      renderRelationshipChart();
    });
  }

  if (selectTheme) {
    selectTheme.addEventListener('change', (e) => {
      window.AppState.chartTheme = e.target.value;
      window.renderAnalysis();
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      window.renderAnalysis();
      showToast('Visual Analysis recalculated with fresh statistical models', 'info');
    });
  }

  if (btnDownload1) {
    btnDownload1.addEventListener('click', () => downloadCanvasImage('chartDistribution', 'distribution_chart.png'));
  }
  if (btnDownload2) {
    btnDownload2.addEventListener('click', () => downloadCanvasImage('chartRelationship', 'relationship_chart.png'));
  }
  if (btnDownloadCustom) {
    btnDownloadCustom.addEventListener('click', () => downloadCanvasImage('chartCustomStudio', 'custom_generated_plot.png'));
  }

  if (btnGenerateCustom) {
    btnGenerateCustom.addEventListener('click', () => generateCustomPlot());
  }
}

/**
 * Main Analysis Entry Point
 */
window.renderAnalysis = function () {
  const data = window.AppState.isCleaned ? window.AppState.cleanData : window.AppState.rawData;
  if (!data || data.length === 0) return;

  populateAnalysisSelectors();
  populateCustomStudioSelectors();

  renderDistributionChart();
  renderRelationshipChart();
  renderCompositionChart();
  renderCorrelationMatrix();
  renderStatisticalSummaryTable();
};

/**
 * Populate Target and Secondary Attribute Select Dropdowns
 */
function populateAnalysisSelectors() {
  const selectTarget = document.getElementById('selectTargetAttr');
  const selectSecondary = document.getElementById('selectSecondaryAttr');
  const selectedAttrs = window.AppState.selectedAttributes;
  const colInfo = window.AppState.columnInfo;

  if (!selectTarget || !selectSecondary || selectedAttrs.length === 0) return;

  // Target attribute options
  const targetCurrent = window.AppState.targetAttribute || selectedAttrs[0];
  selectTarget.innerHTML = selectedAttrs.map(col => {
    const isSelected = col === targetCurrent;
    const type = colInfo[col]?.type || 'categorical';
    return `<option value="${escapeHTML(col)}" ${isSelected ? 'selected' : ''}>${escapeHTML(col)} (${type})</option>`;
  }).join('');

  // Secondary attribute options (excluding target if possible)
  const secondaryAttrs = selectedAttrs.filter(c => c !== targetCurrent);
  const secondaryCurrent = secondaryAttrs[0] || selectedAttrs[0];

  selectSecondary.innerHTML = selectedAttrs.map(col => {
    const isSelected = col === secondaryCurrent;
    const type = colInfo[col]?.type || 'categorical';
    return `<option value="${escapeHTML(col)}" ${isSelected ? 'selected' : ''}>${escapeHTML(col)} (${type})</option>`;
  }).join('');
}

/**
 * Populate Custom Studio X and Y Attribute Dropdowns
 */
function populateCustomStudioSelectors() {
  const selectX = document.getElementById('customXAttrSelect');
  const selectY = document.getElementById('customYAttrSelect');
  const columns = window.AppState.columnNames;
  const colInfo = window.AppState.columnInfo;

  if (!selectX || !selectY || !columns || columns.length === 0) return;

  const currentX = selectX.value || columns[0];
  const currentY = selectY.value || (columns.find(c => colInfo[c]?.type === 'numeric') || '_count_');

  // Populate X
  selectX.innerHTML = columns.map(c => {
    const type = colInfo[c]?.type || 'categorical';
    return `<option value="${escapeHTML(c)}" ${c === currentX ? 'selected' : ''}>${escapeHTML(c)} (${type})</option>`;
  }).join('');

  // Populate Y (numeric metrics + row count option)
  const numericCols = columns.filter(c => colInfo[c]?.type === 'numeric');
  let yOptions = `<option value="_count_" ${currentY === '_count_' ? 'selected' : ''}>[Record Count / Frequency (N)]</option>`;
  yOptions += numericCols.map(c => {
    return `<option value="${escapeHTML(c)}" ${c === currentY ? 'selected' : ''}>${escapeHTML(c)} (numeric)</option>`;
  }).join('');

  selectY.innerHTML = yOptions;
}

/**
 * Chart 1: Target Attribute Distribution
 */
function renderDistributionChart() {
  const canvas = document.getElementById('chartDistribution');
  if (!canvas) return;

  const data = window.AppState.isCleaned ? window.AppState.cleanData : window.AppState.rawData;
  const target = window.AppState.targetAttribute || window.AppState.selectedAttributes[0];
  const info = window.AppState.columnInfo[target];
  const palette = THEME_PALETTES[window.AppState.chartTheme] || THEME_PALETTES.neon;

  if (!info) return;

  setText('chart1Title', `Distribution of "${target}"`);
  setText('chart1Subtitle', `${info.type.toUpperCase()} • ${data.length.toLocaleString()} records`);

  if (chartDistributionInstance) {
    chartDistributionInstance.destroy();
  }

  const ctx = canvas.getContext('2d');

  if (info.type === 'numeric') {
    // Numeric Binned Histogram
    const values = data.map(r => Number(r[target])).filter(n => !isNaN(n));
    const binsCount = Math.min(10, Math.max(5, Math.floor(Math.sqrt(values.length))));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binWidth = (max - min) / binsCount || 1;

    const binCounts = new Array(binsCount).fill(0);
    const binLabels = [];

    for (let i = 0; i < binsCount; i++) {
      const bMin = min + i * binWidth;
      const bMax = bMin + binWidth;
      binLabels.push(`${bMin.toFixed(1)} - ${bMax.toFixed(1)}`);
    }

    values.forEach(v => {
      let idx = Math.floor((v - min) / binWidth);
      if (idx >= binsCount) idx = binsCount - 1;
      if (idx < 0) idx = 0;
      binCounts[idx]++;
    });

    const maxBinIndex = binCounts.indexOf(Math.max(...binCounts));
    const dominantRange = binLabels[maxBinIndex];
    const dominantPct = ((Math.max(...binCounts) / values.length) * 100).toFixed(1);

    chartDistributionInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: binLabels,
        datasets: [{
          label: `Frequency Count (${target})`,
          data: binCounts,
          backgroundColor: palette[0] + 'cc',
          borderColor: palette[0],
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: getCommonChartOptions('Value Range Interval', 'Record Count')
    });

    // Populate Meta Explainer Box
    renderChartMetaBox('chart1MetaBox', {
      desc: `Histogram dividing numerical variable "${target}" into ${binsCount} equal-width intervals, plotting record frequencies on the vertical axis.`,
      why: `Histograms are the standard statistical method for univariate continuous data to evaluate central tendency, skewness, kurtosis, and modal peaks.`,
      alt: `<strong>Box & Whisker Plot</strong> (shows median and quartiles), <strong>Violin Plot</strong> (displays kernel density shape), or <strong>KDE Density Curve</strong> (smooth continuous probability curve).`,
      insights: `Dominant concentration is in interval <strong>${dominantRange}</strong> (${dominantPct}% of samples). Range spans [${min} to ${max}].<br><strong>Actionable Implementation:</strong> Calibrate operational baselines and target KPI thresholds around this dominant range.`
    });

  } else {
    // Categorical Frequency Bar
    const freq = {};
    data.forEach(r => {
      const val = String(r[target] ?? 'N/A').trim();
      freq[val] = (freq[val] || 0) + 1;
    });

    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const labels = sorted.map(s => s[0]);
    const counts = sorted.map(s => s[1]);
    const topCat = labels[0];
    const topCount = counts[0];
    const topPct = ((topCount / data.length) * 100).toFixed(1);

    chartDistributionInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: `Count by ${target}`,
          data: counts,
          backgroundColor: palette[0] + 'cc',
          borderColor: palette[0],
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: getCommonChartOptions('Category', 'Frequency Count')
    });

    // Populate Meta Explainer Box
    renderChartMetaBox('chart1MetaBox', {
      desc: `Discrete bar chart displaying the frequency counts for the top ${labels.length} categories of categorical attribute "${target}".`,
      why: `Bar charts provide precise comparative visual lengths, enabling immediate ranking of nominal/ordinal categories without perceptual distortion.`,
      alt: `<strong>Doughnut / Pie Chart</strong> (shows part-to-whole proportions for ≤ 5 classes), <strong>Treemap</strong> (hierarchical proportion blocks), or <strong>Waffle Chart</strong>.`,
      insights: `Top category is <strong>"${topCat}"</strong> comprising <strong>${topCount.toLocaleString()} records (${topPct}%)</strong>.<br><strong>Actionable Implementation:</strong> Prioritize resource allocation, customer segmentation, or product inventory around "${topCat}" while evaluating growth in secondary tiers.`
    });
  }
}

/**
 * Chart 2: Target vs Secondary Attribute (Scatter regression, Box plot, or Cross-tab)
 */
function renderRelationshipChart() {
  const canvas = document.getElementById('chartRelationship');
  if (!canvas) return;

  const data = window.AppState.isCleaned ? window.AppState.cleanData : window.AppState.rawData;
  const target = window.AppState.targetAttribute || window.AppState.selectedAttributes[0];
  const secondary = document.getElementById('selectSecondaryAttr')?.value || window.AppState.selectedAttributes[1] || target;

  const targetInfo = window.AppState.columnInfo[target];
  const secondaryInfo = window.AppState.columnInfo[secondary];
  const palette = THEME_PALETTES[window.AppState.chartTheme] || THEME_PALETTES.neon;

  if (!targetInfo || !secondaryInfo) return;

  setText('chart2Title', `Relationship: "${secondary}" vs "${target}"`);
  setText('chart2Subtitle', `${secondaryInfo.type.toUpperCase()} (X) vs ${targetInfo.type.toUpperCase()} (Y)`);

  if (chartRelationshipInstance) {
    chartRelationshipInstance.destroy();
  }

  const ctx = canvas.getContext('2d');

  // Case 1: Numeric vs Numeric (Scatter Plot with Linear Regression Trendline)
  if (targetInfo.type === 'numeric' && secondaryInfo.type === 'numeric') {
    const points = data.map(r => ({
      x: Number(r[secondary]),
      y: Number(r[target])
    })).filter(p => !isNaN(p.x) && !isNaN(p.y));

    // Linear Regression (y = mx + b)
    const n = points.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    points.forEach(p => {
      sumX += p.x;
      sumY += p.y;
      sumXY += p.x * p.y;
      sumXX += p.x * p.x;
    });

    const slope = (n * sumXY - sumX * sumY) / Math.max(1, (n * sumXX - sumX * sumX));
    const intercept = (sumY - slope * sumX) / n;

    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));

    const trendLinePoints = [
      { x: minX, y: Number((slope * minX + intercept).toFixed(2)) },
      { x: maxX, y: Number((slope * maxX + intercept).toFixed(2)) }
    ];

    const r = computePearsonCorrelation(data, secondary, target);
    const direction = slope > 0 ? 'positive' : 'negative';
    const strength = Math.abs(r) > 0.6 ? 'strong' : (Math.abs(r) > 0.3 ? 'moderate' : 'weak');

    chartRelationshipInstance = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Data Points',
            data: points,
            backgroundColor: palette[1] + '99',
            borderColor: palette[1],
            pointRadius: 4.5,
            pointHoverRadius: 7
          },
          {
            type: 'line',
            label: `Regression Trendline (y = ${slope.toFixed(2)}x + ${intercept.toFixed(1)})`,
            data: trendLinePoints,
            borderColor: palette[2],
            borderWidth: 2.5,
            borderDash: [5, 5],
            fill: false,
            pointRadius: 0
          }
        ]
      },
      options: getCommonChartOptions(secondary, target)
    });

    renderChartMetaBox('chart2MetaBox', {
      desc: `Bivariate scatter plot displaying individual observations as coordinates (X: "${secondary}", Y: "${target}") overlaid with an Ordinary Least Squares (OLS) linear trendline.`,
      why: `Scatter plots reveal correlation direction, non-linear curvature, homoscedasticity, clustering, and bivariate outliers simultaneously.`,
      alt: `<strong>Hexbin / 2D Density Plot</strong> (optimal for N > 5,000 to solve overplotting), <strong>Contour Plot</strong>, or <strong>Joint Distribution Plot</strong> with marginal histograms.`,
      insights: `Observed a <strong>${strength} ${direction} correlation (r = ${r.toFixed(2)})</strong> with slope $\\beta = ${slope.toFixed(2)}$.<br><strong>Actionable Implementation:</strong> For every 1-unit increase in ${secondary}, ${target} changes by approximately ${slope.toFixed(2)} units. Use this regression formula for predictive forecasting.`
    });

  } else {
    // Case 2: Numeric Target vs Categorical Secondary OR Categorical Target vs Numeric Secondary
    const catCol = targetInfo.type === 'categorical' ? target : secondary;
    const numCol = targetInfo.type === 'numeric' ? target : secondary;

    const groupSums = {};
    const groupCounts = {};

    data.forEach(r => {
      const cat = String(r[catCol] ?? 'N/A').trim();
      const num = Number(r[numCol]);
      if (!isNaN(num)) {
        groupSums[cat] = (groupSums[cat] || 0) + num;
        groupCounts[cat] = (groupCounts[cat] || 0) + 1;
      }
    });

    const sortedCats = Object.keys(groupSums).sort((a, b) => (groupSums[b] / groupCounts[b]) - (groupSums[a] / groupCounts[a])).slice(0, 10);
    const avgValues = sortedCats.map(cat => Number((groupSums[cat] / Math.max(1, groupCounts[cat])).toFixed(2)));

    const leaderCat = sortedCats[0];
    const leaderVal = avgValues[0];
    const laggardCat = sortedCats[sortedCats.length - 1];
    const laggardVal = avgValues[avgValues.length - 1];

    chartRelationshipInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sortedCats,
        datasets: [{
          label: `Average ${numCol} by ${catCol}`,
          data: avgValues,
          backgroundColor: palette[1] + 'cc',
          borderColor: palette[1],
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: getCommonChartOptions(catCol, `Mean ${numCol}`)
    });

    renderChartMetaBox('chart2MetaBox', {
      desc: `Aggregated comparative bar chart plotting the mean average value of numerical metric "${numCol}" across discrete groups of "${catCol}".`,
      why: `Bar plots comparing group means reveal performance disparities and categorical segment variance cleanly.`,
      alt: `<strong>Box Plot Series</strong> (shows median, IQR, and spread per category), <strong>Violin Plot</strong> (density distribution per category), or <strong>Radar Profile</strong>.`,
      insights: `Highest average ${numCol} is driven by <strong>"${leaderCat}" (${leaderVal})</strong>, outperforming <strong>"${laggardCat}" (${laggardVal})</strong> by ${leaderVal > laggardVal && laggardVal > 0 ? `${(((leaderVal - laggardVal) / laggardVal) * 100).toFixed(1)}%` : 'a significant margin'}.<br><strong>Actionable Implementation:</strong> Benchmark processes against "${leaderCat}" to uplift underperforming segments.`
    });
  }
}

/**
 * Chart 3: Categorical Composition Donut Chart
 */
function renderCompositionChart() {
  const canvas = document.getElementById('chartComposition');
  if (!canvas) return;

  const data = window.AppState.isCleaned ? window.AppState.cleanData : window.AppState.rawData;
  const columns = window.AppState.selectedAttributes;
  const colInfo = window.AppState.columnInfo;
  const palette = THEME_PALETTES[window.AppState.chartTheme] || THEME_PALETTES.neon;

  // Pick first categorical attribute, or target
  const catCol = columns.find(c => colInfo[c]?.type === 'categorical') || window.AppState.targetAttribute || columns[0];
  if (!catCol) return;

  setText('chart3Title', `Proportions: "${catCol}"`);
  setText('chart3Subtitle', `Top category market breakdown`);

  if (chartCompositionInstance) {
    chartCompositionInstance.destroy();
  }

  const freq = {};
  data.forEach(r => {
    const val = String(r[catCol] ?? 'N/A').trim();
    freq[val] = (freq[val] || 0) + 1;
  });

  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const labels = sorted.map(s => s[0]);
  const counts = sorted.map(s => s[1]);
  const totalInTop = counts.reduce((a, b) => a + b, 0);
  const top1Share = ((counts[0] / Math.max(1, data.length)) * 100).toFixed(1);

  const ctx = canvas.getContext('2d');
  chartCompositionInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: counts,
        backgroundColor: palette.slice(0, labels.length),
        borderColor: 'rgba(20, 27, 45, 0.8)',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#94a3b8',
            font: { family: 'Plus Jakarta Sans', size: 11 }
          }
        }
      }
    }
  });

  renderChartMetaBox('chart3MetaBox', {
    desc: `Radial doughnut chart visualizing the relative market share and proportion breakdown across the top ${labels.length} categories of "${catCol}".`,
    why: `Doughnut charts allow rapid perceptual scanning of part-to-whole relationships with an open center suitable for key ratio summaries.`,
    alt: `<strong>100% Stacked Bar Chart</strong> (superior for comparing proportions across multiple series), <strong>Treemap</strong> (better when > 7 categories exist), or <strong>Waffle Chart</strong>.`,
    insights: `Market share is concentrated with <strong>"${labels[0]}" representing ${top1Share}%</strong> of total records.<br><strong>Actionable Implementation:</strong> Focus retention strategies on top ${Math.min(2, labels.length)} segments while diversifying risk across minority categories.`
  });
}

/**
 * Chart 4: Pearson Correlation Matrix Heatmap
 */
function renderCorrelationMatrix() {
  const container = document.getElementById('correlationMatrixContainer');
  if (!container) return;

  const data = window.AppState.isCleaned ? window.AppState.cleanData : window.AppState.rawData;
  const selectedAttrs = window.AppState.selectedAttributes;
  const colInfo = window.AppState.columnInfo;

  const numericCols = selectedAttrs.filter(c => colInfo[c]?.type === 'numeric');

  if (numericCols.length < 2) {
    container.innerHTML = `<p style="padding: 24px; color: var(--text-dim); text-align: center;">At least 2 numeric attributes are required to construct a correlation matrix.</p>`;
    return;
  }

  // Compute Correlation Matrix
  const matrix = {};
  const strongPairs = [];

  numericCols.forEach(c1 => {
    matrix[c1] = {};
    numericCols.forEach(c2 => {
      const r = computePearsonCorrelation(data, c1, c2);
      matrix[c1][c2] = r;
      if (c1 !== c2 && numericCols.indexOf(c1) < numericCols.indexOf(c2) && Math.abs(r) >= 0.5) {
        strongPairs.push({ c1, c2, r: r.toFixed(2) });
      }
    });
  });

  // Render Heatmap Grid HTML
  let gridHtml = `<div style="display: grid; grid-template-columns: 140px repeat(${numericCols.length}, 1fr); gap: 4px; min-width: 500px;">`;

  // Header Row
  gridHtml += `<div></div>` + numericCols.map(c => `
    <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 4px;" title="${escapeHTML(c)}">
      ${escapeHTML(c)}
    </div>
  `).join('');

  // Matrix Rows
  numericCols.forEach(c1 => {
    gridHtml += `<div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; padding: 4px;" title="${escapeHTML(c1)}">${escapeHTML(c1)}</div>`;
    numericCols.forEach(c2 => {
      const r = matrix[c1][c2];
      const bg = getCorrelationColor(r);
      gridHtml += `
        <div class="corr-cell" style="background: ${bg};" title="${c1} vs ${c2}: r = ${r.toFixed(3)}">
          ${r.toFixed(2)}
        </div>
      `;
    });
  });

  gridHtml += `</div>`;
  container.innerHTML = gridHtml;

  let correlationInsightText = 'No extreme linear collinearity (r ≥ 0.5) detected between numeric features.';
  if (strongPairs.length > 0) {
    correlationInsightText = `Strongest linear relationships: ${strongPairs.map(p => `<strong>${p.c1} & ${p.c2} (r = ${p.r})</strong>`).join(', ')}.`;
  }

  renderChartMetaBox('chart4MetaBox', {
    desc: `Symmetrical Pearson Correlation Matrix Heatmap computing bivariate linear coefficient $r \\in [-1.00, +1.00]$ across all ${numericCols.length} numerical features.`,
    why: `Heatmaps condense multi-attribute pairwise linear associations into an instantly interpretable color-coded matrix, pinpointing collinearity and key drivers.`,
    alt: `<strong>Scatter Plot Matrix (SPLOM / Pairplot)</strong> (shows individual dispersion clouds per pair), <strong>Network Correlation Graph</strong>, or <strong>Hierarchical Dendrogram</strong>.`,
    insights: `${correlationInsightText}<br><strong>Actionable Implementation:</strong> Highly collinear variables ($|r| > 0.8$) can be consolidated to prevent multicollinearity in linear models, while moderate correlations identify cross-selling or driver dynamics.`
  });
}

/**
 * Custom Interactive Plot Studio: Generate User-Defined Visualizations
 */
function generateCustomPlot() {
  const canvas = document.getElementById('chartCustomStudio');
  const outputBox = document.getElementById('customChartOutputBox');
  if (!canvas || !outputBox) return;

  const data = window.AppState.isCleaned ? window.AppState.cleanData : window.AppState.rawData;
  if (!data || data.length === 0) {
    showToast('No dataset available to generate custom visualization.', 'error');
    return;
  }

  const chartType = document.getElementById('customChartTypeSelect')?.value || 'bar';
  const xAttr = document.getElementById('customXAttrSelect')?.value || window.AppState.columnNames[0];
  const yAttr = document.getElementById('customYAttrSelect')?.value || '_count_';
  const aggOp = document.getElementById('customAggSelect')?.value || 'mean';
  const paletteKey = document.getElementById('customPaletteSelect')?.value || 'neon';
  const palette = THEME_PALETTES[paletteKey] || THEME_PALETTES.neon;

  const colInfo = window.AppState.columnInfo;
  const isYCount = yAttr === '_count_';

  setText('customChartTitle', `Custom ${chartType.toUpperCase()} Plot: ${xAttr} vs ${isYCount ? 'Record Count' : `${aggOp.toUpperCase()}(${yAttr})`}`);
  setText('customChartSubtitle', `Generated on ${data.length.toLocaleString()} records • Palette: ${paletteKey}`);

  if (chartCustomStudioInstance) {
    chartCustomStudioInstance.destroy();
  }

  const ctx = canvas.getContext('2d');

  // Handle Scatter Plot Case
  if (chartType === 'scatter') {
    if (isYCount) {
      showToast('Scatter plots require a numerical Y metric instead of row count.', 'info');
    }
    const points = data.map(r => ({
      x: Number(r[xAttr]),
      y: Number(r[yAttr])
    })).filter(p => !isNaN(p.x) && !isNaN(p.y));

    chartCustomStudioInstance = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: `${xAttr} vs ${yAttr}`,
          data: points,
          backgroundColor: palette[0] + 'aa',
          borderColor: palette[0],
          pointRadius: 5
        }]
      },
      options: getCommonChartOptions(xAttr, yAttr)
    });

    renderCustomMetaBox({
      type: 'Scatter Plot',
      x: xAttr,
      y: yAttr,
      agg: 'Raw Points',
      dataPoints: points.length,
      insights: `Scatter plot mapping <strong>${points.length.toLocaleString()} bivariate coordinates</strong>. Reveals dispersion patterns and potential non-linear clusters.`
    });

  } else {
    // Group-by Aggregations (Bar, Line, Area, Doughnut, Radar, Polar)
    const groups = {};
    data.forEach(r => {
      const key = String(r[xAttr] ?? 'N/A').trim();
      if (!groups[key]) groups[key] = [];
      const yVal = isYCount ? 1 : Number(r[yAttr]);
      if (!isNaN(yVal)) groups[key].push(yVal);
    });

    const aggregated = Object.entries(groups).map(([cat, vals]) => {
      let metric = 0;
      if (aggOp === 'count' || isYCount) {
        metric = vals.length;
      } else if (aggOp === 'sum') {
        metric = vals.reduce((a, b) => a + b, 0);
      } else if (aggOp === 'mean') {
        metric = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      } else if (aggOp === 'median') {
        const sorted = [...vals].sort((a, b) => a - b);
        metric = sorted[Math.floor(sorted.length / 2)] || 0;
      } else if (aggOp === 'max') {
        metric = Math.max(...vals);
      } else if (aggOp === 'min') {
        metric = Math.min(...vals);
      }
      return { category: cat, value: Number(metric.toFixed(2)) };
    });

    // Sort top 12 categories
    aggregated.sort((a, b) => b.value - a.value);
    const topCats = aggregated.slice(0, 12);
    const labels = topCats.map(c => c.category);
    const values = topCats.map(c => c.value);

    // Build ChartJS config
    let chartJSType = chartType === 'horizontalBar' ? 'bar' : (chartType === 'area' ? 'line' : chartType);
    let chartOptions = getCommonChartOptions(xAttr, isYCount ? 'Count' : `${aggOp.toUpperCase()} of ${yAttr}`);

    if (chartType === 'horizontalBar') {
      chartOptions.indexAxis = 'y';
    } else if (['doughnut', 'radar', 'polarArea'].includes(chartType)) {
      chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 11 } }
          }
        }
      };
    }

    const datasetConfig = {
      label: isYCount ? `Count by ${xAttr}` : `${aggOp.toUpperCase()}(${yAttr}) by ${xAttr}`,
      data: values,
      backgroundColor: ['doughnut', 'polarArea'].includes(chartType) ? palette.slice(0, labels.length) : palette[0] + 'cc',
      borderColor: ['doughnut', 'polarArea'].includes(chartType) ? '#141b2d' : palette[0],
      borderWidth: 1.5,
      borderRadius: chartType.includes('bar') ? 6 : 0,
      fill: chartType === 'area' ? 'origin' : false
    };

    chartCustomStudioInstance = new Chart(ctx, {
      type: chartJSType,
      data: {
        labels: labels,
        datasets: [datasetConfig]
      },
      options: chartOptions
    });

    const leader = topCats[0];
    const totalVal = values.reduce((a, b) => a + b, 0);
    const leaderShare = totalVal > 0 ? ((leader.value / totalVal) * 100).toFixed(1) : 0;

    renderCustomMetaBox({
      type: chartType,
      x: xAttr,
      y: isYCount ? 'Record Count' : yAttr,
      agg: aggOp,
      dataPoints: aggregated.length,
      leaderCat: leader.category,
      leaderVal: leader.value,
      leaderShare: leaderShare,
      insights: `Top contributing category is <strong>"${leader.category}"</strong> with an aggregated score of <strong>${leader.value.toLocaleString()} (${leaderShare}% of top total)</strong>.`
    });
  }

  outputBox.classList.add('visible');
  outputBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  showToast('Custom plot generated successfully!', 'success');

  if (window.lucide) window.lucide.createIcons();
}

/**
 * Render Meta Explainer Box for Core Charts
 */
function renderChartMetaBox(containerId, meta) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="chart-meta-grid">
      <div class="chart-meta-section desc">
        <h6><i data-lucide="info"></i> Plot Description</h6>
        <p>${meta.desc}</p>
      </div>
      <div class="chart-meta-section why">
        <h6><i data-lucide="sparkles"></i> Why This Plot Was Selected</h6>
        <p>${meta.why}</p>
      </div>
      <div class="chart-meta-section alt">
        <h6><i data-lucide="shuffle"></i> Alternative Visualizations</h6>
        <p>${meta.alt}</p>
      </div>
      <div class="chart-meta-section insights">
        <h6><i data-lucide="lightbulb"></i> Actionable Business Takeaway</h6>
        <div class="chart-meta-insights">
          ${meta.insights}
        </div>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

/**
 * Render Custom Plot Meta Explainer
 */
function renderCustomMetaBox(meta) {
  const container = document.getElementById('customChartMetaBox');
  if (!container) return;

  container.innerHTML = `
    <div class="chart-meta-grid">
      <div class="chart-meta-section desc">
        <h6><i data-lucide="info"></i> Custom Plot Architecture</h6>
        <p>Custom <strong>${meta.type.toUpperCase()}</strong> visualization mapping <strong>X: "${meta.x}"</strong> against <strong>Y: "${meta.y}"</strong> using <strong>"${meta.agg.toUpperCase()}"</strong> aggregation across ${meta.dataPoints} categorical segments.</p>
      </div>
      <div class="chart-meta-section why">
        <h6><i data-lucide="sparkles"></i> Configuration Rationale</h6>
        <p>This layout effectively highlights comparative categorical magnitude and distribution ranking for operational decision-making.</p>
      </div>
      <div class="chart-meta-section alt">
        <h6><i data-lucide="shuffle"></i> Suitable Alternative Formats</h6>
        <p>For this combination, you can also explore <strong>Horizontal Ranking Bars</strong>, <strong>Radar Fingerprint Profiles</strong>, or <strong>100% Normalized Area Curves</strong>.</p>
      </div>
      <div class="chart-meta-section insights">
        <h6><i data-lucide="lightbulb"></i> Automated Analytical Takeaway & Strategy</h6>
        <div class="chart-meta-insights">
          ${meta.insights}<br>
          <strong>Implementation Roadmap:</strong> Focus strategic campaigns, KPI quotas, or operational budgets on top performing tier while investigating secondary bottlenecks.
        </div>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

/**
 * Render Complete Statistical Metrics Summary Table
 */
function renderStatisticalSummaryTable() {
  const tbody = document.getElementById('statsSummaryTableBody');
  if (!tbody) return;

  const data = window.AppState.isCleaned ? window.AppState.cleanData : window.AppState.rawData;
  const selectedAttrs = window.AppState.selectedAttributes;
  const colInfo = window.AppState.columnInfo;

  if (!selectedAttrs || selectedAttrs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="13" style="text-align: center; padding: 20px;">No attributes selected.</td></tr>`;
    return;
  }

  tbody.innerHTML = selectedAttrs.map(col => {
    const info = colInfo[col];
    if (!info) return '';

    if (info.type === 'numeric') {
      const values = data.map(r => Number(r[col])).filter(n => !isNaN(n));
      const stats = calculateComprehensiveStats(values);

      return `
        <tr>
          <td><strong style="color: var(--text-main);">${escapeHTML(col)}</strong></td>
          <td><span class="type-badge numeric">NUMERIC</span></td>
          <td>${values.length}</td>
          <td>${stats.mean}</td>
          <td>${stats.median}</td>
          <td>${stats.stdDev}</td>
          <td>${stats.min}</td>
          <td>${stats.q1}</td>
          <td>${stats.q3}</td>
          <td>${stats.max}</td>
          <td>${stats.iqr}</td>
          <td style="color: ${Math.abs(stats.skewness) > 1 ? 'var(--accent-amber)' : 'inherit'};">${stats.skewness}</td>
          <td>${stats.kurtosis}</td>
        </tr>
      `;
    } else {
      return `
        <tr>
          <td><strong style="color: var(--text-main);">${escapeHTML(col)}</strong></td>
          <td><span class="type-badge ${info.type}">${info.type.toUpperCase()}</span></td>
          <td>${data.length}</td>
          <td colspan="10" style="color: var(--text-dim); font-size: 0.78rem;">
            Categorical Feature • ${info.uniqueCount} distinct values • Top: "${escapeHTML(info.stats?.topCategory || 'N/A')}" (${info.stats?.topPct || 0}%)
          </td>
        </tr>
      `;
    }
  }).join('');
}

/**
 * Calculate Comprehensive Descriptive Statistics
 */
function calculateComprehensiveStats(values) {
  if (!values || values.length === 0) {
    return { mean: 0, median: 0, stdDev: 0, min: 0, q1: 0, q3: 0, max: 0, iqr: 0, skewness: 0, kurtosis: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / n;

  // Median
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

  // Percentiles
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const min = sorted[0];
  const max = sorted[n - 1];
  const iqr = Number((q3 - q1).toFixed(2));

  // Variance & Standard Deviation
  const variance = sorted.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / Math.max(1, n - 1);
  const stdDev = Math.sqrt(variance);

  // Skewness
  let m3 = 0, m4 = 0;
  sorted.forEach(v => {
    m3 += Math.pow(v - mean, 3);
    m4 += Math.pow(v - mean, 4);
  });
  const skewness = stdDev !== 0 ? (m3 / n) / Math.pow(stdDev, 3) : 0;
  const kurtosis = stdDev !== 0 ? ((m4 / n) / Math.pow(stdDev, 4)) - 3 : 0;

  return {
    mean: Number(mean.toFixed(2)),
    median: Number(median.toFixed(2)),
    stdDev: Number(stdDev.toFixed(2)),
    min: Number(min.toFixed(2)),
    q1: Number(q1.toFixed(2)),
    q3: Number(q3.toFixed(2)),
    max: Number(max.toFixed(2)),
    iqr: iqr,
    skewness: Number(skewness.toFixed(2)),
    kurtosis: Number(kurtosis.toFixed(2))
  };
}

/**
 * Compute Pearson Correlation Coefficient r between two columns
 */
function computePearsonCorrelation(data, colX, colY) {
  const pairs = data.map(r => ({
    x: Number(r[colX]),
    y: Number(r[colY])
  })).filter(p => !isNaN(p.x) && !isNaN(p.y));

  if (pairs.length < 2) return 0;

  const n = pairs.length;
  const sumX = pairs.reduce((a, b) => a + b.x, 0);
  const sumY = pairs.reduce((a, b) => a + b.y, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0, denX = 0, denY = 0;
  pairs.forEach(p => {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  });

  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

function getCorrelationColor(r) {
  if (r >= 0.7) return 'rgba(16, 185, 129, 0.85)';
  if (r >= 0.4) return 'rgba(16, 185, 129, 0.5)';
  if (r >= 0.1) return 'rgba(6, 182, 212, 0.4)';
  if (r >= -0.1) return 'rgba(100, 116, 139, 0.3)';
  if (r >= -0.4) return 'rgba(245, 158, 11, 0.4)';
  if (r >= -0.7) return 'rgba(244, 63, 94, 0.5)';
  return 'rgba(244, 63, 94, 0.85)';
}

function getCommonChartOptions(xTitle, yTitle) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#94a3b8',
          font: { family: 'Plus Jakarta Sans', size: 11 }
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 10 } },
        title: { display: true, text: xTitle, color: '#94a3b8', font: { size: 11, weight: 'bold' } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 10 } },
        title: { display: true, text: yTitle, color: '#94a3b8', font: { size: 11, weight: 'bold' } }
      }
    }
  };
}

function downloadCanvasImage(canvasId, fileName) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const imageURI = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = imageURI;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast(`Downloaded ${fileName}`, 'success');
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}