// Shared UI helpers: escaping, icons, labels, speech, toasts.

export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  chart: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  bulb: '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.3 1.1 2.2h5c0-.9.5-1.7 1.1-2.2A6 6 0 0 0 12 3z"/>',
  speaker: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v16H5.5A1.5 1.5 0 0 0 4 20.5z"/><path d="M4 20.5A1.5 1.5 0 0 0 5.5 22H20"/>',
  abc: '<path d="M3 17 6.5 7 10 17"/><path d="M4.2 13.5h4.6"/><path d="M13 7v10h3a2.5 2.5 0 0 0 0-5h-3"/><path d="M13 12h2.5a2.5 2.5 0 0 0 0-5H13"/><path d="M22 9a3 3 0 1 0 0 6"/>',
  puzzle: '<path d="M10 3h4v3a2 2 0 1 0 4 0V3h3v7h-3a2 2 0 1 0 0 4h3v7h-7v-3a2 2 0 1 0-4 0v3H3v-7h3a2 2 0 1 0 0-4H3V3z"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m14 6 4 4"/>',
  headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  retry: '<path d="M4 4v6h6"/><path d="M5.5 15a7 7 0 1 0 1.6-7.3L4 10"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  turtle: '<path d="M4 15c0-4 3.6-7 8-7s8 3 8 7z"/><path d="M20 14h1.5a1.5 1.5 0 0 0 0-3H20"/><path d="M7 15v3"/><path d="M17 15v3"/>',
  close: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
};

export function icon(name, cls = "") {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ""}</svg>`;
}

export const SKILLS = {
  reading: { zh: "閱讀", en: "Reading", icon: "book" },
  vocabulary: { zh: "字彙", en: "Vocabulary", icon: "abc" },
  grammar: { zh: "文法", en: "Grammar", icon: "puzzle" },
  writing: { zh: "寫作", en: "Writing", icon: "pencil" },
  listening: { zh: "聽力", en: "Listening", icon: "headphones" },
};

export const BLOOM = {
  remember: "記憶", understand: "理解", apply: "應用",
  analyze: "分析", evaluate: "評鑑", create: "創造",
};

export const DIFFICULTY = { foundation: "基礎", standard: "標準", challenge: "挑戰" };

export const SUBSKILL = {
  "main-idea": "主旨", detail: "細節", inference: "推論", "author-purpose": "作者目的",
  tone: "語氣態度", "cause-effect": "因果關係", argument: "論點分析", "evaluate-evidence": "評估證據",
  "word-in-context": "語境字義", collocation: "搭配詞", "word-parts": "字首字根",
  "present-perfect": "現在完成式", "subject-verb-agreement": "主詞動詞一致", "relative-clause": "關係子句",
  "passive-voice": "被動語態", concession: "讓步連接詞",
  "opinion-paragraph": "意見段落", "key-information": "關鍵資訊",
};

export const subSkillLabel = (key) => SUBSKILL[key] || key;

export function skillChip(skill) {
  const s = SKILLS[skill] || { zh: skill, icon: "spark" };
  return `<span class="chip chip--${esc(skill)}">${icon(s.icon)}<span>${s.zh}</span></span>`;
}

export function todayISO(date = new Date()) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatDuration(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function wordCount(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

let toastTimer;
export function toast(message) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-visible"), 2600);
}

// ---------- Speech (Web Speech API) ----------
export const ttsAvailable = typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

function pickVoice(accent) {
  if (!ttsAvailable) return null;
  const voices = window.speechSynthesis.getVoices();
  const lang = accent === "en-GB" ? "en-GB" : "en-US";
  return voices.find((v) => v.lang === lang) || voices.find((v) => v.lang && v.lang.startsWith("en")) || null;
}

export function stopSpeaking() {
  if (ttsAvailable) window.speechSynthesis.cancel();
}

// Speak a list of chunks in sequence; onChunk(i) fires as each begins.
export function speak(chunks, { rate = 0.9, accent = "en-US", onChunk, onDone } = {}) {
  if (!ttsAvailable) return false;
  const list = Array.isArray(chunks) ? chunks : [chunks];
  window.speechSynthesis.cancel();
  const voice = pickVoice(accent);
  list.forEach((text, i) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = accent;
    if (voice) u.voice = voice;
    u.rate = rate;
    u.onstart = () => onChunk && onChunk(i);
    if (i === list.length - 1) u.onend = () => onDone && onDone();
    window.speechSynthesis.speak(u);
  });
  return true;
}

export function sentences(text) {
  return String(text || "").match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) || [];
}
