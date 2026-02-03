/**
 * Verification script for Gitea PR Review functionality
 */

import { readFileSync, existsSync, realpathSync } from 'fs';
import { join, dirname, resolve } from 'path';

// Find worktree root by looking for .auto-claude directory
let worktreeRoot = process.cwd();
while (worktreeRoot !== '/' && !existsSync(join(worktreeRoot, '.auto-claude'))) {
  worktreeRoot = dirname(worktreeRoot);
}

const ROOT = worktreeRoot;

console.log(`Worktree root: ${ROOT}`);
console.log('=== Gitea PR Review Verification ===\n');

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function test(category: string, name: string, passed: boolean, details?: string) {
  results.push({ category, name, passed, details });
  const status = passed ? '✓' : '✗';
  console.log(`  ${status} ${name}${details ? `: ${details}` : ''}`);
}

function fileExists(path: string): boolean {
  const fullPath = resolve(ROOT, path);
  return existsSync(fullPath);
}

function fileContains(path: string, pattern: RegExp): boolean {
  const fullPath = resolve(ROOT, path);
  if (!existsSync(fullPath)) return false;
  const content = readFileSync(fullPath, 'utf-8');
  return pattern.test(content);
}

function countMatches(path: string, pattern: RegExp): number {
  const fullPath = resolve(ROOT, path);
  if (!existsSync(fullPath)) return 0;
  const content = readFileSync(fullPath, 'utf-8');
  // Ensure pattern has global flag for counting all matches
  const globalPattern = pattern.global ? pattern : new RegExp(pattern.source, pattern.flags + 'g');
  const matches = content.match(globalPattern);
  return matches ? matches.length : 0;
}

// 1. Backend Python Modules
console.log('1. Backend Python Modules');

test('Backend', 'runner.py exists', fileExists('apps/backend/runners/gitea/runner.py'));
test('Backend', 'orchestrator.py exists', fileExists('apps/backend/runners/gitea/orchestrator.py'));
test('Backend', 'services/__init__.py exists', fileExists('apps/backend/runners/gitea/services/__init__.py'));
test('Backend', 'services/pr_review_engine.py exists', fileExists('apps/backend/runners/gitea/services/pr_review_engine.py'));
test('Backend', 'models.py exists', fileExists('apps/backend/runners/gitea/models.py'));

test('Backend', 'runner.py has review-pr command', fileContains('apps/backend/runners/gitea/runner.py', /review-pr/));
test('Backend', 'runner.py has followup-review-pr command', fileContains('apps/backend/runners/gitea/runner.py', /followup-review-pr/));
test('Backend', 'orchestrator.py has review_pr method', fileContains('apps/backend/runners/gitea/orchestrator.py', /async def review_pr/));
test('Backend', 'orchestrator.py has followup_review_pr method', fileContains('apps/backend/runners/gitea/orchestrator.py', /async def followup_review_pr/));
test('Backend', 'PRReviewEngine class exists', fileContains('apps/backend/runners/gitea/services/pr_review_engine.py', /class PRReviewEngine/));
test('Backend', 'PRReviewFinding dataclass exists', fileContains('apps/backend/runners/gitea/models.py', /class PRReviewFinding/));
test('Backend', 'PRReviewResult dataclass exists', fileContains('apps/backend/runners/gitea/models.py', /class PRReviewResult/));
test('Backend', 'PRContext dataclass exists', fileContains('apps/backend/runners/gitea/models.py', /class PRContext/));
test('Backend', 'GiteaRunnerConfig dataclass exists', fileContains('apps/backend/runners/gitea/models.py', /class GiteaRunnerConfig/));

// 2. Frontend IPC Handlers
console.log('\n2. Frontend IPC Handlers');

test('IPC Handlers', 'pr-review-handlers.ts exists', fileExists('apps/frontend/src/main/ipc-handlers/gitea/pr-review-handlers.ts'));
test('IPC Handlers', 'registerPRReviewHandlers exported', fileContains('apps/frontend/src/main/ipc-handlers/gitea/pr-review-handlers.ts', /export function registerPRReviewHandlers/));
test('IPC Handlers', 'runPRReview handler registered', fileContains('apps/frontend/src/main/ipc-handlers/gitea/pr-review-handlers.ts', /IPC_CHANNELS\.GITEA_PR_REVIEW/));
test('IPC Handlers', 'postPRReview handler registered', fileContains('apps/frontend/src/main/ipc-handlers/gitea/pr-review-handlers.ts', /IPC_CHANNELS\.GITEA_PR_POST_REVIEW/));
test('IPC Handlers', 'postPRNote handler registered', fileContains('apps/frontend/src/main/ipc-handlers/gitea/pr-review-handlers.ts', /IPC_CHANNELS\.GITEA_PR_POST_NOTE/));
test('IPC Handlers', 'mergePR handler registered', fileContains('apps/frontend/src/main/ipc-handlers/gitea/pr-review-handlers.ts', /IPC_CHANNELS\.GITEA_PR_MERGE/));
test('IPC Handlers', 'assignPR handler registered', fileContains('apps/frontend/src/main/ipc-handlers/gitea/pr-review-handlers.ts', /IPC_CHANNELS\.GITEA_PR_ASSIGN/));
test('IPC Handlers', 'approvePR handler registered', fileContains('apps/frontend/src/main/ipc-handlers/gitea/pr-review-handlers.ts', /IPC_CHANNELS\.GITEA_PR_APPROVE/));
test('IPC Handlers', 'cancelPRReview handler registered', fileContains('apps/frontend/src/main/ipc-handlers/gitea/pr-review-handlers.ts', /IPC_CHANNELS\.GITEA_PR_REVIEW_CANCEL/));
test('IPC Handlers', 'checkNewCommits handler registered', fileContains('apps/frontend/src/main/ipc-handlers/gitea/pr-review-handlers.ts', /IPC_CHANNELS\.GITEA_PR_CHECK_NEW_COMMITS/));
test('IPC Handlers', 'followupReview handler registered', fileContains('apps/frontend/src/main/ipc-handlers/gitea/pr-review-handlers.ts', /IPC_CHANNELS\.GITEA_PR_FOLLOWUP_REVIEW/));

const handlerCount = countMatches('apps/frontend/src/main/ipc-handlers/gitea/pr-review-handlers.ts', /ipcMain\.(handle|on)/g);
test('IPC Handlers', 'Handler implementations', handlerCount >= 11, `${handlerCount} handlers found`);

// 3. IPC Channels
console.log('\n3. IPC Channels');

test('IPC Channels', 'GITEA_PR_GET_DIFF defined', fileContains('apps/frontend/src/shared/constants/ipc.ts', /GITEA_PR_GET_DIFF/));
test('IPC Channels', 'GITEA_PR_GET_REVIEW defined', fileContains('apps/frontend/src/shared/constants/ipc.ts', /GITEA_PR_GET_REVIEW/));
test('IPC Channels', 'GITEA_PR_REVIEW defined', fileContains('apps/frontend/src/shared/constants/ipc.ts', /GITEA_PR_REVIEW/));
test('IPC Channels', 'GITEA_PR_REVIEW_CANCEL defined', fileContains('apps/frontend/src/shared/constants/ipc.ts', /GITEA_PR_REVIEW_CANCEL/));
test('IPC Channels', 'GITEA_PR_FOLLOWUP_REVIEW defined', fileContains('apps/frontend/src/shared/constants/ipc.ts', /GITEA_PR_FOLLOWUP_REVIEW/));
test('IPC Channels', 'GITEA_PR_POST_REVIEW defined', fileContains('apps/frontend/src/shared/constants/ipc.ts', /GITEA_PR_POST_REVIEW/));
test('IPC Channels', 'GITEA_PR_POST_NOTE defined', fileContains('apps/frontend/src/shared/constants/ipc.ts', /GITEA_PR_POST_NOTE/));
test('IPC Channels', 'GITEA_PR_MERGE defined', fileContains('apps/frontend/src/shared/constants/ipc.ts', /GITEA_PR_MERGE/));
test('IPC Channels', 'GITEA_PR_ASSIGN defined', fileContains('apps/frontend/src/shared/constants/ipc.ts', /GITEA_PR_ASSIGN/));
test('IPC Channels', 'GITEA_PR_APPROVE defined', fileContains('apps/frontend/src/shared/constants/ipc.ts', /GITEA_PR_APPROVE/));
test('IPC Channels', 'GITEA_PR_CHECK_NEW_COMMITS defined', fileContains('apps/frontend/src/shared/constants/ipc.ts', /GITEA_PR_CHECK_NEW_COMMITS/));
test('IPC Channels', 'GITEA_PR_REVIEW_PROGRESS defined', fileContains('apps/frontend/src/shared/constants/ipc.ts', /GITEA_PR_REVIEW_PROGRESS/));
test('IPC Channels', 'GITEA_PR_REVIEW_COMPLETE defined', fileContains('apps/frontend/src/shared/constants/ipc.ts', /GITEA_PR_REVIEW_COMPLETE/));
test('IPC Channels', 'GITEA_PR_REVIEW_ERROR defined', fileContains('apps/frontend/src/shared/constants/ipc.ts', /GITEA_PR_REVIEW_ERROR/));

// 4. TypeScript Types
console.log('\n4. TypeScript Types');

test('Types', 'GiteaPRReviewResult in integrations.ts', fileContains('apps/frontend/src/shared/types/integrations.ts', /GiteaPRReviewResult/));
test('Types', 'GiteaPRReviewProgress in integrations.ts', fileContains('apps/frontend/src/shared/types/integrations.ts', /GiteaPRReviewProgress/));
test('Types', 'GiteaPRReviewFinding in integrations.ts', fileContains('apps/frontend/src/shared/types/integrations.ts', /GiteaPRReviewFinding/));
test('Types', 'GiteaNewCommitsCheck in integrations.ts', fileContains('apps/frontend/src/shared/types/integrations.ts', /GiteaNewCommitsCheck/));
test('Types', 'PRReviewResult in types.ts', fileContains('apps/frontend/src/main/ipc-handlers/gitea/types.ts', /interface PRReviewResult/));
test('Types', 'PRReviewProgress in types.ts', fileContains('apps/frontend/src/main/ipc-handlers/gitea/types.ts', /interface PRReviewProgress/));
test('Types', 'PRReviewFinding in types.ts', fileContains('apps/frontend/src/main/ipc-handlers/gitea/types.ts', /interface PRReviewFinding/));
test('Types', 'NewCommitsCheck in types.ts', fileContains('apps/frontend/src/main/ipc-handlers/gitea/types.ts', /interface NewCommitsCheck/));

// 5. Preload API
console.log('\n5. Preload API');

test('Preload API', 'getGiteaPRReview defined', fileContains('apps/frontend/src/preload/api/modules/gitea-api.ts', /getGiteaPRReview/));
test('Preload API', 'runGiteaPRReview defined', fileContains('apps/frontend/src/preload/api/modules/gitea-api.ts', /runGiteaPRReview/));
test('Preload API', 'runGiteaPRFollowupReview defined', fileContains('apps/frontend/src/preload/api/modules/gitea-api.ts', /runGiteaPRFollowupReview/));
test('Preload API', 'postGiteaPRReview defined', fileContains('apps/frontend/src/preload/api/modules/gitea-api.ts', /postGiteaPRReview/));
test('Preload API', 'postGiteaPRNote defined', fileContains('apps/frontend/src/preload/api/modules/gitea-api.ts', /postGiteaPRNote/));
test('Preload API', 'mergeGiteaPR defined', fileContains('apps/frontend/src/preload/api/modules/gitea-api.ts', /mergeGiteaPR/));
test('Preload API', 'assignGiteaPR defined', fileContains('apps/frontend/src/preload/api/modules/gitea-api.ts', /assignGiteaPR/));
test('Preload API', 'approveGiteaPR defined', fileContains('apps/frontend/src/preload/api/modules/gitea-api.ts', /approveGiteaPR/));
test('Preload API', 'cancelGiteaPRReview defined', fileContains('apps/frontend/src/preload/api/modules/gitea-api.ts', /cancelGiteaPRReview/));
test('Preload API', 'checkGiteaPRNewCommits defined', fileContains('apps/frontend/src/preload/api/modules/gitea-api.ts', /checkGiteaPRNewCommits/));
test('Preload API', 'onGiteaPRReviewProgress defined', fileContains('apps/frontend/src/preload/api/modules/gitea-api.ts', /onGiteaPRReviewProgress/));
test('Preload API', 'onGiteaPRReviewComplete defined', fileContains('apps/frontend/src/preload/api/modules/gitea-api.ts', /onGiteaPRReviewComplete/));
test('Preload API', 'onGiteaPRReviewError defined', fileContains('apps/frontend/src/preload/api/modules/gitea-api.ts', /onGiteaPRReviewError/));

// 6. i18n Translations
console.log('\n6. i18n Translations');

test('i18n', 'en/gitea.json has prReview section', fileContains('apps/frontend/src/shared/i18n/locales/en/gitea.json', /"prReview"/));
test('i18n', 'en/gitea.json has findings section', fileContains('apps/frontend/src/shared/i18n/locales/en/gitea.json', /"findings"/));
test('i18n', 'fr/gitea.json has prReview section', fileContains('apps/frontend/src/shared/i18n/locales/fr/gitea.json', /"prReview"/));
test('i18n', 'fr/gitea.json has findings section', fileContains('apps/frontend/src/shared/i18n/locales/fr/gitea.json', /"findings"/));
test('i18n', 'zh-CN/gitea.json has prReview section', fileContains('apps/frontend/src/shared/i18n/locales/zh-CN/gitea.json', /"prReview"/));
test('i18n', 'zh-CN/gitea.json has findings section', fileContains('apps/frontend/src/shared/i18n/locales/zh-CN/gitea.json', /"findings"/));

// 7. Handler Registration
console.log('\n7. Handler Registration');

test('Registration', 'registerPRReviewHandlers in index.ts', fileContains('apps/frontend/src/main/ipc-handlers/gitea/index.ts', /registerPRReviewHandlers/));
test('Registration', 'registerPRReviewHandlers exported', fileContains('apps/frontend/src/main/ipc-handlers/gitea/index.ts', /registerPRReviewHandlers/));
test('Registration', 'PR review handlers registered in main', fileContains('apps/frontend/src/main/ipc-handlers/gitea/index.ts', /registerPRReviewHandlers\(getMainWindow\)/));

// 8. Gitea Client Methods
console.log('\n8. Gitea Client Methods');

test('Client', 'get_pull_request method exists', fileContains('apps/backend/runners/gitea/gitea_client.py', /def get_pull_request/));
test('Client', 'get_pr_diff method exists', fileContains('apps/backend/runners/gitea/gitea_client.py', /def get_pr_diff/));
test('Client', 'get_pr_commits method exists', fileContains('apps/backend/runners/gitea/gitea_client.py', /def get_pr_commits/));
test('Client', 'get_pr_files method exists', fileContains('apps/backend/runners/gitea/gitea_client.py', /def get_pr_files/));
test('Client', 'post_pr_comment method exists', fileContains('apps/backend/runners/gitea/gitea_client.py', /def post_pr_comment/));
test('Client', 'approve_pr method exists', fileContains('apps/backend/runners/gitea/gitea_client.py', /def approve_pr/));
test('Client', 'merge_pr method exists', fileContains('apps/backend/runners/gitea/gitea_client.py', /def merge_pr/));

// Summary
console.log('\n=== Summary ===');

const byCategory: Record<string, { passed: number; failed: number }> = {};
for (const r of results) {
  if (!byCategory[r.category]) {
    byCategory[r.category] = { passed: 0, failed: 0 };
  }
  if (r.passed) {
    byCategory[r.category].passed++;
  } else {
    byCategory[r.category].failed++;
  }
}

let totalPassed = 0;
let totalFailed = 0;

for (const [category, stats] of Object.entries(byCategory)) {
  console.log(`${category}: ${stats.passed} passed, ${stats.failed} failed`);
  totalPassed += stats.passed;
  totalFailed += stats.failed;
}

console.log(`\nTotal: ${totalPassed}/${totalPassed + totalFailed} tests passed`);

if (totalFailed > 0) {
  console.log('\nFailed tests:');
  for (const r of results) {
    if (!r.passed) {
      console.log(`  - [${r.category}] ${r.name}${r.details ? `: ${r.details}` : ''}`);
    }
  }
  process.exit(1);
} else {
  console.log('\n✓ All PR review verification tests passed!');
  process.exit(0);
}
