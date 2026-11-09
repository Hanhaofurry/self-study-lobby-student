// Scoring rules, set status, mastery, and next-step recommendations.
import { getState } from "./store.js";
import { subSkillLabel, SKILLS } from "./ui.js";

// Points out of 10 (scaled by the question's points):
//  no hint, first try 10 · each wrong try -2 · hint1 -1 · hint2 -3 · hint3 -5
//  total penalty capped at 7 (min 3) · full solution (hint 4) = 3, +3 if the variant is answered correctly.
const HINT_PENALTY = [0, 1, 3, 5];

export function scoreQuestion({ correct, tries = 0, hintLevel = 0, variantCorrect = false, skipped = false, mode = "practice", points = 10 }) {
  if (skipped) return 0;
  let base;
  if (hintLevel >= 4) {
    base = mode === "no-penalty" ? 10 : 3 + (variantCorrect ? 3 : 0);
  } else if (!correct) {
    base = 0;
  } else if (mode === "no-penalty") {
    base = 10;
  } else {
    const penalty = HINT_PENALTY[hintLevel] + tries * 2;
    base = 10 - Math.min(penalty, 7);
  }
  return Math.round(base * points) / 10;
}

export function independenceOf({ correct, tries = 0, hintLevel = 0, skipped = false }) {
  if (skipped) return "skipped";
  if (hintLevel >= 4) return "full";
  if (!correct) return "skipped";
  if (hintLevel === 3) return "moderate";
  if (hintLevel >= 1) return "light";
  if (tries > 0) return "self-corrected";
  return "independent";
}

export const INDEPENDENCE = {
  independent: { zh: "獨立完成", mark: "★" },
  "self-corrected": { zh: "自我修正", mark: "☆" },
  light: { zh: "少量協助", mark: "◐" },
  moderate: { zh: "中度協助", mark: "◑" },
  full: { zh: "完整鷹架", mark: "●" },
  skipped: { zh: "未完成", mark: "—" },
};

const SOLID = new Set(["independent", "self-corrected"]);

export function needsReview(attempt) {
  if (!attempt) return false;
  if (attempt.flagged) return true;
  if (attempt.skill === "writing") return attempt.max ? attempt.score / attempt.max < 0.5 : false;
  return !SOLID.has(attempt.independence) && attempt.independence !== "light";
}

export function setStatus(set) {
  const { attempts, runs } = getState();
  const done = set.question_ids.filter((id) => attempts[id]);
  if (runs[set.set_id]) return "in-progress";
  if (!done.length) return "not-started";
  if (done.length < set.question_ids.length) return "in-progress";
  if (done.some((id) => needsReview(attempts[id]))) return "review";
  return "done";
}

export const STATUS = {
  "not-started": { zh: "未開始", cls: "neutral" },
  "in-progress": { zh: "進行中", cls: "accent" },
  review: { zh: "需複習", cls: "warning" },
  done: { zh: "已完成", cls: "success" },
};

export function unitProgress(unit) {
  const { attempts } = getState();
  const all = unit.sets.flatMap((s) => s.question_ids);
  if (!all.length) return 0;
  return all.filter((id) => attempts[id]).length / all.length;
}

export function courseAttempts(courseId) {
  return Object.values(getState().attempts).filter((a) => !courseId || a.course_id === courseId);
}

// Mastery = share of attempts finished independently or by self-correction.
export function masteryBy(attempts, key) {
  const groups = {};
  attempts.forEach((a) => {
    const k = a[key];
    groups[k] ||= { total: 0, solid: 0, score: 0, max: 0 };
    groups[k].total += 1;
    // Writing is judged by the rubric (hints and tools are never penalised); other skills by independence.
    if (a.skill === "writing") groups[k].solid += a.max ? a.score / a.max : 0;
    else if (SOLID.has(a.independence)) groups[k].solid += 1;
    groups[k].score += a.score || 0;
    groups[k].max += a.max || 0;
  });
  Object.values(groups).forEach((g) => { g.rate = g.total ? g.solid / g.total : 0; });
  return groups;
}

export function lastSessionFor(setId) {
  const sessions = getState().sessions.filter((s) => s.set_id === setId);
  return sessions[sessions.length - 1] || null;
}

// Suggest the level based on the last attempt: <60% → support.
export function recommendedLevel(setId, cls) {
  const last = lastSessionFor(setId);
  if (last && last.max && last.score / last.max < 0.6) return { level: "support", why: "依你上次的表現推薦" };
  if (last && last.max && last.score / last.max >= 0.9) return { level: "standard", why: "上次表現很好，維持標準版" };
  return { level: cls?.default_level || "standard", why: cls ? "老師建議的預設版本" : "預設版本" };
}

// 1–3 concrete next steps.
export function nextSteps(course, isOpen) {
  if (!course) return [];
  const steps = [];
  const attempts = courseAttempts(course.course_id);
  const bySub = masteryBy(attempts, "sub_skill");
  const weak = Object.entries(bySub)
    .filter(([, g]) => g.total >= 1 && g.rate < 0.7)
    .sort((a, b) => a[1].rate - b[1].rate);

  if (weak.length) {
    const [sub, g] = weak[0];
    const sample = attempts.find((a) => a.sub_skill === sub);
    const set = sample && course.index.sets.get(sample.set_id);
    if (set) {
      steps.push({
        kind: "review",
        title: `複習：${subSkillLabel(sub)}`,
        body: `這類題目獨立完成率 ${Math.round(g.rate * 100)}%。建議用支援版再練一次「${set.title}」。`,
        setId: set.set_id,
        level: "support",
      });
    }
  }

  const openSets = course.units.filter((u) => isOpen(u.unit_id)).flatMap((u) => u.sets);
  const inProgress = openSets.find((s) => setStatus(s) === "in-progress");
  if (inProgress) {
    steps.push({ kind: "continue", title: "繼續未完成的題組", body: `「${inProgress.title}」還差一點就完成了。`, setId: inProgress.set_id });
  }
  const fresh = openSets.find((s) => setStatus(s) === "not-started");
  if (fresh) {
    const skill = SKILLS[fresh.skill]?.zh || fresh.skill;
    steps.push({ kind: "new", title: `開始新的${skill}練習`, body: `${fresh.unit_title} · ${fresh.title}（約 ${fresh.estimated_minutes || 10} 分鐘）`, setId: fresh.set_id });
  }
  if (!steps.length && openSets.length) {
    const writing = openSets.find((s) => s.skill === "writing");
    steps.push({ kind: "challenge", title: "全部完成了，太棒了！", body: writing ? `試著挑戰寫作「${writing.title}」的進階字數目標。` : "可以重做任一題組，試著完全不用提示。", setId: writing?.set_id || openSets[0].set_id });
  }
  return steps.slice(0, 3);
}
