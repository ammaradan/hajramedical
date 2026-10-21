/**
 * Hajra Medical Complex, Jaranwala
 * IndexedDB Database Management Module (js/db.js)
 * Fully offline-capable, high performance, structured storage
 */

const DB_NAME = 'HajraMedicalDB';
const DB_VERSION = 1;

let _dbInstance = null;

function getPSTDate() {
  const pst = new Date(Date.now() + 5 * 3600000);
  return pst.toISOString().slice(0, 10);
}

function getPSTTime() {
  const pst = new Date(Date.now() + 5 * 3600000);
  return pst.toISOString().slice(11, 19);
}

function initDB() {
  return new Promise((resolve, reject) => {
    if (_dbInstance) return resolve(_dbInstance);
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      // Patients store
      if (!db.objectStoreNames.contains('patients')) {
        const pStore = db.createObjectStore('patients', { keyPath: 'mrNumber' });
        pStore.createIndex('name', 'name', { unique: false });
        pStore.createIndex('phone', 'phone', { unique: false });
        pStore.createIndex('cnic', 'cnic', { unique: false });
        pStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // Visits store
      if (!db.objectStoreNames.contains('visits')) {
        const vStore = db.createObjectStore('visits', { keyPath: 'serialNo', autoIncrement: true });
        vStore.createIndex('mrNumber', 'mrNumber', { unique: false });
        vStore.createIndex('date', 'date', { unique: false });
        vStore.createIndex('visitNo', 'visitNo', { unique: false });
      }

      // Payments store
      if (!db.objectStoreNames.contains('payments')) {
        const payStore = db.createObjectStore('payments', { keyPath: 'paymentId' });
        payStore.createIndex('receiptNo', 'receiptNo', { unique: true });
        payStore.createIndex('mrNumber', 'mrNumber', { unique: false });
        payStore.createIndex('date', 'date', { unique: false });
      }

      // Appointments store
      if (!db.objectStoreNames.contains('appointments')) {
        const apptStore = db.createObjectStore('appointments', { keyPath: 'id' });
        apptStore.createIndex('date', 'date', { unique: false });
        apptStore.createIndex('token', 'token', { unique: false });
      }

      // Templates store
      if (!db.objectStoreNames.contains('templates')) {
        const tplStore = db.createObjectStore('templates', { keyPath: 'id' });
        tplStore.createIndex('cat', 'cat', { unique: false });
      }
    };

    req.onsuccess = (e) => {
      _dbInstance = e.target.result;
      seedDefaultTemplatesIfNeeded().then(() => resolve(_dbInstance));
    };

    req.onerror = (e) => reject(e.target.error);
  });
}

function seedDefaultTemplatesIfNeeded() {
  return new Promise((resolve) => {
    if (!_dbInstance) return resolve();
    const tx = _dbInstance.transaction('templates', 'readwrite');
    const store = tx.objectStore('templates');
    const countReq = store.count();

    countReq.onsuccess = () => {
      if (countReq.result === 0 && window.DEFAULT_CLINICAL_TEMPLATES) {
        window.DEFAULT_CLINICAL_TEMPLATES.forEach(tpl => store.put(tpl));
      }
      resolve();
    };
    countReq.onerror = () => resolve();
  });
}

// ── PATIENT & VISIT FUNCTIONS ───────────────────────────────────────

async function getNextMRNumber() {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction('patients', 'readonly');
    const store = tx.objectStore('patients');
    const req = store.getAllKeys();

    req.onsuccess = () => {
      const keys = req.result || [];
      let maxNum = 0;
      keys.forEach(k => {
        const m = String(k).match(/(?:HMC|PAT|MR)-(\d+)/i);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maxNum) maxNum = n;
        }
      });
      const nextId = 'HMC-' + String(maxNum + 1).padStart(5, '0');
      resolve(nextId);
    };
    req.onerror = () => resolve('HMC-00001');
  });
}

async function savePatientRecord(formData) {
  const db = await initDB();
  let mr = (formData.mrNumber || '').trim();
  if (!mr) {
    mr = await getNextMRNumber();
    formData.mrNumber = mr;
  }

  const today = formData.date || getPSTDate();
  const now = formData.time || getPSTTime();

  // Check previous visits for this patient
  const visits = await getPatientVisits(mr);
  let visitNo = (visits && visits.length > 0) ? (visits.length + 1) : 1;
  if (formData.visitNo && !isNaN(parseInt(formData.visitNo, 10)) && !formData.autoVisit) {
    visitNo = parseInt(formData.visitNo, 10);
  }
  formData.visitNo = visitNo;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['patients', 'visits'], 'readwrite');
    const pStore = tx.objectStore('patients');
    const vStore = tx.objectStore('visits');

    // 1. Patient Profile
    const patientProfile = {
      mrNumber: mr,
      name: formData.name || '',
      relation: formData.relation || 'S/O',
      parentage: formData.parentage || '',
      age: formData.age || '',
      gender: formData.gender || 'Male',
      weight: formData.weight || '',
      phone: formData.phone || '',
      address: formData.address || '',
      cnic: formData.cnic || '',
      updatedAt: today + ' ' + now
    };
    pStore.put(patientProfile);

    // 2. Visit Record
    const visitRecord = {
      mrNumber: mr,
      date: today,
      time: now,
      visitNo: visitNo,
      name: formData.name || '',
      relation: formData.relation || 'S/O',
      parentage: formData.parentage || '',
      age: formData.age || '',
      gender: formData.gender || 'Male',
      weight: formData.weight || '',
      phone: formData.phone || '',
      address: formData.address || '',
      cnic: formData.cnic || '',
      temp: formData.temp || '',
      bp: formData.bp || '',
      rr: formData.rr || '',
      pulse: formData.pulse || '',
      allergy: formData.allergy || '',
      symptoms: formData.symptoms || '',
      findings: formData.findings || '',
      comments: formData.comments || '',
      investigations: formData.investigations || '',
      diagnosis: formData.diagnosis || '',
      treatment: formData.treatment || '',
      revisit: formData.revisit || ''
    };

    const addReq = vStore.add(visitRecord);
    addReq.onsuccess = (e) => {
      const serialNo = e.target.result;
      visitRecord.serialNo = serialNo;
      resolve({ success: true, mrNumber: mr, serialNo: serialNo, visitNo: visitNo, message: 'Record saved successfully.' });
    };
    addReq.onerror = (e) => reject(e.target.error);
  });
}

async function updatePatientRecord(formData) {
  const db = await initDB();
  const serialNo = parseInt(formData.serialNo, 10);
  if (isNaN(serialNo)) {
    return savePatientRecord(formData);
  }

  const today = formData.date || getPSTDate();
  const now = formData.time || getPSTTime();
  const mr = formData.mrNumber;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['patients', 'visits'], 'readwrite');
    const pStore = tx.objectStore('patients');
    const vStore = tx.objectStore('visits');

    // Update patient master
    pStore.put({
      mrNumber: mr,
      name: formData.name || '',
      relation: formData.relation || 'S/O',
      parentage: formData.parentage || '',
      age: formData.age || '',
      gender: formData.gender || 'Male',
      weight: formData.weight || '',
      phone: formData.phone || '',
      address: formData.address || '',
      cnic: formData.cnic || '',
      updatedAt: today + ' ' + now
    });

    const getReq = vStore.get(serialNo);
    getReq.onsuccess = () => {
      const rec = getReq.result || {};
      Object.assign(rec, {
        mrNumber: mr,
        date: today,
        time: now,
        visitNo: formData.visitNo || rec.visitNo || 1,
        name: formData.name || '',
        relation: formData.relation || 'S/O',
        parentage: formData.parentage || '',
        age: formData.age || '',
        gender: formData.gender || 'Male',
        weight: formData.weight || '',
        phone: formData.phone || '',
        address: formData.address || '',
        cnic: formData.cnic || '',
        temp: formData.temp || '',
        bp: formData.bp || '',
        rr: formData.rr || '',
        pulse: formData.pulse || '',
        allergy: formData.allergy || '',
        symptoms: formData.symptoms || '',
        findings: formData.findings || '',
        comments: formData.comments || '',
        investigations: formData.investigations || '',
        diagnosis: formData.diagnosis || '',
        treatment: formData.treatment || '',
        revisit: formData.revisit || ''
      });
      vStore.put(rec);
      resolve({ success: true, message: 'Record updated successfully.' });
    };
    getReq.onerror = (e) => reject(e.target.error);
  });
}

async function getPatientVisits(mrNumber) {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction('visits', 'readonly');
    const store = tx.objectStore('visits');
    const idx = store.index('mrNumber');
    const req = idx.getAll(IDBKeyRange.only(mrNumber));

    req.onsuccess = () => {
      const visits = req.result || [];
      visits.sort((a, b) => (b.visitNo || 0) - (a.visitNo || 0));
      resolve(visits);
    };
    req.onerror = () => resolve([]);
  });
}

async function getVisitBySerial(serialNo) {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction('visits', 'readonly');
    const store = tx.objectStore('visits');
    const req = store.get(parseInt(serialNo, 10));
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

async function searchPatients(query) {
  if (!query || !query.trim()) return [];
  const q = query.trim().toLowerCase();
  const db = await initDB();

  return new Promise((resolve) => {
    const tx = db.transaction('visits', 'readonly');
    const store = tx.objectStore('visits');
    const req = store.getAll();

    req.onsuccess = () => {
      const all = req.result || [];
      const map = new Map();

      // Search across visits and deduplicate by MR (picking latest visit)
      all.forEach(v => {
        const name = (v.name || '').toLowerCase();
        const mr = (v.mrNumber || '').toLowerCase();
        const ph = (v.phone || '').toLowerCase();
        const addr = (v.address || '').toLowerCase();
        const cnic = (v.cnic || '').toLowerCase();

        if (name.includes(q) || mr.includes(q) || ph.includes(q) || addr.includes(q) || cnic.includes(q)) {
          if (!map.has(v.mrNumber) || (v.visitNo > (map.get(v.mrNumber).visitNo || 0))) {
            map.set(v.mrNumber, v);
          }
        }
      });

      const list = Array.from(map.values());
      list.sort((a, b) => (b.serialNo || 0) - (a.serialNo || 0));
      resolve(list);
    };
    req.onerror = () => resolve([]);
  });
}

async function getDashboardStats() {
  const db = await initDB();
  const today = getPSTDate();

  return new Promise((resolve) => {
    const tx = db.transaction('visits', 'readonly');
    const store = tx.objectStore('visits');
    const req = store.getAll();

    req.onsuccess = () => {
      const visits = req.result || [];
      const patMap = {};
      let todayCount = 0;
      let returningCount = 0;

      visits.forEach(v => {
        patMap[v.mrNumber] = (patMap[v.mrNumber] || 0) + 1;
        if (v.date === today) todayCount++;
        if (v.visitNo > 1) returningCount++;
      });

      resolve({
        totalPatients: Object.keys(patMap).length,
        todayPatients: todayCount,
        returningPatients: returningCount
      });
    };
    req.onerror = () => resolve({ totalPatients: 0, todayPatients: 0, returningPatients: 0 });
  });
}

async function getRecentPatients(limit = 10) {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction('visits', 'readonly');
    const store = tx.objectStore('visits');
    const req = store.getAll();

    req.onsuccess = () => {
      const visits = req.result || [];
      const seen = new Set();
      const recents = [];

      // Sort newest first
      visits.sort((a, b) => (b.serialNo || 0) - (a.serialNo || 0));

      for (const v of visits) {
        if (!seen.has(v.mrNumber)) {
          seen.add(v.mrNumber);
          recents.push(v);
          if (recents.length >= limit) break;
        }
      }
      resolve(recents);
    };
    req.onerror = () => resolve([]);
  });
}

// ── PAYMENTS & BILLING FUNCTIONS ────────────────────────────────────

async function getNextReceiptNumber() {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction('payments', 'readonly');
    const store = tx.objectStore('payments');
    const req = store.getAll();

    req.onsuccess = () => {
      const list = req.result || [];
      let maxNum = 0;
      list.forEach(p => {
        const m = String(p.receiptNo).match(/RCP-(\d+)/i);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maxNum) maxNum = n;
        }
      });
      resolve('RCP-' + String(maxNum + 1).padStart(5, '0'));
    };
    req.onerror = () => resolve('RCP-00001');
  });
}

async function savePaymentRecord(payData) {
  const db = await initDB();
  const payId = payData.paymentId || ('PAY-' + Date.now());
  const receiptNo = payData.receiptNo || await getNextReceiptNumber();
  const today = payData.date || getPSTDate();
  const now = getPSTDate() + ' ' + getPSTTime();

  const cFee = parseFloat(payData.consultFee) || 0;
  const proc = parseFloat(payData.procedure) || 0;
  const lab = parseFloat(payData.lab) || 0;
  const img = parseFloat(payData.imaging) || 0;
  const med = parseFloat(payData.medicine) || 0;
  const surg = parseFloat(payData.surgery) || 0;
  const cert = parseFloat(payData.cert) || 0;
  const emer = parseFloat(payData.emergency) || 0;
  const home = parseFloat(payData.homevisit) || 0;
  const cons = parseFloat(payData.consumables) || 0;
  const pkg = parseFloat(payData.package) || 0;
  const reg = parseFloat(payData.regfee) || 0;
  const tax = parseFloat(payData.tax) || 0;
  const oth = parseFloat(payData.other) || 0;
  const disc = parseFloat(payData.discount) || 0;

  const total = cFee + proc + lab + img + med + surg + cert + emer + home + cons + pkg + reg + tax + oth - disc;
  const received = parseFloat(payData.amtReceived) || 0;
  const balance = total - received;

  const paymentObj = {
    paymentId: payId,
    receiptNo: receiptNo,
    date: today,
    mrNumber: payData.mrNumber || '',
    patientName: payData.patientName || '',
    visitNo: payData.visitNo || '',
    consultFee: cFee,
    procedure: proc,
    lab: lab,
    imaging: img,
    medicine: med,
    surgery: surg,
    cert: cert,
    emergency: emer,
    homevisit: home,
    consumables: cons,
    package: pkg,
    regfee: reg,
    tax: tax,
    other: oth,
    discount: disc,
    total: total,
    amtReceived: received,
    balance: balance,
    payMethod: payData.payMethod || 'Cash',
    remarks: payData.remarks || '',
    createdAt: now
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('payments', 'readwrite');
    const store = tx.objectStore('payments');
    const req = store.put(paymentObj);

    req.onsuccess = () => resolve({ success: true, payment: paymentObj });
    req.onerror = (e) => reject(e.target.error);
  });
}

async function searchPayments(query) {
  if (!query || !query.trim()) return [];
  const q = query.trim().toLowerCase();
  const db = await initDB();

  return new Promise((resolve) => {
    const tx = db.transaction('payments', 'readonly');
    const store = tx.objectStore('payments');
    const req = store.getAll();

    req.onsuccess = () => {
      const list = req.result || [];
      const filtered = list.filter(p => {
        const rno = (p.receiptNo || '').toLowerCase();
        const mr = (p.mrNumber || '').toLowerCase();
        const name = (p.patientName || '').toLowerCase();
        const dt = (p.date || '').toLowerCase();
        return rno.includes(q) || mr.includes(q) || name.includes(q) || dt.includes(q);
      });
      filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      resolve(filtered);
    };
    req.onerror = () => resolve([]);
  });
}

async function getPaymentById(paymentId) {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction('payments', 'readonly');
    const store = tx.objectStore('payments');
    const req = store.get(paymentId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

async function deletePayment(paymentId) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('payments', 'readwrite');
    const store = tx.objectStore('payments');
    const req = store.delete(paymentId);
    req.onsuccess = () => resolve(true);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function getPaymentReport(filter) {
  const db = await initDB();
  const today = getPSTDate();
  let from = today;
  let to = today;

  const t = filter ? filter.type : 'today';
  if (t === 'today') {
    from = today; to = today;
  } else if (t === 'yesterday') {
    const yd = new Date(Date.now() + 5 * 3600000 - 86400000);
    from = yd.toISOString().slice(0, 10);
    to = from;
  } else if (t === 'week') {
    const now = new Date(Date.now() + 5 * 3600000);
    const day = now.getUTCDay();
    const diff = now.getTime() - day * 86400000;
    from = new Date(diff).toISOString().slice(0, 10);
    to = today;
  } else if (t === 'month') {
    from = today.slice(0, 7) + '-01';
    to = today;
  } else if (t === 'custom') {
    from = filter.from || today;
    to = filter.to || today;
  }

  return new Promise((resolve) => {
    const tx = db.transaction('payments', 'readonly');
    const store = tx.objectStore('payments');
    const req = store.getAll();

    req.onsuccess = () => {
      const list = req.result || [];
      const rows = [];
      const totals = {
        collection: 0,
        cash: 0,
        card: 0,
        jazzcash: 0,
        easypaisa: 0,
        bank: 0,
        discount: 0,
        outstanding: 0,
        count: 0
      };

      list.forEach(p => {
        if (!p.date || p.date < from || p.date > to) return;
        totals.count++;
        totals.collection += p.amtReceived;
        totals.discount += p.discount;
        totals.outstanding += p.balance;

        const m = (p.payMethod || '').toLowerCase();
        if (m === 'cash') totals.cash += p.amtReceived;
        else if (m === 'jazzcash') totals.jazzcash += p.amtReceived;
        else if (m === 'easypaisa') totals.easypaisa += p.amtReceived;
        else if (m.includes('bank')) totals.bank += p.amtReceived;
        else if (m.includes('card')) totals.card += p.amtReceived;

        rows.push(p);
      });

      rows.sort((a, b) => b.date.localeCompare(a.date));
      resolve({ success: true, from: from, to: to, totals: totals, rows: rows });
    };
    req.onerror = () => resolve({ success: false, from, to, totals: {}, rows: [] });
  });
}

// ── APPOINTMENTS FUNCTIONS ──────────────────────────────────────────

async function getAppointmentsByDate(dateStr) {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction('appointments', 'readonly');
    const store = tx.objectStore('appointments');
    const idx = store.index('date');
    const req = idx.getAll(IDBKeyRange.only(dateStr));

    req.onsuccess = () => {
      const list = req.result || [];
      list.sort((a, b) => (a.token || 0) - (b.token || 0));
      resolve(list);
    };
    req.onerror = () => resolve([]);
  });
}

async function saveAppointment(apptData) {
  const db = await initDB();
  const id = apptData.id || ('APP-' + Date.now());
  const date = apptData.date || getPSTDate();

  // If token not provided, calculate next token for that date
  let token = apptData.token;
  if (!token) {
    const existing = await getAppointmentsByDate(date);
    let max = 0;
    existing.forEach(a => { if (a.token > max) max = a.token; });
    token = max + 1;
  }

  const apptObj = {
    id: id,
    token: token,
    date: date,
    name: apptData.name || '',
    phone: apptData.phone || '',
    mr: apptData.mr || '',
    time: apptData.time || '',
    type: apptData.type || 'Consultation',
    notes: apptData.notes || '',
    status: apptData.status || 'waiting',
    waSent: apptData.waSent || false,
    createdAt: getPSTDate() + ' ' + getPSTTime()
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('appointments', 'readwrite');
    const store = tx.objectStore('appointments');
    const req = store.put(apptObj);
    req.onsuccess = () => resolve(apptObj);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function updateAppointmentStatus(apptId, status) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('appointments', 'readwrite');
    const store = tx.objectStore('appointments');
    const req = store.get(apptId);

    req.onsuccess = () => {
      const appt = req.result;
      if (!appt) return resolve(false);

      // If setting to 'next', ensure no other appointment on same day is 'next'
      if (status === 'next') {
        const allReq = store.getAll();
        allReq.onsuccess = () => {
          allReq.result.forEach(a => {
            if (a.date === appt.date && a.id !== appt.id && a.status === 'next') {
              a.status = 'waiting';
              store.put(a);
            }
          });
          appt.status = status;
          store.put(appt);
          resolve(true);
        };
      } else {
        appt.status = status;
        store.put(appt);
        resolve(true);
      }
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function deleteAppointment(apptId) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('appointments', 'readwrite');
    const store = tx.objectStore('appointments');
    const req = store.delete(apptId);
    req.onsuccess = () => resolve(true);
    req.onerror = (e) => reject(e.target.error);
  });
}

// ── TEMPLATES FUNCTIONS ─────────────────────────────────────────────

async function getTemplates() {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction('templates', 'readwrite');
    const store = tx.objectStore('templates');
    const req = store.getAll();
    req.onsuccess = () => {
      let list = req.result || [];
      const defaults = window.DEFAULT_CLINICAL_TEMPLATES || window.CLINICAL_TEMPLATES || [];
      if (defaults.length > 0) {
        const existingIds = new Set(list.map(t => t.id));
        defaults.forEach(defTpl => {
          if (!existingIds.has(defTpl.id)) {
            store.put(defTpl);
            list.push(defTpl);
          }
        });
      }
      resolve(list);
    };
    req.onerror = () => resolve(window.DEFAULT_CLINICAL_TEMPLATES || window.CLINICAL_TEMPLATES || []);
  });
}

async function saveTemplate(tpl) {
  const db = await initDB();
  const id = tpl.id || ('TPL-' + Date.now());
  const tplObj = {
    id: id,
    cat: tpl.cat || 'Recommendations',
    name: tpl.name || '',
    body: tpl.body || '',
    updatedAt: getPSTDate() + ' ' + getPSTTime()
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('templates', 'readwrite');
    const store = tx.objectStore('templates');
    const req = store.put(tplObj);
    req.onsuccess = () => resolve(tplObj);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function deleteTemplate(tplId) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('templates', 'readwrite');
    const store = tx.objectStore('templates');
    const req = store.delete(tplId);
    req.onsuccess = () => resolve(true);
    req.onerror = (e) => reject(e.target.error);
  });
}

// ── BACKUP, EXPORT & IMPORT ─────────────────────────────────────────

async function exportFullDatabase() {
  const db = await initDB();
  const stores = ['patients', 'visits', 'payments', 'appointments', 'templates'];
  const exportData = {
    clinic: 'Hajra Medical Complex Jaranwala',
    exportedAt: new Date().toISOString(),
    version: 1,
    data: {}
  };

  return new Promise((resolve) => {
    const tx = db.transaction(stores, 'readonly');
    let completed = 0;

    stores.forEach(sName => {
      const store = tx.objectStore(sName);
      const req = store.getAll();
      req.onsuccess = () => {
        exportData.data[sName] = req.result || [];
        completed++;
        if (completed === stores.length) {
          resolve(exportData);
        }
      };
      req.onerror = () => {
        exportData.data[sName] = [];
        completed++;
        if (completed === stores.length) resolve(exportData);
      };
    });
  });
}

async function importFullDatabase(importData) {
  if (!importData || !importData.data) {
    throw new Error('Invalid backup file format.');
  }

  const db = await initDB();
  const stores = ['patients', 'visits', 'payments', 'appointments', 'templates'];

  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, 'readwrite');

    stores.forEach(sName => {
      const store = tx.objectStore(sName);
      store.clear(); // Clear existing to prevent conflicts
      const items = importData.data[sName] || [];
      items.forEach(item => store.put(item));
    });

    tx.oncomplete = () => resolve({ success: true, message: 'Database imported successfully.' });
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function exportPatientsToCSV() {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction('visits', 'readonly');
    const store = tx.objectStore('visits');
    const req = store.getAll();

    req.onsuccess = () => {
      const rows = req.result || [];
      const headers = [
        'Serial No', 'MR Number', 'Date', 'Time', 'Visit No',
        'Patient Name', 'Relation', 'Parentage', 'Age', 'Gender', 'Weight',
        'Phone', 'CNIC', 'Address', 'Temp', 'BP', 'RR', 'Pulse',
        'Allergy', 'Symptoms', 'Findings', 'Diagnosis', 'Treatment', 'Revisit Days'
      ];

      const csvLines = [headers.join(',')];

      rows.forEach(r => {
        const line = [
          r.serialNo || '',
          `"${r.mrNumber || ''}"`,
          `"${r.date || ''}"`,
          `"${r.time || ''}"`,
          r.visitNo || '',
          `"${(r.name || '').replace(/"/g, '""')}"`,
          `"${r.relation || ''}"`,
          `"${(r.parentage || '').replace(/"/g, '""')}"`,
          `"${r.age || ''}"`,
          `"${r.gender || ''}"`,
          `"${r.weight || ''}"`,
          `"${r.phone || ''}"`,
          `"${r.cnic || ''}"`,
          `"${(r.address || '').replace(/"/g, '""')}"`,
          `"${r.temp || ''}"`,
          `"${r.bp || ''}"`,
          `"${r.rr || ''}"`,
          `"${r.pulse || ''}"`,
          `"${(r.allergy || '').replace(/"/g, '""')}"`,
          `"${(r.symptoms || '').replace(/"/g, '""')}"`,
          `"${(r.findings || '').replace(/"/g, '""')}"`,
          `"${(r.diagnosis || '').replace(/"/g, '""')}"`,
          `"${(r.treatment || '').replace(/"/g, '""')}"`,
          `"${r.revisit || ''}"`
        ];
        csvLines.push(line.join(','));
      });

      resolve(csvLines.join('\n'));
    };
    req.onerror = () => resolve('');
  });
}

window.HMC_DB = {
  initDB,
  getNextMRNumber,
  savePatientRecord,
  updatePatientRecord,
  getPatientVisits,
  getVisitBySerial,
  searchPatients,
  getDashboardStats,
  getRecentPatients,
  getNextReceiptNumber,
  savePaymentRecord,
  searchPayments,
  getPaymentById,
  deletePayment,
  getPaymentReport,
  getAppointmentsByDate,
  saveAppointment,
  updateAppointmentStatus,
  deleteAppointment,
  getTemplates,
  saveTemplate,
  deleteTemplate,
  exportFullDatabase,
  importFullDatabase,
  exportPatientsToCSV,
  getPSTDate,
  getPSTTime
};
