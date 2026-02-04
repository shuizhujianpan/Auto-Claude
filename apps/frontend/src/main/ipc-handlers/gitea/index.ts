/**
 * Gitea IPC Handlers Module
 *
 * This module exports the main registration function for all Gitea-related IPC handlers.
 */

import type { BrowserWindow } from 'electron';
import type { AgentManager } from '../../agent';

import { registerGiteaOAuthHandlers } from './oauth-handlers';
import { registerRepositoryHandlers } from './repository-handlers';
import { registerIssueHandlers } from './issue-handlers';
import { registerInvestigationHandlers } from './investigation-handlers';
import { registerImportHandlers } from './import-handlers';
import { registerReleaseHandlers } from './release-handlers';
import { registerPullRequestHandlers } from './pull-request-handlers';
import { registerPRReviewHandlers } from './pr-review-handlers';

// Debug logging helper
const DEBUG = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

function debugLog(message: string): void {
  if (DEBUG) {
    console.debug(`[Gitea] ${message}`);
  }
}

/**
 * Register all Gitea IPC handlers
 */
export function registerGiteaHandlers(
  agentManager: AgentManager,
  getMainWindow: () => BrowserWindow | null
): void {
  debugLog('Registering all Gitea handlers');

  // OAuth and authentication handlers
  registerGiteaOAuthHandlers();

  // Repository/project handlers
  registerRepositoryHandlers();

  // Issue handlers
  registerIssueHandlers();

  // Investigation handlers (AI-powered)
  registerInvestigationHandlers(agentManager, getMainWindow);

  // Import handlers
  registerImportHandlers();

  // Release handlers
  registerReleaseHandlers();

  // Pull request handlers
  registerPullRequestHandlers();

  // PR Review handlers (AI-powered)
  registerPRReviewHandlers(getMainWindow);

  debugLog('All Gitea handlers registered');
}

// Re-export individual registration functions for custom usage
export {
  registerGiteaOAuthHandlers,
  registerRepositoryHandlers,
  registerIssueHandlers,
  registerInvestigationHandlers,
  registerImportHandlers,
  registerReleaseHandlers,
  registerPullRequestHandlers,
  registerPRReviewHandlers
};
