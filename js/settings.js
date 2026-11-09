// Reading & accessibility settings (UDL: multiple means of representation).
import { getState, update } from "./store.js";
import { esc, icon, ttsAvailable, speak } from "./ui.js";

export function applySettings() {
  const s = getState().settings;
  const root = document.documentElement;
  root.dataset.fontSize = s.fontSize;
  root.dataset.line = s.lineHeight;
  root.dataset.font = s.font;
  root.dataset.motion = s.motion;
  if (s.theme === "system") delete root.dataset.theme;
  else root.dataset.theme = s.theme;
}

const GROUPS = [
  { key: "fontSize", label: "字體大小", options: [["sm", "小"], ["md", "標準"], ["lg", "大"], ["xl", "特大"]] },
  { key: "lineHeight", label: "行距", options: [["1.5", "1.5"], ["1.75", "1.75"], ["2", "2.0"]] },
  { key: "font", label: "字型", options: [["system", "系統"], ["hyperlegible", "易讀字型"], ["lexend", "Lexend"]] },
  { key: "theme", label: "外觀", options: [["system", "跟隨系統"], ["light", "淺色"], ["dark", "深色"], ["warm", "暖色護眼"]] },
  { key: "motion", label: "動畫", options: [["system", "標準"], ["reduce", "減少動畫"]] },
  { key: "speechRate", label: "朗讀速度", options: [["0.7", "0.7×"], ["0.85", "0.85×"], ["0.9", "0.9×"], ["1", "1.0×"], ["1.15", "1.15×"]] },
  { key: "accent", label: "朗讀口音", options: [["en-US", "美式"], ["en-GB", "英式"]] },
  { key: "showTimer", label: "顯示計時", options: [["false", "關閉"], ["true", "開啟"]] },
];

function current(key) {
  return String(getState().settings[key]);
}

function renderGroups() {
  return GROUPS.map((g) => `
    <fieldset class="setting-group">
      <legend>${g.label}</legend>
      <div class="segmented" role="radiogroup" aria-label="${g.label}">
        ${g.options.map(([value, text]) => `
          <label class="segmented__item">
            <input type="radio" name="${g.key}" value="${esc(value)}" ${current(g.key) === value ? "checked" : ""} />
            <span>${text}</span>
          </label>`).join("")}
      </div>
    </fieldset>`).join("");
}

export function openSettings() {
  const dialog = document.getElementById("settings-dialog");
  dialog.innerHTML = `
    <form method="dialog" class="sheet">
      <header class="sheet__header">
        <h2>閱讀與學習設定</h2>
        <button class="icon-button" value="close" aria-label="關閉設定">${icon("close")}</button>
      </header>
      <p class="sheet__note">設定會立即套用，並記在這台裝置上。</p>
      <div class="sheet__preview" aria-hidden="true">
        <strong>Preview</strong>
        <p>Many teenagers say they cannot imagine a single day without their phones.</p>
      </div>
      ${renderGroups()}
      <div class="setting-group">
        <span class="legend-like">語音朗讀</span>
        ${ttsAvailable
          ? `<button type="button" class="button button--secondary" data-test-voice>${icon("speaker")}<span>試聽朗讀</span></button>`
          : `<p class="muted">這個瀏覽器不支援語音朗讀；聽力題會自動改用「讀作聽」模式。</p>`}
      </div>
      <div class="setting-group">
        <span class="legend-like">${icon("keyboard")} 鍵盤快捷鍵（練習頁）</span>
        <dl class="shortcuts">
          <div><dt><kbd>A</kbd>–<kbd>D</kbd> / <kbd>1</kbd>–<kbd>4</kbd></dt><dd>選擇選項</dd></div>
          <div><dt><kbd>Enter</kbd></dt><dd>檢查答案</dd></div>
          <div><dt><kbd>H</kbd></dt><dd>下一階段提示</dd></div>
          <div><dt><kbd>R</kbd></dt><dd>朗讀題目</dd></div>
          <div><dt><kbd>N</kbd></dt><dd>下一題</dd></div>
          <div><dt><kbd>Esc</kbd></dt><dd>關閉視窗</dd></div>
        </dl>
      </div>
    </form>`;

  dialog.querySelector("form").addEventListener("change", (event) => {
    const { name, value } = event.target;
    if (!name) return;
    update((s) => {
      let v = value;
      if (name === "speechRate") v = Number(value);
      if (name === "showTimer") v = value === "true";
      s.settings[name] = v;
    });
    applySettings();
    document.dispatchEvent(new CustomEvent("settings-changed"));
  });
  dialog.querySelector("[data-test-voice]")?.addEventListener("click", () => {
    const s = getState().settings;
    speak("Hello! This is how I will read your questions.", { rate: s.speechRate, accent: s.accent });
  });
  dialog.showModal();
}
