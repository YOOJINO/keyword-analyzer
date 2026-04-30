const GH_API = 'https://api.github.com';

function getRepoInfo() {
  const repo = process.env.GITHUB_REPO;
  if (!repo) throw new Error('GITHUB_REPO not set');
  const [owner, name] = repo.split('/');
  if (!owner || !name) throw new Error(`GITHUB_REPO invalid: ${repo}`);
  return { owner, name };
}

function authHeaders() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN not set');
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export async function readFile(path) {
  const { owner, name } = getRepoInfo();
  const url = `${GH_API}/repos/${owner}/${name}/contents/${path}`;
  const resp = await fetch(url, { headers: authHeaders() });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`GitHub readFile failed: ${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return { content, sha: data.sha };
}

export async function writeFile(path, content, message) {
  const { owner, name } = getRepoInfo();
  const existing = await readFile(path);
  const url = `${GH_API}/repos/${owner}/${name}/contents/${path}`;
  const baseMsg = message || `Update ${path}`;
  // 데이터 파일 저장은 Vercel 재배포 트리거하지 않도록 [skip ci] 태그 추가
  const finalMsg = baseMsg.includes('[skip ci]') ? baseMsg : `${baseMsg} [skip ci]`;
  const body = {
    message: finalMsg,
    content: Buffer.from(content, 'utf-8').toString('base64'),
  };
  if (existing) body.sha = existing.sha;
  const resp = await fetch(url, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`GitHub writeFile failed: ${resp.status} ${await resp.text()}`);
  return await resp.json();
}

export async function readJson(path) {
  const file = await readFile(path);
  if (!file) return null;
  try {
    return JSON.parse(file.content);
  } catch {
    return null;
  }
}

export async function writeJson(path, obj, message) {
  return writeFile(path, JSON.stringify(obj, null, 2) + '\n', message);
}
