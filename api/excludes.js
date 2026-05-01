import { requireAuth } from './_lib/auth.js';
import { loadExcludes, saveExcludes } from './_lib/excludes.js';

export default async function handler(req, res) {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    if (req.method === 'GET') {
      const data = await loadExcludes(user.id);
      return res.status(200).json(data);
    }
    if (req.method === 'PUT') {
      const { excludes } = req.body || {};
      if (!Array.isArray(excludes)) return res.status(400).json({ error: 'excludes 배열이 필요합니다.' });
      const data = await saveExcludes(user.id, excludes);
      return res.status(200).json(data);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
