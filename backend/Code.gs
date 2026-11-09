/**
 * 自學大廳 Self-Study Lobby — Google Apps Script backend.
 *
 * Paste this whole file into the Apps Script editor of the roster spreadsheet
 * (Extensions → Apps Script), then Deploy → New deployment → Web app:
 *   Execute as: Me    Who has access: Anyone
 * Copy the web-app URL into js/config.js (API_URL).
 *
 * Sheets used (created automatically if missing; columns are matched by header name):
 *   Students  student_id | name | class_code | seat | password_hash | salt | must_change | active | last_login
 *   Classes   class_code | class_name | grade | course_id | released_units | scoring_mode | default_level | allow_level_switch | hint_max
 *   Records   student_id | updated_at | chunks | data_1 | data_2 | ...   (each student's learning record, JSON)
 *   Activity  one row per finished question set (for the teacher to read)
 *   Sessions  token | student_id | expires
 *   Overview  per-student summary (menu: 自學大廳 → 更新總覽)
 *   Originals passage_id | title | source | paragraphs_json   (magazine article text, shown only to logged-in students)
 *
 * A blank password_hash means the password is the student's 學號 (student_id).
 * To reset a password, clear that student's password_hash and salt cells (or use the menu).
 */

const SESSION_DAYS = 30;
const CHUNK_SIZE = 45000;           // Google Sheets cell limit is 50,000 characters
const MAX_FAILS = 8;                // failed logins before a 10-minute lock
const HASH_ROUNDS = 300;

const HEADERS = {
  Students: ['student_id', 'name', 'class_code', 'seat', 'password_hash', 'salt', 'must_change', 'active', 'last_login'],
  Classes: ['class_code', 'class_name', 'grade', 'course_id', 'released_units', 'scoring_mode', 'default_level', 'allow_level_switch', 'hint_max'],
  Records: ['student_id', 'updated_at', 'chunks', 'data_1'],
  Activity: ['time', 'student_id', 'class_name', 'seat', 'name', 'set_title', 'unit', 'skill', 'score', 'max', 'percent', 'independent', 'questions', 'hints', 'minutes', 'level', 'reflection'],
  Sessions: ['token', 'student_id', 'expires'],
  Overview: ['class_name', 'seat', 'student_id', 'name', 'sets_finished', 'avg_percent', 'total_minutes', 'last_active', 'last_login'],
  Originals: ['passage_id', 'title', 'source', 'paragraphs_json'],
};

// ---------------------------------------------------------------- HTTP

function doGet() {
  return json_({ ok: true, service: 'self-study-lobby', time: new Date().toISOString() });
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad_request' });
  }
  try {
    switch (req.action) {
      case 'login': return json_(login_(req));
      case 'changePassword': return json_(changePassword_(req));
      case 'load': return json_(load_(req));
      case 'save': return json_(save_(req));
      case 'logout': return json_(logout_(req));
      case 'originals': return json_(originals_(req));
      case 'ping': return json_({ ok: true });
      default: return json_({ ok: false, error: 'unknown_action' });
    }
  } catch (err) {
    if (err && err.code) return json_({ ok: false, error: err.code });
    console.error(err);
    return json_({ ok: false, error: 'server_error', message: String(err && err.message || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function fail_(code) {
  const err = new Error(code);
  err.code = code;
  throw err;
}

// ---------------------------------------------------------------- Sheet helpers

function sheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

// Reads a sheet into { sh, header, col(name) → 1-based index, rows: [{ _row, field: value }] }.
function table_(name) {
  const sh = sheet_(name);
  const values = sh.getDataRange().getValues();
  const header = (values[0] || []).map(function (h) { return String(h).trim(); });
  HEADERS[name].forEach(function (h) {
    if (header.indexOf(h) === -1) {
      header.push(h);
      sh.getRange(1, header.length).setValue(h).setFontWeight('bold');
    }
  });
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const obj = { _row: i + 1 };
    header.forEach(function (h, j) { obj[h] = values[i][j]; });
    rows.push(obj);
  }
  return {
    sh: sh,
    header: header,
    rows: rows,
    col: function (h) {
      let idx = header.indexOf(h);
      if (idx === -1) {
        header.push(h);
        idx = header.length - 1;
        sh.getRange(1, idx + 1).setValue(h).setFontWeight('bold');
      }
      return idx + 1;
    },
  };
}

const str_ = function (v) { return v === null || v === undefined ? '' : String(v).trim(); };
const isFalse_ = function (v) { return v === false || /^(false|no|0|否)$/i.test(str_(v)); };
const isTrue_ = function (v) { return v === true || /^(true|yes|1|是)$/i.test(str_(v)); };

// ---------------------------------------------------------------- Auth

function hash_(salt, password) {
  let value = salt + '|' + password;
  for (let i = 0; i < HASH_ROUNDS; i++) {
    const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8);
    value = bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
  }
  return value;
}

function findStudent_(students, id) {
  return students.rows.find(function (r) { return str_(r.student_id) === id; });
}

function checkPassword_(student, password) {
  const stored = str_(student.password_hash);
  if (!stored) return password === str_(student.student_id);
  return hash_(str_(student.salt), password) === stored;
}

function classInfo_(code) {
  const classes = table_('Classes');
  const c = classes.rows.find(function (r) { return str_(r.class_code) === str_(code); });
  if (!c) return null;
  const released = str_(c.released_units);
  return {
    class_code: str_(c.class_code),
    class_name: str_(c.class_name),
    grade: Number(c.grade) || null,
    course_id: str_(c.course_id),
    released_units: released ? released.split(/[\s,，、]+/).filter(String) : null,
    scoring_mode: str_(c.scoring_mode) || 'practice',
    default_level: str_(c.default_level) || 'standard',
    allow_level_switch: !isFalse_(c.allow_level_switch),
    hint_max: c.hint_max === '' || c.hint_max === null ? 4 : Number(c.hint_max),
  };
}

function profile_(student) {
  return {
    student_id: str_(student.student_id),
    name: str_(student.name),
    seat: str_(student.seat),
    class_code: str_(student.class_code),
    class: classInfo_(student.class_code),
  };
}

function login_(req) {
  const id = str_(req.id);
  const password = String(req.password || '');
  if (!id || !password) fail_('invalid');
  const cache = CacheService.getScriptCache();
  const failKey = 'fail_' + id;
  const fails = Number(cache.get(failKey) || 0);
  if (fails >= MAX_FAILS) fail_('locked');

  const students = table_('Students');
  const student = findStudent_(students, id);
  if (!student || isFalse_(student.active) || !checkPassword_(student, password)) {
    cache.put(failKey, String(fails + 1), 600);
    fail_('invalid');
  }
  cache.remove(failKey);

  const token = Utilities.getUuid() + Utilities.getUuid().slice(0, 8);
  const expires = Date.now() + SESSION_DAYS * 864e5;
  sheet_('Sessions').appendRow([token, id, expires]);
  cache.put('t_' + token, id, 21600);
  students.sh.getRange(student._row, students.col('last_login')).setValue(new Date());

  const mustChange = !str_(student.password_hash) || isTrue_(student.must_change);
  return { ok: true, token: token, profile: profile_(student), mustChange: mustChange, record: readRecord_(id) };
}

function session_(token) {
  token = str_(token);
  if (!token) fail_('unauthorized');
  const cache = CacheService.getScriptCache();
  const cached = cache.get('t_' + token);
  if (cached) return cached;
  const sessions = table_('Sessions');
  const s = sessions.rows.find(function (r) { return str_(r.token) === token; });
  if (!s || Number(s.expires) < Date.now()) fail_('unauthorized');
  cache.put('t_' + token, str_(s.student_id), 21600);
  return str_(s.student_id);
}

function changePassword_(req) {
  const id = session_(req.token);
  const next = String(req.newPassword || '');
  if (next.length < 6) fail_('weak_password');
  if (next === id) fail_('same_as_id');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const students = table_('Students');
    const student = findStudent_(students, id);
    if (!student || !checkPassword_(student, String(req.oldPassword || ''))) fail_('wrong_password');
    const salt = Utilities.getUuid();
    students.sh.getRange(student._row, students.col('password_hash')).setValue(hash_(salt, next));
    students.sh.getRange(student._row, students.col('salt')).setValue(salt);
    students.sh.getRange(student._row, students.col('must_change')).setValue(false);
  } finally {
    lock.releaseLock();
  }
  return { ok: true };
}

function logout_(req) {
  const token = str_(req.token);
  CacheService.getScriptCache().remove('t_' + token);
  const sessions = table_('Sessions');
  const s = sessions.rows.find(function (r) { return str_(r.token) === token; });
  if (s) sessions.sh.deleteRow(s._row);
  return { ok: true };
}

// ---------------------------------------------------------------- Records

function readRecord_(id) {
  const records = table_('Records');
  const r = records.rows.find(function (row) { return str_(row.student_id) === id; });
  if (!r) return { updated_at: 0, data: null };
  const n = Number(r.chunks) || 1;
  let text = '';
  for (let i = 1; i <= n; i++) text += str_(r['data_' + i]);
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (err) { data = null; }
  return { updated_at: Number(r.updated_at) || 0, data: data };
}

function load_(req) {
  const id = session_(req.token);
  return { ok: true, record: readRecord_(id) };
}

function save_(req) {
  const id = session_(req.token);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const current = readRecord_(id);
    // Optimistic concurrency: if another device saved since this client last synced, send it back to merge.
    if (current.updated_at && Number(req.base || 0) !== current.updated_at) {
      return { ok: false, error: 'conflict', record: current };
    }
    const text = JSON.stringify(req.data || {});
    const chunks = [];
    for (let i = 0; i < text.length; i += CHUNK_SIZE) chunks.push(text.slice(i, i + CHUNK_SIZE));
    if (!chunks.length) chunks.push('{}');
    const updatedAt = Date.now();

    const records = table_('Records');
    let row = records.rows.find(function (r) { return str_(r.student_id) === id; });
    let rowIndex = row ? row._row : records.sh.getLastRow() + 1;
    const set = function (h, v) { records.sh.getRange(rowIndex, records.col(h)).setValue(v); };
    if (!row) records.sh.getRange(rowIndex, records.col('student_id')).setNumberFormat('@').setValue(id);
    const prevChunks = row ? Number(row.chunks) || 1 : 0;
    set('updated_at', updatedAt);
    set('chunks', chunks.length);
    chunks.forEach(function (c, i) { records.sh.getRange(rowIndex, records.col('data_' + (i + 1))).setNumberFormat('@').setValue(c); });
    for (let i = chunks.length + 1; i <= prevChunks; i++) set('data_' + i, '');

    appendActivity_(id, req.events || []);
    return { ok: true, updated_at: updatedAt };
  } finally {
    lock.releaseLock();
  }
}

function appendActivity_(id, events) {
  if (!events.length) return;
  const student = findStudent_(table_('Students'), id) || {};
  const cls = classInfo_(student.class_code) || {};
  const rows = events.slice(0, 50).map(function (e) {
    const pct = e.max ? Math.round((Number(e.score) / Number(e.max)) * 100) : '';
    return [new Date(Number(e.ts) || Date.now()), id, cls.class_name || str_(student.class_code), str_(student.seat), str_(student.name),
      str_(e.title), str_(e.unit_title), str_(e.skill), Number(e.score) || 0, Number(e.max) || 0, pct,
      Number(e.independent) || 0, Number(e.count) || 0, Number(e.hintsUsed) || 0, Math.round((Number(e.duration) || 0) / 6) / 10,
      e.level === 'support' ? '支援版' : '標準版', str_(e.reflection)];
  });
  const sh = sheet_('Activity');
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

// ---------------------------------------------------------------- Magazine originals (login only)

function originals_(req) {
  session_(req.token);
  const cache = CacheService.getScriptCache();
  const cached = cache.get('originals_v1');
  if (cached) return { ok: true, originals: JSON.parse(cached) };
  const rows = table_('Originals').rows;
  const out = {};
  rows.forEach(function (r) {
    const id = str_(r.passage_id);
    if (!id) return;
    let paragraphs = [];
    try { paragraphs = JSON.parse(str_(r.paragraphs_json)); } catch (err) { paragraphs = str_(r.paragraphs_json).split(/\n\s*\n/); }
    out[id] = { title: str_(r.title), source: str_(r.source), paragraphs: paragraphs };
  });
  const text = JSON.stringify(out);
  if (text.length < 90000) cache.put('originals_v1', text, 600);
  return { ok: true, originals: out };
}

// ---------------------------------------------------------------- Teacher menu

function onOpen() {
  SpreadsheetApp.getUi().createMenu('自學大廳')
    .addItem('更新總覽（Overview）', 'refreshOverview')
    .addItem('把選取的學生密碼重設為學號', 'resetSelectedPasswords')
    .addItem('讓所有學生重新登入', 'clearSessions')
    .addSeparator()
    .addItem('建立／檢查工作表', 'setup')
    .addToUi();
}

function setup() {
  Object.keys(HEADERS).forEach(function (name) { table_(name); });
  SpreadsheetApp.getActiveSpreadsheet().toast('工作表已就緒');
}

function resetSelectedPasswords() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getActiveSheet();
  if (sh.getName() !== 'Students') {
    SpreadsheetApp.getUi().alert('請先到 Students 工作表，選取要重設的學生列（可多選）。');
    return;
  }
  const students = table_('Students');
  const ranges = sh.getActiveRangeList().getRanges();
  let count = 0;
  ranges.forEach(function (range) {
    for (let r = range.getRow(); r < range.getRow() + range.getNumRows(); r++) {
      if (r < 2) continue;
      sh.getRange(r, students.col('password_hash')).setValue('');
      sh.getRange(r, students.col('salt')).setValue('');
      sh.getRange(r, students.col('must_change')).setValue(true);
      count++;
    }
  });
  ss.toast('已重設 ' + count + ' 位學生，密碼改回學號，下次登入需改密碼。');
}

function clearSessions() {
  const sh = sheet_('Sessions');
  if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
  SpreadsheetApp.getActiveSpreadsheet().toast('已登出所有裝置（快取最多 6 小時內失效）。');
}

function refreshOverview() {
  const students = table_('Students').rows;
  const classes = table_('Classes').rows;
  const activity = table_('Activity').rows;
  const className = {};
  classes.forEach(function (c) { className[str_(c.class_code)] = str_(c.class_name); });
  const stats = {};
  activity.forEach(function (a) {
    const id = str_(a.student_id);
    const s = stats[id] || (stats[id] = { sets: 0, pct: 0, minutes: 0, last: null });
    s.sets += 1;
    s.pct += Number(a.percent) || 0;
    s.minutes += Number(a.minutes) || 0;
    const t = a.time instanceof Date ? a.time : new Date(a.time);
    if (!s.last || t > s.last) s.last = t;
  });
  const rows = students
    .filter(function (st) { return str_(st.student_id); })
    .map(function (st) {
      const id = str_(st.student_id);
      const s = stats[id] || { sets: 0, pct: 0, minutes: 0, last: '' };
      return [className[str_(st.class_code)] || str_(st.class_code), str_(st.seat), id, str_(st.name), s.sets,
        s.sets ? Math.round(s.pct / s.sets) : '', Math.round(s.minutes), s.last || '', st.last_login || ''];
    })
    .sort(function (a, b) { return a[0] === b[0] ? String(a[1]).localeCompare(String(b[1])) : String(a[0]).localeCompare(String(b[0])); });
  const sh = sheet_('Overview');
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  SpreadsheetApp.getActiveSpreadsheet().toast('總覽已更新：' + rows.length + ' 位學生');
}
