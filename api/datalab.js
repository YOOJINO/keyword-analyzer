import { requireAuth } from './_lib/auth.js';

const DATALAB_URL = 'https://openapi.naver.com/v1/datalab/search';

/**
 * 네이버 데이터랩 검색어 트렌드 API
 * 입력: { keywords: string[], startDate, endDate, timeUnit }
 *  - keywords: 1~5개 (네이버 한도)
 *  - startDate, endDate: 'YYYY-MM-DD'
 *  - timeUnit: 'date' | 'week' | 'month' (기본 'month')
 * 반환: { results: [{ title, keywords, data: [{period, ratio}] }] }
 *  - ratio 는 0~100 상대지수 (해당 기간 내 최대치 = 100)
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res)) return;

  const clientId = process.env.NAVER_DATALAB_CLIENT_ID;
  const clientSecret = process.env.NAVER_DATALAB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: '데이터랩 API 키가 설정되지 않았습니다 (NAVER_DATALAB_CLIENT_ID / SECRET).' });
  }

  const body = req.body || {};
  const { keywords, startDate, endDate, timeUnit = 'month' } = body;
  if (!Array.isArray(keywords) || !keywords.length) {
    return res.status(400).json({ error: 'keywords 배열이 필요합니다.' });
  }
  if (keywords.length > 5) {
    return res.status(400).json({ error: '키워드는 최대 5개까지 가능합니다.' });
  }
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate, endDate 가 필요합니다.' });
  }

  // 키워드별 단일 그룹 (개별 트렌드 보기 위함)
  const keywordGroups = keywords.map(kw => ({ groupName: kw, keywords: [kw] }));

  try {
    const resp = await fetch(DATALAB_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
      body: JSON.stringify({ startDate, endDate, timeUnit, keywordGroups }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ error: `데이터랩 API 오류: ${text}` });
    }
    const data = await resp.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
