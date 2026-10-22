/**
 * Hajra Medical Complex, Jaranwala
 * Main Application Logic (js/app.js)
 * Pair programmed & engineered for Dr. Hafiz Ehsan Qadeer
 */

let _currentMode = 'new'; // 'new' | 'edit'
let _currentSerialNo = null;
let _activeEditor = null;
let _currentPatientVisits = [];
let _dbPassword = localStorage.getItem('hmc_db_password') || '1234';

// ── TOAST NOTIFICATIONS ─────────────────────────────────────────────
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

// ── CLOCK & INITIALIZATION ──────────────────────────────────────────
function updateClock() {
  const clockEl = document.getElementById('header-clock-time');
  if (clockEl) {
    const pstDate = HMC_DB.getPSTDate();
    const pstTime = HMC_DB.getPSTTime();
    clockEl.textContent = `${pstDate}  ${pstTime} (PST)`;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    checkLoginStatus();
    await HMC_DB.initDB();
    setInterval(updateClock, 1000);
    updateClock();

    setupRichEditors();
    initRichToolbars();
    setupTemplatesUI();
    setupSearchListeners();
    setupModals();
    initSidebarResize();

    await resetFormToNew();
    await refreshSidebarStats();
    await refreshRecentPatientsList();

    // Auto-sync in background on startup to pull fresh data across devices
    setTimeout(() => {
      triggerBackgroundAutoSync();
    }, 1200);
  } catch (err) {
    console.error('Initialization error:', err);
    showToast('Failed to initialize database: ' + err.message, 'error');
  }
});

// ── FORM MANAGEMENT ─────────────────────────────────────────────────
async function resetFormToNew() {
  _currentMode = 'new';
  _currentSerialNo = null;
  _currentPatientVisits = [];

  document.getElementById('patient-form').reset();

  // Clear rich editors
  document.querySelectorAll('.rich-editor').forEach(ed => ed.innerHTML = '');

  // Auto fields
  const nextMR = await HMC_DB.getNextMRNumber();
  document.getElementById('f-mr').value = nextMR;
  document.getElementById('f-date').value = HMC_DB.getPSTDate();
  document.getElementById('f-time').value = HMC_DB.getPSTTime();
  document.getElementById('f-visit').value = '1';
  document.getElementById('f-gender').value = 'Male';
  document.getElementById('f-relation').value = 'S/O';

  // Keep action buttons ready
  const histBtn = document.getElementById('btn-view-history');
  if (histBtn) histBtn.style.display = 'none';
}

function getFormData() {
  const dateInput = document.getElementById('f-date');
  const timeInput = document.getElementById('f-time');
  const dateVal = (dateInput && dateInput.value) ? dateInput.value : HMC_DB.getPSTDate();
  const timeVal = (timeInput && timeInput.value) ? timeInput.value : HMC_DB.getPSTTime();

  return {
    serialNo: _currentSerialNo,
    mrNumber: document.getElementById('f-mr').value.trim(),
    date: dateVal,
    time: timeVal,
    visitNo: parseInt(document.getElementById('f-visit').value, 10) || 1,
    name: document.getElementById('f-name').value.trim(),
    relation: document.getElementById('f-relation').value,
    parentage: document.getElementById('f-parentage').value.trim(),
    age: document.getElementById('f-age').value.trim(),
    gender: document.getElementById('f-gender').value,
    weight: document.getElementById('f-weight').value.trim(),
    phone: document.getElementById('f-phone').value.trim(),
    cnic: document.getElementById('f-cnic').value.trim(),
    address: document.getElementById('f-address').value.trim(),

    temp: document.getElementById('f-temp').value.trim(),
    bp: document.getElementById('f-bp').value.trim(),
    rr: document.getElementById('f-rr').value.trim(),
    pulse: document.getElementById('f-pulse').value.trim(),

    allergy: document.getElementById('ed-allergy').innerHTML.trim(),
    symptoms: document.getElementById('ed-symptoms').innerHTML.trim(),
    findings: document.getElementById('ed-findings').innerHTML.trim(),
    comments: document.getElementById('ed-comments').innerHTML.trim(),
    investigations: document.getElementById('ed-investigations').innerHTML.trim(),
    diagnosis: document.getElementById('ed-diagnosis').innerHTML.trim(),
    treatment: document.getElementById('ed-treatment').innerHTML.trim(),
    revisit: document.getElementById('f-revisit').value.trim()
  };
}

function formatDateForInput(val) {
  if (!val) return HMC_DB.getPSTDate();
  val = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  if (val.includes('T')) {
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        const nf = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' });
        return nf.format(d);
      }
    } catch (e) {}
  }
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const nf = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' });
      return nf.format(d);
    }
  } catch (e) {}
  return HMC_DB.getPSTDate();
}

function formatTimeForDisplay(val) {
  if (!val) return HMC_DB.getPSTTime();
  val = String(val).trim();

  // If 1899 epoch date from Google Sheets or full ISO date string
  if (val.includes('1899-12-30') || val.includes('1899-12-31') || (val.includes('T') && val.endsWith('Z'))) {
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('en-US', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      }
    } catch (e) {}
  }

  return val;
}

function formatPrintDate(val) {
  if (!val) return HMC_DB.getPSTDate();
  try {
    const parts = String(val).split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (!isNaN(day) && months[month]) {
        return `${String(day).padStart(2, '0')}-${months[month]}-${year}`;
      }
    }
  } catch (e) {}
  return val;
}

function populateForm(data) {
  _currentSerialNo = data.serialNo || null;
  document.getElementById('f-mr').value = data.mrNumber || '';
  document.getElementById('f-date').value = formatDateForInput(data.date);
  document.getElementById('f-time').value = formatTimeForDisplay(data.time);
  document.getElementById('f-visit').value = data.visitNo || '1';
  document.getElementById('f-name').value = data.name || '';
  document.getElementById('f-relation').value = data.relation || 'S/O';
  document.getElementById('f-parentage').value = data.parentage || '';
  document.getElementById('f-age').value = data.age || '';
  document.getElementById('f-gender').value = data.gender || 'Male';
  document.getElementById('f-weight').value = data.weight || '';
  document.getElementById('f-phone').value = data.phone || '';
  document.getElementById('f-cnic').value = data.cnic || '';
  document.getElementById('f-address').value = data.address || '';

  document.getElementById('f-temp').value = data.temp || '';
  document.getElementById('f-bp').value = data.bp || '';
  document.getElementById('f-rr').value = data.rr || '';
  document.getElementById('f-pulse').value = data.pulse || '';

  document.getElementById('ed-allergy').innerHTML = data.allergy || '';
  document.getElementById('ed-symptoms').innerHTML = data.symptoms || '';
  document.getElementById('ed-findings').innerHTML = data.findings || '';
  document.getElementById('ed-comments').innerHTML = data.comments || '';
  document.getElementById('ed-investigations').innerHTML = data.investigations || '';
  document.getElementById('ed-diagnosis').innerHTML = data.diagnosis || '';
  document.getElementById('ed-treatment').innerHTML = data.treatment || '';
  document.getElementById('f-revisit').value = data.revisit || '';

  _currentMode = 'edit';
  const histBtn = document.getElementById('btn-view-history');
  if (histBtn) histBtn.style.display = 'inline-flex';
}

async function handleSavePatient() {
  const data = getFormData();
  if (!data.name) {
    showToast('Please enter Patient Name.', 'error');
    document.getElementById('f-name').focus();
    return;
  }

  try {
    if (_currentSerialNo) {
      await HMC_DB.updatePatientRecord(data);
      showToast(`Record updated: ${data.name} (${data.mrNumber}, Visit #${data.visitNo})`, 'success');
    } else {
      const res = await HMC_DB.savePatientRecord(data);
      _currentSerialNo = res.serialNo;
      _currentMode = 'edit';
      showToast(`Saved! MR: ${res.mrNumber} (Visit #${res.visitNo})`, 'success');
    }

    _currentPatientVisits = await HMC_DB.getPatientVisits(data.mrNumber);
    const histBtn = document.getElementById('btn-view-history');
    if (histBtn) histBtn.style.display = 'inline-flex';

    await refreshSidebarStats();
    await refreshRecentPatientsList();
    triggerBackgroundAutoSync();
  } catch (err) {
    showToast('Error saving record: ' + err.message, 'error');
  }
}

async function handleUpdatePatient() {
  const data = getFormData();
  if (!_currentSerialNo) {
    return handleSavePatient();
  }
  try {
    await HMC_DB.updatePatientRecord(data);
    showToast('Record updated successfully.', 'success');
    await refreshSidebarStats();
    await refreshRecentPatientsList();
    triggerBackgroundAutoSync();
  } catch (err) {
    showToast('Error updating record: ' + err.message, 'error');
  }
}

async function handleSaveNewVisit() {
  const data = getFormData();
  if (!data.name) {
    showToast('Please enter or select a patient first.', 'error');
    document.getElementById('f-name').focus();
    return;
  }

  const mr = (data.mrNumber || '').trim();
  if (!mr) {
    showToast('Patient MR Number is required.', 'error');
    return;
  }

  try {
    const existingVisits = await HMC_DB.getPatientVisits(mr);
    let nextVisitNo = 2;
    if (existingVisits && existingVisits.length > 0) {
      const maxV = Math.max(...existingVisits.map(v => parseInt(v.visitNo, 10) || 1));
      nextVisitNo = maxV + 1;
    }

    data.visitNo = nextVisitNo;
    data.date = HMC_DB.getPSTDate();
    data.time = HMC_DB.getPSTTime();
    data.serialNo = null; // Forces new visit record in visits store

    const res = await HMC_DB.savePatientRecord(data);
    _currentSerialNo = res.serialNo;
    _currentMode = 'edit';

    document.getElementById('f-visit').value = nextVisitNo;
    document.getElementById('f-date').value = data.date;
    document.getElementById('f-time').value = data.time;

    _currentPatientVisits = await HMC_DB.getPatientVisits(mr);
    const histBtn = document.getElementById('btn-view-history');
    if (histBtn) histBtn.style.display = 'inline-flex';

    showToast(`Saved as New Visit #${nextVisitNo} for ${data.name}! Total visits: ${_currentPatientVisits.length}`, 'success');
    await refreshSidebarStats();
    await refreshRecentPatientsList();
    triggerBackgroundAutoSync();
  } catch (err) {
    showToast('Error saving new visit: ' + err.message, 'error');
  }
}

async function handleStartNewVisit() {
  return handleSaveNewVisit();
}

// ── SEARCH & SIDEBAR ────────────────────────────────────────────────
function setupSearchListeners() {
  const searchInput = document.getElementById('sidebar-search-input');
  let debounceTimeout = null;

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(async () => {
      const q = searchInput.value.trim();
      const listContainer = document.getElementById('sidebar-search-results');

      if (!q) {
        listContainer.innerHTML = '<div style="font-size:12px;color:var(--text-light);text-align:center;padding:12px 0;">Type to search patients...</div>';
        return;
      }

      const results = await HMC_DB.searchPatients(q);
      if (results.length === 0) {
        listContainer.innerHTML = '<div style="font-size:12px;color:var(--text-light);text-align:center;padding:12px 0;">No patients found</div>';
        return;
      }

      listContainer.innerHTML = results.slice(0, 15).map(p => `
        <div class="patient-card-mini" onclick="loadPatientBySerial(${p.serialNo})">
          <div class="pcm-header">
            <span class="pcm-name">${escapeHtml(p.name)}</span>
            <span class="pcm-mr">${p.mrNumber}</span>
          </div>
          <div class="pcm-meta">
            ${p.age ? p.age + 'y ' : ''}${p.gender || ''} ${p.phone ? '· ' + p.phone : ''}
          </div>
          <div style="font-size:10.5px;color:var(--teal);margin-top:2px;font-weight:700;">
            Visit #${p.visitNo} ${p.totalVisits > 1 ? `(${p.totalVisits} visits on record)` : ''} · ${p.date}
          </div>
        </div>
      `).join('');
    }, 200);
  });
}

async function loadPatientBySerial(serialNo) {
  const rec = await HMC_DB.getVisitBySerial(serialNo);
  if (rec) {
    populateForm(rec);
    _currentPatientVisits = await HMC_DB.getPatientVisits(rec.mrNumber);
    const totalV = _currentPatientVisits.length;
    showToast(`Loaded: ${rec.name} (${rec.mrNumber}) — Visit #${rec.visitNo} of ${totalV}`, 'success');
  }
}

async function refreshSidebarStats() {
  const stats = await HMC_DB.getDashboardStats();
  document.getElementById('stat-total-val').textContent = stats.totalPatients;
  document.getElementById('stat-today-val').textContent = stats.todayPatients;
  document.getElementById('stat-returning-val').textContent = stats.returningPatients;
}

async function refreshRecentPatientsList() {
  const recents = await HMC_DB.getRecentPatients(8);
  const container = document.getElementById('recent-patients-list');
  if (!container) return;

  if (recents.length === 0) {
    container.innerHTML = '<div style="font-size:11.5px;color:var(--text-light);text-align:center;padding:10px 0;">No recent patients</div>';
    return;
  }

  container.innerHTML = recents.map(p => `
    <div class="patient-card-mini" onclick="loadPatientBySerial(${p.serialNo})">
      <div class="pcm-header">
        <span class="pcm-name">${escapeHtml(p.name)}</span>
        <span class="pcm-mr">${p.mrNumber}</span>
      </div>
      <div class="pcm-meta">
        ${p.date} · Visit #${p.visitNo}
      </div>
    </div>
  `).join('');
}

// ── RICH TEXT TOOLBARS & EDITORS ────────────────────────────────────
const RTE_FONTS = ['Calibri', 'Segoe UI', 'Arial', 'Times New Roman', 'Tahoma', 'Verdana', 'Courier New'];
const RTE_SIZES = ['11px', '12px', '13px', '14px', '16px', '18px', '20px'];

function setupRichEditors() {
  document.querySelectorAll('.rich-editor').forEach(editor => {
    editor.addEventListener('focus', () => {
      _activeEditor = editor;
    });

    // Formatting shortcuts & Ctrl+A support
    editor.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          const range = document.createRange();
          range.selectNodeContents(editor);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        } else if (e.key === 'b' || e.key === 'B') {
          e.preventDefault();
          toggleEditorBold(editor);
        } else if (e.key === 'i' || e.key === 'I') {
          e.preventDefault();
          document.execCommand('italic', false, null);
        } else if (e.key === 'u' || e.key === 'U') {
          e.preventDefault();
          document.execCommand('underline', false, null);
        }
      }
    });
  });
}

function toggleEditorBold(editor) {
  document.execCommand('bold', false, null);
  // Synchronize list markers (bullets/numbers) weight on parent LI
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    editor.querySelectorAll('li').forEach(li => {
      if (sel.containsNode(li, true)) {
        const hasBold = li.querySelector('b, strong') !== null;
        li.style.fontWeight = hasBold ? '700' : 'normal';
      }
    });
  }
}

function initRichToolbars() {
  document.querySelectorAll('.rte-toolbar[data-target]').forEach(toolbar => {
    const targetId = toolbar.getAttribute('data-target');
    const editor = document.getElementById(targetId);
    if (!editor) return;

    toolbar.innerHTML = `
      <div class="rte-dd rte-dd-font">
        <button type="button" class="rte-dd-btn" data-dd-toggle="font" title="Font Family">
          <span class="rte-dd-label">Calibri</span>
          <span class="rte-dd-arrow">▼</span>
        </button>
        <div class="rte-dd-panel" data-dd-panel="font">
          ${RTE_FONTS.map(f => `<div class="rte-dd-item" data-font="${f}" style="font-family:'${f}';">${f}</div>`).join('')}
        </div>
      </div>

      <div class="rte-dd rte-dd-size">
        <button type="button" class="rte-dd-btn" data-dd-toggle="size" title="Font Size">
          <span class="rte-dd-label">13px</span>
          <span class="rte-dd-arrow">▼</span>
        </button>
        <div class="rte-dd-panel" data-dd-panel="size">
          ${RTE_SIZES.map(s => `<div class="rte-dd-item" data-size="${s}">${s}</div>`).join('')}
        </div>
      </div>

      <div class="rte-sep" style="width:1px;height:18px;background:var(--border);margin:0 3px;"></div>

      <button type="button" class="rte-btn" data-cmd="bold" title="Bold (Ctrl+B)"><strong>B</strong></button>
      <button type="button" class="rte-btn" data-cmd="italic" title="Italic (Ctrl+I)"><em>I</em></button>
      <button type="button" class="rte-btn" data-cmd="underline" title="Underline (Ctrl+U)"><u>U</u></button>

      <div class="rte-sep" style="width:1px;height:18px;background:var(--border);margin:0 3px;"></div>

      <button type="button" class="rte-btn" data-cmd="sizeUp" title="Increase Font Size">A+</button>
      <button type="button" class="rte-btn" data-cmd="sizeDown" title="Decrease Font Size">A−</button>

      <div class="rte-sep" style="width:1px;height:18px;background:var(--border);margin:0 3px;"></div>

      <button type="button" class="rte-btn" data-cmd="insertUnorderedList" title="Bullet List">•</button>
      <button type="button" class="rte-btn" data-cmd="insertOrderedList" title="Numbered List">1.</button>
    `;

    toolbar.querySelectorAll('.rte-btn, .rte-dd-btn, .rte-dd-item').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        _activeEditor = editor;
      });
    });

    const fontBtn = toolbar.querySelector('[data-dd-toggle="font"]');
    const fontPanel = toolbar.querySelector('[data-dd-panel="font"]');
    const fontLabel = fontBtn.querySelector('.rte-dd-label');

    const sizeBtn = toolbar.querySelector('[data-dd-toggle="size"]');
    const sizePanel = toolbar.querySelector('[data-dd-panel="size"]');
    const sizeLabel = sizeBtn.querySelector('.rte-dd-label');

    fontBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const parent = fontBtn.closest('.rte-dd');
      const wasOpen = fontPanel.classList.contains('open');
      closeAllRteDropdowns();
      if (!wasOpen) {
        fontPanel.classList.add('open');
        parent.classList.add('open');
      }
    });

    sizeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const parent = sizeBtn.closest('.rte-dd');
      const wasOpen = sizePanel.classList.contains('open');
      closeAllRteDropdowns();
      if (!wasOpen) {
        sizePanel.classList.add('open');
        parent.classList.add('open');
      }
    });

    fontPanel.querySelectorAll('.rte-dd-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const font = item.getAttribute('data-font');
        fontLabel.textContent = font;
        applyFontNameToEditor(editor, font);
        closeAllRteDropdowns();
      });
    });

    sizePanel.querySelectorAll('.rte-dd-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const size = item.getAttribute('data-size');
        sizeLabel.textContent = size;
        applyFontSizeToEditor(editor, size);
        closeAllRteDropdowns();
      });
    });

    toolbar.querySelectorAll('.rte-btn[data-cmd]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-cmd');
        editor.focus();
        _activeEditor = editor;

        if (cmd === 'sizeUp') {
          const curSize = sizeLabel.textContent || '13px';
          const idx = RTE_SIZES.indexOf(curSize);
          const nextIdx = Math.min(RTE_SIZES.length - 1, idx + 1);
          const nextSize = RTE_SIZES[nextIdx];
          sizeLabel.textContent = nextSize;
          applyFontSizeToEditor(editor, nextSize);
        } else if (cmd === 'sizeDown') {
          const curSize = sizeLabel.textContent || '13px';
          const idx = RTE_SIZES.indexOf(curSize);
          const prevIdx = Math.max(0, idx - 1);
          const prevSize = RTE_SIZES[prevIdx];
          sizeLabel.textContent = prevSize;
          applyFontSizeToEditor(editor, prevSize);
        } else if (cmd === 'bold') {
          toggleEditorBold(editor);
        } else {
          document.execCommand(cmd, false, null);
        }
      });
    });
  });
}

function closeAllRteDropdowns() {
  document.querySelectorAll('.rte-dd-panel.open').forEach(p => p.classList.remove('open'));
  document.querySelectorAll('.rte-dd.open').forEach(d => d.classList.remove('open'));
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.rte-dd')) {
    closeAllRteDropdowns();
  }
});

function applyFontNameToEditor(editor, fontName) {
  editor.focus();
  document.execCommand('fontName', false, fontName);
}

function applyFontSizeToEditor(editor, sizePx) {
  editor.focus();
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);

  // Synchronize font size directly on LI so the bullet/number marker resizes!
  editor.querySelectorAll('li').forEach(li => {
    if (sel.containsNode(li, true)) {
      li.style.fontSize = sizePx;
    }
  });

  if (range.collapsed) {
    const span = document.createElement('span');
    span.style.fontSize = sizePx;
    span.innerHTML = '&#8203;';
    range.insertNode(span);
    range.setStartAfter(span);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    return;
  }

  document.execCommand('styleWithCSS', false, false);
  document.execCommand('fontSize', false, '7');
  const fontEls = editor.querySelectorAll('font[size="7"]');
  fontEls.forEach(el => {
    el.removeAttribute('size');
    el.style.fontSize = sizePx;
  });
}

function execEditorCmd(cmd, value = null) {
  if (!_activeEditor) {
    _activeEditor = document.getElementById('ed-treatment');
  }
  _activeEditor.focus();
  document.execCommand(cmd, false, value);
}

// ── CLINICAL TEMPLATES PANEL ────────────────────────────────────────
let _allTemplates = [];
let _activeCategory = 'All';
let _tplAutoCloseTimer = null;

const TPL_CAT_FIELD = {
  'Findings': 'ed-findings',
  'Diagnosis': 'ed-diagnosis',
  'Investigations': 'ed-investigations',
  'Comments': 'ed-comments',
  'Advice': 'ed-comments',
  'Treatment': 'ed-treatment',
  'Recommendations': 'ed-findings'
};

async function setupTemplatesUI() {
  _allTemplates = await HMC_DB.getTemplates();
  renderTemplateCategories();
  renderTemplatesList();

  const searchInput = document.getElementById('tpl-search-input');
  searchInput.addEventListener('input', () => renderTemplatesList());
}

function toggleTemplatesPanel() {
  const appContainer = document.querySelector('.app-container');
  const isOpen = appContainer.classList.toggle('templates-open');
  const btn = document.getElementById('btn-toggle-templates');
  if (btn) {
    btn.innerHTML = isOpen ? '✕ Close Templates' : '⚡ Clinical Templates';
  }
}

function tplPanelMouseEnter() {
  if (_tplAutoCloseTimer) {
    clearTimeout(_tplAutoCloseTimer);
    _tplAutoCloseTimer = null;
  }
}

function tplPanelMouseLeave() {
  if (_tplAutoCloseTimer) clearTimeout(_tplAutoCloseTimer);
  _tplAutoCloseTimer = setTimeout(() => {
    const container = document.querySelector('.app-container');
    if (container && container.classList.contains('templates-open')) {
      container.classList.remove('templates-open');
      const btn = document.getElementById('btn-toggle-templates');
      if (btn) btn.innerHTML = '⚡ Clinical Templates';
    }
  }, 3500);
}

function renderTemplateCategories() {
  const cats = ['All'];
  _allTemplates.forEach(t => {
    if (t.cat && !cats.includes(t.cat)) cats.push(t.cat);
  });

  const catContainer = document.getElementById('tpl-cats-container');
  catContainer.innerHTML = cats.map(c => `
    <button class="tpl-cat-chip ${c === _activeCategory ? 'active' : ''}" onclick="selectTemplateCategory('${c}')">
      ${escapeHtml(c)}
    </button>
  `).join('');
}

function selectTemplateCategory(cat) {
  _activeCategory = cat;
  renderTemplateCategories();
  renderTemplatesList();
}

function renderTemplatesList() {
  const searchQ = (document.getElementById('tpl-search-input').value || '').trim().toLowerCase();
  const listContainer = document.getElementById('tpl-items-list');

  let filtered = _allTemplates;
  if (_activeCategory !== 'All') {
    filtered = filtered.filter(t => t.cat === _activeCategory);
  }
  if (searchQ) {
    filtered = filtered.filter(t => 
      (t.name && t.name.toLowerCase().includes(searchQ)) ||
      (t.body && t.body.toLowerCase().includes(searchQ)) ||
      (t.cat && t.cat.toLowerCase().includes(searchQ))
    );
  }

  if (filtered.length === 0) {
    listContainer.innerHTML = '<div style="font-size:12px;color:var(--text-light);text-align:center;padding:16px 0;">No templates match</div>';
    return;
  }

  listContainer.innerHTML = filtered.map(t => `
    <div class="tpl-item-card" onclick="insertTemplateText('${t.id}')">
      <div class="tpl-item-header">
        <div class="tpl-item-title">${escapeHtml(t.name)}</div>
        <div class="tpl-card-actions" onclick="event.stopPropagation()">
          <button type="button" class="tpl-action-btn" title="Paste / Insert into Form" onclick="insertTemplateText('${t.id}')">📥</button>
          <button type="button" class="tpl-action-btn" title="Copy to Clipboard" onclick="copyTemplateText('${t.id}', event)">📋</button>
          <button type="button" class="tpl-action-btn" title="Edit Template" onclick="editTemplate('${t.id}', event)">✏️</button>
          <button type="button" class="tpl-action-btn btn-del" title="Delete Template" onclick="deleteTemplateItem('${t.id}', event)">🗑️</button>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
        <span class="tpl-item-badge">${escapeHtml(t.cat || 'General')}</span>
      </div>
      <div class="tpl-item-preview">${escapeHtml(t.body)}</div>
    </div>
  `).join('');
}

function insertTemplateText(tplId) {
  const tpl = _allTemplates.find(t => t.id === tplId);
  if (!tpl) return;

  // Smart target resolution: if user has focused an editor, use it;
  // otherwise, auto-target based on template category
  let target = _activeEditor;
  if (!target) {
    const targetId = TPL_CAT_FIELD[tpl.cat] || 'ed-treatment';
    target = document.getElementById(targetId);
  }

  if (!target) target = document.getElementById('ed-treatment');

  target.focus();
  _activeEditor = target;
  const textToInsert = tpl.body;
  
  // Clean multiline insert
  if (document.queryCommandSupported('insertText')) {
    const existing = target.innerText.trim();
    document.execCommand('insertText', false, (existing ? '\n' : '') + textToInsert);
  } else {
    target.innerHTML += (target.innerHTML.trim() ? '<br>' : '') + textToInsert.replace(/\n/g, '<br>');
  }
  showToast(`Inserted into ${target.previousElementSibling ? target.previousElementSibling.innerText : 'field'}: ${tpl.name}`, 'info');
}

function copyTemplateText(tplId, event) {
  if (event) event.stopPropagation();
  const tpl = _allTemplates.find(t => t.id === tplId);
  if (!tpl) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(tpl.body).then(() => {
      showToast(`Copied "${tpl.name}" to clipboard!`, 'success');
    }).catch(() => {
      showToast('Clipboard access unavailable.', 'error');
    });
  } else {
    showToast('Clipboard not supported by browser.', 'error');
  }
}

function editTemplate(tplId, event) {
  if (event) event.stopPropagation();
  openAddTemplateModal(tplId);
}

function deleteTemplateItem(tplId, event) {
  if (event) event.stopPropagation();
  const tpl = _allTemplates.find(t => t.id === tplId);
  const name = tpl ? tpl.name : 'this template';
  if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

  HMC_DB.deleteTemplate(tplId).then(async () => {
    _allTemplates = await HMC_DB.getTemplates();
    renderTemplateCategories();
    renderTemplatesList();
    showToast(`Template "${name}" deleted.`, 'info');
  }).catch(err => {
    showToast('Error deleting template: ' + err.message, 'error');
  });
}

async function syncTemplates() {
  try {
    _allTemplates = await HMC_DB.getTemplates();
    renderTemplateCategories();
    renderTemplatesList();
    showToast(`Synchronized ${_allTemplates.length} clinical templates!`, 'success');
  } catch (err) {
    showToast('Error syncing templates: ' + err.message, 'error');
  }
}

// ── ADD / EDIT CLINICAL TEMPLATE MODAL HANDLERS ─────────────────────
function populateCategoryDatalist() {
  const dl = document.getElementById('tpl-cat-datalist');
  if (!dl) return;
  const standardCats = ['Findings', 'Diagnosis', 'Treatment', 'Investigations', 'Comments', 'Recommendations', 'Advice', 'Ultrasound', 'Obs & Gynae', 'Pediatrics'];
  const allCats = new Set(standardCats);
  _allTemplates.forEach(t => { if (t.cat) allCats.add(t.cat); });
  dl.innerHTML = Array.from(allCats).map(c => `<option value="${escapeHtml(c)}"></option>`).join('');
}

function openAddTemplateModal(editTplId = null) {
  const modal = document.getElementById('modal-add-template');
  if (!modal) return;

  populateCategoryDatalist();

  const titleEl = document.getElementById('tpl-modal-title');
  const idEl = document.getElementById('tpl-add-id');
  const nameEl = document.getElementById('tpl-add-name');
  const catEl = document.getElementById('tpl-add-cat');
  const bodyEl = document.getElementById('tpl-add-body');
  const delBtn = document.getElementById('tpl-btn-delete');
  const saveBtn = document.getElementById('tpl-btn-save');

  if (editTplId) {
    const tpl = _allTemplates.find(t => t.id === editTplId);
    if (tpl) {
      if (titleEl) titleEl.textContent = '✏️ Edit Clinical Template';
      idEl.value = tpl.id;
      nameEl.value = tpl.name || '';
      catEl.value = tpl.cat || 'Findings';
      bodyEl.value = tpl.body || '';
      if (delBtn) delBtn.style.display = 'inline-flex';
      if (saveBtn) saveBtn.innerHTML = '💾 Update Template';
    }
  } else {
    if (titleEl) titleEl.textContent = '➕ Add New Clinical Template';
    idEl.value = '';
    nameEl.value = '';
    catEl.value = (_activeCategory && _activeCategory !== 'All') ? _activeCategory : 'Findings';
    bodyEl.value = '';
    if (delBtn) delBtn.style.display = 'none';
    if (saveBtn) saveBtn.innerHTML = '💾 Save Template';
  }

  modal.classList.add('open');
  setTimeout(() => nameEl.focus(), 100);
}

function closeAddTemplateModal() {
  const modal = document.getElementById('modal-add-template');
  if (modal) modal.classList.remove('open');
}

async function handleSaveNewTemplate() {
  const id = (document.getElementById('tpl-add-id').value || '').trim();
  const name = (document.getElementById('tpl-add-name').value || '').trim();
  const cat = (document.getElementById('tpl-add-cat').value || '').trim() || 'General';
  const body = (document.getElementById('tpl-add-body').value || '').trim();

  if (!name || !body) {
    showToast('Please enter both template title and content.', 'error');
    return;
  }

  try {
    await HMC_DB.saveTemplate({
      id: id || undefined,
      name: name,
      cat: cat,
      body: body
    });

    _allTemplates = await HMC_DB.getTemplates();
    _activeCategory = cat;
    renderTemplateCategories();
    renderTemplatesList();
    closeAddTemplateModal();
    showToast(`Template "${name}" saved into "${cat}"!`, 'success');
  } catch (err) {
    showToast('Error saving template: ' + err.message, 'error');
  }
}

async function handleDeleteCurrentTemplate() {
  const id = (document.getElementById('tpl-add-id').value || '').trim();
  if (!id) return;
  const tpl = _allTemplates.find(t => t.id === id);
  const name = tpl ? tpl.name : 'this template';
  if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

  try {
    await HMC_DB.deleteTemplate(id);
    _allTemplates = await HMC_DB.getTemplates();
    renderTemplateCategories();
    renderTemplatesList();
    closeAddTemplateModal();
    showToast(`Template "${name}" deleted.`, 'info');
  } catch (err) {
    showToast('Error deleting template: ' + err.message, 'error');
  }
}

// ── COLLAPSIBLE DASHBOARD STATS ─────────────────────────────────────
function dashToggle() {
  const wrap = document.getElementById('dash-stats-wrap');
  const chevron = document.getElementById('dash-chevron');
  if (!wrap) return;
  const isOpen = wrap.classList.toggle('open');
  if (chevron) chevron.classList.toggle('open', isOpen);
}

// ── INTERACTIVE RESIZABLE SIDEBAR ───────────────────────────────────
function initSidebarResize() {
  const SB_MIN = 220;
  const SB_MAX = 460;
  const SB_DEFAULT = 310;
  const STORE_KEY = 'cf_sidebar_w';

  const container = document.querySelector('.app-container');
  const sidebar = document.querySelector('.sidebar');
  if (!container || !sidebar) return;

  // Restore saved width
  const savedW = parseInt(localStorage.getItem(STORE_KEY), 10);
  if (savedW && savedW >= SB_MIN && savedW <= SB_MAX) {
    applySidebarWidth(savedW);
  }

  // Create drag handle
  const handle = document.createElement('div');
  handle.id = 'sb-resize-handle';
  handle.setAttribute('aria-hidden', 'true');
  document.body.appendChild(handle);

  function positionHandle() {
    const rect = sidebar.getBoundingClientRect();
    handle.style.left = (rect.right - 3) + 'px';
  }
  positionHandle();
  window.addEventListener('resize', positionHandle);

  let dragging = false;
  let startX = 0;
  let startW = SB_DEFAULT;

  handle.addEventListener('mousedown', (e) => {
    dragging = true;
    startX = e.clientX;
    startW = sidebar.getBoundingClientRect().width;
    handle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    let newW = Math.max(SB_MIN, Math.min(SB_MAX, startW + dx));
    applySidebarWidth(newW);
    positionHandle();
  });

  window.addEventListener('mouseup', () => {
    if (dragging) {
      dragging = false;
      handle.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      const finalW = Math.round(sidebar.getBoundingClientRect().width);
      localStorage.setItem(STORE_KEY, finalW);
    }
  });

  function applySidebarWidth(w) {
    const isTplOpen = container.classList.contains('templates-open');
    container.style.gridTemplateColumns = `${w}px 1fr ${isTplOpen ? '320px' : '0px'}`;
    const bottomBar = document.querySelector('.action-bar-bottom');
    if (bottomBar) bottomBar.style.left = `${w}px`;
  }
}

// ── PRESCRIPTION PRINTING & PREVIEW ─────────────────────────────────
function openPrescriptionPreview(isDirectPrint = false) {
  const d = getFormData();
  if (!d.name) {
    showToast('Please enter Patient Name before printing.', 'error');
    document.getElementById('f-name').focus();
    return;
  }

  // Populate preview elements
  // Header image
  const headerImg = document.getElementById('rx-img-header');
  if (window.HAJRA_ASSETS && window.HAJRA_ASSETS.header) {
    headerImg.src = window.HAJRA_ASSETS.header;
  } else {
    headerImg.src = 'assets/prescription-header.png';
  }

  // Patient info row 1
  document.getElementById('prx-name').textContent = d.name || '';
  document.getElementById('prx-relation-lbl').textContent = (d.relation || 'S/O') + ':';
  document.getElementById('prx-parent-name').textContent = d.parentage || '';
  const printDate = d.date || HMC_DB.getPSTDate();
  document.getElementById('prx-date').textContent = formatPrintDate(printDate);

  // Patient info row 2
  document.getElementById('prx-age').textContent = d.age ? `${d.age} Y` : '';
  document.getElementById('prx-gender').textContent = d.gender || '';
  document.getElementById('prx-refno').textContent = d.mrNumber || '';
  document.getElementById('prx-visit').textContent = d.visitNo || '1';

  // Patient info row 3
  document.getElementById('prx-address').textContent = d.address || '';
  document.getElementById('prx-phone').textContent = d.phone || '';

  // Left Column
  document.getElementById('prx-allergy').innerHTML = d.allergy || 'Nil';
  document.getElementById('prx-symptoms').innerHTML = d.symptoms || '';
  document.getElementById('prx-findings').innerHTML = d.findings || '';
  document.getElementById('prx-comments').innerHTML = d.comments || '';
  document.getElementById('prx-investigations').innerHTML = d.investigations || '';

  // Right Column
  document.getElementById('prx-temp').textContent = d.temp ? `${d.temp} °F` : '—';
  document.getElementById('prx-bp').textContent = d.bp || '—';
  document.getElementById('prx-rr').textContent = d.rr || '—';
  document.getElementById('prx-pulse').textContent = d.pulse ? `${d.pulse} /m` : '—';
  document.getElementById('prx-weight').textContent = d.weight ? `${d.weight} kg` : '—';

  document.getElementById('prx-diagnosis').innerHTML = d.diagnosis || '';
  document.getElementById('prx-treatment').innerHTML = d.treatment || '';

  document.getElementById('prx-revisit').textContent = d.revisit || '—';

  // Show modal
  const modal = document.getElementById('modal-rx-preview');
  modal.classList.add('open');

  if (isDirectPrint) {
    setTimeout(() => {
      window.print();
    }, 200);
  }
}

function closePrescriptionPreview() {
  document.getElementById('modal-rx-preview').classList.remove('open');
}

function executeDirectPrint() {
  window.print();
}

function handleWalkInPrint() {
  const d = getFormData();
  if (!d.name) {
    document.getElementById('f-name').value = 'Walk-in Patient';
  }
  openPrescriptionPreview(true);
}

// ── PATIENT VISIT HISTORY MODAL ──────────────────────────────────────
async function openPatientHistoryModal() {
  const mr = document.getElementById('f-mr').value.trim();
  if (!mr) {
    showToast('No MR number active.', 'error');
    return;
  }

  const visits = await HMC_DB.getPatientVisits(mr);
  const container = document.getElementById('history-visits-container');
  const name = document.getElementById('f-name').value;

  document.getElementById('history-patient-title').textContent = `Visit History: ${name} (${mr})`;

  if (visits.length === 0) {
    container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-light);">No visit records found.</div>';
  } else {
    container.innerHTML = visits.map(v => `
      <div style="border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:12px;background:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-weight:700;font-size:14px;color:var(--navy);">Visit #${v.visitNo} · ${v.date} ${v.time}</span>
          <button class="btn btn-outline" style="padding:4px 10px;font-size:11.5px;" onclick="loadPatientBySerial(${v.serialNo}); closeModals();">
            Load This Visit
          </button>
        </div>
        <div style="font-size:12px;color:var(--text-muted);display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div><strong>Diagnosis:</strong> ${v.diagnosis || '—'}</div>
          <div><strong>BP / Pulse:</strong> ${v.bp || '—'} / ${v.pulse || '—'}</div>
        </div>
        <div style="font-size:12px;margin-top:6px;background:#F8FAFC;padding:8px;border-radius:4px;white-space:pre-wrap;">
          <strong>Rx Treatment:</strong><br>${stripHtml(v.treatment || '—')}
        </div>
      </div>
    `).join('');
  }

  document.getElementById('modal-patient-history').classList.add('open');
}

// ── APPOINTMENTS MODULE ──────────────────────────────────────────────
let _apptViewDate = HMC_DB.getPSTDate();

async function openAppointmentsModal() {
  _apptViewDate = HMC_DB.getPSTDate();
  document.getElementById('appt-filter-date').value = _apptViewDate;
  await renderAppointmentsQueue();
  document.getElementById('modal-appointments').classList.add('open');
}

async function renderAppointmentsQueue() {
  const list = await HMC_DB.getAppointmentsByDate(_apptViewDate);
  const queueEl = document.getElementById('appt-queue-list');
  const nowServingEl = document.getElementById('appt-now-serving-banner');

  let waitingCount = 0;
  let seenCount = 0;
  let nextAppt = null;

  list.forEach(a => {
    if (a.status === 'waiting') waitingCount++;
    if (a.status === 'seen') seenCount++;
    if (a.status === 'next' && !nextAppt) nextAppt = a;
  });

  document.getElementById('appt-stat-total').textContent = list.length;
  document.getElementById('appt-stat-waiting').textContent = waitingCount;
  document.getElementById('appt-stat-seen').textContent = seenCount;
  document.getElementById('appt-stat-next').textContent = nextAppt ? `#${nextAppt.token}` : '—';

  // Now serving banner
  if (nextAppt) {
    nowServingEl.style.display = 'flex';
    nowServingEl.innerHTML = `
      <div style="flex:1;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.8px;opacity:0.85;">Currently Calling</div>
        <div style="font-size:22px;font-weight:800;">Token #${nextAppt.token} — ${escapeHtml(nextAppt.name)}</div>
        <div style="font-size:12px;opacity:0.9;">${nextAppt.type} ${nextAppt.phone ? '· ' + nextAppt.phone : ''}</div>
      </div>
      <button class="btn btn-save" onclick="updateApptStatus('${nextAppt.id}', 'seen')">✓ Mark Seen</button>
    `;
  } else {
    nowServingEl.style.display = 'none';
  }

  if (list.length === 0) {
    queueEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-light);">No appointments for this date. Click "+ Add Appointment" to register.</div>';
    return;
  }

  queueEl.innerHTML = list.map(a => `
    <div class="queue-card ${a.status}">
      <div class="queue-token">#${a.token}</div>
      <div style="flex:1;margin:0 12px;">
        <div style="font-weight:700;font-size:13.5px;color:var(--navy);">${escapeHtml(a.name)}</div>
        <div style="font-size:11.5px;color:var(--text-muted);">
          ${a.phone ? '📞 ' + a.phone + ' · ' : ''}${a.type} ${a.time ? '· 🕒 ' + a.time : ''}
        </div>
        ${a.notes ? `<div style="font-size:11px;color:var(--text-light);">${escapeHtml(a.notes)}</div>` : ''}
      </div>
      <div style="display:flex;gap:6px;align-items:center;">
        ${a.status === 'waiting' ? `
          <button class="btn btn-save" style="padding:4px 8px;font-size:11px;" onclick="updateApptStatus('${a.id}', 'next')">📍 Call Next</button>
          <button class="btn btn-outline" style="padding:4px 8px;font-size:11px;" onclick="updateApptStatus('${a.id}', 'seen')">✓ Seen</button>
        ` : a.status === 'next' ? `
          <button class="btn btn-save" style="padding:4px 8px;font-size:11px;" onclick="updateApptStatus('${a.id}', 'seen')">✓ Seen</button>
        ` : `
          <span style="font-size:11px;font-weight:700;color:var(--green);padding:4px 8px;background:var(--green-subtle);border-radius:4px;">Completed</span>
        `}
        ${a.phone ? `
          <button class="btn btn-outline" style="padding:4px 8px;font-size:11px;color:#25D366;border-color:#25D366;" onclick="sendWhatsAppAppointment('${a.id}')" title="Send WhatsApp">
            💬 WA
          </button>
        ` : ''}
        <button class="btn btn-outline" style="padding:4px 8px;font-size:11px;color:var(--red);" onclick="deleteAppt('${a.id}')">🗑</button>
      </div>
    </div>
  `).join('');
}

async function handleAddAppointment(e) {
  e.preventDefault();
  const name = document.getElementById('appt-new-name').value.trim();
  const phone = document.getElementById('appt-new-phone').value.trim();
  const time = document.getElementById('appt-new-time').value.trim();
  const type = document.getElementById('appt-new-type').value;
  const notes = document.getElementById('appt-new-notes').value.trim();

  if (!name) {
    showToast('Enter patient name for appointment.', 'error');
    return;
  }

  await HMC_DB.saveAppointment({
    date: _apptViewDate,
    name, phone, time, type, notes
  });

  document.getElementById('form-add-appt').reset();
  showToast('Appointment added to queue.', 'success');
  await renderAppointmentsQueue();
}

async function updateApptStatus(id, status) {
  await HMC_DB.updateAppointmentStatus(id, status);
  await renderAppointmentsQueue();
}

async function deleteAppt(id) {
  if (confirm('Delete this appointment?')) {
    await HMC_DB.deleteAppointment(id);
    await renderAppointmentsQueue();
    showToast('Appointment removed.', 'info');
  }
}

function sendWhatsAppAppointment(id) {
  HMC_DB.getAppointmentsByDate(_apptViewDate).then(list => {
    const a = list.find(x => x.id === id);
    if (!a || !a.phone) return;

    let cleanPhone = a.phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('03')) cleanPhone = '92' + cleanPhone.slice(1);

    const msg = 
`السلام علیکم *${a.name}*،
حاجرہ میڈیکل کمپلیکس جڑانوالہ میں آپ کا ٹوکن نمبر درج ذیل ہے:

*ٹوکن نمبر: #${a.token}*
*ڈاکٹر: ڈاکٹر حافظ احسان قدیر*
*تاریخ: ${a.date}*
${a.time ? `*وقت: ${a.time}*\n` : ''}
ایڈریس: اڈا جھال، فیصل آباد روڈ، جڑانوالہ
فون: 041-4711753 / 0313-6530553

براہ کرم وقت پر تشریف لائیں۔ جزاک اللہ خیر۔`;

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  });
}

// ── PAYMENTS & BILLING MODULE ────────────────────────────────────────
async function openBillingModal() {
  const currentFormData = getFormData();
  const nextRcp = await HMC_DB.getNextReceiptNumber();

  document.getElementById('pay-receipt-no').value = nextRcp;
  document.getElementById('pay-date').value = HMC_DB.getPSTDate();
  document.getElementById('pay-mr').value = currentFormData.mrNumber || '';
  document.getElementById('pay-name').value = currentFormData.name || '';
  document.getElementById('pay-visit').value = currentFormData.visitNo || '1';

  calculateBillingTotals();
  document.getElementById('modal-billing').classList.add('open');
}

function calculateBillingTotals() {
  const consult = parseFloat(document.getElementById('pay-consult').value) || 0;
  const proc = parseFloat(document.getElementById('pay-proc').value) || 0;
  const lab = parseFloat(document.getElementById('pay-lab').value) || 0;
  const img = parseFloat(document.getElementById('pay-img').value) || 0;
  const med = parseFloat(document.getElementById('pay-med').value) || 0;
  const other = parseFloat(document.getElementById('pay-other').value) || 0;
  const discount = parseFloat(document.getElementById('pay-discount').value) || 0;

  const total = consult + proc + lab + img + med + other - discount;
  const received = parseFloat(document.getElementById('pay-received').value) || 0;
  const balance = total - received;

  document.getElementById('pay-disp-total').textContent = `Rs. ${total.toLocaleString()}`;
  document.getElementById('pay-disp-balance').textContent = `Rs. ${balance.toLocaleString()}`;
}

async function handleSavePayment() {
  const payData = {
    receiptNo: document.getElementById('pay-receipt-no').value,
    date: document.getElementById('pay-date').value,
    mrNumber: document.getElementById('pay-mr').value,
    patientName: document.getElementById('pay-name').value,
    visitNo: document.getElementById('pay-visit').value,
    consultFee: document.getElementById('pay-consult').value,
    procedure: document.getElementById('pay-proc').value,
    lab: document.getElementById('pay-lab').value,
    imaging: document.getElementById('pay-img').value,
    medicine: document.getElementById('pay-med').value,
    other: document.getElementById('pay-other').value,
    discount: document.getElementById('pay-discount').value,
    amtReceived: document.getElementById('pay-received').value,
    payMethod: document.getElementById('pay-method').value,
    remarks: document.getElementById('pay-remarks').value
  };

  if (!payData.patientName) {
    showToast('Please enter patient name for payment receipt.', 'error');
    return;
  }

  try {
    const res = await HMC_DB.savePaymentRecord(payData);
    showToast(`Payment saved! Receipt: ${res.payment.receiptNo}`, 'success');
    printPaymentReceipt(res.payment);
  } catch (err) {
    showToast('Failed to save payment: ' + err.message, 'error');
  }
}

function printPaymentReceipt(p) {
  document.getElementById('rcp-no').textContent = p.receiptNo;
  document.getElementById('rcp-date').textContent = p.date;
  document.getElementById('rcp-mr').textContent = p.mrNumber || '—';
  document.getElementById('rcp-name').textContent = p.patientName;
  document.getElementById('rcp-visit').textContent = p.visitNo || '1';

  document.getElementById('rcp-consult').textContent = `Rs. ${(p.consultFee || 0).toLocaleString()}`;
  document.getElementById('rcp-proc').textContent = `Rs. ${(p.procedure || 0).toLocaleString()}`;
  document.getElementById('rcp-lab').textContent = `Rs. ${(p.lab || 0).toLocaleString()}`;
  document.getElementById('rcp-img').textContent = `Rs. ${(p.imaging || 0).toLocaleString()}`;
  document.getElementById('rcp-other').textContent = `Rs. ${(p.other || 0).toLocaleString()}`;
  document.getElementById('rcp-discount').textContent = `Rs. ${(p.discount || 0).toLocaleString()}`;
  document.getElementById('rcp-total').textContent = `Rs. ${(p.total || 0).toLocaleString()}`;
  document.getElementById('rcp-received').textContent = `Rs. ${(p.amtReceived || 0).toLocaleString()}`;
  document.getElementById('rcp-balance').textContent = `Rs. ${(p.balance || 0).toLocaleString()}`;
  document.getElementById('rcp-method').textContent = p.payMethod || 'Cash';

  const modal = document.getElementById('modal-receipt-preview');
  modal.classList.add('open');
}

// ── DATABASE & BACKUP MANAGEMENT ─────────────────────────────────────
function openDatabasePrompt() {
  document.getElementById('db-auth-input').value = '';
  document.getElementById('db-auth-error').textContent = '';
  document.getElementById('modal-db-auth').classList.add('open');
}

async function verifyDatabasePassword() {
  const entered = document.getElementById('db-auth-input').value;
  if (entered === getAppPassword()) {
    document.getElementById('modal-db-auth').classList.remove('open');
    await openDatabaseManager();
  } else {
    document.getElementById('db-auth-error').textContent = 'Incorrect password. Try again.';
  }
}

async function openDatabaseManager() {
  const stats = await HMC_DB.getDashboardStats();
  document.getElementById('db-rec-count').textContent = `${stats.totalPatients} Patients Registered`;
  document.getElementById('modal-db-manager').classList.add('open');
}

async function handleExportDatabaseJSON() {
  const fullData = await HMC_DB.exportFullDatabase();
  const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `HajraMedical_Backup_${HMC_DB.getPSTDate()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Database exported as JSON.', 'success');
}

async function handleExportPatientsCSV() {
  const csv = await HMC_DB.exportPatientsToCSV();
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `HajraMedical_Patients_${HMC_DB.getPSTDate()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Patients exported as CSV for Excel.', 'success');
}

function handleImportDatabase(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (confirm('Importing this file will restore patients, visits, payments, and appointments. Proceed?')) {
        await HMC_DB.importFullDatabase(data);
        showToast('Database restored successfully!', 'success');
        await refreshSidebarStats();
        await refreshRecentPatientsList();
        closeModals();
      }
    } catch (err) {
      showToast('Invalid backup file: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

// ── SECURITY & ACCESS CONTROL ─────────────────────────────────────────
function getAppPassword() {
  return localStorage.getItem('hmc_app_password') || localStorage.getItem('hmc_db_password') || '1234';
}

function checkLoginStatus() {
  const overlay = document.getElementById('app-login-overlay');
  if (!overlay) return;
  const isAuth = sessionStorage.getItem('hmc_auth_token') === 'unlocked';
  if (isAuth) {
    overlay.classList.add('hidden');
  } else {
    overlay.classList.remove('hidden');
    const pwdInput = document.getElementById('login-password');
    if (pwdInput) {
      pwdInput.value = '';
      setTimeout(() => pwdInput.focus(), 150);
    }
  }
}

function handleAppLogin() {
  const pwdInput = document.getElementById('login-password');
  const errEl = document.getElementById('login-error');
  const val = (pwdInput ? pwdInput.value : '').trim();
  const correct = getAppPassword();

  if (val === correct) {
    sessionStorage.setItem('hmc_auth_token', 'unlocked');
    const overlay = document.getElementById('app-login-overlay');
    if (overlay) overlay.classList.add('hidden');
    if (errEl) errEl.style.display = 'none';
    showToast('System unlocked. Welcome, Dr. Hafiz Ehsan Qadeer!', 'success');
  } else {
    if (errEl) {
      errEl.textContent = 'Incorrect password. Please try again.';
      errEl.style.display = 'block';
    }
    if (pwdInput) {
      pwdInput.select();
      pwdInput.focus();
    }
  }
}

function toggleLoginPassVis() {
  const inp = document.getElementById('login-password');
  if (inp) {
    inp.type = inp.type === 'password' ? 'text' : 'password';
  }
}

function lockSystemNow() {
  sessionStorage.removeItem('hmc_auth_token');
  closeModals();
  checkLoginStatus();
  showToast('System locked.', 'info');
}

// ── SETTINGS & CLOUD SYNC ─────────────────────────────────────────────
const DEFAULT_CLOUD_SYNC_URL = 'https://script.google.com/macros/s/AKfycbzTyJjQRhvDtPOCJXkDj-BiUsO3d8Ou82xwH-p99hVDO87-dDkYzjOu5dKCgRcEP24L/exec';

function getCloudSyncUrl() {
  const custom = (localStorage.getItem('hmc_cloud_sync_url') || '').trim();
  return custom || DEFAULT_CLOUD_SYNC_URL;
}

function openSettingsModal() {
  const modal = document.getElementById('modal-settings');
  if (!modal) return;
  modal.classList.add('open');

  const cloudUrl = getCloudSyncUrl();
  const autoSync = localStorage.getItem('hmc_auto_sync') !== 'false';
  const urlInp = document.getElementById('set-cloud-url');
  if (urlInp) urlInp.value = cloudUrl;
  const autoInp = document.getElementById('set-auto-sync');
  if (autoInp) autoInp.checked = autoSync;
}

function closeSettingsModal() {
  const modal = document.getElementById('modal-settings');
  if (modal) modal.classList.remove('open');
}

function switchSettingsTab(tab) {
  document.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.settings-pane').forEach(p => p.classList.remove('active'));
  const btn = document.getElementById(`stab-btn-${tab}`);
  const pane = document.getElementById(`spane-${tab}`);
  if (btn) btn.classList.add('active');
  if (pane) pane.classList.add('active');
}

function handleChangePassword() {
  const cur = document.getElementById('set-cur-pass').value;
  const n1 = document.getElementById('set-new-pass').value;
  const n2 = document.getElementById('set-confirm-pass').value;

  if (cur !== getAppPassword()) {
    showToast('Current password does not match.', 'error');
    return;
  }
  if (!n1 || n1.length < 1) {
    showToast('Please enter a valid new password.', 'error');
    return;
  }
  if (n1 !== n2) {
    showToast('New passwords do not match.', 'error');
    return;
  }

  localStorage.setItem('hmc_app_password', n1);
  localStorage.setItem('hmc_db_password', n1);
  _dbPassword = n1;
  const form = document.getElementById('form-change-password');
  if (form) form.reset();
  showToast('Password updated successfully!', 'success');
}

function saveCloudSyncConfig() {
  const urlInp = document.getElementById('set-cloud-url');
  const autoInp = document.getElementById('set-auto-sync');
  const url = (urlInp ? urlInp.value : '').trim();
  const auto = autoInp ? autoInp.checked : true;

  localStorage.setItem('hmc_cloud_sync_url', url || DEFAULT_CLOUD_SYNC_URL);
  localStorage.setItem('hmc_auto_sync', auto ? 'true' : 'false');
  showToast('Cloud Sync settings saved successfully!', 'success');
}

function getCloudSyncUrl() {
  const custom = (localStorage.getItem('hmc_cloud_sync_url') || '').trim();
  if (custom && custom.startsWith('https://script.google.com/macros/s/') && custom.endsWith('/exec')) {
    return custom;
  }
  return DEFAULT_CLOUD_SYNC_URL;
}

async function testCloudSyncConnection() {
  const urlInp = document.getElementById('set-cloud-url');
  const url = (urlInp ? urlInp.value : '').trim() || getCloudSyncUrl();
  const testBtn = document.getElementById('btn-test-sync');

  if (window.location.protocol === 'file:') {
    showToast('⚠️ Browsers block cloud API calls when opening HTML files via file:///. Please open using localhost:3000 or your Vercel URL.', 'warning', 7000);
    return;
  }

  if (!url.startsWith('https://script.google.com/macros/s/') || !url.endsWith('/exec')) {
    showToast('Invalid URL format! It must start with https://script.google.com/macros/s/ and end with /exec', 'error');
    return;
  }

  try {
    if (testBtn) testBtn.textContent = '⏳ Testing...';
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'action=status', {
      method: 'GET',
      mode: 'cors',
      redirect: 'follow',
      credentials: 'omit'
    });
    const data = await res.json();
    if (data && data.success) {
      showToast('✅ Connected! Google Apps Script is Active & Ready.', 'success', 5000);
    } else {
      showToast('⚠️ Script reached but returned: ' + (data.message || 'Error'), 'info');
    }
  } catch (err) {
    showToast('❌ Connection failed: ' + err.message + '. Please ensure Web App deployment has "Who has access: Anyone".', 'error', 6000);
  } finally {
    if (testBtn) testBtn.textContent = '⚡ Test Connection';
  }
}

async function handleCloudSyncClick(silent = false) {
  const cloudUrl = getCloudSyncUrl();
  const btn = document.getElementById('btn-header-sync');

  if (window.location.protocol === 'file:') {
    if (!silent) {
      showToast('Notice: For Cloud Sync, run the app via server (http://localhost:3000) or Vercel, not file:///. Browsers block redirects on local files.', 'warning', 7000);
    }
  }

  if (!cloudUrl) {
    if (!silent) {
      openSettingsModal();
      switchSettingsTab('sync');
      showToast('Please enter your Cloud Sync URL or use Backup & Transfer.', 'info');
    }
    return;
  }

  try {
    if (btn) {
      btn.classList.add('syncing');
      btn.innerHTML = '<span>☁</span> Syncing...';
    }

    const localData = await HMC_DB.exportFullDatabase();

    const response = await fetch(cloudUrl, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      credentials: 'omit',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'syncFullDatabase',
        data: localData.data,
        timestamp: Date.now()
      })
    });

    const text = await response.text();
    let result = null;
    try {
      result = JSON.parse(text);
    } catch (parseErr) {
      throw new Error('Google Apps Script returned invalid response. Make sure Web App is deployed as "New version".');
    }

    if (result && result.success) {
      if (result.data) {
        await HMC_DB.importFullDatabase({ data: result.data });
        await refreshSidebarStats();
        await refreshRecentPatientsList();
      }
      if (!silent) {
        showToast('☁ Synchronized with Cloud successfully!', 'success');
      }
      if (btn) {
        btn.classList.remove('syncing');
        btn.innerHTML = '<span>☁</span> Synced';
        setTimeout(() => { if (btn) btn.innerHTML = '<span>☁</span> Sync'; }, 3000);
      }
    } else {
      throw new Error(result.error || result.message || 'Cloud sync error');
    }
  } catch (err) {
    console.error('Cloud sync error:', err);
    if (!silent) {
      if (window.location.protocol === 'file:') {
        showToast('Sync notice: Browsers block cloud API on file:///. Please run using "npm run dev" (localhost:3000) or your Vercel link.', 'error', 7000);
      } else {
        showToast('Sync notice: ' + (err.message || 'Offline/Network error'), 'error');
      }
    }
    if (btn) {
      btn.classList.remove('syncing');
      btn.innerHTML = '<span>☁</span> Sync';
    }
  }
}

function triggerBackgroundAutoSync() {
  const auto = localStorage.getItem('hmc_auto_sync') !== 'false';
  const url = getCloudSyncUrl();
  if (auto && url) {
    handleCloudSyncClick(true);
  }
}

// ── MODALS HELPER ───────────────────────────────────────────────────
function setupModals() {
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('open');
      }
    });
  });
}

function closeModals() {
  document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
}

// ── UTILITIES ───────────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripHtml(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}
