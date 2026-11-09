// Learning record + device settings.
// Without a backend, the record lives only in this browser.
// With a backend (js/config.js), each student logs in and the record syncs to the teacher's Google Sheet.
import { todayISO } from "./ui.js";
import { call, cloudEnabled } from "./api.js";

const LEGACY_KEY = "sslobby.v1";
const SETTINGS_KEY = "sslobby.settings";
const AUTH_KEY = "sslobby.auth";

const DEFAULT_SETTINGS = {
  fontSize: "md", lineHeight: "1.75", font: "system", theme: "system",
  motion: "system", speechRate: 0.9, accent: "en-US", showTimer: false,
};

function blankRecord() {
  return {
    classCode: null,
    courseId: null,
    grade: null,
    goal: null,
    goalDate: null,
    seenIntro: false,
    attempts: {},   // question_id -> latest attempt record
    sessions: [],   // finished question sets
    activeDays: [], // ISO dates with practice
    runs: {},       // set_id -> unfinished run (resume support)
    drafts: {},     // question_id -> essay draft
    levelPref: {},  // set_id -> "standard" | "support"
    last: null,     // { setId, courseId, at }
    pendingEvents: [], // finished sets not yet sent to the teacher's Activity sheet
    cloudVersion: 0,
  };
}

const SYNCED_FIELDS = ["goal", "goalDate", "seenIntro", "attempts", "sessions", "activeDays", "runs", "drafts", "levelPref", "last"];

let state = { settings: { ...DEFAULT_SETTINGS }, ...blankRecord() };
let auth = null;
let storageOK = true;
const listeners = new Set();
let syncStatus = "idle";

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    storageOK = false;
    return null;
  }
}

function writeJSON(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    storageOK = false;
  }
}

const recordKey = () => (auth?.profile ? `sslobby.user.${auth.profile.student_id}` : LEGACY_KEY);

export function load() {
  auth = cloudEnabled ? readJSON(AUTH_KEY) : null;
  const legacy = readJSON(LEGACY_KEY);
  const settings = readJSON(SETTINGS_KEY) || legacy?.settings || {};
  const record = (cloudEnabled && !auth) ? {} : (readJSON(recordKey()) || {});
  delete record.settings;
  state = { ...blankRecord(), ...record, settings: { ...DEFAULT_SETTINGS, ...settings } };
  return state;
}

function persistLocal() {
  const { settings, ...record } = state;
  writeJSON(SETTINGS_KEY, settings);
  if (!cloudEnabled || auth) writeJSON(recordKey(), record);
}

export function save() {
  persistLocal();
}

export const getState = () => state;
export const isStorageOK = () => storageOK;

// Record changes are synced to the cloud shortly after (when logged in).
export function update(fn, { sync = true } = {}) {
  fn(state);
  persistLocal();
  if (sync) scheduleSync();
}

export function updateSettings(fn) {
  fn(state.settings);
  persistLocal();
}

export function markActiveToday() {
  const today = todayISO();
  if (!state.activeDays.includes(today)) {
    state.activeDays.push(today);
    state.activeDays = state.activeDays.slice(-120);
  }
}

export function streakDays() {
  const days = new Set(state.activeDays);
  let count = 0;
  const d = new Date();
  if (!days.has(todayISO(d))) d.setDate(d.getDate() - 1);
  while (days.has(todayISO(d))) {
    count += 1;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

export function resetAll() {
  const settings = state.settings;
  state = { ...blankRecord(), settings };
  persistLocal();
}

export function queueEvent(event) {
  state.pendingEvents = [...(state.pendingEvents || []), { ...event, id: `${event.ts}-${event.set_id}` }].slice(-100);
}

// ---------------------------------------------------------------- Merge (one student, two devices)

export function mergeRecords(local, remote) {
  if (!remote) return local;
  const out = { ...local };
  const attempts = { ...(remote.attempts || {}) };
  Object.entries(local.attempts || {}).forEach(([id, a]) => {
    if (!attempts[id] || (a.ts || 0) >= (attempts[id].ts || 0)) attempts[id] = a;
  });
  out.attempts = attempts;

  const sessions = new Map();
  [...(remote.sessions || []), ...(local.sessions || [])].forEach((s) => sessions.set(`${s.ts}-${s.set_id}`, s));
  out.sessions = [...sessions.values()].sort((a, b) => a.ts - b.ts).slice(-300);

  out.activeDays = [...new Set([...(remote.activeDays || []), ...(local.activeDays || [])])].sort().slice(-120);
  out.levelPref = { ...(remote.levelPref || {}), ...(local.levelPref || {}) };
  out.drafts = { ...(remote.drafts || {}), ...(local.drafts || {}) };

  // Unfinished runs: keep the newest per set; drop runs already finished on another device.
  const runs = { ...(remote.runs || {}) };
  Object.entries(local.runs || {}).forEach(([id, r]) => {
    if (!runs[id] || (r.startedAt || 0) >= (runs[id].startedAt || 0)) runs[id] = r;
  });
  Object.keys(runs).forEach((id) => {
    if (out.sessions.some((s) => s.set_id === id && s.ts > (runs[id].startedAt || 0))) delete runs[id];
  });
  out.runs = runs;

  ["goal", "goalDate", "last"].forEach((k) => { out[k] = local[k] ?? remote[k] ?? null; });
  out.seenIntro = Boolean(local.seenIntro || remote.seenIntro);
  return out;
}

function syncPayload() {
  const data = {};
  SYNCED_FIELDS.forEach((k) => { data[k] = state[k]; });
  return data;
}

// ---------------------------------------------------------------- Auth

export const getAuth = () => auth;
export const isLoggedIn = () => Boolean(auth?.token);
export const mustChangePassword = () => Boolean(auth?.mustChange);

export function setSession({ token, profile, mustChange, record }) {
  auth = { token, profile, mustChange: Boolean(mustChange) };
  writeJSON(AUTH_KEY, auth);
  const settings = state.settings;
  const local = readJSON(recordKey()) || {};
  delete local.settings;
  const base = { ...blankRecord(), ...local };
  const merged = record?.data ? mergeRecords(base, record.data) : base;
  state = { ...merged, settings, cloudVersion: record?.updated_at || 0 };
  persistLocal();
  if (Object.keys(local).length) scheduleSync(500); // push anything that only existed on this device
}

export function passwordChanged() {
  if (!auth) return;
  auth.mustChange = false;
  writeJSON(AUTH_KEY, auth);
}

let loggingOut = false;
export async function logout() {
  if (!auth || loggingOut) return;
  loggingOut = true;
  try {
    await syncNow({ final: true });
    await call("logout", { token: auth.token }, { timeout: 8000 });
  } catch {
    // Logging out must still work offline.
  }
  // Shared school computers: remove this student's local copy.
  writeJSON(recordKey(), null);
  writeJSON(AUTH_KEY, null);
  auth = null;
  const settings = state.settings;
  state = { ...blankRecord(), settings };
  setStatus("idle");
  loggingOut = false;
}

// ---------------------------------------------------------------- Cloud sync

export const getSyncStatus = () => syncStatus;
export function onSyncStatus(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function setStatus(s) {
  syncStatus = s;
  listeners.forEach((fn) => fn(s));
}

let timer = null;
let running = null;
let rerun = false;

export function scheduleSync(delay = 2500) {
  if (!cloudEnabled || !auth?.token) return;
  clearTimeout(timer);
  setStatus("pending");
  timer = setTimeout(() => { syncNow(); }, delay);
}

export async function syncNow({ final = false } = {}) {
  if (!cloudEnabled || !auth?.token) return;
  clearTimeout(timer);
  if (running) {
    rerun = true;
    return running;
  }
  running = (async () => {
    setStatus("syncing");
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const events = [...(state.pendingEvents || [])];
      try {
        const res = await call("save", { token: auth.token, base: state.cloudVersion || 0, data: syncPayload(), events });
        const sent = new Set(events.map((e) => e.id));
        state.pendingEvents = (state.pendingEvents || []).filter((e) => !sent.has(e.id));
        state.cloudVersion = res.updated_at;
        persistLocal();
        setStatus("saved");
        return;
      } catch (err) {
        if (err.code === "conflict" && err.data?.record) {
          Object.assign(state, mergeRecords(state, err.data.record.data || {}), { cloudVersion: err.data.record.updated_at });
          persistLocal();
          continue;
        }
        if (err.code === "unauthorized") {
          setStatus("unauthorized");
          if (!loggingOut) document.dispatchEvent(new CustomEvent("auth-expired"));
          return;
        }
        setStatus("offline");
        if (!final) timer = setTimeout(() => syncNow(), 30000);
        return;
      }
    }
    setStatus("offline");
  })();
  try {
    await running;
  } finally {
    running = null;
    if (rerun) {
      rerun = false;
      scheduleSync(500);
    }
  }
}

// Pull the latest record (the student may also have practiced on another device).
export async function pull() {
  if (!cloudEnabled || !auth?.token) return false;
  try {
    const res = await call("load", { token: auth.token });
    const rec = res.record;
    if (rec?.updated_at && rec.updated_at !== state.cloudVersion) {
      Object.assign(state, mergeRecords(state, rec.data || {}), { cloudVersion: rec.updated_at });
      persistLocal();
      scheduleSync(1000);
      return true;
    }
  } catch (err) {
    if (err.code === "unauthorized") document.dispatchEvent(new CustomEvent("auth-expired"));
  }
  return false;
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && syncStatus === "pending") syncNow({ final: true });
  });
}
