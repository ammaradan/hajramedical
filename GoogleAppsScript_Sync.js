/**
 * ====================================================================
 * HAJRA MEDICAL COMPLEX, JARANWALA — DR. HAFIZ EHSAN QADEER
 * Google Apps Script Cloud Sync Backend
 * ====================================================================
 * 
 * HOW TO DEPLOY FOR ONLINE MULTI-DEVICE SYNCHRONIZATION:
 * 1. Open Google Sheets (create a new blank spreadsheet: "Hajra Medical Complex Records")
 * 2. In Google Sheets menu, click: Extensions -> Apps Script
 * 3. Delete any code in Code.gs, paste this entire file contents, and click Save (💾).
 * 4. Click: Deploy -> New deployment
 * 5. Select type: "Web app"
 * 6. Set Description: "Hajra Medical Complex Sync API"
 * 7. Set "Execute as": "Me"
 * 8. Set "Who has access": "Anyone"
 * 9. Click "Deploy", authorize permissions when prompted.
 * 10. Copy the "Web app URL" (starts with https://script.google.com/macros/s/...)
 * 11. Open your Hajra Medical Complex web app -> Click "⚙️ Settings" in header ->
 *     Paste the Web app URL in "Cloud Sync Web App URL" -> Click "Save Sync URL".
 * 12. That's it! Click "☁ Sync" anytime or let it auto-sync on save across all devices!
 */

var SCRIPT_PROP = PropertiesService.getScriptProperties();

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
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'syncFullDatabase') {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var incoming = payload.data || {};

      // 1. Save Patients
      if (incoming.patients && incoming.patients.length > 0) {
        syncSheetTable(ss, 'Patients', incoming.patients, ['mrNumber', 'name', 'phone', 'cnic', 'updatedAt']);
      }

      // 2. Save Visits
      if (incoming.visits && incoming.visits.length > 0) {
        syncSheetTable(ss, 'Visits', incoming.visits, [
          'serialNo', 'mrNumber', 'date', 'time', 'visitNo',
          'name', 'relation', 'parentage', 'age', 'gender', 'weight',
          'phone', 'cnic', 'address', 'temp', 'bp', 'rr', 'pulse',
          'allergy', 'symptoms', 'findings', 'diagnosis', 'treatment', 'revisit'
        ]);
      }

      // 3. Save Payments
      if (incoming.payments && incoming.payments.length > 0) {
        syncSheetTable(ss, 'Payments', incoming.payments, [
          'paymentId', 'receiptNo', 'mrNumber', 'patientName', 'date', 'time',
          'consultationFee', 'proceduresFee', 'otherFee', 'totalFee', 'discount',
          'netAmount', 'receivedAmount', 'changeDue', 'paymentMode', 'notes'
        ]);
      }

      // 4. Save Appointments
      if (incoming.appointments && incoming.appointments.length > 0) {
        syncSheetTable(ss, 'Appointments', incoming.appointments, [
          'apptId', 'tokenNo', 'date', 'time', 'mrNumber', 'name', 'phone', 'fee', 'status', 'notes'
        ]);
      }

      // 5. Save Clinical Templates
      if (incoming.templates && incoming.templates.length > 0) {
        syncSheetTable(ss, 'Templates', incoming.templates, ['id', 'name', 'cat', 'body']);
      }

      // Read back all merged data from sheets to ensure 2-way multi-device synchronization
      var allData = {
        patients: readSheetTable(ss, 'Patients'),
        visits: readSheetTable(ss, 'Visits'),
        payments: readSheetTable(ss, 'Payments'),
        appointments: readSheetTable(ss, 'Appointments'),
        templates: readSheetTable(ss, 'Templates')
      };

      return jsonResponse({
        success: true,
        message: 'All records synchronized successfully',
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

function syncSheetTable(ss, sheetName, items, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#E8F5EC');
  }

  // Clear existing data rows (keep header)
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }

  // Prepare 2D matrix
  var rows = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var row = [];
    for (var h = 0; h < headers.length; h++) {
      var val = item[headers[h]];
      row.push(val !== undefined && val !== null ? val : '');
    }
    rows.push(row);
  }

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function readSheetTable(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var headers = data[0];
  var result = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    for (var h = 0; h < headers.length; h++) {
      obj[headers[h]] = row[h];
    }
    result.push(obj);
  }
  return result;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
