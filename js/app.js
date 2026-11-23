(function () {
  "use strict";

  const BANK = window.QUESTION_BANK || [];
  const KEY_HISTORY = "quiz_history_v1";
  const KEY_DRAFT = "quiz_draft_v1";
  const LETTERS = ["أ", "ب", "ج", "د"];

  const $ = (id) => document.getElementById(id);

  let state = null;          // حالة المحاولة الحالية
  let timerId = null;        // مؤقت العد التنازلي
  let pendingAction = null;  // الإجراء المعلّق بعد تأكيد النافذة
  let toastTimer = null;
  let teacherSource = "local";
  let lastResults = [];

  /* ===================== أدوات مساعدة ===================== */
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function formatTime(totalSeconds) {
    const s = Math.max(0, totalSeconds);
    const mm = Math.floor(s / 60).toString().padStart(2, "0");
    const ss = (s % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function readStore(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* تخزين غير متاح */ }
  }

  function toast(message) {
    const box = $("toast");
    box.textContent = message;
    box.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove("show"), 3200);
  }

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.toggle("active", screen.id === id);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function gradeFor(pct) {
    if (pct >= 90) return { label: "ممتاز", title: "ممتاز! 🎉", msg: "نتيجة رائعة، إنت فاهم المادة صح.", color: "#3ed598" };
    if (pct >= 80) return { label: "جيد جداً", title: "جيد جداً! 👏", msg: "أداء قوي، خطوة بسيطة واتبقى الكمال.", color: "#25d4b4" };
    if (pct >= 70) return { label: "جيد", title: "جيد 👍", msg: "نتيجة مقبولة، راجع الإجابات اللي فاتتك.", color: "#7c6cff" };
    if (pct >= 60) return { label: "مقبول", title: "مقبول 🙂", msg: "أساسياتك موجودة، تحتاج مراجعة شوية.", color: "#ffb45c" };
    return { label: "يحتاج مراجعة", title: "يحتاج مراجعة 📚", msg: "ما تقلق، راجع الأسئلة وحاول تاني.", color: "#ff6b7a" };
  }

  /* ===================== السجل والتاريخ ===================== */
  function getHistory() {
    const data = readStore(KEY_HISTORY, []);
    return Array.isArray(data) ? data : [];
  }

  function saveHistory(record) {
    const history = [record].concat(getHistory()).slice(0, 8);
    writeStore(KEY_HISTORY, history);
  }

  function renderHistory() {
    const history = getHistory();
    const list = $("history-list");
    if (!history.length) {
      list.innerHTML = '<p class="muted">لا توجد محاولات بعد. ابدأ أول اختبار!</p>';
      return;
    }
    list.innerHTML = history.map((h) => {
      const date = new Date(h.date);
      const dateText = isNaN(date) ? "" : date.toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" });
      return `<div class="history-row">
        <b>${escapeHtml(h.name)}</b>
        <span class="h-date">${dateText}</span>
        <span class="muted">${h.correct} / ${h.total}</span>
        <span class="h-pct" style="color:${h.pct >= 70 ? "var(--success)" : "var(--accent)"}">${h.pct}%</span>
      </div>`;
    }).join("");
  }

  /* ===================== المسودة (استئناف المحاولة) ===================== */
  function saveDraft() {
    if (!state || state.finishedAt) return;
    writeStore(KEY_DRAFT, {
      name: state.name,
      ids: state.questions.map((q) => q.id),
      answers: state.answers,
      flags: state.flags,
      current: state.current,
      secondsLeft: state.secondsLeft,
      totalSeconds: state.totalSeconds,
      startedAt: state.startedAt
    });
  }

  function checkDraft() {
    const draft = readStore(KEY_DRAFT, null);
    const banner = $("resume-banner");
    if (!draft || !Array.isArray(draft.ids) || !draft.ids.length) {
      banner.classList.add("hidden");
      return;
    }
    $("resume-info").textContent = `${draft.name} · ${draft.ids.length} سؤالاً · باقي ${formatTime(draft.secondsLeft || 0)}`;
    banner.classList.remove("hidden");
  }

  function resumeDraft() {
    const draft = readStore(KEY_DRAFT, null);
    if (!draft) return checkDraft();
    const questions = draft.ids.map((id) => BANK.find((q) => q.id === id)).filter(Boolean);
    if (!questions.length) {
      localStorage.removeItem(KEY_DRAFT);
      return checkDraft();
    }
    state = {
      name: draft.name || "طالب",
      questions: questions,
      answers: draft.answers || {},
      flags: draft.flags || [],
      current: Math.min(draft.current || 0, questions.length - 1),
      totalSeconds: draft.totalSeconds || questions.length * 60,
      secondsLeft: typeof draft.secondsLeft === "number" ? draft.secondsLeft : questions.length * 60,
      startedAt: draft.startedAt || Date.now(),
      finishedAt: null,
      timedOut: false
    };
    enterQuiz();
  }

  /* ===================== شاشة الاختبار ===================== */
  function enterQuiz() {
    $("quiz-name").textContent = state.name;
    $("question-count-label").textContent = `${state.questions.length} سؤالاً`;
    $("q-total").textContent = state.questions.length;
    showScreen("screen-quiz");
    updateTimer();
    renderQuestion();
    renderNav();
    startTimer();
    saveDraft();
  }

  function startAttempt(event) {
    if (event) event.preventDefault();
    const name = $("student-name").value.trim();
    if (!name) {
      $("name-error").textContent = "اكتب اسمك أولاً عشان نعرض الدرجة.";
      $("student-name").focus();
      return;
    }
    $("name-error").textContent = "";
    const count = parseInt($("question-count").value, 10) || 15;
    const questions = shuffle(BANK).slice(0, count);
    state = {
      name: name,
      questions: questions,
      answers: {},
      flags: [],
      current: 0,
      totalSeconds: count * 60,
      secondsLeft: count * 60,
      startedAt: Date.now(),
      finishedAt: null,
      timedOut: false
    };
    enterQuiz();
  }

  function updateTimer() {
    if (!state) return;
    const timer = $("timer");
    timer.textContent = formatTime(state.secondsLeft);
    timer.classList.toggle("warning", state.secondsLeft <= 60);
  }

  function startTimer() {
    clearInterval(timerId);
    timerId = setInterval(() => {
      if (!state || state.finishedAt) return;
      state.secondsLeft -= 1;
      if (state.secondsLeft <= 0) {
        state.secondsLeft = 0;
        updateTimer();
        clearInterval(timerId);
        finish(true);
        return;
      }
      updateTimer();
      if (state.secondsLeft === 60) toast("باقي دقيقة واحدة فقط! ⏳");
      if (state.secondsLeft % 15 === 0) saveDraft();
    }, 1000);
  }

  function currentQuestion() {
    return state.questions[state.current];
  }

  function renderQuestion() {
    const q = currentQuestion();
    const chosen = state.answers[q.id];
    $("q-category").textContent = q.category;
    $("q-index").textContent = state.current + 1;
    $("q-total").textContent = state.questions.length;
    $("q-text").textContent = q.text;
    $("options").innerHTML = q.options.map((option, index) => `
      <button class="option ${chosen === index ? "selected" : ""}" data-index="${index}" aria-pressed="${chosen === index}">
        <span class="letter">${LETTERS[index]}</span>
        <span>${escapeHtml(option)}</span>
      </button>`).join("");
    $("answer-hint").textContent = chosen === undefined
      ? "اختر إجابة واحدة — تقدر تغيّرها بعدين"
      : `اخترت: ${LETTERS[chosen]} — اضغط على إجابة تانية لتغييرها`;
    updateFlagButton();
  }

  function updateFlagButton() {
    const flagged = state.flags.indexOf(currentQuestion().id) !== -1;
    const btn = $("flag-btn");
    btn.classList.toggle("active", flagged);
    btn.setAttribute("aria-pressed", String(flagged));
    btn.querySelector("span").textContent = flagged ? "مُحدد للمراجعة" : "تحديد للمراجعة";
  }

  function renderNav() {
    const total = state.questions.length;
    let answered = 0;
    $("nav-grid").innerHTML = state.questions.map((q, index) => {
      const isAnswered = state.answers[q.id] !== undefined;
      if (isAnswered) answered++;
      const classes = ["nav-btn"];
      if (isAnswered) classes.push("answered");
      if (index === state.current) classes.push("current");
      if (state.flags.indexOf(q.id) !== -1) classes.push("flagged");
      return `<button class="${classes.join(" ")}" data-index="${index}" aria-label="السؤال ${index + 1}">${index + 1}</button>`;
    }).join("");

    const remaining = total - answered;
    $("answered-count").textContent = `${answered} / ${total}`;
    $("unanswered-note").textContent = remaining ? `لم تُجب عن ${remaining} سؤال` : "";
    $("progress-fill").style.width = `${(answered / total) * 100}%`;
    $("progress-label").textContent = `${state.current + 1} / ${total}`;
    $("prev-btn").disabled = state.current === 0;
    $("next-btn").disabled = state.current === total - 1;
  }

  function goTo(index) {
    if (!state || index < 0 || index >= state.questions.length) return;
    state.current = index;
    renderQuestion();
    renderNav();
    saveDraft();
  }

  function choose(index) {
    if (!state) return;
    state.answers[currentQuestion().id] = index;
    renderQuestion();
    renderNav();
    saveDraft();
  }

  function toggleFlag() {
    if (!state) return;
    const id = currentQuestion().id;
    const at = state.flags.indexOf(id);
    if (at === -1) state.flags.push(id);
    else state.flags.splice(at, 1);
    updateFlagButton();
    renderNav();
    saveDraft();
  }

  /* ===================== النافذة والتسليم ===================== */
  function openDialog(title, message, confirmText, action) {
    $("dialog-title").textContent = title;
    $("dialog-msg").textContent = message;
    $("dialog-confirm").textContent = confirmText;
    pendingAction = action;
    const dialog = $("submit-dialog");
    if (!dialog.open) dialog.showModal();
  }

  function requestSubmit(auto) {
    if (!state || state.finishedAt) return;
    clearInterval(timerId);
    if (auto) { finish(true); return; }
    const remaining = state.questions.length - answeredCount();
    const message = remaining
      ? `لم تُجب عن ${remaining} من ${state.questions.length} سؤال. هل تريد التسليم وعرض النتيجة؟`
      : "أجبت عن كل الأسئلة. هل تريد عرض النتيجة الآن؟";
    openDialog("تأكيد التسليم", message, "تسليم الآن ✓", "submit");
  }

  function answeredCount() {
    return state.questions.filter((q) => state.answers[q.id] !== undefined).length;
  }

  function confirmDialog() {
    const action = pendingAction;
    pendingAction = null;
    if ($("submit-dialog").open) $("submit-dialog").close();
    if (action === "submit") finish(false);
    if (action === "exit") {
      saveDraft();
      showScreen("screen-start");
      checkDraft();
      renderHistory();
      toast("تم حفظ محاولتك، تقدر تكملها في أي وقت.");
    }
  }

  function cancelDialog() {
    pendingAction = null;
    if ($("submit-dialog").open) $("submit-dialog").close();
    if (state && !state.finishedAt) startTimer();
  }

  function finish(timedOut) {
    if (!state || state.finishedAt) return;
    clearInterval(timerId);
    state.finishedAt = Date.now();
    state.timedOut = timedOut;
    const result = computeResult();
    saveHistory({
      name: state.name,
      pct: result.pct,
      correct: result.correct,
      total: result.total,
      date: new Date(state.finishedAt).toISOString()
    });
    localStorage.removeItem(KEY_DRAFT);
    $("resume-banner").classList.add("hidden");
    renderResult(result);
    showScreen("screen-result");

    const cloud = window.QuizCloud;
    const record = {
      name: state.name,
      score: result.pct,
      correct: result.correct,
      total: result.total,
      duration_sec: result.elapsed
    };
    const status = $("cloud-status");
    if (!cloud || !cloud.enabled) {
      status.className = "cloud-status local";
      status.textContent = "💾 الدرجة محفوظة على هذا الجهاز فقط (الوضع المحلي).";
    } else {
      status.className = "cloud-status local";
      status.textContent = "⏳ جارٍ إرسال الدرجة للسيرفر...";
      cloud.submit(record).then((sent) => {
        status.className = sent.ok ? "cloud-status ok" : "cloud-status fail";
        status.textContent = sent.ok
          ? "☁️ تم إرسال الدرجة للوحة المدرس بنجاح."
          : "⚠️ تعذّر الإرسال (" + (sent.error || "خطأ في الاتصال") + ") — الدرجة محفوظة محلياً.";
      });
    }
    if (timedOut) toast("انتهى الوقت — تم التسليم تلقائياً ⏰");
  }

  function computeResult() {
    let correct = 0, wrong = 0;
    state.questions.forEach((q) => {
      const chosen = state.answers[q.id];
      if (chosen === undefined) return;
      if (chosen === q.answer) correct++;
      else wrong++;
    });
    const total = state.questions.length;
    const skipped = total - correct - wrong;
    const pct = Math.round((correct / total) * 100);
    const elapsed = Math.max(0, Math.round((state.finishedAt - state.startedAt) / 1000));
    return { correct, wrong, skipped, total, pct, elapsed };
  }

  /* ===================== شاشة النتيجة ===================== */
  function renderResult(result) {
    const grade = gradeFor(result.pct);
    $("score-value").textContent = result.pct;
    $("score-ring").style.setProperty("--pct", result.pct);
    $("score-ring").style.setProperty("--ring-color", grade.color);
    $("result-title").textContent = grade.title;
    $("result-sub").textContent = `${grade.msg} درجتك ${result.correct} من ${result.total}${state.timedOut ? " (تم التسليم تلقائياً عند انتهاء الوقت)" : ""}`;
    $("stat-correct").textContent = result.correct;
    $("stat-wrong").textContent = result.wrong;
    $("stat-skipped").textContent = result.skipped;
    $("stat-time").textContent = formatTime(result.elapsed);

    $("cert-name").textContent = state.name;
    $("cert-score").textContent = result.pct;
    $("cert-label").textContent = grade.label;
    $("cert-count").textContent = result.total;
    $("cert-date").textContent = new Date(state.finishedAt).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });

    renderReview();
    $("review-section").classList.add("hidden");
    $("review-btn").textContent = "مراجعة الإجابات";
    setFilter("all");
  }

  function renderReview() {
    $("review-list").innerHTML = state.questions.map((q, index) => {
      const chosen = state.answers[q.id];
      const ok = chosen === q.answer;
      const yourText = chosen === undefined ? "لم تُجب عن هذا السؤال" : q.options[chosen];
      return `<div class="review-item" data-status="${ok ? "correct" : "wrong"}">
        <div class="review-q">
          <span class="review-badge ${ok ? "ok" : "no"}">${ok ? "✓" : "✕"}</span>
          <strong>${index + 1}. ${escapeHtml(q.text)}</strong>
        </div>
        <div class="review-answers">
          <div class="your">إجابتك: ${escapeHtml(yourText)}</div>
          <div class="right">الإجابة الصحيحة: ${escapeHtml(q.options[q.answer])}</div>
        </div>
        <p class="review-why">${escapeHtml(q.explanation)}</p>
      </div>`;
    }).join("");
  }

  function setFilter(filter) {
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.filter === filter);
    });
    document.querySelectorAll(".review-item").forEach((item) => {
      const show = filter === "all" || item.dataset.status === filter;
      item.classList.toggle("hidden", !show);
    });
  }

  /* ===================== لوحة المدرس ===================== */
  function openTeacher() {
    const enabled = !!(window.QuizCloud && window.QuizCloud.enabled);
    $("teacher-error").textContent = "";
    $("teacher-mode-note").textContent = enabled
      ? "سجّل الدخول بحساب المدرس لعرض درجات كل الطلبة من السيرفر، أو اعرض نتائج هذا الجهاز."
      : "السيرفر غير مُفعّل (الوضع المحلي). تقدر تعرض نتائج هذا الجهاز، أو تتبع خطوات BACKEND.md لتفعيل المزامنة.";
    $("teacher-login-form").classList.toggle("hidden", !enabled);
    $("teacher-login").classList.remove("hidden");
    $("teacher-dashboard").classList.add("hidden");
    showScreen("screen-teacher");
  }

  function showDashboard(source) {
    teacherSource = source;
    $("teacher-login").classList.add("hidden");
    $("teacher-dashboard").classList.remove("hidden");
    $("dash-source").textContent = source === "cloud" ? "سحابة Supabase" : "الوضع المحلي";
    $("clear-results").classList.toggle("hidden", source !== "cloud");
    loadResults();
  }

  async function loadResults() {
    const status = $("teacher-status");
    status.textContent = "جارٍ تحميل النتائج...";
    try {
      if (teacherSource === "cloud") {
        const rows = await window.QuizCloud.list();
        lastResults = (rows || []).map((r) => ({
          name: r.name, score: r.score, correct: r.correct, total: r.total,
          duration_sec: r.duration_sec || 0, created_at: r.created_at
        }));
      } else {
        lastResults = getHistory().map((h) => ({
          name: h.name, score: h.pct, correct: h.correct, total: h.total,
          duration_sec: 0, created_at: h.date
        }));
      }
      status.textContent = lastResults.length
        ? `آخر تحديث: ${new Date().toLocaleTimeString("ar-EG")}`
        : "لا توجد نتائج بعد — حين يسلّم الطلبة ستظهر هنا.";
    } catch (error) {
      lastResults = [];
      status.textContent = "تعذّر تحميل النتائج: " + error.message;
    }
    renderDashboard();
  }

  function bandOf(score) {
    if (score >= 90) return 0;
    if (score >= 80) return 1;
    if (score >= 70) return 2;
    if (score >= 60) return 3;
    return 4;
  }

  function renderDashboard() {
    const n = lastResults.length;
    const scores = lastResults.map((r) => Number(r.score) || 0);
    const avg = n ? Math.round(scores.reduce((a, b) => a + b, 0) / n) : 0;
    const max = n ? Math.max.apply(null, scores) : 0;
    const pass = n ? Math.round(scores.filter((s) => s >= 60).length / n * 100) : 0;
    $("dash-count").textContent = n;
    $("dash-avg").textContent = avg + "%";
    $("dash-max").textContent = max + "%";
    $("dash-pass").textContent = pass + "%";

    const bands = [
      { label: "ممتاز (90+)", color: "#3ed598" },
      { label: "جيد جداً (80+)", color: "#25d4b4" },
      { label: "جيد (70+)", color: "#7c6cff" },
      { label: "مقبول (60+)", color: "#ffb45c" },
      { label: "يحتاج مراجعة", color: "#ff6b7a" }
    ];
    const counts = [0, 0, 0, 0, 0];
    scores.forEach((s) => counts[bandOf(s)]++);
    $("chart-total").textContent = `إجمالي ${n} نتيجة`;
    $("grade-chart").innerHTML = bands.map((band, index) => `
      <div class="chart-row">
        <span class="chart-label">${band.label}</span>
        <span class="chart-bar"><i style="width:${n ? (counts[index] / n * 100) : 0}%;background:${band.color}"></i></span>
        <span class="chart-value">${counts[index]}</span>
      </div>`).join("");

    $("results-body").innerHTML = n ? lastResults.map((r) => {
      const score = Number(r.score) || 0;
      const date = new Date(r.created_at);
      const dateText = isNaN(date) ? "—" : date.toLocaleDateString("ar-EG", { day: "numeric", month: "short" }) + " " + date.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
      return `<tr>
        <td>${escapeHtml(r.name || "—")}</td>
        <td class="pct" style="color:${gradeFor(score).color}">${score}%</td>
        <td>${gradeFor(score).label}</td>
        <td>${Number(r.correct) || 0} / ${Number(r.total) || 0}</td>
        <td>${formatTime(r.duration_sec || 0)}</td>
        <td>${dateText}</td>
      </tr>`;
    }).join("") : '<tr class="empty-row"><td colspan="6">لا توجد نتائج لعرضها بعد.</td></tr>';
    $("table-count").textContent = `${n} نتيجة`;
  }

  function csvCell(value) {
    return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"';
  }

  function exportCsv() {
    if (!lastResults.length) { toast("مفيش نتائج لتنزيلها دلوقتي."); return; }
    const rows = [["الاسم", "الدرجة", "التقدير", "الصحيح", "من", "الوقت", "التاريخ"]];
    lastResults.forEach((r) => {
      const score = Number(r.score) || 0;
      const date = new Date(r.created_at);
      rows.push([
        r.name, score + "%", gradeFor(score).label,
        r.correct, r.total, formatTime(r.duration_sec || 0),
        isNaN(date) ? "" : date.toLocaleString("ar-EG")
      ]);
    });
    const csv = "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "quiz-results-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("تم تنزيل ملف النتائج.");
  }

  /* ===================== ربط الأحداث ===================== */
  function bindEvents() {
    $("start-form").addEventListener("submit", startAttempt);
    $("student-name").addEventListener("input", () => { $("name-error").textContent = ""; });

    $("resume-btn").addEventListener("click", resumeDraft);
    $("discard-btn").addEventListener("click", () => {
      localStorage.removeItem(KEY_DRAFT);
      checkDraft();
      toast("تم حذف المحاولة القديمة.");
    });
    $("clear-history").addEventListener("click", () => {
      if (!getHistory().length) return;
      if (window.confirm("هل تريد مسح كل محاولاتك السابقة؟")) {
        localStorage.removeItem(KEY_HISTORY);
        renderHistory();
        toast("تم مسح السجل.");
      }
    });

    $("options").addEventListener("click", (event) => {
      const button = event.target.closest(".option");
      if (button) choose(parseInt(button.dataset.index, 10));
    });
    $("nav-grid").addEventListener("click", (event) => {
      const button = event.target.closest(".nav-btn");
      if (button) goTo(parseInt(button.dataset.index, 10));
    });
    $("flag-btn").addEventListener("click", toggleFlag);
    $("prev-btn").addEventListener("click", () => goTo(state.current - 1));
    $("next-btn").addEventListener("click", () => goTo(state.current + 1));

    $("submit-btn").addEventListener("click", () => requestSubmit(false));
    $("exit-quiz").addEventListener("click", () => {
      clearInterval(timerId);
      openDialog("العودة للبداية", "المحاولة هتتحفظ وتقدر تكملها بعدين. هل تريد الخروج؟", "الخروج", "exit");
    });
    $("dialog-confirm").addEventListener("click", confirmDialog);
    $("dialog-cancel").addEventListener("click", cancelDialog);
    $("submit-dialog").addEventListener("cancel", (event) => { event.preventDefault(); cancelDialog(); });

    $("review-btn").addEventListener("click", () => {
      const section = $("review-section");
      section.classList.toggle("hidden");
      $("review-btn").textContent = section.classList.contains("hidden") ? "مراجعة الإجابات" : "إخفاء المراجعة";
      if (!section.classList.contains("hidden")) section.scrollIntoView({ behavior: "smooth" });
    });
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => setFilter(btn.dataset.filter));
    });
    $("print-btn").addEventListener("click", () => window.print());
    $("restart-btn").addEventListener("click", () => {
      state = null;
      $("review-btn").textContent = "مراجعة الإجابات";
      showScreen("screen-start");
      renderHistory();
      $("student-name").focus();
    });

    $("teacher-open").addEventListener("click", openTeacher);
    $("teacher-close").addEventListener("click", () => {
      showScreen("screen-start");
      renderHistory();
      checkDraft();
    });
    $("teacher-local-btn").addEventListener("click", () => showDashboard("local"));
    $("teacher-login-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const error = $("teacher-error");
      error.textContent = "";
      try {
        await window.QuizCloud.signIn($("teacher-email").value.trim(), $("teacher-password").value);
        showDashboard("cloud");
      } catch (e) {
        error.textContent = e.message || "تعذّر الدخول، تأكد من البريد وكلمة المرور.";
      }
    });
    $("refresh-results").addEventListener("click", loadResults);
    $("export-csv").addEventListener("click", exportCsv);
    $("clear-results").addEventListener("click", async () => {
      if (!window.confirm("هل تريد مسح كل النتائج من السيرفر؟")) return;
      try {
        await window.QuizCloud.clearAll();
        toast("تم مسح نتائج السيرفر.");
        loadResults();
      } catch (e) {
        toast("تعذّر المسح: " + e.message);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (!state || state.finishedAt) return;
      if (!$("screen-quiz").classList.contains("active")) return;
      if ($("submit-dialog").open) return;
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      const digit = ["1", "2", "3", "4", "١", "٢", "٣", "٤"].indexOf(event.key);
      if (digit !== -1) { event.preventDefault(); choose(digit); return; }
      if (event.key === "ArrowLeft") { event.preventDefault(); goTo(state.current + 1); }
      if (event.key === "ArrowRight") { event.preventDefault(); goTo(state.current - 1); }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!BANK.length) {
      toast("تعذّر تحميل بنك الأسئلة.");
      return;
    }
    bindEvents();
    renderHistory();
    checkDraft();
  });
})();
