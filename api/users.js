import { requireAdmin } from './_lib/auth.js';
import { listUsersSafe, createUser, updateUser, deleteUser } from './_lib/users.js';

export default async function handler(req, res) {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  try {
    if (req.method === 'GET') {
      const users = await listUsersSafe();
      return res.status(200).json({ users });
    }

    if (req.method === 'POST') {
      const { id, password, role, permissions } = req.body || {};
      if (!id || !password) return res.status(400).json({ error: 'ID와 비밀번호를 입력해주세요.' });
      if (password.length < 4) return res.status(400).json({ error: '비밀번호는 4자 이상이어야 합니다.' });
      const user = await createUser({ id, password, role, permissions });
      return res.status(201).json({ user });
    }

    if (req.method === 'PUT') {
      const { id, password, role, permissions } = req.body || {};
      if (!id) return res.status(400).json({ error: 'ID가 필요합니다.' });
      const user = await updateUser(id, { password, role, permissions });
      return res.status(200).json({ user });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'ID가 필요합니다.' });
      if (id === admin.id) return res.status(400).json({ error: '본인 계정은 삭제할 수 없습니다.' });
      await deleteUser(id);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
