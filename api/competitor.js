import { requireAuth } from './_lib/auth.js';
import { loadState, saveState } from './_lib/competitor.js';

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

  try {
    if (req.method === 'GET') {
      const state = await loadState(user.id);
      return res.status(200).json(state);
    }

    if (req.method === 'PUT') {
      const body = req.body || {};
      if (!Array.isArray(body.projects)) {
        return res.status(400).json({ error: 'projects 배열이 필요합니다.' });
      }
      // 각 프로젝트의 keywords / data 정리
      const cleaned = body.projects.map(p => {
        const keywords = [...new Set((p.keywords || []).map(k => String(k).trim()).filter(Boolean))];
        const data = (p.data && typeof p.data === 'object') ? p.data : {};
        for (const month of Object.keys(data)) {
          const monthData = data[month] || {};
          const cleanedMonth = {};
          for (const kw of keywords) {
            if (kw in monthData) cleanedMonth[kw] = monthData[kw];
          }
          data[month] = cleanedMonth;
        }
        const out = {
          id: p.id,
          name: String(p.name || '제목 없음').slice(0, 80),
          keywords,
          data,
          lastQueryDate: p.lastQueryDate || null,
          thresholds: p.thresholds && typeof p.thresholds === 'object' ? p.thresholds : null,
        };
        // 새 스키마: startMonth/endMonth
        if (p.startMonth && /^\d{4}-\d{2}$/.test(p.startMonth)) out.startMonth = p.startMonth;
        if (p.endMonth && /^\d{4}-\d{2}$/.test(p.endMonth)) out.endMonth = p.endMonth;
        // 구버전 호환: year 만 있으면 보존
        if (!out.startMonth && p.year) out.year = Number(p.year);
        return out;
      });
      const activeProjectId = body.activeProjectId && cleaned.find(p => p.id === body.activeProjectId)
        ? body.activeProjectId
        : (cleaned[0]?.id || null);
      const state = { projects: cleaned, activeProjectId };
      await saveState(user.id, state);
      return res.status(200).json(state);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
