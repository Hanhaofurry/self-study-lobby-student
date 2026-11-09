import { call, errorMessage } from "../api.js";
import { setSession, getAuth, passwordChanged, mustChangePassword } from "../store.js";
import { esc, icon, toast } from "../ui.js";

export function renderLogin(root) {
  root.innerHTML = `
    <section class="page page--narrow auth-page">
      <div class="auth-card card">
        <span class="brand__mark brand__mark--lg" aria-hidden="true">Aa</span>
        <h1>登入自學大廳</h1>
        <p class="muted">用你的學號登入。第一次登入的密碼也是學號。</p>
        <form class="auth-form" novalidate>
          <label for="login-id">學號</label>
          <input id="login-id" class="text-input" name="id" inputmode="numeric" autocomplete="username" autocapitalize="off" spellcheck="false" required />
          <label for="login-pw">密碼</label>
          <div class="pw-field">
            <input id="login-pw" class="text-input" name="password" type="password" autocomplete="current-password" required />
            <button type="button" class="text-link pw-toggle" data-toggle-pw aria-pressed="false">顯示</button>
          </div>
          <p class="form-msg form-msg--warn" id="login-msg" aria-live="polite"></p>
          <button class="button button--lg button--block" type="submit">登入 ${icon("arrowRight")}</button>
        </form>
        <p class="muted small">${icon("lock")} 忘記密碼請找老師重設。在學校公用電腦練習完，記得按右上角「登出」。</p>
      </div>
    </section>`;

  const form = root.querySelector("form");
  const msg = root.querySelector("#login-msg");
  const pw = root.querySelector("#login-pw");
  root.querySelector("[data-toggle-pw]").addEventListener("click", (e) => {
    const show = pw.type === "password";
    pw.type = show ? "text" : "password";
    e.currentTarget.textContent = show ? "隱藏" : "顯示";
    e.currentTarget.setAttribute("aria-pressed", String(show));
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = form.id.value.trim();
    const password = form.password.value;
    if (!id || !password) {
      msg.textContent = "請輸入學號和密碼。";
      (id ? pw : form.id).focus();
      return;
    }
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner spinner--sm" aria-hidden="true"></span> 登入中…`;
    msg.textContent = "";
    try {
      const res = await call("login", { id, password });
      setSession(res);
      toast(`歡迎，${res.profile.name || res.profile.student_id}！`);
      location.hash = res.mustChange ? "#/password" : "#/";
    } catch (err) {
      msg.textContent = errorMessage(err);
      btn.disabled = false;
      btn.innerHTML = `登入 ${icon("arrowRight")}`;
      pw.select();
      pw.focus();
    }
  });
  root.querySelector("#login-id").focus();
}

export function renderPassword(root) {
  const auth = getAuth();
  const forced = mustChangePassword();
  root.innerHTML = `
    <section class="page page--narrow auth-page">
      <div class="auth-card card">
        ${forced ? "" : `<a class="back-link" href="#/">${icon("arrowLeft")} 首頁</a>`}
        <h1>${forced ? "請設定你自己的密碼" : "修改密碼"}</h1>
        <p class="muted">${forced ? "目前的密碼是學號，同學也可能知道。設定新密碼後，只有你能看到自己的學習紀錄。" : "新密碼至少 6 個字，不能和學號相同。"}</p>
        <p class="small"><strong>${esc(auth?.profile?.name || "")}</strong> <span class="muted">${esc(auth?.profile?.class?.class_name || "")} ${auth?.profile?.seat ? `${esc(auth.profile.seat)} 號` : ""}</span></p>
        <form class="auth-form" novalidate>
          <label for="pw-old">目前的密碼${forced ? "（學號）" : ""}</label>
          <input id="pw-old" class="text-input" type="password" autocomplete="current-password" required />
          <label for="pw-new">新密碼（至少 6 個字）</label>
          <input id="pw-new" class="text-input" type="password" autocomplete="new-password" minlength="6" required />
          <label for="pw-new2">再輸入一次新密碼</label>
          <input id="pw-new2" class="text-input" type="password" autocomplete="new-password" required />
          <label class="check-line"><input type="checkbox" data-show /> 顯示密碼</label>
          <p class="form-msg form-msg--warn" id="pw-msg" aria-live="polite"></p>
          <button class="button button--lg button--block" type="submit">儲存新密碼</button>
        </form>
      </div>
    </section>`;

  const form = root.querySelector("form");
  const msg = root.querySelector("#pw-msg");
  const [oldEl, newEl, new2El] = ["#pw-old", "#pw-new", "#pw-new2"].map((s) => root.querySelector(s));
  root.querySelector("[data-show]").addEventListener("change", (e) => {
    [oldEl, newEl, new2El].forEach((el) => { el.type = e.target.checked ? "text" : "password"; });
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const next = newEl.value;
    if (next.length < 6) { msg.textContent = "新密碼至少要 6 個字。"; newEl.focus(); return; }
    if (next === auth?.profile?.student_id) { msg.textContent = "新密碼不能和學號一樣。"; newEl.focus(); return; }
    if (next !== new2El.value) { msg.textContent = "兩次輸入的新密碼不一樣。"; new2El.focus(); return; }
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "儲存中…";
    try {
      await call("changePassword", { token: auth.token, oldPassword: oldEl.value, newPassword: next });
      passwordChanged();
      toast("密碼已更新");
      location.hash = "#/";
    } catch (err) {
      msg.textContent = errorMessage(err);
      btn.disabled = false;
      btn.textContent = "儲存新密碼";
      if (err.code === "wrong_password") oldEl.focus();
    }
  });
  oldEl.focus();
}
