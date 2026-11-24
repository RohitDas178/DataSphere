/**
 * ============================================================================
 * DATASPHERE ANALYTICS - MAIN APPLICATION CONTROLLER (app.js)
 * Global State, Navigation Routing, Theme Manager & Toast System
 * ============================================================================
 */

// Preprocessing State Helper
window.createDefaultPrepState = function () {
  return {
    currentStep: 1,
    maxUnlockedStep: 1,
    stepDecisions: {
      1: { status: 'applied', label: 'Diagnostics Scanned', detail: 'Evaluated data quality across 4 pillars' },
      2: { status: 'pending', label: 'Pending Choice', detail: 'Not yet configured' },
      3: { status: 'pending', label: 'Pending Choice', detail: 'Not yet configured' },
      4: { status: 'pending', label: 'Pending Choice', detail: 'Not yet configured' },
      5: { status: 'pending', label: 'Pending Choice', detail: 'Not yet configured' },
      6: { status: 'pending', label: 'Pending Review', detail: 'Pipeline not yet finalized' }
    },
    config: {
      deduplication: { enabled: true, strategy: 'first', skipped: false },
      missingValues: { enabled: true, strategy: 'smart', skipped: false },
      outliers: { enabled: true, strategy: 'winsorize', skipped: false },
      textSanitize: { enabled: true, strategy: 'trim_case', sanitizeBooleans: true, skipped: false }
    }
  };
};

window.DataSphereUtilities = {
  canonicalString(value) {
    if (Array.isArray(value)) return `[${value.map(item => this.canonicalString(item)).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${this.canonicalString(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  },

  async sha256(text) {
    if (!window.crypto?.subtle) return null;
    const bytes = new TextEncoder().encode(text);
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
  },

  deterministicId(fileName, rows) {
    let hash = 2166136261;
    const text = `${fileName}\n${this.canonicalString(rows || [])}`;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `ds_${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }
};

// Global Application State
window.AppState = {
  // Multi-Dataset Catalog
  datasets: [],
  activeDatasetId: null,

  rawData: [],
  cleanData: [],
  fileName: '',
  fileSize: 0,
  fileType: '',
  datasetLoaded: false,
  isCleaned: false,

  // Attribute profiling
  columnInfo: {},
  columnNames: [],
  selectedAttributes: [],
  targetAttribute: null,

  // Preprocessing audit and anomalies
  anomalies: {
    missingCount: 0,
    duplicateCount: 0,
    outlierCount: 0,
    constantCols: []
  },
  cleaningLog: [],
  healthScore: 100,
  preprocessing: window.createDefaultPrepState(),

  // Active navigation
  currentTab: 'uploadTab',
  chartTheme: 'neon',

  // Current pagination states
  rawTablePage: 1,
  rawTablePageSize: 10,
  cleanTablePage: 1,
  cleanTablePageSize: 10
};

/**
 * Multi-Dataset Management: Add Dataset to Workspace
 */
window.addDatasetToWorkspace = function (datasetObj, setActive = true) {
  const dsId = window.DataSphereUtilities.deterministicId(
    datasetObj.fileName || 'dataset.csv',
    datasetObj.rawData || []
  );
  const newDataset = {
    id: dsId,
    fileName: datasetObj.fileName || 'dataset.csv',
    fileSize: datasetObj.fileSize || 0,
    fileType: datasetObj.fileType || 'CSV',
    rawData: datasetObj.rawData || [],
    cleanData: datasetObj.cleanData ? datasetObj.cleanData.map(r => ({ ...r })) : (datasetObj.rawData ? datasetObj.rawData.map(r => ({ ...r })) : []),
    columnInfo: datasetObj.columnInfo || {},
    columnNames: datasetObj.columnNames || (datasetObj.rawData && datasetObj.rawData[0] ? Object.keys(datasetObj.rawData[0]) : []),
    selectedAttributes: datasetObj.selectedAttributes || (datasetObj.rawData && datasetObj.rawData[0] ? Object.keys(datasetObj.rawData[0]) : []),
    targetAttribute: datasetObj.targetAttribute || null,
    anomalies: datasetObj.anomalies || { missingCount: 0, duplicateCount: 0, outlierCount: 0, constantCols: [] },
    cleaningLog: datasetObj.cleaningLog || [],
    healthScore: datasetObj.healthScore || 100,
    isCleaned: datasetObj.isCleaned || false,
    preprocessing: datasetObj.preprocessing || window.createDefaultPrepState()
  };


  window.AppState.datasets.push(newDataset);

  if (setActive || !window.AppState.activeDatasetId) {
    window.switchActiveDataset(dsId, false);
  } else {
    window.renderMultiDatasetRibbon();
    window.renderRelationalJoinStudio();
  }

  return newDataset;
};

/**
 * Multi-Dataset Management: Switch Active Dataset
 */
window.switchActiveDataset = function (datasetId, showNotification = true) {
  const ds = window.AppState.datasets.find(d => d.id === datasetId);
  if (!ds) return;

  // Persist current active dataset state back to its catalog slot
  if (window.AppState.activeDatasetId) {
    const prevDs = window.AppState.datasets.find(d => d.id === window.AppState.activeDatasetId);
    if (prevDs) {
      prevDs.rawData = window.AppState.rawData;
      prevDs.cleanData = window.AppState.cleanData;
      prevDs.columnInfo = window.AppState.columnInfo;
      prevDs.columnNames = window.AppState.columnNames;
      prevDs.selectedAttributes = window.AppState.selectedAttributes;
      prevDs.targetAttribute = window.AppState.targetAttribute;
      prevDs.anomalies = window.AppState.anomalies;
      prevDs.cleaningLog = window.AppState.cleaningLog;
      prevDs.healthScore = window.AppState.healthScore;
      prevDs.isCleaned = window.AppState.isCleaned;
      prevDs.preprocessing = window.AppState.preprocessing;
    }
  }

  // Set new active dataset
  window.AppState.activeDatasetId = ds.id;
  window.AppState.rawData = ds.rawData;
  window.AppState.cleanData = ds.cleanData;
  window.AppState.fileName = ds.fileName;
  window.AppState.fileSize = ds.fileSize;
  window.AppState.fileType = ds.fileType;
  window.AppState.datasetLoaded = ds.rawData && ds.rawData.length > 0;
  window.AppState.isCleaned = ds.isCleaned;
  window.AppState.columnInfo = ds.columnInfo;
  window.AppState.columnNames = ds.columnNames;
  window.AppState.selectedAttributes = ds.selectedAttributes;
  window.AppState.targetAttribute = ds.targetAttribute;
  window.AppState.anomalies = ds.anomalies;
  window.AppState.cleaningLog = ds.cleaningLog;
  window.AppState.healthScore = ds.healthScore;
  window.AppState.preprocessing = ds.preprocessing;

  // Update Global Status Badges
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  if (statusDot) statusDot.classList.add('active');
  if (statusText) statusText.textContent = `${ds.fileName} (${ds.rawData.length.toLocaleString()} rows)`;

  // Update Success Banner
  const banner = document.getElementById('fileSuccessBanner');
  const bannerName = document.getElementById('loadedFileName');
  const bannerMeta = document.getElementById('loadedFileMeta');
  if (banner && bannerName && bannerMeta) {
    banner.style.display = 'flex';
    bannerName.textContent = ds.fileName;
    const colCount = ds.columnNames.length;
    const sizeKB = (ds.fileSize / 1024).toFixed(1);
    bannerMeta.textContent = `${ds.rawData.length.toLocaleString()} rows • ${colCount} attributes • ${sizeKB} KB (${ds.fileType})`;
  }

  window.renderMultiDatasetRibbon();
  window.renderRelationalJoinStudio();

  // Profile columns and refresh current active tab views
  if (window.profileDataset) {
    window.profileDataset();
  }

  if (window.AppState.currentTab === 'exploreTab' && window.renderExplorer) {
    window.renderExplorer();
  } else if (window.AppState.currentTab === 'preprocessingTab' && window.initPreprocessingTab) {
    window.initPreprocessingTab();
  } else if (window.AppState.currentTab === 'analysisTab' && window.renderAnalysis) {
    window.renderAnalysis();
  } else if (window.AppState.currentTab === 'reportTab' && window.generateAIReport) {
    window.generateAIReport();
  }

  if (showNotification) {
    showToast(`Switched active dataset to "${ds.fileName}"`, 'info');
  }

  if (window.lucide) window.lucide.createIcons();
};

/**
 * Multi-Dataset Management: Remove Dataset from Workspace
 */
window.removeDatasetFromWorkspace = function (datasetId, e) {
  if (e) e.stopPropagation();

  if (window.AppState.datasets.length <= 1) {
    showToast('Cannot remove the only dataset in workspace.', 'info');
    return;
  }

  const dsToRemove = window.AppState.datasets.find(d => d.id === datasetId);
  window.AppState.datasets = window.AppState.datasets.filter(d => d.id !== datasetId);

  if (window.AppState.activeDatasetId === datasetId) {
    const nextDs = window.AppState.datasets[0];
    window.switchActiveDataset(nextDs.id, false);
  } else {
    window.renderMultiDatasetRibbon();
    window.renderRelationalJoinStudio();
  }

  showToast(`Removed "${dsToRemove?.fileName || 'dataset'}" from workspace`, 'info');
};

/**
 * Render Multi-Dataset Switcher Ribbon
 */
window.renderMultiDatasetRibbon = function () {
  const container = document.getElementById('multiDatasetRibbonContainer');
  if (!container) return;

  if (window.AppState.datasets.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';

  const pillsHtml = window.AppState.datasets.map(ds => {
    const isActive = ds.id === window.AppState.activeDatasetId;
    return `
      <div class="dataset-pill ${isActive ? 'active' : ''}" onclick="window.switchActiveDataset('${ds.id}')" title="Switch to ${escapeHTML(ds.fileName)}">
        <i data-lucide="database" style="width: 14px; height: 14px;"></i>
        <span>${escapeHTML(ds.fileName)}</span>
        <span class="dataset-pill-count">${ds.rawData.length.toLocaleString()} rows</span>
        ${window.AppState.datasets.length > 1 ? `
          <span class="dataset-pill-remove" onclick="window.removeDatasetFromWorkspace('${ds.id}', event)" title="Remove dataset">
            <i data-lucide="x" style="width: 12px; height: 12px;"></i>
          </span>
        ` : ''}
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="dataset-ribbon-label">
      <i data-lucide="layers" style="width: 15px; height: 15px; color: var(--secondary);"></i>
      <span>Datasets (${window.AppState.datasets.length})</span>
    </div>
    <div class="dataset-pills-wrap">
      ${pillsHtml}
      <button class="dataset-pill-add" onclick="document.getElementById('fileInput').click()" title="Add another dataset">
        <i data-lucide="plus" style="width: 14px; height: 14px;"></i>
        <span>+ Add Dataset</span>
      </button>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
};

/**
 * Render Cross-Dataset Relational Join & Merge Studio
 */
window.renderRelationalJoinStudio = function () {
  const studio = document.getElementById('relationalJoinStudio');
  if (!studio) return;

  if (window.AppState.datasets.length < 2) {
    studio.style.display = 'none';
    return;
  }

  studio.style.display = 'block';

  const selectA = document.getElementById('joinTableASelect');
  const selectB = document.getElementById('joinTableBSelect');
  const selectKeyA = document.getElementById('joinKeyASelect');
  const selectKeyB = document.getElementById('joinKeyBSelect');

  if (!selectA || !selectB) return;

  const datasets = window.AppState.datasets;

  // Populate Table A & Table B dropdowns
  const currentA = selectA.value || datasets[0].id;
  const currentB = selectB.value || (datasets[1] ? datasets[1].id : datasets[0].id);

  selectA.innerHTML = datasets.map(d => `<option value="${d.id}" ${d.id === currentA ? 'selected' : ''}>${escapeHTML(d.fileName)} (${d.rawData.length} rows)</option>`).join('');
  selectB.innerHTML = datasets.map(d => `<option value="${d.id}" ${d.id === currentB ? 'selected' : ''}>${escapeHTML(d.fileName)} (${d.rawData.length} rows)</option>`).join('');

  // Populate Keys for Table A and B
  const dsA = datasets.find(d => d.id === selectA.value) || datasets[0];
  const dsB = datasets.find(d => d.id === selectB.value) || datasets[1] || datasets[0];

  const colsA = dsA.columnNames || [];
  const colsB = dsB.columnNames || [];

  // Auto-detect common key names (e.g. id, customer_id, region, date, category)
  const commonKey = colsA.find(cA => colsB.some(cB => cB.toLowerCase() === cA.toLowerCase())) || colsA[0];

  if (selectKeyA) {
    selectKeyA.innerHTML = colsA.map(c => `<option value="${escapeHTML(c)}" ${c.toLowerCase() === (commonKey || '').toLowerCase() ? 'selected' : ''}>${escapeHTML(c)}</option>`).join('');
  }

  if (selectKeyB) {
    selectKeyB.innerHTML = colsB.map(c => `<option value="${escapeHTML(c)}" ${c.toLowerCase() === (commonKey || '').toLowerCase() ? 'selected' : ''}>${escapeHTML(c)}</option>`).join('');
  }

  updateJoinRationale();
};

function normalizeJoinKey(value) {
  return String(value ?? '').trim().toLowerCase();
}

function analyzeJoinKey(rows, key) {
  const counts = new Map();
  let missing = 0;
  rows.forEach(row => {
    const value = normalizeJoinKey(row[key]);
    if (!value) missing++;
    else counts.set(value, (counts.get(value) || 0) + 1);
  });
  return {
    counts,
    uniqueKeys: counts.size,
    duplicateKeys: [...counts.values()].filter(count => count > 1).length,
    duplicateRows: [...counts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0),
    missing
  };
}

function buildJoinPreview(dsA, dsB, keyA, keyB, joinType) {
  if (joinType === 'union') return [...dsA.rawData, ...dsB.rawData].slice(0, 5);

  const mapB = new Map();
  dsB.rawData.forEach(rowB => {
    const key = normalizeJoinKey(rowB[keyB]);
    if (key) {
      if (!mapB.has(key)) mapB.set(key, []);
      mapB.get(key).push(rowB);
    }
  });

  const output = [];
  const matchedKeysB = new Set();
  dsA.rawData.forEach(rowA => {
    if (output.length >= 5) return;
    const key = normalizeJoinKey(rowA[keyA]);
    const matches = mapB.get(key) || [];
    if (matches.length) {
      matchedKeysB.add(key);
      for (const rowB of matches) {
        const combined = { ...rowA };
        Object.keys(rowB).forEach(colB => {
          const finalCol = (colB !== keyB && combined[colB] !== undefined)
            ? `${colB}_${dsB.fileName.split('.')[0]}` : colB;
          combined[finalCol] = rowB[colB];
        });
        output.push(combined);
        if (output.length >= 5) break;
      }
    } else if (joinType === 'left' || joinType === 'full') {
      const combined = { ...rowA };
      dsB.columnNames.forEach(colB => { if (combined[colB] === undefined) combined[colB] = ''; });
      output.push(combined);
    }
  });

  if (joinType === 'full' && output.length < 5) {
    dsB.rawData.forEach(rowB => {
      if (output.length >= 5) return;
      const key = normalizeJoinKey(rowB[keyB]);
      if (!matchedKeysB.has(key)) {
        const combined = { ...rowB };
        dsA.columnNames.forEach(colA => { if (combined[colA] === undefined) combined[colA] = ''; });
        output.push(combined);
      }
    });
  }
  return output;
}

function executeJoinRows(dsA, dsB, keyA, keyB, joinType) {
  if (joinType === 'union') return [...dsA.rawData, ...dsB.rawData];

  const mapB = new Map();
  dsB.rawData.forEach(rowB => {
    const key = normalizeJoinKey(rowB[keyB]);
    if (key) {
      if (!mapB.has(key)) mapB.set(key, []);
      mapB.get(key).push(rowB);
    }
  });

  const output = [];
  const matchedKeysB = new Set();
  dsA.rawData.forEach(rowA => {
    const key = normalizeJoinKey(rowA[keyA]);
    const matches = mapB.get(key) || [];
    if (matches.length) {
      matchedKeysB.add(key);
      matches.forEach(matchB => {
        const combined = { ...rowA };
        Object.keys(matchB).forEach(colB => {
          const finalCol = (colB !== keyB && combined[colB] !== undefined)
            ? `${colB}_${dsB.fileName.split('.')[0]}` : colB;
          combined[finalCol] = matchB[colB];
        });
        output.push(combined);
      });
    } else if (joinType === 'left' || joinType === 'full') {
      const combined = { ...rowA };
      dsB.columnNames.forEach(colB => { if (combined[colB] === undefined) combined[colB] = ''; });
      output.push(combined);
    }
  });

  if (joinType === 'full') {
    dsB.rawData.forEach(rowB => {
      const key = normalizeJoinKey(rowB[keyB]);
      if (!matchedKeysB.has(key)) {
        const combined = { ...rowB };
        dsA.columnNames.forEach(colA => { if (combined[colA] === undefined) combined[colA] = ''; });
        output.push(combined);
      }
    });
  }
  return output;
}

function updateJoinRationale() {
  const selectA = document.getElementById('joinTableASelect');
  const selectB = document.getElementById('joinTableBSelect');
  const selectKeyA = document.getElementById('joinKeyASelect');
  const selectKeyB = document.getElementById('joinKeyBSelect');
  const selectType = document.getElementById('joinTypeSelect');
  const rationaleBox = document.getElementById('joinRationaleText');

  if (!selectA || !selectB || !rationaleBox) return;

  const dsA = window.AppState.datasets.find(d => d.id === selectA.value);
  const dsB = window.AppState.datasets.find(d => d.id === selectB.value);
  const keyA = selectKeyA?.value;
  const keyB = selectKeyB?.value;
  const joinType = selectType?.value || 'left';

  if (!dsA || !dsB || !keyA || !keyB) return;

  const diagA = analyzeJoinKey(dsA.rawData, keyA);
  const diagB = analyzeJoinKey(dsB.rawData, keyB);
  const matchedKeys = [...diagA.counts.keys()].filter(key => diagB.counts.has(key));
  let estimatedRows;
  let unmatchedA = dsA.rawData.length;

  if (joinType === 'union') {
    estimatedRows = dsA.rawData.length + dsB.rawData.length;
  } else {
    estimatedRows = 0;
    matchedKeys.forEach(key => {
      estimatedRows += (diagA.counts.get(key) || 0) * (diagB.counts.get(key) || 0);
    });
    const matchedARows = matchedKeys.reduce((sum, key) => sum + diagA.counts.get(key), 0);
    const matchedBRows = matchedKeys.reduce((sum, key) => sum + diagB.counts.get(key), 0);
    unmatchedA = dsA.rawData.length - matchedARows - diagA.missing;
    const unmatchedB = dsB.rawData.length - matchedBRows - diagB.missing;
    if (joinType === 'left' || joinType === 'full') estimatedRows += unmatchedA;
    if (joinType === 'full') estimatedRows += unmatchedB;
  }

  const relationship = diagA.duplicateKeys === 0 && diagB.duplicateKeys === 0
    ? 'One-to-one'
    : diagA.duplicateKeys === 0
      ? 'One-to-many'
      : diagB.duplicateKeys === 0
        ? 'Many-to-one'
        : 'Many-to-many';
  const estimatedGrowth = dsA.rawData.length
    ? ((estimatedRows - dsA.rawData.length) / dsA.rawData.length) * 100
    : 0;
  const hasDuplicates = diagA.duplicateKeys > 0 || diagB.duplicateKeys > 0;

  const diagnostics = document.getElementById('joinDiagnostics');
  if (diagnostics) {
    diagnostics.innerHTML = `
      <div class="join-diagnostic-card ${hasDuplicates ? 'warning' : ''}"><span>Relationship</span><strong>${relationship}</strong></div>
      <div class="join-diagnostic-card"><span>Matched Keys</span><strong>${matchedKeys.length.toLocaleString()}</strong></div>
      <div class="join-diagnostic-card ${hasDuplicates ? 'warning' : ''}"><span>Duplicate Keys</span><strong>${(diagA.duplicateKeys + diagB.duplicateKeys).toLocaleString()}</strong></div>
      <div class="join-diagnostic-card"><span>Estimated Output</span><strong>${estimatedRows.toLocaleString()} rows</strong></div>
      <div class="join-diagnostic-card"><span>Estimated Change</span><strong>${estimatedGrowth >= 0 ? '+' : ''}${estimatedGrowth.toFixed(1)}%</strong></div>
      <div class="join-diagnostic-card"><span>Missing Keys</span><strong>${diagA.missing + diagB.missing}</strong></div>`;
  }

  let rationale = '';
  if (joinType === 'inner') {
    rationale = `<strong>Inner Join:</strong> Keeps only matching keys. Estimated result: <strong>${estimatedRows.toLocaleString()}</strong> rows.`;
  } else if (joinType === 'left') {
    rationale = `<strong>Left Outer Join:</strong> Keeps all <strong>${dsA.rawData.length.toLocaleString()}</strong> Table A rows. Estimated result: <strong>${estimatedRows.toLocaleString()}</strong> rows.`;
  } else if (joinType === 'full') {
    rationale = `<strong>Full Outer Join:</strong> Keeps matched and unmatched rows from both tables. Estimated result: <strong>${estimatedRows.toLocaleString()}</strong> rows.`;
  } else {
    rationale = `<strong>Vertical Concatenate:</strong> Stacks both tables without key matching. Estimated result: <strong>${estimatedRows.toLocaleString()}</strong> rows.`;
  }
  rationale += '<br><small>Cardinality is key-dependent. Duplicate keys multiply output rows; join cost is O(|R| + |S| + |output|).</small>';
  if (hasDuplicates) rationale += '<br><small><strong>Warning:</strong> Duplicate keys detected. Review the preview before executing.</small>';
  if (diagA.missing || diagB.missing) rationale += '<br><small><strong>Warning:</strong> Empty join keys are excluded from key matching.</small>';
  rationaleBox.innerHTML = rationale;

  const previewRows = buildJoinPreview(dsA, dsB, keyA, keyB, joinType);
  const previewHead = document.getElementById('joinPreviewHead');
  const previewBody = document.getElementById('joinPreviewBody');
  const previewCount = document.getElementById('joinPreviewCount');
  if (previewCount) previewCount.textContent = `${previewRows.length} preview rows · ${estimatedRows.toLocaleString()} estimated total`;
  if (previewRows.length && previewHead && previewBody) {
    const columns = [...new Set(previewRows.flatMap(row => Object.keys(row)))].slice(0, 10);
    previewHead.innerHTML = `<tr>${columns.map(col => `<th>${escapeHTML(col)}</th>`).join('')}</tr>`;
    previewBody.innerHTML = previewRows.map(row => `<tr>${columns.map(col => `<td>${escapeHTML(row[col] ?? '')}</td>`).join('')}</tr>`).join('');
  } else if (previewHead && previewBody) {
    previewHead.innerHTML = '';
    previewBody.innerHTML = '<tr><td>No matching preview rows</td></tr>';
  }

  if (window.lucide) window.lucide.createIcons();
}

/**
 * Execute Relational Join & Create New Combined Dataset
 */
window.executeDatasetJoin = function () {
  const selectA = document.getElementById('joinTableASelect');
  const selectB = document.getElementById('joinTableBSelect');
  const selectKeyA = document.getElementById('joinKeyASelect');
  const selectKeyB = document.getElementById('joinKeyBSelect');
  const selectType = document.getElementById('joinTypeSelect');

  if (!selectA || !selectB || !selectKeyA || !selectKeyB) return;

  const dsA = window.AppState.datasets.find(d => d.id === selectA.value);
  const dsB = window.AppState.datasets.find(d => d.id === selectB.value);
  const keyA = selectKeyA.value;
  const keyB = selectKeyB.value;
  const joinType = selectType?.value || 'left';

  if (!dsA || !dsB) {
    showToast('Please select valid tables to join.', 'error');
    return;
  }

  let mergedRows = executeJoinRows(dsA, dsB, keyA, keyB, joinType);
  const mergedName = `merged_${dsA.fileName.split('.')[0]}_${dsB.fileName.split('.')[0]}.csv`;

  if (mergedRows.length === 0) {
    showToast('Join resulted in 0 matching rows. Check selected key columns.', 'error');
    return;
  }

  const newMergedDataset = window.addDatasetToWorkspace({
    fileName: mergedName,
    fileSize: mergedRows.length * 160,
    fileType: 'Joined Dataset',
    rawData: mergedRows,
    cleanData: mergedRows.map(r => ({ ...r }))
  }, true);

  showToast(`Successfully created joined dataset "${mergedName}" with ${mergedRows.length.toLocaleString()} rows!`, 'success');
  navigateToTab('exploreTab');
};


// DOM Initialization
document.addEventListener('DOMContentLoaded', () => {
  initAppNavigation();
  initThemeToggle();
  if (window.lucide) {
    window.lucide.createIcons();
  }
});

/**
 * Initialize Workflow Navigation & Tab Switching
 */
function initAppNavigation() {
  const navButtons = document.querySelectorAll('.nav-step-btn');

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;

      // Prevent skipping if no dataset is loaded
      if (!window.AppState.datasetLoaded && targetTab !== 'uploadTab') {
        showToast('Please upload or select a dataset first', 'info');
        return;
      }

      // Enforce preprocessing completion before accessing Visual Analysis or AI Report
      if ((targetTab === 'analysisTab' || targetTab === 'reportTab') && (!window.AppState.preprocessing || window.AppState.preprocessing.maxUnlockedStep < 6)) {
        showToast('🔒 Please complete or skip through each preprocessing step first', 'error');
        navigateToTab('preprocessingTab');
        return;
      }

      navigateToTab(targetTab);
    });
  });

  // Step Header Proceed Buttons
  const btnProceedToExplore = document.getElementById('btnProceedToExplore');
  if (btnProceedToExplore) {
    btnProceedToExplore.addEventListener('click', () => navigateToTab('exploreTab'));
  }

  const btnGoToPreprocessing = document.getElementById('btnGoToPreprocessing');
  if (btnGoToPreprocessing) {
    btnGoToPreprocessing.addEventListener('click', () => {
      if (window.AppState.selectedAttributes.length === 0) {
        showToast('Please select at least one attribute to analyze', 'error');
        return;
      }
      navigateToTab('preprocessingTab');
    });
  }

  const btnProceedToAnalysis = document.getElementById('btnProceedToAnalysis');
  if (btnProceedToAnalysis) {
    btnProceedToAnalysis.addEventListener('click', () => {
      if (!window.AppState.preprocessing || window.AppState.preprocessing.maxUnlockedStep < 6) {
        showToast('🔒 Please complete or skip through each preprocessing step before advancing to Visual Analysis', 'error');
        return;
      }
      navigateToTab('analysisTab');
    });
  }

  const btnProceedToReport = document.getElementById('btnProceedToReport');
  if (btnProceedToReport) {
    btnProceedToReport.addEventListener('click', () => {
      navigateToTab('reportTab');
    });
  }
}

/**
 * Navigate to a specific tab by ID
 */
function navigateToTab(tabId) {
  // Update Tab Panes
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.remove('active');
  });

  const targetPane = document.getElementById(tabId);
  if (targetPane) {
    targetPane.classList.add('active');
  }

  // Update Sidebar Navigation Buttons
  document.querySelectorAll('.nav-step-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.tab === tabId) {
      btn.classList.add('active');
    }
  });

  window.AppState.currentTab = tabId;

  // Update Topbar Title and Step Pill
  const stepTitles = {
    'uploadTab': { step: 'Step 01 / 05', title: 'Upload Dataset' },
    'exploreTab': { step: 'Step 02 / 05', title: 'Explore Dataset & Target Attributes' },
    'preprocessingTab': { step: 'Step 03 / 05', title: 'Data Preprocessing & Anomaly Cleansing' },
    'analysisTab': { step: 'Step 04 / 05', title: 'Attribute-Driven Visual Analysis' },
    'reportTab': { step: 'Step 05 / 05', title: 'Automated AI Intelligence Report' }
  };

  const currentInfo = stepTitles[tabId] || { step: 'Step', title: 'Data Analytics' };
  const stepPill = document.getElementById('currentStepPill');
  const tabTitle = document.getElementById('currentTabTitle');

  if (stepPill) stepPill.textContent = currentInfo.step;
  if (tabTitle) tabTitle.textContent = currentInfo.title;

  // Trigger Tab-Specific Lifecycle Initializations
  if (tabId === 'exploreTab' && window.renderExplorer) {
    window.renderExplorer();
  } else if (tabId === 'preprocessingTab' && window.initPreprocessingTab) {
    window.initPreprocessingTab();
  } else if (tabId === 'analysisTab' && window.renderAnalysis) {
    window.renderAnalysis();
  } else if (tabId === 'reportTab' && window.generateAIReport) {
    window.generateAIReport();
  }

  // Re-initialize Lucide Icons for dynamic content
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Smooth scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Global Toast Notification System
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconMap = {
    success: 'check-circle',
    error: 'alert-triangle',
    info: 'info'
  };

  const iconName = iconMap[type] || 'info';

  toast.innerHTML = `
    <i data-lucide="${iconName}" style="width: 18px; height: 18px; flex-shrink: 0;"></i>
    <span>${escapeHTML(message)}</span>
  `;

  container.appendChild(toast);

  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Auto remove after 3.5 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/**
 * Theme Toggle Manager (Dark / Light)
 */
function initThemeToggle() {
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeIcon = document.getElementById('themeIcon');
  if (!themeToggleBtn) return;

  themeToggleBtn.addEventListener('click', () => {
    const htmlEl = document.documentElement;
    const currentTheme = htmlEl.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    htmlEl.setAttribute('data-theme', newTheme);

    if (themeIcon) {
      themeIcon.setAttribute('data-lucide', newTheme === 'dark' ? 'sun' : 'moon');
      if (window.lucide) window.lucide.createIcons();
    }

    showToast(`Switched to ${newTheme} theme`, 'info');
  });
}

/**
 * Global HTML Escaping Utility
 */
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format Numbers with Commas
 */
function formatNumber(num, decimals = 0) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Number(num).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}