/* طبقة اتصال اختيارية بـ Supabase بدون مكتبات خارجية */
window.QuizCloud = (function () {
  "use strict";

  const cfg = window.QUIZ_CONFIG || {};
  const base = String(cfg.supabaseUrl || "").replace(/\/+$/, "");
  const key = cfg.supabaseAnonKey || "";
  const table = cfg.table || "quiz_results";
  const enabled = /^https:\/\/[^/]+$/.test(base) && key.length > 15;
  let accessToken = null;

  function headers(token) {
    const h = { apikey: key, "Content-Type": "application/json" };
    if (token) h.Authorization = "Bearer " + token;
    return h;
  }

  async function request(path, options) {
    const response = await fetch(base + path, options);
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { /* نص غير JSON */ }
    if (!response.ok) {
      const message = (data && (data.message || data.msg || data.error_description)) || ("HTTP " + response.status);
      throw new Error(message);
    }
    return data;
  }

  async function submit(record) {
    if (!enabled) return { ok: false, mode: "local" };
    try {
      await request("/rest/v1/" + table, {
        method: "POST",
        headers: Object.assign(headers(), { Prefer: "return=minimal" }),
        body: JSON.stringify(record)
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async function signIn(email, password) {
    if (!enabled) throw new Error("السيرفر غير مُفعّل");
    const data = await request("/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ email: email, password: password })
    });
    accessToken = data.access_token || null;
    if (!accessToken) throw new Error("ما جاش رموز الدخول");
    return data;
  }

  async function list() {
    if (!enabled) return [];
    return await request("/rest/v1/" + table + "?select=*&order=created_at.desc&limit=500", {
      headers: headers(accessToken)
    });
  }

  async function clearAll() {
    if (!enabled) return;
    await request("/rest/v1/" + table + "?id=gt.00000000-0000-0000-0000-000000000000", {
      method: "DELETE",
      headers: headers(accessToken)
    });
  }

  return {
    enabled: enabled,
    submit: submit,
    signIn: signIn,
    list: list,
    clearAll: clearAll,
    isSignedIn: function () { return !!accessToken; }
  };
})();
