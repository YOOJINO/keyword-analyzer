import { readJson, writeJson } from './github.js';

function safeUserId(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function pathFor(userId) {
  return `data/competitor/${safeUserId(userId)}.json`;
}

function emptyMonths(year) {
  const months = {};
  for (let m = 1; m <= 12; m++) {
    months[`${year}-${String(m).padStart(2, '0')}`] = {};
  }
  return months;
}

function genProjectId() {
  return 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

function defaultProject(year) {
  return {
    id: genProjectId(),
    name: '프로젝트 1',
    year,
    keywords: [],
    data: emptyMonths(year),
  };
}

function defaultState(year) {
  const proj = defaultProject(year);
  return {
    projects: [proj],
    activeProjectId: proj.id,
  };
}

function ensureProjectStructure(p, year) {
  if (!p.id) p.id = genProjectId();
  if (!p.name) p.name = '제목 없음';
  if (!p.year) p.year = year;
  if (!Array.isArray(p.keywords)) p.keywords = [];
  if (!p.data || typeof p.data !== 'object') p.data = {};
  // 누락된 월 채우기
  for (let m = 1; m <= 12; m++) {
    const key = `${p.year}-${String(m).padStart(2, '0')}`;
    if (!p.data[key]) p.data[key] = {};
  }
  return p;
}

export async function loadState(userId) {
  const year = new Date().getFullYear();
  const data = await readJson(pathFor(userId));
  if (!data) return defaultState(year);

  // 옛 단일 프로젝트 형식 → 새 멀티 프로젝트 형식 마이그레이션
  if (Array.isArray(data.keywords) && !Array.isArray(data.projects)) {
    const proj = ensureProjectStructure({
      id: genProjectId(),
      name: '프로젝트 1',
      year: data.year || year,
      keywords: data.keywords,
      data: data.data || {},
    }, year);
    return { projects: [proj], activeProjectId: proj.id };
  }

  if (!Array.isArray(data.projects) || data.projects.length === 0) {
    return defaultState(year);
  }

  data.projects = data.projects.map(p => ensureProjectStructure(p, year));
  if (!data.activeProjectId || !data.projects.find(p => p.id === data.activeProjectId)) {
    data.activeProjectId = data.projects[0].id;
  }
  return data;
}

export async function saveState(userId, state, message) {
  return writeJson(pathFor(userId), state, message || `Update competitor data for ${userId}`);
}
