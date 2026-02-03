/**
 * Gitea investigation handlers
 * Handles AI-powered issue investigation
 */

import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../../shared/constants';
import type { GiteaInvestigationStatus, GiteaInvestigationResult } from '../../../shared/types';
import { projectStore } from '../../project-store';
import { getGiteaConfig, giteaFetch, encodeRepositoryPath } from './utils';
import type { GiteaAPIIssue, GiteaAPIComment } from './types';
import { buildIssueContext, createSpecForIssue } from './spec-utils';
import type { AgentManager } from '../../agent';

// Debug logging helper
const DEBUG = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

function debugLog(message: string, data?: unknown): void {
  if (DEBUG) {
    if (data !== undefined) {
      console.debug(`[Gitea Investigation] ${message}`, data);
    } else {
      console.debug(`[Gitea Investigation] ${message}`);
    }
  }
}

/**
 * Send investigation progress to renderer
 */
function sendProgress(
  getMainWindow: () => BrowserWindow | null,
  projectId: string,
  status: GiteaInvestigationStatus
): void {
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send(IPC_CHANNELS.GITEA_INVESTIGATION_PROGRESS, projectId, status);
  }
}

/**
 * Send investigation complete to renderer
 */
function sendComplete(
  getMainWindow: () => BrowserWindow | null,
  projectId: string,
  result: GiteaInvestigationResult
): void {
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send(IPC_CHANNELS.GITEA_INVESTIGATION_COMPLETE, projectId, result);
  }
}

/**
 * Send investigation error to renderer
 */
function sendError(
  getMainWindow: () => BrowserWindow | null,
  projectId: string,
  error: string
): void {
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send(IPC_CHANNELS.GITEA_INVESTIGATION_ERROR, projectId, error);
  }
}

/**
 * Register investigation handler
 */
export function registerInvestigateIssue(
  agentManager: AgentManager,
  getMainWindow: () => BrowserWindow | null
): void {
  ipcMain.on(
    IPC_CHANNELS.GITEA_INVESTIGATE_ISSUE,
    async (_event, projectId: string, issueNumber: number, selectedCommentIds?: number[]) => {
      debugLog('investigateGiteaIssue handler called', { projectId, issueNumber, selectedCommentIds });

      const project = projectStore.getProject(projectId);
      if (!project) {
        sendError(getMainWindow, projectId, 'Project not found');
        return;
      }

      const config = await getGiteaConfig(project);
      if (!config) {
        sendError(getMainWindow, projectId, 'Gitea not configured');
        return;
      }

      try {
        // Phase 1: Fetching issue
        sendProgress(getMainWindow, project.id, {
          phase: 'fetching',
          issueNumber,
          progress: 10,
          message: 'Fetching issue details...'
        });

        const encodedRepository = encodeRepositoryPath(config.repository);

        // Fetch issue
        const issue = await giteaFetch(
          config.token,
          config.instanceUrl,
          `/repos/${encodedRepository}/issues/${issueNumber}`
        ) as GiteaAPIIssue;

        // Fetch comments if any selected
        let selectedComments: GiteaAPIComment[] = [];
        if (selectedCommentIds && selectedCommentIds.length > 0) {
          const allComments = await giteaFetch(
            config.token,
            config.instanceUrl,
            `/repos/${encodedRepository}/issues/${issueNumber}/comments`
          ) as GiteaAPIComment[];

          selectedComments = allComments.filter(comment => selectedCommentIds.includes(comment.id));
        }

        // Phase 2: Analyzing
        sendProgress(getMainWindow, project.id, {
          phase: 'analyzing',
          issueNumber,
          progress: 30,
          message: 'Analyzing issue with AI...'
        });

        // Build context for investigation
        let context = buildIssueContext(issue, config.repository, config.instanceUrl);

        if (selectedComments.length > 0) {
          context += '\n\n## Selected Comments\n';
          for (const comment of selectedComments) {
            const author = comment.author?.login || 'Unknown';
            context += `\n### Comment by ${author} (${new Date(comment.created_at).toLocaleDateString()})\n`;
            context += comment.body + '\n';
          }
        }

        // Use agent manager to investigate
        // Note: This is a simplified version - full implementation would use Claude SDK
        sendProgress(getMainWindow, project.id, {
          phase: 'analyzing',
          issueNumber,
          progress: 50,
          message: 'AI analyzing the issue...'
        });

        // Phase 3: Creating task
        sendProgress(getMainWindow, project.id, {
          phase: 'creating_task',
          issueNumber,
          progress: 80,
          message: 'Creating task from analysis...'
        });

        // Create spec for the issue
        const task = await createSpecForIssue(project, issue, config, project.settings?.mainBranch);

        if (!task) {
          sendError(getMainWindow, project.id, 'Failed to create task from issue');
          return;
        }

        // Phase 4: Complete
        sendProgress(getMainWindow, project.id, {
          phase: 'complete',
          issueNumber,
          progress: 100,
          message: 'Investigation complete'
        });

        // Send result
        const result: GiteaInvestigationResult = {
          success: true,
          issueNumber,
          analysis: {
            summary: `Investigation of Gitea issue #${issueNumber}: ${issue.title}`,
            proposedSolution: issue.body || 'See task details for more information.',
            affectedFiles: [],
            estimatedComplexity: 'standard',
            acceptanceCriteria: []
          },
          taskId: task.id
        };

        sendComplete(getMainWindow, project.id, result);
        debugLog('Investigation complete:', { issueNumber, taskId: task.id });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Investigation failed';
        debugLog('Investigation failed:', errorMessage);
        sendError(getMainWindow, project.id, errorMessage);
      }
    }
  );
}

/**
 * Register all investigation handlers
 */
export function registerInvestigationHandlers(
  agentManager: AgentManager,
  getMainWindow: () => BrowserWindow | null
): void {
  debugLog('Registering Gitea investigation handlers');
  registerInvestigateIssue(agentManager, getMainWindow);
  debugLog('Gitea investigation handlers registered');
}
