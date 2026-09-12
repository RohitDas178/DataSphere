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

  results.forEach((res, idx) => {
    if (res.status === 'fulfilled' && res.value && res.value.rawData.length > 0) {
      const dsObj = res.value;
      const isFirst = successCount === 0 && window.AppState.datasets.length === 0;
      const addedDs = window.addDatasetToWorkspace(dsObj, isFirst);
      if (!firstDataset) firstDataset = addedDs;
      successCount++;
    } else {
      console.error(`Failed to parse file ${validFiles[idx]?.name}:`, res.reason);
    }
  });

  if (successCount > 0) {
    window.renderMultiDatasetRibbon();
    window.renderRelationalJoinStudio();

    if (successCount === 1) {
      showToast(`Loaded 1 dataset into workspace (${firstDataset.rawData.length.toLocaleString()} rows)`, 'success');
    } else {
      showToast(`Successfully loaded ${successCount} datasets simultaneously into analytical workspace!`, 'success');
    }
  } else {
    showToast('Failed to parse uploaded files. Please check file formatting.', 'error');
  }
}

/**
 * Asynchronous Promise-Based Parser for a Single File
 */
function parseSingleFilePromise(file) {
  return new Promise((resolve, reject) => {
    const fileName = file.name;
    const extension = fileName.split('.').pop().toLowerCase();

    if (extension === 'csv' || extension === 'tsv') {
      Papa.parse(file, {
        header: true,
        dynamicTyping: false,
        skipEmptyLines: 'greedy',
        complete: (results) => {
          if (!results.data || results.data.length === 0) {
            return reject(new Error('Empty CSV file'));
          }
          const cleanedRows = filterEmptyRows(results.data);
          if (cleanedRows.length === 0) return reject(new Error('Empty rows only'));
          resolve({
            fileName: fileName,
            fileSize: file.size,
            fileType: extension.toUpperCase(),
            rawData: cleanedRows,
            cleanData: JSON.parse(JSON.stringify(cleanedRows))
          });
        },
        error: (err) => reject(err)
      });
    } else if (extension === 'xlsx' || extension === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const firstSheetName = workbook.SheetNames[0];
          if (!firstSheetName) return reject(new Error('No sheets in workbook'));
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          const cleanedRows = filterEmptyRows(jsonData);
          if (cleanedRows.length === 0) return reject(new Error('Empty sheet data'));
          resolve({
            fileName: fileName,
            fileSize: file.size,
            fileType: 'Excel',
            rawData: cleanedRows,
            cleanData: JSON.parse(JSON.stringify(cleanedRows))
          });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    } else if (extension === 'json') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          let parsed = JSON.parse(e.target.result);
          if (!Array.isArray(parsed)) {
            if (typeof parsed === 'object' && parsed !== null) {
              const keys = Object.keys(parsed);
              const firstArrayKey = keys.find(k => Array.isArray(parsed[k]));
              parsed = firstArrayKey ? parsed[firstArrayKey] : [parsed];
            }
          }
          if (!Array.isArray(parsed) || parsed.length === 0) return reject(new Error('Invalid JSON'));
          const cleanedRows = filterEmptyRows(parsed);
          if (cleanedRows.length === 0) return reject(new Error('Empty JSON rows'));
          resolve({
            fileName: fileName,
            fileSize: file.size,
            fileType: 'JSON',
            rawData: cleanedRows,
            cleanData: JSON.parse(JSON.stringify(cleanedRows))
          });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsText(file);
    } else {
      reject(new Error(`Unsupported format: ${extension}`));
    }
  });
}

function filterEmptyRows(data) {
  return data.filter(row => {
    return Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== '');
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
    cleanData: JSON.parse(JSON.stringify(sampleData))
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