# DataSphere Analytics 📊✨

> **Enterprise Client-Side Exploratory Data Analysis (EDA), Guided Preprocessing, Multi-Dataset Relational Modeling & AI Executive Intelligence Engine.**

DataSphere Analytics is a 100% client-side web application for automated dataset ingestion, quality auditing, sequential guided preprocessing, interactive visual exploration, custom chart generation, and algorithmic Natural Language Generation (NLG) executive reports. Zero external cloud AI APIs required — full privacy and deterministic local execution.

---

## 🚀 Key Features

### 1. Multi-Dataset Simultaneous Ingestion & Relational Studio
- **Multi-File Batch Upload**: Drag-and-drop or select multiple CSV, TSV, Excel (`.xlsx`/`.xls`), or JSON files simultaneously.
- **Multi-Dataset Workspace**: Switch between loaded datasets instantly via the dataset workspace ribbon.
- **Relational Join & Merge Studio**: Perform Left Outer Joins, Inner Joins, Full Outer Joins, or Vertical Concatenations (Unions) on matching primary/foreign keys with automated professional data analyst rationales.

### 2. Dataset Explorer & Attribute Role Assignment
- **Semantic Type Profiling**: Automatically classifies columns into Continuous Numeric, Discrete Integer, Categorical Nominal, Boolean, and Temporal types.
- **Interactive Attribute Selector**: Set primary Target Attributes ($\star$), search, filter, and inspect summary cards.
- **Paginated Raw Data Preview**: Live search and inspection with missing cell flags.

### 3. Step-by-Step Guided Preprocessing Wizard
- **Strict Sequential Gating**: Guided 6-step walkthrough preventing arbitrary skipping to locked steps without deliberate choices:
  - **Step 1: Data Health Diagnostics** (Completeness, Duplicates, Outliers, Constant Features, Cleanliness Index).
  - **Step 2: Duplicate Deduplication** (Keep First, Keep Last, Retain All).
  - **Step 3: Missing Value Imputation** (Smart Auto-Impute, Median, Mean, Mode, Constant, Listwise Deletion).
  - **Step 4: Outlier Treatment** (Tukey $1.5\times\text{IQR}$ Winsorization Capping, IQR Trimming, Z-Score Filtering, Preservation).
  - **Step 5: Text Sanitization & Standardization** (Whitespace Trimming, Title Casing, Lowercase Normalization, Boolean Standardization).
  - **Step 6: Pipeline Execution & Export** (Export Clean CSV / Clean JSON with complete audit logs).

### 4. Attribute-Driven Visual Analysis & Custom Plot Studio
- **Core EDA Visualizations**:
  - Univariate Distribution Histogram / Categorical Frequency Bar.
  - Bivariate Scatter Plot with Ordinary Least Squares (OLS) Linear Regression ($y = \beta x + \alpha$).
  - Categorical Market Share Donut Chart.
  - Pearson Correlation Heatmap Matrix ($r \in [-1.0, +1.0]$).
- **Plot Intelligence & Rationale**: Each chart details:
  - *Technical Plot Description*
  - *Why This Specific Plot Was Selected*
  - *Alternative Suitable Visualizations*
  - *Actionable Statistical & Business Takeaway*
- **Custom Interactive Plot Studio**: Build and render custom visualizations on demand (8 chart types: Vertical Bar, Horizontal Ranking Bar, Line Curve, Area Fill, Doughnut, Scatter + Regression, Radar Profile, Polar Area) with custom aggregations ($\mu, \Sigma, Q_2, N, \text{Max}, \text{Min}$) and color themes.

### 5. Automated AI Executive Intelligence Report
Synthesizes a 10-section Technical Whitepaper & Strategic Roadmap:
1. Executive Summary & Strategic Scorecard
2. Multi-Dataset Architecture & Cross-Table Relational Schema
3. Data Quality & Preprocessing Diagnostics (MCAR/MAR evaluation)
4. Comprehensive Univariate Parametric & Non-Parametric Deep-Dive Table
5. Key Driver Discoveries & Multivariate Correlations ($R^2$ variance explanation)
6. Categorical Segmentation & Pareto 80/20 Distribution Analysis
7. Embedded Visual Diagnostic Digest
8. Professional Data Analyst Methodology & Statistical Rationales
9. Actionable Strategic Recommendations & Phased Roadmap (0–30d, 30–90d, 90+d)
10. Governance & Deterministic Audit Footprint

---

## 🛠️ Technology Stack
- **Frontend**: HTML5, Vanilla JavaScript (ES6+), Vanilla CSS (Custom Design System, Glassmorphism, Dark/Light Mode).
- **Visualization**: Chart.js.
- **Parsing**: PapaParse (CSV/TSV), SheetJS (Excel XLSX/XLS).
- **Icons**: Lucide Icons.
- **Backend / Dev Server**: Node.js (Zero external backend dependencies).

---

## 💻 Local Installation & Setup

1. **Clone the Repository**:
   ```bash
   git clone <YOUR_GITHUB_REPO_URL>
   cd TABLEAU
   ```

2. **Start the Local Development Server**:
   ```bash
   npm start
   ```
   *(or run `node server.js`)*

3. **Open in Browser**:
   Visit [http://localhost:8080](http://localhost:8080)

---

## 📄 License
MIT License. Free for personal and commercial use.
