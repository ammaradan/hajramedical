# Hajra Medical Complex, Jaranwala
### Clinical Management & Electronic Health Records (EHR) System
**Doctor:** Dr. Hafiz Ehsan Qadeer (M.B.B.S. PB, Family Physician)  
**Location:** Adda Jhaal, Faisalabad Road, Jaranwala  
**Contact:** 041-4711753 / 0313-6530553  
**Registrations:** PMDC Reg. No: 98762-P | PHC Reg. No: 2025/92172  

---

## 🌟 Overview
A modern, responsive, and high-performance Web Application designed specifically for **Hajra Medical Complex, Jaranwala**. Built to deliver seamless clinical workflows, fast patient registration, prescription printing with official branding, billing & receipts, appointment scheduling with WhatsApp notifications, and complete offline & online data persistence.

Deployed effortlessly to **Vercel** and ready for production use across PCs, laptops, and tablets.

---

## ✨ Features

### 1. 🏥 Patient Registration & Medical Records (MR)
- **Auto-Generating MR Numbers**: Formatted as `HMC-00001`, `HMC-00002`, with custom override support.
- **Pakistan Standard Time (PST)**: Automatic date & live PST clock.
- **Visit Tracking**: Automatically counts and increments visit numbers per patient (`Visit #1`, `Visit #2`, etc.).
- **Complete Patient Demographics**: Name, Relation (`S/O`, `D/O`, `W/O`, `H/O`), Parent/Spouse Name, Age, Gender, Weight (kg), Phone/WhatsApp, CNIC (`XXXXX-XXXXXXX-X`), and Residential Address.
- **Vitals Strip**: Temperature (°F), Blood Pressure (B.P), Respiratory Rate (R.R), and Pulse (/min).
- **Comprehensive Clinical Notes**:
  - Allergies (Drug & food allergies)
  - Presenting Complaints & History (P/Complaints & History)
  - Clinical Findings & Examination
  - Comments & Special Advice
  - Investigations / Lab Tests Advised
  - Provisional / Final Diagnosis
  - Rx Treatment / Prescription (with rich text formatting: Bold, Italic, Underline, Bullet Lists)
  - Revisit After (Days)
- **Instant Live Search**: Search across patient name, MR number, phone number, CNIC, and address.
- **Patient Visit History**: View all previous visits, diagnoses, and prescriptions for returning patients with one-click reload.

### 2. 🖨️ Prescription Printing (Exact A4 Standard)
- Formatted to match the official letterhead of **Hajra Medical Complex**:
  - Top header banner with PMDC Reg No `98762-P`, PHC Reg No `2025/92172`, clinic address, cell numbers, Urdu motto (*صحت، خدمت، احترام*), clinic logo, and WhatsApp QR code.
  - VCO verification checkbox.
  - Underlined patient information table.
  - Two-column clinical layout:
    - **Left Column**: Allergies, Complaints & History, Findings, Comments, Investigations.
    - **Right Column**: Vitals strip, Provisional Diagnosis, Rx treatment block with classic 30pt Rx symbol, and Doctor Signature block for **Dr. Hafiz Ehsan Qadeer**.
  - Legal patient consent statement in Urdu.
  - Footer with revisit days, clinic helpline (`041-4711753 / 0313-6530553`), and clinic timings.
- **Print Preview Modal**: Live interactive preview on screen before printing.
- **Direct Print**: Triggers print dialog formatted specifically for A4 printers without UI bleed.
- **Walk-in Quick Print**: Print temporary prescriptions without saving to database.

### 3. ⚡ Clinical Templates Library (52+ Built-in Templates)
- Pre-loaded with ultrasound recommendations, common clinical conditions, and OPD treatments (Renal stones, Gallstones, Gastritis, Hernia, Appendicitis, Bronchitis, UTI, URTI, Diabetes, Hypertension, etc.).
- Categorized tabs & quick keyword search.
- One-click insertion directly into active clinical note fields.

### 4. 💳 Billing & Payment Receipts
- Automatic Receipt Number generation (`RCP-00001`, `RCP-00002`...).
- Detailed charges breakdown: Consultation Fee, Procedure Charges, Lab Tests, Imaging/USG, Medicines, Other Charges, and Discounts.
- Live calculation of Total, Amount Received, and Balance Due.
- Multi-channel payment methods: Cash, JazzCash, EasyPaisa, Bank Transfer, Credit/Debit Card.
- Printable thermal / A5 friendly payment receipt.

### 5. 📅 Appointment Scheduling & Token Queue
- Daily token counter (`Token #1`, `Token #2`, etc.).
- Status tracking: `Waiting`, `Next` (*Now Serving* banner), `Seen`.
- **WhatsApp Notification Integration**: One-click generation of bilingual (Urdu + English) appointment confirmation messages sent directly to the patient's WhatsApp.

### 6. 💾 Database Management & Data Protection
- **IndexedDB Local Engine**: Works 100% offline, zero latency, no external database subscription required.
- **Password-Protected Access**: Staff security lock (default password: `1234`, customizable).
- **One-Click JSON Backup**: Export the entire database into a standalone JSON file anytime.
- **One-Click Excel / CSV Export**: Export all patient records into spreadsheet format.
- **One-Click Database Restore**: Import previously saved JSON backups seamlessly.

---

## 🚀 Deployment to Vercel

### Method 1: Git Push (Automatic Deployment)
1. Push this repository to GitHub:
   ```bash
   git add .
   git commit -m "Deploy Hajra Medical Complex Web App"
   git push -u origin main
   ```
2. Log in to [Vercel](https://vercel.com).
3. Click **"Add New Project"** and select `ammaradan/hajramedical`.
4. Leave build settings as default (Framework Preset: **Other** / Static).
5. Click **"Deploy"**. Your application will be live in seconds with an SSL-secured URL!

### Method 2: Local Development
```bash
# Clone the repository
git clone https://github.com/ammaradan/hajramedical.git

# Navigate into directory
cd hajramedical

# Start local server
npm run dev
# or simply double-click index.html in any browser!
```

---

## 📞 Support & Contacts
- **Clinic:** Hajra Medical Complex, Adda Jhaal, Faisalabad Road, Jaranwala
- **Helpline:** 041-4711753 / 0313-6530553
