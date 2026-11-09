import { getState, update } from "../store.js";
import { unitRelease, setHasSupport } from "../content.js";
import { esc, icon, SKILLS, skillChip, formatDate } from "../ui.js";
import { setStatus, STATUS, unitProgress, recommendedLevel } from "../progress.js";

let filters = { skills: new Set(), status: "all", query: "" };
let expanded = new Set();

function ring(value) {
  const pct = Math.round(value * 100);
  const r = 26;
  const c = 2 * Math.PI * r;
  return `<div class="ring" role="img" aria-label="整體完成度 ${pct}%">
    <svg viewBox="0 0 64 64" aria-hidden="true"><circle class="ring__track" cx="32" cy="32" r="${r}"/><circle class="ring__value" cx="32" cy="32" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - value)}"/></svg>
    <span>${pct}%</span></div>`;
}

function dokRange(course, set) {
  const doks = set.question_ids.map((id) => course.index.questions.get(id)?.dok).filter(Boolean);
  if (!doks.length) return "";
  const min = Math.min(...doks);
  const max = Math.max(...doks);
  return min === max ? `DOK ${min}` : `DOK ${min}–${max}`;
}

export function renderUnits(root, ctx) {
  const { course, cls } = ctx;
  const state = getState();
  const allowSwitch = cls ? cls.allow_level_switch !== false : true;
  const allUnits = course.units;
  const overall = allUnits.reduce((t, u) => t + unitProgress(u), 0) / (allUnits.length || 1);

  function matches(set) {
    if (filters.skills.size && !filters.skills.has(set.skill)) return false;
    if (filters.status !== "all" && setStatus(set) !== filters.status) return false;
    if (filters.query) {
      const q = filters.query.toLowerCase();
      const unit = allUnits.find((u) => u.unit_id === set.unit_id);
      const hay = `${set.title} ${unit?.title} ${unit?.title_zh} ${unit?.topic} ${(unit?.tags || []).join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function setRow(set) {
    const status = setStatus(set);
    const hasSupport = setHasSupport(course, set);
    const rec = recommendedLevel(set.set_id, cls);
    const level = state.levelPref[set.set_id] || (hasSupport ? rec.level : "standard");
    const levelControl = hasSupport && allowSwitch
      ? `<div class="segmented segmented--sm" role="radiogroup" aria-label="${esc(set.title)} 版本">
          ${[["standard", "標準版"], ["support", "支援版"]].map(([v, t]) => `
            <label class="segmented__item"><input type="radio" name="lvl-${esc(set.set_id)}" value="${v}" data-level-for="${esc(set.set_id)}" ${level === v ? "checked" : ""}/><span>${t}</span></label>`).join("")}
        </div>
        ${!state.levelPref[set.set_id] ? `<span class="muted xsmall">${esc(rec.why)}</span>` : ""}`
      : hasSupport ? `<span class="muted xsmall">版本：${level === "support" ? "支援版" : "標準版"}（老師設定）</span>` : "";
    return `
      <li class="set-row">
        <span class="set-row__icon set-row__icon--${esc(set.skill)}">${icon(SKILLS[set.skill]?.icon || "spark")}</span>
        <div class="set-row__body">
          <strong>${esc(set.title)}</strong>
          <span class="muted small">${SKILLS[set.skill]?.zh || ""} · ${set.question_ids.length} 題 · 約 ${set.estimated_minutes || 10} 分鐘 · ${dokRange(course, set)}</span>
          <div class="set-row__level">${levelControl}</div>
        </div>
        <span class="badge badge--${STATUS[status].cls}">${STATUS[status].zh}</span>
        <a class="button button--sm" href="#/practice/${encodeURIComponent(set.set_id)}" aria-label="開始 ${esc(set.title)}">${status === "in-progress" ? "繼續" : status === "not-started" ? "開始" : "再練"}</a>
      </li>`;
  }

  function unitCard(unit) {
    const rel = unitRelease(cls, unit.unit_id);
    const progress = unitProgress(unit);
    const sets = unit.sets.filter(matches);
    if (!sets.length && (filters.skills.size || filters.status !== "all" || filters.query)) return "";
    const statuses = unit.sets.map(setStatus);
    const overallStatus = !rel.open ? null
      : statuses.every((s) => s === "done") ? "done"
      : statuses.includes("review") && statuses.every((s) => s === "done" || s === "review") ? "review"
      : statuses.some((s) => s !== "not-started") ? "in-progress" : "not-started";
    const isOpen = expanded.has(unit.unit_id);
    const minutes = unit.sets.reduce((t, s) => t + (s.estimated_minutes || 10), 0);
    return `
      <article class="unit-card ${rel.open ? "" : "is-locked"}">
        <button class="unit-card__head" type="button" ${rel.open ? `aria-expanded="${isOpen}" aria-controls="sets-${esc(unit.unit_id)}" data-toggle="${esc(unit.unit_id)}"` : 'aria-disabled="true"'}>
          <span class="unit-card__num">Unit ${unit.order}</span>
          <span class="unit-card__title">${esc(unit.title)}<small>${esc(unit.title_zh || "")}</small></span>
          <span class="unit-card__meta muted small">${unit.sets.length} 組 · 約 ${minutes} 分鐘${rel.dueDate ? ` · 截止 ${formatDate(rel.dueDate)}` : ""}</span>
          <span class="progress" aria-label="完成 ${Math.round(progress * 100)}%"><span style="width:${Math.round(progress * 100)}%"></span></span>
          <span class="unit-card__status">
            ${rel.open ? `<span class="badge badge--${STATUS[overallStatus].cls}">${STATUS[overallStatus].zh}</span>` : `<span class="badge badge--neutral">${icon("lock")} ${esc(rel.reason)}</span>`}
            ${rel.open ? `<span class="chevron" aria-hidden="true">${icon("arrowRight")}</span>` : ""}
          </span>
        </button>
        ${rel.open ? `
        <div class="unit-card__sets" id="sets-${esc(unit.unit_id)}" ${isOpen ? "" : "hidden"}>
          <ul class="objectives">${(unit.objectives || []).map((o) => `<li>${esc(o)}</li>`).join("")}</ul>
          <ul class="set-list">${(sets.length ? sets : unit.sets).map(setRow).join("")}</ul>
        </div>` : ""}
      </article>`;
  }

  function draw() {
    const cards = allUnits.map(unitCard).join("");
    root.innerHTML = `
      <section class="page">
        <header class="course-head">
          <div>
            <p class="eyebrow">${cls ? `${esc(cls.class_name)} · ${esc(cls.teacher)}` : "自由練習"} · ${course.grade.join("、")} 年級</p>
            <h1>${esc(course.title)}</h1>
            <a class="text-link" href="#/select">更換班級／課程</a>
          </div>
          ${ring(overall)}
        </header>

        <div class="filter-bar" role="search">
          <div class="pill-row" role="group" aria-label="依技能篩選">
            ${Object.entries(SKILLS).map(([key, s]) => `<button type="button" class="pill ${filters.skills.has(key) ? "is-selected" : ""}" aria-pressed="${filters.skills.has(key)}" data-skill="${key}">${icon(s.icon)}<span>${s.zh}</span></button>`).join("")}
          </div>
          <div class="filter-bar__row">
            <label class="select"><span class="visually-hidden">狀態</span>
              <select data-status>
                <option value="all">全部狀態</option>
                ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${filters.status === k ? "selected" : ""}>${v.zh}</option>`).join("")}
              </select>
            </label>
            <label class="search"><span class="visually-hidden">搜尋單元或標籤</span>
              <input type="search" placeholder="搜尋主題或標籤，例如 technology" value="${esc(filters.query)}" data-query />
            </label>
          </div>
        </div>

        <div class="unit-list">${cards || `<div class="card empty"><p>目前沒有符合的單元，試試清除篩選。</p><button class="button button--secondary" type="button" data-clear>清除篩選</button></div>`}</div>
      </section>`;
    bind();
  }

  function bind() {
    root.querySelectorAll("[data-toggle]").forEach((btn) => btn.addEventListener("click", () => {
      const id = btn.dataset.toggle;
      const panel = root.querySelector(`#sets-${CSS.escape(id)}`);
      const open = btn.getAttribute("aria-expanded") !== "true";
      btn.setAttribute("aria-expanded", String(open));
      panel.hidden = !open;
      if (open) expanded.add(id); else expanded.delete(id);
    }));
    root.querySelectorAll("[data-skill]").forEach((btn) => btn.addEventListener("click", () => {
      const key = btn.dataset.skill;
      if (filters.skills.has(key)) filters.skills.delete(key); else filters.skills.add(key);
      allUnits.forEach((u) => expanded.add(u.unit_id));
      draw();
      root.querySelector(`[data-skill="${key}"]`)?.focus();
    }));
    root.querySelector("[data-status]").addEventListener("change", (e) => {
      filters.status = e.target.value;
      allUnits.forEach((u) => expanded.add(u.unit_id));
      draw();
      root.querySelector("[data-status]").focus();
    });
    const q = root.querySelector("[data-query]");
    q.addEventListener("input", () => {
      filters.query = q.value.trim();
      const pos = q.selectionStart;
      draw();
      const nq = root.querySelector("[data-query]");
      nq.focus();
      nq.setSelectionRange(pos, pos);
    });
    root.querySelector("[data-clear]")?.addEventListener("click", () => {
      filters = { skills: new Set(), status: "all", query: "" };
      draw();
    });
    root.querySelectorAll("[data-level-for]").forEach((input) => input.addEventListener("change", () => {
      update((s) => { s.levelPref[input.dataset.levelFor] = input.value; });
    }));
  }

  // Expand the first open unit with unfinished work by default.
  if (!expanded.size) {
    const first = allUnits.find((u) => unitRelease(cls, u.unit_id).open && unitProgress(u) < 1) || allUnits[0];
    if (first) expanded.add(first.unit_id);
  }
  draw();
}
