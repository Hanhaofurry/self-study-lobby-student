// App shell: hash router, context loading, navigation, login gate.
import { load, getState, update, getAuth, isLoggedIn, mustChangePassword, logout, pull, onSyncStatus, getSyncStatus } from "./store.js";
import { cloudEnabled } from "./api.js";
import { applySettings, openSettings } from "./settings.js";
import { findClass, loadCourse, unitRelease } from "./content.js";
import { esc, icon, stopSpeaking, toast } from "./ui.js";
import { renderHome } from "./views/home.js";
import { renderSelect } from "./views/select.js";
import { renderUnits } from "./views/units.js";
import { renderPractice } from "./views/practice.js";
import { renderReport } from "./views/report.js";
import { renderLogin, renderPassword } from "./views/login.js";

load();
applySettings();

const app = document.getElementById("app");

// Local mode only: links like ?class=10A-2026 (QR codes from the teacher).
async function readClassFromURL() {
  const params = new URLSearchParams(location.search);
  const code = params.get("class");
  if (!code) return;
  if (!cloudEnabled) {
    const cls = await findClass(code).catch(() => null);
    if (cls) {
      update((s) => {
        s.classCode = cls.class_code;
        s.courseId = cls.course_id;
        s.grade = cls.grade;
      });
    }
  }
  params.delete("class");
  const query = params.toString();
  history.replaceState(null, "", location.pathname + (query ? `?${query}` : "") + location.hash);
}

// The class settings from the teacher's Google Sheet, in the same shape as content/classes.json.
function cloudClass() {
  const c = getAuth()?.profile?.class;
  if (!c) return null;
  return {
    ...c,
    teacher: c.teacher || "",
    hint_policy: { max_level: Number.isFinite(c.hint_max) ? c.hint_max : 4 },
    released_units: Array.isArray(c.released_units) ? c.released_units.map((id) => ({ unit_id: id })) : null,
  };
}

export async function getContext() {
  const state = getState();
  let cls = null;
  if (cloudEnabled) cls = cloudClass();
  else if (state.classCode) cls = await findClass(state.classCode).catch(() => null);
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
  return { state, cls, course, error, isOpen, auth: getAuth(), cloud: cloudEnabled };
}

const SYNC_LABEL = {
  idle: "", pending: "等待同步", syncing: "同步中…", saved: "已存到雲端", offline: "離線，稍後重試", unauthorized: "請重新登入",
};

function syncBadge() {
  if (!cloudEnabled || !isLoggedIn()) return "";
  const s = getSyncStatus();
  return `<span class="sync sync--${s}" data-sync role="status" title="${SYNC_LABEL[s] || ""}">${icon(s === "offline" ? "retry" : "check")}<span>${SYNC_LABEL[s] || "雲端紀錄"}</span></span>`;
}

function renderHeader(ctx) {
  const route = currentRoute().name;
  const gate = cloudEnabled && (!isLoggedIn() || mustChangePassword());
  const link = (href, name, label, ic) =>
    `<a href="${href}" class="nav-link ${route === name ? "is-active" : ""}" ${route === name ? 'aria-current="page"' : ""}>${icon(ic)}<span>${label}</span></a>`;
  const profile = ctx.auth?.profile;
  const badge = cloudEnabled
    ? (profile ? `<a class="class-badge" href="#/select" title="我的帳號">${esc(profile.name || profile.student_id)}</a>` : "")
    : ctx.cls
      ? `<a class="class-badge" href="#/select" title="更換班級">${esc(ctx.cls.class_code)}</a>`
      : ctx.course ? `<a class="class-badge" href="#/select" title="更換課程">${ctx.course.grade?.[0] || ""} 年級</a>` : "";
  document.getElementById("site-header").innerHTML = `
    <a class="brand" href="#/" aria-label="自學大廳 首頁"><span class="brand__mark" aria-hidden="true">Aa</span><span class="brand__text">自學大廳<small>Self-Study Lobby</small></span></a>
    ${gate ? "" : `<nav class="top-nav" aria-label="主要導覽">
      ${link("#/", "home", "首頁", "home")}
      ${link("#/units", "units", "單元", "grid")}
      ${link("#/report", "report", "學習紀錄", "chart")}
    </nav>`}
    <div class="header-actions">
      ${gate ? "" : syncBadge()}
      ${gate ? "" : badge}
      ${cloudEnabled && isLoggedIn() ? `<button class="button button--secondary button--sm" type="button" data-logout>登出</button>` : ""}
      <button class="icon-button" type="button" data-open-settings aria-label="閱讀與學習設定">${icon("gear")}</button>
    </div>`;
  document.getElementById("tab-bar").innerHTML = gate ? "" : `
    ${link("#/", "home", "首頁", "home")}
    ${link("#/units", "units", "單元", "grid")}
    ${link("#/report", "report", "紀錄", "chart")}
    <button type="button" class="nav-link" data-open-settings>${icon("gear")}<span>設定</span></button>`;
  document.body.classList.toggle("is-gated", gate);
}

onSyncStatus(() => {
  const el = document.querySelector("[data-sync]");
  if (el) el.outerHTML = syncBadge();
});

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

  // Login gate (cloud mode): login → (first time) set password → site.
  if (cloudEnabled) {
    if (!isLoggedIn() && route.name !== "login") return location.replace("#/login");
    if (isLoggedIn() && route.name === "login") return location.replace("#/");
    if (isLoggedIn() && mustChangePassword() && route.name !== "password") return location.replace("#/password");
  } else if (route.name === "login" || route.name === "password") {
    return location.replace("#/");
  }

  const ctx = await getContext();
  if (token !== renderToken) return;
  renderHeader(ctx);
  document.body.dataset.route = route.name;

  const needsCourse = ["units", "practice", "report"].includes(route.name);
  if (needsCourse && !ctx.course) {
    location.replace("#/select");
    return;
  }
  const views = {
    home: renderHome, select: renderSelect, units: renderUnits, practice: renderPractice, report: renderReport,
    login: renderLogin, password: renderPassword,
  };
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
  if (route.name !== "login" && route.name !== "password") {
    const heading = app.querySelector("h1");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
  }
}

document.addEventListener("click", async (event) => {
  if (event.target.closest("[data-open-settings]")) openSettings();
  const out = event.target.closest("[data-logout]");
  if (out) {
    out.disabled = true;
    out.textContent = "登出中…";
    await logout();
    toast("已登出");
    location.hash = "#/login";
  }
});

document.addEventListener("auth-expired", async () => {
  await logout();
  toast("登入已過期，請重新登入");
  location.hash = "#/login";
});

window.addEventListener("hashchange", router);

readClassFromURL().finally(async () => {
  await router();
  // Bring in practice done on another device, then refresh the view if anything changed.
  if (cloudEnabled && isLoggedIn() && !mustChangePassword()) {
    const changed = await pull();
    if (changed && currentRoute().name !== "practice") router();
  }
});
