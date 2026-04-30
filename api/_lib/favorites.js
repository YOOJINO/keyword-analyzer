import { readJson, writeJson } from './github.js';

function safeUserId(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function pathFor(userId) {
  return `data/favorites/${safeUserId(userId)}.json`;
}

export async function loadFavorites(userId) {
  const data = await readJson(pathFor(userId));
  if (!data || !Array.isArray(data.favorites)) return { favorites: [] };
  return data;
}

export async function saveFavorites(userId, data) {
  return writeJson(pathFor(userId), data, `Update favorites for ${userId}`);
}

export async function addFavorite(userId, keyword) {
  const data = await loadFavorites(userId);
  const kw = String(keyword || '').trim();
  if (!kw) return data;
  if (!data.favorites.includes(kw)) {
    data.favorites.push(kw);
    await saveFavorites(userId, data);
  }
  return data;
}

export async function removeFavorite(userId, keyword) {
  const data = await loadFavorites(userId);
  const kw = String(keyword || '').trim();
  data.favorites = data.favorites.filter(k => k !== kw);
  await saveFavorites(userId, data);
  return data;
}
