import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function syncOpsIssue({ token, repo, healthy, result, runUrl, fetchImpl = fetch }) {
  const target = result.target || 'staging';
  const cronTitle = `[ops-health] ${target} cron degraded`;
  const rpcTitle = `[ops-health] ${target} rpc warning`;
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
  const byTitle = (title) => issues.find((item) => !item.pull_request && item.title === title);
  const closeIssue = async (issue, message) => {
    if (issue?.state !== 'open') return 'unchanged';
    await api(`/issues/${issue.number}/comments`, {
      method: 'POST', body: JSON.stringify({ body: message }),
    });
    await api(`/issues/${issue.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed' }) });
    return 'closed';
  };
  const upsertIssue = async (issue, title, body) => {
    if (!issue) {
      await api('/issues', { method: 'POST', body: JSON.stringify({ title, body }) });
      return 'created';
    }
    await api(`/issues/${issue.number}`, {
      method: 'PATCH', body: JSON.stringify({ state: 'open', body }),
    });
    return issue.state === 'open' ? 'updated' : 'reopened';
  };

  const cronBody = [
    `MarginCook **${target}** Cron 헬스 체크가 실패했습니다.`,
    '',
    '```json', JSON.stringify(result, null, 2).slice(0, 12000), '```',
    '',
    `workflow: ${runUrl}`,
  ].join('\n');
  const cron = healthy
    ? await closeIssue(byTitle(cronTitle), 'Cron 헬스 체크가 회복돼 이 이슈를 닫습니다.')
    : await upsertIssue(byTitle(cronTitle), cronTitle, cronBody);

  let rpc = 'unchanged';
  if (typeof result.rpc?.warning === 'boolean') {
    if (result.rpc.warning) {
      const rpcBody = [
        `MarginCook **${target}**에서 client-reported 예상 밖 RPC 오류가 감지됐습니다.`,
        '',
        '이 신호는 사용자 앱 보고이며 Cron 장애나 정확한 오류율이 아닙니다.',
        '',
        '```json', JSON.stringify(result.rpc, null, 2).slice(0, 12000), '```',
        '',
        `workflow: ${runUrl}`,
      ].join('\n');
      rpc = await upsertIssue(byTitle(rpcTitle), rpcTitle, rpcBody);
    } else {
      rpc = await closeIssue(byTitle(rpcTitle), '최근 15분 client-reported RPC 경고가 없어 이 이슈를 닫습니다.');
    }
  }
  return { cron, rpc };
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
