/**
 * Gitea IPC Handlers Verification Script
 *
 * This script verifies that Gitea IPC handlers correctly invoke backend functions
 * by checking:
 * 1. Handler registration
 * 2. API endpoint construction
 * 3. giteaFetch utility usage
 * 4. Transformation functions
 * 5. Error handling
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface VerificationResult {
  category: string;
  test: string;
  status: 'pass' | 'fail' | 'skip';
  details: string;
}

const results: VerificationResult[] = [];

// Colors for terminal output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function addResult(category: string, test: string, status: 'pass' | 'fail' | 'skip', details: string): void {
  results.push({ category, test, status, details });
}

/**
 * Test 1: Verify all handler files exist
 */
function verifyHandlerFilesExist(): void {
  const handlersDir = join(__dirname, '../src/main/ipc-handlers/gitea');
  const requiredFiles = [
    'index.ts',
    'repository-handlers.ts',
    'issue-handlers.ts',
    'pull-request-handlers.ts',
    'release-handlers.ts',
    'investigation-handlers.ts',
    'pr-review-handlers.ts',
    'import-handlers.ts',
    'utils.ts',
    'types.ts',
    'oauth-handlers.ts'
  ];

  for (const file of requiredFiles) {
    try {
      const filePath = join(handlersDir, file);
      readFileSync(filePath, 'utf-8');
      addResult('Handler Files', `File exists: ${file}`, 'pass', `Found at ${filePath}`);
    } catch (error) {
      addResult('Handler Files', `File exists: ${file}`, 'fail', `File not found or cannot be read`);
    }
  }
}

/**
 * Test 2: Verify handlers use giteaFetch utility
 */
function verifyGiteaFetchUsage(): void {
  const handlersDir = join(__dirname, '../src/main/ipc-handlers/gitea');

  const handlersToCheck = [
    { file: 'issue-handlers.ts', functions: ['registerGetIssues', 'registerGetIssue', 'registerGetIssueComments'] },
    { file: 'pull-request-handlers.ts', functions: ['registerGetPullRequests', 'registerGetPullRequest'] }
  ];

  for (const handler of handlersToCheck) {
    try {
      const content = readFileSync(join(handlersDir, handler.file), 'utf-8');
      const usesGiteaFetch = content.includes('giteaFetch(');
      const usesConfig = content.includes('getGiteaConfig');
      const usesEncodeRepo = content.includes('encodeRepositoryPath');

      if (usesGiteaFetch && usesConfig && usesEncodeRepo) {
        addResult(
          'Handler Implementation',
          `${handler.file} uses giteaFetch utility`,
          'pass',
          'Found giteaFetch, getGiteaConfig, and encodeRepositoryPath'
        );
      } else {
        addResult(
          'Handler Implementation',
          `${handler.file} uses giteaFetch utility`,
          'fail',
          `Missing: ${!usesGiteaFetch ? 'giteaFetch ' : ''}${!usesConfig ? 'getGiteaConfig ' : ''}${!usesEncodeRepo ? 'encodeRepositoryPath' : ''}`
        );
      }
    } catch (error) {
      addResult('Handler Implementation', `${handler.file} uses giteaFetch utility`, 'fail', String(error));
    }
  }
}

/**
 * Test 3: Verify API endpoint construction
 */
function verifyAPIEndpointConstruction(): void {
  const handlersDir = join(__dirname, '../src/main/ipc-handlers/gitea');

  const endpointPatterns = [
    { file: 'issue-handlers.ts', pattern: `/repos/`, expected: true },
    { file: 'pull-request-handlers.ts', pattern: `/repos/`, expected: true },
    { file: 'utils.ts', pattern: `/api/v1`, expected: true }
  ];

  for (const check of endpointPatterns) {
    try {
      const content = readFileSync(join(handlersDir, check.file), 'utf-8');
      const hasPattern = content.includes(check.pattern);

      if (hasPattern === check.expected) {
        addResult(
          'API Endpoints',
          `${check.file} contains ${check.pattern}`,
          'pass',
          'Pattern found as expected'
        );
      } else {
        addResult(
          'API Endpoints',
          `${check.file} contains ${check.pattern}`,
          'fail',
          'Pattern not found'
        );
      }
    } catch (error) {
      addResult('API Endpoints', `${check.file} contains ${check.pattern}`, 'fail', String(error));
    }
  }
}

/**
 * Test 4: Verify error handling in handlers
 */
function verifyErrorHandling(): void {
  const handlersDir = join(__dirname, '../src/main/ipc-handlers/gitea');

  const errorHandlingPatterns = [
    { file: 'issue-handlers.ts', patterns: ['try {', 'catch (error)', 'success: false', 'error:'] },
    { file: 'pull-request-handlers.ts', patterns: ['try {', 'catch (error)', 'success: false', 'error:'] }
  ];

  for (const check of errorHandlingPatterns) {
    try {
      const content = readFileSync(join(handlersDir, check.file), 'utf-8');
      const hasAllPatterns = check.patterns.every(pattern => content.includes(pattern));

      if (hasAllPatterns) {
        addResult(
          'Error Handling',
          `${check.file} has error handling`,
          'pass',
          'Found try-catch and error response patterns'
        );
      } else {
        const missing = check.patterns.filter(p => !content.includes(p));
        addResult(
          'Error Handling',
          `${check.file} has error handling`,
          'fail',
          `Missing patterns: ${missing.join(', ')}`
        );
      }
    } catch (error) {
      addResult('Error Handling', `${check.file} has error handling`, 'fail', String(error));
    }
  }
}

/**
 * Test 5: Verify handler registration in index.ts
 */
function verifyHandlerRegistration(): void {
  const handlersDir = join(__dirname, '../src/main/ipc-handlers/gitea');

  try {
    const indexContent = readFileSync(join(handlersDir, 'index.ts'), 'utf-8');

    const requiredExports = [
      'registerGiteaHandlers',
      'registerIssueHandlers',
      'registerPullRequestHandlers',
      'registerRepositoryHandlers',
      'registerReleaseHandlers',
      'registerInvestigationHandlers',
      'registerImportHandlers',
      'registerPRReviewHandlers',
      'registerGiteaOAuthHandlers'
    ];

    for (const exportName of requiredExports) {
      if (indexContent.includes(exportName)) {
        addResult('Handler Registration', `Export found: ${exportName}`, 'pass', 'Export exists in index.ts');
      } else {
        addResult('Handler Registration', `Export found: ${exportName}`, 'fail', 'Export not found in index.ts');
      }
    }
  } catch (error) {
    addResult('Handler Registration', 'Verify index.ts exports', 'fail', String(error));
  }
}

/**
 * Test 6: Verify transformation functions exist
 */
function verifyTransformationFunctions(): void {
  const handlersDir = join(__dirname, '../src/main/ipc-handlers/gitea');

  const transformFunctions = [
    { file: 'issue-handlers.ts', functions: ['transformIssue', 'transformComment'] },
    { file: 'pull-request-handlers.ts', functions: ['transformPullRequest'] }
  ];

  for (const check of transformFunctions) {
    try {
      const content = readFileSync(join(handlersDir, check.file), 'utf-8');
      const hasAllFunctions = check.functions.every(fn =>
        content.includes(`function ${fn}(`) || content.includes(`${fn} = `)
      );

      if (hasAllFunctions) {
        addResult(
          'Transformation Functions',
          `${check.file} has transform functions`,
          'pass',
          `Found: ${check.functions.join(', ')}`
        );
      } else {
        const missing = check.functions.filter(fn => !content.includes(`function ${fn}(`) && !content.includes(`${fn} = `));
        addResult(
          'Transformation Functions',
          `${check.file} has transform functions`,
          'fail',
          `Missing: ${missing.join(', ')}`
        );
      }
    } catch (error) {
      addResult('Transformation Functions', `${check.file} has transform functions`, 'fail', String(error));
    }
  }
}

/**
 * Test 7: Verify IPC channel constants exist
 */
 function verifyIPCChannelConstants(): void {
  const constantsFile = join(__dirname, '../src/shared/constants/ipc.ts');

  try {
    const content = readFileSync(constantsFile, 'utf-8');

    const requiredChannels = [
      'GITEA_GET_ISSUES',
      'GITEA_GET_ISSUE',
      'GITEA_GET_ISSUE_COMMENTS',
      'GITEA_GET_PULL_REQUESTS',
      'GITEA_GET_PULL_REQUEST',
      'GITEA_CREATE_PULL_REQUEST',
      'GITEA_UPDATE_PULL_REQUEST',
      'GITEA_PR_MERGE',
      'GITEA_PR_APPROVE',
      'GITEA_CHECK_CONNECTION',
      'GITEA_GET_REPOSITORIES'
    ];

    for (const channel of requiredChannels) {
      if (content.includes(channel)) {
        addResult('IPC Channels', `Channel defined: ${channel}`, 'pass', 'Found in IPC_CHANNELS constant');
      } else {
        addResult('IPC Channels', `Channel defined: ${channel}`, 'fail', 'Not found in IPC_CHANNELS constant');
      }
    }
  } catch (error) {
    addResult('IPC Channels', 'Verify IPC_CHANNELS constants', 'fail', String(error));
  }
}

/**
 * Test 8: Verify preload API module
 */
function verifyPreloadAPIModule(): void {
  const preloadAPIFile = join(__dirname, '../src/preload/api/modules/gitea-api.ts');

  try {
    const content = readFileSync(preloadAPIFile, 'utf-8');

    const requiredFunctions = [
      'getGiteaIssues',
      'getGiteaIssue',
      'getGiteaPullRequests',
      'getGiteaPullRequest',
      'createGiteaRelease',
      'createGiteaAPI'
    ];

    for (const fn of requiredFunctions) {
      if (content.includes(fn)) {
        addResult('Preload API', `Function defined: ${fn}`, 'pass', 'Found in gitea-api.ts');
      } else {
        addResult('Preload API', `Function defined: ${fn}`, 'fail', 'Not found in gitea-api.ts');
      }
    }
  } catch (error) {
    addResult('Preload API', 'Verify gitea-api.ts', 'fail', String(error));
  }
}

/**
 * Test 9: Verify main IPC handler registration
 */
function verifyMainIPCRegistration(): void {
  const mainIndexFile = join(__dirname, '../src/main/ipc-handlers/index.ts');

  try {
    const content = readFileSync(mainIndexFile, 'utf-8');

    const hasGiteaImport = content.includes("import { registerGiteaHandlers }");
    const hasGiteaCall = content.includes('registerGiteaHandlers(agentManager, getMainWindow)');

    if (hasGiteaImport && hasGiteaCall) {
      addResult(
        'Main IPC Registration',
        'Gitea handlers registered in main index.ts',
        'pass',
        'Found import and function call'
      );
    } else {
      addResult(
        'Main IPC Registration',
        'Gitea handlers registered in main index.ts',
        'fail',
        `Missing: ${!hasGiteaImport ? 'import ' : ''}${!hasGiteaCall ? 'function call' : ''}`
      );
    }
  } catch (error) {
    addResult('Main IPC Registration', 'Verify main index.ts registration', 'fail', String(error));
  }
}

/**
 * Test 10: Verify handler API endpoint correctness
 */
function verifyHandlerAPIEndpoints(): void {
  const handlersDir = join(__dirname, '../src/main/ipc-handlers/gitea');

  const expectedEndpoints = [
    { file: 'issue-handlers.ts', endpoints: ['encodedRepo}/issues', 'encodedRepo}/issues/${issueNumber}'] },
    { file: 'pull-request-handlers.ts', endpoints: ['encodedRepository}/pulls', 'encodedRepository}/pulls/${prNumber}'] }
  ];

  for (const check of expectedEndpoints) {
    try {
      const content = readFileSync(join(handlersDir, check.file), 'utf-8');
      const endpointsFound = check.endpoints.filter(ep => content.includes(ep) || content.includes(ep.replace(/'/g, '`')));

      if (endpointsFound.length === check.endpoints.length) {
        addResult(
          'API Endpoints',
          `${check.file} has correct endpoints`,
          'pass',
          `Found ${endpointsFound.length}/${check.endpoints.length} expected endpoints`
        );
      } else {
        addResult(
          'API Endpoints',
          `${check.file} has correct endpoints`,
          'fail',
          `Found ${endpointsFound.length}/${check.endpoints.length} expected endpoints`
        );
      }
    } catch (error) {
      addResult('API Endpoints', `${check.file} has correct endpoints`, 'fail', String(error));
    }
  }
}

/**
 * Run all verification tests
 */
function runAllTests(): void {
  console.log('\n=== Gitea IPC Handlers Verification ===\n');

  verifyHandlerFilesExist();
  verifyGiteaFetchUsage();
  verifyAPIEndpointConstruction();
  verifyErrorHandling();
  verifyHandlerRegistration();
  verifyTransformationFunctions();
  verifyIPCChannelConstants();
  verifyPreloadAPIModule();
  verifyMainIPCRegistration();
  verifyHandlerAPIEndpoints();

  // Print results
  let passCount = 0;
  let failCount = 0;
  let skipCount = 0;

  const categories = Array.from(new Set(results.map(r => r.category)));

  for (const category of categories) {
    console.log(`\n${category}:`);
    console.log('─'.repeat(60));

    const categoryResults = results.filter(r => r.category === category);
    for (const result of categoryResults) {
      const icon = result.status === 'pass' ? `${GREEN}✓${RESET}` :
                   result.status === 'fail' ? `${RED}✗${RESET}` :
                   `${YELLOW}○${RESET}`;
      console.log(`  ${icon} ${result.test}: ${result.details}`);

      if (result.status === 'pass') passCount++;
      else if (result.status === 'fail') failCount++;
      else skipCount++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`Summary: ${GREEN}${passCount} passed${RESET}, ${RED}${failCount} failed${RESET}, ${YELLOW}${skipCount} skipped${RESET}`);
  console.log('='.repeat(60) + '\n');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Run verification
runAllTests();
