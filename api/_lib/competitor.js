import { readJson, writeJson } from './github.js';

function safeUserId(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function pathFor(userId) {
  return `data/competitor/${safeUserId(userId)}.json`;
}

function emptyData(year) {
  const months = {};
  for (let m = 1; m <= 12; m++) {
    months[`${year}-${String(m).padStart(2, '0')}`] = {};
  }
  return { keywords: [], data: months, year };
}

export async function loadCompetitor(userId, year) {
  const data = await readJson(pathFor(userId));
  if (!data) return emptyData(year);
  // 연도 변경되면 새 연도 셀 채우기
  if (data.year !== year) {
    const newData = emptyData(year);
    newData.keywords = data.keywords || [];
    return newData;
  }
  // 누락된 월 보정
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`;
    if (!data.data[key]) data.data[key] = {};
  }
  return data;
}

export async function saveCompetitor(userId, payload, message) {
  return writeJson(pathFor(userId), payload, message || `Update competitor data for ${userId}`);
}
