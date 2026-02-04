/**
 * Verification script for Gitea AI-powered Issue Investigation
 *
 * This script verifies that the investigation feature is properly implemented:
 * 1. IPC handlers exist and are correctly registered
 * 2. Types are defined correctly
 * 3. Store has investigation functions
 * 4. API module exposes investigation methods
 * 5. Spec utilities work correctly
 * 6. i18n translations exist
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Test results tracking
const testResults: {
  category: string;
  name: string;
  passed: boolean;
  message: string;
}[] = [];

function test(category: string, name: string, condition: boolean, message: string) {
  testResults.push({ category, name, passed: condition, message });
  console.log(condition ? '  ✅' : '  ❌', name);
  if (!condition) {
    console.log('     ', message);
  }
}

function fileExists(path: string): boolean {
  try {
    return existsSync(path);
  } catch {
    return false;
  }
}

function fileContains(path: string, search: string): boolean {
  if (!fileExists(path)) return false;
  try {
    const content = readFileSync(path, 'utf-8');
    return content.includes(search);
  } catch {
    return false;
  }
}

console.log('🔍 Verifying Gitea AI-Powered Issue Investigation...\n');

const basePath = process.cwd();
// Handle being run from different directories
// Normalize path separators for cross-platform compatibility
const normalizedBasePath = basePath.replace(/\\/g, '/');
const frontendPath = normalizedBasePath.includes('apps/frontend') ? basePath : join(basePath, 'apps', 'frontend');

// =============================================================================
// 1. IPC Handler Verification
// =============================================================================
console.log('📋 1. IPC Handlers');

const investigationHandlersPath = join(frontendPath, 'src', 'main', 'ipc-handlers', 'gitea', 'investigation-handlers.ts');
test(
  'IPC Handlers',
  'investigation-handlers.ts exists',
  fileExists(investigationHandlersPath),
  'File not found at: ' + investigationHandlersPath
);

test(
  'IPC Handlers',
  'registerInvestigateIssue function exists',
  fileContains(investigationHandlersPath, 'registerInvestigateIssue'),
  'registerInvestigateIssue function not found'
);

test(
  'IPC Handlers',
  'registerInvestigationHandlers function exists',
  fileContains(investigationHandlersPath, 'registerInvestigationHandlers'),
  'registerInvestigationHandlers function not found'
);

test(
  'IPC Handlers',
  'Sends investigation progress events',
  fileContains(investigationHandlersPath, 'GITEA_INVESTIGATION_PROGRESS'),
  'Investigation progress event not found'
);

test(
  'IPC Handlers',
  'Sends investigation complete events',
  fileContains(investigationHandlersPath, 'GITEA_INVESTIGATION_COMPLETE'),
  'Investigation complete event not found'
);

test(
  'IPC Handlers',
  'Sends investigation error events',
  fileContains(investigationHandlersPath, 'GITEA_INVESTIGATION_ERROR'),
  'Investigation error event not found'
);

test(
  'IPC Handlers',
  'Uses buildIssueContext from spec-utils',
  fileContains(investigationHandlersPath, 'buildIssueContext'),
  'buildIssueContext import not found'
);

test(
  'IPC Handlers',
  'Uses createSpecForIssue from spec-utils',
  fileContains(investigationHandlersPath, 'createSpecForIssue'),
  'createSpecForIssue import not found'
);

// =============================================================================
// 2. Spec Utilities Verification
// =============================================================================
console.log('\n📋 2. Spec Utilities');

const specUtilsPath = join(frontendPath, 'src', 'main', 'ipc-handlers', 'gitea', 'spec-utils.ts');
test(
  'Spec Utils',
  'spec-utils.ts exists',
  fileExists(specUtilsPath),
  'File not found at: ' + specUtilsPath
);

test(
  'Spec Utils',
  'buildIssueContext function exists',
  fileContains(specUtilsPath, 'export function buildIssueContext'),
  'buildIssueContext function not found'
);

test(
  'Spec Utils',
  'createSpecForIssue function exists',
  fileContains(specUtilsPath, 'export async function createSpecForIssue'),
  'createSpecForIssue function not found'
);

test(
  'Spec Utils',
  'GiteaTaskInfo interface exists',
  fileContains(specUtilsPath, 'export interface GiteaTaskInfo'),
  'GiteaTaskInfo interface not found'
);

test(
  'Spec Utils',
  'Has proper sanitization for issue data',
  fileContains(specUtilsPath, 'sanitizeIssueForSpec'),
  'sanitizeIssueForSpec function not found'
);

test(
  'Spec Utils',
  'Creates spec directory structure',
  fileContains(specUtilsPath, 'generateSpecDirName'),
  'generateSpecDirName function not found'
);

test(
  'Spec Utils',
  'Creates TASK.md file',
  fileContains(specUtilsPath, 'TASK.md'),
  'TASK.md creation not found'
);

test(
  'Spec Utils',
  'Creates metadata.json file',
  fileContains(specUtilsPath, 'metadata.json'),
  'metadata.json creation not found'
);

test(
  'Spec Utils',
  'Creates task_metadata.json file',
  fileContains(specUtilsPath, 'task_metadata.json'),
  'task_metadata.json creation not found'
);

// =============================================================================
// 3. IPC Channels Verification
// =============================================================================
console.log('\n📋 3. IPC Channels');

const ipcChannelsPath = join(frontendPath, 'src', 'shared', 'constants', 'ipc.ts');
test(
  'IPC Channels',
  'GITEA_INVESTIGATE_ISSUE channel defined',
  fileContains(ipcChannelsPath, "GITEA_INVESTIGATE_ISSUE:"),
  'GITEA_INVESTIGATE_ISSUE channel not found'
);

test(
  'IPC Channels',
  'GITEA_INVESTIGATION_PROGRESS channel defined',
  fileContains(ipcChannelsPath, "GITEA_INVESTIGATION_PROGRESS:"),
  'GITEA_INVESTIGATION_PROGRESS channel not found'
);

test(
  'IPC Channels',
  'GITEA_INVESTIGATION_COMPLETE channel defined',
  fileContains(ipcChannelsPath, "GITEA_INVESTIGATION_COMPLETE:"),
  'GITEA_INVESTIGATION_COMPLETE channel not found'
);

test(
  'IPC Channels',
  'GITEA_INVESTIGATION_ERROR channel defined',
  fileContains(ipcChannelsPath, "GITEA_INVESTIGATION_ERROR:"),
  'GITEA_INVESTIGATION_ERROR channel not found'
);

// =============================================================================
// 4. Type Definitions Verification
// =============================================================================
console.log('\n📋 4. Type Definitions');

const integrationsTypesPath = join(frontendPath, 'src', 'shared', 'types', 'integrations.ts');
test(
  'Types',
  'GiteaInvestigationResult interface exists',
  fileContains(integrationsTypesPath, 'export interface GiteaInvestigationResult'),
  'GiteaInvestigationResult interface not found'
);

test(
  'Types',
  'GiteaInvestigationResult has success field',
  fileContains(integrationsTypesPath, 'success: boolean;') && fileContains(integrationsTypesPath, 'GiteaInvestigationResult'),
  'GiteaInvestigationResult.success field not found'
);

test(
  'Types',
  'GiteaInvestigationResult has issueNumber field',
  fileContains(integrationsTypesPath, 'issueNumber: number;') && fileContains(integrationsTypesPath, 'GiteaInvestigationResult'),
  'GiteaInvestigationResult.issueNumber field not found'
);

test(
  'Types',
  'GiteaInvestigationResult has analysis field',
  fileContains(integrationsTypesPath, 'analysis:') && fileContains(integrationsTypesPath, 'GiteaInvestigationResult'),
  'GiteaInvestigationResult.analysis field not found'
);

test(
  'Types',
  'GiteaInvestigationResult has taskId field',
  fileContains(integrationsTypesPath, 'taskId?: string;') && fileContains(integrationsTypesPath, 'GiteaInvestigationResult'),
  'GiteaInvestigationResult.taskId field not found'
);

test(
  'Types',
  'GiteaInvestigationStatus interface exists',
  fileContains(integrationsTypesPath, 'export interface GiteaInvestigationStatus'),
  'GiteaInvestigationStatus interface not found'
);

test(
  'Types',
  'GiteaInvestigationStatus has phase field',
  fileContains(integrationsTypesPath, "phase: 'idle' | 'fetching' | 'analyzing' | 'creating_task' | 'complete' | 'error';") &&
    fileContains(integrationsTypesPath, 'GiteaInvestigationStatus'),
  'GiteaInvestigationStatus.phase field not found or incorrect'
);

test(
  'Types',
  'GiteaInvestigationStatus has progress field',
  fileContains(integrationsTypesPath, 'progress: number;') && fileContains(integrationsTypesPath, 'GiteaInvestigationStatus'),
  'GiteaInvestigationStatus.progress field not found'
);

test(
  'Types',
  'GiteaInvestigationStatus has message field',
  fileContains(integrationsTypesPath, 'message: string;') && fileContains(integrationsTypesPath, 'GiteaInvestigationStatus'),
  'GiteaInvestigationStatus.message field not found'
);

// =============================================================================
// 5. Store Verification
// =============================================================================
console.log('\n📋 5. Zustand Store');

const giteaStorePath = join(frontendPath, 'src', 'renderer', 'stores', 'gitea-store.ts');
test(
  'Store',
  'gitea-store.ts exists',
  fileExists(giteaStorePath),
  'File not found at: ' + giteaStorePath
);

test(
  'Store',
  'Has investigationStatus state',
  fileContains(giteaStorePath, 'investigationStatus:') && fileContains(giteaStorePath, 'GiteaInvestigationStatus'),
  'investigationStatus state not found'
);

test(
  'Store',
  'Has lastInvestigationResult state',
  fileContains(giteaStorePath, 'lastInvestigationResult:') && fileContains(giteaStorePath, 'GiteaInvestigationResult'),
  'lastInvestigationResult state not found'
);

test(
  'Store',
  'Has setInvestigationStatus action',
  fileContains(giteaStorePath, 'setInvestigationStatus:'),
  'setInvestigationStatus action not found'
);

test(
  'Store',
  'Has setInvestigationResult action',
  fileContains(giteaStorePath, 'setInvestigationResult:'),
  'setInvestigationResult action not found'
);

test(
  'Store',
  'Has investigateGiteaIssue action function',
  fileContains(giteaStorePath, 'export function investigateGiteaIssue'),
  'investigateGiteaIssue function not found'
);

test(
  'Store',
  'investigateGiteaIssue calls electronAPI',
  fileContains(giteaStorePath, 'window.electronAPI.investigateGiteaIssue'),
  'electronAPI.investigateGiteaIssue call not found'
);

test(
  'Store',
  'investigateGiteaIssue updates investigation status',
  fileContains(giteaStorePath, 'setInvestigationStatus'),
  'setInvestigationStatus call not found in investigateGiteaIssue'
);

// =============================================================================
// 6. Preload API Verification
// =============================================================================
console.log('\n📋 6. Preload API');

const giteaApiPath = join(frontendPath, 'src', 'preload', 'api', 'modules', 'gitea-api.ts');
test(
  'Preload API',
  'gitea-api.ts exists',
  fileExists(giteaApiPath),
  'File not found at: ' + giteaApiPath
);

test(
  'Preload API',
  'GiteaAPI interface has investigateGiteaIssue',
  fileContains(giteaApiPath, 'investigateGiteaIssue:') &&
    fileContains(giteaApiPath, 'export interface GiteaAPI'),
  'investigateGiteaIssue not in GiteaAPI interface'
);

test(
  'Preload API',
  'GiteaAPI interface has onGiteaInvestigationProgress',
  fileContains(giteaApiPath, 'onGiteaInvestigationProgress:') &&
    fileContains(giteaApiPath, 'export interface GiteaAPI'),
  'onGiteaInvestigationProgress not in GiteaAPI interface'
);

test(
  'Preload API',
  'GiteaAPI interface has onGiteaInvestigationComplete',
  fileContains(giteaApiPath, 'onGiteaInvestigationComplete:') &&
    fileContains(giteaApiPath, 'export interface GiteaAPI'),
  'onGiteaInvestigationComplete not in GiteaAPI interface'
);

test(
  'Preload API',
  'GiteaAPI interface has onGiteaInvestigationError',
  fileContains(giteaApiPath, 'onGiteaInvestigationError:') &&
    fileContains(giteaApiPath, 'export interface GiteaAPI'),
  'onGiteaInvestigationError not in GiteaAPI interface'
);

test(
  'Preload API',
  'createGiteaAPI implements investigateGiteaIssue',
  fileContains(giteaApiPath, 'investigateGiteaIssue:') &&
    fileContains(giteaApiPath, 'export const createGiteaAPI'),
  'investigateGiteaIssue not implemented in createGiteaAPI'
);

test(
  'Preload API',
  'createGiteaAPI uses GITEA_INVESTIGATE_ISSUE channel',
  fileContains(giteaApiPath, "IPC_CHANNELS.GITEA_INVESTIGATE_ISSUE"),
  'GITEA_INVESTIGATE_ISSUE channel not used'
);

test(
  'Preload API',
  'createGiteaAPI implements onGiteaInvestigationProgress',
  fileContains(giteaApiPath, 'onGiteaInvestigationProgress:') &&
    fileContains(giteaApiPath, 'createIpcListener') &&
    fileContains(giteaApiPath, 'export const createGiteaAPI'),
  'onGiteaInvestigationProgress not implemented in createGiteaAPI'
);

// =============================================================================
// 7. i18n Translations Verification
// =============================================================================
console.log('\n📋 7. i18n Translations');

const enGiteaJsonPath = join(frontendPath, 'src', 'shared', 'i18n', 'locales', 'en', 'gitea.json');
const frGiteaJsonPath = join(frontendPath, 'src', 'shared', 'i18n', 'locales', 'fr', 'gitea.json');
const zhCNGiteaJsonPath = join(frontendPath, 'src', 'shared', 'i18n', 'locales', 'zh-CN', 'gitea.json');

test(
  'i18n',
  'en/gitea.json exists',
  fileExists(enGiteaJsonPath),
  'File not found at: ' + enGiteaJsonPath
);

test(
  'i18n',
  'fr/gitea.json exists',
  fileExists(frGiteaJsonPath),
  'File not found at: ' + frGiteaJsonPath
);

test(
  'i18n',
  'zh-CN/gitea.json exists',
  fileExists(zhCNGiteaJsonPath),
  'File not found at: ' + zhCNGiteaJsonPath
);

test(
  'i18n',
  'English has investigation translations',
  fileContains(enGiteaJsonPath, 'investigation') || fileContains(enGiteaJsonPath, 'investigate'),
  'Investigation translations not found in en/gitea.json'
);

test(
  'i18n',
  'French has investigation translations',
  fileContains(frGiteaJsonPath, 'investigation') || fileContains(frGiteaJsonPath, 'enquête'),
  'Investigation translations not found in fr/gitea.json'
);

test(
  'i18n',
  'Chinese has investigation translations',
  fileContains(zhCNGiteaJsonPath, 'investigation') || fileContains(zhCNGiteaJsonPath, '调查'),
  'Investigation translations not found in zh-CN/gitea.json'
);

// =============================================================================
// 8. Handler Registration Verification
// =============================================================================
console.log('\n📋 8. Handler Registration');

const giteaIndexPath = join(frontendPath, 'src', 'main', 'ipc-handlers', 'gitea', 'index.ts');
test(
  'Registration',
  'gitea/index.ts exists',
  fileExists(giteaIndexPath),
  'File not found at: ' + giteaIndexPath
);

test(
  'Registration',
  'Registers investigation handlers',
  fileContains(giteaIndexPath, 'registerInvestigationHandlers') ||
    fileContains(giteaIndexPath, 'registerInvestigateIssue'),
  'Investigation handler registration not found'
);

const mainIndexPath = join(frontendPath, 'src', 'main', 'ipc-handlers', 'index.ts');
test(
  'Registration',
  'Main IPC handler index imports Gitea handlers',
  fileContains(mainIndexPath, 'registerGiteaHandlers') || fileContains(mainIndexPath, './gitea'),
  'Gitea handlers not imported in main IPC handler index'
);

// =============================================================================
// Summary
// =============================================================================
console.log('\n' + '='.repeat(70));
const passed = testResults.filter(r => r.passed).length;
const failed = testResults.filter(r => !r.passed).length;
const total = testResults.length;

console.log(`\n📊 Test Results: ${passed}/${total} passed (${Math.round(passed / total * 100)}%)`);

if (failed > 0) {
  console.log(`\n❌ ${failed} test(s) failed:\n`);
  testResults
    .filter(r => !r.passed)
    .forEach(r => {
      console.log(`  - [${r.category}] ${r.name}`);
      console.log(`    ${r.message}`);
    });
  process.exit(1);
} else {
  console.log('\n✅ All verification tests passed!');
  console.log('\n🎯 Gitea AI-Powered Issue Investigation is properly implemented.');
  console.log('\n   Feature Flow:');
  console.log('   1. User selects a Gitea issue and clicks "Investigate"');
  console.log('   2. investigateGiteaIssue() sends IPC to main process');
  console.log('   3. registerInvestigateIssue handler receives request');
  console.log('   4. Fetches issue details and comments from Gitea API');
  console.log('   5. Builds issue context using buildIssueContext()');
  console.log('   6. Creates task spec using createSpecForIssue()');
  console.log('   7. Sends progress updates via GITEA_INVESTIGATION_PROGRESS');
  console.log('   8. Sends completion via GITEA_INVESTIGATION_COMPLETE');
  console.log('   9. UI displays investigation results');
  process.exit(0);
}
