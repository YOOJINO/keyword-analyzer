import { getAuthFromReq } from './_lib/auth.js';

export default function handler(req, res) {
  const user = getAuthFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const permissions = user.role === 'admin' ? ['category', 'keyword', 'competitor'] : (user.permissions || []);
  return res.status(200).json({ user: { id: user.id, role: user.role, permissions } });
}
