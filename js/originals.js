// Magazine article texts. They are NOT in this public repo: they live in the teacher's Google Sheet
// ("Originals" tab) and are fetched only for a logged-in student, kept in memory, and dropped on logout.
import { call, cloudEnabled } from "./api.js";
import { getAuth } from "./store.js";

let data = null;
let loading = null;

export async function loadOriginals() {
  const token = getAuth()?.token;
  if (!cloudEnabled || !token) return {};
  if (data) return data;
  if (!loading) {
    loading = call("originals", { token })
      .then((res) => { data = res.originals || {}; return data; })
      .catch(() => { loading = null; return {}; });
  }
  return loading;
}

export function clearOriginals() {
  data = null;
  loading = null;
}
