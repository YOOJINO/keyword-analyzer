import { getAuthFromReq, signToken, setAuthCookie } from './_lib/auth.js';
import { findUser } from './_lib/users.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = getAuthFromReq(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  if (!auth.impersonatedBy) return res.status(400).json({ error: '전환 상태가 아닙니다.' });

  try {
    const original = await findUser(auth.impersonatedBy);
    if (!original) return res.status(404).json({ error: '원래 관리자 계정을 찾을 수 없습니다.' });

    const permissions = original.role === 'admin'
      ? ['category', 'keyword', 'competitor']
      : (original.permissions || []);

    const token = signToken({
      id: original.id,
      role: original.role,
      permissions,
    });
    setAuthCookie(res, token);
    return res.status(200).json({
      ok: true,
      user: { id: original.id, role: original.role, permissions },
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
