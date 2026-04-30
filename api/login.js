import { signToken, setAuthCookie, verifyPassword, hashPassword } from './_lib/auth.js';
import { loadUsers, saveUsers } from './_lib/users.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id, password } = req.body || {};
  if (!id || !password) return res.status(400).json({ error: 'ID와 비밀번호를 입력해주세요.' });

  try {
    const data = await loadUsers();

    // Bootstrap: users.json이 비어있으면 환경변수 admin으로 첫 계정 생성
    if (data.users.length === 0) {
      const bootUser = process.env.BOOTSTRAP_ADMIN_USER;
      const bootPass = process.env.BOOTSTRAP_ADMIN_PASS;
      if (!bootUser || !bootPass) {
        return res.status(500).json({ error: 'Bootstrap admin 환경변수가 설정되지 않았습니다.' });
      }
      if (id !== bootUser || password !== bootPass) {
        return res.status(401).json({ error: 'ID 또는 비밀번호가 올바르지 않습니다.' });
      }
      const newAdmin = {
        id: bootUser,
        password: bootPass,
        passwordHash: hashPassword(bootPass),
        role: 'admin',
        permissions: ['category', 'keyword', 'competitor'],
        createdAt: new Date().toISOString(),
      };
      data.users.push(newAdmin);
      await saveUsers(data, `Bootstrap admin ${bootUser}`);
      const token = signToken({ id: newAdmin.id, role: newAdmin.role, permissions: newAdmin.permissions });
      setAuthCookie(res, token);
      return res.status(200).json({ ok: true, user: { id: newAdmin.id, role: newAdmin.role, permissions: newAdmin.permissions } });
    }

    // 일반 로그인
    const user = data.users.find(u => u.id === id);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'ID 또는 비밀번호가 올바르지 않습니다.' });
    }

    // 평문 비번 백필: 검증 성공 시점 = 입력값이 정답이므로 저장
    if (!user.password) {
      user.password = password;
      await saveUsers(data, `Backfill plaintext password for ${user.id}`);
    }

    const permissions = user.role === 'admin' ? ['category', 'keyword', 'competitor'] : (user.permissions || []);
    const token = signToken({ id: user.id, role: user.role, permissions });
    setAuthCookie(res, token);
    return res.status(200).json({ ok: true, user: { id: user.id, role: user.role, permissions } });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
