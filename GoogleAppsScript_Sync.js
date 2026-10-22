/**
 * ====================================================================
 * HAJRA MEDICAL COMPLEX, JARANWALA — DR. HAFIZ EHSAN QADEER
 * Google Apps Script Cloud Sync Backend
 * ====================================================================
 * 
 * REQUESTED SHEET COLUMNS (Patient Records):
 * 1.  Serial No
 * 2.  Patient ID (MR Number)
 * 3.  Date
 * 4.  Visit No
 * 5.  Patient Name
 * 6.  Parentage (Relation + Name)
 * 7.  Age
 * 8.  Gender
 * 9.  Weight
 * 10. Phone Number
 * 11. Address
 * 12. Allergy
 * 13. Symptoms / History / Condition
 * 14. Findings
 * 15. Treatment
 * 
 * HOW TO UPDATE IN GOOGLE APPS SCRIPT:
 * 1. Open your Google Sheet ("Hajra Medical Complex Records")
 * 2. Click: Extensions -> Apps Script
 * 3. Replace all code in Code.gs with this file
 * 4. Click Save (💾)
 * 5. Click Deploy -> Manage deployments -> Click the Edit (pencil) icon ->
 *    Select "New version" -> Click Deploy!
 */

var SCRIPT_PROP = PropertiesService.getScriptProperties();

// The exact comprehensive headings
var HEADINGS = [
  'Serial No',
  'Patient ID',
  'Date',
  'Visit No',
  'Patient Name',
  'Relation',
  'Parentage',
  'Age',
  'Gender',
  'Weight',
  'Phone Number',
  'CNIC',
  'Address',
  'Temp',
  'BP',
  'Pulse',
  'Allergy',
  'Symptoms / History / Condition',
  'Findings',
  'Diagnosis',
  'Treatment',
  'Revisit Days'
];

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(30000); // 30 sec lock to avoid concurrent write collisions

  try {
    var rawData = e && e.postData ? e.postData.contents : (e && e.parameter ? e.parameter.data : null);
    var payload = {};
    if (rawData) {
      try {
        payload = JSON.parse(rawData);
      } catch (pErr) {
        payload = { action: 'status' };
      }
    }

    var action = payload.action || (e && e.parameter ? e.parameter.action : 'status');

    if (action === 'status') {
      return jsonResponse({
        success: true,
        message: 'Hajra Medical Complex Sync Service is Active',
        headings: HEADINGS,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'syncFullDatabase') {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var incoming = payload.data || {};

      // 1. Sync the primary user-requested sheet: "Patient Records"
      syncPatientRecordsSheet(ss, incoming.visits || []);

      // 2. Also sync Payments, Appointments, and full DB snapshot for 100% lossless multi-device sync
      if (incoming.payments && incoming.payments.length > 0) {
        syncPaymentsSheet(ss, incoming.payments);
      }

      if (incoming.appointments && incoming.appointments.length > 0) {
        syncAppointmentsSheet(ss, incoming.appointments);
      }

      // Store complete JSON state in a backup tab so mobile/PC sync never loses rich data
      storeFullState(ss, incoming);

      // Read back all merged data
      var allData = readFullState(ss, incoming);

      return jsonResponse({
        success: true,
        message: 'All records synchronized successfully with custom headings',
        data: allData,
        timestamp: new Date().toISOString()
      });
    }

    return jsonResponse({ success: false, message: 'Unknown action: ' + action });

  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Syncs the primary "Patient Records" sheet with exact user-requested columns
 */
function syncPatientRecordsSheet(ss, visits) {
  var sheetName = 'Patient Records';
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    // If old 'Visits' sheet exists, rename it to 'Patient Records'
    var oldVisits = ss.getSheetByName('Visits');
    if (oldVisits) {
      sheet = oldVisits;
      sheet.setName(sheetName);
    } else {
      var firstSheet = ss.getSheets()[0];
      if (firstSheet && firstSheet.getName() === 'Sheet1') {
        sheet = firstSheet;
        sheet.setName(sheetName);
      } else {
        sheet = ss.insertSheet(sheetName, 0);
      }
    }
  }

  // Remove legacy redundant sheets if present
  try {
    var legacyVisits = ss.getSheetByName('Visits');
    if (legacyVisits && legacyVisits.getSheetId() !== sheet.getSheetId()) {
      ss.deleteSheet(legacyVisits);
    }
    var legacyPatients = ss.getSheetByName('Patients');
    if (legacyPatients && legacyPatients.getSheetId() !== sheet.getSheetId()) {
      ss.deleteSheet(legacyPatients);
    }
  } catch (cleanErr) {}

  // Ensure Header row exists and is styled
  var headerRange = sheet.getRange(1, 1, 1, HEADINGS.length);
  headerRange.setValues([HEADINGS]);
  headerRange.setFontWeight('bold')
    .setBackground('#0D2B45')
    .setFontColor('#FFFFFF')
    .setFontSize(10)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 35);
  sheet.setFrozenRows(1);

  // Clear existing data rows (keep header)
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }

  if (!visits || visits.length === 0) return;

  // Build rows matching the exact headings with 100% clean plain text (no HTML tags)
  var rows = [];
  for (var i = 0; i < visits.length; i++) {
    var v = visits[i];

    var cleanDate = v.date || '';
    if (typeof cleanDate === 'string' && cleanDate.indexOf('T') !== -1) {
      cleanDate = cleanDate.split('T')[0];
    }
    var cleanTime = v.time || '';
    if (typeof cleanTime === 'string' && (cleanTime.indexOf('1899-12-30') !== -1 || cleanTime.indexOf('1899-12-31') !== -1)) {
      try {
        var dt = new Date(cleanTime);
        cleanTime = Utilities.formatDate(dt, 'Asia/Karachi', 'hh:mm:ss a');
      } catch (e) {
        cleanTime = '';
      }
    }

    var row = [
      v.serialNo || (i + 1),                              // 1. Serial No
      v.mrNumber || '',                                   // 2. Patient ID
      cleanDate + (cleanTime ? ' ' + cleanTime : ''),     // 3. Date
      v.visitNo !== undefined ? v.visitNo : 1,            // 4. Visit No
      v.name || '',                                       // 5. Patient Name
      v.relation || 'S/O',                                // 6. Relation
      v.parentage || '',                                  // 7. Parentage
      v.age || '',                                        // 8. Age
      v.gender || 'Male',                                 // 9. Gender
      v.weight || '',                                     // 10. Weight
      v.phone || '',                                      // 11. Phone Number
      v.cnic || '',                                       // 12. CNIC
      v.address || '',                                    // 13. Address
      v.temp || '',                                       // 14. Temp
      v.bp || '',                                         // 15. BP
      v.pulse || '',                                      // 16. Pulse
      stripHtmlToPlainText(v.allergy || ''),              // 17. Allergy
      stripHtmlToPlainText(v.symptoms || ''),             // 18. Symptoms / History / Condition
      stripHtmlToPlainText(v.findings || ''),             // 19. Findings
      stripHtmlToPlainText(v.diagnosis || ''),            // 20. Diagnosis
      stripHtmlToPlainText(v.treatment || ''),            // 21. Treatment
      v.revisit || ''                                     // 22. Revisit Days
    ];
    rows.push(row);
  }

  if (rows.length > 0) {
    var dataRange = sheet.getRange(2, 1, rows.length, HEADINGS.length);
    dataRange.setValues(rows);
    dataRange.setVerticalAlignment('top');
    dataRange.setWrap(true);
    dataRange.setFontSize(9.5);

    // Apply alternating row backgrounds for readability
    for (var r = 0; r < rows.length; r++) {
      var rowNum = r + 2;
      var bg = (r % 2 === 0) ? '#FFFFFF' : '#F8FAFC';
      sheet.getRange(rowNum, 1, 1, HEADINGS.length).setBackground(bg);
    }
  }

  // Set friendly column widths
  sheet.setColumnWidth(1, 70);   // Serial No
  sheet.setColumnWidth(2, 100);  // Patient ID
  sheet.setColumnWidth(3, 110);  // Date
  sheet.setColumnWidth(4, 70);   // Visit No
  sheet.setColumnWidth(5, 140);  // Patient Name
  sheet.setColumnWidth(6, 70);   // Relation
  sheet.setColumnWidth(7, 130);  // Parentage
  sheet.setColumnWidth(8, 60);   // Age
  sheet.setColumnWidth(9, 70);   // Gender
  sheet.setColumnWidth(10, 70);  // Weight
  sheet.setColumnWidth(11, 110); // Phone Number
  sheet.setColumnWidth(12, 120); // CNIC
  sheet.setColumnWidth(13, 150); // Address
  sheet.setColumnWidth(14, 60);  // Temp
  sheet.setColumnWidth(15, 70);  // BP
  sheet.setColumnWidth(16, 60);  // Pulse
  sheet.setColumnWidth(17, 120); // Allergy
  sheet.setColumnWidth(18, 200); // Symptoms / History
  sheet.setColumnWidth(19, 220); // Findings
  sheet.setColumnWidth(20, 150); // Diagnosis
  sheet.setColumnWidth(21, 250); // Treatment
  sheet.setColumnWidth(22, 90);  // Revisit Days
}

/**
 * Saves Billing & Payments
 */
function syncPaymentsSheet(ss, payments) {
  var headers = ['Receipt No', 'Date & Time', 'Patient ID', 'Patient Name', 'Total Fee', 'Discount', 'Net Amount', 'Received', 'Due/Change', 'Payment Mode'];
  var sheet = getOrCreateSheet(ss, 'Payments', headers, '#164264');
  
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }

  var rows = [];
  for (var i = 0; i < payments.length; i++) {
    var p = payments[i];
    rows.push([
      p.receiptNo || '',
      (p.date || '') + ' ' + (p.time || ''),
      p.mrNumber || '',
      p.patientName || '',
      p.totalFee || 0,
      p.discount || 0,
      p.netAmount || 0,
      p.receivedAmount || 0,
      p.changeDue || 0,
      p.paymentMode || 'Cash'
    ]);
  }

  if (rows.length > 0) {
    var r = sheet.getRange(2, 1, rows.length, headers.length);
    r.setValues(rows);
    r.setVerticalAlignment('top');
  }
}

/**
 * Saves Appointments
 */
function syncAppointmentsSheet(ss, appointments) {
  var headers = ['Token No', 'Date', 'Time', 'Patient ID', 'Name', 'Phone', 'Fee', 'Status', 'Notes'];
  var sheet = getOrCreateSheet(ss, 'Appointments', headers, '#008060');

  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }

  var rows = [];
  for (var i = 0; i < appointments.length; i++) {
    var a = appointments[i];
    rows.push([
      a.tokenNo || (i + 1),
      a.date || '',
      a.time || '',
      a.mrNumber || '',
      a.name || '',
      a.phone || '',
      a.fee || 0,
      a.status || 'waiting',
      a.notes || ''
    ]);
  }

  if (rows.length > 0) {
    var r = sheet.getRange(2, 1, rows.length, headers.length);
    r.setValues(rows);
    r.setVerticalAlignment('top');
  }
}

/**
 * Stores full JSON snapshot in a dedicated sync sheet for lossless cross-device sync
 */
function storeFullState(ss, incoming) {
  var sheet = ss.getSheetByName('_Sync_Data_Store');
  if (!sheet) {
    sheet = ss.insertSheet('_Sync_Data_Store');
    sheet.hideSheet(); // Keep hidden from normal view
  }
  sheet.clear();

  // Clean any old 1899 epoch or invalid ISO strings from visits
  if (incoming && incoming.visits && incoming.visits.length > 0) {
    for (var i = 0; i < incoming.visits.length; i++) {
      var item = incoming.visits[i];
      if (item.time && typeof item.time === 'string' && (item.time.indexOf('1899-12-30') !== -1 || item.time.indexOf('1899-12-31') !== -1)) {
        try {
          var dt = new Date(item.time);
          item.time = Utilities.formatDate(dt, 'Asia/Karachi', 'hh:mm:ss a');
        } catch (e) {
          item.time = '';
        }
      }
      if (item.date && typeof item.date === 'string' && item.date.indexOf('T') !== -1) {
        item.date = item.date.split('T')[0];
      }
    }
  }

  var jsonStr = JSON.stringify(incoming);
  // Break into chunks of 45000 characters if large
  var chunkSize = 45000;
  var chunks = [];
  for (var i = 0; i < jsonStr.length; i += chunkSize) {
    chunks.push([jsonStr.substring(i, i + chunkSize)]);
  }
  if (chunks.length > 0) {
    sheet.getRange(1, 1, chunks.length, 1).setValues(chunks);
  }
}

function readFullState(ss, fallback) {
  try {
    var sheet = ss.getSheetByName('_Sync_Data_Store');
    if (!sheet) return fallback;
    var lastRow = sheet.getLastRow();
    if (lastRow < 1) return fallback;
    var values = sheet.getRange(1, 1, lastRow, 1).getValues();
    var fullStr = '';
    for (var i = 0; i < values.length; i++) {
      fullStr += values[i][0];
    }
    return JSON.parse(fullStr);
  } catch (err) {
    return fallback;
  }
}

function getOrCreateSheet(ss, name, headers, headerColor) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    var hRange = sheet.getRange(1, 1, 1, headers.length);
    hRange.setValues([headers]);
    hRange.setFontWeight('bold').setBackground(headerColor || '#0D2B45').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Converts rich HTML formatting (e.g. from prescription editor) into clean plain text with bullets
 */
function stripHtmlToPlainText(html) {
  if (!html) return '';
  var text = String(html);
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

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
