# Record Management Portal — Endoscopy & HDU Clinical System

A high-performance, responsive clinical recording, analytics, and reporting application designed for High Dependency Units (HDU), Endoscopy Departments, and Medical Records administration.

---

## 🌟 Key Features & Modules

### 1. 🏥 Patient Census & Clinical Tracking (HDU & Wards)
- **Real-time Census Management**: Track active admissions, discharges, transfers, length of stay (LOS), consultant in-charge, and clinical category.
- **Dynamic Quick Filters & Search**: Search by MR Number, Patient Name, Consultant, or Admission Code with multi-token keyword matching.
- **Status Timelines & Verification**: Detailed patient status timelines with verification workflows and audit history.
- **QR Code Generation & Scanning**: Generate patient-specific QR codes for rapid bedside chart retrieval via webcam or mobile scanner.

### 2. 🔬 Endoscopy Procedure Records & Reporting
- **Comprehensive Procedure Logging**: Upper GI Endoscopy, Colonoscopy, ERCP, Sigmoidoscopy, and Bronchoscopy with indications, findings, and interventions.
- **Multi-Image Attachment & Annotation**: Upload high-resolution procedure imagery with inline cropping, labeling, and clinical findings.
- **Instant Medical Report Generator**: High-fidelity single-page and multi-page A4 PDF report generation compliant with official institutional standards.
- **Direct Dispatch (WhatsApp & Email)**: Dispatch endoscopy report summaries and attachments directly to patients or referring consultants.

### 3. 📊 Clinical Analytics & Mortality Archive
- **Real-time Analytics Dashboard**: Dynamic visual analytics (Recharts) displaying monthly admissions, consultant workloads, diagnostic distributions, and bed occupancy.
- **Mortality Registry & Audit**: Secure archival of critical patient outcomes with comprehensive case review documentation.
- **Incident & Safety Management**: Record adverse events, clinical safety reports, and root-cause analyses.

### 4. 📦 Inventory & Consumables Management
- **Stock Tracking**: Maintain real-time stock levels of medical consumables, PPE, endoscopy accessories, and pharmaceuticals.
- **Threshold Alerts**: Automatic indicators for items near minimum safety thresholds or approaching expiration dates.

### 5. 🖨️ High-Fidelity Print & Export Engine
- **CSS Print Media Stylesheet (`print.css`)**: Engineered for pure white backgrounds, deep-black high-contrast typography, and ink-efficient printing.
- **High-Contrast Print Preview**: Live on-screen simulation of A4 sheets with toggles for logos, institutional headers, metrics, and custom column selections.
- **Multi-Format Export**: One-click exports to vector-rendered PDFs and CSV spreadsheets.

### 6. 🔐 Security & Access Control (WebAuthn / Passkeys)
- **Role-Based Access Control (RBAC)**: Admin, Consultant, and Staff authorization levels.
- **FIDO2 / WebAuthn Biometric Authentication**: Support for instant 1-tap fingerprint / facial recognition logins via hardware keyrings (Windows Hello, Mac TouchID, Android Biometrics).
- **Session Protection**: Automatic idle timeout locks and secure credential management.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide React (Icons), Motion (Animations)
- **Charts & Visualizations**: Recharts
- **PDF Generation**: jsPDF, jsPDF-AutoTable
- **Hardware Integration**: WebAuthn API (FIDO2 Biometrics), jsQR (Camera Barcode/QR Scanner)
- **Rich Text & Formatting**: React-Quill-New
- **Backend Server**: Node.js, Express, Nodemailer, esbuild, tsx
- **Build Tool**: Vite

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or bun

### Installation

1. **Clone or download repository**
2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy the example environment configuration:
   ```bash
   cp .env.example .env
   ```
   *(Add your SMTP or Firebase credentials if cloud sync or email dispatch is required).*

### Running the Application

- **Development Mode** (Boots Express server with Vite middleware on port 3000):
  ```bash
  npm run dev
  ```
- **Build for Production**:
  ```bash
  npm run build
  ```
- **Start Production Server**:
  ```bash
  npm run start
  ```
- **Lint Codebase**:
  ```bash
  npm run lint
  ```

---

## 📂 Project Structure

```
├── components/          # Reusable UI widgets, tables, modals, & print preview sheets
├── contexts/            # React Context providers for global application state
├── pages/               # Top-level view modules (Endoscopy, Mortality, Tasks, Logs)
├── services/            # Business logic (PDF generator, WebAuthn, Email, WhatsApp)
├── public/              # Static assets, branding logos, and service icons
├── App.tsx              # Root router, view dispatcher, and layout controller
├── index.css            # Global styling and Tailwind directives
├── print.css            # High-contrast stylesheet for A4 printing and PDF exports
├── server.ts            # Express backend proxy for SMTP email and production serving
└── types.ts             # TypeScript interfaces and clinical data models
```

---

## 📄 License & Institutional Usage
Developed for clinical workflow automation and medical record administration. All patient data is handled locally and secured per institutional data privacy standards.
