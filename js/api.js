// Calls the Google Apps Script backend. text/plain avoids a CORS preflight, which Apps Script cannot answer.
import { API_URL } from "./config.js";

export const cloudEnabled = Boolean(API_URL);

export const ERRORS = {
  invalid: "學號或密碼不正確。",
  locked: "登入失敗太多次，請 10 分鐘後再試，或請老師協助。",
  unauthorized: "登入已過期，請重新登入。",
  weak_password: "新密碼至少要 6 個字。",
  same_as_id: "新密碼不能和學號一樣。",
  wrong_password: "目前的密碼不正確。",
  network: "連不上雲端，請檢查網路後再試一次。",
  server_error: "雲端暫時出了點問題，請稍後再試。",
};

export function errorMessage(err) {
  return ERRORS[err?.code] || ERRORS.server_error;
}

export async function call(action, payload = {}, { timeout = 25000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...payload }),
      redirect: "follow",
      signal: ctrl.signal,
    });
  } catch {
    const err = new Error("network");
    err.code = "network";
    throw err;
  } finally {
    clearTimeout(timer);
  }
  let data;
  try {
    data = await res.json();
  } catch {
    const err = new Error("server_error");
    err.code = "server_error";
    throw err;
  }
  if (!data.ok) {
    const err = new Error(data.error || "server_error");
    err.code = data.error || "server_error";
    err.data = data;
    throw err;
  }
  return data;
}
