import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function syncOpsIssue({ token, repo, healthy, result, runUrl, fetchImpl = fetch }) {
  const target = result.target || 'staging';
  const title = `[ops-health] ${target} degraded`;
  if (!token || !/^[-\w.]+\/[-\w.]+$/.test(repo ?? '')) {
    throw new Error('GitHub issue 동기화 설정이 없습니다');
  }

  const api = async (path, init = {}) => {
    const response = await fetchImpl(`https://api.github.com/repos/${repo}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'content-type': 'application/json',
        ...init.headers,
      },
    });
    if (!response.ok) throw new Error(`GitHub issue API 실패 (${response.status})`);
    return response.status === 204 ? null : response.json();
  };

  // 장애 중인 이슈는 매 실행마다 갱신되므로 열린 이슈를 최신순으로 보면 100건 제한에 묻히지 않는다.
  const issues = await api('/issues?state=open&per_page=100&sort=updated&direction=desc');
  const issue = issues.find((item) => !item.pull_request && item.title === title);
  if (healthy) {
    if (issue?.state === 'open') {
      await api(`/issues/${issue.number}/comments`, {
        method: 'POST', body: JSON.stringify({ body: '자동 헬스 체크가 회복을 확인해 이 이슈를 닫습니다.' }),
      });
      await api(`/issues/${issue.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed' }) });
      return 'closed';
    }
    return 'unchanged';
  }

  const body = [
    `MarginCook **${target}** 운영 헬스 체크가 실패했습니다.`,
    '',
    '```json', JSON.stringify(result, null, 2).slice(0, 12000), '```',
    '',
    `workflow: ${runUrl}`,
  ].join('\n');
  if (!issue) {
    await api('/issues', { method: 'POST', body: JSON.stringify({ title, body }) });
    return 'created';
  }
  await api(`/issues/${issue.number}`, {
    method: 'PATCH', body: JSON.stringify({ state: 'open', body }),
  });
  return issue.state === 'open' ? 'updated' : 'reopened';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const result = JSON.parse(readFileSync('ops-health-result.json', 'utf8'));
  const repo = process.env.GITHUB_REPOSITORY;
  await syncOpsIssue({
    token: process.env.GITHUB_TOKEN,
    repo,
    healthy: process.env.OPS_HEALTH_OK === 'true',
    result,
    runUrl: `${process.env.GITHUB_SERVER_URL}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  });
}
