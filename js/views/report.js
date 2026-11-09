import { getState, resetAll, streakDays } from "../store.js";
import { esc, icon, SKILLS, subSkillLabel, skillChip, todayISO, formatDate, formatDuration, toast } from "../ui.js";
import { courseAttempts, masteryBy, nextSteps, needsReview, INDEPENDENCE } from "../progress.js";

function encodeRecord(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

function download(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function renderReport(root, ctx) {
  const { course, cls, isOpen } = ctx;
  const state = getState();
  let range = "all";

  function draw() {
    const now = Date.now();
    const cutoff = range === "week" ? now - 7 * 864e5 : range === "today" ? new Date(todayISO() + "T00:00:00").getTime() : 0;
    const attempts = courseAttempts(course.course_id).filter((a) => a.ts >= cutoff);
    const sessions = state.sessions.filter((s) => s.course_id === course.course_id && s.ts >= cutoff);
    const score = attempts.reduce((t, a) => t + (a.score || 0), 0);
    const max = attempts.reduce((t, a) => t + (a.max || 0), 0);
    const objective = attempts.filter((a) => a.skill !== "writing");
    const accuracy = objective.length ? Math.round((objective.filter((a) => a.correct).length / objective.length) * 100) : null;
    const independentRate = attempts.length ? Math.round((attempts.filter((a) => a.independence === "independent" || a.independence === "self-corrected").length / attempts.length) * 100) : null;
    const time = sessions.reduce((t, s) => t + (s.duration || 0), 0);
    const bySkill = masteryBy(attempts, "skill");
    const review = attempts.filter(needsReview);
    const reviewGroups = {};
    review.forEach((a) => { (reviewGroups[a.sub_skill] ||= []).push(a); });
    const steps = nextSteps(course, isOpen);

    // 28-day activity
    const days = [];
    for (let i = 27; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = todayISO(d);
      const count = state.sessions.filter((s) => s.date === iso).length;
      days.push({ iso, count });
    }
    const hintTrend = state.sessions.filter((s) => s.course_id === course.course_id).slice(-8);

    root.innerHTML = `
      <section class="page">
        <header class="page-head page-head--row">
          <div>
            <p class="eyebrow">${esc(course.title)}${cls ? ` · ${esc(cls.class_name)}` : ""}</p>
            <h1>學習紀錄</h1>
          </div>
          <div class="segmented" role="radiogroup" aria-label="時間範圍">
            ${[["today", "今天"], ["week", "本週"], ["all", "全部"]].map(([v, t]) => `<label class="segmented__item"><input type="radio" name="range" value="${v}" ${range === v ? "checked" : ""} data-range /><span>${t}</span></label>`).join("")}
          </div>
        </header>

        ${!attempts.length ? `
        <div class="card empty">
          <h2>${range === "all" ? "還沒有練習紀錄" : "這段時間還沒有練習"}</h2>
          <p class="muted">完成一組練習後，這裡會出現分數、錯題分析與建議。</p>
          <a class="button" href="#/units">去練習</a>
        </div>` : `
        <section class="block" aria-labelledby="score-title">
          <h2 id="score-title" class="visually-hidden">成績摘要</h2>
          <div class="stat-grid">
            <div class="stat-card stat-card--hero"><span class="stat-card__value">${max ? Math.round((score / max) * 100) : 0}<small>%</small></span><span class="stat-card__label">得分率（${Math.round(score)}/${max} 分）</span></div>
            <div class="stat-card"><span class="stat-card__value">${accuracy ?? "—"}<small>${accuracy != null ? "%" : ""}</small></span><span class="stat-card__label">正確率</span></div>
            <div class="stat-card"><span class="stat-card__value">${independentRate ?? "—"}<small>${independentRate != null ? "%" : ""}</small></span><span class="stat-card__label">獨立完成率</span></div>
            <div class="stat-card"><span class="stat-card__value">${formatDuration(time)}</span><span class="stat-card__label">練習時間 · ${sessions.length} 組</span></div>
          </div>
        </section>

        <section class="block" aria-labelledby="skills-title">
          <div class="block__head"><h2 id="skills-title">技能熟練度</h2><span class="muted small">熟練度＝不靠提示就完成的比例</span></div>
          <div class="card">
            <ul class="bars">
              ${Object.entries(SKILLS).map(([key, s]) => {
                const g = bySkill[key];
                const pct = g ? Math.round(g.rate * 100) : null;
                const label = pct == null ? "尚未練習" : pct >= 80 ? "熟練" : pct >= 50 ? "進步中" : "需要加強";
                return `<li class="bar">
                  <span class="bar__label">${icon(s.icon)} ${s.zh}</span>
                  <span class="bar__track" role="img" aria-label="${s.zh} ${pct == null ? "尚未練習" : `${pct}%，${label}`}"><span class="bar__fill bar__fill--${key}" style="width:${pct || 0}%"></span></span>
                  <span class="bar__value small">${pct == null ? "—" : `${pct}%`} <span class="muted">${label}</span></span>
                </li>`;
              }).join("")}
            </ul>
          </div>
        </section>

        <section class="block" aria-labelledby="review-title">
          <div class="block__head"><h2 id="review-title">錯題與需要複習的題目</h2><span class="muted small">共 ${review.length} 題</span></div>
          ${review.length ? Object.entries(reviewGroups).map(([sub, list]) => `
            <div class="card review-group">
              <div class="review-group__head">
                <div>${skillChip(list[0].skill)} <strong>${esc(subSkillLabel(sub))}</strong> <span class="muted small">${list.length} 題</span></div>
                <a class="button button--secondary button--sm" href="#/practice/${encodeURIComponent(list[0].set_id)}">練習這類題目</a>
              </div>
              <ul class="review-list">
                ${list.map((a) => `<li>
                  <p lang="en">${esc(a.stem)}</p>
                  <p class="small muted">
                    ${a.skill === "writing" ? "寫作任務" : `你的答案：<span lang="en">${esc(a.response || "（未作答）")}</span> · 正確答案：<span lang="en">${esc(a.answer || "")}</span>`}
                    · ${INDEPENDENCE[a.independence]?.mark} ${INDEPENDENCE[a.independence]?.zh}${a.hintLevel ? `（用到第 ${a.hintLevel} 階段提示）` : ""}${a.flagged ? " · 你標記為不確定" : ""}
                  </p>
                </li>`).join("")}
              </ul>
            </div>`).join("") : `<div class="card empty"><p>沒有需要複習的題目，太棒了！</p></div>`}
        </section>

        <section class="block" aria-labelledby="history-title">
          <h2 id="history-title">學習歷程</h2>
          <div class="history-grid">
            <div class="card">
              <h3 class="card-title">近 4 週練習 <span class="muted small">連續 ${streakDays()} 天</span></h3>
              <div class="heatmap" role="img" aria-label="近 28 天中有 ${days.filter((d) => d.count).length} 天有練習">
                ${days.map((d) => `<span class="heatmap__cell heatmap__cell--${Math.min(d.count, 3)}" title="${formatDate(d.iso)}：${d.count} 組"></span>`).join("")}
              </div>
              <p class="muted xsmall">每一格是一天，顏色越深練習越多。</p>
            </div>
            <div class="card">
              <h3 class="card-title">提示使用趨勢 <span class="muted small">最近 ${hintTrend.length} 組</span></h3>
              ${hintTrend.length ? `<div class="trend" role="img" aria-label="最近每組平均使用提示次數：${hintTrend.map((s) => (s.hintsUsed / (s.count || 1)).toFixed(1)).join("、")}">
                ${hintTrend.map((s) => { const avg = s.hintsUsed / (s.count || 1); return `<span class="trend__bar" style="height:${Math.max(6, Math.min(100, (avg / 4) * 100))}%" title="${esc(s.title)}：平均 ${avg.toFixed(1)} 個提示"></span>`; }).join("")}
              </div>
              <p class="muted xsmall">長條越來越短，代表你越來越能獨立完成。</p>` : `<p class="muted">還沒有資料</p>`}
            </div>
          </div>
          <div class="card">
            <h3 class="card-title">最近練習</h3>
            <ul class="session-list">
              ${sessions.slice(-10).reverse().map((s) => `<li>
                <span class="small muted">${formatDate(s.date)}</span>
                ${skillChip(s.skill)}
                <span class="session-list__title">${esc(s.title)}${s.level === "support" ? ' <span class="badge badge--neutral">支援版</span>' : ""}</span>
                <span class="small">${s.score}/${s.max}</span>
              </li>`).join("") || `<li class="muted">這段時間沒有完成的題組</li>`}
            </ul>
          </div>
        </section>`}

        <section class="block" aria-labelledby="next-title">
          <h2 id="next-title">建議下一步</h2>
          <div class="next-grid">
            ${steps.map((s) => `<a class="card card--link next-card" href="#/practice/${encodeURIComponent(s.setId)}">
              <strong>${esc(s.title)}</strong><p class="muted small">${esc(s.body)}</p><span class="text-link">開始 ${icon("arrowRight")}</span></a>`).join("") || `<p class="muted">老師開放新單元後，這裡會出現建議。</p>`}
          </div>
        </section>

        ${ctx.cloud ? `
        <section class="block" aria-labelledby="export-title">
          <h2 id="export-title">雲端紀錄</h2>
          <div class="card export">
            <p class="muted small">${icon("check")} 你的練習會自動存到老師的雲端試算表，老師可以直接看到，不用另外繳交。換電腦登入，紀錄也會跟著你。</p>
            <button type="button" class="button button--secondary" data-export-json>${icon("download")}<span>下載我的紀錄（JSON）</span></button>
          </div>
        </section>` : `
        <section class="block" aria-labelledby="export-title">
          <h2 id="export-title">匯出給老師</h2>
          <div class="card export">
            <p class="muted small">紀錄只存在這台裝置。需要交給老師時，下載檔案或複製「學習紀錄碼」貼到 Google Classroom／表單。</p>
            <label for="alias" class="small"><strong>座號或暱稱</strong>（請勿填真實姓名）</label>
            <input id="alias" type="text" maxlength="20" placeholder="例如 10A-23" class="text-input" />
            <div class="q-actions">
              <button type="button" class="button" data-export-json>${icon("download")}<span>下載 JSON</span></button>
              <button type="button" class="button button--secondary" data-export-code>${icon("copy")}<span>複製學習紀錄碼</span></button>
            </div>
            <textarea class="record-code" readonly rows="3" hidden aria-label="學習紀錄碼"></textarea>
            <button type="button" class="text-link text-link--danger" data-reset>清除這台裝置上的所有紀錄</button>
          </div>
        </section>`}
      </section>`;

    root.querySelectorAll("[data-range]").forEach((r) => r.addEventListener("change", () => {
      range = r.value;
      draw();
      root.querySelector(`[data-range][value="${range}"]`)?.focus();
    }));

    const payload = () => {
      const alias = ctx.auth?.profile?.student_id || root.querySelector("#alias")?.value.trim() || "";
      const all = courseAttempts(course.course_id);
      return {
        v: 1, alias, class_code: cls?.class_code || null, course_id: course.course_id, exported_at: new Date().toISOString(),
        sessions: state.sessions.filter((s) => s.course_id === course.course_id).map(({ set_id, date, score, max, count, independent, hintsUsed, duration, level, reflection }) => ({ set_id, date, score, max, count, independent, hintsUsed, duration, level, reflection })),
        attempts: all.map(({ question_id, sub_skill, correct, tries, hintLevel, independence, score, max, level, flagged, date }) => ({ question_id, sub_skill, correct, tries, hintLevel, independence, score, max, level, flagged, date })),
      };
    };
    root.querySelector("[data-export-json]")?.addEventListener("click", () => {
      const data = payload();
      download(`learning-record-${data.alias || "student"}-${todayISO()}.json`, JSON.stringify(data, null, 2));
    });
    root.querySelector("[data-export-code]")?.addEventListener("click", async () => {
      const code = encodeRecord(payload());
      const box = root.querySelector(".record-code");
      box.hidden = false;
      box.value = code;
      try {
        await navigator.clipboard.writeText(code);
        toast("已複製學習紀錄碼");
      } catch {
        box.select();
        toast("請手動複製下方的紀錄碼");
      }
    });
    root.querySelector("[data-reset]")?.addEventListener("click", () => {
      if (confirm("確定要清除這台裝置上的所有學習紀錄嗎？這個動作無法復原。（閱讀設定會保留）")) {
        resetAll();
        toast("已清除紀錄");
        location.hash = "#/";
      }
    });
  }

  draw();
}
