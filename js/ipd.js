/**
 * Hajra Medical Complex, Jaranwala
 * IPD (Inpatient Department) & Surgical Suite Module (js/ipd.js)
 * Covers: Admissions, Ward & Bed Allocation, OT Notes, Surgical Consent (Urdu/Eng),
 * Discharge Summary, Itemized Hospital Billing, Medical Fitness Certificate, and Active Ward Board.
 */

let _currentAdmission = null;
let _ipdActiveTab = 'admission';

// ── INITIALIZATION ──────────────────────────────────────────────────
function initIPD() {
  updateIPDActiveCount();
  setupIPDAutoDates();
  setupMRAutoLookup();
  setupBillingAutoCalc();
}

function setupIPDAutoDates() {
  const today = HMC_DB.getPSTDate();
  const time = HMC_DB.getPSTTime();
  
  const admDate = document.getElementById('ipd-adm-date');
  if (admDate && !admDate.value) admDate.value = today;
  
  const admTime = document.getElementById('ipd-adm-time');
  if (admTime && !admTime.value) admTime.value = time;

  const surgDate = document.getElementById('ipd-surg-date');
  if (surgDate && !surgDate.value) surgDate.value = today;

  const disDate = document.getElementById('ipd-dis-date');
  if (disDate && !disDate.value) disDate.value = today;

  const disTime = document.getElementById('ipd-dis-time');
  if (disTime && !disTime.value) disTime.value = time;

  const certDate = document.getElementById('ipd-cert-date');
  if (certDate && !certDate.value) certDate.value = today;
  
  const certFrom = document.getElementById('ipd-cert-from');
  if (certFrom && !certFrom.value) certFrom.value = today;
}

// ── MODE SWITCHER (OPD vs IPD) ──────────────────────────────────────
function switchMainMode(mode) {
  const opdContainer = document.getElementById('main-app-container');
  const ipdContainer = document.getElementById('ipd-container');
  const opdActions = document.querySelector('.action-bar-bottom');
  const btnOPD = document.getElementById('btn-mode-opd');
  const btnIPD = document.getElementById('btn-mode-ipd');
  const mobilePills = document.getElementById('mobile-nav-pills');

  if (mode === 'ipd') {
    if (opdContainer) opdContainer.style.display = 'none';
    if (opdActions) opdActions.style.display = 'none';
    if (ipdContainer) ipdContainer.style.display = 'block';

    if (btnOPD) btnOPD.classList.remove('active');
    if (btnIPD) btnIPD.classList.add('active');

    // Update mobile pills
    const pillIpd = document.getElementById('mpill-ipd');
    if (pillIpd) pillIpd.classList.add('active');
    const pillForm = document.getElementById('mpill-form');
    if (pillForm) pillForm.classList.remove('active');

    renderActiveAdmissionsTable();
    updateIPDActiveCount();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    if (opdContainer) opdContainer.style.display = '';
    if (opdActions) opdActions.style.display = '';
    if (ipdContainer) ipdContainer.style.display = 'none';

    if (btnOPD) btnOPD.classList.add('active');
    if (btnIPD) btnIPD.classList.remove('active');

    const pillIpd = document.getElementById('mpill-ipd');
    if (pillIpd) pillIpd.classList.remove('active');
    const pillForm = document.getElementById('mpill-form');
    if (pillForm) pillForm.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// ── IPD SUB-TABS SWITCHER ───────────────────────────────────────────
function switchIPDTab(tabId) {
  _ipdActiveTab = tabId;
  const tabs = document.querySelectorAll('.ipd-tab-btn');
  tabs.forEach(t => t.classList.remove('active'));

  const activeBtn = document.getElementById(`ipd-nav-${tabId}`);
  if (activeBtn) activeBtn.classList.add('active');

  const contents = document.querySelectorAll('.ipd-tab-content');
  contents.forEach(c => c.style.display = 'none');

  const activeContent = document.getElementById(`ipd-pane-${tabId}`);
  if (activeContent) activeContent.style.display = 'block';

  // Sync auto calculations on tab switch
  if (tabId === 'discharge' || tabId === 'billing') {
    calculateStayDays();
    calculateIPDBill();
  }
  if (tabId === 'records') {
    renderActiveAdmissionsTable();
  }
  if (tabId === 'consent') {
    syncConsentFields();
  }
  if (tabId === 'certificate') {
    syncCertificateFields();
  }
}

// ── MR AUTO LOOKUP & POPULATION ─────────────────────────────────────
function setupMRAutoLookup() {
  const mrInput = document.getElementById('ipd-patient-mr');
  if (!mrInput) return;

  mrInput.addEventListener('change', () => lookupPatientForAdmission(mrInput.value.trim()));
  mrInput.addEventListener('blur', () => lookupPatientForAdmission(mrInput.value.trim()));
}

async function lookupPatientForAdmission(mr) {
  if (!mr) return;
  const visits = await HMC_DB.getPatientVisits(mr);
  if (visits && visits.length > 0) {
    const p = visits[0]; // Most recent visit has latest demographics
    populateIPDDemographics(p);
    showToast(`Patient loaded from MR# ${mr}: ${p.name}`, 'info');
  } else {
    // If not found in visits, check patients store
    const db = await HMC_DB.initDB();
    const tx = db.transaction(['patients'], 'readonly');
    const store = tx.objectStore('patients');
    const req = store.get(mr);
    req.onsuccess = () => {
      if (req.result) {
        populateIPDDemographics(req.result);
        showToast(`Patient record found for MR# ${mr}`, 'info');
      }
    };
  }
}

function populateIPDDemographics(p) {
  if (!p) return;
  setVal('ipd-patient-name', p.name || '');
  setVal('ipd-patient-parent', p.parentage || '');
  setVal('ipd-patient-relation', p.relation || 'S/O');
  setVal('ipd-patient-age', p.age || '');
  setVal('ipd-patient-gender', p.gender || 'Male');
  setVal('ipd-patient-phone', p.phone || '');
  setVal('ipd-patient-cnic', p.cnic || '');
  setVal('ipd-patient-address', p.address || '');
  
  if (p.diagnosis) {
    const curDiag = document.getElementById('ipd-adm-diagnosis');
    if (curDiag && !curDiag.value) curDiag.value = cleanPlainText(p.diagnosis);
  }
}

// ── REALTIME CALCULATIONS ───────────────────────────────────────────
function calculateStayDays() {
  const admDateStr = document.getElementById('ipd-adm-date')?.value;
  const disDateStr = document.getElementById('ipd-dis-date')?.value || HMC_DB.getPSTDate();
  
  let days = 1;
  if (admDateStr && disDateStr) {
    const d1 = new Date(admDateStr);
    const d2 = new Date(disDateStr);
    const diffTime = d2 - d1;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    days = diffDays > 0 ? diffDays : 1;
  }
  
  setVal('ipd-stay-days', days);
  setVal('ipd-bill-days', days);
  calculateIPDBill();
  return days;
}

function setupBillingAutoCalc() {
  const billInputs = [
    'ipd-bill-room-rate', 'ipd-bill-days', 'ipd-bill-ot', 'ipd-bill-surgeon',
    'ipd-bill-anesthesia', 'ipd-bill-meds', 'ipd-bill-nursing', 'ipd-bill-lab',
    'ipd-bill-others', 'ipd-bill-discount', 'ipd-bill-advance'
  ];

  billInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', calculateIPDBill);
      el.addEventListener('change', calculateIPDBill);
    }
  });

  const disDate = document.getElementById('ipd-dis-date');
  if (disDate) disDate.addEventListener('change', calculateStayDays);
  const admDate = document.getElementById('ipd-adm-date');
  if (admDate) admDate.addEventListener('change', calculateStayDays);

  const certFrom = document.getElementById('ipd-cert-from');
  const certTo = document.getElementById('ipd-cert-to');
  if (certFrom) certFrom.addEventListener('change', calculateCertDays);
  if (certTo) certTo.addEventListener('change', calculateCertDays);
}

function calculateIPDBill() {
  const roomRate = parseFloat(document.getElementById('ipd-bill-room-rate')?.value) || 0;
  const days = parseFloat(document.getElementById('ipd-bill-days')?.value) || 1;
  const roomTotal = roomRate * days;
  setVal('ipd-bill-room-total', roomTotal);

  const ot = parseFloat(document.getElementById('ipd-bill-ot')?.value) || 0;
  const surgeon = parseFloat(document.getElementById('ipd-bill-surgeon')?.value) || 0;
  const anesthesia = parseFloat(document.getElementById('ipd-bill-anesthesia')?.value) || 0;
  const meds = parseFloat(document.getElementById('ipd-bill-meds')?.value) || 0;
  const nursing = parseFloat(document.getElementById('ipd-bill-nursing')?.value) || 0;
  const lab = parseFloat(document.getElementById('ipd-bill-lab')?.value) || 0;
  const others = parseFloat(document.getElementById('ipd-bill-others')?.value) || 0;

  const grossTotal = roomTotal + ot + surgeon + anesthesia + meds + nursing + lab + others;
  const discount = parseFloat(document.getElementById('ipd-bill-discount')?.value) || 0;
  const advance = parseFloat(document.getElementById('ipd-bill-advance')?.value) || 0;
  const netPayable = Math.max(0, grossTotal - discount - advance);

  setVal('ipd-bill-gross', grossTotal);
  setVal('ipd-bill-net', netPayable);

  const netDisplay = document.getElementById('ipd-bill-net-display');
  if (netDisplay) {
    netDisplay.textContent = `Rs. ${netPayable.toLocaleString('en-PK')}`;
  }
}

function calculateCertDays() {
  const fromStr = document.getElementById('ipd-cert-from')?.value;
  const toStr = document.getElementById('ipd-cert-to')?.value;
  if (fromStr && toStr) {
    const d1 = new Date(fromStr);
    const d2 = new Date(toStr);
    const diffDays = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
    setVal('ipd-cert-days', diffDays > 0 ? diffDays : 1);
  }
}

function syncConsentFields() {
  const pName = getVal('ipd-patient-name') || '—';
  const pParent = getVal('ipd-patient-parent') || '—';
  const pRel = getVal('ipd-patient-relation') || 'S/O';
  const pAge = getVal('ipd-patient-age') || '—';
  const pAddr = getVal('ipd-patient-address') || '—';
  const surgName = getVal('ipd-surg-procedure') || getVal('ipd-adm-diagnosis') || 'جراحی عمل (Surgical Procedure)';
  const surgeon = getVal('ipd-surg-surgeon') || 'ڈاکٹر حافظ احسان قدیر (Dr. Hafiz Ehsan Qadeer)';

  setTxt('consent-p-name', pName);
  setTxt('consent-p-parent', `${pRel} ${pParent}`);
  setTxt('consent-p-age', `${pAge} سال`);
  setTxt('consent-p-addr', pAddr);
  setTxt('consent-p-surgery', surgName);
  setTxt('consent-p-surgeon', surgeon);
}

function syncCertificateFields() {
  const pName = getVal('ipd-patient-name') || '';
  const pParent = getVal('ipd-patient-parent') || '';
  const pAge = getVal('ipd-patient-age') || '';
  const pGender = getVal('ipd-patient-gender') || 'Male';
  const diag = getVal('ipd-dis-diagnosis') || getVal('ipd-adm-diagnosis') || '';

  setVal('ipd-cert-name', pName);
  setVal('ipd-cert-parent', pParent);
  setVal('ipd-cert-age', pAge);
  setVal('ipd-cert-diag', diag);
}

// ── SAVE ADMISSION RECORD ───────────────────────────────────────────
async function saveIPDRecord(targetStatus) {
  const pName = getVal('ipd-patient-name').trim();
  if (!pName) {
    showToast('Please enter Patient Name before saving admission.', 'error');
    switchIPDTab('admission');
    document.getElementById('ipd-patient-name')?.focus();
    return;
  }

  const mr = getVal('ipd-patient-mr').trim() || (await HMC_DB.getNextMRNumber());
  let admId = getVal('ipd-record-id').trim();
  if (!admId) {
    admId = await HMC_DB.getNextAdmissionId();
    setVal('ipd-record-id', admId);
  }

  const stayDays = calculateStayDays();
  const status = targetStatus || getVal('ipd-record-status') || 'Admitted';

  const record = {
    admissionId: admId,
    mrNumber: mr,
    patientName: pName,
    parentage: getVal('ipd-patient-parent'),
    relation: getVal('ipd-patient-relation') || 'S/O',
    age: getVal('ipd-patient-age'),
    gender: getVal('ipd-patient-gender') || 'Male',
    phone: getVal('ipd-patient-phone'),
    cnic: getVal('ipd-patient-cnic'),
    address: getVal('ipd-patient-address'),
    emergencyContact: getVal('ipd-patient-emergency'),

    // Admission Details
    admissionDate: getVal('ipd-adm-date') || HMC_DB.getPSTDate(),
    admissionTime: getVal('ipd-adm-time') || HMC_DB.getPSTTime(),
    ward: getVal('ipd-adm-ward') || 'General Ward',
    bedNumber: getVal('ipd-adm-bed') || 'Bed #1',
    admittingDiagnosis: getVal('ipd-adm-diagnosis'),
    consultant: getVal('ipd-adm-consultant') || 'Dr. Hafiz Ehsan Qadeer',
    initialVitals: {
      bp: getVal('ipd-adm-bp'),
      pulse: getVal('ipd-adm-pulse'),
      temp: getVal('ipd-adm-temp'),
      weight: getVal('ipd-adm-weight'),
      spo2: getVal('ipd-adm-spo2')
    },
    status: status,

    // Surgery / OT Details
    surgery: {
      procedure: getVal('ipd-surg-procedure'),
      date: getVal('ipd-surg-date'),
      time: getVal('ipd-surg-time'),
      surgeon: getVal('ipd-surg-surgeon') || 'Dr. Hafiz Ehsan Qadeer',
      assistant: getVal('ipd-surg-assistant'),
      anesthetist: getVal('ipd-surg-anesthetist'),
      anesthesiaType: getVal('ipd-surg-anesthesia-type') || 'Spinal',
      preOpDiag: getVal('ipd-surg-preop'),
      postOpDiag: getVal('ipd-surg-postop'),
      findings: getVal('ipd-surg-findings'),
      operativeNotes: getVal('ipd-surg-notes')
    },

    // Consent Details
    consent: {
      witnessName: getVal('ipd-consent-witness'),
      relation: getVal('ipd-consent-relation'),
      signedDate: getVal('ipd-adm-date')
    },

    // Discharge Details
    discharge: {
      dischargeDate: getVal('ipd-dis-date'),
      dischargeTime: getVal('ipd-dis-time'),
      stayDays: stayDays,
      condition: getVal('ipd-dis-condition') || 'Improved',
      finalDiagnosis: getVal('ipd-dis-diagnosis') || getVal('ipd-adm-diagnosis'),
      hospitalCourse: getVal('ipd-dis-course'),
      dischargeMeds: getVal('ipd-dis-meds'),
      followupDate: getVal('ipd-dis-followup'),
      instructions: getVal('ipd-dis-instructions')
    },

    // Billing Details
    billing: {
      roomRate: parseFloat(getVal('ipd-bill-room-rate')) || 0,
      days: parseFloat(getVal('ipd-bill-days')) || stayDays,
      roomTotal: parseFloat(getVal('ipd-bill-room-total')) || 0,
      otCharges: parseFloat(getVal('ipd-bill-ot')) || 0,
      surgeonFee: parseFloat(getVal('ipd-bill-surgeon')) || 0,
      anesthesiaFee: parseFloat(getVal('ipd-bill-anesthesia')) || 0,
      medicinesFee: parseFloat(getVal('ipd-bill-meds')) || 0,
      nursingFee: parseFloat(getVal('ipd-bill-nursing')) || 0,
      labFee: parseFloat(getVal('ipd-bill-lab')) || 0,
      otherCharges: parseFloat(getVal('ipd-bill-others')) || 0,
      grossTotal: parseFloat(getVal('ipd-bill-gross')) || 0,
      discount: parseFloat(getVal('ipd-bill-discount')) || 0,
      advancePaid: parseFloat(getVal('ipd-bill-advance')) || 0,
      netPayable: parseFloat(getVal('ipd-bill-net')) || 0,
      paymentStatus: getVal('ipd-bill-status') || 'Paid'
    },

    // Certificate Details
    certificate: {
      type: getVal('ipd-cert-type') || 'Medical Rest',
      fromDate: getVal('ipd-cert-from'),
      toDate: getVal('ipd-cert-to'),
      days: getVal('ipd-cert-days'),
      diagnosis: getVal('ipd-cert-diag'),
      remarks: getVal('ipd-cert-remarks')
    }
  };

  try {
    await HMC_DB.saveAdmissionRecord(record);
    _currentAdmission = record;
    setVal('ipd-record-id', record.admissionId);
    setVal('ipd-record-status', record.status);
    
    showToast(`IPD Record Saved: ${record.admissionId} — ${pName}`, 'success');
    updateIPDActiveCount();
    renderActiveAdmissionsTable();

    // Trigger cloud sync in background if configured
    if (typeof scheduleCloudSync === 'function') {
      scheduleCloudSync(800);
    }
  } catch (err) {
    showToast('Failed to save IPD record: ' + err.message, 'error');
  }
}

// ── LOAD ADMISSION INTO FORM ─────────────────────────────────────────
async function loadAdmissionRecord(admId) {
  const rec = await HMC_DB.getAdmissionById(admId);
  if (!rec) {
    showToast('Admission record not found.', 'error');
    return;
  }
  _currentAdmission = rec;

  // Set ID & Status
  setVal('ipd-record-id', rec.admissionId);
  setVal('ipd-record-status', rec.status || 'Admitted');

  // Demographics
  setVal('ipd-patient-mr', rec.mrNumber || '');
  setVal('ipd-patient-name', rec.patientName || '');
  setVal('ipd-patient-parent', rec.parentage || '');
  setVal('ipd-patient-relation', rec.relation || 'S/O');
  setVal('ipd-patient-age', rec.age || '');
  setVal('ipd-patient-gender', rec.gender || 'Male');
  setVal('ipd-patient-phone', rec.phone || '');
  setVal('ipd-patient-cnic', rec.cnic || '');
  setVal('ipd-patient-address', rec.address || '');
  setVal('ipd-patient-emergency', rec.emergencyContact || '');

  // Admission info
  setVal('ipd-adm-date', rec.admissionDate || '');
  setVal('ipd-adm-time', rec.admissionTime || '');
  setVal('ipd-adm-ward', rec.ward || 'General Ward');
  setVal('ipd-adm-bed', rec.bedNumber || '');
  setVal('ipd-adm-diagnosis', rec.admittingDiagnosis || '');
  setVal('ipd-adm-consultant', rec.consultant || 'Dr. Hafiz Ehsan Qadeer');

  // Vitals
  if (rec.initialVitals) {
    setVal('ipd-adm-bp', rec.initialVitals.bp || '');
    setVal('ipd-adm-pulse', rec.initialVitals.pulse || '');
    setVal('ipd-adm-temp', rec.initialVitals.temp || '');
    setVal('ipd-adm-weight', rec.initialVitals.weight || '');
    setVal('ipd-adm-spo2', rec.initialVitals.spo2 || '');
  }

  // Surgery
  if (rec.surgery) {
    setVal('ipd-surg-procedure', rec.surgery.procedure || '');
    setVal('ipd-surg-date', rec.surgery.date || '');
    setVal('ipd-surg-time', rec.surgery.time || '');
    setVal('ipd-surg-surgeon', rec.surgery.surgeon || 'Dr. Hafiz Ehsan Qadeer');
    setVal('ipd-surg-assistant', rec.surgery.assistant || '');
    setVal('ipd-surg-anesthetist', rec.surgery.anesthetist || '');
    setVal('ipd-surg-anesthesia-type', rec.surgery.anesthesiaType || 'Spinal');
    setVal('ipd-surg-preop', rec.surgery.preOpDiag || '');
    setVal('ipd-surg-postop', rec.surgery.postOpDiag || '');
    setVal('ipd-surg-findings', rec.surgery.findings || '');
    setVal('ipd-surg-notes', rec.surgery.operativeNotes || '');
  }

  // Consent
  if (rec.consent) {
    setVal('ipd-consent-witness', rec.consent.witnessName || '');
    setVal('ipd-consent-relation', rec.consent.relation || '');
  }

  // Discharge
  if (rec.discharge) {
    setVal('ipd-dis-date', rec.discharge.dischargeDate || '');
    setVal('ipd-dis-time', rec.discharge.dischargeTime || '');
    setVal('ipd-stay-days', rec.discharge.stayDays || 1);
    setVal('ipd-dis-condition', rec.discharge.condition || 'Improved');
    setVal('ipd-dis-diagnosis', rec.discharge.finalDiagnosis || rec.admittingDiagnosis || '');
    setVal('ipd-dis-course', rec.discharge.hospitalCourse || '');
    setVal('ipd-dis-meds', rec.discharge.dischargeMeds || '');
    setVal('ipd-dis-followup', rec.discharge.followupDate || '');
    setVal('ipd-dis-instructions', rec.discharge.instructions || '');
  }

  // Billing
  if (rec.billing) {
    setVal('ipd-bill-room-rate', rec.billing.roomRate || 0);
    setVal('ipd-bill-days', rec.billing.days || 1);
    setVal('ipd-bill-room-total', rec.billing.roomTotal || 0);
    setVal('ipd-bill-ot', rec.billing.otCharges || 0);
    setVal('ipd-bill-surgeon', rec.billing.surgeonFee || 0);
    setVal('ipd-bill-anesthesia', rec.billing.anesthesiaFee || 0);
    setVal('ipd-bill-meds', rec.billing.medicinesFee || 0);
    setVal('ipd-bill-nursing', rec.billing.nursingFee || 0);
    setVal('ipd-bill-lab', rec.billing.labFee || 0);
    setVal('ipd-bill-others', rec.billing.otherCharges || 0);
    setVal('ipd-bill-gross', rec.billing.grossTotal || 0);
    setVal('ipd-bill-discount', rec.billing.discount || 0);
    setVal('ipd-bill-advance', rec.billing.advancePaid || 0);
    setVal('ipd-bill-net', rec.billing.netPayable || 0);
    setVal('ipd-bill-status', rec.billing.paymentStatus || 'Paid');
  }

  // Certificate
  if (rec.certificate) {
    setVal('ipd-cert-type', rec.certificate.type || 'Medical Rest');
    setVal('ipd-cert-from', rec.certificate.fromDate || '');
    setVal('ipd-cert-to', rec.certificate.toDate || '');
    setVal('ipd-cert-days', rec.certificate.days || 1);
    setVal('ipd-cert-diag', rec.certificate.diagnosis || rec.admittingDiagnosis || '');
    setVal('ipd-cert-remarks', rec.certificate.remarks || '');
  }

  calculateIPDBill();
  syncConsentFields();
  syncCertificateFields();

  showToast(`Loaded Admission: ${rec.admissionId} (${rec.patientName})`, 'success');
  switchIPDTab('admission');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetIPDForm() {
  _currentAdmission = null;
  const form = document.getElementById('ipd-form');
  if (form) form.reset();
  
  setVal('ipd-record-id', '');
  setVal('ipd-record-status', 'Admitted');
  setupIPDAutoDates();
  setVal('ipd-stay-days', '1');
  setVal('ipd-bill-days', '1');
  calculateIPDBill();
  switchIPDTab('admission');
  showToast('IPD Form cleared for new admission.', 'info');
}

// ── RENDER ACTIVE ADMISSIONS & WARDS TABLE ───────────────────────────
async function renderActiveAdmissionsTable() {
  const container = document.getElementById('ipd-admissions-tbody');
  if (!container) return;

  const records = await HMC_DB.getAllAdmissions();
  updateIPDActiveCount(records);

  const filterStatus = document.getElementById('ipd-filter-status')?.value || 'All';
  const searchQ = (document.getElementById('ipd-search-records')?.value || '').toLowerCase().trim();

  let filtered = records;
  if (filterStatus === 'Active') {
    filtered = filtered.filter(r => r.status !== 'Discharged');
  } else if (filterStatus === 'Discharged') {
    filtered = filtered.filter(r => r.status === 'Discharged');
  }

  if (searchQ) {
    filtered = filtered.filter(r => 
      (r.patientName || '').toLowerCase().includes(searchQ) ||
      (r.mrNumber || '').toLowerCase().includes(searchQ) ||
      (r.admissionId || '').toLowerCase().includes(searchQ) ||
      (r.phone || '').toLowerCase().includes(searchQ) ||
      (r.ward || '').toLowerCase().includes(searchQ) ||
      (r.admittingDiagnosis || '').toLowerCase().includes(searchQ)
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;padding:24px;color:var(--text-light);font-size:13px;">
          No admission records found matching filters.
        </td>
      </tr>`;
    return;
  }

  container.innerHTML = filtered.map(r => {
    const isAdmitted = r.status !== 'Discharged';
    const statusBadge = isAdmitted 
      ? `<span class="ipd-badge active">● Currently Admitted</span>`
      : `<span class="ipd-badge discharged">✓ Discharged</span>`;
    
    const surgBadge = (r.surgery && r.surgery.procedure)
      ? `<span class="ipd-badge surgery" title="${escapeHtml(r.surgery.procedure)}">🔪 ${escapeHtml(r.surgery.procedure.slice(0, 18))}</span>`
      : `<span style="color:#94a3b8;font-size:11px;">—</span>`;

    // Days counter
    const admDate = new Date(r.admissionDate);
    const endDate = isAdmitted ? new Date() : new Date(r.discharge?.dischargeDate || r.admissionDate);
    const days = Math.max(1, Math.ceil((endDate - admDate) / (1000 * 60 * 60 * 24)));

    return `
      <tr>
        <td>
          <div style="font-weight:700;color:var(--teal);">${escapeHtml(r.admissionId)}</div>
          <div style="font-size:11px;color:var(--text-light);">${escapeHtml(r.mrNumber)}</div>
        </td>
        <td>
          <div style="font-weight:700;font-size:13px;">${escapeHtml(r.patientName)}</div>
          <div style="font-size:11px;color:var(--text-muted);">${r.age ? r.age + 'y ' : ''}${r.gender || ''} ${r.phone ? '· ' + r.phone : ''}</div>
        </td>
        <td>
          <div style="font-weight:600;font-size:12.5px;">${escapeHtml(r.ward || 'Ward')}</div>
          <div style="font-size:11px;color:var(--text-light);">${escapeHtml(r.bedNumber || 'Bed')}</div>
        </td>
        <td>
          <div style="font-size:12px;">${r.admissionDate}</div>
          <div style="font-size:11px;font-weight:700;color:var(--navy);">${days} ${days === 1 ? 'Day' : 'Days'}</div>
        </td>
        <td style="max-width:140px;">
          <div style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(r.admittingDiagnosis || '')}">
            ${escapeHtml(r.admittingDiagnosis || '—')}
          </div>
          ${surgBadge}
        </td>
        <td>
          ${statusBadge}
        </td>
        <td>
          <div style="font-size:12px;font-weight:700;color:var(--teal);">
            Rs. ${(r.billing?.netPayable || 0).toLocaleString('en-PK')}
          </div>
          <div style="font-size:10.5px;color:var(--text-light);">${r.billing?.paymentStatus || 'Paid'}</div>
        </td>
        <td>
          <div style="display:flex;gap:4px;flex-wrap:wrap;">
            <button type="button" class="ipd-btn-action" onclick="loadAdmissionRecord('${r.admissionId}')" title="Edit & View All Details">✏ Edit</button>
            <button type="button" class="ipd-btn-action print" onclick="directPrintAdmissionDoc('${r.admissionId}', 'discharge')" title="Print Discharge Summary">🚪 Discharge</button>
            <button type="button" class="ipd-btn-action print" onclick="directPrintAdmissionDoc('${r.admissionId}', 'bill')" title="Print Hospital Bill">💳 Bill</button>
            <button type="button" class="ipd-btn-action print" onclick="directPrintAdmissionDoc('${r.admissionId}', 'consent')" title="Print Consent">📝 Consent</button>
            <button type="button" class="ipd-btn-action print" onclick="directPrintAdmissionDoc('${r.admissionId}', 'certificate')" title="Print Certificate">📜 Cert</button>
            <button type="button" class="ipd-btn-action del" onclick="confirmDeleteAdmission('${r.admissionId}')" title="Delete Admission">✕</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

async function updateIPDActiveCount(records) {
  const all = records || (await HMC_DB.getAllAdmissions());
  const activeCount = all.filter(r => r.status !== 'Discharged').length;
  
  const badge = document.getElementById('ipd-active-count-badge');
  if (badge) {
    badge.textContent = activeCount;
    badge.style.display = activeCount > 0 ? 'inline-flex' : 'none';
  }

  const statActive = document.getElementById('ipd-stat-active-val');
  if (statActive) statActive.textContent = activeCount;

  const statTotal = document.getElementById('ipd-stat-total-val');
  if (statTotal) statTotal.textContent = all.length;
}

async function confirmDeleteAdmission(admId) {
  if (typeof customConfirm === 'function') {
    const ok = await customConfirm(`Are you sure you want to delete Admission Record ${admId}?`);
    if (!ok) return;
  } else {
    if (!confirm(`Delete Admission Record ${admId}?`)) return;
  }

  try {
    await HMC_DB.deleteAdmission(admId);
    showToast(`Admission ${admId} deleted.`, 'info');
    if (_currentAdmission && _currentAdmission.admissionId === admId) {
      resetIPDForm();
    }
    renderActiveAdmissionsTable();
  } catch (err) {
    showToast('Failed to delete: ' + err.message, 'error');
  }
}

async function directPrintAdmissionDoc(admId, docType) {
  await loadAdmissionRecord(admId);
  openIPDPrint(docType);
}

// ── PRINTABLE DOCUMENTS GENERATOR ───────────────────────────────────
function openIPDPrint(docType) {
  // Ensure data is synced
  syncConsentFields();
  syncCertificateFields();
  calculateIPDBill();

  const modal = document.getElementById('modal-ipd-print');
  const printTitle = document.getElementById('ipd-print-title');
  const printContainer = document.getElementById('ipd-print-sheet-content');
  if (!modal || !printContainer) return;

  const adm = _currentAdmission || buildAdmissionFromInputs();

  let html = '';
  if (docType === 'consent') {
    printTitle.textContent = '🖨 Surgical & Medical Consent Form — Hajra Medical Complex';
    html = buildConsentPrintHTML(adm);
  } else if (docType === 'discharge') {
    printTitle.textContent = '🖨 Hospital Discharge Summary — Hajra Medical Complex';
    html = buildDischargePrintHTML(adm);
  } else if (docType === 'bill') {
    printTitle.textContent = '🖨 Indoor Hospital Bill & Receipt — Hajra Medical Complex';
    html = buildHospitalBillPrintHTML(adm);
  } else if (docType === 'certificate') {
    printTitle.textContent = '🖨 Medical Fitness & Sick Leave Certificate — Hajra Medical Complex';
    html = buildCertificatePrintHTML(adm);
  }

  printContainer.innerHTML = html;
  modal.classList.add('open');
}

function closeIPDPrint() {
  document.getElementById('modal-ipd-print')?.classList.remove('open');
}

function triggerIPDPrint() {
  window.print();
}

function buildAdmissionFromInputs() {
  const stayDays = calculateStayDays();
  return {
    admissionId: getVal('ipd-record-id') || 'ADM-DRAFT',
    mrNumber: getVal('ipd-patient-mr') || 'MR-XXXXX',
    patientName: getVal('ipd-patient-name') || 'Patient Name',
    parentage: getVal('ipd-patient-parent') || '',
    relation: getVal('ipd-patient-relation') || 'S/O',
    age: getVal('ipd-patient-age') || '',
    gender: getVal('ipd-patient-gender') || 'Male',
    phone: getVal('ipd-patient-phone') || '',
    cnic: getVal('ipd-patient-cnic') || '',
    address: getVal('ipd-patient-address') || '',
    emergencyContact: getVal('ipd-patient-emergency') || '',
    admissionDate: getVal('ipd-adm-date') || HMC_DB.getPSTDate(),
    admissionTime: getVal('ipd-adm-time') || HMC_DB.getPSTTime(),
    ward: getVal('ipd-adm-ward') || 'General Ward',
    bedNumber: getVal('ipd-adm-bed') || 'Bed #1',
    admittingDiagnosis: getVal('ipd-adm-diagnosis') || '',
    consultant: getVal('ipd-adm-consultant') || 'Dr. Hafiz Ehsan Qadeer',
    initialVitals: {
      bp: getVal('ipd-adm-bp'),
      pulse: getVal('ipd-adm-pulse'),
      temp: getVal('ipd-adm-temp'),
      weight: getVal('ipd-adm-weight'),
      spo2: getVal('ipd-adm-spo2')
    },
    status: getVal('ipd-record-status') || 'Admitted',
    surgery: {
      procedure: getVal('ipd-surg-procedure') || '',
      date: getVal('ipd-surg-date') || '',
      time: getVal('ipd-surg-time') || '',
      surgeon: getVal('ipd-surg-surgeon') || 'Dr. Hafiz Ehsan Qadeer',
      assistant: getVal('ipd-surg-assistant') || '',
      anesthetist: getVal('ipd-surg-anesthetist') || '',
      anesthesiaType: getVal('ipd-surg-anesthesia-type') || 'Spinal',
      preOpDiag: getVal('ipd-surg-preop') || '',
      postOpDiag: getVal('ipd-surg-postop') || '',
      findings: getVal('ipd-surg-findings') || '',
      operativeNotes: getVal('ipd-surg-notes') || ''
    },
    discharge: {
      dischargeDate: getVal('ipd-dis-date') || '',
      dischargeTime: getVal('ipd-dis-time') || '',
      stayDays: stayDays,
      condition: getVal('ipd-dis-condition') || 'Improved',
      finalDiagnosis: getVal('ipd-dis-diagnosis') || getVal('ipd-adm-diagnosis') || '',
      hospitalCourse: getVal('ipd-dis-course') || '',
      dischargeMeds: getVal('ipd-dis-meds') || '',
      followupDate: getVal('ipd-dis-followup') || '',
      instructions: getVal('ipd-dis-instructions') || ''
    },
    billing: {
      roomRate: parseFloat(getVal('ipd-bill-room-rate')) || 0,
      days: parseFloat(getVal('ipd-bill-days')) || stayDays,
      roomTotal: parseFloat(getVal('ipd-bill-room-total')) || 0,
      otCharges: parseFloat(getVal('ipd-bill-ot')) || 0,
      surgeonFee: parseFloat(getVal('ipd-bill-surgeon')) || 0,
      anesthesiaFee: parseFloat(getVal('ipd-bill-anesthesia')) || 0,
      medicinesFee: parseFloat(getVal('ipd-bill-meds')) || 0,
      nursingFee: parseFloat(getVal('ipd-bill-nursing')) || 0,
      labFee: parseFloat(getVal('ipd-bill-lab')) || 0,
      otherCharges: parseFloat(getVal('ipd-bill-others')) || 0,
      grossTotal: parseFloat(getVal('ipd-bill-gross')) || 0,
      discount: parseFloat(getVal('ipd-bill-discount')) || 0,
      advancePaid: parseFloat(getVal('ipd-bill-advance')) || 0,
      netPayable: parseFloat(getVal('ipd-bill-net')) || 0,
      paymentStatus: getVal('ipd-bill-status') || 'Paid'
    },
    certificate: {
      type: getVal('ipd-cert-type') || 'Medical Rest',
      fromDate: getVal('ipd-cert-from') || '',
      toDate: getVal('ipd-cert-to') || '',
      days: getVal('ipd-cert-days') || 1,
      diagnosis: getVal('ipd-cert-diag') || '',
      remarks: getVal('ipd-cert-remarks') || ''
    }
  };
}

// ── HTML BUILDERS FOR PRINT DOCUMENTS ───────────────────────────────

// 1. SURGICAL CONSENT FORM (Urdu & English)
function buildConsentPrintHTML(adm) {
  const p = adm;
  const s = adm.surgery || {};
  return `
    <div class="ipd-print-doc" id="ipd-print-page">
      <img src="assets/prescription-header.png" class="rx-header-img" alt="Hajra Medical Complex" />
      
      <div class="ipd-doc-title-bar">
        <h2>طبی و جراحی و اینستھیزیا رضامندی نامہ</h2>
        <h3>SURGICAL & ANESTHESIA INFORMED CONSENT FORM</h3>
      </div>

      <table class="ipd-meta-table">
        <tr>
          <td style="width:15%;"><strong>Patient Name:</strong></td>
          <td style="width:35%;">${escapeHtml(p.patientName)}</td>
          <td style="width:15%;"><strong>MR Number:</strong></td>
          <td style="width:35%;">${escapeHtml(p.mrNumber)}</td>
        </tr>
        <tr>
          <td><strong>Father/Husband:</strong></td>
          <td>${escapeHtml((p.relation || 'S/O') + ' ' + (p.parentage || '—'))}</td>
          <td><strong>Admission ID:</strong></td>
          <td>${escapeHtml(p.admissionId)}</td>
        </tr>
        <tr>
          <td><strong>Age / Gender:</strong></td>
          <td>${escapeHtml(p.age ? p.age + ' Years' : '—')} / ${escapeHtml(p.gender || '—')}</td>
          <td><strong>Ward & Bed:</strong></td>
          <td>${escapeHtml(p.ward || '—')} (${escapeHtml(p.bedNumber || '—')})</td>
        </tr>
        <tr>
          <td><strong>Contact / Phone:</strong></td>
          <td>${escapeHtml(p.phone || '—')}</td>
          <td><strong>Date of Consent:</strong></td>
          <td>${escapeHtml(p.admissionDate || HMC_DB.getPSTDate())}</td>
        </tr>
        <tr>
          <td><strong>Proposed Surgery:</strong></td>
          <td colspan="3"><strong style="color:#0D2B45;font-size:11pt;">${escapeHtml(s.procedure || p.admittingDiagnosis || 'Surgical Procedure')}</strong></td>
        </tr>
        <tr>
          <td><strong>Surgeon Incharge:</strong></td>
          <td>${escapeHtml(s.surgeon || p.consultant || 'Dr. Hafiz Ehsan Qadeer')}</td>
          <td><strong>Anesthesia Type:</strong></td>
          <td>${escapeHtml(s.anesthesiaType || 'General / Spinal / Local')}</td>
        </tr>
      </table>

      <!-- Urdu Legal Informed Consent Text -->
      <div class="ipd-consent-urdu-box">
        <h4 style="font-family:var(--font-urdu);text-align:right;color:#0D2B45;margin-bottom:8px;font-size:12.5pt;">اقرار نامہ و رضامندی برائے آپریشن و بے ہوشی</h4>
        <p>
          میں مسمی/مسمات <strong>${escapeHtml(p.patientName)}</strong> ولد/زوجہ <strong>${escapeHtml(p.parentage || '—')}</strong>، 
          عمر <strong>${escapeHtml(p.age || '—')}</strong> سال، ساکن <strong>${escapeHtml(p.address || '—')}</strong>، 
          ہوش و حواس خمسہ میں بلا جبر و اکراہ، اپنی / اپنے مریض کی جراحی/آپریشن بنام 
          <strong style="text-decoration:underline;">${escapeHtml(s.procedure || p.admittingDiagnosis || 'مطلوبہ آپریشن')}</strong> 
          کی مکمل رضامندی ڈاکٹر صاحب <strong>${escapeHtml(s.surgeon || 'ڈاکٹر حافظ احسان قدیر')}</strong> اور ان کی ٹیم کو دیتا/دیتی ہوں۔
        </p>
        <p>
          مجھے آپریشن اور اینستھیزیا (بے ہوشی/سن کرنے) کے طریقہ کار، متوقع فوائد اور اس سے وابستہ تمام تر ممکنہ خطرات اور پیچیدگیوں سے 
          ڈاکٹر صاحب نے مادری زبان میں تفصیلاً آگاہ کر دیا ہے اور میں نے اس کو مکمل طور پر سمجھ لیا ہے۔
        </p>
        <p>
          دورانِ آپریشن یا بعد از آپریشن کسی بھی غیر متوقع ہنگامی صورتحال، اضافی طریقہ کار یا خون کی منتقلی (Blood Transfusion) کی ضرورت پڑنے پر 
          میں ڈاکٹر صاحب کو مریض کے بہترین مفاد میں فوری فیصلہ کرنے کا مکمل قانونی اختیار دیتا/دیتی ہوں۔ 
          میں علاج و جراحی کے دوران پیش آنے والی کسی بھی غیر متوقع قدرتی یا طبی پیچیدگی کی صورت میں ہسپتال، ڈاکٹر یا پیرا میڈیکل عملے کو قانونی یا مالی طور پر ذمہ دار نہیں ٹھہراؤں گا/گی۔
        </p>
      </div>

      <!-- English Legal Statement -->
      <div class="ipd-consent-eng-box">
        <p><strong>Declaration:</strong> I hereby give my free and voluntary consent for the administration of anesthesia and performance of the surgical operation mentioned above. The nature, purpose, risks, and possible alternatives have been explained to me in a language I understand. I authorize the medical staff to take necessary emergency measures if required during treatment.</p>
      </div>

      <!-- Signatures Row -->
      <div class="ipd-signature-grid" style="margin-top:20px;">
        <div class="ipd-sig-box">
          <div class="ipd-sig-line"></div>
          <div><strong>Signature / Thumb of Patient / Guardian</strong></div>
          <div style="font-family:var(--font-urdu);font-size:10pt;">دستخط یا نشانِ انگوٹھا مریض / ولی</div>
          <div style="font-size:9pt;color:#666;margin-top:3px;">CNIC: ${escapeHtml(p.cnic || '_____________________')}</div>
        </div>
        <div class="ipd-sig-box">
          <div class="ipd-sig-line"></div>
          <div><strong>Witness Signature</strong></div>
          <div style="font-family:var(--font-urdu);font-size:10pt;">دستخط گواہ</div>
          <div style="font-size:9pt;color:#666;margin-top:3px;">Name: _____________________</div>
        </div>
        <div class="ipd-sig-box">
          <div class="ipd-sig-line"></div>
          <div><strong>Operating Surgeon / Doctor</strong></div>
          <div style="font-size:9pt;color:#666;margin-top:2px;">Dr. Hafiz Ehsan Qadeer (M.B.B.S. PB)</div>
          <div style="font-size:8.5pt;color:#666;">PMDC: 98762-P · PHC: 2025/92172</div>
        </div>
      </div>

      <div class="ipd-print-footer">
        Hajra Medical Complex · Adda Jhaal, Faisalabad Road, Jaranwala · Ph: 041-4711753 / 0313-6530553
      </div>
    </div>`;
}

// 2. DISCHARGE SUMMARY (A4 Print Layout)
function buildDischargePrintHTML(adm) {
  const p = adm;
  const s = adm.surgery || {};
  const d = adm.discharge || {};
  return `
    <div class="ipd-print-doc" id="ipd-print-page">
      <img src="assets/prescription-header.png" class="rx-header-img" alt="Hajra Medical Complex" />
      
      <div class="ipd-doc-title-bar discharge">
        <h2>DISCHARGE SUMMARY / DISCHARGE SLIP</h2>
        <h3>ڈسچارج سلپ و خلاصہ علاج</h3>
      </div>

      <table class="ipd-meta-table">
        <tr>
          <td style="width:15%;"><strong>Patient Name:</strong></td>
          <td style="width:35%;"><strong style="font-size:11pt;">${escapeHtml(p.patientName)}</strong></td>
          <td style="width:15%;"><strong>MR Number:</strong></td>
          <td style="width:35%;"><strong style="color:var(--teal);">${escapeHtml(p.mrNumber)}</strong></td>
        </tr>
        <tr>
          <td><strong>Father/Husband:</strong></td>
          <td>${escapeHtml((p.relation || 'S/O') + ' ' + (p.parentage || '—'))}</td>
          <td><strong>Admission ID:</strong></td>
          <td>${escapeHtml(p.admissionId)}</td>
        </tr>
        <tr>
          <td><strong>Age / Gender:</strong></td>
          <td>${escapeHtml(p.age ? p.age + ' Y' : '—')} / ${escapeHtml(p.gender || '—')}</td>
          <td><strong>Ward & Bed:</strong></td>
          <td>${escapeHtml(p.ward || '—')} (${escapeHtml(p.bedNumber || '—')})</td>
        </tr>
        <tr>
          <td><strong>Admission Date:</strong></td>
          <td>${escapeHtml(p.admissionDate)} ${p.admissionTime ? 'at ' + p.admissionTime : ''}</td>
          <td><strong>Discharge Date:</strong></td>
          <td><strong>${escapeHtml(d.dischargeDate || HMC_DB.getPSTDate())}</strong> ${d.dischargeTime ? 'at ' + d.dischargeTime : ''}</td>
        </tr>
        <tr>
          <td><strong>Total Stay Duration:</strong></td>
          <td><strong style="color:#0D2B45;">${escapeHtml(String(d.stayDays || 1))} Day(s)</strong></td>
          <td><strong>Condition at Discharge:</strong></td>
          <td><strong style="color:#008060;">${escapeHtml(d.condition || 'Improved / Stable')}</strong></td>
        </tr>
        <tr>
          <td><strong>Attending Doctor:</strong></td>
          <td>${escapeHtml(p.consultant || 'Dr. Hafiz Ehsan Qadeer')}</td>
          <td><strong>Phone:</strong></td>
          <td>${escapeHtml(p.phone || '—')}</td>
        </tr>
      </table>

      <!-- Clinical Discharge Body Sections -->
      <div class="ipd-sec-block">
        <div class="ipd-sec-header">FINAL DIAGNOSIS:</div>
        <div class="ipd-sec-content bold-diag">${escapeHtml(d.finalDiagnosis || p.admittingDiagnosis || '—')}</div>
      </div>

      ${s.procedure ? `
      <div class="ipd-sec-block">
        <div class="ipd-sec-header">SURGICAL PROCEDURE PERFORMED:</div>
        <div class="ipd-sec-content">
          <strong>${escapeHtml(s.procedure)}</strong> · Date: ${s.date || '—'} · Surgeon: ${escapeHtml(s.surgeon || 'Dr. Hafiz Ehsan Qadeer')} (${escapeHtml(s.anesthesiaType || 'Anesthesia')})
          ${s.findings ? `<br/><span style="color:#475569;">Findings: ${escapeHtml(s.findings)}</span>` : ''}
        </div>
      </div>` : ''}

      <div class="ipd-sec-block">
        <div class="ipd-sec-header">BRIEF CLINICAL COURSE & HOSPITAL MANAGEMENT:</div>
        <div class="ipd-sec-content">${escapeHtml(d.hospitalCourse || 'Patient was admitted with the above diagnosis, managed conservatively / surgically according to standard clinical protocol. Progressed satisfactorily and being discharged in stable condition.')}</div>
      </div>

      <div class="ipd-sec-block">
        <div class="ipd-sec-header" style="background:#008060;color:#fff;">DISCHARGE MEDICATIONS / HOME TREATMENT (Rx):</div>
        <div class="ipd-sec-content" style="min-height:90px;white-space:pre-wrap;font-family:'Calibri',sans-serif;font-size:11pt;line-height:1.6;">${d.dischargeMeds ? escapeHtml(d.dischargeMeds) : 'Medicines as advised on separate prescription.'}</div>
      </div>

      <div class="ipd-sec-block">
        <div class="ipd-sec-header">DIETARY ADVICE & SPECIAL INSTRUCTIONS:</div>
        <div class="ipd-sec-content">${escapeHtml(d.instructions || 'Normal light diet. Avoid heavy exertion / lifting. Keep wound clean & dry. Report to emergency in case of acute fever, severe pain, or bleeding.')}</div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;margin:12px 0;">
        <div><strong>Follow-up / Next Visit:</strong> <span style="font-weight:700;color:var(--teal);">${escapeHtml(d.followupDate ? 'Revisit on ' + d.followupDate : 'After 7 Days')}</span></div>
        <div><strong>Emergency Helpline:</strong> 041-4711753 / 0313-6530553</div>
      </div>

      <!-- Signatures Row -->
      <div class="ipd-signature-grid" style="margin-top:28px;">
        <div class="ipd-sig-box">
          <div class="ipd-sig-line"></div>
          <div><strong>Patient / Attendant Signature</strong></div>
          <div style="font-size:9pt;color:#666;">Discharge received with instructions</div>
        </div>
        <div class="ipd-sig-box">
          <div class="ipd-sig-line"></div>
          <div><strong>Staff Nurse / Medical Officer</strong></div>
          <div style="font-size:9pt;color:#666;">Hajra Medical Complex</div>
        </div>
        <div class="ipd-sig-box">
          <div class="ipd-sig-line"></div>
          <div><strong>Consultant Incharge</strong></div>
          <div style="font-weight:700;">Dr. Hafiz Ehsan Qadeer</div>
          <div style="font-size:8.5pt;color:#666;">M.B.B.S. (PB) · Family Physician</div>
        </div>
      </div>

      <div class="ipd-print-footer">
        Hajra Medical Complex · Adda Jhaal, Faisalabad Road, Jaranwala · Ph: 041-4711753 / 0313-6530553
      </div>
    </div>`;
}

// 3. INDOOR HOSPITAL BILL & RECEIPT (A4/A5 Print Layout)
function buildHospitalBillPrintHTML(adm) {
  const p = adm;
  const b = adm.billing || {};
  const d = adm.discharge || {};
  const stayDays = b.days || d.stayDays || 1;

  return `
    <div class="ipd-print-doc" id="ipd-print-page">
      <img src="assets/prescription-header.png" class="rx-header-img" alt="Hajra Medical Complex" />
      
      <div class="ipd-doc-title-bar billing">
        <h2>INDOOR PATIENT FINAL HOSPITAL BILL</h2>
        <h3>ہسپتال انڈور بل و فائنل رسید</h3>
      </div>

      <table class="ipd-meta-table">
        <tr>
          <td style="width:15%;"><strong>Patient Name:</strong></td>
          <td style="width:35%;"><strong style="font-size:11pt;">${escapeHtml(p.patientName)}</strong></td>
          <td style="width:15%;"><strong>Bill / Adm ID:</strong></td>
          <td style="width:35%;"><strong style="color:var(--teal);">${escapeHtml(p.admissionId)}</strong></td>
        </tr>
        <tr>
          <td><strong>Father/Husband:</strong></td>
          <td>${escapeHtml((p.relation || 'S/O') + ' ' + (p.parentage || '—'))}</td>
          <td><strong>MR Number:</strong></td>
          <td>${escapeHtml(p.mrNumber)}</td>
        </tr>
        <tr>
          <td><strong>Age / Gender:</strong></td>
          <td>${escapeHtml(p.age ? p.age + ' Y' : '—')} / ${escapeHtml(p.gender || '—')}</td>
          <td><strong>Ward & Bed:</strong></td>
          <td>${escapeHtml(p.ward || '—')} (${escapeHtml(p.bedNumber || '—')})</td>
        </tr>
        <tr>
          <td><strong>Admission Date:</strong></td>
          <td>${escapeHtml(p.admissionDate)}</td>
          <td><strong>Discharge Date:</strong></td>
          <td>${escapeHtml(d.dischargeDate || HMC_DB.getPSTDate())}</td>
        </tr>
        <tr>
          <td><strong>Total Stay Duration:</strong></td>
          <td><strong>${stayDays} Day(s)</strong></td>
          <td><strong>Procedure / Diag:</strong></td>
          <td>${escapeHtml(p.surgery?.procedure || p.admittingDiagnosis || '—')}</td>
        </tr>
      </table>

      <!-- Itemized Billing Table -->
      <table class="ipd-bill-table" style="margin-top:14px;">
        <thead>
          <tr>
            <th style="width:8%;text-align:center;">Sr.#</th>
            <th style="width:52%;">Description of Hospital Services & Charges</th>
            <th style="width:15%;text-align:center;">Unit / Days</th>
            <th style="width:25%;text-align:right;">Amount (PKR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align:center;">1</td>
            <td>Room / Bed Charges (${escapeHtml(p.ward || 'General')} @ Rs. ${b.roomRate || 0}/day)</td>
            <td style="text-align:center;">${stayDays}</td>
            <td style="text-align:right;">Rs. ${(b.roomTotal || 0).toLocaleString('en-PK')}</td>
          </tr>
          ${b.otCharges ? `
          <tr>
            <td style="text-align:center;">2</td>
            <td>Operation Theatre (O.T) & Equipment Charges</td>
            <td style="text-align:center;">1</td>
            <td style="text-align:right;">Rs. ${b.otCharges.toLocaleString('en-PK')}</td>
          </tr>` : ''}
          ${b.surgeonFee ? `
          <tr>
            <td style="text-align:center;">3</td>
            <td>Surgeon Procedure & Operation Fee</td>
            <td style="text-align:center;">1</td>
            <td style="text-align:right;">Rs. ${b.surgeonFee.toLocaleString('en-PK')}</td>
          </tr>` : ''}
          ${b.anesthesiaFee ? `
          <tr>
            <td style="text-align:center;">4</td>
            <td>Anesthesia & Anesthetist Charges</td>
            <td style="text-align:center;">1</td>
            <td style="text-align:right;">Rs. ${b.anesthesiaFee.toLocaleString('en-PK')}</td>
          </tr>` : ''}
          ${b.medicinesFee ? `
          <tr>
            <td style="text-align:center;">5</td>
            <td>Hospital Medicines, IV Fluids & Surgical Consumables</td>
            <td style="text-align:center;">—</td>
            <td style="text-align:right;">Rs. ${b.medicinesFee.toLocaleString('en-PK')}</td>
          </tr>` : ''}
          ${b.nursingFee ? `
          <tr>
            <td style="text-align:center;">6</td>
            <td>Nursing Care & Daily Doctor Inpatient Visits</td>
            <td style="text-align:center;">${stayDays}</td>
            <td style="text-align:right;">Rs. ${b.nursingFee.toLocaleString('en-PK')}</td>
          </tr>` : ''}
          ${b.labFee ? `
          <tr>
            <td style="text-align:center;">7</td>
            <td>Laboratory & Diagnostic Investigations</td>
            <td style="text-align:center;">—</td>
            <td style="text-align:right;">Rs. ${b.labFee.toLocaleString('en-PK')}</td>
          </tr>` : ''}
          ${b.otherCharges ? `
          <tr>
            <td style="text-align:center;">8</td>
            <td>Miscellaneous / Special Equipment</td>
            <td style="text-align:center;">—</td>
            <td style="text-align:right;">Rs. ${b.otherCharges.toLocaleString('en-PK')}</td>
          </tr>` : ''}
        </tbody>
        <tfoot>
          <tr style="border-top:2px solid #0D2B45;font-weight:700;">
            <td colspan="3" style="text-align:right;">Gross Hospital Charges:</td>
            <td style="text-align:right;">Rs. ${(b.grossTotal || 0).toLocaleString('en-PK')}</td>
          </tr>
          ${b.discount ? `
          <tr style="color:#008060;">
            <td colspan="3" style="text-align:right;">Discount / Concession:</td>
            <td style="text-align:right;">- Rs. ${b.discount.toLocaleString('en-PK')}</td>
          </tr>` : ''}
          ${b.advancePaid ? `
          <tr style="color:#0D2B45;">
            <td colspan="3" style="text-align:right;">Advance Deposit Paid:</td>
            <td style="text-align:right;">- Rs. ${b.advancePaid.toLocaleString('en-PK')}</td>
          </tr>` : ''}
          <tr style="font-size:12pt;font-weight:800;background:#E6F5F0;color:#008060;">
            <td colspan="3" style="text-align:right;">NET AMOUNT PAYABLE:</td>
            <td style="text-align:right;font-size:13pt;">Rs. ${(b.netPayable || 0).toLocaleString('en-PK')}</td>
          </tr>
        </tfoot>
      </table>

      <div style="margin-top:12px;padding:8px 12px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
        <div><strong>Payment Status:</strong> <span class="ipd-badge ${b.paymentStatus === 'Paid' ? 'active' : 'surgery'}">${escapeHtml(b.paymentStatus || 'Paid')}</span></div>
        <div><strong>Official Receipt Printed:</strong> ${HMC_DB.getPSTDate()} ${HMC_DB.getPSTTime()}</div>
      </div>

      <!-- Signatures Row -->
      <div class="ipd-signature-grid" style="margin-top:35px;">
        <div class="ipd-sig-box">
          <div class="ipd-sig-line"></div>
          <div><strong>Patient / Payer Signature</strong></div>
          <div style="font-size:9pt;color:#666;">Received original paid receipt</div>
        </div>
        <div class="ipd-sig-box">
          <div class="ipd-sig-line"></div>
          <div><strong>Accounts / Cashier</strong></div>
          <div style="font-size:9pt;color:#666;">Hajra Medical Complex</div>
        </div>
        <div class="ipd-sig-box">
          <div class="ipd-sig-line"></div>
          <div><strong>Medical Superintendent</strong></div>
          <div style="font-size:9pt;color:#666;">Authorized Signatory & Stamp</div>
        </div>
      </div>

      <div class="ipd-print-footer">
        Hajra Medical Complex · Adda Jhaal, Faisalabad Road, Jaranwala · Ph: 041-4711753 / 0313-6530553
      </div>
    </div>`;
}

// 4. MEDICAL FITNESS & SICK LEAVE CERTIFICATE (A4/A5 Print Layout)
function buildCertificatePrintHTML(adm) {
  const p = adm;
  const c = adm.certificate || {};
  const isFitness = c.type === 'Fitness Certificate';

  return `
    <div class="ipd-print-doc" id="ipd-print-page">
      <img src="assets/prescription-header.png" class="rx-header-img" alt="Hajra Medical Complex" />
      
      <div class="ipd-doc-title-bar cert">
        <h2>${isFitness ? 'MEDICAL FITNESS CERTIFICATE' : 'MEDICAL CERTIFICATE FOR SICK LEAVE'}</h2>
        <h3>${isFitness ? 'میڈیکل فٹنس سرٹیفکیٹ برائے صحت و تندرستی' : 'طبی رخصت نامہ / بیماری کا تصدیق نامہ'}</h3>
      </div>

      <div style="text-align:right;font-size:10pt;color:#333;margin:8px 0 16px 0;">
        <strong>Certificate Ref #:</strong> HMC-MED/${escapeHtml(p.admissionId || 'CERT')}<br/>
        <strong>Date of Issue:</strong> ${escapeHtml(HMC_DB.getPSTDate())}
      </div>

      <div class="ipd-cert-content-box">
        <p style="font-size:12pt;line-height:2;text-align:justify;">
          This is to solemnly certify that <strong>${escapeHtml(p.patientName)}</strong>, 
          ${escapeHtml(p.relation || 'S/O')} <strong>${escapeHtml(p.parentage || '—')}</strong>, 
          aged <strong>${escapeHtml(p.age ? p.age + ' Years' : '—')}</strong>, 
          resident of <strong>${escapeHtml(p.address || '—')}</strong>, 
          bearing MR# <strong>${escapeHtml(p.mrNumber)}</strong> 
          ${p.cnic ? '(CNIC: ' + escapeHtml(p.cnic) + ')' : ''}, 
          has been under my medical examination, observation, and treatment at Hajra Medical Complex Jaranwala.
        </p>

        <p style="font-size:12pt;line-height:2;margin-top:14px;">
          <strong>Clinical Diagnosis:</strong> <span style="font-size:12.5pt;font-weight:700;color:#0D2B45;">${escapeHtml(c.diagnosis || p.admittingDiagnosis || 'Under medical/surgical treatment')}</span>
        </p>

        ${isFitness ? `
        <p style="font-size:12pt;line-height:2;margin-top:14px;background:#E6F5F0;padding:14px;border-left:4px solid #008060;border-radius:6px;">
          I have carefully examined the patient today and found that ${p.gender === 'Female' ? 'she' : 'he'} has recovered satisfactorily from the illness/surgery and is 
          <strong>MEDICALLY FIT</strong> to resume official duties / studies / physical work with effect from 
          <strong>${escapeHtml(c.toDate || HMC_DB.getPSTDate())}</strong>.
        </p>` : `
        <p style="font-size:12pt;line-height:2;margin-top:14px;background:#FEF3C7;padding:14px;border-left:4px solid #D97706;border-radius:6px;">
          In my considered clinical opinion, the patient required complete bed rest and absence from duty / school for the restoration of health for a period of 
          <strong>${escapeHtml(String(c.days || 1))} Day(s)</strong>, with effect from 
          <strong>${escapeHtml(c.fromDate || p.admissionDate || HMC_DB.getPSTDate())}</strong> to 
          <strong>${escapeHtml(c.toDate || HMC_DB.getPSTDate())}</strong>.
        </p>`}

        ${c.remarks ? `
        <p style="font-size:11pt;color:#475569;margin-top:10px;">
          <strong>Special Remarks / Instructions:</strong> ${escapeHtml(c.remarks)}
        </p>` : ''}
      </div>

      <!-- Signatures Row -->
      <div class="ipd-signature-grid" style="margin-top:50px;">
        <div class="ipd-sig-box">
          <div class="ipd-sig-line"></div>
          <div><strong>Signature / Thumb Impression of Patient</strong></div>
          <div style="font-size:9pt;color:#666;">Specimen Signature: __________________</div>
        </div>
        <div class="ipd-sig-box">
          <div class="ipd-sig-line"></div>
          <div><strong>Authorized Medical Officer / Consultant</strong></div>
          <div style="font-weight:700;font-size:11pt;">Dr. Hafiz Ehsan Qadeer</div>
          <div style="font-size:9.5pt;color:#333;">M.B.B.S. (PB) · Family Physician</div>
          <div style="font-size:9pt;color:#666;">PMDC: 98762-P · PHC: 2025/92172</div>
        </div>
      </div>

      <div class="ipd-print-footer">
        Hajra Medical Complex · Adda Jhaal, Faisalabad Road, Jaranwala · Ph: 041-4711753 / 0313-6530553
      </div>
    </div>`;
}

// ── UTILITY HELPERS ─────────────────────────────────────────────────
function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = (val !== undefined && val !== null) ? val : '';
}

function setTxt(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val || '';
}

// Auto-boot IPD when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => initIPD(), 300);
});
