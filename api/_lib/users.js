import { readJson, writeJson } from './github.js';
import { hashPassword } from './auth.js';

const USERS_PATH = 'data/users.json';

export async function loadUsers() {
  const data = await readJson(USERS_PATH);
  if (!data || !Array.isArray(data.users)) return { users: [] };
  return data;
}

export async function saveUsers(data, message) {
  return writeJson(USERS_PATH, data, message || 'Update users');
}

export async function findUser(id) {
  const { users } = await loadUsers();
  return users.find(u => u.id === id) || null;
}

const ALL_PERMS = ['category', 'keyword', 'competitor'];

function normalizePerms(role, perms) {
  if (role === 'admin') return ALL_PERMS;
  if (!Array.isArray(perms)) return [];
  return perms.filter(p => ALL_PERMS.includes(p));
}

export async function createUser({ id, password, role, permissions }) {
  const data = await loadUsers();
  if (data.users.find(u => u.id === id)) {
    throw new Error('이미 존재하는 ID입니다.');
  }
  const finalRole = role === 'admin' ? 'admin' : 'user';
  const user = {
    id,
    passwordHash: hashPassword(password),
    role: finalRole,
    permissions: normalizePerms(finalRole, permissions),
    createdAt: new Date().toISOString(),
  };
  data.users.push(user);
  await saveUsers(data, `Add user ${id}`);
  return sanitize(user);
}

export async function updateUser(id, { password, role, permissions }) {
  const data = await loadUsers();
  const user = data.users.find(u => u.id === id);
  if (!user) throw new Error('사용자를 찾을 수 없습니다.');
  if (password) user.passwordHash = hashPassword(password);
  if (role && (role === 'admin' || role === 'user')) user.role = role;
  if (permissions !== undefined || role) {
    user.permissions = normalizePerms(user.role, permissions !== undefined ? permissions : user.permissions);
  }
  await saveUsers(data, `Update user ${id}`);
  return sanitize(user);
}

export async function deleteUser(id) {
  const data = await loadUsers();
  const idx = data.users.findIndex(u => u.id === id);
  if (idx < 0) throw new Error('사용자를 찾을 수 없습니다.');
  data.users.splice(idx, 1);
  await saveUsers(data, `Delete user ${id}`);
  return true;
}

export function sanitize(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

export async function listUsersSafe() {
  const { users } = await loadUsers();
  return users.map(sanitize);
}
