/**
 * ============================================================================
 * DATASPHERE ANALYTICS - GUIDED PREPROCESSING MODULE (preprocessing.js)
 * Step-by-Step Guided Walkthrough, Decision Engine, Strategy Impact Guides & Export
 * ============================================================================
 */

// Strategy Impact Knowledge Dictionaries
const STRATEGY_IMPACTS = {
  deduplication: {
    first: {
      title: "Keep First Occurrence (Recommended)",
      type: "Recommended",
      badgeClass: "numeric",
      mechanism: "Scans chronologically from row 0 downwards. Retains the initial encountered version of identical records and discards all subsequent duplicate rows.",
      bestFor: "Standard batch uploads, chronological transaction logs, and event streams where the first entry represents the authentic occurrence.",
      datasetImpact: "Decreases row count N by exact duplicate count. Eliminates artificial frequency weighting while preserving original chronological baseline.",
      risks: "Discards newer data points if subsequent duplicate rows contained updated revision attributes."
    },
    last: {
      title: "Keep Last Occurrence",
      type: "Alternative",
      badgeClass: "boolean",
      mechanism: "Scans backwards from the bottom of the dataset. Preserves the most recently appended version of duplicate rows and discards earlier ones.",
      bestFor: "Cumulative snapshot files, CRM customer records, and state logs where later rows contain the most updated revision.",
      datasetImpact: "Decreases row count N by duplicate count. Preserves latest record state; may alter chronological time-series sequence.",
      risks: "Can disrupt initial sequential order if records are time-series dependent."
    },
    none: {
      title: "Retain All Duplicates (Non-Destructive)",
      type: "Preservation",
      badgeClass: "categorical",
      mechanism: "Leaves all identical rows in the dataset completely unmodified without filtering.",
      bestFor: "Frequency tally sheets, unaggregated receipt line items, and multi-instance transaction logs where duplicate rows represent separate legitimate occurrences.",
      datasetImpact: "Zero row reduction (N unchanged). Retains metric inflation and lower variance if duplicates were accidental data entry errors.",
      risks: "Causes overfitting in analytical models and artificially inflates aggregation counts."
    }
  },

  missingValues: {
    smart: {
      title: "Smart Auto-Impute (Recommended)",
      type: "Recommended",
      badgeClass: "numeric",
      mechanism: "Dynamically analyzes column data types: automatically applies Median to numerical metrics (robust to skewness) and Mode to categorical text columns.",
      bestFor: "General-purpose exploratory data analysis and mixed tabular datasets containing both numeric and text dimensions.",
      datasetImpact: "100% row preservation (N unchanged). Neutralizes skewness in numeric columns without artificially dragging means; fills text nulls with the dominant class.",
      risks: "Slightly reduces attribute variance; top categorical class frequency increases."
    },
    median: {
      title: "Median Imputation (Numeric)",
      type: "Robust",
      badgeClass: "boolean",
      mechanism: "Computes the 50th percentile (middle value) of non-null numbers and replaces every missing cell with this value.",
      bestFor: "Skewed numeric attributes (e.g. Salary, Price, Revenue, Hospital Wait Times) containing extreme outlier values.",
      datasetImpact: "Preserves row count N. Maintains stable central tendency resistant to extreme spikes. Slightly reduces standard deviation without shifting the center.",
      risks: "Does not model inter-variable covariance or multi-attribute relationships."
    },
    mean: {
      title: "Mean Imputation (Numeric)",
      type: "Parametric",
      badgeClass: "datetime",
      mechanism: "Computes the arithmetic average (μ = Σx / N) and replaces missing cells with this value.",
      bestFor: "Symmetrical, bell-curve (Gaussian) normally distributed numerical metrics with minimal outliers.",
      datasetImpact: "Preserves the sample mean exactly. Compresses standard deviation (σ) and column variance. Can pull distributions if extreme outliers exist.",
      risks: "Distorts standard error, variances, and correlation coefficients if data is skewed."
    },
    mode: {
      title: "Mode Imputation (Categorical & Discrete)",
      type: "Categorical",
      badgeClass: "categorical",
      mechanism: "Identifies the highest frequency category or discrete value and substitutes it into every null cell.",
      bestFor: "Categorical attributes (Region, Department, Status, Device Type) and discrete integer status codes.",
      datasetImpact: "Preserves sample size N. Artificially amplifies the dominant class frequency; can underrepresent minority groups.",
      risks: "Can reduce diversity of categorical distributions in downstream charts."
    },
    constant: {
      title: "Constant Placeholder ('Unknown' / 0)",
      type: "Explicit Placeholder",
      badgeClass: "boolean",
      mechanism: "Replaces text nulls with 'Unknown' and numeric nulls with 0.",
      bestFor: "When missingness is informative (Missing Not At Random - MNAR), or 0 represents true absence of quantity (e.g. Discount = 0).",
      datasetImpact: "Preserves all rows. Creates a dedicated 'Unknown' slice in charts. For numeric data, adding zeroes can drag averages down significantly.",
      risks: "Numeric 0 values can severely distort average and median calculations if 0 is not a true absence."
    },
    drop: {
      title: "Drop Incomplete Rows (Listwise Deletion)",
      type: "Aggressive Deletion",
      badgeClass: "categorical",
      mechanism: "Permanently deletes any entire record where at least one attribute contains an empty or null cell.",
      bestFor: "Large datasets (N > 10,000) where missing values represent < 2% of rows and authentic data cannot tolerate estimated values.",
      datasetImpact: "Directly decreases dataset row count N. Guarantees 100% authentic observations, but reduces statistical power.",
      risks: "Can discard substantial portions of the dataset and introduce selection bias if data is Missing Not At Random."
    }
  },

  outliers: {
    winsorize: {
      title: "Winsorization / Percentile Capping (Recommended)",
      type: "Recommended",
      badgeClass: "numeric",
      mechanism: "Clamps extreme low values to the 5th percentile (P05) and high spikes to the 95th percentile (P95).",
      bestFor: "Standard exploratory data analysis and ML preprocessing where you want to neutralize spikes without dropping data.",
      datasetImpact: "Preserves 100% of rows (N untouched). Stabilizes variance, standard deviation, and chart axes without losing authentic records.",
      risks: "Slightly compresses the true natural extreme variance of the distribution tails."
    },
    remove_iqr: {
      title: "1.5x IQR Boundary Rule Filtering",
      type: "Robust Trimming",
      badgeClass: "datetime",
      mechanism: "Calculates IQR = Q3 - Q1. Any row with numerical values outside [Q1 - 1.5*IQR, Q3 + 1.5*IQR] is permanently deleted.",
      bestFor: "Strict statistical hypothesis testing and when outliers are known measurement artifacts or entry typos.",
      datasetImpact: "Reduces total row count N. Restores normality to distributions; eliminates extreme leverage points in regressions.",
      risks: "Risks deleting genuine high-value customers, rare medical cases, or legitimate top-tier events."
    },
    remove_zscore: {
      title: "Z-Score > 3.0 Filtering",
      type: "Parametric Trimming",
      badgeClass: "boolean",
      mechanism: "Standardizes values to Z = (X - μ) / σ. Rows with |Z| > 3.0 (more than 3 standard deviations from mean) are deleted.",
      bestFor: "Normally distributed (bell curve) metrics to eliminate the extreme 0.3% tail anomalies.",
      datasetImpact: "Removes extreme tail rows. Less aggressive than IQR on skewed data; restores parametric consistency.",
      risks: "Outliers themselves pull μ and σ, which can sometimes mask other outliers (masking effect)."
    },
    keep: {
      title: "Keep Outliers Untouched",
      type: "Preservation",
      badgeClass: "categorical",
      mechanism: "Leaves all numerical values raw and completely unmodified regardless of magnitude.",
      bestFor: "Anomaly detection, fraud investigation, cyber-security, and rare disease diagnostics where outliers ARE the primary target.",
      datasetImpact: "0 rows modified (N unchanged). Means and standard deviations remain pulled by extreme spikes; chart axes remain stretched.",
      risks: "Distorts linear regressions, compresses scatter plots, and skews standard deviations."
    }
  },

  textSanitize: {
    trim_case: {
      title: "Trim Whitespaces & Title Case (Recommended)",
      type: "Recommended",
      badgeClass: "numeric",
      mechanism: "Strips invisible leading/trailing whitespace and capitalizes the first character of each word (' new york ' → 'New York').",
      bestFor: "Proper nouns, names, cities, departments, categories, and general text columns.",
      datasetImpact: "Merges fragmented duplicate casing variations into clean unified categories. Fixes split category bars in charts.",
      risks: "Converts intentional all-caps acronyms (e.g. 'NASA' → 'Nasa') or camelCase identifiers."
    },
    trim: {
      title: "Trim Whitespaces Only",
      type: "Preserves Casing",
      badgeClass: "boolean",
      mechanism: "Removes padding spaces while leaving original character capitalization completely untouched.",
      bestFor: "Acronyms, mixed-case SKU codes, product identifiers, and case-sensitive text.",
      datasetImpact: "Fixes space-padding defects without altering case. Preserves mixed-case codes (e.g. 'iPhone', 'MacBook').",
      risks: "Does not merge casing inconsistencies like 'New York' vs 'new york'."
    },
    lower: {
      title: "Trim & Lowercase",
      type: "NLP / Normalization",
      badgeClass: "datetime",
      mechanism: "Strips spaces and converts all letters to lowercase ('NEW YORK' → 'new york').",
      bestFor: "Email addresses, usernames, search query tokens, and NLP tokenization pipelines.",
      datasetImpact: "Maximum normalization; unifies all case variations into standard lowercase strings.",
      risks: "Loses formal presentation capitalization for human display."
    },
    none: {
      title: "No Text Modification (Raw)",
      type: "Raw Input",
      badgeClass: "categorical",
      mechanism: "Leaves string values exactly as formatted in the raw uploaded file.",
      bestFor: "Raw textual transcripts and case-sensitive cryptographic tokens.",
      datasetImpact: "0 text values modified. Highest risk of category fragmentation in charts and groupby operations.",
      risks: "Inconsistent data entry creates multiple disjoint slices for identical categories."
    }
  }
};

// Initialize default preprocessing state
function initPrepState() {
  window.AppState.preprocessing = (typeof window.createDefaultPrepState === 'function')
    ? window.createDefaultPrepState()
    : {
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
}


// Attach event listeners when DOM loads
document.addEventListener('DOMContentLoaded', () => {
  initPrepState();
  initPreprocessingEvents();
});

/**
 * Wire up all buttons, dropdowns, stepper pills, and drawers
 */
function initPreprocessingEvents() {
  // Reset Walkthrough Button
  const btnReset = document.getElementById('btnResetPrepWalkthrough');
  if (btnReset) {
    btnReset.addEventListener('click', () => resetPreprocessingWalkthrough());
  }

  // Stepper Nav Buttons (with locking checks)
  const stepperButtons = document.querySelectorAll('.prep-stepper-step');
  stepperButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const stepNum = parseInt(btn.dataset.step, 10);
      goToPrepStep(stepNum);
    });
  });

  // Dynamic Strategy Dropdown Listeners (Update Strategy Impact Cards in real-time)
  const dupSelect = document.getElementById('duplicateStrategySelect');
  if (dupSelect) {
    dupSelect.addEventListener('change', () => renderStep2StrategyImpact(dupSelect.value));
  }

  const missingSelect = document.getElementById('missingStrategySelect');
  if (missingSelect) {
    missingSelect.addEventListener('change', () => renderStep3StrategyImpact(missingSelect.value));
  }

  const outlierSelect = document.getElementById('outlierStrategySelect');
  if (outlierSelect) {
    outlierSelect.addEventListener('change', () => renderStep4StrategyImpact(outlierSelect.value));
  }

  const textSelect = document.getElementById('textSanitizeSelect');
  if (textSelect) {
    textSelect.addEventListener('change', () => renderStep5StrategyImpact(textSelect.value));
  }

  // Accordion Drawer Toggles
  setupDrawerToggle('btnToggleStep2Comp', 'step2CompDrawer');
  setupDrawerToggle('btnToggleStep3Comp', 'step3CompDrawer');
  setupDrawerToggle('btnToggleStep4Comp', 'step4CompDrawer');
  setupDrawerToggle('btnToggleStep5Comp', 'step5CompDrawer');

  // STEP 1 Actions
  const btnStep1Proceed = document.getElementById('btnStep1Proceed');
  if (btnStep1Proceed) {
    btnStep1Proceed.addEventListener('click', () => {
      window.AppState.preprocessing.stepDecisions[1] = {
        status: 'applied',
        label: 'Diagnostics Completed',
        detail: `Cleanliness score ${window.AppState.healthScore}%`
      };
      unlockAndGoToStep(2);
    });
  }

  // STEP 2 Actions (Deduplication)
  const btnStep2Back = document.getElementById('btnStep2Back');
  const btnStep2Skip = document.getElementById('btnStep2Skip');
  const btnStep2Apply = document.getElementById('btnStep2Apply');

  if (btnStep2Back) btnStep2Back.addEventListener('click', () => goToPrepStep(1, false));

  if (btnStep2Skip) {
    btnStep2Skip.addEventListener('click', () => {
      window.AppState.preprocessing.config.deduplication.skipped = true;
      window.AppState.preprocessing.config.deduplication.enabled = false;
      window.AppState.preprocessing.stepDecisions[2] = {
        status: 'skipped',
        label: 'Skipped by User',
        detail: 'Duplicates retained untouched'
      };
      showToast('Deduplication skipped: Redundant records retained', 'info');
      unlockAndGoToStep(3);
    });
  }

  if (btnStep2Apply) {
    btnStep2Apply.addEventListener('click', () => {
      const strategy = document.getElementById('duplicateStrategySelect')?.value || 'first';
      window.AppState.preprocessing.config.deduplication.skipped = false;
      window.AppState.preprocessing.config.deduplication.enabled = strategy !== 'none';
      window.AppState.preprocessing.config.deduplication.strategy = strategy;
      window.AppState.preprocessing.stepDecisions[2] = {
        status: strategy === 'none' ? 'skipped' : 'applied',
        label: strategy === 'none' ? 'Retain Duplicates' : 'Deduplication Applied',
        detail: strategy === 'none' ? 'Retained all duplicates' : `Filter duplicates (${strategy} occurrence kept)`
      };
      showToast('Deduplication setting saved', 'success');
      unlockAndGoToStep(3);
    });
  }

  // STEP 3 Actions (Missing Values)
  const btnStep3Back = document.getElementById('btnStep3Back');
  const btnStep3Skip = document.getElementById('btnStep3Skip');
  const btnStep3Apply = document.getElementById('btnStep3Apply');

  if (btnStep3Back) btnStep3Back.addEventListener('click', () => goToPrepStep(2, false));

  if (btnStep3Skip) {
    btnStep3Skip.addEventListener('click', () => {
      window.AppState.preprocessing.config.missingValues.skipped = true;
      window.AppState.preprocessing.config.missingValues.enabled = false;
      window.AppState.preprocessing.stepDecisions[3] = {
        status: 'skipped',
        label: 'Skipped by User',
        detail: 'Missing cells retained without imputation'
      };
      showToast('Missing values imputation skipped: Nulls retained', 'info');
      unlockAndGoToStep(4);
    });
  }

  if (btnStep3Apply) {
    btnStep3Apply.addEventListener('click', () => {
      const strategy = document.getElementById('missingStrategySelect')?.value || 'smart';
      window.AppState.preprocessing.config.missingValues.skipped = false;
      window.AppState.preprocessing.config.missingValues.enabled = true;
      window.AppState.preprocessing.config.missingValues.strategy = strategy;
      window.AppState.preprocessing.stepDecisions[3] = {
        status: 'applied',
        label: 'Imputation Configured',
        detail: `Algorithm: ${getImputationLabel(strategy)}`
      };
      showToast('Missing value imputation setting saved', 'success');
      unlockAndGoToStep(4);
    });
  }

  // STEP 4 Actions (Outliers)
  const btnStep4Back = document.getElementById('btnStep4Back');
  const btnStep4Skip = document.getElementById('btnStep4Skip');
  const btnStep4Apply = document.getElementById('btnStep4Apply');

  if (btnStep4Back) btnStep4Back.addEventListener('click', () => goToPrepStep(3, false));

  if (btnStep4Skip) {
    btnStep4Skip.addEventListener('click', () => {
      window.AppState.preprocessing.config.outliers.skipped = true;
      window.AppState.preprocessing.config.outliers.enabled = false;
      window.AppState.preprocessing.stepDecisions[4] = {
        status: 'skipped',
        label: 'Skipped by User',
        detail: 'Extreme outlier spikes retained untouched'
      };
      showToast('Outlier treatment skipped: Extreme values retained', 'info');
      unlockAndGoToStep(5);
    });
  }

  if (btnStep4Apply) {
    btnStep4Apply.addEventListener('click', () => {
      const strategy = document.getElementById('outlierStrategySelect')?.value || 'winsorize';
      window.AppState.preprocessing.config.outliers.skipped = false;
      window.AppState.preprocessing.config.outliers.enabled = strategy !== 'keep';
      window.AppState.preprocessing.config.outliers.strategy = strategy;
      window.AppState.preprocessing.stepDecisions[4] = {
        status: strategy === 'keep' ? 'skipped' : 'applied',
        label: strategy === 'keep' ? 'Retain Outliers' : 'Outliers Regulated',
        detail: getOutlierLabel(strategy)
      };
      showToast('Outlier treatment setting saved', 'success');
      unlockAndGoToStep(5);
    });
  }

  // STEP 5 Actions (Text Sanitization)
  const btnStep5Back = document.getElementById('btnStep5Back');
  const btnStep5Skip = document.getElementById('btnStep5Skip');
  const btnStep5Apply = document.getElementById('btnStep5Apply');

  if (btnStep5Back) btnStep5Back.addEventListener('click', () => goToPrepStep(4, false));

  if (btnStep5Skip) {
    btnStep5Skip.addEventListener('click', () => {
      window.AppState.preprocessing.config.textSanitize.skipped = true;
      window.AppState.preprocessing.config.textSanitize.enabled = false;
      window.AppState.preprocessing.stepDecisions[5] = {
        status: 'skipped',
        label: 'Skipped by User',
        detail: 'Text left in raw format'
      };
      showToast('Text sanitization skipped: Raw strings preserved', 'info');
      unlockAndGoToStep(6);
    });
  }

  if (btnStep5Apply) {
    btnStep5Apply.addEventListener('click', () => {
      const strategy = document.getElementById('textSanitizeSelect')?.value || 'trim_case';
      const sanitizeBooleans = document.getElementById('chkSanitizeBooleans')?.checked ?? true;
      window.AppState.preprocessing.config.textSanitize.skipped = false;
      window.AppState.preprocessing.config.textSanitize.enabled = strategy !== 'none' || sanitizeBooleans;
      window.AppState.preprocessing.config.textSanitize.strategy = strategy;
      window.AppState.preprocessing.config.textSanitize.sanitizeBooleans = sanitizeBooleans;
      window.AppState.preprocessing.stepDecisions[5] = {
        status: (strategy === 'none' && !sanitizeBooleans) ? 'skipped' : 'applied',
        label: (strategy === 'none' && !sanitizeBooleans) ? 'No Text Change' : 'Sanitization Configured',
        detail: `Format: ${strategy}, Booleans: ${sanitizeBooleans ? 'Normalized' : 'Raw'}`
      };
      showToast('Sanitization configured. Finalizing pipeline...', 'success');
      unlockAndGoToStep(6);
    });
  }

  // STEP 6 Actions (Review, Audit & Export)
  const btnStep6Back = document.getElementById('btnStep6Back');
  const btnRerun = document.getElementById('btnRerunCleaning');
  const btnStep6Continue = document.getElementById('btnStep6ContinueAnalysis');
  const btnDownloadCSV = document.getElementById('btnDownloadCleanCSV');
  const btnDownloadJSON = document.getElementById('btnDownloadCleanJSON');

  if (btnStep6Back) btnStep6Back.addEventListener('click', () => goToPrepStep(5, false));
  if (btnRerun) btnRerun.addEventListener('click', () => executeConfiguredPipeline());
  if (btnStep6Continue) {
    btnStep6Continue.addEventListener('click', () => {
      if (window.navigateToTab) window.navigateToTab('analysisTab');
    });
  }

  if (btnDownloadCSV) {
    btnDownloadCSV.addEventListener('click', () => exportCleanDataset('csv'));
  }
  if (btnDownloadJSON) {
    btnDownloadJSON.addEventListener('click', () => exportCleanDataset('json'));
  }

  // Clean table pagination
  const prevBtn = document.getElementById('cleanTablePrevBtn');
  const nextBtn = document.getElementById('cleanTableNextBtn');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (window.AppState.cleanTablePage > 1) {
        window.AppState.cleanTablePage--;
        renderCleanTablePreview();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(window.AppState.cleanData.length / window.AppState.cleanTablePageSize);
      if (window.AppState.cleanTablePage < totalPages) {
        window.AppState.cleanTablePage++;
        renderCleanTablePreview();
      }
    });
  }
}

/**
 * Setup Expandable Drawer Toggle
 */
function setupDrawerToggle(btnId, drawerId) {
  const btn = document.getElementById(btnId);
  const drawer = document.getElementById(drawerId);
  if (!btn || !drawer) return;

  btn.addEventListener('click', () => {
    const isOpen = drawer.classList.contains('open');
    if (isOpen) {
      drawer.classList.remove('open');
      btn.innerHTML = btn.innerHTML.replace('Hide', 'Compare').replace('chevron-up', 'book-open');
    } else {
      drawer.classList.add('open');
      btn.innerHTML = btn.innerHTML.replace('Compare', 'Hide').replace('book-open', 'chevron-up');
    }
    if (window.lucide) window.lucide.createIcons();
  });
}

/**
 * Initialize Preprocessing Tab State & Diagnostics
 */
window.initPreprocessingTab = function () {
  const data = window.AppState.rawData;
  if (!data || data.length === 0) return;

  if (!window.AppState.preprocessing || !window.AppState.preprocessing.config || typeof window.AppState.preprocessing.config.missingValues !== 'object') {
    initPrepState();
  }

  // 1. Run Diagnostics Scan
  detectDatasetAnomalies();
  updateAnomalyUI();
  populateDiagnosticsTable();

  // 2. Populate Dynamic Contexts & Strategy Impact Cards for all Steps
  populateStep2DuplicatesPreview();
  renderStep2StrategyImpact(document.getElementById('duplicateStrategySelect')?.value || 'first');

  populateStep3MissingPreview();
  renderStep3StrategyImpact(document.getElementById('missingStrategySelect')?.value || 'smart');

  populateStep4OutliersPreview();
  renderStep4StrategyImpact(document.getElementById('outlierStrategySelect')?.value || 'winsorize');

  populateStep5AttributesPreview();
  renderStep5StrategyImpact(document.getElementById('textSanitizeSelect')?.value || 'trim_case');

  // 3. Render Stepper and active step
  renderStepperRibbon();
  const activeStep = window.AppState.preprocessing.currentStep || 1;
  goToPrepStep(activeStep, false);
};


/**
 * Unlock next step and navigate to it
 */
function unlockAndGoToStep(nextStep) {
  const prep = window.AppState.preprocessing;
  prep.maxUnlockedStep = Math.max(prep.maxUnlockedStep, nextStep);
  goToPrepStep(nextStep, false);
}

/**
 * Navigate to a specific step with strict progression enforcement
 */
function goToPrepStep(targetStep, enforceLock = true) {
  const prep = window.AppState.preprocessing;
  if (!prep) return;

  // STRICT GATING ENFORCEMENT:
  // Cannot jump ahead to a step beyond what has been completed / skipped!
  if (enforceLock && targetStep > prep.maxUnlockedStep) {
    showToast(`🔒 Step Locked: Please complete or skip Step ${prep.currentStep} first before advancing`, 'error');
    const currentBtn = document.getElementById(`stepBtn${prep.currentStep}`);
    if (currentBtn) {
      currentBtn.classList.add('pulse');
      setTimeout(() => currentBtn.classList.remove('pulse'), 600);
    }
    return false;
  }

  prep.currentStep = targetStep;

  // Show only target step pane
  for (let i = 1; i <= 6; i++) {
    const pane = document.getElementById(`prepStep${i}`);
    if (pane) {
      if (i === targetStep) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    }
  }

  // Update Stepper Ribbon Nav
  renderStepperRibbon();

  // If reaching Step 6, automatically execute the configured pipeline and render review
  if (targetStep === 6) {
    executeConfiguredPipeline();
  }

  // Refresh icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  return true;
}

/**
 * Reset Walkthrough back to Step 1
 */
function resetPreprocessingWalkthrough() {
  initPrepState();
  showToast('Walkthrough reset to Step 1 (Quality Diagnostics)', 'info');
  window.initPreprocessingTab();
}

/**
 * Render Stepper Ribbon UI state, progress bar, and badges
 */
function renderStepperRibbon() {
  const prep = window.AppState.preprocessing;
  if (!prep) return;

  const current = prep.currentStep;
  const maxUnlocked = prep.maxUnlockedStep;
  const decisions = prep.stepDecisions;

  // Update progress percentage
  const percent = Math.round((current / 6) * 100);
  const fill = document.getElementById('prepProgressFill');
  const percentLabel = document.getElementById('prepProgressPercent');

  if (fill) fill.style.width = `${percent}%`;
  if (percentLabel) percentLabel.textContent = `Step ${current} of 6 • ${percent}% Complete`;

  // Update each button in stepper
  for (let i = 1; i <= 6; i++) {
    const btn = document.getElementById(`stepBtn${i}`);
    const badge = document.getElementById(`stepBadge${i}`);
    const iconWrap = document.getElementById(`stepIcon${i}`);

    if (!btn || !badge || !iconWrap) continue;

    btn.classList.remove('active', 'completed', 'skipped', 'locked');
    badge.className = 'prep-step-badge';

    const decision = decisions[i] || { status: 'pending' };

    if (i === current) {
      btn.classList.add('active');
      badge.classList.add('in-progress');
      badge.textContent = 'Active';
      iconWrap.innerHTML = getStepDefaultIcon(i);
    } else if (i < current || (decision.status === 'applied' || decision.status === 'skipped')) {
      if (decision.status === 'applied') {
        btn.classList.add('completed');
        badge.classList.add('applied');
        badge.textContent = 'Applied';
        iconWrap.innerHTML = '<i data-lucide="check-circle" style="width: 15px; height: 15px;"></i>';
      } else if (decision.status === 'skipped') {
        btn.classList.add('skipped');
        badge.classList.add('skipped');
        badge.textContent = 'Skipped';
        iconWrap.innerHTML = '<i data-lucide="skip-forward" style="width: 15px; height: 15px;"></i>';
      } else {
        btn.classList.add('completed');
        badge.classList.add('pending');
        badge.textContent = 'Visited';
        iconWrap.innerHTML = getStepDefaultIcon(i);
      }
    } else if (i <= maxUnlocked) {
      badge.classList.add('pending');
      badge.textContent = 'Unlocked';
      iconWrap.innerHTML = getStepDefaultIcon(i);
    } else {
      btn.classList.add('locked');
      badge.classList.add('locked');
      badge.textContent = 'Locked';
      iconWrap.innerHTML = '<i data-lucide="lock" style="width: 15px; height: 15px;"></i>';
    }
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function getStepDefaultIcon(stepNum) {
  const icons = {
    1: '<i data-lucide="activity" style="width: 15px; height: 15px;"></i>',
    2: '<i data-lucide="copy" style="width: 15px; height: 15px;"></i>',
    3: '<i data-lucide="help-circle" style="width: 15px; height: 15px;"></i>',
    4: '<i data-lucide="alert-triangle" style="width: 15px; height: 15px;"></i>',
    5: '<i data-lucide="type" style="width: 15px; height: 15px;"></i>',
    6: '<i data-lucide="check-circle-2" style="width: 15px; height: 15px;"></i>'
  };
  return icons[stepNum] || '<i data-lucide="circle" style="width: 15px; height: 15px;"></i>';
}

/**
 * Render Dynamic Strategy Impact Cards for Step 2, 3, 4, 5
 */
function renderStep2StrategyImpact(strategyKey) {
  const container = document.getElementById('step2StrategyImpact');
  const impact = STRATEGY_IMPACTS.deduplication[strategyKey];
  if (!container || !impact) return;

  const dupCount = window.AppState.anomalies?.duplicateCount || 0;
  const rawCount = window.AppState.rawData?.length || 0;
  const postCount = strategyKey === 'none' ? rawCount : rawCount - dupCount;

  container.innerHTML = `
    <div class="strategy-impact-header">
      <div class="strategy-impact-title">
        <i data-lucide="sparkles" style="color: var(--secondary);"></i>
        <span>Selected Method: ${escapeHTML(impact.title)}</span>
      </div>
      <span class="type-badge ${impact.badgeClass}">${escapeHTML(impact.type)}</span>
    </div>
    <div class="strategy-impact-grid">
      <div class="strategy-impact-col mechanism">
        <h6><i data-lucide="cpu"></i> Algorithm Mechanism</h6>
        <p>${escapeHTML(impact.mechanism)}</p>
      </div>
      <div class="strategy-impact-col bestfor">
        <h6><i data-lucide="target"></i> Best Used When</h6>
        <p>${escapeHTML(impact.bestFor)}</p>
      </div>
      <div class="strategy-impact-col impact">
        <h6><i data-lucide="bar-chart-2"></i> Statistical Dataset Impact</h6>
        <p>${escapeHTML(impact.datasetImpact)} <br><strong style="color: var(--text-main);">Projected Records:</strong> ${rawCount.toLocaleString()} → <span style="color: var(--primary-light); font-weight:700;">${postCount.toLocaleString()} rows</span></p>
      </div>
      <div class="strategy-impact-col risks">
        <h6><i data-lucide="alert-circle"></i> Potential Downstream Risks</h6>
        <p>${escapeHTML(impact.risks)}</p>
      </div>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
}

function renderStep3StrategyImpact(strategyKey) {
  const container = document.getElementById('step3StrategyImpact');
  const impact = STRATEGY_IMPACTS.missingValues[strategyKey];
  if (!container || !impact) return;

  const rawCount = window.AppState.rawData?.length || 0;
  const missingTotal = window.AppState.anomalies?.missingCount || 0;

  // Calculate estimated rows if dropping
  let estimatedPostRows = rawCount;
  if (strategyKey === 'drop') {
    const raw = window.AppState.rawData || [];
    const validRows = raw.filter(row => Object.values(row).every(v => v !== null && v !== undefined && String(v).trim() !== ''));
    estimatedPostRows = validRows.length;
  }

  container.innerHTML = `
    <div class="strategy-impact-header">
      <div class="strategy-impact-title">
        <i data-lucide="sparkles" style="color: var(--secondary);"></i>
        <span>Selected Method: ${escapeHTML(impact.title)}</span>
      </div>
      <span class="type-badge ${impact.badgeClass}">${escapeHTML(impact.type)}</span>
    </div>
    <div class="strategy-impact-grid">
      <div class="strategy-impact-col mechanism">
        <h6><i data-lucide="cpu"></i> Algorithm Mechanism</h6>
        <p>${escapeHTML(impact.mechanism)}</p>
      </div>
      <div class="strategy-impact-col bestfor">
        <h6><i data-lucide="target"></i> Best Used When</h6>
        <p>${escapeHTML(impact.bestFor)}</p>
      </div>
      <div class="strategy-impact-col impact">
        <h6><i data-lucide="bar-chart-2"></i> Statistical Dataset Impact</h6>
        <p>${escapeHTML(impact.datasetImpact)} <br><strong style="color: var(--text-main);">Projected Records:</strong> ${rawCount.toLocaleString()} → <span style="color: var(--primary-light); font-weight:700;">${estimatedPostRows.toLocaleString()} rows</span> (${strategyKey === 'drop' ? `${rawCount - estimatedPostRows} rows dropped` : `${missingTotal} null cells imputed`})</p>
      </div>
      <div class="strategy-impact-col risks">
        <h6><i data-lucide="alert-circle"></i> Potential Downstream Risks</h6>
        <p>${escapeHTML(impact.risks)}</p>
      </div>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
}

function renderStep4StrategyImpact(strategyKey) {
  const container = document.getElementById('step4StrategyImpact');
  const impact = STRATEGY_IMPACTS.outliers[strategyKey];
  if (!container || !impact) return;

  const rawCount = window.AppState.rawData?.length || 0;
  const outlierTotal = window.AppState.anomalies?.outlierCount || 0;

  container.innerHTML = `
    <div class="strategy-impact-header">
      <div class="strategy-impact-title">
        <i data-lucide="sparkles" style="color: var(--secondary);"></i>
        <span>Selected Method: ${escapeHTML(impact.title)}</span>
      </div>
      <span class="type-badge ${impact.badgeClass}">${escapeHTML(impact.type)}</span>
    </div>
    <div class="strategy-impact-grid">
      <div class="strategy-impact-col mechanism">
        <h6><i data-lucide="cpu"></i> Algorithm Mechanism</h6>
        <p>${escapeHTML(impact.mechanism)}</p>
      </div>
      <div class="strategy-impact-col bestfor">
        <h6><i data-lucide="target"></i> Best Used When</h6>
        <p>${escapeHTML(impact.bestFor)}</p>
      </div>
      <div class="strategy-impact-col impact">
        <h6><i data-lucide="bar-chart-2"></i> Statistical Dataset Impact</h6>
        <p>${escapeHTML(impact.datasetImpact)} <br><strong style="color: var(--text-main);">Outlier Management:</strong> ${outlierTotal} points identified (${strategyKey === 'winsorize' ? 'Capped at P05/P95' : (strategyKey.includes('remove') ? 'Rows filtered' : 'Preserved as-is')})</p>
      </div>
      <div class="strategy-impact-col risks">
        <h6><i data-lucide="alert-circle"></i> Potential Downstream Risks</h6>
        <p>${escapeHTML(impact.risks)}</p>
      </div>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
}

function renderStep5StrategyImpact(strategyKey) {
  const container = document.getElementById('step5StrategyImpact');
  const impact = STRATEGY_IMPACTS.textSanitize[strategyKey];
  if (!container || !impact) return;

  container.innerHTML = `
    <div class="strategy-impact-header">
      <div class="strategy-impact-title">
        <i data-lucide="sparkles" style="color: var(--secondary);"></i>
        <span>Selected Method: ${escapeHTML(impact.title)}</span>
      </div>
      <span class="type-badge ${impact.badgeClass}">${escapeHTML(impact.type)}</span>
    </div>
    <div class="strategy-impact-grid">
      <div class="strategy-impact-col mechanism">
        <h6><i data-lucide="cpu"></i> Algorithm Mechanism</h6>
        <p>${escapeHTML(impact.mechanism)}</p>
      </div>
      <div class="strategy-impact-col bestfor">
        <h6><i data-lucide="target"></i> Best Used When</h6>
        <p>${escapeHTML(impact.bestFor)}</p>
      </div>
      <div class="strategy-impact-col impact">
        <h6><i data-lucide="bar-chart-2"></i> Statistical Dataset Impact</h6>
        <p>${escapeHTML(impact.datasetImpact)}</p>
      </div>
      <div class="strategy-impact-col risks">
        <h6><i data-lucide="alert-circle"></i> Potential Downstream Risks</h6>
        <p>${escapeHTML(impact.risks)}</p>
      </div>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
}

/**
 * Detect Data Quality Anomalies (Missing, Duplicates, Outliers, Constant Columns)
 */
function detectDatasetAnomalies() {
  const data = window.AppState.rawData;
  const colInfo = window.AppState.columnInfo;
  const columns = window.AppState.columnNames;

  let totalMissing = 0;
  let totalOutliers = 0;
  const constantCols = [];
  const colAnomalies = {};

  columns.forEach(col => {
    const info = colInfo[col];
    if (!info) return;

    colAnomalies[col] = {
      missing: info.missingCount,
      outliers: 0,
      isConstant: false,
      issues: []
    };

    totalMissing += info.missingCount;
    if (info.missingCount > 0) {
      const pct = info.missingPct || info.missingPercent || ((info.missingCount / data.length) * 100).toFixed(1);
      colAnomalies[col].issues.push(`${info.missingCount} Nulls (${pct}%)`);
    }

    if (info.type === 'numeric') {
      const nums = data.map(r => parseNumeric(r[col])).filter(n => !isNaN(n));
      if (nums.length >= 4) {
        const sorted = [...nums].sort((a, b) => a - b);
        const q1 = sorted[Math.floor(sorted.length * 0.25)];
        const q3 = sorted[Math.floor(sorted.length * 0.75)];
        const iqr = q3 - q1;
        const lower = q1 - 1.5 * iqr;
        const upper = q3 + 1.5 * iqr;

        const outlierRows = nums.filter(n => n < lower || n > upper);
        totalOutliers += outlierRows.length;
        colAnomalies[col].outliers = outlierRows.length;
        if (outlierRows.length > 0) {
          colAnomalies[col].issues.push(`${outlierRows.length} Outliers`);
        }
      }
    }

    if (info.uniqueCount <= 1 && data.length > 1) {
      constantCols.push(col);
      colAnomalies[col].isConstant = true;
      colAnomalies[col].issues.push('Zero Variance (Constant)');
    }
  });

  const duplicateCount = calculateDuplicates(data);

  window.AppState.anomalies = {
    missingCount: totalMissing,
    duplicateCount: duplicateCount,
    outlierCount: totalOutliers,
    constantCols: constantCols,
    colAnomalies: colAnomalies
  };

  // Health Score Calculation (0-100%)
  const totalCells = data.length * columns.length;
  const flawPenalties = (totalMissing * 1.5) + (duplicateCount * columns.length * 1.2) + (totalOutliers * 0.8);
  const healthRatio = Math.max(0, 1 - (flawPenalties / Math.max(1, totalCells)));
  window.AppState.healthScore = Math.round(healthRatio * 100);
}

/**
 * Update Health Gauge and Summary Counters in UI
 */
function updateAnomalyUI() {
  const anomalies = window.AppState.anomalies;
  const score = window.AppState.healthScore;

  setText('prepMissingCount', anomalies.missingCount.toLocaleString());
  setText('prepDuplicateCount', anomalies.duplicateCount.toLocaleString());
  setText('prepOutlierCount', anomalies.outlierCount.toLocaleString());
  setText('prepConstantColsCount', anomalies.constantCols.length.toString());

  const circle = document.getElementById('healthGaugeCircle');
  const scoreVal = document.getElementById('healthScoreValue');
  const narrative = document.getElementById('healthScoreNarrative');

  if (circle && scoreVal && narrative) {
    scoreVal.textContent = `${score}%`;
    circle.className = `health-circle ${score >= 85 ? 'good' : (score >= 65 ? 'warning' : 'danger')}`;

    if (score >= 90) {
      narrative.textContent = 'Excellent data quality detected. Minimal missing records or structural inconsistencies found.';
    } else if (score >= 70) {
      narrative.textContent = 'Moderate anomalies detected: Missing values and duplicate rows require cleaning prior to modeling.';
    } else {
      narrative.textContent = 'Substantial anomalies identified: Significant missing values and extreme statistical outliers require automated cleansing.';
    }
  }
}

/**
 * Step 1: Populate Column Diagnostic Matrix Table
 */
function populateDiagnosticsTable() {
  const tbody = document.getElementById('diagAttributesTableBody');
  const columns = window.AppState.columnNames;
  const colInfo = window.AppState.columnInfo;
  const colAnomalies = window.AppState.anomalies?.colAnomalies || {};

  if (!tbody || !columns) return;

  tbody.innerHTML = columns.map(col => {
    const info = colInfo[col] || {};
    const anomaly = colAnomalies[col] || { issues: [] };
    const type = info.type || 'text';
    const missing = info.missingCount || 0;
    const missingPct = info.missingPercent || 0;
    const unique = info.uniqueCount || 0;

    let statusHtml = '';
    if (anomaly.issues.length === 0) {
      statusHtml = `<span class="issue-tag clean"><i data-lucide="check" style="width:12px;height:12px;"></i> Clean</span>`;
    } else {
      statusHtml = anomaly.issues.map(iss => {
        const isDanger = iss.includes('Nulls') || iss.includes('Constant');
        return `<span class="issue-tag ${isDanger ? 'danger' : 'warn'}">${escapeHTML(iss)}</span>`;
      }).join(' ');
    }

    return `
      <tr>
        <td style="font-weight: 700; color: var(--text-main);">${escapeHTML(col)}</td>
        <td><span class="type-badge ${type}">${type}</span></td>
        <td style="${missing > 0 ? 'color: var(--accent-amber); font-weight: 700;' : ''}">${missing.toLocaleString()}</td>
        <td>${missingPct}%</td>
        <td>${unique.toLocaleString()}</td>
        <td>${statusHtml}</td>
      </tr>
    `;
  }).join('');
}

/**
 * Step 2: Populate Deduplication Preview & Context Alert
 */
function populateStep2DuplicatesPreview() {
  const rawData = window.AppState.rawData;
  const dupCount = window.AppState.anomalies?.duplicateCount || 0;
  const alert = document.getElementById('step2ImpactAlert');
  const alertText = document.getElementById('step2ImpactText');
  const alertBadge = document.getElementById('step2ImpactBadge');
  const previewWrap = document.getElementById('step2PreviewWrap');
  const headEl = document.getElementById('step2DupHead');
  const bodyEl = document.getElementById('step2DupBody');

  if (!alert || !alertText) return;

  if (dupCount > 0) {
    alert.className = 'prep-impact-alert warning';
    const pct = ((dupCount / Math.max(1, rawData.length)) * 100).toFixed(1);
    alertText.innerHTML = `<strong>Action Recommended:</strong> Found <strong>${dupCount} duplicate rows</strong> (${pct}% of dataset). Deduplication will remove these redundant records.`;
    if (alertBadge) {
      alertBadge.className = 'prep-step-badge in-progress';
      alertBadge.textContent = `${dupCount} Duplicates`;
    }

    if (previewWrap && headEl && bodyEl) {
      previewWrap.style.display = 'block';
      const cols = window.AppState.columnNames.slice(0, 6);
      headEl.innerHTML = '<th>#</th>' + cols.map(c => `<th>${escapeHTML(c)}</th>`).join('');

      // Find duplicate sample rows
      const seen = new Set();
      const dupRows = [];
      rawData.forEach(row => {
        const k = JSON.stringify(row);
        if (seen.has(k)) dupRows.push(row);
        else seen.add(k);
      });

      bodyEl.innerHTML = dupRows.slice(0, 5).map((row, idx) => {
        const cells = cols.map(c => `<td>${escapeHTML(row[c])}</td>`).join('');
        return `<tr><td style="color: var(--accent-rose); font-weight:700;">Dup ${idx + 1}</td>${cells}</tr>`;
      }).join('');
    }
  } else {
    alert.className = 'prep-impact-alert success';
    alertText.innerHTML = `<strong>Pristine:</strong> Zero duplicate rows detected in your dataset! You can safely proceed or skip this step.`;
    if (alertBadge) {
      alertBadge.className = 'prep-step-badge applied';
      alertBadge.textContent = '0 Duplicates';
    }
    if (previewWrap) previewWrap.style.display = 'none';
  }
}

/**
 * Step 3: Populate Missing Values Preview & Breakdown
 */
function populateStep3MissingPreview() {
  const missingTotal = window.AppState.anomalies?.missingCount || 0;
  const colInfo = window.AppState.columnInfo;
  const columns = window.AppState.columnNames;
  const alert = document.getElementById('step3ImpactAlert');
  const alertText = document.getElementById('step3ImpactText');
  const alertBadge = document.getElementById('step3ImpactBadge');
  const breakdownWrap = document.getElementById('step3MissingBreakdown');

  if (!alert || !alertText) return;

  const affectedCols = columns.filter(c => (colInfo[c]?.missingCount || 0) > 0);

  if (missingTotal > 0) {
    alert.className = 'prep-impact-alert warning';
    alertText.innerHTML = `<strong>Attention Required:</strong> Found <strong>${missingTotal} missing values</strong> across <strong>${affectedCols.length} attributes</strong>. Smart imputation will replace them seamlessly.`;
    if (alertBadge) {
      alertBadge.className = 'prep-step-badge in-progress';
      alertBadge.textContent = `${missingTotal} Nulls`;
    }

    if (breakdownWrap) {
      breakdownWrap.innerHTML = affectedCols.map(col => {
        const info = colInfo[col];
        const type = info.type;
        const suggested = type === 'numeric' ? 'Median (Auto-Calculated)' : 'Mode (Most Frequent Category)';
        return `
          <div style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <strong style="color: var(--text-main); font-size: 0.86rem;">${escapeHTML(col)}</strong>
              <span class="type-badge ${type}">${type}</span>
            </div>
            <div style="font-size: 0.78rem; color: var(--accent-amber); font-weight: 700; margin-bottom: 4px;">
              ${info.missingCount} null cells (${info.missingPct || info.missingPercent || 0}%)
            </div>
            <div style="font-size: 0.74rem; color: var(--text-dim);">
              Smart Impute: <span style="color: var(--text-main); font-weight: 600;">${suggested}</span>
            </div>
          </div>
        `;
      }).join('');
    }
  } else {
    alert.className = 'prep-impact-alert success';
    alertText.innerHTML = `<strong>Complete Dataset:</strong> Zero missing values detected across all attributes! Every record is 100% complete.`;
    if (alertBadge) {
      alertBadge.className = 'prep-step-badge applied';
      alertBadge.textContent = '0 Nulls';
    }
    if (breakdownWrap) {
      breakdownWrap.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 14px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: var(--radius-sm); color: var(--accent-emerald); font-size: 0.85rem;">
          <i data-lucide="check-circle" style="width:16px;height:16px;vertical-align:middle;margin-right:6px;"></i> All columns are complete with 0 missing cells.
        </div>
      `;
    }
  }
}

/**
 * Step 4: Populate Outliers Preview & Breakdown
 */
function populateStep4OutliersPreview() {
  const totalOutliers = window.AppState.anomalies?.outlierCount || 0;
  const colInfo = window.AppState.columnInfo;
  const columns = window.AppState.columnNames;
  const colAnomalies = window.AppState.anomalies?.colAnomalies || {};
  const alert = document.getElementById('step4ImpactAlert');
  const alertText = document.getElementById('step4ImpactText');
  const alertBadge = document.getElementById('step4ImpactBadge');
  const breakdownWrap = document.getElementById('step4OutlierBreakdown');

  if (!alert || !alertText) return;

  const numericCols = columns.filter(c => colInfo[c]?.type === 'numeric');

  if (totalOutliers > 0) {
    alert.className = 'prep-impact-alert warning';
    alertText.innerHTML = `<strong>Distortion Risk:</strong> Detected <strong>${totalOutliers} statistical outlier points</strong> beyond the 1.5x IQR boundary. Winsorization (capping) is recommended to prevent metric distortion.`;
    if (alertBadge) {
      alertBadge.className = 'prep-step-badge in-progress';
      alertBadge.textContent = `${totalOutliers} Outliers`;
    }

    if (breakdownWrap) {
      breakdownWrap.innerHTML = numericCols.map(col => {
        const outCount = colAnomalies[col]?.outliers || 0;
        const info = colInfo[col];
        return `
          <div style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <strong style="color: var(--text-main); font-size: 0.86rem;">${escapeHTML(col)}</strong>
              <span class="type-badge numeric">Numeric</span>
            </div>
            <div style="font-size: 0.78rem; color: ${outCount > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)'}; font-weight: 700; margin-bottom: 4px;">
              ${outCount > 0 ? `${outCount} Outliers Detected` : 'No Extreme Outliers'}
            </div>
            <div style="font-size: 0.74rem; color: var(--text-dim);">
              Range: [${info.min ?? 'N/A'} to ${info.max ?? 'N/A'}] • Mean: ${info.mean ?? 'N/A'}
            </div>
          </div>
        `;
      }).join('');
    }
  } else {
    alert.className = 'prep-impact-alert success';
    alertText.innerHTML = `<strong>Normal Distribution:</strong> No severe statistical anomalies detected across numeric attributes.`;
    if (alertBadge) {
      alertBadge.className = 'prep-step-badge applied';
      alertBadge.textContent = '0 Outliers';
    }
    if (breakdownWrap) {
      breakdownWrap.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 14px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: var(--radius-sm); color: var(--accent-emerald); font-size: 0.85rem;">
          <i data-lucide="check-circle" style="width:16px;height:16px;vertical-align:middle;margin-right:6px;"></i> All numeric attributes are within standard IQR boundaries.
        </div>
      `;
    }
  }
}

/**
 * Step 5: Populate Text Sanitization Attributes List
 */
function populateStep5AttributesPreview() {
  const colInfo = window.AppState.columnInfo;
  const columns = window.AppState.columnNames;
  const alert = document.getElementById('step5ImpactAlert');
  const alertText = document.getElementById('step5ImpactText');
  const alertBadge = document.getElementById('step5ImpactBadge');
  const listWrap = document.getElementById('step5AttributesList');

  if (!alert || !alertText) return;

  const catCols = columns.filter(c => colInfo[c]?.type === 'categorical' || colInfo[c]?.type === 'boolean');

  alert.className = 'prep-impact-alert info';
  alertText.innerHTML = `Found <strong>${catCols.length} text & boolean dimensions</strong> available for whitespace stripping and title casing.`;
  if (alertBadge) {
    alertBadge.className = 'prep-step-badge in-progress';
    alertBadge.textContent = `${catCols.length} Columns`;
  }

  if (listWrap) {
    listWrap.innerHTML = catCols.map(col => {
      const type = colInfo[col]?.type;
      return `
        <div style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 20px; padding: 5px 14px; display: inline-flex; align-items: center; gap: 8px; font-size: 0.78rem;">
          <strong style="color: var(--text-main);">${escapeHTML(col)}</strong>
          <span class="type-badge ${type}">${type}</span>
        </div>
      `;
    }).join('');
  }
}

/**
 * Main Pipeline Execution Engine: Applies configured choices and logs skips
 */
function executeConfiguredPipeline() {
  const raw = window.AppState.rawData;
  if (!raw || raw.length === 0) return;

  const config = window.AppState.preprocessing.config;
  const logs = [];
  const addLog = (msg, type = 'info') => {
    logs.push({ message: msg, type });
  };

  addLog(`Starting preprocessing pipeline on ${raw.length.toLocaleString()} raw records across ${window.AppState.columnNames.length} attributes...`, 'info');

  // Deep clone data
  let cleaned = JSON.parse(JSON.stringify(raw));
  const columns = window.AppState.columnNames;
  const colInfo = window.AppState.columnInfo;

  // 1. DEDUPLICATION
  if (config.deduplication.enabled && !config.deduplication.skipped && config.deduplication.strategy !== 'none') {
    const strategy = config.deduplication.strategy;
    const initialCount = cleaned.length;
    const seen = new Set();
    const uniqueRows = [];

    if (strategy === 'first') {
      cleaned.forEach(row => {
        const key = JSON.stringify(row);
        if (!seen.has(key)) {
          seen.add(key);
          uniqueRows.push(row);
        }
      });
    } else {
      for (let i = cleaned.length - 1; i >= 0; i--) {
        const key = JSON.stringify(cleaned[i]);
        if (!seen.has(key)) {
          seen.add(key);
          uniqueRows.unshift(cleaned[i]);
        }
      }
    }

    const dupsRemoved = initialCount - uniqueRows.length;
    cleaned = uniqueRows;
    if (dupsRemoved > 0) {
      addLog(`✓ Deduplication (Applied): Removed ${dupsRemoved} redundant duplicate records (${strategy} occurrence retained).`, 'success');
    } else {
      addLog(`✓ Deduplication (Applied): Zero duplicate records found in dataset.`, 'info');
    }
  } else {
    addLog(`⊘ Deduplication (Skipped): Redundant records retained as requested.`, 'warning');
  }

  // 2. MISSING VALUE IMPUTATION
  if (config.missingValues.enabled && !config.missingValues.skipped) {
    const strategy = config.missingValues.strategy;
    let missingImputed = 0;
    let rowsDropped = 0;

    if (strategy === 'drop') {
      const initialCount = cleaned.length;
      cleaned = cleaned.filter(row => {
        return Object.values(row).every(v => v !== null && v !== undefined && String(v).trim() !== '');
      });
      rowsDropped = initialCount - cleaned.length;
      addLog(`✓ Missing Values (Applied - Drop): Removed ${rowsDropped} incomplete rows containing null cells.`, 'warning');
    } else {
      columns.forEach(col => {
        const type = colInfo[col]?.type;
        const validValues = cleaned.map(r => r[col]).filter(v => v !== null && v !== undefined && String(v).trim() !== '');

        if (type === 'numeric') {
          const nums = validValues.map(v => parseNumeric(v)).filter(n => !isNaN(n));
          let replacement = 0;

          if (nums.length > 0) {
            const sorted = [...nums].sort((a, b) => a - b);
            if (strategy === 'mean') {
              replacement = Number((sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(2));
            } else if (strategy === 'median' || strategy === 'smart') {
              replacement = Number(sorted[Math.floor(sorted.length / 2)].toFixed(2));
            } else if (strategy === 'constant') {
              replacement = 0;
            }
          }

          cleaned.forEach(row => {
            if (row[col] === null || row[col] === undefined || String(row[col]).trim() === '') {
              row[col] = replacement;
              missingImputed++;
            } else {
              row[col] = parseNumeric(row[col]);
            }
          });
        } else {
          let modeVal = 'Unknown';
          if (validValues.length > 0) {
            const freq = {};
            validValues.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
            const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
            modeVal = sorted[0] ? sorted[0][0] : 'Unknown';
          }
          if (strategy === 'constant') modeVal = 'Unknown';

          cleaned.forEach(row => {
            if (row[col] === null || row[col] === undefined || String(row[col]).trim() === '') {
              row[col] = modeVal;
              missingImputed++;
            }
          });
        }
      });

      if (missingImputed > 0) {
        addLog(`✓ Missing Values (Applied - ${strategy}): Imputed ${missingImputed} empty cells successfully.`, 'success');
      } else {
        addLog(`✓ Missing Values (Applied): Dataset is 100% complete, no nulls required imputation.`, 'info');
      }
    }
  } else {
    addLog(`⊘ Missing Values (Skipped): Null/empty cells retained untouched.`, 'warning');
  }

  // 3. OUTLIER TREATMENT
  if (config.outliers.enabled && !config.outliers.skipped && config.outliers.strategy !== 'keep') {
    const strategy = config.outliers.strategy;
    const numericCols = columns.filter(c => colInfo[c]?.type === 'numeric');
    let outliersModified = 0;

    if (strategy === 'winsorize') {
      numericCols.forEach(col => {
        const nums = cleaned.map(r => Number(r[col])).filter(n => !isNaN(n));
        if (nums.length >= 6) {
          const sorted = [...nums].sort((a, b) => a - b);
          const p05 = sorted[Math.floor(sorted.length * 0.05)];
          const p95 = sorted[Math.floor(sorted.length * 0.95)];

          cleaned.forEach(row => {
            const val = Number(row[col]);
            if (!isNaN(val)) {
              if (val < p05) {
                row[col] = p05;
                outliersModified++;
              } else if (val > p95) {
                row[col] = p95;
                outliersModified++;
              }
            }
          });
        }
      });
      if (outliersModified > 0) {
        addLog(`✓ Outliers (Applied - Winsorization): Capped ${outliersModified} extreme values to 5th & 95th percentiles.`, 'success');
      } else {
        addLog(`✓ Outliers (Applied): No extreme outlier spikes required capping.`, 'info');
      }
    } else if (strategy === 'remove_iqr') {
      const initialCount = cleaned.length;
      cleaned = cleaned.filter(row => {
        return numericCols.every(col => {
          const nums = cleaned.map(r => Number(r[col])).filter(n => !isNaN(n));
          if (nums.length < 4) return true;
          const sorted = [...nums].sort((a, b) => a - b);
          const q1 = sorted[Math.floor(sorted.length * 0.25)];
          const q3 = sorted[Math.floor(sorted.length * 0.75)];
          const iqr = q3 - q1;
          const val = Number(row[col]);
          return isNaN(val) || (val >= q1 - 1.5 * iqr && val <= q3 + 1.5 * iqr);
        });
      });
      outliersModified = initialCount - cleaned.length;
      addLog(`✓ Outliers (Applied - IQR Filter): Filtered ${outliersModified} outlier records.`, 'warning');
    }
  } else {
    addLog(`⊘ Outliers (Skipped): Extreme statistical distributions retained untouched.`, 'warning');
  }

  // 4. TEXT SANITIZATION & BOOLEANS
  if (config.textSanitize.enabled && !config.textSanitize.skipped) {
    const strategy = config.textSanitize.strategy;
    const chkBooleans = config.textSanitize.sanitizeBooleans;

    cleaned.forEach(row => {
      columns.forEach(col => {
        const type = colInfo[col]?.type;
        if (type === 'categorical' && typeof row[col] === 'string') {
          let str = row[col].trim();
          if (strategy === 'trim_case') {
            str = str.replace(/\w\S*/g, (w) => (w.charAt(0).toUpperCase() + w.substr(1).toLowerCase()));
          } else if (strategy === 'lower') {
            str = str.toLowerCase();
          }
          row[col] = str;
        }

        if (chkBooleans && type === 'boolean') {
          const s = String(row[col]).trim().toLowerCase();
          if (['true', '1', 'yes', 'y'].includes(s)) row[col] = 'True';
          else if (['false', '0', 'no', 'n'].includes(s)) row[col] = 'False';
        }
      });
    });
    addLog(`✓ Text Sanitization (Applied): Whitespaces stripped, casing normalized (${strategy}).`, 'info');
  } else {
    addLog(`⊘ Text Sanitization (Skipped): Text and string categories preserved in raw format.`, 'warning');
  }

  addLog(`🎉 Preprocessing Pipeline Complete: ${cleaned.length.toLocaleString()} pristine records verified and ready for Visual Analysis.`, 'success');

  // Update Global Clean Data State
  window.AppState.cleanData = cleaned;
  window.AppState.isCleaned = true;
  window.AppState.cleaningLog = logs;
  window.AppState.preprocessing.stepDecisions[6] = {
    status: 'applied',
    label: 'Pipeline Verified',
    detail: `${cleaned.length.toLocaleString()} clean records ready`
  };

  // Render Step 6 Review UI
  renderStep6DecisionsGrid();
  renderAuditLogs(logs);
  window.AppState.cleanTablePage = 1;
  renderCleanTablePreview();
}

/**
 * Render Step 6 Decision Summary Cards
 */
function renderStep6DecisionsGrid() {
  const grid = document.getElementById('prepDecisionsGrid');
  const decisions = window.AppState.preprocessing?.stepDecisions;
  if (!grid || !decisions) return;

  const stepsMeta = [
    { num: 1, name: 'Data Health Diagnostics', icon: 'microscope' },
    { num: 2, name: 'Duplicate Deduplication', icon: 'copy' },
    { num: 3, name: 'Missing Value Imputation', icon: 'help-circle' },
    { num: 4, name: 'Outlier Anomalies Treatment', icon: 'alert-triangle' },
    { num: 5, name: 'Text & String Standardization', icon: 'type' }
  ];

  grid.innerHTML = stepsMeta.map(step => {
    const dec = decisions[step.num] || { status: 'pending', label: 'Pending', detail: 'No choice recorded' };
    const isApplied = dec.status === 'applied';
    const badgeClass = isApplied ? 'applied' : (dec.status === 'skipped' ? 'skipped' : 'pending');

    return `
      <div class="prep-decision-card">
        <div class="prep-decision-top">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="${step.icon}" style="width: 16px; height: 16px; color: var(--primary-light);"></i>
            <span class="prep-decision-title">Step 0${step.num}: ${step.name}</span>
          </div>
          <span class="prep-step-badge ${badgeClass}">${dec.label}</span>
        </div>
        <div class="prep-decision-desc">${escapeHTML(dec.detail)}</div>
      </div>
    `;
  }).join('');

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

/**
 * Render Audit Log Entries
 */
function renderAuditLogs(logs) {
  const container = document.getElementById('cleaningLogBox');
  if (!container) return;

  container.innerHTML = logs.map(log => {
    const iconName = log.type === 'success' ? 'check-circle' : (log.type === 'warning' ? 'alert-triangle' : 'info');
    return `
      <div class="log-entry ${log.type}">
        <i data-lucide="${iconName}" style="width: 14px; height: 14px; flex-shrink: 0;"></i>
        <span>${escapeHTML(log.message)}</span>
      </div>
    `;
  }).join('');

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

/**
 * Render Paginated Clean Table Preview
 */
function renderCleanTablePreview() {
  const tableHead = document.getElementById('cleanTableHead');
  const tableBody = document.getElementById('cleanTableBody');
  const data = window.AppState.cleanData;
  const columns = window.AppState.columnNames;

  if (!tableHead || !tableBody || !data || data.length === 0) return;

  // Header
  tableHead.innerHTML = `<th>#</th>` + columns.map(c => `<th>${escapeHTML(c)}</th>`).join('');

  // Pagination slice
  const pageSize = window.AppState.cleanTablePageSize || 10;
  const currentPage = window.AppState.cleanTablePage || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const pageRows = data.slice(startIndex, startIndex + pageSize);

  // Body
  tableBody.innerHTML = pageRows.map((row, idx) => {
    const rowNum = startIndex + idx + 1;
    const cells = columns.map(col => {
      const val = row[col];
      return `<td>${escapeHTML(val)}</td>`;
    }).join('');
    return `<tr><td style="color: var(--text-dim); font-weight: 700;">${rowNum}</td>${cells}</tr>`;
  }).join('');

  // Update Footer Pagination
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  setText('cleanTableCurrentPage', `Page ${currentPage} of ${totalPages}`);
  setText('cleanTablePaginationInfo', `Showing ${Math.min(startIndex + 1, data.length)}-${Math.min(startIndex + pageSize, data.length)} of ${data.length.toLocaleString()} cleaned rows`);
}

/**
 * Export Cleaned Dataset File (CSV or JSON)
 */
function exportCleanDataset(format) {
  const data = window.AppState.cleanData;
  if (!data || data.length === 0) {
    showToast('No clean dataset available to export.', 'error');
    return;
  }

  const baseName = window.AppState.fileName.replace(/\.[^/.]+$/, "") || 'dataset';
  const outFileName = `${baseName}_cleaned.${format}`;

  if (format === 'csv') {
    const csvContent = Papa.unparse(data);
    triggerDownload(csvContent, outFileName, 'text/csv;charset=utf-8;');
  } else if (format === 'json') {
    const jsonContent = JSON.stringify(data, null, 2);
    triggerDownload(jsonContent, outFileName, 'application/json;charset=utf-8;');
  }

  showToast(`Exported ${outFileName}`, 'success');
}

function triggerDownload(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getImputationLabel(strategy) {
  const labels = {
    smart: 'Smart Auto-Impute (Median for numeric, Mode for categorical)',
    median: 'Median Imputation',
    mean: 'Mean Imputation',
    mode: 'Mode Imputation',
    constant: 'Constant Value ("Unknown" / 0)',
    drop: 'Drop Incomplete Rows'
  };
  return labels[strategy] || strategy;
}

function getOutlierLabel(strategy) {
  const labels = {
    winsorize: 'Winsorization / 5th & 95th Percentile Capping',
    remove_iqr: '1.5x IQR Boundary Filter',
    remove_zscore: 'Z-Score > 3.0 Filter',
    keep: 'Retain Outliers'
  };
  return labels[strategy] || strategy;
}

function parseNumeric(val) {
  if (val === null || val === undefined || val === '') return NaN;
  return Number(String(val).replace(/,/g, '').replace(/[₹$€£%]/g, '').trim());
}

function calculateDuplicates(data) {
  const seen = new Set();
  let duplicates = 0;
  data.forEach(row => {
    const key = JSON.stringify(row);
    if (seen.has(key)) duplicates++;
    else seen.add(key);
  });
  return duplicates;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}