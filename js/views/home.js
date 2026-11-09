import { getState, update, streakDays } from "../store.js";
import { esc, icon, skillChip, subSkillLabel, todayISO, formatDate } from "../ui.js";
import { nextSteps, unitProgress, courseAttempts, masteryBy } from "../progress.js";

const GOALS = [
  ["one-set", "完成 1 組練習"],
  ["ten-min", "練習 10 分鐘"],
  ["review", "複習錯題"],
];

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function weekSessions(sessions) {
  const start = new Date();
  start.setDate(start.getDate() - 6);
  const from = todayISO(start);
  return sessions.filter((s) => s.date >= from);
}

export function renderHome(root, ctx) {
  const state = getState();
  const { course, cls, isOpen } = ctx;
  const goalToday = state.goalDate === todayISO() ? state.goal : null;
  const sessions = course ? state.sessions.filter((s) => s.course_id === course.course_id) : state.sessions;
  const week = weekSessions(sessions);
  const unitsDone = course ? course.units.filter((u) => unitProgress(u) === 1).length : 0;
  const attempts = course ? courseAttempts(course.course_id) : [];
  const weakest = Object.entries(masteryBy(attempts, "sub_skill")).filter(([, g]) => g.rate < 0.7).sort((a, b) => a[1].rate - b[1].rate)[0];
  const steps = course ? nextSteps(course, isOpen) : [];
  const recommendation = steps[0];
  const lastRun = state.last && course && course.index.sets.get(state.last.setId);
  const todayMinutes = Math.round(state.sessions.filter((s) => s.date === todayISO()).reduce((t, s) => t + (s.duration || 0), 0) / 60);
  const todaySets = state.sessions.filter((s) => s.date === todayISO()).length;

  const goalDone = goalToday === "one-set" ? todaySets >= 1 : goalToday === "ten-min" ? todayMinutes >= 10 : false;

  const primary = !course
    ? `<a class="button button--lg" href="#/select">開始第一次練習 ${icon("arrowRight")}</a>`
    : lastRun
      ? `<a class="button button--lg" href="#/practice/${encodeURIComponent(lastRun.set_id)}">繼續上次練習 ${icon("arrowRight")}</a>`
      : recommendation
        ? `<a class="button button--lg" href="#/practice/${encodeURIComponent(recommendation.setId)}">開始今日練習 ${icon("arrowRight")}</a>`
        : `<a class="button button--lg" href="#/units">選擇單元 ${icon("arrowRight")}</a>`;

  root.innerHTML = `
    <section class="page">
      <header class="hero">
        <p class="eyebrow">${cls ? `${esc(cls.class_name)}${cls.teacher ? ` · ${esc(cls.teacher)}` : ""}` : course ? esc(course.title) : "高中英文自學練習"}</p>
        <h1>${greeting()}${ctx.auth?.profile?.name ? `，${esc(ctx.auth.profile.name)}` : ""}! Let's practice.</h1>
        <p class="lead">每天 10–15 分鐘，選自己的步調。答錯沒關係，提示會一步一步陪你想。</p>
        <div class="hero__actions">
          ${primary}
          ${ctx.cloud ? "" : `<a class="button button--secondary button--lg" href="#/select">選擇班級／年級</a>`}
        </div>
        ${lastRun ? `<p class="muted small">上次：${esc(lastRun.unit_title)} · ${esc(lastRun.title)}</p>` : ""}
      </header>

      ${course ? `
      <section class="block" aria-labelledby="goal-title">
        <div class="block__head"><h2 id="goal-title">${icon("target")} 今天的小目標</h2>${goalDone ? '<span class="badge badge--success">已達成 ✓</span>' : ""}</div>
        <div class="pill-row" role="radiogroup" aria-label="今天的小目標">
          ${GOALS.map(([key, label]) => `<button type="button" class="pill ${goalToday === key ? "is-selected" : ""}" role="radio" aria-checked="${goalToday === key}" data-goal="${key}">${label}</button>`).join("")}
        </div>
        ${goalToday ? `<p class="muted small">今天已練習 ${todaySets} 組、約 ${todayMinutes} 分鐘。</p>` : ""}
      </section>

      <section class="block" aria-labelledby="summary-title">
        <div class="block__head"><h2 id="summary-title">近期進度</h2><a class="text-link" href="#/report">看完整紀錄 ${icon("arrowRight")}</a></div>
        <div class="stat-grid">
          <div class="stat-card"><span class="stat-card__value">${week.length}</span><span class="stat-card__label">本週練習組數</span></div>
          <div class="stat-card"><span class="stat-card__value">${unitsDone}<small>/${course.units.length}</small></span><span class="stat-card__label">完成單元</span></div>
          <div class="stat-card"><span class="stat-card__value">${streakDays()}</span><span class="stat-card__label">連續學習天數</span></div>
          ${weakest
            ? `<a class="stat-card stat-card--action" href="#/report"><span class="stat-card__value stat-card__value--text">${esc(subSkillLabel(weakest[0]))}</span><span class="stat-card__label">最需要複習</span></a>`
            : `<div class="stat-card"><span class="stat-card__value stat-card__value--text">—</span><span class="stat-card__label">最需要複習</span></div>`}
        </div>
      </section>

      ${recommendation ? `
      <section class="block" aria-labelledby="rec-title">
        <h2 id="rec-title">今日推薦</h2>
        ${(() => {
          const set = course.index.sets.get(recommendation.setId);
          return `<a class="card card--link rec-card" href="#/practice/${encodeURIComponent(recommendation.setId)}">
            <div class="rec-card__meta">${set ? skillChip(set.skill) : ""}<span class="muted small">約 ${set?.estimated_minutes || 10} 分鐘</span></div>
            <h3>${esc(recommendation.title)}</h3>
            <p class="muted">${esc(recommendation.body)}</p>
            <span class="text-link">開始 ${icon("arrowRight")}</span>
          </a>`;
        })()}
      </section>` : ""}
      ` : `
      <section class="block">
        <div class="card empty">
          <h2>先選擇你的班級或年級</h2>
          <p class="muted">有班級代碼（老師會提供，例如 <code>10A-2026</code>）就輸入代碼；沒有的話選擇年級自由練習。</p>
          <a class="button" href="#/select">前往選擇</a>
        </div>
      </section>`}

      <details class="block how-to" ${state.seenIntro ? "" : "open"}>
        <summary><h2>怎麼使用這個網站？</h2></summary>
        <ol class="steps">
          <li><span class="steps__icon">${icon("grid")}</span><div><strong>選單元</strong><p>選擇題組與版本：標準版或支援版（文章較短、句子較簡單）。</p></div></li>
          <li><span class="steps__icon">${icon("bulb")}</span><div><strong>練習與提示</strong><p>卡住時按「提示」，共四階段，由淺到深。用多少提示自己決定。</p></div></li>
          <li><span class="steps__icon">${icon("chart")}</span><div><strong>看回饋與下一步</strong><p>系統會整理錯題與建議，告訴你下一步練什麼。</p></div></li>
        </ol>
      </details>

      <p class="privacy">${icon("lock")} ${ctx.cloud ? "你的學習紀錄會自動存到老師的雲端，換電腦登入也看得到。在公用電腦練習完請記得登出。" : "你的學習紀錄只存在這台裝置的瀏覽器中，不會上傳。需要交給老師時，可在「學習紀錄」頁匯出。"}${state.sessions.length ? ` 最近一次練習：${formatDate(state.sessions[state.sessions.length - 1].date)}` : ""}</p>
    </section>`;

  root.querySelectorAll("[data-goal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      update((s) => { s.goal = btn.dataset.goal; s.goalDate = todayISO(); });
      renderHome(root, ctx);
      root.querySelector(`[data-goal="${btn.dataset.goal}"]`)?.focus();
    });
  });
  root.querySelector(".how-to")?.addEventListener("toggle", () => update((s) => { s.seenIntro = true; }));
}
