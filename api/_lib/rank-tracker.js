import { readJson, writeJson } from './github.js';

// 상위노출 추적 데이터 계층 (competitor.js 와 동일한 git-as-DB 패턴)
// 저장 위치: data/rank-tracker/<userId>.json

function safeUserId(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function pathFor(userId) {
  return `data/rank-tracker/${safeUserId(userId)}.json`;
}

function genRowId() {
  return 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

function emptyJob() {
  return {
    status: 'idle',        // idle | pending | running | done | error
    requestedAt: null,     // 트리거 버튼 누른 시각
    startedAt: null,       // 워커가 작업 시작한 시각
    finishedAt: null,      // 워커가 작업 끝낸 시각
    message: '',           // 진행/오류 메시지
  };
}

function defaultState() {
  return { rows: [], job: emptyJob() };
}

// 한 행: { id, keyword, url, kind, rank, title, postedAt, checkedAt,
//          likeCount, commentCount, viewCount }
function ensureRow(r) {
  return {
    id: r && r.id ? String(r.id) : genRowId(),
    keyword: String((r && r.keyword) || '').trim(),
    url: String((r && r.url) || '').trim(),
    kind: (r && r.kind) || '',          // 블로그 / 카페 (크롤러가 채움)
    rank: (r && typeof r.rank === 'number') ? r.rank : null,
    title: (r && r.title) || '',
    postedAt: (r && r.postedAt) || '',
    checkedAt: (r && r.checkedAt) || null,
    // 공감수 / 댓글수 / 조회수 / 노출 — 확장프로그램 크롤러가 채움
    likeCount: (r && typeof r.likeCount === 'number') ? r.likeCount : null,
    commentCount: (r && typeof r.commentCount === 'number') ? r.commentCount : null,
    viewCount: (r && typeof r.viewCount === 'number') ? r.viewCount : null,
    exposed: (r && r.exposed != null) ? r.exposed : null,
  };
}

export function ensureState(data) {
  if (!data || typeof data !== 'object') return defaultState();
  const rows = Array.isArray(data.rows) ? data.rows.map(ensureRow) : [];
  const job = (data.job && typeof data.job === 'object')
    ? { ...emptyJob(), ...data.job }
    : emptyJob();
  return { rows, job };
}

export async function loadState(userId) {
  const data = await readJson(pathFor(userId));
  return ensureState(data);
}

export async function saveState(userId, state, message) {
  const clean = ensureState(state);
  await writeJson(pathFor(userId), clean, message || `Update rank-tracker data for ${userId}`);
  return clean;
}
