import { getState, update } from "../store.js";
import { loadCatalog, findClass } from "../content.js";
import { esc, icon, toast } from "../ui.js";

const GRADES = [
  { grade: 10, label: "十年級", sub: "高一", length: "文章約 300–450 字", lexile: "900L–1100L" },
  { grade: 11, label: "十一年級", sub: "高二", length: "文章約 400–550 字", lexile: "950L–1150L" },
  { grade: 12, label: "十二年級", sub: "高三", length: "文章約 450–650 字", lexile: "1000L–1200L" },
];

export async function renderSelect(root, ctx) {
  const catalog = await loadCatalog();
  const state = getState();
  let grade = state.grade || ctx.course?.grade?.[0] || 10;
  let courseId = state.courseId;

  function coursesFor(g) {
    return catalog.courses.filter((c) => c.grade.includes(g));
  }

  function draw(message = "") {
    const courses = coursesFor(grade);
    if (!courses.some((c) => c.course_id === courseId)) courseId = courses[0]?.course_id || null;
    root.innerHTML = `
      <section class="page page--narrow">
        <header class="page-head">
          <a class="back-link" href="#/">${icon("arrowLeft")} 首頁</a>
          <h1>選擇你的班級或年級</h1>
          <p class="muted">有老師給的班級代碼，請先輸入代碼；沒有的話可以直接選年級自由練習。</p>
        </header>

        ${ctx.cls ? `
        <div class="card success-card" role="status">
          ${icon("check")}
          <div><strong>你已加入 ${esc(ctx.cls.class_name)}（${esc(ctx.cls.teacher)}）</strong><p class="muted small">班級代碼 ${esc(ctx.cls.class_code)} · ${esc(ctx.course?.title || "")}</p></div>
          <a class="button" href="#/units">進入課程</a>
        </div>` : ""}

        <form class="card code-form" novalidate>
          <label for="class-code"><strong>班級代碼</strong></label>
          <div class="code-form__row">
            <input id="class-code" name="code" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="例如 10A-2026" value="${esc(ctx.cls?.class_code || "")}" aria-describedby="code-help code-msg" />
            <button class="button" type="submit">加入</button>
          </div>
          <p id="code-help" class="muted small">代碼不分大小寫。範例：10A-2026、V1-2026、11B-2026、12C-2026</p>
          <p id="code-msg" class="form-msg" aria-live="polite">${message}</p>
          ${ctx.cls ? `<button type="button" class="text-link" data-leave>改用自由練習（離開班級）</button>` : ""}
        </form>

        <div class="divider"><span>或選擇年級</span></div>

        <div class="grade-grid" role="radiogroup" aria-label="年級">
          ${GRADES.map((g) => `
            <button type="button" class="grade-card ${grade === g.grade ? "is-selected" : ""}" role="radio" aria-checked="${grade === g.grade}" data-grade="${g.grade}">
              <span class="grade-card__num">${g.grade}</span>
              <span class="grade-card__label">${g.label}<small>${g.sub}</small></span>
              <span class="muted small">${coursesFor(g.grade).length} 門課程 · ${g.length}</span>
            </button>`).join("")}
        </div>

        <fieldset class="course-list">
          <legend>課程</legend>
          ${courses.length ? courses.map((c) => `
            <label class="course-option">
              <input type="radio" name="course" value="${esc(c.course_id)}" ${c.course_id === courseId ? "checked" : ""} />
              <span><strong>${esc(c.title)}</strong><span class="muted small">${esc(c.description || "")}${c.track === "vocational" ? " · 高職" : ""}</span></span>
            </label>`).join("") : `<p class="muted">這個年級目前還沒有課程。</p>`}
        </fieldset>

        <button class="button button--lg button--block" type="button" data-enter ${courseId ? "" : "disabled"}>${ctx.cls ? "以自由練習進入" : "進入課程"} ${icon("arrowRight")}</button>
      </section>`;

    root.querySelector(".code-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = root.querySelector("#class-code");
      const code = input.value.trim();
      const msg = root.querySelector("#code-msg");
      if (!code) {
        msg.textContent = "請先輸入班級代碼。";
        input.focus();
        return;
      }
      const cls = await findClass(code);
      if (!cls) {
        msg.textContent = "找不到這個代碼，請確認拼字或詢問老師。";
        msg.className = "form-msg form-msg--warn";
        input.focus();
        return;
      }
      update((s) => { s.classCode = cls.class_code; s.courseId = cls.course_id; s.grade = cls.grade; });
      toast(`已加入 ${cls.class_name}`);
      location.hash = "#/units";
    });
    root.querySelector("[data-leave]")?.addEventListener("click", () => {
      update((s) => { s.classCode = null; });
      location.hash = "#/select";
      toast("已離開班級，改為自由練習");
      setTimeout(() => location.reload(), 50);
    });
    root.querySelectorAll("[data-grade]").forEach((btn) => btn.addEventListener("click", () => {
      grade = Number(btn.dataset.grade);
      draw();
      root.querySelector(`[data-grade="${grade}"]`)?.focus();
    }));
    root.querySelectorAll('input[name="course"]').forEach((r) => r.addEventListener("change", () => { courseId = r.value; }));
    root.querySelector("[data-enter]").addEventListener("click", () => {
      if (!courseId) return;
      update((s) => { s.classCode = null; s.courseId = courseId; s.grade = grade; });
      location.hash = "#/units";
    });
  }

  draw();
}
