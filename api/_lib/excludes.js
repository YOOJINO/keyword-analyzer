import { readJson, writeJson } from './github.js';

function safeUserId(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function pathFor(userId) {
  return `data/excludes/${safeUserId(userId)}.json`;
}

export async function loadExcludes(userId) {
  const data = await readJson(pathFor(userId));
  if (!data || !Array.isArray(data.excludes)) return { excludes: [] };
  return data;
}

export async function saveExcludes(userId, excludes) {
  const cleaned = [...new Set(
    (Array.isArray(excludes) ? excludes : [])
      .map(k => String(k || '').trim())
      .filter(Boolean)
  )];
  await writeJson(pathFor(userId), { excludes: cleaned }, `Update excludes for ${userId}`);
  return { excludes: cleaned };
}
