/**
 * Hajra Medical Complex, Jaranwala
 * IndexedDB Database Management Module (js/db.js)
 * Fully offline-capable, high performance, structured storage
 */

const DB_NAME = 'HajraMedicalDB';
let DB_VERSION = 4;

let _dbInstance = null;

function getPSTDate() {
  try {
    const d = new Date();
    const nf = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' });
    return nf.format(d); // Guarantees YYYY-MM-DD
  } catch (e) {
    const pst = new Date(Date.now() + 5 * 3600000);
    return pst.toISOString().slice(0, 10);
  }
}

function getPSTTime() {
  try {
    const d = new Date();
    return d.toLocaleTimeString('en-US', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  } catch (e) {
    const pst = new Date(Date.now() + 5 * 3600000);
    return pst.toISOString().slice(11, 19);
  }
}

function initDB(versionToUse) {
  return new Promise((resolve, reject) => {
    if (_dbInstance) return resolve(_dbInstance);
    const ver = versionToUse || DB_VERSION;
    const req = indexedDB.open(DB_NAME, ver);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      const tx = e.target.transaction;

      // Patients store
      if (db.objectStoreNames.contains('patients')) {
        const pStore = tx.objectStore('patients');
        if (pStore.keyPath !== 'mrNumber') {
          db.deleteObjectStore('patients');
        }
      }
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

      // Admissions store (IPD / Inpatient / Ward / OT Surgery / Discharge)
      if (!db.objectStoreNames.contains('admissions')) {
        const admStore = db.createObjectStore('admissions', { keyPath: 'admissionId' });
        admStore.createIndex('mrNumber', 'mrNumber', { unique: false });
        admStore.createIndex('admissionDate', 'admissionDate', { unique: false });
        admStore.createIndex('status', 'status', { unique: false });
        admStore.createIndex('ward', 'ward', { unique: false });
      }
    };

    req.onsuccess = (e) => {
      _dbInstance = e.target.result;
      seedDefaultTemplatesIfNeeded().then(() => resolve(_dbInstance));
    };

    req.onerror = (e) => {
      const err = e.target.error;
      if (err && (err.name === 'VersionError' || String(err.message).includes('less than the existing version'))) {
        const m = String(err.message).match(/existing version \((\d+)\)/i);
        const nextVer = m ? (parseInt(m[1], 10) + 1) : (ver + 1);
        DB_VERSION = nextVer;
        return initDB(nextVer).then(resolve).catch(reject);
      }
      reject(err);
    };
  });
}

function seedDefaultTemplatesIfNeeded() {
  return new Promise((resolve) => {
    try {
      if (!_dbInstance || !_dbInstance.objectStoreNames.contains('templates')) {
        return resolve();
      }
      const tx = _dbInstance.transaction('templates', 'readwrite');
      const store = tx.objectStore('templates');
      const countReq = store.count();

      countReq.onsuccess = () => {
        try {
          const defaults = window.DEFAULT_CLINICAL_TEMPLATES || window.CLINICAL_TEMPLATES || [];
          if (countReq.result === 0 && Array.isArray(defaults) && defaults.length > 0) {
            defaults.forEach(tpl => store.put(tpl));
          }
        } catch (e) {}
        resolve();
      };
      countReq.onerror = () => resolve();
      tx.onerror = () => resolve();
    } catch (e) {
      resolve();
    }
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
        const m = String(k).match(/(?:MR|HMC|PAT)-(\d+)/i);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maxNum) maxNum = n;
        }
      });
      const nextId = 'MR-' + String(maxNum + 1).padStart(5, '0');
      resolve(nextId);
    };
    req.onerror = () => resolve('MR-00001');
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

async function getAllFromStore(db, storeName) {
  if (!db || !db.objectStoreNames || !db.objectStoreNames.contains(storeName)) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch (e) {
      resolve([]);
    }
  });
}

async function searchPatients(query) {
  const q = String(query || '').trim().toLowerCase();
  const db = await initDB();

  try {
    const [allVisits, allPatients, allAdmissions] = await Promise.all([
      getAllFromStore(db, 'visits'),
      getAllFromStore(db, 'patients'),
      getAllFromStore(db, 'admissions')
    ]);

    const map = new Map();
    const cleanQ = q.replace(/[\s\-_]/g, '');

    const matches = (obj) => {
      if (!obj) return false;
      if (!q) return true;

      const name = String(obj.name || obj.patientName || '').toLowerCase();
      const mr = String(obj.mrNumber || '').toLowerCase();
      const ph = String(obj.phone || '').toLowerCase();
      const addr = String(obj.address || '').toLowerCase();
      const cnic = String(obj.cnic || '').toLowerCase();
      const ward = String(obj.ward || '').toLowerCase();
      const admId = String(obj.admissionId || '').toLowerCase();

      const cleanPh = ph.replace(/[\s\-_]/g, '');
      const cleanMr = mr.replace(/[\s\-_]/g, '');
      const cleanAdm = admId.replace(/[\s\-_]/g, '');

      return name.includes(q) || 
             mr.includes(q) || 
             (cleanQ && cleanMr.includes(cleanQ)) || 
             ph.includes(q) || 
             (cleanQ && cleanPh.includes(cleanQ)) || 
             addr.includes(q) || 
             cnic.includes(q) || 
             ward.includes(q) || 
             admId.includes(q) ||
             (cleanQ && cleanAdm.includes(cleanQ));
    };

    // 1. Process visits
    allVisits.forEach(v => {
      try {
        if (matches(v)) {
          const key = String(v.mrNumber || v.name || '').trim();
          if (key) {
            const vNo = Number(v.visitNo || 0);
            const curNo = map.has(key) ? Number(map.get(key).visitNo || 0) : -1;
            if (!map.has(key) || vNo > curNo) {
              map.set(key, Object.assign({}, v));
            }
          }
        }
      } catch (err) {}
    });

    // 2. Process patients store
    allPatients.forEach(p => {
      try {
        if (matches(p)) {
          const key = String(p.mrNumber || p.name || '').trim();
          if (key) {
            if (!map.has(key)) {
              map.set(key, Object.assign({}, p));
            } else {
              const ex = map.get(key);
              ex.name = ex.name || p.name;
              ex.parentage = ex.parentage || p.parentage;
              ex.relation = ex.relation || p.relation;
              ex.age = ex.age || p.age;
              ex.gender = ex.gender || p.gender;
              ex.phone = ex.phone || p.phone;
              ex.address = ex.address || p.address;
              ex.cnic = ex.cnic || p.cnic;
            }
          }
        }
      } catch (err) {}
    });

    // 3. Process admissions store
    allAdmissions.forEach(a => {
      try {
        if (matches(a)) {
          const key = String(a.mrNumber || a.patientName || '').trim();
          if (key) {
            if (!map.has(key)) {
              map.set(key, {
                mrNumber: a.mrNumber,
                name: a.patientName,
                parentage: a.parentage,
                relation: a.relation,
                age: a.age,
                gender: a.gender,
                phone: a.phone,
                address: a.address,
                cnic: a.cnic,
                ward: a.ward,
                bedNumber: a.bedNumber,
                diagnosis: a.admittingDiagnosis,
                latestAdmission: a,
                isActiveInpatient: a.status !== 'Discharged'
              });
            } else {
              const ex = map.get(key);
              ex.latestAdmission = a;
              ex.ward = a.ward || ex.ward;
              ex.bedNumber = a.bedNumber || ex.bedNumber;
              if (a.status !== 'Discharged') {
                ex.isActiveInpatient = true;
              }
            }
          }
        }
      } catch (err) {}
    });

    const list = Array.from(map.values());
    list.sort((a, b) => {
      if (a.isActiveInpatient && !b.isActiveInpatient) return -1;
      if (!a.isActiveInpatient && b.isActiveInpatient) return 1;
      return (Number(b.serialNo || 0)) - (Number(a.serialNo || 0));
    });

    return list.slice(0, 30);
  } catch (outerErr) {
    console.error('searchPatients outer error:', outerErr);
    return [];
  }
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

function getDeletedTemplateIds() {
  try {
    return JSON.parse(localStorage.getItem('hmc_deleted_tpl_ids') || '[]');
  } catch (e) {
    return [];
  }
}

function recordDeletedTemplateId(id) {
  const list = getDeletedTemplateIds();
  if (!list.includes(id)) {
    list.push(id);
    try { localStorage.setItem('hmc_deleted_tpl_ids', JSON.stringify(list)); } catch (e) {}
  }
}

async function getTemplates() {
  const defaults = (window.DEFAULT_CLINICAL_TEMPLATES || window.CLINICAL_TEMPLATES || []).slice();
  try {
    const db = await initDB();
    if (!db || !db.objectStoreNames.contains('templates')) {
      return defaults;
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('templates', 'readwrite');
        const store = tx.objectStore('templates');
        const req = store.getAll();
        req.onsuccess = () => {
          try {
            let list = req.result || [];
            const deletedIds = new Set(getDeletedTemplateIds());
            if (defaults.length > 0) {
              const existingIds = new Set(list.map(t => t.id));
              defaults.forEach(defTpl => {
                if (!existingIds.has(defTpl.id) && !deletedIds.has(defTpl.id)) {
                  try { store.put(defTpl); } catch (e) {}
                  list.push(defTpl);
                }
              });
            }
            if (!list || list.length === 0) {
              list = defaults;
            }
            resolve(list);
          } catch (err) {
            resolve(defaults);
          }
        };
        req.onerror = () => resolve(defaults);
        tx.onerror = () => resolve(defaults);
      } catch (err) {
        resolve(defaults);
      }
    });
  } catch (err) {
    return defaults;
  }
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

  // If re-saving an ID, remove from deleted list if it was there
  const deleted = getDeletedTemplateIds();
  if (deleted.includes(id)) {
    try {
      localStorage.setItem('hmc_deleted_tpl_ids', JSON.stringify(deleted.filter(x => x !== id)));
    } catch (e) {}
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction('templates', 'readwrite');
    const store = tx.objectStore('templates');
    const req = store.put(tplObj);
    req.onsuccess = () => resolve(tplObj);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function deleteTemplate(tplId) {
  recordDeletedTemplateId(tplId);
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
  const stores = ['patients', 'visits', 'payments', 'appointments', 'templates', 'admissions'];
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
  const stores = ['patients', 'visits', 'payments', 'appointments', 'templates', 'admissions'];

  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, 'readwrite');

    stores.forEach(sName => {
      const items = importData.data[sName];
      // CRITICAL: Only clear and import if items for this store were explicitly provided as an array.
      // If a remote cloud payload does not contain a particular store (e.g. admissions), NEVER wipe it out!
      if (Array.isArray(items)) {
        const store = tx.objectStore(sName);
        store.clear();
        items.forEach(item => store.put(item));
      }
    });

    tx.oncomplete = () => resolve({ success: true, message: 'Database imported successfully.' });
    tx.onerror = (e) => reject(e.target.error);
  });
}

function cleanPlainText(html) {
  if (!html) return '';
  let text = String(html);
  text = text.replace(/<br\s*[\/]?>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '• ');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<\/(p|div|h[1-6])>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&nbsp;/gi, ' ')
             .replace(/&amp;/gi, '&')
             .replace(/&lt;/gi, '<')
             .replace(/&gt;/gi, '>')
             .replace(/&quot;/gi, '"')
             .replace(/&#39;/gi, "'");
  text = text.replace(/\r/g, '');
  text = text.replace(/•\s*[-•*]\s*/g, '• ');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

function csvEsc(val) {
  if (val === undefined || val === null) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
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
        'Serial No',
        'Patient ID',
        'Date',
        'Visit No',
        'Patient Name',
        'Parentage',
        'Age',
        'Gender',
        'Weight',
        'Phone Number',
        'Address',
        'Allergy',
        'Symptoms / History / Condition',
        'Findings',
        'Treatment'
      ];

      const csvLines = [headers.map(h => csvEsc(h)).join(',')];

      rows.forEach(r => {
        const rel = r.relation || 'S/O';
        const par = r.parentage || '';
        const fullParentage = par ? (par.startsWith('S/O') || par.startsWith('D/O') || par.startsWith('W/O') || par.startsWith('H/O') ? par : (rel + ' ' + par)) : '';

        const line = [
          csvEsc(r.serialNo || ''),
          csvEsc(r.mrNumber || ''),
          csvEsc((r.date || '') + (r.time ? ' ' + r.time : '')),
          csvEsc(r.visitNo !== undefined ? r.visitNo : 1),
          csvEsc(r.name || ''),
          csvEsc(fullParentage),
          csvEsc(r.age || ''),
          csvEsc(r.gender || 'Male'),
          csvEsc(r.weight || ''),
          csvEsc(r.phone || ''),
          csvEsc(r.address || ''),
          csvEsc(cleanPlainText(r.allergy || '')),
          csvEsc(cleanPlainText(r.symptoms || '')),
          csvEsc(cleanPlainText(r.findings || '')),
          csvEsc(cleanPlainText(r.treatment || ''))
        ];
        csvLines.push(line.join(','));
      });

      resolve(csvLines.join('\r\n'));
    };
    req.onerror = () => resolve('');
  });
}

// ── ADMISSION & INPATIENT METHODS (IPD) ──────────────────────────────
async function getNextAdmissionId() {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction(['admissions'], 'readonly');
    const store = tx.objectStore('admissions');
    const req = store.getAllKeys();
    req.onsuccess = () => {
      const keys = req.result || [];
      const currentYear = new Date().getFullYear();
      let maxNum = 0;
      keys.forEach(k => {
        const match = String(k).match(/ADM-(\d+)-(\d+)/);
        if (match && parseInt(match[1], 10) === currentYear) {
          const num = parseInt(match[2], 10);
          if (num > maxNum) maxNum = num;
        }
      });
      const nextNum = String(maxNum + 1).padStart(4, '0');
      resolve(`ADM-${currentYear}-${nextNum}`);
    };
    req.onerror = () => {
      const currentYear = new Date().getFullYear();
      resolve(`ADM-${currentYear}-0001`);
    };
  });
}

async function saveAdmissionRecord(adm) {
  const db = await initDB();
  if (!adm.admissionId) {
    adm.admissionId = await getNextAdmissionId();
  }
  if (!adm.createdAt) {
    adm.createdAt = new Date().toISOString();
  }
  adm.updatedAt = new Date().toISOString();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['admissions'], 'readwrite');
    const store = tx.objectStore('admissions');
    const req = store.put(adm);
    req.onsuccess = () => resolve(adm);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function getAdmissionById(admissionId) {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction(['admissions'], 'readonly');
    const store = tx.objectStore('admissions');
    const req = store.get(admissionId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

async function getAdmissionsByMR(mrNumber) {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction(['admissions'], 'readonly');
    const store = tx.objectStore('admissions');
    const index = store.index('mrNumber');
    const req = index.getAll(mrNumber);
    req.onsuccess = () => {
      const records = req.result || [];
      records.sort((a, b) => (b.admissionDate || '').localeCompare(a.admissionDate || ''));
      resolve(records);
    };
    req.onerror = () => resolve([]);
  });
}

async function getActiveAdmissions() {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction(['admissions'], 'readonly');
    const store = tx.objectStore('admissions');
    const req = store.getAll();
    req.onsuccess = () => {
      const records = req.result || [];
      const active = records.filter(r => r.status !== 'Discharged');
      active.sort((a, b) => (b.admissionDate || '').localeCompare(a.admissionDate || ''));
      resolve(active);
    };
    req.onerror = () => resolve([]);
  });
}

async function getAllAdmissions() {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction(['admissions'], 'readonly');
    const store = tx.objectStore('admissions');
    const req = store.getAll();
    req.onsuccess = () => {
      const records = req.result || [];
      records.sort((a, b) => (b.admissionDate || '').localeCompare(a.admissionDate || ''));
      resolve(records);
    };
    req.onerror = () => resolve([]);
  });
}

async function deleteAdmission(admissionId) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['admissions'], 'readwrite');
    const store = tx.objectStore('admissions');
    const req = store.delete(admissionId);
    req.onsuccess = () => resolve(true);
    req.onerror = (e) => reject(e.target.error);
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
  getPSTTime,
  // IPD Admissions
  getNextAdmissionId,
  saveAdmissionRecord,
  getAdmissionById,
  getAdmissionsByMR,
  getActiveAdmissions,
  getAllAdmissions,
  deleteAdmission
};
