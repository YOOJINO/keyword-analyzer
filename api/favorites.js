import { requireAuth } from './_lib/auth.js';
import { loadFavorites, addFavorite, removeFavorite } from './_lib/favorites.js';

export default async function handler(req, res) {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    if (req.method === 'GET') {
      const data = await loadFavorites(user.id);
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const { keyword } = req.body || {};
      if (!keyword) return res.status(400).json({ error: 'keyword가 필요합니다.' });
      const data = await addFavorite(user.id, keyword);
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      const { keyword } = req.body || {};
      if (!keyword) return res.status(400).json({ error: 'keyword가 필요합니다.' });
      const data = await removeFavorite(user.id, keyword);
      return res.status(200).json(data);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
