// Loads course content from /content. Teachers change JSON files only; no code edits needed.
import { todayISO } from "./ui.js";

const cache = new Map();

function getJSON(path) {
  if (!cache.has(path)) {
    cache.set(path, fetch(path, { cache: "no-cache" }).then((res) => {
      if (!res.ok) throw new Error(`無法載入 ${path}（${res.status}）`);
      return res.json();
    }).catch((err) => {
      cache.delete(path);
      throw err;
    }));
  }
  return cache.get(path);
}

export const loadCatalog = () => getJSON("content/catalog.json");

export async function loadClasses() {
  const data = await getJSON("content/classes.json");
  return (data.classes || []).filter((c) => !c.archived);
}

export async function findClass(code) {
  if (!code) return null;
  const classes = await loadClasses();
  const needle = String(code).trim().toLowerCase();
  return classes.find((c) => c.class_code.toLowerCase() === needle) || null;
}

export async function loadRubric(id) {
  const data = await getJSON("content/rubrics.json");
  return (data.rubrics || []).find((r) => r.rubric_id === id) || null;
}

const courseCache = new Map();

export async function loadCourse(courseId) {
  if (courseCache.has(courseId)) return courseCache.get(courseId);
  const catalog = await loadCatalog();
  const entry = catalog.courses.find((c) => c.course_id === courseId);
  if (!entry) throw new Error(`找不到課程 ${courseId}`);
  const coursePath = `content/${entry.path}`;
  const base = coursePath.slice(0, coursePath.lastIndexOf("/") + 1);
  const course = await getJSON(coursePath);
  const unitFiles = await Promise.all((course.units || []).map((file) => getJSON(base + file)));

  const index = { questions: new Map(), variants: new Map(), sets: new Map(), passages: new Map() };
  const units = unitFiles
    .map((file) => {
      const unit = file.unit;
      (file.passages || []).forEach((p) => index.passages.set(p.passage_id, p));
      (file.questions || []).forEach((q) => index.questions.set(q.question_id, { ...q, unit_id: unit.unit_id }));
      (file.variants || []).forEach((q) => index.variants.set(q.question_id, { ...q, unit_id: unit.unit_id }));
      const sets = (file.sets || []).map((s) => {
        // Only published questions reach students (draft / review stay hidden).
        const questionIds = s.question_ids.filter((id) => {
          const q = index.questions.get(id);
          return q && !["draft", "review"].includes(q.status);
        });
        const set = { ...s, question_ids: questionIds, unit_id: unit.unit_id, unit_title: unit.title };
        index.sets.set(s.set_id, set);
        return set;
      });
      return { ...unit, sets };
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const result = { ...course, title: course.title || entry.title, entry, units, index };
  courseCache.set(courseId, result);
  return result;
}

// Whether a set offers a lower-Lexile / scaffolded "support" version.
export function setHasSupport(course, set) {
  const passage = set.passage_id ? course.index.passages.get(set.passage_id) : null;
  if (passage?.variants?.some((v) => v.level === "support")) return true;
  return set.question_ids.some((id) => {
    const q = course.index.questions.get(id);
    return q && (q.stem_support || q.word_target?.support);
  });
}

// Release status of a unit for a class: open / locked (with date) / hidden.
export function unitRelease(cls, unitId) {
  if (!cls) return { open: true };
  const rel = (cls.released_units || []).find((r) => r.unit_id === unitId);
  if (!rel) return { open: false, reason: "老師尚未開放" };
  const today = todayISO();
  if (rel.open_date && rel.open_date > today) return { open: false, reason: `${rel.open_date} 開放`, openDate: rel.open_date };
  return { open: true, dueDate: rel.due_date || null };
}
