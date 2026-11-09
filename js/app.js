// App shell: hash router, context loading, navigation.
import { load, getState, update } from "./store.js";
import { applySettings, openSettings } from "./settings.js";
import { findClass, loadCourse, unitRelease } from "./content.js";
import { esc, icon, stopSpeaking } from "./ui.js";
import { renderHome } from "./views/home.js";
import { renderSelect } from "./views/select.js";
import { renderUnits } from "./views/units.js";
import { renderPractice } from "./views/practice.js";
import { renderReport } from "./views/report.js";

load();
applySettings();

const app = document.getElementById("app");

// Allow links like ?class=10A-2026 (QR codes from the teacher).
async function readClassFromURL() {
  const params = new URLSearchParams(location.search);
  const code = params.get("class");
  if (!code) return;
  const cls = await findClass(code).catch(() => null);
  if (cls) {
    update((s) => {
      s.classCode = cls.class_code;
      s.courseId = cls.course_id;
      s.grade = cls.grade;
    });
  }
  params.delete("class");
  const query = params.toString();
  history.replaceState(null, "", location.pathname + (query ? `?${query}` : "") + location.hash);
}

export async function getContext() {
  const state = getState();
  const cls = state.classCode ? await findClass(state.classCode).catch(() => null) : null;
  const courseId = cls?.course_id || state.courseId;
  let course = null;
  let error = null;
  if (courseId) {
    try {
      course = await loadCourse(courseId);
    } catch (err) {
      error = err;
    }
  }
  const isOpen = (unitId) => unitRelease(cls, unitId).open;
  return { state, cls, course, error, isOpen };
}

function renderHeader(ctx) {
  const route = currentRoute().name;
  const link = (href, name, label, ic) =>
    `<a href="${href}" class="nav-link ${route === name ? "is-active" : ""}" ${route === name ? 'aria-current="page"' : ""}>${icon(ic)}<span>${label}</span></a>`;
  const badge = ctx.cls
    ? `<a class="class-badge" href="#/select" title="更換班級">${esc(ctx.cls.class_code)}</a>`
    : ctx.course ? `<a class="class-badge" href="#/select" title="更換課程">${ctx.course.grade?.[0] || ""} 年級</a>` : "";
  document.getElementById("site-header").innerHTML = `
    <a class="brand" href="#/" aria-label="自學大廳 首頁"><span class="brand__mark" aria-hidden="true">Aa</span><span class="brand__text">自學大廳<small>Self-Study Lobby</small></span></a>
    <nav class="top-nav" aria-label="主要導覽">
      ${link("#/", "home", "首頁", "home")}
      ${link("#/units", "units", "單元", "grid")}
      ${link("#/report", "report", "學習紀錄", "chart")}
    </nav>
    <div class="header-actions">
      ${badge}
      <button class="icon-button" type="button" data-open-settings aria-label="閱讀與學習設定">${icon("gear")}</button>
    </div>`;
  document.getElementById("tab-bar").innerHTML = `
    ${link("#/", "home", "首頁", "home")}
    ${link("#/units", "units", "單元", "grid")}
    ${link("#/report", "report", "紀錄", "chart")}
    <button type="button" class="nav-link" data-open-settings>${icon("gear")}<span>設定</span></button>`;
}

function currentRoute() {
  const hash = location.hash.replace(/^#\/?/, "");
  const [name, ...rest] = hash.split("/");
  return { name: name || "home", param: rest.join("/") ? decodeURIComponent(rest.join("/")) : null };
}

let renderToken = 0;
async function router() {
  const token = ++renderToken;
  stopSpeaking();
  const route = currentRoute();
  const ctx = await getContext();
  if (token !== renderToken) return;
  renderHeader(ctx);
  document.body.dataset.route = route.name;

  const needsCourse = ["units", "practice", "report"].includes(route.name);
  if (needsCourse && !ctx.course) {
    location.replace("#/select");
    return;
  }
  const views = { home: renderHome, select: renderSelect, units: renderUnits, practice: renderPractice, report: renderReport };
  const view = views[route.name] || renderHome;
  app.classList.remove("view-enter");
  try {
    await view(app, ctx, route.param);
  } catch (err) {
    console.error(err);
    app.innerHTML = `<section class="page"><div class="card empty"><h1>糟糕，內容載入失敗</h1><p>${esc(err.message)}</p><p class="muted">請確認網路連線，或請老師檢查內容檔案。</p><a class="button" href="#/">回首頁</a></div></section>`;
  }
  if (token !== renderToken) return;
  void app.offsetWidth;
  app.classList.add("view-enter");
  if (route.name !== "practice") window.scrollTo({ top: 0 });
  const heading = app.querySelector("h1");
  if (heading) {
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }
}

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-open-settings]")) openSettings();
});
window.addEventListener("hashchange", router);

readClassFromURL().finally(router);
