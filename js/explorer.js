/**
 * ============================================================================
 * DATASPHERE ANALYTICS - EXPLORER MODULE (explorer.js)
 * Dataset Profiling, Target Attribute Selection, & Interactive Table Preview
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  initExplorerEvents();
});

function initExplorerEvents() {
  // Attribute filter chips
  const filterAll = document.getElementById('filterAll');
  const filterNumeric = document.getElementById('filterNumeric');
  const filterCategorical = document.getElementById('filterCategorical');
  const searchInput = document.getElementById('attrSearchInput');

  if (filterAll) filterAll.addEventListener('click', () => filterAttrCards('all'));
  if (filterNumeric) filterNumeric.addEventListener('click', () => filterAttrCards('numeric'));
  if (filterCategorical) filterCategorical.addEventListener('click', () => filterAttrCards('categorical'));

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchAttrCards(e.target.value);
    });
  }

  // Select all / Deselect all
  const btnSelectAll = document.getElementById('btnSelectAllAttrs');
  const btnDeselectAll = document.getElementById('btnDeselectAllAttrs');

  if (btnSelectAll) {
    btnSelectAll.addEventListener('click', () => {
      window.AppState.selectedAttributes = [...window.AppState.columnNames];
      updateAttributeSelectionUI();
    });
  }

  if (btnDeselectAll) {
    btnDeselectAll.addEventListener('click', () => {
      // Keep at least the target attribute selected
      if (window.AppState.targetAttribute) {
        window.AppState.selectedAttributes = [window.AppState.targetAttribute];
      } else {
        window.AppState.selectedAttributes = [];
      }
      updateAttributeSelectionUI();
    });
  }

  // Table pagination controls
  const prevBtn = document.getElementById('tablePrevBtn');
  const nextBtn = document.getElementById('tableNextBtn');
  const tableSearch = document.getElementById('tableSearchInput');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (window.AppState.rawTablePage > 1) {
        window.AppState.rawTablePage--;
        renderDataTablePreview();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(window.AppState.rawData.length / window.AppState.rawTablePageSize);
      if (window.AppState.rawTablePage < totalPages) {
        window.AppState.rawTablePage++;
        renderDataTablePreview();
      }
    });
  }

  if (tableSearch) {
    tableSearch.addEventListener('input', () => {
      window.AppState.rawTablePage = 1;
      renderDataTablePreview();
    });
  }
}

/**
 * Main Profiler: Analyzes Column Data Types, Statistics & Missing Rates
 */
window.profileDataset = function () {
  const data = window.AppState.rawData;
  if (!data || data.length === 0) return;

  const columns = Object.keys(data[0] || {});
  window.AppState.columnNames = columns;
  window.AppState.columnInfo = {};

  let totalMissing = 0;

  columns.forEach(col => {
    const allValues = data.map(r => r[col]);
    const validValues = allValues.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
    const missingCount = data.length - validValues.length;
    totalMissing += missingCount;

    // Detect numeric count
    const numericValues = validValues.map(v => parseNumericValue(v)).filter(n => !isNaN(n));
    const isNumeric = validValues.length > 0 && (numericValues.length / validValues.length >= 0.75);

    // Detect boolean
    const isBoolean = !isNumeric && validValues.every(v => {
      const s = String(v).trim().toLowerCase();
      return ['true', 'false', '1', '0', 'yes', 'no', 'y', 'n'].includes(s);
    });

    // Detect datetime
    const isDate = !isNumeric && !isBoolean && validValues.length > 0 && validValues.slice(0, 10).every(v => {
      const parsed = Date.parse(v);
      return !isNaN(parsed) && String(v).length >= 4;
    });

    let type = 'categorical';
    if (isNumeric) type = 'numeric';
    else if (isBoolean) type = 'boolean';
    else if (isDate) type = 'datetime';

    // Unique count
    const uniqueValues = new Set(validValues.map(v => String(v).trim()));
    const uniqueCount = uniqueValues.size;

    // Calculate Numeric Stats
    let stats = {};
    if (type === 'numeric' && numericValues.length > 0) {
      const sorted = [...numericValues].sort((a, b) => a - b);
      const sum = sorted.reduce((a, b) => a + b, 0);
      const mean = sum / sorted.length;
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const median = sorted[Math.floor(sorted.length / 2)];

      stats = {
        min: Number(min.toFixed(2)),
        max: Number(max.toFixed(2)),
        mean: Number(mean.toFixed(2)),
        median: Number(median.toFixed(2)),
        numericArray: sorted
      };
    } else {
      // Frequency for categorical
      const freqMap = {};
      validValues.forEach(v => {
        const key = String(v).trim();
        freqMap[key] = (freqMap[key] || 0) + 1;
      });
      const sortedFreq = Object.entries(freqMap).sort((a, b) => b[1] - a[1]);
      const topCategory = sortedFreq[0] ? sortedFreq[0][0] : 'N/A';
      const topCount = sortedFreq[0] ? sortedFreq[0][1] : 0;
      stats = {
        topCategory,
        topPct: validValues.length > 0 ? ((topCount / validValues.length) * 100).toFixed(1) : 0
      };
    }

    window.AppState.columnInfo[col] = {
      name: col,
      type,
      missingCount,
      missingPct: ((missingCount / data.length) * 100).toFixed(1),
      uniqueCount,
      sampleValue: validValues[0] ?? 'N/A',
      stats
    };
  });

  // Calculate Duplicates
  const duplicateCount = calculateDuplicateCount(data);
  window.AppState.anomalies.missingCount = totalMissing;
  window.AppState.anomalies.duplicateCount = duplicateCount;

  // Set default selected attributes and Target Attribute
  window.AppState.selectedAttributes = [...columns];

  // Pick first numeric column as target, or first column
  const numericCols = columns.filter(c => window.AppState.columnInfo[c].type === 'numeric');
  window.AppState.targetAttribute = numericCols[0] || columns[0] || null;

  renderExplorer();
};

/**
 * Render Explorer Page Components
 */
window.renderExplorer = function () {
  const data = window.AppState.rawData;
  const colInfo = window.AppState.columnInfo;
  const columns = window.AppState.columnNames;

  if (!data || data.length === 0) return;

  const numericCount = columns.filter(c => colInfo[c]?.type === 'numeric').length;
  const categoricalCount = columns.filter(c => colInfo[c]?.type === 'categorical').length;

  // 1. Update KPI Strip
  setText('kpiTotalRows', data.length.toLocaleString());
  setText('kpiTotalCols', columns.length.toString());
  setText('kpiNumericCols', numericCount.toString());
  setText('kpiCategoricalCols', categoricalCount.toString());
  setText('kpiMissingCount', window.AppState.anomalies.missingCount.toLocaleString());
  setText('kpiDuplicateCount', window.AppState.anomalies.duplicateCount.toLocaleString());

  // 2. Update Filter Chip Counts
  setText('countAllAttrs', columns.length.toString());
  setText('countNumAttrs', numericCount.toString());
  setText('countCatAttrs', categoricalCount.toString());
  setText('totalAttrsCount', columns.length.toString());
  setText('selectedCountBadge', window.AppState.selectedAttributes.length.toString());

  // 3. Render Attribute Cards
  renderAttributeCards();

  // 4. Render Table Preview
  renderDataTablePreview();
};

/**
 * Render Grid of Attribute Selection Cards
 */
function renderAttributeCards() {
  const container = document.getElementById('attributesGrid');
  if (!container) return;

  container.innerHTML = '';
  const colInfo = window.AppState.columnInfo;
  const columns = window.AppState.columnNames;

  columns.forEach(col => {
    const info = colInfo[col];
    if (!info) return;

    const isSelected = window.AppState.selectedAttributes.includes(col);
    const isTarget = window.AppState.targetAttribute === col;

    const card = document.createElement('div');
    card.className = `attribute-card ${isSelected ? 'is-selected' : ''} ${isTarget ? 'is-target' : ''}`;
    card.dataset.column = col;
    card.dataset.type = info.type;

    let statSummaryHtml = '';
    if (info.type === 'numeric') {
      statSummaryHtml = `Range: ${info.stats.min} to ${info.stats.max} • Mean: ${info.stats.mean}`;
    } else {
      statSummaryHtml = `Top: "${escapeHTML(info.stats.topCategory)}" (${info.stats.topPct}%)`;
    }

    card.innerHTML = `
      <div class="attr-top-row">
        <label class="attr-checkbox-label">
          <input type="checkbox" class="attr-checkbox" value="${escapeHTML(col)}" ${isSelected ? 'checked' : ''}>
          <span>${escapeHTML(col)}</span>
        </label>
        <span class="type-badge ${info.type}">${info.type}</span>
      </div>

      <div class="attr-stats-row">
        <span>${info.uniqueCount} unique values</span>
        <span style="color: ${info.missingCount > 0 ? 'var(--accent-amber)' : 'var(--text-dim)'};">
          ${info.missingCount > 0 ? `${info.missingCount} missing (${info.missingPct}%)` : '0 missing'}
        </span>
      </div>

      <div class="attr-sample-val" title="${statSummaryHtml}">
        ${statSummaryHtml}
      </div>

      <button class="target-select-btn" data-target="${escapeHTML(col)}">
        <i data-lucide="${isTarget ? 'check-circle' : 'star'}" style="width: 14px; height: 14px;"></i>
        <span>${isTarget ? 'Primary Target Attribute ★' : 'Set as Target'}</span>
      </button>
    `;

    container.appendChild(card);
  });

  // Attach Event Listeners to Checkboxes and Target Buttons
  container.querySelectorAll('.attr-checkbox').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const colName = e.target.value;
      if (e.target.checked) {
        if (!window.AppState.selectedAttributes.includes(colName)) {
          window.AppState.selectedAttributes.push(colName);
        }
      } else {
        window.AppState.selectedAttributes = window.AppState.selectedAttributes.filter(c => c !== colName);
      }
      updateAttributeSelectionUI();
    });
  });

  container.querySelectorAll('.target-select-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const colName = btn.dataset.target;
      window.AppState.targetAttribute = colName;
      if (!window.AppState.selectedAttributes.includes(colName)) {
        window.AppState.selectedAttributes.push(colName);
      }
      showToast(`Target attribute set to "${colName}"`, 'success');
      renderAttributeCards();
      updateAttributeSelectionUI();
    });
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function updateAttributeSelectionUI() {
  const container = document.getElementById('attributesGrid');
  if (!container) return;

  container.querySelectorAll('.attribute-card').forEach(card => {
    const col = card.dataset.column;
    const isSelected = window.AppState.selectedAttributes.includes(col);
    const isTarget = window.AppState.targetAttribute === col;
    const chk = card.querySelector('.attr-checkbox');

    if (chk) chk.checked = isSelected;
    card.classList.toggle('is-selected', isSelected);
    card.classList.toggle('is-target', isTarget);
  });

  setText('selectedCountBadge', window.AppState.selectedAttributes.length.toString());
}

/**
 * Filter Attribute Cards by Type
 */
function filterAttrCards(type) {
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  if (type === 'all') document.getElementById('filterAll')?.classList.add('active');
  if (type === 'numeric') document.getElementById('filterNumeric')?.classList.add('active');
  if (type === 'categorical') document.getElementById('filterCategorical')?.classList.add('active');

  document.querySelectorAll('.attribute-card').forEach(card => {
    const cardType = card.dataset.type;
    if (type === 'all' || cardType === type) {
      card.style.display = 'flex';
    } else {
      card.style.display = 'none';
    }
  });
}

function searchAttrCards(query) {
  const q = query.toLowerCase().trim();
  document.querySelectorAll('.attribute-card').forEach(card => {
    const name = card.dataset.column.toLowerCase();
    if (!q || name.includes(q)) {
      card.style.display = 'flex';
    } else {
      card.style.display = 'none';
    }
  });
}

/**
 * Render Paginated Live Data Table Preview
 */
function renderDataTablePreview() {
  const tableHead = document.getElementById('rawTableHead');
  const tableBody = document.getElementById('rawTableBody');
  const data = window.AppState.rawData;
  const columns = window.AppState.columnNames;

  if (!tableHead || !tableBody || !data || data.length === 0) return;

  // Search filter
  const searchInput = document.getElementById('tableSearchInput');
  const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';

  let filteredData = data;
  if (searchVal) {
    filteredData = data.filter(row => {
      return Object.values(row).some(v => String(v).toLowerCase().includes(searchVal));
    });
  }

  // Header
  tableHead.innerHTML = `<th>#</th>` + columns.map(c => `<th>${escapeHTML(c)}</th>`).join('');

  // Pagination slice
  const pageSize = window.AppState.rawTablePageSize;
  const currentPage = window.AppState.rawTablePage;
  const startIndex = (currentPage - 1) * pageSize;
  const pageRows = filteredData.slice(startIndex, startIndex + pageSize);

  // Body
  if (pageRows.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="${columns.length + 1}" style="text-align:center; padding: 24px; color: var(--text-dim);">No matching records found.</td></tr>`;
  } else {
    tableBody.innerHTML = pageRows.map((row, idx) => {
      const rowNum = startIndex + idx + 1;
      const cells = columns.map(col => {
        const val = row[col];
        if (val === null || val === undefined || String(val).trim() === '') {
          return `<td><span class="null-cell">null</span></td>`;
        }
        return `<td>${escapeHTML(val)}</td>`;
      }).join('');
      return `<tr><td style="color: var(--text-dim); font-weight: 700;">${rowNum}</td>${cells}</tr>`;
    }).join('');
  }

  // Update Footer Pagination
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  setText('tableCurrentPage', `Page ${currentPage} of ${totalPages}`);
  setText('tablePaginationInfo', `Showing ${Math.min(startIndex + 1, filteredData.length)}-${Math.min(startIndex + pageSize, filteredData.length)} of ${filteredData.length.toLocaleString()} rows`);
}

/**
 * Parse strings to clean numerical values
 */
function parseNumericValue(val) {
  if (val === null || val === undefined || val === '') return NaN;
  const cleaned = String(val).replace(/,/g, '').replace(/[₹$€£%]/g, '').trim();
  return Number(cleaned);
}

/**
 * Calculate count of exact duplicate rows
 */
function calculateDuplicateCount(data) {
  const seen = new Set();
  let duplicates = 0;
  data.forEach(row => {
    const key = JSON.stringify(row);
    if (seen.has(key)) {
      duplicates++;
    } else {
      seen.add(key);
    }
  });
  return duplicates;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}