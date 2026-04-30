import { getAuthFromReq, signToken, setAuthCookie } from './_lib/auth.js';
import { findUser } from './_lib/users.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = getAuthFromReq(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  if (auth.role !== 'admin') return res.status(403).json({ error: '관리자만 가능합니다.' });
  if (auth.impersonatedBy) return res.status(400).json({ error: '이미 다른 계정으로 보는 중입니다. 먼저 원래 계정으로 돌아가세요.' });

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: '대상 ID가 필요합니다.' });
  if (id === auth.id) return res.status(400).json({ error: '본인 계정으로 전환할 수 없습니다.' });

  try {
    const target = await findUser(id);
    if (!target) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const permissions = target.role === 'admin'
      ? ['category', 'keyword', 'competitor']
      : (target.permissions || []);

    const token = signToken({
      id: target.id,
      role: target.role,
      permissions,
      impersonatedBy: auth.id,
    });
    setAuthCookie(res, token);
    return res.status(200).json({
      ok: true,
      user: { id: target.id, role: target.role, permissions, impersonatedBy: auth.id },
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
