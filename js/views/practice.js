// Practice page: question → answer → check → feedback, with 4-stage hints (scaffolding).
import { getState, update, markActiveToday } from "../store.js";
import { setHasSupport, loadRubric } from "../content.js";
import {
  esc, icon, SKILLS, BLOOM, DIFFICULTY, subSkillLabel, skillChip, toast, todayISO,
  formatDuration, wordCount, speak, stopSpeaking, ttsAvailable, sentences,
} from "../ui.js";
import { scoreQuestion, independenceOf, INDEPENDENCE, recommendedLevel } from "../progress.js";

let controller = null; // aborts document-level listeners and timers from the previous visit
let ticker = null;

const PRAISE = ["答對了！", "很棒，完全正確！", "Nice work!", "Great job!", "就是這樣！"];
const ENCOURAGE = ["很接近了，再想一下。", "還差一點，再試一次。", "沒關係，錯誤是學習的一部分。"];
const pick = (list) => list[Math.floor(Math.random() * list.length)];

function normalize(text) {
  return String(text || "").toLowerCase().replace(/[’‘`]/g, "'").replace(/[.!?,;:]+$/g, "").replace(/\s+/g, " ").trim();
}

function blankQS() {
  return {
    selected: null, input: "", tries: 0, wrongKeys: [], hintLevel: 0, done: false, correct: false,
    revealed: false, skipped: false, flagged: false, time: 0, feedback: null,
    variant: { selected: null, input: "", done: false, correct: false, tries: 0, feedback: null },
    essay: { text: "", checks: [], rubric: {}, submitted: false, stage: "write", score: 0 },
  };
}

// Mark phrases (from hints) and glossary words inside plain text, returning safe HTML.
function markText(text, words = [], glossary = []) {
  const raw = String(text || "");
  const ranges = [];
  words.filter(Boolean).forEach((w) => {
    const lower = raw.toLowerCase();
    const needle = w.toLowerCase();
    let from = 0;
    let idx;
    while (needle && (idx = lower.indexOf(needle, from)) !== -1) {
      ranges.push([idx, idx + needle.length]);
      from = idx + needle.length;
    }
  });
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  ranges.forEach((r) => {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  });
  const withGloss = (segment) => {
    let html = esc(segment);
    glossary.forEach((g) => {
      const re = new RegExp(`\\b(${g.word.replace(/[^a-z-]/gi, "")}[a-z]*)\\b`, "gi");
      html = html.replace(re, (m) => `<button type="button" class="gloss" data-gloss="${esc(g.word)}">${m}</button>`);
    });
    return html;
  };
  let out = "";
  let pos = 0;
  merged.forEach(([s, e]) => {
    out += withGloss(raw.slice(pos, s));
    out += `<mark class="hint-mark">${withGloss(raw.slice(s, e))}</mark>`;
    pos = e;
  });
  out += withGloss(raw.slice(pos));
  return out;
}

export async function renderPractice(root, ctx, setId) {
  controller?.abort();
  clearInterval(ticker);
  controller = new AbortController();
  const { signal } = controller;
  window.addEventListener("hashchange", () => { controller?.abort(); clearInterval(ticker); stopSpeaking(); }, { once: true, signal });

  const { course, cls } = ctx;
  const set = course.index.sets.get(setId);
  if (!set) {
    root.innerHTML = `<section class="page"><div class="card empty"><h1>找不到這個題組</h1><a class="button" href="#/units">回單元列表</a></div></section>`;
    return;
  }
  if (!ctx.isOpen(set.unit_id)) {
    root.innerHTML = `<section class="page"><div class="card empty"><h1>這個單元尚未開放</h1><p class="muted">請等老師開放後再來練習。</p><a class="button" href="#/units">回單元列表</a></div></section>`;
    return;
  }

  const state = getState();
  const settings = () => getState().settings;
  const mode = cls?.scoring_mode || "practice";
  const maxHint = Math.max(0, Math.min(4, cls?.hint_policy?.max_level ?? 4));
  const allowSwitch = cls ? cls.allow_level_switch !== false : true;
  const hasSupport = setHasSupport(course, set);
  let level = "standard";
  if (hasSupport) level = allowSwitch ? (state.levelPref[setId] || recommendedLevel(setId, cls).level) : (cls?.default_level || "standard");

  const passage = set.passage_id ? course.index.passages.get(set.passage_id) : null;
  const isListening = set.skill === "listening";
  const questions = set.question_ids.map((id) => course.index.questions.get(id));
  if (!questions.length) {
    root.innerHTML = `<section class="page"><div class="card empty"><h1>這個題組還沒有題目</h1><a class="button" href="#/units">回單元列表</a></div></section>`;
    return;
  }

  let run = state.runs[setId];
  if (!run || run.ids?.join() !== set.question_ids.join()) {
    run = { ids: [...set.question_ids], index: 0, startedAt: Date.now(), elapsed: 0, q: {} };
  }
  update((s) => {
    s.runs[setId] = run;
    s.last = { setId, courseId: course.course_id, at: Date.now() };
  });
  const persist = () => update((s) => { s.runs[setId] = run; });
  const qs = (q) => (run.q[q.question_id] ||= blankQS());

  // Listening state
  const listen = { transcriptMode: isListening && !ttsAvailable && !passage?.audio_url, plays: 0, flowToken: 0 };
  let listenKey = null;

  root.innerHTML = `
    <section class="practice ${passage && !isListening ? "practice--split" : ""} ${isListening ? "practice--listening" : ""}">
      <header class="practice-bar">
        <a class="icon-button" href="#/units" aria-label="返回單元列表">${icon("arrowLeft")}</a>
        <div class="practice-bar__title">
          <span class="muted xsmall">${esc(set.unit_title)}</span>
          <h1>${esc(set.title)}</h1>
        </div>
        <div class="practice-bar__progress">
          <span data-progress-text class="small"></span>
          <span class="progress progress--thin"><span data-progress-bar></span></span>
        </div>
        <span class="timer small" data-timer ${settings().showTimer ? "" : "hidden"}>${icon("clock")}<span></span></span>
        <button type="button" class="icon-button" data-action="read" aria-label="朗讀題目（R）" ${ttsAvailable ? "" : "hidden"}>${icon("speaker")}</button>
        <button type="button" class="icon-button" data-open-settings aria-label="閱讀設定">${icon("gear")}</button>
      </header>
      <div class="practice-body">
        ${passage ? `<section class="passage-pane" aria-label="${isListening ? "聽力" : "閱讀文本"}" data-passage></section>` : ""}
        <section class="question-pane" data-question></section>
      </div>
      <div class="popover" data-popover hidden role="dialog" aria-label="生字卡"></div>
    </section>`;

  const passageEl = root.querySelector("[data-passage]");
  const questionEl = root.querySelector("[data-question]");
  const popover = root.querySelector("[data-popover]");

  const current = () => questions[run.index];

  // ---------- Passage ----------
  function passageVariant() {
    if (!passage?.variants?.length) return null;
    return passage.variants.find((v) => v.level === level) || passage.variants.find((v) => v.level === "standard") || passage.variants[0];
  }

  function activeHighlights(q) {
    const s = qs(q);
    const hints = (q.hints || []).slice(0, s.hintLevel);
    return {
      words: hints.filter((h) => h.action === "highlight-words").flatMap((h) => h.words || []),
      paragraph: [...hints].reverse().find((h) => h.action === "highlight-paragraph")?.paragraph ?? null,
    };
  }

  function levelSwitch() {
    if (!hasSupport || !allowSwitch) return hasSupport ? `<span class="badge badge--neutral">${level === "support" ? "支援版" : "標準版"}</span>` : "";
    return `<div class="segmented segmented--sm" role="radiogroup" aria-label="文章版本">
      ${[["standard", "標準版"], ["support", "支援版"]].map(([v, t]) => `<label class="segmented__item"><input type="radio" name="level" value="${v}" data-level ${level === v ? "checked" : ""}/><span>${t}</span></label>`).join("")}
    </div>`;
  }

  function renderPassage(scrollToFocus = false) {
    if (!passageEl) return;
    const q = current();
    if (isListening) {
      // Only redraw the player when the question or transcript visibility changes, so playback isn't cut off.
      const key = `${q.question_id}|${qs(q).hintLevel >= 4 || qs(q).done}`;
      if (key !== listenKey) {
        listenKey = key;
        renderListening();
      }
      return;
    }
    const v = passageVariant();
    const { words, paragraph } = activeHighlights(q);
    passageEl.innerHTML = `
      <div class="passage-pane__head">
        <div>
          <h2 class="passage-title">${esc(passage.title)}</h2>
          <span class="muted xsmall">${v?.lexile ? `約 ${v.lexile}L${v.lexile_source === "estimated" ? "（估計）" : ""} · ` : ""}${(v?.paragraphs || []).join(" ").split(/\s+/).length} words · 點選底線字可看中文</span>
        </div>
        <div class="passage-pane__tools">
          ${levelSwitch()}
          ${ttsAvailable ? `<button type="button" class="button button--secondary button--sm" data-action="read-passage">${icon("speaker")}<span>朗讀全文</span></button>` : ""}
        </div>
      </div>
      <article class="passage reading-text" lang="en">
        ${(v?.paragraphs || []).map((p, i) => `<p data-para="${i}" class="${paragraph === i ? "is-focus" : ""}"><span class="para-num" aria-hidden="true">${i + 1}</span>${markText(p, words, passage.glossary || [])}</p>`).join("")}
      </article>`;
    if (scrollToFocus && paragraph != null) {
      passageEl.querySelector(`[data-para="${paragraph}"]`)?.scrollIntoView({ block: "center", behavior: settings().motion === "reduce" ? "auto" : "smooth" });
    }
  }

  function renderListening() {
    const q = current();
    const s = qs(q);
    const showTranscript = s.hintLevel >= 4 || s.done;
    passageEl.innerHTML = `
      <div class="passage-pane__head">
        <div><h2 class="passage-title">${icon("headphones")} ${esc(passage.title)}</h2>
        <span class="muted xsmall">${listen.transcriptMode ? "讀作聽模式：句子會一句一句出現，再消失" : "先聽，再作答。可以重播。"} · 已播放 ${listen.plays} 次</span></div>
      </div>
      <div class="player">
        ${passage.audio_url && !listen.transcriptMode ? `<audio src="${esc(passage.audio_url)}" preload="none" data-audio></audio>` : ""}
        <button type="button" class="button button--lg" data-action="play">${icon("play")}<span>${listen.transcriptMode ? "開始（讀作聽）" : "播放"}</span></button>
        <button type="button" class="button button--secondary" data-action="play-slow">${icon("turtle")}<span>慢速 0.7×</span></button>
        ${ttsAvailable || passage.audio_url ? `<button type="button" class="text-link" data-action="toggle-transcript-mode">${listen.transcriptMode ? "改回聲音播放" : "聽不到？改用讀作聽模式"}</button>` : ""}
      </div>
      <div class="flow-text reading-text" lang="en" data-flow aria-live="polite"></div>
      ${showTranscript ? `<details class="transcript" open><summary>逐字稿 Transcript</summary><p class="reading-text" lang="en">${esc(passage.transcript)}</p></details>` : ""}`;
  }

  function playListening(rate) {
    stopSpeaking();
    listen.plays += 1;
    const audio = passageEl.querySelector("[data-audio]");
    if (audio && !listen.transcriptMode) {
      audio.playbackRate = rate;
      audio.currentTime = 0;
      audio.play().catch(() => toast("無法播放音檔，請改用讀作聽模式。"));
      renderListeningMeta();
      return;
    }
    if (!listen.transcriptMode && ttsAvailable) {
      speak(passage.transcript, { rate, accent: settings().accent });
      renderListeningMeta();
      return;
    }
    // Transcript mode: reveal one sentence at a time, then hide (linear, one-pass like listening).
    const flow = passageEl.querySelector("[data-flow]");
    const parts = sentences(passage.transcript);
    let i = 0;
    const token = ++listen.flowToken;
    flow.innerHTML = "";
    const step = () => {
      if (signal.aborted || !flow.isConnected || token !== listen.flowToken) return;
      if (i >= parts.length) {
        setTimeout(() => { if (flow.isConnected && token === listen.flowToken) flow.innerHTML = `<p class="muted small">（播放完畢，可以再播放一次）</p>`; }, 2000);
        return;
      }
      flow.innerHTML = `<p class="flow-line">${esc(parts[i])}</p>`;
      const ms = Math.max(1600, wordCount(parts[i]) * 420) / rate;
      i += 1;
      setTimeout(step, ms);
    };
    step();
    renderListeningMeta();
  }

  function renderListeningMeta() {
    const meta = passageEl.querySelector(".passage-pane__head .xsmall");
    if (meta) meta.textContent = `${listen.transcriptMode ? "讀作聽模式：句子會一句一句出現，再消失" : "先聽，再作答。可以重播。"} · 已播放 ${listen.plays} 次`;
  }

  // ---------- Question ----------
  function stemOf(q) {
    return level === "support" && q.stem_support ? q.stem_support : q.stem;
  }

  function optionsHTML(q, s, variant = false) {
    const st = variant ? s.variant : s;
    const done = st.done;
    const eliminated = variant ? [] : (q.hints || []).slice(0, s.hintLevel).filter((h) => h.action === "eliminate-option").flatMap((h) => h.eliminate || []);
    return `<div class="options" role="radiogroup" aria-labelledby="${variant ? "v-stem" : "q-stem"}">
      ${q.options.map((o) => {
        const isSel = st.selected === o.key;
        const isAnswer = done && o.key === q.answer;
        const isWrong = (st.wrongKeys || []).includes(o.key) && !isAnswer;
        const isElim = eliminated.includes(o.key) && !isAnswer;
        const cls = ["option", isSel && "is-selected", isAnswer && "is-correct", isWrong && "is-wrong", isElim && "is-eliminated"].filter(Boolean).join(" ");
        const state = isAnswer ? "（正確答案）" : isWrong ? "（已試過）" : isElim ? "（已排除）" : "";
        return `<button type="button" class="${cls}" role="radio" aria-checked="${isSel}" data-option="${esc(o.key)}" ${variant ? "data-variant" : ""} ${done || isElim ? "disabled" : ""}>
          <span class="option__key" aria-hidden="true">${isAnswer ? icon("check") : isWrong ? icon("retry") : esc(o.key)}</span>
          <span class="option__text" lang="en">${esc(o.text)}</span><span class="visually-hidden">${state}</span>
        </button>`;
      }).join("")}
    </div>`;
  }

  function fillHTML(q, s, variant = false) {
    const st = variant ? s.variant : s;
    const id = variant ? "v-input" : "q-input";
    return `<div class="fill">
      <label for="${id}" class="small muted">Your answer 你的答案</label>
      <input id="${id}" class="fill__input ${st.done ? (st.correct || (!variant && s.revealed) ? "is-correct" : "") : ""}" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" lang="en"
        value="${esc(st.done && !st.correct ? [].concat(q.answer)[0] : st.input)}" ${st.done ? "readonly" : ""} data-fill ${variant ? "data-variant" : ""} />
    </div>`;
  }

  function hintPanelHTML(q, s) {
    if (!s.hintLevel) return "";
    const hints = (q.hints || []).slice(0, s.hintLevel);
    const variantQ = s.hintLevel >= 4 && q.variant_question_id ? course.index.variants.get(q.variant_question_id) : null;
    return `<section class="hint-panel" aria-label="提示">
      <div class="hint-steps" aria-hidden="true">${[1, 2, 3, 4].map((n) => `<span class="${n <= s.hintLevel ? "is-on" : ""} ${n > maxHint ? "is-off" : ""}"></span>`).join("")}</div>
      <ol class="hint-list">
        ${hints.map((h) => `<li><span class="hint-list__label">${["", "方向", "線索", "部分解析", "完整解析"][h.level] || ""}</span><p lang="en">${esc(h.text)}</p></li>`).join("")}
      </ol>
      ${variantQ ? `
      <div class="variant">
        <p class="eyebrow">${icon("spark")} 同類型變式題 · 答對可再加分</p>
        <p id="v-stem" class="variant__stem" lang="en">${esc(variantQ.stem)}</p>
        ${variantQ.type === "fill-blank" ? fillHTML(variantQ, s, true) : optionsHTML(variantQ, s, true)}
        ${s.variant.done ? "" : `<button type="button" class="button button--sm" data-action="check-variant">檢查變式題</button>`}
        ${s.variant.feedback ? `<div class="feedback feedback--${s.variant.feedback.type}" role="status"><p>${s.variant.feedback.html}</p></div>` : ""}
      </div>` : ""}
    </section>`;
  }

  function metaHTML(q) {
    return `<div class="q-meta">
      ${skillChip(q.skill)}
      <span class="chip">${esc(subSkillLabel(q.sub_skill))}</span>
      <span class="chip" title="Depth of Knowledge 知識深度">DOK ${q.dok}</span>
      <span class="chip" title="布魯姆認知層次">${BLOOM[q.bloom] || q.bloom}</span>
      <span class="chip chip--quiet">${DIFFICULTY[q.difficulty] || ""}</span>
    </div>`;
  }

  async function renderQuestion(focus = null) {
    const q = current();
    const s = qs(q);
    updateProgress();
    if (q.type === "essay") return renderEssay(q, s, focus);
    const { words } = activeHighlights(q);
    const canHint = !s.done && s.hintLevel < maxHint && (q.hints || []).length > s.hintLevel;
    const hasAnswer = q.type === "fill-blank" ? normalize(s.input) !== "" : !!s.selected;
    const isLast = questions.filter((x) => !qs(x).done).length === 0;

    questionEl.innerHTML = `
      <article class="q-card" aria-labelledby="q-stem">
        <div class="q-card__top">
          <span class="muted small">第 ${run.index + 1} 題 / 共 ${questions.length} 題</span>
          <button type="button" class="flag ${s.flagged ? "is-on" : ""}" data-action="flag" aria-pressed="${s.flagged}">${icon("flag")}<span>${s.flagged ? "已標記不確定" : "標記不確定"}</span></button>
        </div>
        ${metaHTML(q)}
        <h2 id="q-stem" class="q-stem" lang="en">${markText(stemOf(q), passage ? [] : words, [])}</h2>
        ${level === "support" && q.stem_support ? `<p class="muted xsmall">支援版題幹 · 原題：<span lang="en">${esc(q.stem)}</span></p>` : ""}
        ${q.type === "fill-blank" ? fillHTML(q, s) : optionsHTML(q, s)}
        <div class="q-actions">
          ${s.done
            ? `<button type="button" class="button button--lg" data-action="next">${isLast ? "完成題組" : "下一題"} ${icon("arrowRight")}</button>`
            : `<button type="button" class="button button--lg" data-action="check" ${hasAnswer ? "" : "disabled"} aria-describedby="check-help">檢查答案</button>
               ${maxHint ? `<button type="button" class="button button--secondary" data-action="hint" ${canHint ? "" : "disabled"}>${icon("bulb")}<span>${s.hintLevel ? "下一個提示" : "我需要提示"}（${s.hintLevel}/${maxHint}）</span></button>` : ""}
               <button type="button" class="text-link" data-action="skip">稍後再做</button>`}
        </div>
        ${!s.done && !hasAnswer ? `<p id="check-help" class="muted xsmall">${q.type === "fill-blank" ? "先輸入答案，再按「檢查答案」或 Enter。" : "先選一個答案（可按 A–D）。"}</p>` : ""}
        <div class="feedback-slot" aria-live="polite">${s.feedback ? `<div class="feedback feedback--${s.feedback.type}">${s.feedback.html}</div>` : ""}</div>
        ${hintPanelHTML(q, s)}
        ${!s.done && s.hintLevel && s.hintLevel < 4 ? `<p class="muted small try-self">${icon("spark")} 有想法了嗎？可以先自己再試一次，不一定要看下一個提示。</p>` : ""}
      </article>`;
    renderPassage(focus === "hint");
    if (focus === "feedback") questionEl.querySelector(".feedback")?.focus?.();
    if (focus === "next") questionEl.querySelector('[data-action="next"]')?.focus();
    if (focus === "hint") questionEl.querySelector(".hint-list li:last-child")?.scrollIntoView({ block: "nearest" });
    if (focus === "start") questionEl.querySelector("#q-stem")?.focus?.();
  }

  // ---------- Essay ----------
  async function renderEssay(q, s, focus) {
    const rubric = q.rubric_id ? await loadRubric(q.rubric_id) : null;
    const sc = q.scaffolds || {};
    const target = q.word_target?.[level] || q.word_target?.standard || [80, 120];
    const words = wordCount(s.essay.text);
    const toolsOpen = level === "support" || s.hintLevel >= 2;
    const modelOpen = s.hintLevel >= 4 || s.done;
    const checklist = sc.checklist || [];
    const draft = getState().drafts[q.question_id];
    if (!s.essay.text && draft) s.essay.text = draft;

    questionEl.innerHTML = `
      <article class="q-card q-card--essay" aria-labelledby="q-stem">
        <div class="q-card__top"><span class="muted small">寫作任務</span></div>
        ${metaHTML(q)}
        <h2 id="q-stem" class="q-stem" lang="en">${esc(q.stem)}</h2>
        <p class="muted small">目標字數：${target[0]}–${target[1]} 字（${level === "support" ? "支援版" : "標準版"}）。使用提示與寫作工具不會扣分。</p>
        <div class="essay">
          <div class="essay__main">
            <label for="essay-text" class="visually-hidden">你的作文</label>
            <textarea id="essay-text" class="essay__text reading-text" lang="en" spellcheck="true" rows="10" ${s.done ? "readonly" : ""} placeholder="Start writing here...">${esc(s.essay.text)}</textarea>
            <div class="essay__count small"><span data-wc>${words}</span> words · 目標 ${target[0]}–${target[1]}
              <span class="progress progress--thin"><span data-wc-bar style="width:${Math.min(100, Math.round((words / target[0]) * 100))}%"></span></span>
            </div>
          </div>
          <aside class="essay__tools">
            <details ${toolsOpen ? "open" : ""}>
              <summary>${icon("pencil")} 句型框架 Sentence frames</summary>
              <div class="chip-list">${(sc.frames || []).map((f) => `<button type="button" class="pill pill--sm" data-insert="${esc(f)}" lang="en" ${s.done ? "disabled" : ""}>${esc(f)}</button>`).join("")}</div>
            </details>
            <details ${toolsOpen ? "open" : ""}>
              <summary>${icon("abc")} 詞彙庫 Word bank</summary>
              <div class="chip-list">${(sc.word_bank || []).map((w) => `<button type="button" class="pill pill--sm" data-insert="${esc(w)}" lang="en" ${s.done ? "disabled" : ""}>${esc(w)}</button>`).join("")}</div>
            </details>
            <fieldset class="checklist">
              <legend>自我檢核</legend>
              ${checklist.map((c, i) => `<label><input type="checkbox" data-check="${i}" ${s.essay.checks.includes(i) ? "checked" : ""} ${s.done ? "disabled" : ""}/> <span lang="en">${esc(c)}</span></label>`).join("")}
            </fieldset>
          </aside>
        </div>
        ${modelOpen && sc.model_text ? `<details class="model" open><summary>範文 Model paragraph</summary><p class="reading-text" lang="en">${esc(sc.model_text)}</p></details>` : ""}

        ${s.essay.stage === "rubric" && !s.done && rubric ? `
        <section class="rubric" aria-labelledby="rubric-title">
          <h3 id="rubric-title">自評：給自己的作品打分數</h3>
          <p class="muted small">誠實評分就好，老師之後可以再看你的作品。</p>
          ${rubric.criteria.map((c) => `
            <fieldset class="rubric__row">
              <legend>${esc(c.zh)} <span lang="en" class="muted">${esc(c.name)}</span></legend>
              <div class="rubric__options">
                ${[4, 3, 2, 1].map((n) => `<label class="rubric__opt"><input type="radio" name="rb-${esc(c.name)}" value="${n}" data-rubric="${esc(c.name)}" ${s.essay.rubric[c.name] === n ? "checked" : ""}/><span><strong>${n}</strong><span lang="en">${esc(c.descriptors[n])}</span></span></label>`).join("")}
              </div>
            </fieldset>`).join("")}
        </section>` : ""}

        <div class="q-actions">
          ${s.done
            ? `<button type="button" class="button button--lg" data-action="next">完成題組 ${icon("arrowRight")}</button>`
            : s.essay.stage === "rubric"
              ? `<button type="button" class="button button--lg" data-action="submit-essay">送出自評</button><button type="button" class="text-link" data-action="back-to-write">回去修改</button>`
              : `<button type="button" class="button button--lg" data-action="finish-writing" ${words ? "" : "disabled"}>寫好了，開始自評</button>
                 ${maxHint ? `<button type="button" class="button button--secondary" data-action="hint" ${s.hintLevel < maxHint && s.hintLevel < (q.hints || []).length ? "" : "disabled"}>${icon("bulb")}<span>${s.hintLevel ? "下一個提示" : "我需要提示"}（${s.hintLevel}/${maxHint}）</span></button>` : ""}`}
        </div>
        <div class="feedback-slot" aria-live="polite">${s.feedback ? `<div class="feedback feedback--${s.feedback.type}">${s.feedback.html}</div>` : ""}</div>
        ${hintPanelHTML(q, s)}
      </article>`;

    const ta = questionEl.querySelector("#essay-text");
    ta.addEventListener("input", () => {
      s.essay.text = ta.value;
      const n = wordCount(ta.value);
      questionEl.querySelector("[data-wc]").textContent = n;
      questionEl.querySelector("[data-wc-bar]").style.width = `${Math.min(100, Math.round((n / target[0]) * 100))}%`;
      const btn = questionEl.querySelector('[data-action="finish-writing"]');
      if (btn) btn.disabled = n === 0;
      update((st) => { st.drafts[q.question_id] = ta.value; st.runs[setId] = run; });
    }, { signal });
    if (focus === "start" || focus === "write") ta.focus();
    if (focus === "rubric") questionEl.querySelector("#rubric-title")?.scrollIntoView({ block: "start" });
    if (focus === "next") questionEl.querySelector('[data-action="next"]')?.focus();
  }

  // ---------- Progress, timer ----------
  function updateProgress() {
    const done = questions.filter((q) => qs(q).done).length;
    root.querySelector("[data-progress-text]").textContent = `第 ${run.index + 1} / ${questions.length} 題`;
    root.querySelector("[data-progress-bar]").style.width = `${Math.round((done / questions.length) * 100)}%`;
  }

  ticker = setInterval(() => {
    if (signal.aborted) return clearInterval(ticker);
    if (document.hidden) return;
    run.elapsed += 1;
    const q = current();
    if (q) qs(q).time += 1;
    const t = root.querySelector("[data-timer]");
    if (t) {
      t.hidden = !settings().showTimer;
      t.querySelector("span").textContent = formatDuration(run.elapsed);
    }
    if (run.elapsed % 5 === 0) persist();
  }, 1000);

  // ---------- Recording ----------
  function record(q) {
    const s = qs(q);
    const isEssay = q.type === "essay";
    const max = q.points || 10;
    const score = isEssay ? s.essay.score : scoreQuestion({
      correct: s.correct, tries: s.tries, hintLevel: s.hintLevel, variantCorrect: s.variant.correct, skipped: s.skipped && !s.done, mode, points: max,
    });
    const independence = isEssay
      ? (s.hintLevel >= 4 ? "full" : s.hintLevel === 3 ? "moderate" : s.hintLevel ? "light" : "independent")
      : independenceOf({ correct: s.correct, tries: s.tries, hintLevel: s.hintLevel, skipped: s.skipped && !s.done });
    update((st) => {
      st.attempts[q.question_id] = {
        question_id: q.question_id, set_id: set.set_id, unit_id: set.unit_id, course_id: course.course_id,
        skill: q.skill, sub_skill: q.sub_skill, dok: q.dok, bloom: q.bloom,
        stem: String(q.stem).slice(0, 160), correct: isEssay ? true : s.correct, tries: s.tries, hintLevel: s.hintLevel,
        independence, score, max, level, flagged: s.flagged, time: s.time, ts: Date.now(), date: todayISO(),
        response: isEssay ? s.essay.text : q.type === "fill-blank" ? s.input : s.selected,
        answer: isEssay ? null : [].concat(q.answer)[0],
      };
      st.runs[setId] = run;
      markActiveToday();
    });
    return score;
  }

  // ---------- Actions ----------
  function select(key, variant = false) {
    const q = current();
    const s = qs(q);
    const target = variant ? s.variant : s;
    if (target.done) return;
    target.selected = key;
    persist();
    renderQuestion();
    questionEl.querySelector(`[data-option="${CSS.escape(key)}"]${variant ? "[data-variant]" : ":not([data-variant])"}`)?.focus();
  }

  function check() {
    const q = current();
    const s = qs(q);
    if (s.done) return;
    let correct;
    if (q.type === "fill-blank") {
      if (!normalize(s.input)) return;
      correct = [].concat(q.answer).some((a) => normalize(a) === normalize(s.input));
    } else {
      if (!s.selected) return;
      correct = s.selected === q.answer;
    }
    if (correct) {
      s.done = true;
      s.correct = true;
      s.skipped = false;
      const score = record(q);
      const ind = INDEPENDENCE[independenceOf(s)];
      s.feedback = {
        type: "correct",
        html: `<p class="feedback__title">${icon("check")} ${pick(PRAISE)} <span class="muted small">${ind.mark} ${ind.zh} · +${score} 分</span></p><p>${esc(q.explanation)}</p>`,
      };
    } else {
      s.tries += 1;
      let detail = "";
      if (q.type === "fill-blank") {
        detail = s.hintLevel < maxHint ? "再檢查一次時態、主詞或拼字。也可以打開提示看看。" : "再檢查一次時態、主詞或拼字。";
      } else {
        s.wrongKeys = [...new Set([...(s.wrongKeys || []), s.selected])];
        detail = esc(q.options.find((o) => o.key === s.selected)?.feedback || "再讀一次題目，找找文本中的證據。");
        s.selected = null;
      }
      s.feedback = { type: "retry", html: `<p class="feedback__title">${icon("retry")} ${pick(ENCOURAGE)}</p><p lang="en">${detail}</p>` };
    }
    persist();
    renderQuestion(correct ? "next" : null);
    if (!correct) {
      const card = questionEl.querySelector(".q-card");
      card?.classList.add("shake");
      if (q.type === "fill-blank") questionEl.querySelector("#q-input")?.focus();
      else questionEl.querySelector(".option:not([disabled])")?.focus();
    }
  }

  function hint() {
    const q = current();
    const s = qs(q);
    if (s.done || s.hintLevel >= maxHint || s.hintLevel >= (q.hints || []).length) return;
    s.hintLevel += 1;
    const h = q.hints[s.hintLevel - 1];
    if (h.action === "replay") playListening(settings().speechRate);
    if (h.action === "replay-slow") playListening(0.7);
    if (q.type !== "essay" && s.hintLevel >= 4) {
      s.done = true;
      s.revealed = true;
      s.correct = false;
      const score = record(q);
      s.feedback = {
        type: "reveal",
        html: `<p class="feedback__title">${icon("book")} 完整解析</p><p>正確答案：<strong lang="en">${esc(q.type === "fill-blank" ? [].concat(q.answer)[0] : `${q.answer}. ${q.options.find((o) => o.key === q.answer)?.text || ""}`)}</strong></p><p>${esc(q.explanation)}</p><p class="muted small">看懂解析也是學習！本題 ${score} 分${q.variant_question_id ? "，答對下方變式題可再加分" : ""}。</p>`,
      };
    }
    persist();
    renderQuestion("hint");
  }

  function checkVariant() {
    const q = current();
    const s = qs(q);
    const vq = course.index.variants.get(q.variant_question_id);
    if (!vq || s.variant.done) return;
    let correct;
    if (vq.type === "fill-blank") {
      if (!normalize(s.variant.input)) return;
      correct = [].concat(vq.answer).some((a) => normalize(a) === normalize(s.variant.input));
    } else {
      if (!s.variant.selected) return;
      correct = s.variant.selected === vq.answer;
    }
    s.variant.tries += 1;
    if (correct) {
      s.variant.done = true;
      s.variant.correct = s.variant.tries === 1;
      const score = record(q);
      s.variant.feedback = { type: "correct", html: `${icon("check")} ${s.variant.correct ? `答對了！你已經學會這類題目。本題分數更新為 ${score} 分。` : "答對了！下次試著第一次就答對。"} <span lang="en">${esc(vq.explanation || "")}</span>` };
    } else {
      if (vq.type !== "fill-blank") {
        s.variant.wrongKeys = [...new Set([...(s.variant.wrongKeys || []), s.variant.selected])];
        s.variant.selected = null;
      }
      s.variant.feedback = { type: "retry", html: `${icon("retry")} 再對照上面的解析想一想，再試一次。` };
    }
    persist();
    renderQuestion();
  }

  function goNext() {
    const n = questions.length;
    for (let step = 1; step <= n; step += 1) {
      const i = (run.index + step) % n;
      if (!qs(questions[i]).done && i !== run.index) {
        run.index = i;
        persist();
        stopSpeaking();
        renderQuestion("start");
        questionEl.scrollIntoView({ block: "start", behavior: "auto" });
        return;
      }
    }
    finish();
  }

  function skip() {
    const q = current();
    const s = qs(q);
    s.skipped = true;
    const remaining = questions.filter((x) => !qs(x).done && x !== q);
    if (!remaining.length) {
      if (!confirm("這是最後一題了。要略過它並完成題組嗎？略過的題目不計分。")) return;
    } else {
      toast("已略過，稍後會再回到這題");
    }
    persist();
    goNext();
  }

  function finishWriting() {
    const q = current();
    const s = qs(q);
    if (!wordCount(s.essay.text)) return;
    s.essay.stage = "rubric";
    persist();
    renderQuestion("rubric");
  }

  async function submitEssay() {
    const q = current();
    const s = qs(q);
    const rubric = q.rubric_id ? await loadRubric(q.rubric_id) : null;
    const criteria = rubric?.criteria || [];
    const missing = criteria.filter((c) => !s.essay.rubric[c.name]);
    if (missing.length) {
      toast(`還有 ${missing.length} 個向度沒有自評`);
      return;
    }
    const total = criteria.reduce((t, c) => t + s.essay.rubric[c.name], 0);
    const maxTotal = criteria.length * 4 || 1;
    s.essay.score = Math.round((total / maxTotal) * (q.points || 16) * 10) / 10;
    s.done = true;
    s.correct = true;
    const target = q.word_target?.[level] || q.word_target?.standard || [80, 120];
    const words = wordCount(s.essay.text);
    const checks = s.essay.checks.length;
    const checklistLen = (q.scaffolds?.checklist || []).length;
    const tips = [];
    if (words < target[0]) tips.push(`字數 ${words}，比目標少 ${target[0] - words} 字，下次可以多加一個例子。`);
    else tips.push(`字數 ${words}，達到目標了！`);
    if (checks < checklistLen) tips.push(`自我檢核完成 ${checks}/${checklistLen} 項，看看還沒打勾的項目能不能補上。`);
    else tips.push("自我檢核全部完成，很完整！");
    const weakest = criteria.slice().sort((a, b) => s.essay.rubric[a.name] - s.essay.rubric[b.name])[0];
    if (weakest && s.essay.rubric[weakest.name] < 4) tips.push(`下一步：加強「${weakest.zh}」— 對照下方範文，看看它怎麼做。`);
    record(q);
    s.feedback = { type: "correct", html: `<p class="feedback__title">${icon("check")} 完成寫作！自評 ${total}/${maxTotal} · ${s.essay.score} 分</p><ul>${tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` };
    update((st) => { delete st.drafts[q.question_id]; });
    persist();
    renderQuestion("next");
  }

  function readAloud() {
    const q = current();
    const chunks = [stemOf(q).replace(/_{2,}/g, "blank")];
    if (q.options) q.options.forEach((o) => chunks.push(`${o.key}. ${o.text}`));
    speak(chunks, { rate: settings().speechRate, accent: settings().accent });
  }

  function readPassage() {
    const v = passageVariant();
    if (!v) return;
    speak(v.paragraphs, {
      rate: settings().speechRate,
      accent: settings().accent,
      onChunk: (i) => {
        passageEl.querySelectorAll("[data-para]").forEach((p) => p.classList.toggle("is-reading", Number(p.dataset.para) === i));
      },
      onDone: () => passageEl.querySelectorAll(".is-reading").forEach((p) => p.classList.remove("is-reading")),
    });
  }

  // ---------- Finish ----------
  function finish() {
    clearInterval(ticker);
    stopSpeaking();
    let score = 0;
    let max = 0;
    let independent = 0;
    let hintsUsed = 0;
    let correctCount = 0;
    questions.forEach((q) => {
      const s = qs(q);
      if (!getState().attempts[q.question_id] || !s.done) record(q);
      const a = getState().attempts[q.question_id];
      score += a.score;
      max += a.max;
      hintsUsed += s.hintLevel;
      if (a.independence === "independent" || a.independence === "self-corrected") independent += 1;
      if (s.correct) correctCount += 1;
    });
    const session = {
      set_id: set.set_id, course_id: course.course_id, unit_id: set.unit_id, title: set.title, unit_title: set.unit_title, skill: set.skill,
      date: todayISO(), ts: Date.now(), score: Math.round(score * 10) / 10, max, count: questions.length,
      correct: correctCount, independent, hintsUsed, duration: run.elapsed, level,
    };
    update((st) => {
      st.sessions.push(session);
      st.sessions = st.sessions.slice(-300);
      delete st.runs[setId];
      st.last = null;
      markActiveToday();
    });
    renderSummary(session);
  }

  function renderSummary(session) {
    const pct = session.max ? Math.round((session.score / session.max) * 100) : 0;
    const msg = pct >= 90 ? "太厲害了！這組題目你已經很熟練。" : pct >= 70 ? "做得很好！再複習幾題就更穩了。" : pct >= 40 ? "你已經跨出一大步，提示幫你學到了新方法。" : "完成就是進步！建議先用支援版再練一次。";
    root.querySelector(".practice").classList.add("practice--summary");
    root.querySelector(".practice-body").innerHTML = `
      <section class="summary card" aria-labelledby="summary-title">
        <p class="eyebrow">${skillChip(set.skill)} ${esc(set.title)}</p>
        <h2 id="summary-title" tabindex="-1">題組完成！</h2>
        <p class="lead">${msg}</p>
        <div class="stat-grid stat-grid--summary">
          <div class="stat-card"><span class="stat-card__value" data-count="${session.score}">${session.score}<small>/${session.max}</small></span><span class="stat-card__label">分數</span></div>
          <div class="stat-card"><span class="stat-card__value">${session.independent}<small>/${session.count}</small></span><span class="stat-card__label">獨立完成題數</span></div>
          <div class="stat-card"><span class="stat-card__value">${session.hintsUsed}</span><span class="stat-card__label">使用提示次數</span></div>
          <div class="stat-card"><span class="stat-card__value">${formatDuration(session.duration)}</span><span class="stat-card__label">用時</span></div>
        </div>
        <ol class="summary-list">
          ${questions.map((q, i) => {
            const a = getState().attempts[q.question_id];
            const ind = INDEPENDENCE[a.independence];
            return `<li><span class="summary-list__num">${i + 1}</span><span lang="en" class="summary-list__stem">${esc(q.stem)}</span><span class="badge badge--${a.independence === "independent" || a.independence === "self-corrected" ? "success" : a.independence === "skipped" ? "neutral" : "warning"}">${ind.mark} ${ind.zh}</span><span class="small">${a.score}/${a.max}</span></li>`;
          }).join("")}
        </ol>
        <fieldset class="reflection">
          <legend>想一想：今天最有幫助的是？</legend>
          <div class="pill-row">${["自己想出來的", "段落定位", "關鍵字提示", "範例句", "完整解析", "支援版文章"].map((t) => `<button type="button" class="pill" data-reflect="${t}" aria-pressed="false">${t}</button>`).join("")}</div>
        </fieldset>
        <div class="q-actions">
          <a class="button button--lg" href="#/report">看完整報告 ${icon("chart")}</a>
          <a class="button button--secondary button--lg" href="#/units">回單元列表</a>
          <button type="button" class="text-link" data-action="again">再練一次${hasSupport && level === "standard" && pct < 60 ? "（建議改用支援版）" : ""}</button>
        </div>
      </section>`;
    root.querySelector("[data-progress-text]").textContent = "完成";
    root.querySelector("[data-progress-bar]").style.width = "100%";
    const title = root.querySelector("#summary-title");
    title.focus();
    root.querySelectorAll("[data-reflect]").forEach((b) => b.addEventListener("click", () => {
      root.querySelectorAll("[data-reflect]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      root.querySelectorAll("[data-reflect]").forEach((x) => x.classList.toggle("is-selected", x === b));
      update((st) => { const last = st.sessions[st.sessions.length - 1]; if (last) last.reflection = b.dataset.reflect; });
      toast("謝謝分享，已記錄你的反思");
    }));
    root.querySelector('[data-action="again"]').addEventListener("click", () => {
      if (hasSupport && level === "standard" && pct < 60 && allowSwitch) update((st) => { st.levelPref[setId] = "support"; });
      renderPractice(root, ctx, setId);
    });
  }

  // ---------- Events ----------
  root.addEventListener("click", (event) => {
    const t = event.target;
    const gloss = t.closest(".gloss");
    if (gloss) return openGloss(gloss);
    const opt = t.closest("[data-option]");
    if (opt && !opt.disabled) return select(opt.dataset.option, opt.hasAttribute("data-variant"));
    const ins = t.closest("[data-insert]");
    if (ins) return insertText(ins.dataset.insert);
    const action = t.closest("[data-action]")?.dataset.action;
    if (!action) return;
    ({
      check, hint, skip, next: goNext, read: readAloud, "read-passage": readPassage,
      "check-variant": checkVariant, "finish-writing": finishWriting, "submit-essay": submitEssay,
      "back-to-write": () => { qs(current()).essay.stage = "write"; persist(); renderQuestion("write"); },
      flag: () => { const s = qs(current()); s.flagged = !s.flagged; persist(); if (s.done) record(current()); renderQuestion(); questionEl.querySelector('[data-action="flag"]')?.focus(); },
      play: () => playListening(settings().speechRate),
      "play-slow": () => playListening(0.7),
      "toggle-transcript-mode": () => { listen.transcriptMode = !listen.transcriptMode; stopSpeaking(); renderListening(); },
    })[action]?.();
  }, { signal });

  root.addEventListener("input", (event) => {
    const t = event.target;
    if (t.matches("[data-fill]")) {
      const s = qs(current());
      const target = t.hasAttribute("data-variant") ? s.variant : s;
      target.input = t.value;
      const btn = questionEl.querySelector(t.hasAttribute("data-variant") ? '[data-action="check-variant"]' : '[data-action="check"]');
      if (btn) btn.disabled = !normalize(t.value);
      persist();
    }
  }, { signal });

  root.addEventListener("change", (event) => {
    const t = event.target;
    if (t.matches("[data-level]")) {
      level = t.value;
      update((st) => { st.levelPref[setId] = level; });
      renderQuestion();
      passageEl?.querySelector(`[data-level][value="${level}"]`)?.focus();
    }
    if (t.matches("[data-check]")) {
      const s = qs(current());
      const i = Number(t.dataset.check);
      s.essay.checks = t.checked ? [...new Set([...s.essay.checks, i])] : s.essay.checks.filter((x) => x !== i);
      persist();
    }
    if (t.matches("[data-rubric]")) {
      qs(current()).essay.rubric[t.dataset.rubric] = Number(t.value);
      persist();
    }
  }, { signal });

  root.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.matches("[data-fill]")) {
      event.preventDefault();
      if (event.target.hasAttribute("data-variant")) checkVariant(); else check();
    }
  }, { signal });

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    if (document.querySelector("dialog[open]")) return;
    if (event.key === "Escape") return closeGloss();
    const typing = event.target.closest("input[type=text], input[type=search], textarea, select");
    if (typing) return;
    const q = current();
    if (!q || root.querySelector(".practice--summary")) return;
    const s = qs(q);
    const key = event.key.toLowerCase();
    if (q.options && !s.done) {
      const idx = "abcd".indexOf(key) !== -1 ? "abcd".indexOf(key) : "1234".indexOf(key);
      if (idx !== -1 && q.options[idx]) {
        const btn = questionEl.querySelector(`[data-option="${q.options[idx].key}"]:not([data-variant])`);
        if (btn && !btn.disabled) { event.preventDefault(); select(q.options[idx].key); }
        return;
      }
    }
    const onOption = event.target.closest("[data-option]");
    if (key === "enter" && onOption) {
      // Enter on a chosen option = check that answer (Space still just selects).
      event.preventDefault();
      if (onOption.hasAttribute("data-variant")) { select(onOption.dataset.option, true); checkVariant(); }
      else { select(onOption.dataset.option); check(); }
      return;
    }
    if (key === "enter" && !event.target.closest("button, a, summary, label")) { event.preventDefault(); if (s.done) goNext(); else if (q.type !== "essay") check(); }
    else if (key === "h") { event.preventDefault(); hint(); }
    else if (key === "n" && s.done) { event.preventDefault(); goNext(); }
    else if (key === "r" && ttsAvailable) { event.preventDefault(); readAloud(); }
  }, { signal });

  document.addEventListener("click", (event) => {
    if (!popover.hidden && !event.target.closest("[data-popover], .gloss")) closeGloss();
  }, { signal });

  function insertText(text) {
    const ta = questionEl.querySelector("#essay-text");
    if (!ta || ta.readOnly) return;
    const start = ta.selectionStart ?? ta.value.length;
    const before = ta.value.slice(0, start);
    const after = ta.value.slice(ta.selectionEnd ?? start);
    const pad = before && !/\s$/.test(before) ? " " : "";
    // A frame like "In my opinion, ___." is inserted with the caret placed in the blank.
    const [head, tail = ""] = text.split(/_{2,}/);
    const hasBlank = /_{2,}/.test(text);
    const insert = hasBlank ? `${pad}${head}${tail}${tail ? " " : ""}` : `${pad}${text}${/^[\s.,!?;:]/.test(after) ? "" : " "}`;
    ta.value = before + insert + after;
    const caret = hasBlank ? before.length + pad.length + head.length : before.length + insert.length;
    ta.focus();
    ta.setSelectionRange(caret, caret);
    ta.dispatchEvent(new Event("input"));
  }

  let glossOrigin = null;
  function openGloss(btn) {
    const entry = (passage?.glossary || []).find((g) => g.word === btn.dataset.gloss);
    if (!entry) return;
    glossOrigin = btn;
    popover.innerHTML = `
      <div class="popover__head"><strong lang="en">${esc(entry.word)}</strong> <span class="muted small">${esc(entry.pos)}</span>
        <button type="button" class="icon-button icon-button--sm" data-close-gloss aria-label="關閉">${icon("close")}</button></div>
      <p class="popover__zh">${esc(entry.zh)}</p>
      <p class="small" lang="en"><em>${esc(entry.example)}</em></p>
      ${ttsAvailable ? `<button type="button" class="button button--secondary button--sm" data-say>${icon("speaker")}<span>發音</span></button>` : ""}`;
    popover.hidden = false;
    const r = btn.getBoundingClientRect();
    const host = root.querySelector(".practice").getBoundingClientRect();
    const width = Math.min(300, window.innerWidth - 32);
    popover.style.width = `${width}px`;
    popover.style.left = `${Math.max(16 - host.left, Math.min(r.left - host.left, window.innerWidth - host.left - width - 16))}px`;
    popover.style.top = `${r.bottom - host.top + 8}px`;
    popover.querySelector("[data-close-gloss]").addEventListener("click", closeGloss);
    popover.querySelector("[data-say]")?.addEventListener("click", () => speak([entry.word, entry.example], { rate: settings().speechRate, accent: settings().accent }));
    popover.querySelector("[data-close-gloss]").focus();
  }
  function closeGloss() {
    if (popover.hidden) return;
    popover.hidden = true;
    glossOrigin?.focus();
    glossOrigin = null;
  }

  document.addEventListener("settings-changed", () => { if (!root.querySelector(".practice--summary")) renderPassage(); }, { signal });

  renderQuestion();
}
