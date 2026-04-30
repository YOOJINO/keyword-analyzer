import { requireAuth } from './_lib/auth.js';
import { loadCompetitor, saveCompetitor } from './_lib/competitor.js';

function hasCompetitorPermission(user) {
  if (user.role === 'admin') return true;
  return Array.isArray(user.permissions) && user.permissions.includes('competitor');
}

export default async function handler(req, res) {
  const user = requireAuth(req, res);
  if (!user) return;
  if (!hasCompetitorPermission(user)) {
    return res.status(403).json({ error: '경쟁사 분석 권한이 없습니다.' });
  }

  const year = Number(req.query.year) || new Date().getFullYear();

  try {
    if (req.method === 'GET') {
      const data = await loadCompetitor(user.id, year);
      return res.status(200).json(data);
    }

    if (req.method === 'PUT') {
      const body = req.body || {};
      if (!Array.isArray(body.keywords)) {
        return res.status(400).json({ error: 'keywords 배열이 필요합니다.' });
      }
      // 키워드 중복 제거 + 빈 값 제거
      const keywords = [...new Set(body.keywords.map(k => String(k).trim()).filter(Boolean))];
      const existing = await loadCompetitor(user.id, year);
      const payload = {
        year,
        keywords,
        data: body.data && typeof body.data === 'object' ? body.data : existing.data,
      };
      // 월별 데이터에서 사라진 키워드 정리
      for (const month of Object.keys(payload.data)) {
        const monthData = payload.data[month] || {};
        const cleaned = {};
        for (const kw of keywords) {
          if (kw in monthData) cleaned[kw] = monthData[kw];
        }
        payload.data[month] = cleaned;
      }
      await saveCompetitor(user.id, payload);
      return res.status(200).json(payload);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
