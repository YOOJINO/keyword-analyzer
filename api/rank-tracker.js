import { requireAuth } from './_lib/auth.js';
import { loadState, saveState, ensureState } from './_lib/rank-tracker.js';

function hasRankPermission(user) {
  if (user.role === 'admin') return true;
  return Array.isArray(user.permissions) && user.permissions.includes('rank');
}

export default async function handler(req, res) {
  const user = requireAuth(req, res);
  if (!user) return;
  if (!hasRankPermission(user)) {
    return res.status(403).json({ error: '상위노출 추적 권한이 없습니다.' });
  }

  try {
    // 현재 상태 조회
    if (req.method === 'GET') {
      const state = await loadState(user.id);
      return res.status(200).json(state);
    }

    // 키워드/URL 행 저장 (사용자가 표를 편집)
    if (req.method === 'PUT') {
      const body = req.body || {};
      if (!Array.isArray(body.rows)) {
        return res.status(400).json({ error: 'rows 배열이 필요합니다.' });
      }
      // 키워드와 URL 둘 다 빈 행은 버림
      const rows = body.rows.filter(r => (r.keyword || '').trim() || (r.url || '').trim());
      const prev = await loadState(user.id);
      const state = ensureState({ rows, job: prev.job });
      const saved = await saveState(user.id, state);
      return res.status(200).json(saved);
    }

    // 트리거: 크롤링 작업 요청 (워커가 이 표시를 보고 크롤링 실행)
    if (req.method === 'POST') {
      const { action } = req.body || {};
      if (action !== 'trigger') {
        return res.status(400).json({ error: 'action=trigger 가 필요합니다.' });
      }
      const state = await loadState(user.id);
      if (!state.rows.length) {
        return res.status(400).json({ error: '추적할 키워드/URL을 먼저 입력해주세요.' });
      }
      state.job = {
        status: 'pending',
        requestedAt: new Date().toISOString(),
        startedAt: null,
        finishedAt: null,
        message: '크롤링 워커 대기 중…',
      };
      const saved = await saveState(user.id, state, `Trigger rank crawl for ${user.id}`);
      return res.status(200).json(saved);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
