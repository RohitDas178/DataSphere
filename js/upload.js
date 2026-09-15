/**
 * ============================================================================
 * DATASPHERE ANALYTICS - UPLOAD MODULE (upload.js)
 * Multi-Format Parsing (CSV, TSV, Excel XLSX/XLS, JSON) & Demo Datasets
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  initFileUploadEvents();
  initDemoDatasets();
});

/**
 * Initialize File Upload Listeners & Drag-and-Drop (Single & Multi-File)
 */
function initFileUploadEvents() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const browseFileBtn = document.getElementById('browseFileBtn');

  if (browseFileBtn && fileInput) {
    browseFileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });
  }

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => {
      fileInput.click();
    });

    // Drag and drop events
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        handleMultipleFiles(Array.from(files));
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleMultipleFiles(Array.from(e.target.files));
        fileInput.value = ''; // Reset input to allow re-uploading same file if desired
      }
    });
  }
}

/**
 * Handle Multiple Files Simultaneously
 */
async function handleMultipleFiles(filesList) {
  if (!filesList || filesList.length === 0) return;

  const validExtensions = ['csv', 'tsv', 'xlsx', 'xls', 'json'];
  const validFiles = filesList.filter(file => {
    const ext = file.name.split('.').pop().toLowerCase();
    return validExtensions.includes(ext);
  });

  if (validFiles.length === 0) {
    showToast('No supported files found. Please upload CSV, TSV, Excel, or JSON.', 'error');
    return;
  }

  showToast(`Parsing ${validFiles.length} dataset${validFiles.length > 1 ? 's' : ''} in parallel...`, 'info');

  const parsePromises = validFiles.map(file => parseSingleFilePromise(file));
  const results = await Promise.allSettled(parsePromises);

  let successCount = 0;
  let firstDataset = null;
  const failureErrors = [];

  results.forEach((res, idx) => {
    const fname = validFiles[idx]?.name || `File ${idx + 1}`;
    if (res.status === 'fulfilled' && res.value && res.value.rawData && res.value.rawData.length > 0) {
      const dsObj = res.value;
      const isFirst = successCount === 0 && window.AppState.datasets.length === 0;
      const addedDs = window.addDatasetToWorkspace(dsObj, isFirst);
      if (!firstDataset) firstDataset = addedDs;
      successCount++;
    } else {
      const errMsg = res.reason?.message || 'Invalid format or empty file';
      console.error(`Failed to parse file ${fname}:`, res.reason);
      failureErrors.push(`"${fname}": ${errMsg}`);
    }
  });

  if (successCount > 0) {
    window.renderMultiDatasetRibbon();
    window.renderRelationalJoinStudio();

    if (successCount === 1) {
      showToast(`Loaded "${firstDataset.fileName}" into workspace (${firstDataset.rawData.length.toLocaleString()} rows)`, 'success');
    } else {
      showToast(`Successfully loaded ${successCount} datasets simultaneously into analytical workspace!`, 'success');
    }

    if (failureErrors.length > 0) {
      setTimeout(() => {
        showToast(`Warning: Failed to load ${failureErrors.length} file(s): ${failureErrors.join('; ')}`, 'warning');
      }, 1200);
    }
  } else {
    const errorDetails = failureErrors.length > 0 ? failureErrors.join(' | ') : 'Please check file formatting.';
    showToast(`Failed to parse uploaded files: ${errorDetails}`, 'error');
  }
}

/**
 * Asynchronous Promise-Based Universal Parser for a Single File
 * Supports all encodings (UTF-8, Latin-1, Windows-1252, ISO-8859-1, UTF-16),
 * multi-delimiter auto-detection, NDJSON, multi-sheet Excel, and standalone fallback parser.
 */
function parseSingleFilePromise(file) {
  return new Promise((resolve, reject) => {
    const fileName = file.name;
    const extension = fileName.split('.').pop().toLowerCase();

    // 1. Handle Tabular Text & JSON Datasets via ArrayBuffer (Enables Multi-Encoding Auto-Detection)
    if (['csv', 'tsv', 'txt', 'json', 'ndjson', 'jsonl', 'dat'].includes(extension) || !['xlsx', 'xls'].includes(extension)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target.result;
          const text = decodeBufferWithSmartEncoding(buffer);

          if (!text || text.trim().length === 0) {
            return reject(new Error('File is empty or contains no readable data'));
          }

          if (extension === 'json' || extension === 'ndjson' || extension === 'jsonl') {
            const rows = parseUniversalJSON(text);
            const cleanedRows = sanitizeRowObjects(filterEmptyRows(rows));
            if (cleanedRows.length === 0) return reject(new Error('No valid record objects found in JSON'));
            return resolve({
              fileName: fileName,
              fileSize: file.size,
              fileType: 'JSON',
              rawData: cleanedRows,
              cleanData: cleanedRows.map(r => ({ ...r }))
            });
          }

          // CSV, TSV, TXT, or Other Delimited Text Files
          parseDelimitedTextUniversal(text, (err, rows) => {
            if (err) return reject(err);
            const cleanedRows = sanitizeRowObjects(filterEmptyRows(rows));
            if (cleanedRows.length === 0) {
              return reject(new Error('No valid tabular data rows found'));
            }
            resolve({
              fileName: fileName,
              fileSize: file.size,
              fileType: extension.toUpperCase(),
              rawData: cleanedRows,
              cleanData: cleanedRows.map(r => ({ ...r }))
            });
          });
        } catch (err) {
          reject(new Error(`Parsing Error: ${err.message || err}`));
        }
      };
      reader.onerror = (err) => reject(new Error(`File Read Error: ${err.message || err}`));
      reader.readAsArrayBuffer(file);
    } 
    // 2. Handle Excel Spreadsheets (.xlsx, .xls)
    else if (extension === 'xlsx' || extension === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          if (typeof XLSX === 'undefined') {
            return reject(new Error('SheetJS XLSX library not loaded. Please ensure an active internet connection or local library.'));
          }
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          
          let activeSheetName = null;
          for (const name of workbook.SheetNames) {
            const sheet = workbook.Sheets[name];
            if (sheet && sheet['!ref']) {
              activeSheetName = name;
              break;
            }
          }

          if (!activeSheetName) {
            return reject(new Error('Workbook contains no sheets with data'));
          }

          const worksheet = workbook.Sheets[activeSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false, dateNF: 'yyyy-mm-dd' });
          let cleanedRows = filterEmptyRows(jsonData);
          if (cleanedRows.length === 0) {
            return reject(new Error(`Sheet "${activeSheetName}" contains no data rows`));
          }
          cleanedRows = sanitizeRowObjects(cleanedRows);
          resolve({
            fileName: fileName,
            fileSize: file.size,
            fileType: 'Excel',
            rawData: cleanedRows,
            cleanData: cleanedRows.map(r => ({ ...r }))
          });
        } catch (err) {
          reject(new Error(`Excel Read Error: ${err.message || err}`));
        }
      };
      reader.onerror = (err) => reject(new Error(`File Read Error: ${err.message || err}`));
      reader.readAsArrayBuffer(file);
    } else {
      reject(new Error(`Unsupported format: .${extension}`));
    }
  });
}

/**
 * Universal Multi-Encoding Buffer Decoder
 * Auto-detects UTF-8, UTF-16, Latin-1 / Windows-1252 / ISO-8859-1 without throwing errors.
 */
function decodeBufferWithSmartEncoding(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length === 0) return '';

  // 1. Detect Byte Order Mark (BOM)
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }

  // 2. Try Strict UTF-8 first
  try {
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
    return utf8Decoder.decode(bytes);
  } catch (e) {
    // 3. Fallback to Windows-1252 / Latin-1 for European / South American datasets (e.g. Brazilian Olist dataset)
    try {
      const winDecoder = new TextDecoder('windows-1252', { fatal: false });
      return winDecoder.decode(bytes);
    } catch (e2) {
      try {
        const isoDecoder = new TextDecoder('iso-8859-1', { fatal: false });
        return isoDecoder.decode(bytes);
      } catch (e3) {
        // Fallback default
        return new TextDecoder().decode(bytes);
      }
    }
  }
}

/**
 * Universal Delimited Text Parser (PapaParse with Built-In Fallback)
 */
function parseDelimitedTextUniversal(text, callback) {
  // If PapaParse is available in global scope, use it with robust settings
  if (typeof Papa !== 'undefined' && typeof Papa.parse === 'function') {
    try {
      Papa.parse(text, {
        header: true,
        dynamicTyping: false,
        skipEmptyLines: 'greedy',
        delimitersToGuess: [',', '\t', '|', ';', '~'],
        transformHeader: (h) => (h ? String(h).trim().replace(/^\uFEFF/, '') : ''),
        comments: '#',
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            return callback(null, results.data);
          }
          // Fallback to custom parser if PapaParse returned empty
          const fallbackRows = customFastCsvParser(text);
          callback(null, fallbackRows);
        },
        error: (err) => {
          console.warn('PapaParse reported error, using built-in parser fallback:', err);
          const fallbackRows = customFastCsvParser(text);
          callback(null, fallbackRows);
        }
      });
      return;
    } catch (err) {
      console.warn('PapaParse threw exception, using built-in parser fallback:', err);
    }
  }

  // Standalone built-in parser (zero external dependencies)
  try {
    const rows = customFastCsvParser(text);
    callback(null, rows);
  } catch (err) {
    callback(new Error(`Delimited text parse failed: ${err.message || err}`));
  }
}

/**
 * Built-In High-Performance Streaming RFC 4180 CSV/TSV/DSV Parser
 * Handles any delimiter, quoted values, escaped quotes, embedded commas and newlines.
 */
function customFastCsvParser(text) {
  if (!text || !text.trim()) return [];

  // 1. Detect Delimiter from the first few non-empty lines
  const delimiter = detectBestDelimiter(text);
  
  // 2. Tokenize rows and cells
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let inQuotes = false;
  const len = text.length;

  for (let i = 0; i < len; i++) {
    const char = text[i];
    const nextChar = i + 1 < len ? text[i + 1] : '';

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentCell += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\r') {
        if (nextChar === '\n') i++; // Skip \r\n
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => c !== '')) rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else if (char === '\n') {
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => c !== '')) rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }

  // Push final cell/row
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(c => c !== '')) rows.push(currentRow);
  }

  if (rows.length === 0) return [];

  // 3. Convert Array of Arrays to Array of Objects using Row 0 as Header
  const rawHeaders = rows[0];
  const headers = [];
  const headerCounts = {};

  rawHeaders.forEach((h, idx) => {
    let cleanHeader = String(h || '').trim().replace(/^\uFEFF/, '').replace(/^["']|["']$/g, '');
    if (!cleanHeader) cleanHeader = `Column_${idx + 1}`;
    
    // Deduplicate duplicate column headers
    if (headerCounts[cleanHeader] !== undefined) {
      headerCounts[cleanHeader]++;
      cleanHeader = `${cleanHeader}_${headerCounts[cleanHeader]}`;
    } else {
      headerCounts[cleanHeader] = 0;
    }
    headers.push(cleanHeader);
  });

  const parsedObjects = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = c < row.length ? row[c] : '';
    }
    parsedObjects.push(obj);
  }

  return parsedObjects;
}

/**
 * Intelligent Delimiter Detector
 */
function detectBestDelimiter(text) {
  const sampleLines = text.split(/\r?\n/).slice(0, 15).filter(l => l.trim().length > 0 && !l.trim().startsWith('#'));
  if (sampleLines.length === 0) return ',';

  const candidates = [',', '\t', ';', '|', '~'];
  let bestDelimiter = ',';
  let maxConsistentCols = 0;

  for (const delim of candidates) {
    const counts = sampleLines.map(line => line.split(delim).length);
    const firstCount = counts[0];
    const isConsistent = counts.every(c => c === firstCount && c > 1);

    if (isConsistent && firstCount > maxConsistentCols) {
      maxConsistentCols = firstCount;
      bestDelimiter = delim;
    }
  }

  return bestDelimiter;
}

/**
 * Universal JSON & NDJSON / JSON Lines Parser
 */
function parseUniversalJSON(text) {
  text = text.trim().replace(/^\uFEFF/, '');
  let parsed = null;

  // 1. Try standard JSON
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    // 2. Try JSON Lines (NDJSON)
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      try {
        parsed = lines.map(line => JSON.parse(line));
      } catch (ndjsonErr) {
        throw new Error('Invalid JSON / NDJSON syntax');
      }
    } else {
      throw new Error('JSON file is empty');
    }
  }

  // 3. Extract Array of Records
  if (!Array.isArray(parsed)) {
    if (typeof parsed === 'object' && parsed !== null) {
      const keys = Object.keys(parsed);
      const firstArrayKey = keys.find(k => Array.isArray(parsed[k]));
      if (firstArrayKey) {
        parsed = parsed[firstArrayKey];
      } else {
        // Deep search 1 level down (e.g. response.docs, data.records)
        let foundArray = null;
        for (const k of keys) {
          if (typeof parsed[k] === 'object' && parsed[k] !== null) {
            const subKey = Object.keys(parsed[k]).find(sk => Array.isArray(parsed[k][sk]));
            if (subKey) {
              foundArray = parsed[k][subKey];
              break;
            }
          }
        }
        parsed = foundArray ? foundArray : [parsed];
      }
    }
  }

  return Array.isArray(parsed) ? parsed : [parsed];
}

/**
 * Filter out rows where all cell values are null/empty
 */
function filterEmptyRows(data) {
  if (!Array.isArray(data)) return [];
  return data.filter(row => {
    if (!row || typeof row !== 'object') return false;
    for (const key in row) {
      if (Object.prototype.hasOwnProperty.call(row, key)) {
        const v = row[key];
        if (v !== null && v !== undefined && String(v).trim() !== '') {
          return true;
        }
      }
    }
    return false;
  });
}

/**
 * Sanitize row keys (strip BOM, trim, remove internal/extra parser keys)
 */
function sanitizeRowObjects(rows) {
  if (!rows || rows.length === 0) return [];
  return rows.map((row) => {
    const cleanRow = {};
    let colIndex = 1;
    for (const rawKey in row) {
      if (Object.prototype.hasOwnProperty.call(row, rawKey)) {
        if (rawKey === '__parsed_extra') continue;
        let cleanKey = String(rawKey || '').trim().replace(/^\uFEFF/, '').replace(/^["']|["']$/g, '');
        if (!cleanKey) {
          cleanKey = `Column_${colIndex}`;
        }
        cleanRow[cleanKey] = row[rawKey] !== undefined ? row[rawKey] : '';
        colIndex++;
      }
    }
    return cleanRow;
  });
}


/**
 * Built-In Preloaded Demo Datasets Generation
 */
function initDemoDatasets() {
  const sampleCards = document.querySelectorAll('.sample-card');
  sampleCards.forEach(card => {
    card.addEventListener('click', () => {
      const sampleKey = card.dataset.sample;
      loadSampleDataset(sampleKey);
    });
  });
}

function loadSampleDataset(sampleKey) {
  let sampleData = [];
  let sampleName = '';

  if (sampleKey === 'ecommerce') {
    sampleName = 'ecommerce_sales_sample.csv';
    sampleData = generateEcommerceDataset();
  } else if (sampleKey === 'healthcare') {
    sampleName = 'healthcare_diagnostics_sample.csv';
    sampleData = generateHealthcareDataset();
  } else if (sampleKey === 'hr') {
    sampleName = 'employee_salaries_sample.csv';
    sampleData = generateHRDataset();
  } else if (sampleKey === 'environment') {
    sampleName = 'environmental_sensors_sample.csv';
    sampleData = generateEnvironmentalDataset();
  }

  const ds = window.addDatasetToWorkspace({
    fileName: sampleName,
    fileSize: sampleData.length * 180,
    fileType: 'Sample CSV',
    rawData: sampleData,
    cleanData: sampleData.map(r => ({ ...r }))
  }, true);

  showToast(`Loaded demo dataset "${sampleName}" (${sampleData.length} records)`, 'success');
  navigateToTab('exploreTab');
}


/**
 * 1. E-Commerce Sales Dataset Generator (100 rich rows)
 */
function generateEcommerceDataset() {
  const categories = ['Electronics', 'Home & Living', 'Apparel', 'Office Supplies', 'Footwear'];
  const regions = ['North America', 'Europe', 'Asia Pacific', 'Latin America', 'Middle East'];
  const segments = ['Consumer', 'Corporate', 'Small Business'];
  const shipModes = ['Standard Delivery', 'Express Air', 'Same Day', 'Overnight'];

  const rows = [];
  for (let i = 1; i <= 100; i++) {
    const category = categories[i % categories.length];
    const region = regions[(i * 3) % regions.length];
    const segment = segments[(i * 2) % segments.length];
    const shipMode = shipModes[i % shipModes.length];

    // Introduce natural correlations and occasional missing values / outliers for realistic EDA
    const basePrice = (i * 13) % 450 + 45;
    const discount = i % 7 === 0 ? 0.25 : (i % 5 === 0 ? 0.15 : 0.05);
    const sales = Number((basePrice * (1 + (i % 4))).toFixed(2));
    const profitMargin = 0.18 + ((i % 10) - 4) * 0.02;
    const profit = Number((sales * profitMargin - (discount * 20)).toFixed(2));
    const rating = Number((3.2 + ((i * 7) % 18) / 10).toFixed(1));
    const unitsSold = (i % 9) + 1;
    const isReturned = (profit < 0 || i % 11 === 0) ? 'Yes' : 'No';

    // Occasional missing value injection
    const ageVal = i === 12 || i === 48 ? '' : (22 + (i * 5) % 45);

    rows.push({
      'Order_ID': `ORD-${1000 + i}`,
      'Customer_Segment': segment,
      'Product_Category': category,
      'Region': region,
      'Sales_Amount': sales,
      'Profit': profit,
      'Discount_Rate': discount,
      'Customer_Rating': rating,
      'Units_Sold': unitsSold,
      'Customer_Age': ageVal,
      'Returned': isReturned
    });
  }

  // Inject a duplicate row for preprocessing test
  rows.push({ ...rows[5] });
  rows.push({ ...rows[18] });

  return rows;
}

/**
 * 2. Healthcare Diagnostic Dataset Generator (90 rows)
 */
function generateHealthcareDataset() {
  const genders = ['Male', 'Female'];
  const diagnoses = ['Hypertension', 'Type 2 Diabetes', 'Healthy Normal', 'Cardiovascular Risk', 'Asthma'];
  const smokeStatus = ['Never', 'Former', 'Active Smoker'];

  const rows = [];
  for (let i = 1; i <= 90; i++) {
    const age = 24 + ((i * 7) % 58);
    const gender = genders[i % 2];
    const smoke = smokeStatus[i % 3];
    const systolicBP = 110 + ((age * 0.7) + (i % 35));
    const glucose = Number((85 + (i % 4 === 0 ? 45 : 0) + (i * 3) % 40).toFixed(1));
    const bmi = Number((21.5 + ((i * 3) % 16) + (smoke === 'Active Smoker' ? 2.5 : 0)).toFixed(1));
    const cholesterol = 160 + ((age * 1.2) + (i % 55));
    const stayDays = Math.max(1, Math.round((age / 18) + (systolicBP > 140 ? 3 : 0)));

    let diagnosis = 'Healthy Normal';
    if (systolicBP > 145) diagnosis = 'Hypertension';
    else if (glucose > 130) diagnosis = 'Type 2 Diabetes';
    else if (cholesterol > 230 && bmi > 28) diagnosis = 'Cardiovascular Risk';
    else if (i % 6 === 0) diagnosis = 'Asthma';

    const glucoseVal = i === 15 || i === 62 ? '' : glucose;

    rows.push({
      'Patient_ID': `PT-${5000 + i}`,
      'Age': age,
      'Gender': gender,
      'Systolic_BP': Math.round(systolicBP),
      'Glucose_Level': glucoseVal,
      'BMI': bmi,
      'Cholesterol': Math.round(cholesterol),
      'Smoking_Status': smoke,
      'Hospital_Stay_Days': stayDays,
      'Primary_Diagnosis': diagnosis
    });
  }

  // Inject duplicate
  rows.push({ ...rows[8] });

  return rows;
}

/**
 * 3. Employee HR & Compensation Dataset Generator (80 rows)
 */
function generateHRDataset() {
  const departments = ['Engineering', 'Marketing', 'Sales', 'Product Design', 'Human Resources', 'Finance'];
  const educations = ["Bachelor's", "Master's", 'PhD', 'Associate Degree'];
  const performanceGrades = ['Exceeds Expectations', 'Meets Expectations', 'Needs Improvement', 'Outstanding'];

  const rows = [];
  for (let i = 1; i <= 80; i++) {
    const dept = departments[i % departments.length];
    const edu = educations[(i * 2) % educations.length];
    const experience = (i % 18) + 1;
    const baseSalary = 55000 + (experience * 5800) + (edu === 'PhD' ? 18000 : (edu === "Master's" ? 9000 : 0));
    const bonusPct = Number((0.05 + ((i % 5) * 0.03)).toFixed(2));
    const performance = performanceGrades[i % performanceGrades.length];
    const remotePct = (i % 4) * 25;
    const trainingHours = 10 + ((i * 4) % 60);

    const expVal = i === 22 ? '' : experience;

    rows.push({
      'Emp_ID': `EMP-${300 + i}`,
      'Department': dept,
      'Education_Level': edu,
      'Experience_Years': expVal,
      'Annual_Salary': Math.round(baseSalary),
      'Bonus_Percentage': bonusPct,
      'Performance_Rating': performance,
      'Remote_Work_Pct': remotePct,
      'Training_Hours': trainingHours
    });
  }

  rows.push({ ...rows[14] });
  return rows;
}

/**
 * 4. Environmental Telemetry Dataset Generator (85 rows)
 */
function generateEnvironmentalDataset() {
  const cities = ['New York', 'London', 'Tokyo', 'Berlin', 'Singapore', 'Sydney', 'Paris'];
  const weathers = ['Clear Skies', 'Light Rain', 'Overcast', 'Windy Storm', 'Humid'];

  const rows = [];
  for (let i = 1; i <= 85; i++) {
    const city = cities[i % cities.length];
    const weather = weathers[i % weathers.length];
    const tempC = Number((14 + ((i * 5) % 22) - (weather === 'Light Rain' ? 4 : 0)).toFixed(1));
    const humidity = 35 + ((i * 7) % 55);
    const windSpeed = Number((4 + ((i * 3) % 28)).toFixed(1));
    const pm25 = Number((8 + ((i * 9) % 75)).toFixed(1));
    const aqi = Math.round(pm25 * 2.2 + (tempC > 28 ? 15 : 0));
    const carbonPpm = Math.round(380 + (aqi * 0.8) + (i % 25));

    const humidityVal = i === 30 ? '' : humidity;

    rows.push({
      'Sensor_ID': `ENV-${700 + i}`,
      'City_Location': city,
      'Temperature_C': tempC,
      'Humidity_Pct': humidityVal,
      'Wind_Speed_kmh': windSpeed,
      'PM25_Density': pm25,
      'Air_Quality_Index': aqi,
      'Carbon_PPM': carbonPpm,
      'Weather_Condition': weather
    });
  }

  rows.push({ ...rows[10] });
  return rows;
}