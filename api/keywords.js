import crypto from 'crypto';
import { requireAuth } from './_lib/auth.js';

const BASE_URL = 'https://api.naver.com';

function makeSignature(secretKey, method, path, timestamp) {
  const message = `${timestamp}.${method}.${path}`;
  return crypto.createHmac('sha256', secretKey).update(message).digest('base64');
}

function getHeaders(accessLicense, secretKey, customerId) {
  const timestamp = Date.now().toString();
  const signature = makeSignature(secretKey, 'GET', '/keywordstool', timestamp);
  return {
    'Content-Type': 'application/json',
    'X-Timestamp': timestamp,
    'X-API-KEY': accessLicense,
    'X-Customer': customerId,
    'X-Signature': signature,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!requireAuth(req, res)) return;

  const { seed, hintKeywords } = req.body || {};
  const accessLicense = process.env.NAVER_ACCESS_LICENSE;
  const secretKey = process.env.NAVER_SECRET_KEY;
  const customerId = process.env.NAVER_CUSTOMER_ID;

  if (!accessLicense || !secretKey || !customerId) {
    return res.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
  }

  try {
    // Naver 검색광고 API 제약: hintKeywords 는 공백/쉼표/빈 문자열 불가
    // 공백 제거 → 빈 문자열 제거 → dedup → 최대 5개로 제한
    const raw = hintKeywords || [seed];
    const keywords = [...new Set(
      (Array.isArray(raw) ? raw : [raw])
        .map(k => String(k || '').replace(/\s+/g, ''))
        .filter(Boolean)
    )].slice(0, 5);
    if (!keywords.length) {
      return res.status(400).json({ error: '유효한 키워드가 없습니다 (공백 제거 후 비어있음).' });
    }
    const params = new URLSearchParams({
      hintKeywords: keywords.join(','),
      showDetail: '1',
    });

    const path = `/keywordstool?${params.toString()}`;
    const fullUrl = `${BASE_URL}${path}`;
    const timestamp = Date.now().toString();
    const signature = makeSignature(secretKey, 'GET', '/keywordstool', timestamp);

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Timestamp': timestamp,
        'X-API-KEY': accessLicense,
        'X-Customer': customerId,
        'X-Signature': signature,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `네이버 API 오류: ${errText}` });
    }

    const data = await response.json();
    const keywords_result = (data.keywordList || []).map(item => ({
      keyword: item.relKeyword,
      monthlyPcQcCnt: item.monthlyPcQcCnt === '< 10' ? 5 : Number(item.monthlyPcQcCnt) || 0,
      monthlyMobileQcCnt: item.monthlyMobileQcCnt === '< 10' ? 5 : Number(item.monthlyMobileQcCnt) || 0,
      monthlyAvePcClkCnt: Number(item.monthlyAvePcClkCnt) || 0,
      monthlyAveMobileClkCnt: Number(item.monthlyAveMobileClkCnt) || 0,
      compIdx: item.compIdx,
      plAvgDepth: Number(item.plAvgDepth) || 0,
    })).map(item => ({
      ...item,
      totalSearch: item.monthlyPcQcCnt + item.monthlyMobileQcCnt,
      pcRatio: item.monthlyPcQcCnt + item.monthlyMobileQcCnt > 0
        ? Math.round((item.monthlyPcQcCnt / (item.monthlyPcQcCnt + item.monthlyMobileQcCnt)) * 100)
        : 0,
    }));

    keywords_result.sort((a, b) => b.totalSearch - a.totalSearch);
    return res.status(200).json({ keywords: keywords_result });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
