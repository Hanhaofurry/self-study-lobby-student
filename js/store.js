// Local learning record. Everything lives in this browser only (no accounts, no server).
import { todayISO } from "./ui.js";

const KEY = "sslobby.v1";

function defaults() {
  return {
    settings: {
      fontSize: "md", lineHeight: "1.75", font: "system", theme: "system",
      motion: "system", speechRate: 0.9, accent: "en-US", showTimer: false,
    },
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
    last: null,     // { setId, courseId, title, at }
  };
}

let state = defaults();
let storageOK = true;

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const base = defaults();
      state = { ...base, ...saved, settings: { ...base.settings, ...(saved.settings || {}) } };
    }
  } catch {
    storageOK = false;
    state = defaults();
  }
  return state;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    storageOK = false;
  }
}

export const getState = () => state;
export const isStorageOK = () => storageOK;

export function update(fn) {
  fn(state);
  save();
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
  if (!days.has(todayISO(d))) d.setDate(d.getDate() - 1); // streak survives until today ends
  while (days.has(todayISO(d))) {
    count += 1;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

export function resetAll() {
  const settings = state.settings;
  state = { ...defaults(), settings };
  save();
}
