/*************************************************************
 *  DDPL QUOTATION MAKER  —  Code.gs  (v32)
 *  Google Sheets / Apps Script backend  ·  Companion: Index.html
 *
 *  What changed in v32
 *   • Deterministic pagination. Every row height is computed by the
 *     same functions that budget the page, and forced onto the sheet
 *     (no autoResize guessing). What is budgeted is exactly what prints,
 *     so pages never spill and never leave large gaps.
 *   • Every PDF page is its own sheet. Continuation pages start with the
 *     table header at Row 1. Export uses "fit to page" as a safety net,
 *     so a page can never overflow onto a header-less page.
 *   • Column order fixed: A Sr · B Description · C SAC/HSN · D Qty ·
 *     E UOM · F Rate/Unit · G Total Amount · (Infosys) H PO Ref · I PO Date.
 *   • Totals always live in Column G. Row total = D*F, Basic = SUM of
 *     Column G across every page, Grand Total = Basic + Round off.
 *   • Excel export is one continuous sheet with live formulas.
 *   • getNextQuoteNumber() exposed for the "Duplicate for New Customer"
 *     feature. saveQuotation() only creates R1/R2 when the frontend is
 *     editing a loaded quote; a new quote whose number was taken in the
 *     meantime is re-numbered instead of silently becoming a revision.
 *   • Text that starts with = + - @ is escaped so it never turns into a
 *     broken formula (#ERROR!).
 *   • Stored payloads larger than one cell (50k chars) are split across
 *     cells and re-joined on load.
 *************************************************************/

/* ===========================================================
   1. CONFIGURATION
   =========================================================== */
var CONFIG = {

  company: {
    name:    'Decent Decor Private Limited',
    address: 'Plot No.- 21, Tejaswini Society, Lane No- 1, DP Road, Aundh, Pune - 411 007',
    email:   "E-Mail I'D- marketing@decentdecorindia.com",
    phone:   'Office Phone- 8956652623',
    gstNo:   '27AAECD7921Q1Z2',
    signOff: 'For Decent Decor Pvt. Ltd.'
  },

  // Google Drive file IDs (plain PNG / JPEG uploaded to Drive)
  logoFileId:  '1Lwhe1A7jpBP_bf2p6GO98Fpo1Yo89hnB',   // Logo (top-right)
  eSignFileId: '1M9ySnqOaghaD6XgyjMxFnD8JuBLIkPsr',   // Stamp + signature (bottom-right)

  // Max image box in pixels (aspect ratio is preserved)
  logoSize:  { width: 180, height: 78 },
  eSignSize: { width: 185, height: 118 },

  eSign: { name: 'Authorized Signatory' },

  quotePrefix: 'DDPL/Q/',
  quoteDigits: 3,
  gstNote: 'GST 18 % applicable',

  terms: [
    '1. Payment Terms: 40% advance along with PO, 50% during work progress, and 10% within 15 days of invoice submission or as mutually agreed.',
    '2. Quotation Validity: Valid for 2 months from the date of quotation.',
    '3. GST & Taxes: GST and other applicable taxes shall be charged extra, as applicable.',
    '4. Scope & Variation: Any work beyond the mentioned scope/BOQ or changes in specifications/quantities shall be treated as additional work and charged separately with mutual approval.',
    '5. Site Conditions: Rates are based on the site conditions and information available at the time of quotation. Any unforeseen conditions affecting cost or execution shall be mutually discussed and agreed.',
    '6. Client Approvals: Timely approval of drawings, samples, specifications, permits and other required documents shall be provided by the client to avoid delays.',
    '7. Jurisdiction: Any disputes shall be subject to the jurisdiction of Pune courts only.'
  ],

  customerCols: {
    key:     'Customer Dropdown',
    name:    'Customer Name',
    address: 'Address',
    attn:    'Kind Attn'
  },

  style: {
    font: 'Calibri',
    title: 16,
    h2: 10.5,
    body: 10,
    small: 8.5,
    tiny: 7.5,

    primaryColor:    '#3F6B60',
    headerTextColor: '#FFFFFF',
    subBannerBg:     '#F3F7F5',
    borderColor:     '#B0B8B5',
    textColor:       '#1F2937',
    mutedColor:      '#555555',

    //          A    B    C   D   E    F    G    H   I
    widthsStd: [55, 295, 60, 65, 50, 105, 110],
    widthsInf: [55, 252, 65, 60, 50, 80, 105, 90, 85]
  },

  // PDF page geometry (inches). "safety" keeps a small reserve on each page.
  pdf: {
    pageWIn: 8.27, pageHIn: 11.69,
    top: 0.50, bottom: 0.50, left: 0.35, right: 0.35,
    pxPerIn: 96,
    safety: 0.96
  },

  // Text-measurement constants used to size rows (Calibri at the sizes above).
  // Slightly generous so text is never clipped.
  metrics: {
    bodyCharPx:  5.7,   // 10 pt regular
    boldCharPx:  6.1,   // 10 pt bold
    smallCharPx: 4.9,   // 8.5 pt regular
    bodyLinePx:  16,
    smallLinePx: 13,
    minItemRow:  24,
    headerRow:   28
  },

  infosysTags: ['infosys'],

  pdfFolder:        'DDPL Quotations - PDF',
  excelFolder:      'DDPL Quotations - Excel',
  attachmentFolder: 'DDPL Quotation Attachments',

  sheets: {
    items:     'Item_Directory',
    customers: 'Customers',
    log:       'Quotation Log',
    data:      'Quotation_Data'
  }
};

function getStyle_() {
  var s = CONFIG.style || {};
  return {
    font:            s.font || 'Calibri',
    title:           Number(s.title || 16),
    h2:              Number(s.h2 || 10.5),
    body:            Number(s.body || 10),
    small:           Number(s.small || 8.5),
    tiny:            Number(s.tiny || 7.5),
    primaryColor:    s.primaryColor || '#3F6B60',
    headerTextColor: s.headerTextColor || '#FFFFFF',
    subBannerBg:     s.subBannerBg || '#F3F7F5',
    borderColor:     s.borderColor || '#B0B8B5',
    textColor:       s.textColor || '#1F2937',
    mutedColor:      s.mutedColor || '#555555',
    widthsStd:       s.widthsStd || [55, 295, 60, 65, 50, 105, 110],
    widthsInf:       s.widthsInf || [55, 252, 65, 60, 50, 80, 105, 90, 85]
  };
}

/* ===========================================================
   2. WEB APP ENTRY POINT
   =========================================================== */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('DDPL Quotation Maker')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ===========================================================
   3. BOOTSTRAP & MASTER DATA
   =========================================================== */
function getBootstrap() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hist = [];
  try { hist = listQuotations(); } catch (e) { Logger.log('getBootstrap hist error: ' + e.message); }
  return {
    company: CONFIG.company,
    gstNote: CONFIG.gstNote,
    terms: CONFIG.terms,
    infosysTags: CONFIG.infosysTags,
    items: readItems_(ss),
    customers: readCustomers_(ss),
    history: hist,
    nextQuote: nextQuoteNo_(ss),
    today: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy')
  };
}

/** Called by the frontend (google.script.run) for New / Duplicate. */
function getNextQuoteNumber() {
  return nextQuoteNo_(SpreadsheetApp.getActiveSpreadsheet());
}

function findSheet_(ss, targetName, keywords, excludes) {
  if (!ss) return null;
  var sh = ss.getSheetByName(targetName);
  if (sh) return sh;

  var all = ss.getSheets();
  var t = String(targetName || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  for (var i = 0; i < all.length; i++) {
    var sName = all[i].getName().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (sName === t) return all[i];
  }

  if (keywords && keywords.length) {
    for (var j = 0; j < all.length; j++) {
      var n = all[j].getName().toLowerCase();
      var isExcluded = false;
      if (excludes && excludes.length) {
        for (var ex = 0; ex < excludes.length; ex++) {
          if (n.indexOf(excludes[ex]) > -1) { isExcluded = true; break; }
        }
      }
      if (isExcluded) continue;
      for (var k = 0; k < keywords.length; k++) {
        if (n.indexOf(keywords[k]) > -1) return all[j];
      }
    }
  }
  return null;
}

function getOrInitLogSheet_(ss) {
  var sh = findSheet_(ss, CONFIG.sheets.log, ['quotation log', 'quote log', 'quotations', 'quotes', 'log'],
                      ['data', 'payload', 'item', 'customer']);
  if (!sh) {
    var logName = CONFIG.sheets.log || 'Quotation Log';
    try {
      sh = ss.insertSheet(logName);
      sh.appendRow([
        'Timestamp', 'Quote No', 'Revision', 'Layout', 'Format',
        'Customer Name', 'Address', 'Kind Attn', 'Subject',
        'Job Description', 'Basic', 'Round Off', 'Grand', 'Words',
        'PDF URL', 'Excel URL', 'Attachments', 'Status'
      ]);
      sh.getRange(1, 1, 1, 18).setFontWeight('bold').setBackground('#EBF4F1');
      sh.setFrozenRows(1);
    } catch (e) {
      sh = ss.getSheetByName(logName) || ss.getSheets()[0];
    }
  }
  return sh;
}

function readItems_(ss) {
  var sh = findSheet_(ss, CONFIG.sheets.items, ['item', 'rate', 'master', 'directory'],
                      ['data', 'payload', 'customer', 'quotation', 'log']);
  if (!sh || sh.getLastRow() < 2) return [];
  var lastCol = Math.max(1, sh.getLastColumn());
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, Math.min(lastCol, 8)).getDisplayValues(), out = [];
  for (var i = 0; i < v.length; i++) {
    var d = (v[i].length > 2) ? String(v[i][2]).trim() : '';
    if (!d) continue;
    out.push({
      company:     (v[i].length > 0) ? String(v[i][0]).trim() : '',
      category:    (v[i].length > 1) ? (String(v[i][1]).trim() || 'General') : 'General',
      description: d,
      sacHsn:      (v[i].length > 3) ? String(v[i][3]).trim() : '',
      uom:         (v[i].length > 4) ? String(v[i][4]).trim() : '',
      rate:        (v[i].length > 5) ? num_(v[i][5]) : 0,
      poRef:       (v[i].length > 6) ? String(v[i][6]).trim() : '',
      poDate:      (v[i].length > 7) ? String(v[i][7]).trim() : ''
    });
  }
  return out;
}

function readCustomers_(ss) {
  try {
    var sh = findSheet_(ss, CONFIG.sheets.customers, ['customer', 'client', 'party'],
                        ['data', 'payload', 'item', 'quotation', 'log']);
    if (!sh || sh.getLastRow() < 2) return [];

    var lastCol = Math.max(1, sh.getLastColumn());
    var hdr = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0];

    var iKey = -1, iName = -1, iAddr = -1, iAttn = -1;
    for (var c = 0; c < hdr.length; c++) {
      var h = String(hdr[c] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (iKey === -1 && (h === 'key' || h === 'code' || h === 'shortcut' || h === 'custkey' || h.indexOf('dropdown') > -1)) iKey = c;
      if (iName === -1 && (h === 'customername' || h === 'customer' || h === 'clientname' || h === 'client' ||
                           h === 'company' || h === 'companyname' || h === 'name' || h === 'customerdetails')) iName = c;
      if (iAddr === -1 && (h === 'address' || h === 'addr' || h === 'location' || h === 'billingaddress')) iAddr = c;
      if (iAttn === -1 && (h === 'kindattn' || h === 'attn' || h === 'contact' || h === 'contactperson' || h === 'attention')) iAttn = c;
    }

    if (iName === -1) {
      for (var c2 = 0; c2 < hdr.length; c2++) {
        var h2 = String(hdr[c2] || '').toLowerCase();
        if (h2.indexOf('sr') === -1 && h2.indexOf('no') === -1 && h2.indexOf('#') === -1) { iName = c2; break; }
      }
      if (iName === -1) iName = (hdr.length > 1 ? 1 : 0);
    }
    if (iKey === -1) iKey = iName;
    if (iAddr === -1 && hdr.length > 2) iAddr = 2;
    if (iAttn === -1 && hdr.length > 3) iAttn = 3;

    var v = sh.getRange(2, 1, sh.getLastRow() - 1, lastCol).getDisplayValues(), out = [], seen = {};
    for (var i = 0; i < v.length; i++) {
      var key  = (iKey >= 0 && iKey < v[i].length) ? String(v[i][iKey] || '').trim() : '';
      var name = (iName >= 0 && iName < v[i].length) ? String(v[i][iName] || '').trim() : '';
      if (!key && !name) continue;
      if (!key) key = name;
      if (!name) name = key;
      if (seen[key.toLowerCase()]) continue;
      seen[key.toLowerCase()] = 1;
      out.push({
        key: key,
        name: name,
        address: (iAddr >= 0 && iAddr < v[i].length) ? String(v[i][iAddr] || '').trim() : '',
        attn:    (iAttn >= 0 && iAttn < v[i].length) ? String(v[i][iAttn] || '').trim() : ''
      });
    }
    return out;
  } catch (err) {
    Logger.log('readCustomers_ error: ' + err.message);
    return [];
  }
}

function resolveCustomer_(ss, key) {
  var k = String(key || '').trim().toLowerCase();
  if (!k) return null;
  var all = readCustomers_(ss);
  for (var i = 0; i < all.length; i++) if (all[i].key.toLowerCase() === k) return all[i];
  for (var j = 0; j < all.length; j++) if (all[j].name.toLowerCase() === k) return all[j];
  for (var m = 0; m < all.length; m++) {
    if (all[m].name.toLowerCase().indexOf(k) > -1 || all[m].key.toLowerCase().indexOf(k) > -1) return all[m];
  }
  return null;
}

function lookupCustomer(key) {
  return resolveCustomer_(SpreadsheetApp.getActiveSpreadsheet(), key);
}

function fyCode_(d) {
  var y = d.getFullYear(), m = d.getMonth(), s = (m >= 3) ? y : y - 1;
  return pad2_(s % 100) + '-' + pad2_((s + 1) % 100);
}

function nextQuoteNo_(ss) {
  var fy = fyCode_(new Date());
  var sh = getOrInitLogSheet_(ss);
  var max = 0;
  if (sh && sh.getLastRow() > 1) {
    var lastCol = Math.max(1, sh.getLastColumn());
    var v = sh.getRange(2, 1, sh.getLastRow() - 1, lastCol).getDisplayValues();
    for (var i = 0; i < v.length; i++) {
      for (var c = 0; c < Math.min(v[i].length, 3); c++) {
        var s = String(v[i][c] || '').trim();
        if (s.indexOf(CONFIG.quotePrefix + fy + '/') === 0) {
          var n = parseInt(s.split('/').pop(), 10);
          if (!isNaN(n) && n > max) max = n;
        }
      }
    }
  }
  var next = String(max + 1);
  while (next.length < CONFIG.quoteDigits) next = '0' + next;
  return CONFIG.quotePrefix + fy + '/' + next;
}

/* ===========================================================
   4. REVISION ENGINE & SEARCH
   =========================================================== */
function listQuotations() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = getOrInitLogSheet_(ss);
    var out = [];
    if (sh && sh.getLastRow() >= 2) {
      var lastRow = sh.getLastRow();
      var lastCol = Math.max(1, sh.getLastColumn());
      var hdr = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0];

      var iQuote = -1, iRev = -1, iCust = -1, iSubj = -1, iGrand = -1, iPdf = -1, iXls = -1, iStat = -1, iDate = -1;
      for (var c = 0; c < hdr.length; c++) {
        var h = String(hdr[c] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (iQuote === -1 && (h.indexOf('quote') > -1 || h === 'number')) iQuote = c;
        if (iRev === -1 && (h === 'revision' || h === 'rev')) iRev = c;
        if (iCust === -1 && (h.indexOf('customer') > -1 || h.indexOf('client') > -1)) iCust = c;
        if (iSubj === -1 && (h.indexOf('subject') > -1 || h.indexOf('project') > -1)) iSubj = c;
        if (iGrand === -1 && (h.indexOf('grand') > -1 || h.indexOf('total') > -1 || h === 'amount')) iGrand = c;
        if (iPdf === -1 && h.indexOf('pdf') > -1) iPdf = c;
        if (iXls === -1 && (h.indexOf('excel') > -1 || h.indexOf('xlsx') > -1)) iXls = c;
        if (iStat === -1 && h.indexOf('status') > -1) iStat = c;
        if (iDate === -1 && (h.indexOf('date') > -1 || h.indexOf('time') > -1)) iDate = c;
      }
      if (iDate === -1) iDate = 0;
      if (iQuote === -1) iQuote = 1;
      if (iRev === -1) iRev = 2;
      if (iCust === -1) iCust = 5;
      if (iSubj === -1) iSubj = 8;
      if (iGrand === -1) iGrand = 12;
      if (iPdf === -1) iPdf = 14;
      if (iXls === -1) iXls = 15;
      if (iStat === -1) iStat = 17;

      var v = sh.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
      for (var i = 0; i < v.length; i++) {
        var row = v[i];
        var qNo = (iQuote < row.length) ? String(row[iQuote] || '').trim() : '';
        if (!qNo && row.length > 0 && String(row[0] || '').indexOf('DDPL') > -1) qNo = String(row[0] || '').trim();
        if (!qNo) continue;
        out.push({
          timestamp:    (iDate < row.length ? row[iDate] : ''),
          quoteNo:      qNo,
          revision:     (iRev < row.length && row[iRev] ? String(row[iRev]).trim() : 'Main'),
          layout:       (row.length > 3 ? row[3] : 'INFOSYS'),
          format:       (row.length > 4 ? row[4] : 'A'),
          customerName: (iCust < row.length ? row[iCust] : ''),
          subject:      (iSubj < row.length ? row[iSubj] : ''),
          grand:        (iGrand < row.length ? row[iGrand] : ''),
          pdfUrl:       (iPdf < row.length ? row[iPdf] : ''),
          excelUrl:     (iXls < row.length ? row[iXls] : ''),
          status:       (iStat < row.length ? row[iStat] : 'Draft')
        });
      }
    }

    if (!out.length) {
      var dsh = findSheet_(ss, CONFIG.sheets.data, ['payload', '_quotation']);
      if (dsh && dsh.getLastRow() >= 2) {
        var pv = dsh.getRange(2, 1, dsh.getLastRow() - 1, Math.max(3, dsh.getLastColumn())).getValues();
        for (var j = 0; j < pv.length; j++) {
          if (!pv[j][0]) continue;
          try {
            var pl = JSON.parse(joinPayload_(pv[j]));
            out.push({
              timestamp: pl.date || '',
              quoteNo: pl.quoteNo || String(pv[j][0]),
              revision: pl.revision || String(pv[j][1] || 'Main'),
              layout: pl.layout || 'INFOSYS',
              format: pl.format || 'A',
              customerName: pl.customerName || '',
              subject: pl.subject || '',
              grand: pl.grand || '',
              pdfUrl: pl.pdfUrl || '',
              excelUrl: pl.excelUrl || '',
              status: pl.status || 'Draft'
            });
          } catch (e) {}
        }
      }
    }
    return out.reverse();
  } catch (err) {
    Logger.log('listQuotations error: ' + err.message);
    return [];
  }
}

function searchQuotations(q) {
  try {
    q = String(q || '').toLowerCase().trim();
    var all = listQuotations();
    if (!q) return all.slice(0, 50);
    return all.filter(function (r) {
      return (r.quoteNo + ' ' + r.customerName + ' ' + r.subject + ' ' + r.revision).toLowerCase().indexOf(q) > -1;
    }).slice(0, 50);
  } catch (err) {
    Logger.log('searchQuotations error: ' + err.message);
    return [];
  }
}

function loadQuotation(quoteNo, revision) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dsh = findSheet_(ss, CONFIG.sheets.data, ['payload', '_quotation']);
  if (dsh && dsh.getLastRow() > 1) {
    var v = dsh.getRange(2, 1, dsh.getLastRow() - 1, Math.max(3, dsh.getLastColumn())).getValues();
    for (var i = v.length - 1; i >= 0; i--) {
      if (String(v[i][0]).trim() === String(quoteNo).trim() &&
          (!revision || String(v[i][1]).trim() === String(revision).trim())) {
        var p = JSON.parse(joinPayload_(v[i]));
        p.loadedFrom = { quoteNo: quoteNo, revision: revision || String(v[i][1]) };
        p.nextRevision = nextRevision_(ss, quoteNo);
        return p;
      }
    }
  }
  throw new Error('No stored data found for ' + quoteNo + (revision ? ' ' + revision : '') + '.');
}

/** How many times this quote number already appears in the log. */
function countQuoteUses_(ss, quoteNo) {
  var sh = getOrInitLogSheet_(ss), used = 0, q = String(quoteNo || '').trim();
  if (!q || !sh || sh.getLastRow() < 2) return 0;
  var lastCol = Math.max(1, sh.getLastColumn());
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, lastCol).getDisplayValues();
  for (var i = 0; i < v.length; i++) {
    for (var c = 0; c < Math.min(v[i].length, 3); c++) {
      if (String(v[i][c]).trim() === q) { used++; break; }
    }
  }
  return used;
}

function nextRevision_(ss, quoteNo) {
  var used = countQuoteUses_(ss, quoteNo);
  return used === 0 ? 'Main' : 'R' + used;
}

function dataSheet_(ss) {
  var sh = findSheet_(ss, CONFIG.sheets.data, ['payload', '_quotation']);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.sheets.data);
    sh.getRange(1, 1, 1, 3).setValues([['Quote No', 'Revision', 'Payload (do not edit)']]).setFontWeight('bold');
    sh.hideSheet();
  }
  return sh;
}

/** Joins payload cells (col C onwards) back into one JSON string. */
function joinPayload_(row) {
  var s = '';
  for (var c = 2; c < row.length; c++) s += (row[c] === null || row[c] === undefined) ? '' : String(row[c]);
  return s;
}

/**
 * Splits JSON into cell-sized chunks. A chunk never starts with a character
 * that Sheets could read as a formula/number sign or trim away.
 */
function payloadChunks_(json) {
  var MAX = 45000, out = [], i = 0;
  while (i < json.length) {
    var end = Math.min(json.length, i + MAX);
    while (end < json.length && end > i + 1 && /[=+\-@\s]/.test(json.charAt(end))) end--;
    out.push(json.substring(i, end));
    i = end;
  }
  return out;
}

function writePayload_(ss, d) {
  var sh = dataSheet_(ss);
  var chunks = payloadChunks_(JSON.stringify(d));
  var row = [String(d.quoteNo), String(d.revision)].concat(chunks);
  var r = sh.getLastRow() + 1;
  var rg = sh.getRange(r, 1, 1, row.length);
  rg.setNumberFormat('@');
  rg.setValues([row]);
}

/* ===========================================================
   5. SAVE & PREVIEW
   =========================================================== */
function saveQuotation(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), lock = LockService.getScriptLock();
  lock.waitLock(90000);
  try {
    // #region agent log
    DBG_ = {};
    var _tSave = Date.now();
    var _rawLines = (data && data.lines) ? data.lines : [];
    DBG_.linesReceived = _rawLines.length;
    DBG_.rawLineSample = _rawLines.map(function (l, i) {
      return { i: i, descLen: String((l && l.description) || '').length, hsn: l && l.sacHsn, qty: l && l.quantity, uom: l && l.uom, rate: l && l.rate };
    });
    // #endregion
    var loadedFrom = (data && data.loadedFrom) ? data.loadedFrom : null;
    var d = normalise_(data, ss);
    // #region agent log
    DBG_.linesAfterNormalise = d.lines.length;
    DBG_.normalisedSample = d.lines.map(function (l, i) { return { i: i, hsn: l.sacHsn, qty: l.quantity, uom: l.uom, rate: l.rate, amount: l.amount }; });
    // #endregion
    var requested = d.quoteNo;
    var renumbered = false;

    if (!d.quoteNo) d.quoteNo = nextQuoteNo_(ss);

    // R1/R2… only when the user is editing a quotation they loaded.
    var isEditOfLoaded = !!(loadedFrom && String(loadedFrom.quoteNo || '').trim() === d.quoteNo);
    var used = countQuoteUses_(ss, d.quoteNo);
    if (used > 0 && !isEditOfLoaded) {
      // New / duplicated quote whose number is already taken → give it a fresh number.
      d.quoteNo = nextQuoteNo_(ss);
      used = 0;
      renumbered = !!requested;
    }
    d.revision = (used === 0) ? 'Main' : 'R' + used;

    var files = buildDocuments_(d, true, true);

    var sh = getOrInitLogSheet_(ss);
    sh.appendRow([
      new Date(), d.quoteNo, d.revision, d.layout, d.format,
      safeText_(d.customerName), safeText_(d.customerAddress), safeText_(d.kindAttn), safeText_(d.subject),
      (d.format === 'B' ? safeText_(d.jobDescription) : ''),
      d.basic, d.roundOff, d.grand, d.words, files.pdfUrl, files.excelUrl,
      safeText_((d.attachments || []).map(function (a) { return a.name + ' :: ' + a.url; }).join('\n')),
      d.status || 'Draft'
    ]);

    // #region agent log
    var _tPayload = Date.now();
    // #endregion
    writePayload_(ss, d);
    // #region agent log
    DBG_.writePayloadMs = Date.now() - _tPayload;
    DBG_.payloadChars = JSON.stringify(d).length;
    DBG_.backendTotalMs = Date.now() - _tSave;
    Logger.log('SAVE ' + JSON.stringify(DBG_));
    // #endregion

    return {
      debug: DBG_,
      ok: true, quoteNo: d.quoteNo, revision: d.revision,
      renumbered: renumbered, requestedQuoteNo: requested,
      pdfUrl: files.pdfUrl, excelUrl: files.excelUrl,
      basic: d.basic, grand: d.grand, words: d.words,
      nextRevision: nextRevision_(ss, d.quoteNo), nextQuote: nextQuoteNo_(ss),
      history: listQuotations()
    };
  } finally { lock.releaseLock(); }
}

function buildPreviewPdf(data)   { return buildDocuments_(normalise_(data), true,  false).pdfUrl; }
function buildPreviewExcel(data) { return buildDocuments_(normalise_(data), false, true ).excelUrl; }

function normalise_(d, ss) {
  d = d || {};
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();

  d.quoteNo = String(d.quoteNo || '').trim();
  d.revision = String(d.revision || 'Main').trim() || 'Main';
  d.customerKey = String(d.customerKey || '').trim();
  var lookupKey = d.customerKey || String(d.customerName || '').trim();
  if (lookupKey) {
    var cust = resolveCustomer_(ss, lookupKey);
    if (cust) {
      if (!String(d.customerName || '').trim())    d.customerName = cust.name;
      if (!String(d.customerAddress || '').trim()) d.customerAddress = cust.address;
      if (!String(d.kindAttn || '').trim())        d.kindAttn = cust.attn || '';
    }
  }
  d.customerName = String(d.customerName || '').trim();
  d.customerAddress = String(d.customerAddress || '').trim();
  d.kindAttn = String(d.kindAttn || '').trim();
  d.subject = String(d.subject || '').trim();

  d.layout = (String(d.layout).toUpperCase() === 'INFOSYS') ? 'INFOSYS' : 'STANDARD';
  d.format = (d.format === 'B') ? 'B' : 'A';
  d.lines = (d.lines || []).filter(function (l) { return l && String(l.description || '').trim(); });

  var basic = 0;
  d.lines.forEach(function (l) {
    l.description = String(l.description || '').trim();
    l.sacHsn = String(l.sacHsn || '').trim();
    l.uom = String(l.uom || '').trim();
    l.quantity = num_(l.quantity);
    l.rate = num_(l.rate);
    l.amount = Math.round(l.quantity * l.rate * 100) / 100;
    if (d.layout !== 'INFOSYS') { l.poRef = ''; l.poDate = ''; }
    else { l.poRef = String(l.poRef || '').trim(); l.poDate = String(l.poDate || '').trim(); }
    basic += l.amount;
  });
  d.basic = Math.round(basic * 100) / 100;
  d.roundOff = num_(d.roundOff);
  d.grand = Math.round((d.basic + d.roundOff) * 100) / 100;
  d.words = rupeesInWords_(d.grand);
  if (d.format === 'B' && !String(d.jobDescription || '').trim()) {
    d.jobDescription = 'BOQ for ' + (d.subject || 'the work as per attached details');
  }
  d.jobSacHsn = String(d.jobSacHsn || '9954');

  // Front-end-only state must never be stored in the payload
  delete d.loadedFrom;
  delete d.nextRevision;
  return d;
}

/* ===========================================================
   6. LAYOUT MEASUREMENT (single source of truth for row heights)
   =========================================================== */
function layoutCtx_(d) {
  var S = getStyle_(), P = CONFIG.pdf, M = CONFIG.metrics;
  var INF = (d.layout === 'INFOSYS');
  var W = INF ? 9 : 7;
  var widths = (INF ? S.widthsInf : S.widthsStd).slice(0, W);
  var totalW = 0;
  for (var i = 0; i < widths.length; i++) totalW += widths[i];

  var usableW = (P.pageWIn - P.left - P.right) * P.pxPerIn;
  var usableH = (P.pageHIn - P.top - P.bottom) * P.pxPerIn;
  var scale = usableW / totalW;                 // how the sheet is scaled onto A4 width
  var pageH = (usableH / scale) * P.safety;     // page height in sheet pixels

  var head = ['Sr.', 'Description of Work / Goods', INF ? 'HSN/SAC' : 'SAC No.', 'Qty', 'UOM', 'Rate/Unit', 'Total Amount'];
  if (INF) head.push('PO Ref. No.', 'PO Date');

  return {
    S: S, INF: INF, W: W, widths: widths, totalW: totalW,
    pageH: pageH, headerH: headerRowHeight_(head, widths), head: head,
    leftEnd: INF ? 6 : 5,       // letterhead left block / terms box end column
    wordsEnd: 4                 // "Amount in words" spans A:D, labels E:F, value G
  };
}

/** Header height that fits every label. Column A (Sr. No.) never wraps, so it is excluded. */
function headerRowHeight_(head, widths) {
  var M = CONFIG.metrics, lines = 1;
  for (var i = 1; i < head.length; i++) {
    lines = Math.max(lines, wrapLines_(head[i], widths[i] || 60, M.boldCharPx));
  }
  return Math.max(M.headerRow, lines * M.bodyLinePx + 10);
}

function spanW_(ctx, fromCol, toCol) {
  var w = 0;
  for (var c = fromCol; c <= toCol; c++) w += ctx.widths[c - 1] || 0;
  return w;
}

function sum_(arr) { var s = 0; for (var i = 0; i < arr.length; i++) s += arr[i]; return s; }

/** Word-wrap line count for text in a box of widthPx at charPx per character. */
function wrapLines_(text, widthPx, charPx) {
  var cpl = Math.max(8, Math.floor((widthPx - 10) / charPx));
  var total = 0;
  String(text == null ? '' : text).split(/\r?\n/).forEach(function (p) {
    var words = p.split(/\s+/).filter(function (w) { return w.length; });
    if (!words.length) { total += 1; return; }
    var n = 1, cur = 0;
    words.forEach(function (w) {
      var len = w.length;
      var need = cur === 0 ? len : cur + 1 + len;
      if (need <= cpl) { cur = need; return; }
      if (cur > 0) n++;
      while (len > cpl) { len -= cpl; n++; }
      cur = len;
    });
    total += n;
  });
  return Math.max(1, total);
}

function itemRowHeight_(line, ctx) {
  var M = CONFIG.metrics;
  var lines = wrapLines_(line.description, ctx.widths[1], M.bodyCharPx);
  return Math.max(M.minItemRow, lines * M.bodyLinePx + 8);
}

function termsOf_(d) {
  return (d.terms && d.terms.length) ? d.terms : CONFIG.terms;
}

/** Heights of letterhead rows 1–14 (row 15 is the table header). */
function letterheadRowHeights_(d, ctx) {
  var M = CONFIG.metrics;
  var leftW = spanW_(ctx, 1, ctx.leftEnd);
  var nameLines = wrapLines_(d.customerName, leftW, M.boldCharPx);
  var addrLines = wrapLines_(d.customerAddress, leftW, M.bodyCharPx);
  var subjLines = wrapLines_('SUB :- ' + (d.subject || ''), ctx.totalW, M.boldCharPx);

  var r9 = Math.max(20, nameLines * M.bodyLinePx + 6);
  var r10 = 20;
  var addrTotal = Math.max(40, addrLines * M.bodyLinePx + 8);   // rows 10+11 together
  var r11 = Math.max(20, addrTotal - r10);
  var r13 = Math.max(26, subjLines * M.bodyLinePx + 10);

  //      1   2   3   4   5  6  7   8   9   10   11  12   13  14
  return [30, 18, 18, 18, 18, 8, 8, 20, r9, r10, r11, 8, r13, 6];
}

/** Heights of every footer row, in order (GST, totals x3, gap, T&C title, terms…, signatory). */
function footerRowHeights_(d, ctx) {
  var M = CONFIG.metrics;
  var terms = termsOf_(d);
  var termsW = spanW_(ctx, 1, ctx.leftEnd);
  var th = terms.map(function (t) {
    return Math.max(18, wrapLines_(t, termsW, M.smallCharPx) * M.smallLinePx + 7);
  });

  // Signature image must fit inside the rows between "For DDPL" and "Authorized Signatory"
  var sigNeed = ((CONFIG.eSignSize && CONFIG.eSignSize.height) || 118) + 12;
  var sumT = sum_(th);
  if (sumT < sigNeed && th.length) {
    var extra = Math.ceil((sigNeed - sumT) / th.length);
    th = th.map(function (h) { return h + extra; });
  }

  // "Amount In Words" occupies the three totals rows
  var wordsLines = 1 + wrapLines_(d.words || '', spanW_(ctx, 1, ctx.wordsEnd), M.boldCharPx);
  var tot = [24, 24, 26];
  var wordsNeed = wordsLines * M.bodyLinePx + 10;
  if (wordsNeed > sum_(tot)) {
    var add = Math.ceil((wordsNeed - sum_(tot)) / 3);
    tot = tot.map(function (h) { return h + add; });
  }

  return [22].concat(tot).concat([8, 22]).concat(th).concat([24]);
}

function jobLine_(d) {
  return {
    description: d.jobDescription, sacHsn: d.jobSacHsn, quantity: 1, uom: 'Job',
    rate: d.basic, poRef: '', poDate: ''
  };
}

/**
 * Splits line items into pages. Returns an array of pages, each an array
 * of line objects. Page 1 carries the letterhead; the last page carries
 * the footer; every page after the first starts with the header row.
 */
function planPages_(d, ctx) {
  if (d.format === 'B') return [[jobLine_(d)]];
  var lines = d.lines || [];
  if (!lines.length) return [[]];

  var P = ctx.pageH;
  var LH = sum_(letterheadRowHeights_(d, ctx)) + ctx.headerH;
  var FH = sum_(footerRowHeights_(d, ctx));
  var H = lines.map(function (l) { return itemRowHeight_(l, ctx); });

  if (LH + sum_(H) + FH <= P) return [lines.slice()];

  var pages = [], cur = [], used = LH;
  for (var i = 0; i < lines.length; i++) {
    if (cur.length && used + H[i] > P) {
      pages.push(cur);
      cur = [];
      used = ctx.headerH;
    }
    cur.push(i);
    used += H[i];
  }

  // The footer must sit on the last page. If it doesn't fit, carry the last
  // 1–2 items to a new final page so the footer never appears alone.
  if (used + FH > P && cur.length > 1) {
    var moved = [], mUsed = ctx.headerH + FH;
    do {
      var k = cur.pop();
      moved.unshift(k);
      mUsed += H[k];
    } while (cur.length > 1 && moved.length < 2 && mUsed + H[cur[cur.length - 1]] <= P);
    pages.push(cur);
    cur = moved;
  }
  pages.push(cur);

  return pages.map(function (pg) { return pg.map(function (idx) { return lines[idx]; }); });
}

/* ===========================================================
   7. DOCUMENT GENERATION
   =========================================================== */
// #region agent log
var DBG_ = {};
function dbgT_(key, fn) {
  var s = Date.now();
  try { return fn(); } finally { DBG_[key] = (DBG_[key] || 0) + (Date.now() - s); }
}
// #endregion

// #region agent log
/**
 * Run this from the Apps Script editor (select debugBenchmark -> Run), then open
 * "Execution log" and copy everything. Builds a sample quotation, times every step,
 * and trashes the files it created. Does NOT write to the Quotation Log sheet.
 */
function debugBenchmark() {
  var mkLines = function (n) {
    var out = [];
    for (var i = 1; i <= n; i++) out.push({ description: 'Benchmark item ' + i + ' - supply and install of sample material as per specification', sacHsn: '9954', quantity: i, uom: 'Nos', rate: 1000 + i, poRef: '', poDate: '' });
    return out;
  };
  var scenarios = [
    { name: 'A: 5 items, PDF only',        n: 5,  pdf: true, xls: false },
    { name: 'B: 5 items, PDF + Excel',     n: 5,  pdf: true, xls: true  },
    { name: 'C: 40 items, PDF only',       n: 40, pdf: true, xls: false }
  ];
  scenarios.forEach(function (sc) {
    DBG_ = {};
    var t0 = Date.now();
    var d = normalise_({
      quoteNo: 'BENCH/000', date: '01.01.2026', layout: 'STANDARD', format: 'A',
      customerName: 'Benchmark Customer', customerAddress: 'Sample address', kindAttn: '',
      subject: 'Benchmark', lines: mkLines(sc.n), roundOff: 0, status: 'Draft'
    });
    var files = buildDocuments_(d, sc.pdf, sc.xls);
    DBG_.totalMs = Date.now() - t0;
    Logger.log('BENCH ' + sc.name + ' => ' + JSON.stringify(DBG_));
    [files.pdfUrl, files.excelUrl].forEach(function (u) {
      var m = String(u || '').match(/[-\w]{25,}/);
      if (m) { try { DriveApp.getFileById(m[0]).setTrashed(true); } catch (e) {} }
    });
  });
}
// #endregion

function buildDocuments_(d, wantPdf, wantExcel) {
  var out = { pdfUrl: '', excelUrl: '' };
  var ctx = layoutCtx_(d);
  var pages = planPages_(d, ctx);
  // #region agent log
  try {
    var _lh = sum_(letterheadRowHeights_(d, ctx)) + ctx.headerH, _fh = sum_(footerRowHeights_(d, ctx));
    var _perPage = pages.map(function (pg, idx) {
      var h = (idx === 0 ? _lh : ctx.headerH);
      pg.forEach(function (l) { h += itemRowHeight_(l, ctx); });
      return { items: pg.length, usedBeforeFooter: Math.round(h), isLast: idx === pages.length - 1 };
    });
    DBG_.layout = { pages: pages.length, pageH: Math.round(ctx.pageH), letterheadPlusHeader: Math.round(_lh), footerH: Math.round(_fh),
                    format: d.format, layout: d.layout, perPage: _perPage, wantPdf: wantPdf, wantExcel: wantExcel };
  } catch (e) { DBG_.layoutErr = String(e.message); }
  // #endregion

  if (pages.length === 1) {
    withTemp_(d, function (tmp) {
      paintDocument_(tmp, d, ctx, pages);
      if (wantPdf)   out.pdfUrl = exportPdf_(tmp, d);
      if (wantExcel) out.excelUrl = exportXlsx_(tmp, d);
    });
  } else {
    // PDF: one sheet per page (header repeats on each). Excel: one continuous sheet.
    if (wantPdf) {
      withTemp_(d, function (tmp) {
        paintDocument_(tmp, d, ctx, pages);
        out.pdfUrl = exportPdf_(tmp, d);
      });
    }
    if (wantExcel) {
      withTemp_(d, function (tmp) {
        paintDocument_(tmp, d, ctx, [d.lines.slice()]);
        out.excelUrl = exportXlsx_(tmp, d);
      });
    }
  }
  return out;
}

function withTemp_(d, fn) {
  var tmp = dbgT_('createTmpSheet', function () { return SpreadsheetApp.create('tmp-' + fileName_(d)); });
  try {
    fn(tmp);
  } finally {
    try { DriveApp.getFileById(tmp.getId()).setTrashed(true); } catch (e) {}
  }
}

function paintDocument_(tmp, d, ctx, pages) {
  var sheets = [];
  var first = tmp.getSheets()[0];
  first.setName('Quotation');
  sheets.push(first);
  for (var p = 1; p < pages.length; p++) {
    sheets.push(tmp.insertSheet('Quotation - Page ' + (p + 1), p));
  }

  var ranges = [], sr = 1;
  dbgT_('paintPages', function () {
    for (var q = 0; q < pages.length; q++) {
      paintPage_(sheets[q], d, ctx, pages[q], sr, q === 0, q === pages.length - 1, ranges);
      sr += pages[q].length;
    }
  });

  if (d.format === 'B') dbgT_('paintBoq', function () { paintBoq_(tmp.insertSheet('BOQ', pages.length), d); });

  dbgT_('flush', function () { SpreadsheetApp.flush(); });
  dbgT_('sleep800', function () { Utilities.sleep(800); });
}

function exportPdf_(tmp, d) {
  var P = CONFIG.pdf;
  // Format A: fit-to-page (each sheet = exactly one page, never spills).
  // Format B: fit-to-width + repeat frozen rows, so a long BOQ flows over pages with its header.
  var isB = (d.format === 'B');
  var params = [
    'format=pdf', 'size=A4', 'portrait=true',
    'scale=' + (isB ? 2 : 4),
    'fzr=' + (isB ? 'true' : 'false'),
    'gridlines=false', 'printtitle=false', 'sheetnames=false', 'pagenum=false',
    'attachment=false', 'horizontal_alignment=CENTER', 'vertical_alignment=TOP',
    'top_margin=' + P.top.toFixed(2), 'bottom_margin=' + P.bottom.toFixed(2),
    'left_margin=' + P.left.toFixed(2), 'right_margin=' + P.right.toFixed(2)
  ].join('&');
  var blob = dbgT_('exportPdfFetch', function () { return fetchExport_(tmp.getId(), params).setName(fileName_(d) + '.pdf'); });
  return dbgT_('pdfDriveSave', function () { return folder_(CONFIG.pdfFolder).createFile(blob).getUrl(); });
}

function exportXlsx_(tmp, d) {
  var blob = dbgT_('exportXlsxFetch', function () { return fetchExport_(tmp.getId(), 'format=xlsx').setName(fileName_(d) + '.xlsx'); });
  return dbgT_('xlsxDriveSave', function () { return folder_(CONFIG.excelFolder).createFile(blob).getUrl(); });
}

function fetchExport_(id, params) {
  var url = 'https://docs.google.com/spreadsheets/d/' + id + '/export?' + params;
  var code = 0;
  for (var attempt = 0; attempt < 4; attempt++) {
    var res = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });
    code = res.getResponseCode();
    if (code === 200) return res.getBlob();
    Utilities.sleep(1500 * (attempt + 1));
  }
  throw new Error('Export from Google Sheets failed (HTTP ' + code + '). Please try again.');
}

function fileName_(d) {
  var safe = function (s) { return String(s || '').replace(/[\\\/:*?"<>|]/g, '-').trim(); };
  return safe(d.customerName) + ' - ' + safe(d.quoteNo).replace(/\//g, '-') +
         (d.revision && d.revision !== 'Main' ? ' - ' + d.revision : '') + ' - ' + safe(d.date);
}

/* ---------- small sheet helpers ---------- */
function setH_(sh, row, h) {
  h = Math.max(2, Math.round(h));
  try { sh.setRowHeightsForced(row, 1, h); } catch (e) { sh.setRowHeight(row, h); }
}

/** Merge (if more than one cell) and set the value in the top-left cell. Returns that cell. */
function mset_(sh, row, col, nRows, nCols, val) {
  if (nRows > 1 || nCols > 1) sh.getRange(row, col, nRows, nCols).merge();
  var c = sh.getRange(row, col);
  c.setValue(val);
  return c;
}

/** Prevents text starting with = + - @ from being parsed as a formula. */
function safeText_(v) {
  var s = String(v == null ? '' : v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function prepSheet_(sh, ctx) {
  sh.setHiddenGridlines(true);
  ctx.widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
}

function trimSheet_(sh, lastRow, W) {
  if (sh.getMaxRows() > lastRow) sh.deleteRows(lastRow + 1, sh.getMaxRows() - lastRow);
  if (sh.getMaxColumns() > W) sh.deleteColumns(W + 1, sh.getMaxColumns() - W);
  sh.setFrozenRows(0);
}

var OK_IMAGE_TYPES_ = ['image/png', 'image/jpeg', 'image/gif', 'image/bmp'];

function img_(fileId) {
  return dbgT_('imageFetch', function () { return imgRaw_(fileId); });
}

function imgRaw_(fileId) {
  if (!fileId) return null;
  try {
    var file = DriveApp.getFileById(fileId);
    var blob = file.getBlob();
    var type = (blob.getContentType() || '').toLowerCase();
    if (type === 'application/octet-stream' || !type) {
      var name = (file.getName() || '').toLowerCase();
      if (name.indexOf('.png') > -1) { blob.setContentType('image/png'); type = 'image/png'; }
      else if (name.indexOf('.jpg') > -1 || name.indexOf('.jpeg') > -1) { blob.setContentType('image/jpeg'); type = 'image/jpeg'; }
    }
    if (OK_IMAGE_TYPES_.indexOf(type) === -1) {
      Logger.log('img_: skipped ' + fileId + ' — unsupported type "' + type + '". Use a plain PNG or JPEG.');
      return null;
    }
    return blob;
  } catch (e) {
    Logger.log('img_: could not read file ' + fileId + ' — ' + e.message);
    return null;
  }
}

/** Inserts an image scaled into maxW×maxH, then positions it inside an areaW×areaH box. */
function placeImage_(sh, blob, col, row, areaW, areaH, maxW, maxH, align) {
  if (!blob) return null;
  try {
    var img = sh.insertImage(blob, col, row, 0, 0);
    var w = img.getWidth(), h = img.getHeight();
    if (w > 0 && h > 0) {
      var k = Math.min(maxW / w, maxH / h);
      w = Math.round(w * k); h = Math.round(h * k);
      img.setWidth(w).setHeight(h);
    }
    var x = (align === 'right') ? (areaW - w - 6) : Math.round((areaW - w) / 2);
    var y = Math.round((areaH - h) / 2);
    img.setAnchorCellXOffset(Math.max(0, x)).setAnchorCellYOffset(Math.max(0, y));
    return img;
  } catch (e) {
    Logger.log('placeImage_: ' + e.message);
    return null;
  }
}

/* ---------- page painter ---------- */
function paintPage_(sh, d, ctx, lines, startSr, isFirst, isLast, ranges) {
  var W = ctx.W, S = ctx.S;
  prepSheet_(sh, ctx);

  var row = 1;
  if (isFirst) row = paintLetterhead_(sh, d, ctx);     // returns 15
  paintTableHeader_(sh, row, ctx);                     // Row 1 on continuation pages
  row++;

  var firstItem = row;
  row = paintItemRows_(sh, row, lines, startSr, ctx);
  if (lines.length) ranges.push({ sheet: sh.getName(), first: firstItem, last: row - 1 });

  if (d.format === 'B') row = paintBoqNoteRow_(sh, row, ctx);
  if (isLast) row = paintFooter_(sh, row, d, ctx, ranges);

  var lastRow = row - 1;
  trimSheet_(sh, lastRow, W);
  sh.getRange(1, 1, lastRow, W).setFontFamily(S.font);
}

function paintLetterhead_(sh, d, ctx) {
  var S = ctx.S, C = CONFIG.company, W = ctx.W;
  var H = letterheadRowHeights_(d, ctx);
  for (var i = 0; i < H.length; i++) setH_(sh, i + 1, H[i]);

  var L = ctx.leftEnd;        // A:E (Standard) or A:F (Infosys)
  var R = L + 1;              // right block F:G or G:I
  var RN = W - L;

  sh.getRange(1, 1, 14, W).setFontFamily(S.font).setFontSize(S.body).setFontColor(S.textColor).setVerticalAlignment('middle');

  // Rows 1–5: company block
  mset_(sh, 1, 1, 1, L, C.name).setFontSize(S.title).setFontWeight('bold').setFontColor(S.primaryColor);
  [C.address, C.email, C.phone, 'GST No. - ' + C.gstNo].forEach(function (t, k) {
    mset_(sh, 2 + k, 1, 1, L, safeText_(t));
  });

  // Logo, right-aligned in the right block over rows 1–5
  var logoW = (CONFIG.logoSize && CONFIG.logoSize.width) || 180;
  var logoH = (CONFIG.logoSize && CONFIG.logoSize.height) || 78;
  placeImage_(sh, img_(CONFIG.logoFileId), R, 1, spanW_(ctx, R, W), sum_(H.slice(0, 5)), logoW, logoH, 'right');

  // Row 6: divider
  sh.getRange(6, 1, 1, W).setBorder(null, null, true, null, null, null, S.primaryColor, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // Rows 8–11: customer (left) and quotation details (right)
  mset_(sh, 8, 1, 1, L, 'To,');
  mset_(sh, 8, R, 1, RN, 'Quotation Date: ' + (d.date || ''));

  mset_(sh, 9, 1, 1, L, safeText_(d.customerName)).setFontWeight('bold').setWrap(true);
  mset_(sh, 9, R, 1, RN, 'Quotation No: ' + (d.quoteNo || '') +
        (d.revision && d.revision !== 'Main' ? ' (' + d.revision + ')' : ''));

  mset_(sh, 10, 1, 2, L, safeText_(d.customerAddress)).setWrap(true).setVerticalAlignment('top');
  mset_(sh, 10, R, 1, RN, 'Kind Atten: ' + (d.kindAttn || '')).setWrap(true);
  sh.getRange(11, R, 1, RN).merge();

  // Row 13: subject banner
  mset_(sh, 13, 1, 1, W, 'SUB :- ' + (d.subject || '')).setFontWeight('bold').setWrap(true);
  sh.getRange(13, 1, 1, W).setBackground(S.subBannerBg);

  return 15;
}

function paintTableHeader_(sh, row, ctx) {
  var S = ctx.S, W = ctx.W;
  setH_(sh, row, ctx.headerH);
  sh.getRange(row, 1, 1, W).setValues([ctx.head])
    .setFontFamily(S.font).setFontSize(S.body).setFontWeight('bold').setFontColor(S.headerTextColor)
    .setBackground(S.primaryColor).setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true)
    .setBorder(true, true, true, true, true, true, S.primaryColor, SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(row, 1).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP).setHorizontalAlignment('center').setVerticalAlignment('middle');
}

function paintItemRows_(sh, startRow, lines, startSr, ctx) {
  var n = lines.length;
  if (!n) return startRow;
  var S = ctx.S, W = ctx.W, INF = ctx.INF;

  // Codes and dates are stored as plain text (no number/date auto-conversion)
  var textCols = INF ? [3, 8, 9] : [3];
  textCols.forEach(function (c) { sh.getRange(startRow, c, n, 1).setNumberFormat('@'); });

  var vals = lines.map(function (it, i) {
    var r = startRow + i;
    var rowVals = [
      startSr + i,                          // A  Sr. No.
      safeText_(it.description),            // B  Description
      String(it.sacHsn || '9954'),          // C  SAC / HSN
      num_(it.quantity),                    // D  Qty
      safeText_(it.uom),                    // E  UOM
      num_(it.rate),                        // F  Rate/Unit
      '=D' + r + '*F' + r                   // G  Total Amount
    ];
    if (INF) rowVals.push(String(it.poRef || ''), String(it.poDate || ''));   // H, I
    return rowVals;
  });

  var rg = sh.getRange(startRow, 1, n, W);
  rg.setValues(vals)
    .setFontFamily(S.font).setFontSize(S.body).setFontColor(S.textColor)
    .setWrap(true).setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true, S.borderColor, SpreadsheetApp.BorderStyle.SOLID);

  sh.getRange(startRow, 1, n, 1).setHorizontalAlignment('center');
  sh.getRange(startRow, 2, n, 1).setHorizontalAlignment('left');
  sh.getRange(startRow, 3, n, 1).setHorizontalAlignment('center');
  sh.getRange(startRow, 4, n, 1).setNumberFormat('#,##0.00').setHorizontalAlignment('center');
  sh.getRange(startRow, 5, n, 1).setHorizontalAlignment('center');
  sh.getRange(startRow, 6, n, 1).setNumberFormat('#,##0.00').setHorizontalAlignment('right');
  sh.getRange(startRow, 7, n, 1).setNumberFormat('#,##0.00').setHorizontalAlignment('right').setFontWeight('bold');
  if (INF) sh.getRange(startRow, 8, n, 2).setHorizontalAlignment('center');

  for (var i = 0; i < n; i++) setH_(sh, startRow + i, itemRowHeight_(lines[i], ctx));
  return startRow + n;
}

function paintBoqNoteRow_(sh, row, ctx) {
  var S = ctx.S, W = ctx.W;
  setH_(sh, row, 24);
  sh.getRange(row, 1).setValue('*').setHorizontalAlignment('center').setFontWeight('bold');
  mset_(sh, row, 2, 1, W - 1, 'Details as per attached BOQ').setFontStyle('italic');
  sh.getRange(row, 1, 1, W).setFontFamily(S.font).setFontSize(S.body).setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, false, S.borderColor, SpreadsheetApp.BorderStyle.SOLID);
  return row + 1;
}

/** Basic Amount = SUM of Column G over every page's item rows. */
function basicFormula_(ranges, currentSheet) {
  if (!ranges || !ranges.length) return null;
  return '=SUM(' + ranges.map(function (r) {
    var prefix = (r.sheet === currentSheet) ? '' : "'" + r.sheet.replace(/'/g, "''") + "'!";
    return prefix + 'G' + r.first + ':G' + r.last;
  }).join(',') + ')';
}

function paintFooter_(sh, startRow, d, ctx, ranges) {
  var S = ctx.S, W = ctx.W, INF = ctx.INF, C = CONFIG.company;
  var SOLID = SpreadsheetApp.BorderStyle.SOLID;
  var H = footerRowHeights_(d, ctx);
  for (var i = 0; i < H.length; i++) setH_(sh, startRow + i, H[i]);
  sh.getRange(startRow, 1, H.length, W).setFontFamily(S.font).setFontSize(S.body)
    .setFontColor(S.textColor).setVerticalAlignment('middle');

  // --- GST note row
  var rGst = startRow;
  sh.getRange(rGst, 1).setValue('*').setFontWeight('bold').setFontSize(11).setHorizontalAlignment('center');
  mset_(sh, rGst, 2, 1, W - 1, CONFIG.gstNote).setFontWeight('bold').setFontColor(S.primaryColor);
  sh.getRange(rGst, 1, 1, W).setBorder(true, true, true, true, true, false, S.borderColor, SOLID);

  // --- Totals: words A:D | labels E:F | amount G | (Infosys) blank H:I
  var rB = rGst + 1, rR = rB + 1, rG = rR + 1;

  mset_(sh, rB, 1, 3, ctx.wordsEnd, 'Amount In Words:\n' + d.words)
    .setFontWeight('bold').setWrap(true).setVerticalAlignment('middle');
  sh.getRange(rB, 1, 3, ctx.wordsEnd).setBorder(true, true, true, true, false, false, S.borderColor, SOLID);

  var labels = [['Basic Amount :', rB], ['Round off (+/-) :', rR], ['GRAND TOTAL', rG]];
  labels.forEach(function (lb) {
    mset_(sh, lb[1], 5, 1, 2, lb[0]).setFontWeight('bold').setHorizontalAlignment('right');
  });

  var basicF = basicFormula_(ranges, sh.getName());
  if (basicF) sh.getRange(rB, 7).setFormula(basicF);        // =SUM(G first : G last)
  else        sh.getRange(rB, 7).setValue(d.basic);
  sh.getRange(rR, 7).setValue(d.roundOff);
  sh.getRange(rG, 7).setFormula('=G' + rB + '+G' + rR);      // Grand = Basic + Round off
  sh.getRange(rB, 7, 3, 1).setNumberFormat('#,##0.00').setHorizontalAlignment('right').setFontWeight('bold');

  sh.getRange(rG, 5, 1, 3).setBackground(S.subBannerBg).setFontColor(S.primaryColor);
  sh.getRange(rB, 5, 3, 3).setBorder(true, true, true, true, true, true, S.borderColor, SOLID);

  if (INF) {
    sh.getRange(rB, 8, 3, 2).merge();
    sh.getRange(rB, 8, 3, 2).setBorder(true, true, true, true, false, false, S.borderColor, SOLID);
  }

  // --- Gap, then Terms (left) + Signature (right)
  var rT = rG + 2;
  var terms = termsOf_(d), nT = terms.length;
  var tEnd = ctx.leftEnd, sStart = tEnd + 1, sN = W - tEnd;
  var rName = rT + 1 + nT;

  mset_(sh, rT, 1, 1, tEnd, 'Terms & Conditions').setFontWeight('bold').setFontColor(S.primaryColor);
  terms.forEach(function (t, k) {
    mset_(sh, rT + 1 + k, 1, 1, tEnd, safeText_(t)).setFontSize(S.small).setWrap(true);
  });
  sh.getRange(rName, 1, 1, tEnd).merge();
  sh.getRange(rT, 1, nT + 2, tEnd).setBorder(true, true, true, true, false, false, S.borderColor, SOLID);

  mset_(sh, rT, sStart, 1, sN, C.signOff).setFontWeight('bold').setFontSize(S.h2).setHorizontalAlignment('center');
  mset_(sh, rName, sStart, 1, sN, CONFIG.eSign.name).setFontWeight('bold').setFontSize(S.h2).setHorizontalAlignment('center');
  sh.getRange(rT, sStart, nT + 2, sN).setBorder(true, true, true, true, false, false, S.borderColor, SOLID);

  var sigW = (CONFIG.eSignSize && CONFIG.eSignSize.width) || 185;
  var sigH = (CONFIG.eSignSize && CONFIG.eSignSize.height) || 118;
  var termsRowsH = sum_(H.slice(6, 6 + nT));   // heights of the terms rows
  placeImage_(sh, img_(CONFIG.eSignFileId), sStart, rT + 1, spanW_(ctx, sStart, W), termsRowsH, sigW, sigH, 'center');

  return rName + 1;
}

/* ---------- BOQ sheet (Format B) ---------- */
function paintBoq_(sh, d) {
  var S = getStyle_(), INF = (d.layout === 'INFOSYS'), W = INF ? 8 : 6, M = CONFIG.metrics;
  var widths = INF ? [55, 287, 65, 55, 75, 105, 85, 75] : [55, 330, 70, 60, 85, 110];
  var SOLID = SpreadsheetApp.BorderStyle.SOLID;
  var totalW = sum_(widths);

  sh.setHiddenGridlines(true);
  widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });

  // Row 1 title, Row 2 header — both frozen so they repeat on every PDF page
  var title = 'BOQ' + ((d.subject || d.jobDescription) ? ' — ' + (d.subject || d.jobDescription) : '');
  setH_(sh, 1, Math.max(30, wrapLines_(title, totalW, M.boldCharPx) * M.bodyLinePx + 12));
  mset_(sh, 1, 1, 1, W, safeText_(title)).setFontSize(12).setFontWeight('bold').setFontColor(S.primaryColor)
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);

  var head = ['Sr.', 'Description of Work / Goods', 'Qty', 'UOM', 'Rate/Unit', 'Total Amount'];
  if (INF) head.push('PO Ref. No.', 'PO Date');
  setH_(sh, 2, headerRowHeight_(head, widths));
  sh.getRange(2, 1, 1, W).setValues([head]).setFontWeight('bold').setFontColor(S.headerTextColor)
    .setFontSize(S.body).setBackground(S.primaryColor).setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setWrap(true).setBorder(true, true, true, true, true, true, S.primaryColor, SOLID);
  sh.getRange(2, 1).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP).setHorizontalAlignment('center').setVerticalAlignment('middle');

  var first = 3, n = d.lines.length;
  if (n) {
    if (INF) sh.getRange(first, 7, n, 2).setNumberFormat('@');
    var body = d.lines.map(function (l, i) {
      var r = first + i;
      var row = [i + 1, safeText_(l.description), num_(l.quantity), safeText_(l.uom), num_(l.rate), '=C' + r + '*E' + r];
      if (INF) row.push(String(l.poRef || ''), String(l.poDate || ''));
      return row;
    });
    sh.getRange(first, 1, n, W).setValues(body)
      .setFontSize(S.body).setWrap(true).setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true, S.borderColor, SOLID);
    sh.getRange(first, 1, n, 1).setHorizontalAlignment('center');
    sh.getRange(first, 3, n, 1).setNumberFormat('#,##0.00').setHorizontalAlignment('center');
    sh.getRange(first, 4, n, 1).setHorizontalAlignment('center');
    sh.getRange(first, 5, n, 1).setNumberFormat('#,##0.00').setHorizontalAlignment('right');
    sh.getRange(first, 6, n, 1).setNumberFormat('#,##0.00').setHorizontalAlignment('right').setFontWeight('bold');
    if (INF) sh.getRange(first, 7, n, 2).setHorizontalAlignment('center');
    for (var i = 0; i < n; i++) {
      setH_(sh, first + i, Math.max(M.minItemRow, wrapLines_(d.lines[i].description, widths[1], M.bodyCharPx) * M.bodyLinePx + 8));
    }
  }
  var last = first + Math.max(n, 1) - 1;

  var r1 = last + 1;
  setH_(sh, r1, 22);
  sh.getRange(r1, 1).setValue('*').setFontWeight('bold').setFontSize(11).setHorizontalAlignment('center');
  mset_(sh, r1, 2, 1, W - 1, CONFIG.gstNote).setFontWeight('bold').setFontSize(S.small);
  sh.getRange(r1, 1, 1, W).setBorder(true, true, true, true, true, false, S.borderColor, SOLID);

  var rBasic = r1 + 1;
  setH_(sh, rBasic, 24);
  sh.getRange(rBasic, 5).setValue('Basic Amount :').setFontWeight('bold').setHorizontalAlignment('right');
  if (n) sh.getRange(rBasic, 6).setFormula('=SUM(F' + first + ':F' + last + ')');
  else   sh.getRange(rBasic, 6).setValue(0);
  sh.getRange(rBasic, 6).setFontWeight('bold').setNumberFormat('#,##0.00').setHorizontalAlignment('right');
  sh.getRange(rBasic, 5, 1, 2).setBorder(true, true, true, true, true, false, S.borderColor, SOLID);

  trimSheet_(sh, rBasic, W);
  sh.setFrozenRows(2);
  sh.getRange(1, 1, rBasic, W).setFontFamily(S.font);
}

/* ===========================================================
   8. FILE ATTACHMENTS
   =========================================================== */
function uploadAttachment(p) {
  var name = (p.quoteNo ? String(p.quoteNo).replace(/\//g, '-') + ' - ' : '') + p.fileName;
  var file = folder_(CONFIG.attachmentFolder).createFile(
    Utilities.newBlob(Utilities.base64Decode(p.dataB64), p.mimeType || 'application/octet-stream', name));
  return { name: p.fileName, url: file.getUrl(), id: file.getId() };
}

function deleteAttachment(fileId) {
  try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) {}
  return { ok: true };
}

function folder_(name) {
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

/* ===========================================================
   9. NUMERIC & NUMBER-TO-WORDS HELPERS
   =========================================================== */
function num_(v) {
  if (v === null || v === undefined || v === '') return 0;
  var n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function pad2_(n) { return (n < 10 ? '0' : '') + n; }

function rupeesInWords_(amount) {
  var n = Math.round(num_(amount));
  if (n === 0) return 'Rupees Zero only.';
  var neg = n < 0; n = Math.abs(n);
  var o = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
    'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  var t = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  function two(x) { return x < 20 ? o[x] : t[Math.floor(x / 10)] + (x % 10 ? ' ' + o[x % 10] : ''); }
  function three(x) {
    var h = Math.floor(x / 100), r = x % 100, s = '';
    if (h) s += o[h] + ' hundred';
    if (r) s += (s ? ' and ' : '') + two(r);
    return s;
  }
  var parts = [], cr = Math.floor(n / 10000000); n %= 10000000;
  var la = Math.floor(n / 100000); n %= 100000;
  var th = Math.floor(n / 1000); n %= 1000;
  if (cr) parts.push(three(cr) + ' crore');
  if (la) parts.push(three(la) + ' lakh');
  if (th) parts.push(three(th) + ' thousand');
  if (n) parts.push((parts.length ? 'and ' : '') + three(n));
  var s = parts.join(' ');
  return 'Rupees ' + (neg ? 'Minus ' : '') + s.charAt(0).toUpperCase() + s.slice(1) + ' only.';
}