// ============================================================
//  Dr. Akram Clinic Tandlianwala — Patient Management System
//  Code.gs  |  Google Apps Script Backend
//  Version : 2.0  (with Print System)
// ============================================================

var SHEET_NAME   = "Patients";
var SUMMARY_NAME = "Patient Summary";

// Summary sheet columns (15 columns)
var SCOL = {
  SERIAL    : 1,
  PATIENT_ID: 2,
  DATE      : 3,
  VISIT_NO  : 4,
  NAME      : 5,
  PARENTAGE : 6,
  AGE       : 7,
  GENDER    : 8,
  WEIGHT    : 9,
  PHONE     : 10,
  ADDRESS   : 11,
  ALLERGY   : 12,
  SYMPTOMS  : 13,
  FINDINGS  : 14,
  TREATMENT : 15
};
var SUMMARY_TOTAL_COLS = 15;

var COL = {
  SERIAL      : 1,
  PATIENT_ID  : 2,
  DATE        : 3,
  TIME        : 4,
  VISIT_NO    : 5,
  NAME        : 6,
  PARENTAGE   : 7,
  AGE         : 8,
  GENDER      : 9,
  WEIGHT      : 10,
  PHONE       : 11,
  ADDRESS     : 12,
  ALLERGY     : 13,
  SYMPTOMS    : 14,
  FINDINGS    : 15,
  TREATMENT   : 16,
  TEMP        : 17,
  BP          : 18,
  RR          : 19,
  PULSE       : 20,
  DIAGNOSIS   : 21,
  REVISIT     : 22,
  COMMENTS    : 23,
  INVESTIGATIONS : 24,
  CNIC        : 25,
  RICH_HTML   : 26
};

var TOTAL_COLS = 26;

// ── ENTRY POINT ─────────────────────────────────────────────
function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var page   = params.page || "";

  if (page === "print") {
    // Fetch the record server-side and inject into template
    // so no cross-origin data transfer is needed at all
    // Retrieve data from cache (key passed from client)
    var cacheKey = params.key || "";
    var serial   = params.serial || "";
    var data     = null;

    if (cacheKey) {
      data = getPrintJob(cacheKey);
    } else if (serial) {
      data = getRecordBySerial(serial);
    }

    var tmpl = HtmlService.createTemplateFromFile("PrintTemplate");
    tmpl.patientJson = data ? JSON.stringify(data) : "null";
    tmpl.autoprint   = (params.ap === "1") ? "true" : "false";

    return tmpl.evaluate()
      .setTitle("Prescription — Dr. Akram Clinic")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (page === "receipt") {
    var cacheKey = params.key || "";
    var data     = null;
    if (cacheKey) { data = getReceiptPrintJob(cacheKey); }
    var tmpl = HtmlService.createTemplateFromFile("ReceiptTemplate");
    tmpl.receiptJson = data ? JSON.stringify(data) : "null";
    return tmpl.evaluate()
      .setTitle("Receipt — Dr. Akram Clinic")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return HtmlService
    .createHtmlOutputFromFile("Index")
    .setTitle("Dr. Akram Clinic Tandlianwala")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
// ── BANNER NOTE: The "This application was created by a Google Apps Script user"
// info bar is injected by Chrome at the OS level and cannot be removed via code.
// The only way to suppress it is to share the URL with ?embedded=true appended:
// https://script.google.com/macros/s/YOUR_ID/exec?embedded=true
// You can also use the Blogger embedding method as the launcher page.

// ── STRIP HTML TO PLAIN TEXT (for Google Sheets readability) ──
function stripHtml(html) {
  if (!html) return "";
  var s = String(html);
  // Convert block-level closers to newlines before stripping tags
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/div>/gi, "\n");
  s = s.replace(/<\/p>/gi, "\n");
  s = s.replace(/<\/li>/gi, "\n");
  // Strip all remaining tags
  s = s.replace(/<[^>]+>/g, "");
  // Decode common HTML entities
  s = s.replace(/&amp;/g, "&");
  s = s.replace(/&lt;/g, "<");
  s = s.replace(/&gt;/g, ">");
  s = s.replace(/&nbsp;/g, " ");
  s = s.replace(/&#39;/g, "'");
  // Collapse 3+ consecutive newlines to 2
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

// ── SHEET HELPERS ────────────────────────────────────────────
function getSheet() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    var header = [
      "Serial No","Patient ID","Date","Time","Visit No",
      "Patient Name","Parentage","Age","Gender","Weight",
      "Phone Number","Address","Allergy",
      "Symptoms / History / Condition","Findings","Treatment",
      "Temp","B.P","R.R","Pulse","Diagnosis/Provisional","Revisit After (Days)",
      "Comments","Investigations","CNIC Number","Rich HTML"
    ];
    sheet.getRange(1,1,1,TOTAL_COLS).setValues([header]);
    sheet.getRange(1,1,1,TOTAL_COLS)
      .setBackground("#0B1D3A").setFontColor("#FFFFFF").setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ── SUMMARY SHEET HELPER ─────────────────────────────────────
function getSummarySheet() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SUMMARY_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SUMMARY_NAME);
    var header = [
      "Serial No", "Patient ID", "Date", "Visit No",
      "Patient Name", "Parentage", "Age", "Gender", "Weight",
      "Phone Number", "Address", "Allergy",
      "Symptoms / History / Condition", "Findings", "Treatment"
    ];
    sheet.getRange(1, 1, 1, SUMMARY_TOTAL_COLS).setValues([header]);
    sheet.getRange(1, 1, 1, SUMMARY_TOTAL_COLS)
      .setBackground("#1A5C3A").setFontColor("#FFFFFF").setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getAllData() {
  var sheet = getSheet();
  var last  = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, TOTAL_COLS).getValues();
}

// ── ID / SERIAL GENERATORS ───────────────────────────────────
function getNextSerial(data) {
  if (!data || data.length === 0) return 1;
  var max = 0;
  data.forEach(function(row) {
    var n = parseInt(row[COL.SERIAL - 1], 10);
    if (!isNaN(n) && n > max) max = n;
  });
  return max + 1;
}

function getNextPatientId(data) {
  if (!data || data.length === 0) return "PAT-00001";
  var max = 0;
  data.forEach(function(row) {
    var id = String(row[COL.PATIENT_ID - 1]);
    var m  = id.match(/PAT-(\d+)/);
    if (m) { var n = parseInt(m[1], 10); if (n > max) max = n; }
  });
  return "PAT-" + String(max + 1).padStart(5, "0");
}

// ── DATE / TIME ──────────────────────────────────────────────
function getPSTDate() {
  var pst = new Date(new Date().getTime() + 5*3600000);
  return pst.getUTCFullYear() + "-" +
    String(pst.getUTCMonth()+1).padStart(2,"0") + "-" +
    String(pst.getUTCDate()).padStart(2,"0");
}

function getPSTTime() {
  var pst = new Date(new Date().getTime() + 5*3600000);
  return String(pst.getUTCHours()).padStart(2,"0") + ":" +
    String(pst.getUTCMinutes()).padStart(2,"0") + ":" +
    String(pst.getUTCSeconds()).padStart(2,"0");
}

// ── ROW → OBJECT ─────────────────────────────────────────────
function rowToObject(row) {
  function fmtDate(v) {
    if (!v) return "";
    if (v instanceof Date) {
      var pst = new Date(v.getTime() + 5*3600000);
      return pst.getUTCFullYear()+"-"+String(pst.getUTCMonth()+1).padStart(2,"0")+"-"+String(pst.getUTCDate()).padStart(2,"0");
    }
    return String(v);
  }
  function fmtTime(v) {
    if (!v) return "";
    if (v instanceof Date) {
      var pst = new Date(v.getTime() + 5*3600000);
      return String(pst.getUTCHours()).padStart(2,"0")+":"+String(pst.getUTCMinutes()).padStart(2,"0")+":"+String(pst.getUTCSeconds()).padStart(2,"0");
    }
    return String(v);
  }
  var obj = {
    serialNo   : row[COL.SERIAL     - 1],
    patientId  : String(row[COL.PATIENT_ID - 1] || ""),
    date       : fmtDate(row[COL.DATE       - 1]),
    time       : fmtTime(row[COL.TIME       - 1]),
    visitNo    : Number(row[COL.VISIT_NO   - 1]) || 1,
    name       : String(row[COL.NAME       - 1] || ""),
    parentage  : String(row[COL.PARENTAGE  - 1] || ""),
    age        : String(row[COL.AGE        - 1] || ""),
    gender     : String(row[COL.GENDER     - 1] || ""),
    weight     : String(row[COL.WEIGHT     - 1] || ""),
    phone      : String(row[COL.PHONE      - 1] || ""),
    address    : String(row[COL.ADDRESS    - 1] || ""),
    allergy    : String(row[COL.ALLERGY    - 1] || ""),
    symptoms   : String(row[COL.SYMPTOMS   - 1] || ""),
    findings   : String(row[COL.FINDINGS   - 1] || ""),
    treatment  : String(row[COL.TREATMENT  - 1] || ""),
    temp       : String(row[COL.TEMP       - 1] || ""),
    bp         : String(row[COL.BP         - 1] || ""),
    rr         : String(row[COL.RR         - 1] || ""),
    pulse      : String(row[COL.PULSE      - 1] || ""),
    diagnosis  : String(row[COL.DIAGNOSIS  - 1] || ""),
    revisit    : String(row[COL.REVISIT    - 1] || ""),
    comments   : String(row[COL.COMMENTS   - 1] || ""),
    investigations : String(row[COL.INVESTIGATIONS - 1] || ""),
    cnic       : String(row[COL.CNIC       - 1] || ""),
    richHtml   : String(row[COL.RICH_HTML  - 1] || "")
  };
  // Unpack rich HTML blob back into individual fields (overrides plain text for app display)
  // Plain text in the named columns stays clean in Google Sheets;
  // the HTML blob in col 26 is used only by the web app for formatting.
  if (obj.richHtml) {
    try {
      var rich = JSON.parse(obj.richHtml);
      if (rich.allergy)        obj.allergy        = rich.allergy;
      if (rich.symptoms)       obj.symptoms       = rich.symptoms;
      if (rich.findings)       obj.findings       = rich.findings;
      if (rich.treatment)      obj.treatment      = rich.treatment;
      if (rich.diagnosis)      obj.diagnosis      = rich.diagnosis;
      if (rich.comments)       obj.comments       = rich.comments;
      if (rich.investigations) obj.investigations = rich.investigations;
    } catch(e) { /* malformed blob — use plain text fallback */ }
  }
  return obj;
}

// ── SEARCH ───────────────────────────────────────────────────
function searchPatients(query) {
  if (!query || query.trim() === "") return [];
  var q    = query.trim().toLowerCase();
  var data = getAllData();
  var rows = [];
  data.forEach(function(row) {
    var id   = String(row[COL.PATIENT_ID-1]).toLowerCase();
    var name = String(row[COL.NAME-1]).toLowerCase();
    var ph   = String(row[COL.PHONE-1]).toLowerCase();
    var addr = String(row[COL.ADDRESS-1]).toLowerCase();
    var cnic = String(row[COL.CNIC-1]).toLowerCase();
    if (id.includes(q)||name.includes(q)||ph.includes(q)||addr.includes(q)||cnic.includes(q))
      rows.push(rowToObject(row));
  });
  return rows;
}

// ── GET RECORD BY SERIAL ─────────────────────────────────────
function getRecordBySerial(serialNo) {
  var data = getAllData();
  for (var i=0; i<data.length; i++) {
    if (String(data[i][COL.SERIAL-1]) === String(serialNo))
      return rowToObject(data[i]);
  }
  return null;
}

// ── SAVE (NEW RECORD) ────────────────────────────────────────
function savePatient(formData) {
  try {
    var data      = getAllData();
    var sheet     = getSheet();
    var serial    = getNextSerial(data);
    var today     = getPSTDate();
    var now       = getPSTTime();
    var patientId, visitNo;
    if (formData.forcePatientId) {
      patientId = formData.forcePatientId;
      visitNo   = countVisits(data, patientId) + 1;
    } else {
      var existingId = findExistingPatientId(data, formData);
      if (existingId) {
        patientId = existingId;
        visitNo   = countVisits(data, existingId) + 1;
      } else {
        patientId = getNextPatientId(data);
        visitNo   = 1;
      }
    }
    // Allow manual visit number override
    if (formData.visitNo && !isNaN(parseInt(formData.visitNo,10)) && !formData.forcePatientId) {
      visitNo = parseInt(formData.visitNo, 10);
    }
    var newRow = new Array(TOTAL_COLS).fill("");
    newRow[COL.SERIAL     -1] = serial;
    newRow[COL.PATIENT_ID -1] = patientId;
    newRow[COL.DATE       -1] = today;
    newRow[COL.TIME       -1] = now;
    newRow[COL.VISIT_NO   -1] = visitNo;
    newRow[COL.NAME       -1] = formData.name      || "";
    newRow[COL.PARENTAGE  -1] = formData.parentage || "";
    newRow[COL.AGE        -1] = formData.age       || "";
    newRow[COL.GENDER     -1] = formData.gender    || "";
    newRow[COL.WEIGHT     -1] = formData.weight    || "";
    newRow[COL.PHONE      -1] = formData.phone     || "";
    newRow[COL.ADDRESS    -1] = formData.address   || "";
    // Store plain text in named columns (Sheets-readable, no HTML tags)
    newRow[COL.ALLERGY    -1] = stripHtml(formData.allergy)   || "";
    newRow[COL.SYMPTOMS   -1] = stripHtml(formData.symptoms)  || "";
    newRow[COL.FINDINGS   -1] = stripHtml(formData.findings)  || "";
    newRow[COL.TREATMENT  -1] = stripHtml(formData.treatment) || "";
    newRow[COL.TEMP       -1] = formData.temp      || "";
    newRow[COL.BP         -1] = formData.bp        || "";
    newRow[COL.RR         -1] = formData.rr        || "";
    newRow[COL.PULSE      -1] = formData.pulse     || "";
    newRow[COL.DIAGNOSIS  -1] = stripHtml(formData.diagnosis) || "";
    newRow[COL.REVISIT    -1] = formData.revisit   || "";
    newRow[COL.COMMENTS   -1] = stripHtml(formData.comments)  || "";
    newRow[COL.INVESTIGATIONS -1] = stripHtml(formData.investigations) || "";
    newRow[COL.CNIC       -1] = formData.cnic      || "";
    // Store rich HTML blob in col 26 — used only by the web app for formatting
    newRow[COL.RICH_HTML  -1] = JSON.stringify({
      allergy: formData.allergy || "",
      symptoms: formData.symptoms || "",
      findings: formData.findings || "",
      treatment: formData.treatment || "",
      diagnosis: formData.diagnosis || "",
      comments: formData.comments || "",
      investigations: formData.investigations || ""
    });
    sheet.appendRow(newRow);

    // ── Write selected fields to Patient Summary sheet ────────
    var summarySheet = getSummarySheet();
    var summaryRow = new Array(SUMMARY_TOTAL_COLS).fill("");
    summaryRow[SCOL.SERIAL     - 1] = serial;
    summaryRow[SCOL.PATIENT_ID - 1] = patientId;
    summaryRow[SCOL.DATE       - 1] = today;
    summaryRow[SCOL.VISIT_NO   - 1] = visitNo;
    summaryRow[SCOL.NAME       - 1] = formData.name      || "";
    summaryRow[SCOL.PARENTAGE  - 1] = formData.parentage || "";
    summaryRow[SCOL.AGE        - 1] = formData.age       || "";
    summaryRow[SCOL.GENDER     - 1] = formData.gender    || "";
    summaryRow[SCOL.WEIGHT     - 1] = formData.weight    || "";
    summaryRow[SCOL.PHONE      - 1] = formData.phone     || "";
    summaryRow[SCOL.ADDRESS    - 1] = formData.address   || "";
    summaryRow[SCOL.ALLERGY    - 1] = formData.allergy   || "";
    summaryRow[SCOL.SYMPTOMS   - 1] = formData.symptoms  || "";
    summaryRow[SCOL.FINDINGS   - 1] = formData.findings  || "";
    summaryRow[SCOL.TREATMENT  - 1] = formData.treatment || "";
    summarySheet.appendRow(summaryRow);

    return { success:true, message:"Patient record saved successfully.", patientId:patientId, serialNo:serial, visitNo:visitNo };
  } catch(e) {
    return { success:false, message:"Error saving record: "+e.message };
  }
}

// ── UPDATE (EXISTING RECORD) ─────────────────────────────────
function updatePatient(formData) {
  try {
    var sheet = getSheet();
    var data  = getAllData();
    var rowIndex = -1;
    for (var i=0; i<data.length; i++) {
      if (String(data[i][COL.SERIAL-1]) === String(formData.serialNo)) { rowIndex=i+2; break; }
    }
    if (rowIndex === -1) return { success:false, message:"Record not found." };
    sheet.getRange(rowIndex, COL.DATE     ).setValue(getPSTDate());
    sheet.getRange(rowIndex, COL.TIME     ).setValue(getPSTTime());
    sheet.getRange(rowIndex, COL.NAME     ).setValue(formData.name      || "");
    sheet.getRange(rowIndex, COL.PARENTAGE).setValue(formData.parentage || "");
    sheet.getRange(rowIndex, COL.AGE      ).setValue(formData.age       || "");
    sheet.getRange(rowIndex, COL.GENDER   ).setValue(formData.gender    || "");
    sheet.getRange(rowIndex, COL.WEIGHT   ).setValue(formData.weight    || "");
    sheet.getRange(rowIndex, COL.PHONE    ).setValue(formData.phone     || "");
    sheet.getRange(rowIndex, COL.ADDRESS  ).setValue(formData.address   || "");
    // Plain text in named columns (readable in Sheets)
    sheet.getRange(rowIndex, COL.ALLERGY  ).setValue(stripHtml(formData.allergy)   || "");
    sheet.getRange(rowIndex, COL.SYMPTOMS ).setValue(stripHtml(formData.symptoms)  || "");
    sheet.getRange(rowIndex, COL.FINDINGS ).setValue(stripHtml(formData.findings)  || "");
    sheet.getRange(rowIndex, COL.TREATMENT).setValue(stripHtml(formData.treatment) || "");
    sheet.getRange(rowIndex, COL.TEMP     ).setValue(formData.temp      || "");
    sheet.getRange(rowIndex, COL.BP       ).setValue(formData.bp        || "");
    sheet.getRange(rowIndex, COL.RR       ).setValue(formData.rr        || "");
    sheet.getRange(rowIndex, COL.PULSE    ).setValue(formData.pulse     || "");
    sheet.getRange(rowIndex, COL.DIAGNOSIS).setValue(stripHtml(formData.diagnosis) || "");
    sheet.getRange(rowIndex, COL.REVISIT  ).setValue(formData.revisit   || "");
    sheet.getRange(rowIndex, COL.COMMENTS ).setValue(stripHtml(formData.comments)  || "");
    sheet.getRange(rowIndex, COL.INVESTIGATIONS).setValue(stripHtml(formData.investigations) || "");
    sheet.getRange(rowIndex, COL.CNIC     ).setValue(formData.cnic      || "");
    // Rich HTML blob in col 26 (used only by web app, hidden from Sheets view)
    sheet.getRange(rowIndex, COL.RICH_HTML).setValue(JSON.stringify({
      allergy: formData.allergy || "",
      symptoms: formData.symptoms || "",
      findings: formData.findings || "",
      treatment: formData.treatment || "",
      diagnosis: formData.diagnosis || "",
      comments: formData.comments || "",
      investigations: formData.investigations || ""
    }));

    // ── Sync update to Patient Summary sheet ─────────────────
    try {
      var summarySheet = getSummarySheet();
      var sLast = summarySheet.getLastRow();
      if (sLast >= 2) {
        var sData = summarySheet.getRange(2, 1, sLast - 1, SUMMARY_TOTAL_COLS).getValues();
        for (var j = 0; j < sData.length; j++) {
          if (String(sData[j][SCOL.SERIAL - 1]) === String(formData.serialNo)) {
            var sRow = j + 2; // +1 for header, +1 for 1-based
            summarySheet.getRange(sRow, SCOL.DATE     ).setValue(getPSTDate());
            summarySheet.getRange(sRow, SCOL.NAME     ).setValue(formData.name      || "");
            summarySheet.getRange(sRow, SCOL.PARENTAGE).setValue(formData.parentage || "");
            summarySheet.getRange(sRow, SCOL.AGE      ).setValue(formData.age       || "");
            summarySheet.getRange(sRow, SCOL.GENDER   ).setValue(formData.gender    || "");
            summarySheet.getRange(sRow, SCOL.WEIGHT   ).setValue(formData.weight    || "");
            summarySheet.getRange(sRow, SCOL.PHONE    ).setValue(formData.phone     || "");
            summarySheet.getRange(sRow, SCOL.ADDRESS  ).setValue(formData.address   || "");
            summarySheet.getRange(sRow, SCOL.ALLERGY  ).setValue(formData.allergy   || "");
            summarySheet.getRange(sRow, SCOL.SYMPTOMS ).setValue(formData.symptoms  || "");
            summarySheet.getRange(sRow, SCOL.FINDINGS ).setValue(formData.findings  || "");
            summarySheet.getRange(sRow, SCOL.TREATMENT).setValue(formData.treatment || "");
            break;
          }
        }
      }
    } catch(se) { /* summary update is best-effort; main record already saved */ }

    return { success:true, message:"Record updated successfully." };
  } catch(e) {
    return { success:false, message:"Error updating record: "+e.message };
  }
}

// ── DASHBOARD STATS ──────────────────────────────────────────
function getDashboardStats() {
  try {
    var data = getAllData();
    var today = getPSTDate();
    var patIds = {}, todayPat = 0, returning = 0;
    data.forEach(function(row) {
      var pid = String(row[COL.PATIENT_ID-1]);
      var rawDate = row[COL.DATE-1];
      var date;
      if (rawDate instanceof Date) {
        var pst = new Date(rawDate.getTime()+5*3600000);
        date = pst.getUTCFullYear()+"-"+String(pst.getUTCMonth()+1).padStart(2,"0")+"-"+String(pst.getUTCDate()).padStart(2,"0");
      } else { date = String(rawDate); }
      var visit = parseInt(row[COL.VISIT_NO-1],10);
      if (!patIds[pid]) patIds[pid]=0; patIds[pid]++;
      if (date===today) todayPat++;
      if (!isNaN(visit)&&visit>1) returning++;
    });
    return { success:true, totalPatients:Object.keys(patIds).length, todayPatients:todayPat, returningPatients:returning };
  } catch(e) {
    return { success:false, totalPatients:0, todayPatients:0, returningPatients:0 };
  }
}

// ── TEMP PRINT RECORD ────────────────────────────────────────
// Stores a lightweight print job in script cache so doGet can retrieve it
function savePrintJob(dataJson) {
  try {
    var cache = CacheService.getScriptCache();
    var key   = "print_" + new Date().getTime() + "_" + Math.floor(Math.random()*9999);
    cache.put(key, dataJson, 120); // expires in 120 seconds
    return { success: true, key: key };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

function getPrintJob(key) {
  try {
    var cache = CacheService.getScriptCache();
    var raw   = cache.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch(e) {
    return null;
  }
}

// ── GET ALL VISITS FOR A PATIENT ID ─────────────────────────
function getPatientVisits(patientId) {
  try {
    var data = getAllData();
    var visits = [];
    data.forEach(function(row) {
      if (String(row[COL.PATIENT_ID-1]) === String(patientId)) {
        visits.push(rowToObject(row));
      }
    });
    visits.sort(function(a,b){ return b.visitNo - a.visitNo; });
    return { success: true, visits: visits };
  } catch(e) {
    return { success: false, visits: [], message: e.message };
  }
}

function countVisits(data, patientId) {
  var count = 0;
  data.forEach(function(row) { if (String(row[COL.PATIENT_ID-1])===patientId) count++; });
  return count;
}

function findExistingPatientId(data, formData) {
  var name  = (formData.name  ||"").trim().toLowerCase();
  var phone = (formData.phone ||"").trim().toLowerCase();
  var addr  = (formData.address||"").trim().toLowerCase();
  for (var i=0; i<data.length; i++) {
    var rn = String(data[i][COL.NAME-1]).trim().toLowerCase();
    var rp = String(data[i][COL.PHONE-1]).trim().toLowerCase();
    var ra = String(data[i][COL.ADDRESS-1]).trim().toLowerCase();
    if (name&&phone&&rn===name&&rp===phone) return String(data[i][COL.PATIENT_ID-1]);
    if (name&&addr&&rn===name&&ra===addr)   return String(data[i][COL.PATIENT_ID-1]);
  }
  return null;
}

// ══════════════════════════════════════════════════════════════
//  CLINICAL TEMPLATES — Cloud-Synced via Google Sheets
// ══════════════════════════════════════════════════════════════
var TEMPLATES_SHEET = "ClinicalTemplates";
var TCOL = { ID:1, CAT:2, NAME:3, BODY:4, CREATED:5, UPDATED:6 };
var TCOLS = 6;

function getTemplatesSheet() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TEMPLATES_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(TEMPLATES_SHEET);
    var header = ["Template ID","Category","Template Name","Content","Created At","Updated At"];
    sheet.getRange(1,1,1,TCOLS).setValues([header]);
    sheet.getRange(1,1,1,TCOLS)
      .setBackground("#1A5C3A").setFontColor("#FFFFFF").setFontWeight("bold");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 140);
    sheet.setColumnWidth(3, 200);
    sheet.setColumnWidth(4, 400);
  }
  return sheet;
}

function getTemplates() {
  try {
    var sheet = getTemplatesSheet();
    var last  = sheet.getLastRow();
    if (last < 2) return { success:true, templates:[] };
    var rows  = sheet.getRange(2,1,last-1,TCOLS).getValues();
    var templates = [];
    rows.forEach(function(row) {
      var id = String(row[TCOL.ID-1]||"").trim();
      if (!id) return;
      templates.push({
        id     : id,
        cat    : String(row[TCOL.CAT    -1]||""),
        name   : String(row[TCOL.NAME   -1]||""),
        body   : String(row[TCOL.BODY   -1]||""),
        created: String(row[TCOL.CREATED-1]||""),
        updated: String(row[TCOL.UPDATED-1]||"")
      });
    });
    return { success:true, templates:templates };
  } catch(e) {
    return { success:false, templates:[], message:e.message };
  }
}

function addTemplate(tpl) {
  try {
    var sheet = getTemplatesSheet();
    var now   = getPSTDate() + " " + getPSTTime();
    var id    = tpl.id || ("T" + new Date().getTime());
    var last  = sheet.getLastRow();
    if (last >= 2) {
      var ids = sheet.getRange(2,TCOL.ID,last-1,1).getValues();
      for (var i=0; i<ids.length; i++) {
        if (String(ids[i][0]).trim() === String(id)) {
          return { success:false, message:"Duplicate ID." };
        }
      }
    }
    sheet.appendRow([id, tpl.cat||"", tpl.name||"", tpl.body||"", now, now]);
    return { success:true, id:id };
  } catch(e) {
    return { success:false, message:e.message };
  }
}

function updateTemplate(tpl) {
  try {
    var sheet = getTemplatesSheet();
    var last  = sheet.getLastRow();
    if (last < 2) return { success:false, message:"Not found." };
    var ids = sheet.getRange(2,TCOL.ID,last-1,1).getValues();
    var rowIdx = -1;
    for (var i=0; i<ids.length; i++) {
      if (String(ids[i][0]).trim() === String(tpl.id)) { rowIdx = i+2; break; }
    }
    if (rowIdx === -1) return { success:false, message:"Not found." };
    var now = getPSTDate() + " " + getPSTTime();
    sheet.getRange(rowIdx, TCOL.CAT    ).setValue(tpl.cat  ||"");
    sheet.getRange(rowIdx, TCOL.NAME   ).setValue(tpl.name ||"");
    sheet.getRange(rowIdx, TCOL.BODY   ).setValue(tpl.body ||"");
    sheet.getRange(rowIdx, TCOL.UPDATED).setValue(now);
    return { success:true };
  } catch(e) {
    return { success:false, message:e.message };
  }
}

function deleteTemplate(id) {
  try {
    var sheet = getTemplatesSheet();
    var last  = sheet.getLastRow();
    if (last < 2) return { success:false, message:"Not found." };
    var ids = sheet.getRange(2,TCOL.ID,last-1,1).getValues();
    for (var i=0; i<ids.length; i++) {
      if (String(ids[i][0]).trim() === String(id)) {
        sheet.deleteRow(i+2);
        return { success:true };
      }
    }
    return { success:false, message:"Not found." };
  } catch(e) {
    return { success:false, message:e.message };
  }
}

// ══════════════════════════════════════════════════════════════
//  BULK SEED — Recommendations Category
//  Call this ONCE from the GAS Script Editor (Run > seedRecommendations)
//  to pre-populate the ClinicalTemplates sheet with all 52 entries.
//  Safe to run multiple times — duplicate IDs are skipped automatically.
// ══════════════════════════════════════════════════════════════
function seedRecommendations() {
  var RECS = [
    { id:'r001', cat:'Recommendations', name:'Normal abdominal scan.',                            body:'Normal abdominal scan.' },
    { id:'r002', cat:'Recommendations', name:'Normal pelvic scan',                                body:'Normal pelvic scan' },
    { id:'r003', cat:'Recommendations', name:'Normal abdominal & KUB scan',                       body:'Normal abdominal & KUB scan' },
    { id:'r004', cat:'Recommendations', name:'Normal abdominal & pelvic scan',                    body:'Normal abdominal & pelvic scan' },
    { id:'r005', cat:'Recommendations', name:'Bilateral renal stones',                            body:'Bilateral renal stones' },
    { id:'r006', cat:'Recommendations', name:'Bilateral renal concretions',                       body:'Bilateral renal concretions' },
    { id:'r007', cat:'Recommendations', name:'Bilateral renal cysts (1)',                         body:'Bilateral renal cysts' },
    { id:'r008', cat:'Recommendations', name:'Bilateral renal cysts (2)',                         body:'Bilateral renal cysts' },
    { id:'r009', cat:'Recommendations', name:'Cholelithiasis induced cholecystitis',              body:'Cholelithiasis induced cholecystitis' },
    { id:'r010', cat:'Recommendations', name:'Fibroid Uterus',                                    body:'Fibroid Uterus' },
    { id:'r011', cat:'Recommendations', name:'Gallstones (Cholelithiasis)',                       body:'Gallstones (Cholelithiasis)' },
    { id:'r012', cat:'Recommendations', name:'Gallstone (Cholelithiasis)',                        body:'Gallstone (Cholelithiasis)' },
    { id:'r013', cat:'Recommendations', name:'Hepatomegaly',                                      body:'Hepatomegaly' },
    { id:'r014', cat:'Recommendations', name:'Hepatomegaly with liver parenchymal changes',       body:'Hepatomegaly with liver parenchymal changes' },
    { id:'r015', cat:'Recommendations', name:'Hepatosplenomegaly with liver parenchymal changes', body:'Hepatosplenomegaly with liver parenchymal changes' },
    { id:'r016', cat:'Recommendations', name:'Hepatomegaly (fatty / inflammatory changes).',      body:'Hepatomegaly (fatty / inflammatory changes).' },
    { id:'r017', cat:'Recommendations', name:'Left obstructive uropathy',                         body:'Left obstructive uropathy' },
    { id:'r018', cat:'Recommendations', name:'Left renal stone & hydronephroureter',              body:'Left renal stone & hydronephroureter' },
    { id:'r019', cat:'Recommendations', name:'Left renal stone',                                  body:'Left renal stone' },
    { id:'r020', cat:'Recommendations', name:'Left renal stones',                                 body:'Left renal stones' },
    { id:'r021', cat:'Recommendations', name:'Left renal concretion',                             body:'Left renal concretion' },
    { id:'r022', cat:'Recommendations', name:'Left renal cyst',                                   body:'Left renal cyst' },
    { id:'r023', cat:'Recommendations', name:'Left ureteric stone and hydronephroureter',         body:'Left ureteric stone and hydronephroureter' },
    { id:'r024', cat:'Recommendations', name:'Left adnexal cyst',                                 body:'Left adnexal cyst' },
    { id:'r025', cat:'Recommendations', name:'Liver parenchymal disease',                         body:'Liver parenchymal disease' },
    { id:'r026', cat:'Recommendations', name:'Multifibroid Uterus',                               body:'Multifibroid Uterus' },
    { id:'r027', cat:'Recommendations', name:'Right obstructive uropathy',                        body:'Right obstructive uropathy' },
    { id:'r028', cat:'Recommendations', name:'Right renal stone & hydronephroureter',             body:'Right renal stone & hydronephroureter' },
    { id:'r029', cat:'Recommendations', name:'Right renal stone',                                 body:'Right renal stone' },
    { id:'r030', cat:'Recommendations', name:'Right renal stones',                                body:'Right renal stones' },
    { id:'r031', cat:'Recommendations', name:'Right renal concretion',                            body:'Right renal concretion' },
    { id:'r032', cat:'Recommendations', name:'Right ureteric stone and hydronephroureter',        body:'Right ureteric stone and hydronephroureter' },
    { id:'r033', cat:'Recommendations', name:'Right adnexal cyst',                                body:'Right adnexal cyst' },
    { id:'r034', cat:'Recommendations', name:'Rule out Appendicitis (1)',                         body:'Rule out Appendicitis' },
    { id:'r035', cat:'Recommendations', name:'Splenomegaly',                                      body:'Splenomegaly' },
    { id:'r036', cat:'Recommendations', name:'Clinically Gastritis/Muscular pain.',               body:'Clinically Gastritis/Muscular pain.' },
    { id:'r037', cat:'Recommendations', name:'Clinically Gastritis/musculoskeletal pain.',        body:'Clinically Gastritis/musculoskeletal pain.' },
    { id:'r038', cat:'Recommendations', name:'Clinically Gastritis',                              body:'Clinically Gastritis' },
    { id:'r039', cat:'Recommendations', name:'Clinically Musculoskeletal pain',                   body:'Clinically Musculoskeletal pain' },
    { id:'r040', cat:'Recommendations', name:'Clinically backache',                               body:'Clinically backache' },
    { id:'r041', cat:'Recommendations', name:'Clinically low backache',                           body:'Clinically low backache' },
    { id:'r042', cat:'Recommendations', name:'Clinically Enteritis',                              body:'Clinically Enteritis' },
    { id:'r043', cat:'Recommendations', name:'Clinically Appendicitis',                           body:'Clinically Appendicitis' },
    { id:'r044', cat:'Recommendations', name:'Clinically muscular pain',                          body:'Clinically muscular pain' },
    { id:'r045', cat:'Recommendations', name:'Clinically intestinal colic',                       body:'Clinically intestinal colic' },
    { id:'r046', cat:'Recommendations', name:'Clinically UTI',                                    body:'Clinically UTI' },
    { id:'r047', cat:'Recommendations', name:'Clinically Enterocolitis',                          body:'Clinically Enterocolitis' },
    { id:'r048', cat:'Recommendations', name:'Clinically Bronchitis',                             body:'Clinically Bronchitis' },
    { id:'r049', cat:'Recommendations', name:'Epigastric hernia, Hernial rent is',                body:'Epigastric hernia, Hernial rent is' },
    { id:'r050', cat:'Recommendations', name:'Rule out Appendicitis (2)',                         body:'Rule out Appendicitis' },
    { id:'r051', cat:'Recommendations', name:'Umbilical hernia, Hernial rent is',                 body:'Umbilical hernia, Hernial rent is' },
    { id:'r052', cat:'Recommendations', name:'Clinically BPH',                                    body:'Clinically BPH' }
  ];

  var added = 0, skipped = 0;
  RECS.forEach(function(t) {
    var result = addTemplate(t);
    if (result.success) { added++; } else { skipped++; }
  });
  Logger.log('seedRecommendations complete: ' + added + ' added, ' + skipped + ' skipped (duplicates).');
  SpreadsheetApp.getUi().alert(
    'Seed Complete',
    added + ' Recommendations templates added.\n' + skipped + ' already existed (skipped).',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}


// ══════════════════════════════════════════════════════════════
//  PAYMENT & RECEIPT MANAGEMENT MODULE
//  Dr. Akram Clinic Tandlianwala
//  ──────────────────────────────────────────────────────────────
//  HOW TO ADD: Paste this entire block at the BOTTOM of Code.gs.
//  No existing function needs to be modified.
// ══════════════════════════════════════════════════════════════

var PAYMENTS_SHEET = "Payments";

// Payment sheet columns (17 columns)
var PCOL = {
  PAYMENT_ID   : 1,
  RECEIPT_NO   : 2,
  DATE         : 3,
  MR_NUMBER    : 4,
  PATIENT_NAME : 5,
  VISIT_NO     : 6,
  CONSULT_FEE  : 7,
  PROCEDURE    : 8,
  LAB          : 9,
  IMAGING      : 10,
  MEDICINE     : 11,
  SURGERY      : 12,
  CERT         : 13,
  EMERGENCY    : 14,
  HOMEVISIT    : 15,
  CONSUMABLES  : 16,
  PACKAGE      : 17,
  REGFEE       : 18,
  TAX          : 19,
  OTHER        : 20,
  DISCOUNT     : 21,
  TOTAL        : 22,
  AMT_RECEIVED : 23,
  BALANCE      : 24,
  PAY_METHOD   : 25,
  REMARKS      : 26,
  CREATED_AT   : 27
};
var PAYMENTS_TOTAL_COLS = 27;

// ── GET / CREATE PAYMENTS SHEET ──────────────────────────────
function getPaymentsSheet() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PAYMENTS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(PAYMENTS_SHEET);
    var header = [
      "Payment ID", "Receipt No", "Date", "MR Number", "Patient Name",
      "Visit No", "Consultation Fee", "Procedure Charges",
      "Laboratory Tests", "Imaging", "Medicines", "Minor Surgery",
      "Medical Certificate", "Emergency Charges", "Home Visit",
      "Consumables", "Package Charges", "Registration Fee", "Taxes/GST",
      "Other Charges", "Discount",
      "Total Amount", "Amount Received", "Balance",
      "Payment Method", "Remarks", "Created Timestamp"
    ];
    sheet.getRange(1, 1, 1, PAYMENTS_TOTAL_COLS).setValues([header]);
    sheet.getRange(1, 1, 1, PAYMENTS_TOTAL_COLS)
      .setBackground("#1A3A2A").setFontColor("#FFFFFF").setFontWeight("bold");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 130);
    sheet.setColumnWidth(2, 110);
    sheet.setColumnWidth(3, 110);
    sheet.setColumnWidth(4, 110);
    sheet.setColumnWidth(5, 180);
    sheet.setColumnWidth(17, 180);
  }
  return sheet;
}

// ── RECEIPT NUMBER GENERATOR ─────────────────────────────────
function getNextReceiptNumber() {
  var sheet = getPaymentsSheet();
  var last  = sheet.getLastRow();
  var prefix = "RCP-";
  if (last < 2) return prefix + "00001";
  var nums = sheet.getRange(2, PCOL.RECEIPT_NO, last - 1, 1).getValues();
  var max  = 0;
  nums.forEach(function(r) {
    var m = String(r[0]).match(/RCP-(\d+)/i);
    if (m) { var n = parseInt(m[1], 10); if (n > max) max = n; }
  });
  return prefix + String(max + 1).padStart(5, "0");
}

// ── PAYMENT ID GENERATOR ─────────────────────────────────────
function getNextPaymentId() {
  var sheet = getPaymentsSheet();
  var last  = sheet.getLastRow();
  var prefix = "PAY-";
  if (last < 2) return prefix + "00001";
  var ids = sheet.getRange(2, PCOL.PAYMENT_ID, last - 1, 1).getValues();
  var max = 0;
  ids.forEach(function(r) {
    var m = String(r[0]).match(/PAY-(\d+)/i);
    if (m) { var n = parseInt(m[1], 10); if (n > max) max = n; }
  });
  return prefix + String(max + 1).padStart(5, "0");
}

// ── SAVE PAYMENT ─────────────────────────────────────────────
function savePayment(payData) {
  try {
    var sheet     = getPaymentsSheet();
    var payId     = getNextPaymentId();
    var receiptNo = payData.receiptNo || getNextReceiptNumber();
    var now       = getPSTDate() + " " + getPSTTime();
    var date      = payData.date || getPSTDate();

    // Guard against duplicate receipt numbers
    var last = sheet.getLastRow();
    if (last >= 2) {
      var existing = sheet.getRange(2, PCOL.RECEIPT_NO, last - 1, 1).getValues();
      for (var i = 0; i < existing.length; i++) {
        if (String(existing[i][0]).trim() === String(receiptNo).trim()) {
          return { success: false, message: "Receipt number already exists: " + receiptNo };
        }
      }
    }

    var consultFee  = parseFloat(payData.consultFee)  || 0;
    var procedure   = parseFloat(payData.procedure)   || 0;
    var lab         = parseFloat(payData.lab)         || 0;
    var imaging     = parseFloat(payData.imaging)     || 0;
    var medicine    = parseFloat(payData.medicine)    || 0;
    var surgery     = parseFloat(payData.surgery)     || 0;
    var cert        = parseFloat(payData.cert)        || 0;
    var emergency   = parseFloat(payData.emergency)   || 0;
    var homevisit   = parseFloat(payData.homevisit)   || 0;
    var consumables = parseFloat(payData.consumables) || 0;
    var pakage      = parseFloat(payData.package)     || 0;
    var regfee      = parseFloat(payData.regfee)      || 0;
    var tax         = parseFloat(payData.tax)         || 0;
    var other       = parseFloat(payData.other)       || 0;
    var discount    = parseFloat(payData.discount)    || 0;
    var totalAmt    = consultFee + procedure + lab + imaging + medicine + surgery
                    + cert + emergency + homevisit + consumables + pakage + regfee + tax + other - discount;
    var amtReceived = parseFloat(payData.amtReceived) || 0;
    var balance     = totalAmt - amtReceived;

    var newRow = new Array(PAYMENTS_TOTAL_COLS).fill("");
    newRow[PCOL.PAYMENT_ID   - 1] = payId;
    newRow[PCOL.RECEIPT_NO   - 1] = receiptNo;
    newRow[PCOL.DATE         - 1] = date;
    newRow[PCOL.MR_NUMBER    - 1] = payData.mrNumber    || "";
    newRow[PCOL.PATIENT_NAME - 1] = payData.patientName || "";
    newRow[PCOL.VISIT_NO     - 1] = payData.visitNo     || "";
    newRow[PCOL.CONSULT_FEE  - 1] = consultFee;
    newRow[PCOL.PROCEDURE    - 1] = procedure;
    newRow[PCOL.LAB          - 1] = lab;
    newRow[PCOL.IMAGING      - 1] = imaging;
    newRow[PCOL.MEDICINE     - 1] = medicine;
    newRow[PCOL.SURGERY      - 1] = surgery;
    newRow[PCOL.CERT         - 1] = cert;
    newRow[PCOL.EMERGENCY    - 1] = emergency;
    newRow[PCOL.HOMEVISIT    - 1] = homevisit;
    newRow[PCOL.CONSUMABLES  - 1] = consumables;
    newRow[PCOL.PACKAGE      - 1] = pakage;
    newRow[PCOL.REGFEE       - 1] = regfee;
    newRow[PCOL.TAX          - 1] = tax;
    newRow[PCOL.OTHER        - 1] = other;
    newRow[PCOL.DISCOUNT     - 1] = discount;
    newRow[PCOL.TOTAL        - 1] = totalAmt;
    newRow[PCOL.AMT_RECEIVED - 1] = amtReceived;
    newRow[PCOL.BALANCE      - 1] = balance;
    newRow[PCOL.PAY_METHOD   - 1] = payData.payMethod   || "Cash";
    newRow[PCOL.REMARKS      - 1] = payData.remarks      || "";
    newRow[PCOL.CREATED_AT   - 1] = now;

    sheet.appendRow(newRow);
    return { success: true, paymentId: payId, receiptNo: receiptNo, total: totalAmt, balance: balance };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// ── UPDATE PAYMENT ───────────────────────────────────────────
function updatePayment(payData) {
  try {
    var sheet = getPaymentsSheet();
    var last  = sheet.getLastRow();
    if (last < 2) return { success: false, message: "No payments found." };

    var ids    = sheet.getRange(2, PCOL.PAYMENT_ID, last - 1, 1).getValues();
    var rowIdx = -1;
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === String(payData.paymentId).trim()) { rowIdx = i + 2; break; }
    }
    if (rowIdx === -1) return { success: false, message: "Payment not found." };

    var consultFee  = parseFloat(payData.consultFee)  || 0;
    var procedure   = parseFloat(payData.procedure)   || 0;
    var lab         = parseFloat(payData.lab)         || 0;
    var imaging     = parseFloat(payData.imaging)     || 0;
    var medicine    = parseFloat(payData.medicine)    || 0;
    var surgery     = parseFloat(payData.surgery)     || 0;
    var cert        = parseFloat(payData.cert)        || 0;
    var emergency   = parseFloat(payData.emergency)   || 0;
    var homevisit   = parseFloat(payData.homevisit)   || 0;
    var consumables = parseFloat(payData.consumables) || 0;
    var pakage      = parseFloat(payData.package)     || 0;
    var regfee      = parseFloat(payData.regfee)      || 0;
    var tax         = parseFloat(payData.tax)         || 0;
    var other       = parseFloat(payData.other)       || 0;
    var discount    = parseFloat(payData.discount)    || 0;
    var totalAmt    = consultFee + procedure + lab + imaging + medicine + surgery
                    + cert + emergency + homevisit + consumables + pakage + regfee + tax + other - discount;
    var amtReceived = parseFloat(payData.amtReceived) || 0;
    var balance     = totalAmt - amtReceived;

    sheet.getRange(rowIdx, PCOL.DATE        ).setValue(payData.date        || getPSTDate());
    sheet.getRange(rowIdx, PCOL.VISIT_NO    ).setValue(payData.visitNo     || "");
    sheet.getRange(rowIdx, PCOL.CONSULT_FEE ).setValue(consultFee);
    sheet.getRange(rowIdx, PCOL.PROCEDURE   ).setValue(procedure);
    sheet.getRange(rowIdx, PCOL.LAB         ).setValue(lab);
    sheet.getRange(rowIdx, PCOL.IMAGING     ).setValue(imaging);
    sheet.getRange(rowIdx, PCOL.MEDICINE    ).setValue(medicine);
    sheet.getRange(rowIdx, PCOL.SURGERY     ).setValue(surgery);
    sheet.getRange(rowIdx, PCOL.CERT        ).setValue(cert);
    sheet.getRange(rowIdx, PCOL.EMERGENCY   ).setValue(emergency);
    sheet.getRange(rowIdx, PCOL.HOMEVISIT   ).setValue(homevisit);
    sheet.getRange(rowIdx, PCOL.CONSUMABLES ).setValue(consumables);
    sheet.getRange(rowIdx, PCOL.PACKAGE     ).setValue(pakage);
    sheet.getRange(rowIdx, PCOL.REGFEE      ).setValue(regfee);
    sheet.getRange(rowIdx, PCOL.TAX         ).setValue(tax);
    sheet.getRange(rowIdx, PCOL.OTHER       ).setValue(other);
    sheet.getRange(rowIdx, PCOL.DISCOUNT    ).setValue(discount);
    sheet.getRange(rowIdx, PCOL.TOTAL       ).setValue(totalAmt);
    sheet.getRange(rowIdx, PCOL.AMT_RECEIVED).setValue(amtReceived);
    sheet.getRange(rowIdx, PCOL.BALANCE     ).setValue(balance);
    sheet.getRange(rowIdx, PCOL.PAY_METHOD  ).setValue(payData.payMethod   || "Cash");
    sheet.getRange(rowIdx, PCOL.REMARKS     ).setValue(payData.remarks     || "");

    return { success: true, receiptNo: String(sheet.getRange(rowIdx, PCOL.RECEIPT_NO).getValue()), total: totalAmt, balance: balance };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// ── DELETE PAYMENT ───────────────────────────────────────────
function deletePayment(paymentId) {
  try {
    var sheet = getPaymentsSheet();
    var last  = sheet.getLastRow();
    if (last < 2) return { success: false, message: "No payments found." };
    var ids = sheet.getRange(2, PCOL.PAYMENT_ID, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === String(paymentId).trim()) {
        sheet.deleteRow(i + 2);
        return { success: true };
      }
    }
    return { success: false, message: "Payment not found." };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// ── ROW → PAYMENT OBJECT ─────────────────────────────────────
function paymentRowToObj(row) {
  function fmtD(v) {
    if (!v) return "";
    if (v instanceof Date) {
      var pst = new Date(v.getTime() + 5 * 3600000);
      return pst.getUTCFullYear() + "-" + String(pst.getUTCMonth()+1).padStart(2,"0") + "-" + String(pst.getUTCDate()).padStart(2,"0");
    }
    return String(v);
  }
  return {
    paymentId  : String(row[PCOL.PAYMENT_ID   - 1] || ""),
    receiptNo  : String(row[PCOL.RECEIPT_NO   - 1] || ""),
    date       : fmtD (row[PCOL.DATE          - 1]),
    mrNumber   : String(row[PCOL.MR_NUMBER    - 1] || ""),
    patientName: String(row[PCOL.PATIENT_NAME - 1] || ""),
    visitNo    : String(row[PCOL.VISIT_NO     - 1] || ""),
    consultFee : Number(row[PCOL.CONSULT_FEE  - 1]) || 0,
    procedure  : Number(row[PCOL.PROCEDURE    - 1]) || 0,
    lab        : Number(row[PCOL.LAB          - 1]) || 0,
    imaging    : Number(row[PCOL.IMAGING      - 1]) || 0,
    medicine   : Number(row[PCOL.MEDICINE     - 1]) || 0,
    surgery    : Number(row[PCOL.SURGERY      - 1]) || 0,
    cert       : Number(row[PCOL.CERT         - 1]) || 0,
    emergency  : Number(row[PCOL.EMERGENCY    - 1]) || 0,
    homevisit  : Number(row[PCOL.HOMEVISIT    - 1]) || 0,
    consumables: Number(row[PCOL.CONSUMABLES  - 1]) || 0,
    package    : Number(row[PCOL.PACKAGE      - 1]) || 0,
    regfee     : Number(row[PCOL.REGFEE       - 1]) || 0,
    tax        : Number(row[PCOL.TAX          - 1]) || 0,
    other      : Number(row[PCOL.OTHER        - 1]) || 0,
    discount   : Number(row[PCOL.DISCOUNT     - 1]) || 0,
    total      : Number(row[PCOL.TOTAL        - 1]) || 0,
    amtReceived: Number(row[PCOL.AMT_RECEIVED - 1]) || 0,
    balance    : Number(row[PCOL.BALANCE      - 1]) || 0,
    payMethod  : String(row[PCOL.PAY_METHOD   - 1] || "Cash"),
    remarks    : String(row[PCOL.REMARKS      - 1] || ""),
    createdAt  : String(row[PCOL.CREATED_AT   - 1] || "")
  };
}

// ── GET ALL PAYMENTS ─────────────────────────────────────────
function getAllPayments() {
  var sheet = getPaymentsSheet();
  var last  = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, PAYMENTS_TOTAL_COLS).getValues();
}

// ── GET PAYMENT HISTORY FOR A PATIENT ───────────────────────
function getPatientPayments(mrNumber) {
  try {
    var data = getAllPayments();
    var result = [];
    data.forEach(function(row) {
      if (String(row[PCOL.MR_NUMBER - 1]).trim().toLowerCase() === String(mrNumber).trim().toLowerCase()) {
        result.push(paymentRowToObj(row));
      }
    });
    result.sort(function(a, b) { return b.createdAt.localeCompare(a.createdAt); });
    return { success: true, payments: result };
  } catch(e) {
    return { success: false, payments: [], message: e.message };
  }
}

// ── GET SINGLE PAYMENT BY ID ─────────────────────────────────
function getPaymentById(paymentId) {
  try {
    var data = getAllPayments();
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][PCOL.PAYMENT_ID - 1]).trim() === String(paymentId).trim()) {
        return { success: true, payment: paymentRowToObj(data[i]) };
      }
    }
    return { success: false, message: "Payment not found." };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// ── SEARCH PAYMENTS ──────────────────────────────────────────
function searchPayments(query) {
  try {
    if (!query || !query.trim()) return { success: true, payments: [] };
    var q    = query.trim().toLowerCase();
    var data = getAllPayments();
    var result = [];
    data.forEach(function(row) {
      var rno  = String(row[PCOL.RECEIPT_NO   - 1]).toLowerCase();
      var mr   = String(row[PCOL.MR_NUMBER    - 1]).toLowerCase();
      var name = String(row[PCOL.PATIENT_NAME - 1]).toLowerCase();
      var dt   = String(row[PCOL.DATE         - 1]).toLowerCase();
      if (rno.includes(q) || mr.includes(q) || name.includes(q) || dt.includes(q)) {
        result.push(paymentRowToObj(row));
      }
    });
    result.sort(function(a, b) { return b.date.localeCompare(a.date); });
    return { success: true, payments: result };
  } catch(e) {
    return { success: false, payments: [], message: e.message };
  }
}

// ── DAILY COLLECTION REPORT ──────────────────────────────────
function getPaymentReport(filter) {
  // filter: { type: 'today'|'yesterday'|'week'|'month'|'custom', from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }
  try {
    var data  = getAllPayments();
    var today = getPSTDate();

    var from, to;
    var t = filter ? filter.type : "today";

    if (t === "today") {
      from = today; to = today;
    } else if (t === "yesterday") {
      var yd = new Date(new Date().getTime() + 5*3600000 - 86400000);
      var y  = yd.getUTCFullYear() + "-" + String(yd.getUTCMonth()+1).padStart(2,"0") + "-" + String(yd.getUTCDate()).padStart(2,"0");
      from = y; to = y;
    } else if (t === "week") {
      var now  = new Date(new Date().getTime() + 5*3600000);
      var day  = now.getUTCDay(); // 0=Sun
      var diff = now.getTime() - day * 86400000;
      var wst  = new Date(diff);
      from = wst.getUTCFullYear()+"-"+String(wst.getUTCMonth()+1).padStart(2,"0")+"-"+String(wst.getUTCDate()).padStart(2,"0");
      to   = today;
    } else if (t === "month") {
      var nm = new Date(new Date().getTime() + 5*3600000);
      from = nm.getUTCFullYear()+"-"+String(nm.getUTCMonth()+1).padStart(2,"0")+"-01";
      to   = today;
    } else if (t === "custom") {
      from = filter.from || today;
      to   = filter.to   || today;
    } else {
      from = today; to = today;
    }

    var totals = { collection: 0, cash: 0, card: 0, jazzcash: 0, easypaisa: 0, bank: 0, discount: 0, outstanding: 0, count: 0 };
    var rows   = [];

    data.forEach(function(row) {
      var obj = paymentRowToObj(row);
      if (!obj.date) return;
      if (obj.date < from || obj.date > to) return;
      totals.count++;
      totals.collection  += obj.amtReceived;
      totals.discount    += obj.discount;
      totals.outstanding += obj.balance;
      var m = obj.payMethod.toLowerCase();
      if (m === "cash")          totals.cash      += obj.amtReceived;
      else if (m === "jazzcash") totals.jazzcash  += obj.amtReceived;
      else if (m === "easypaisa") totals.easypaisa += obj.amtReceived;
      else if (m === "bank transfer") totals.bank  += obj.amtReceived;
      else if (m === "credit card" || m === "debit card") totals.card += obj.amtReceived;
      rows.push(obj);
    });
    rows.sort(function(a,b){ return b.date.localeCompare(a.date); });
    return { success: true, from: from, to: to, totals: totals, rows: rows };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// ── GET NEXT RECEIPT NUMBER (exposed to client) ──────────────
function fetchNextReceiptNo() {
  try {
    return { success: true, receiptNo: getNextReceiptNumber() };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// ── SAVE RECEIPT PRINT JOB IN CACHE ─────────────────────────
// ── OPEN SPREADSHEET URL ────────────────────────────────────
function getSpreadsheetUrl() {
  try {
    return SpreadsheetApp.getActiveSpreadsheet().getUrl();
  } catch(e) {
    return null;
  }
}

function saveReceiptPrintJob(dataJson) {
  try {
    var cache = CacheService.getScriptCache();
    var key   = "rcp_" + new Date().getTime() + "_" + Math.floor(Math.random()*9999);
    cache.put(key, dataJson, 120);
    return { success: true, key: key };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

function getReceiptPrintJob(key) {
  try {
    var cache = CacheService.getScriptCache();
    var raw   = cache.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch(e) {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
//  APPOINTMENT SCHEDULING MODULE — BACKEND
//  Sheet name: Appointments
//  Columns: 12 total
// ══════════════════════════════════════════════════════════════

var APPT_SHEET = "Appointments";

var ACOL = {
  APPT_ID    : 1,   // A — unique appointment ID
  TOKEN      : 2,   // B — token number for the day
  DATE       : 3,   // C — appointment date (YYYY-MM-DD)
  NAME       : 4,   // D — patient name
  PHONE      : 5,   // E — phone / WhatsApp
  MR         : 6,   // F — MR number (optional)
  TIME       : 7,   // G — scheduled time
  TYPE       : 8,   // H — visit type
  NOTES      : 9,   // I — notes
  STATUS     : 10,  // J — waiting / next / seen / skipped
  WA_SENT    : 11,  // K — WhatsApp sent (TRUE/FALSE)
  CREATED_AT : 12   // L — created timestamp
};
var APPT_TOTAL_COLS = 12;

// ── GET / CREATE APPOINTMENTS SHEET ──────────────────────────
function getAppointmentsSheet() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(APPT_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(APPT_SHEET);
    var header = [
      "Appointment ID", "Token No", "Date", "Patient Name",
      "Phone", "MR Number", "Time", "Visit Type",
      "Notes", "Status", "WhatsApp Sent", "Created At"
    ];
    sheet.getRange(1, 1, 1, APPT_TOTAL_COLS).setValues([header]);
    sheet.getRange(1, 1, 1, APPT_TOTAL_COLS)
      .setBackground("#1A5276").setFontColor("#FFFFFF").setFontWeight("bold");
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, APPT_TOTAL_COLS, 130);
    sheet.setColumnWidth(4, 180);
    sheet.setColumnWidth(9, 220);
  }
  return sheet;
}

// ── SAVE NEW APPOINTMENT ──────────────────────────────────────
function saveAppointment(apptData) {
  try {
    var sheet = getAppointmentsSheet();
    var now   = getPSTDate() + " " + getPSTTime();

    // Check for duplicate apptId
    var last = sheet.getLastRow();
    if (last >= 2) {
      var ids = sheet.getRange(2, ACOL.APPT_ID, last - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0]).trim() === String(apptData.id).trim()) {
          return { success: false, message: "Appointment already exists." };
        }
      }
    }

    var row = new Array(APPT_TOTAL_COLS).fill("");
    row[ACOL.APPT_ID    - 1] = apptData.id       || "";
    row[ACOL.TOKEN      - 1] = apptData.token     || "";
    row[ACOL.DATE       - 1] = apptData.date      || getPSTDate();
    row[ACOL.NAME       - 1] = apptData.name      || "";
    row[ACOL.PHONE      - 1] = apptData.phone     || "";
    row[ACOL.MR         - 1] = apptData.mr        || "";
    row[ACOL.TIME       - 1] = apptData.time      || "";
    row[ACOL.TYPE       - 1] = apptData.type      || "Consultation";
    row[ACOL.NOTES      - 1] = apptData.notes     || "";
    row[ACOL.STATUS     - 1] = apptData.status    || "waiting";
    row[ACOL.WA_SENT    - 1] = apptData.waSent    ? "YES" : "NO";
    row[ACOL.CREATED_AT - 1] = now;

    sheet.appendRow(row);
    return { success: true, id: apptData.id };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// ── UPDATE APPOINTMENT STATUS ─────────────────────────────────
function updateAppointmentStatus(apptId, status) {
  try {
    var sheet = getAppointmentsSheet();
    var last  = sheet.getLastRow();
    if (last < 2) return { success: false, message: "No appointments found." };

    var ids = sheet.getRange(2, ACOL.APPT_ID, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === String(apptId).trim()) {
        sheet.getRange(i + 2, ACOL.STATUS).setValue(status);
        return { success: true };
      }
    }
    return { success: false, message: "Appointment not found." };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// ── UPDATE WA SENT FLAG ───────────────────────────────────────
function updateAppointmentWaSent(apptId) {
  try {
    var sheet = getAppointmentsSheet();
    var last  = sheet.getLastRow();
    if (last < 2) return { success: false };
    var ids = sheet.getRange(2, ACOL.APPT_ID, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === String(apptId).trim()) {
        sheet.getRange(i + 2, ACOL.WA_SENT).setValue("YES");
        return { success: true };
      }
    }
    return { success: false };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// ── DELETE APPOINTMENT ────────────────────────────────────────
function deleteAppointment(apptId) {
  try {
    var sheet = getAppointmentsSheet();
    var last  = sheet.getLastRow();
    if (last < 2) return { success: false, message: "No appointments found." };
    var ids = sheet.getRange(2, ACOL.APPT_ID, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === String(apptId).trim()) {
        sheet.deleteRow(i + 2);
        return { success: true };
      }
    }
    return { success: false, message: "Appointment not found." };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// ── GET APPOINTMENTS BY DATE ──────────────────────────────────
function getAppointmentsByDate(dateStr) {
  try {
    var sheet = getAppointmentsSheet();
    var last  = sheet.getLastRow();
    if (last < 2) return { success: true, appointments: [] };

    var rows   = sheet.getRange(2, 1, last - 1, APPT_TOTAL_COLS).getValues();
    var result = [];
    rows.forEach(function(row) {
      var rowDate = String(row[ACOL.DATE - 1]).trim().slice(0, 10);
      if (rowDate === dateStr) {
        result.push({
          id      : String(row[ACOL.APPT_ID    - 1]),
          token   : Number(row[ACOL.TOKEN      - 1]) || 0,
          date    : String(row[ACOL.DATE       - 1]).slice(0, 10),
          name    : String(row[ACOL.NAME       - 1]),
          phone   : String(row[ACOL.PHONE      - 1]),
          mr      : String(row[ACOL.MR         - 1]),
          time    : String(row[ACOL.TIME       - 1]),
          type    : String(row[ACOL.TYPE       - 1]),
          notes   : String(row[ACOL.NOTES      - 1]),
          status  : String(row[ACOL.STATUS     - 1]) || "waiting",
          waSent  : String(row[ACOL.WA_SENT    - 1]) === "YES",
          created : String(row[ACOL.CREATED_AT - 1])
        });
      }
    });
    result.sort(function(a, b) { return a.token - b.token; });
    return { success: true, appointments: result };
  } catch(e) {
    return { success: false, appointments: [], message: e.message };
  }
}
