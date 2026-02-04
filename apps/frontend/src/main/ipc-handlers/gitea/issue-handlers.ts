/**
 * Gitea issue handlers
 * Handles fetching issues and comments
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../../shared/constants';
import type { IPCResult, GiteaIssue, GiteaComment, GiteaRepository } from '../../../shared/types';
import { projectStore } from '../../project-store';
import { getGiteaConfig, giteaFetch, encodeRepositoryPath } from './utils';
import type { GiteaAPIIssue, GiteaAPIComment, GiteaAPIRepository } from './types';

// Debug logging helper - enabled in development OR when DEBUG flag is set
const DEBUG = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

function debugLog(message: string, data?: unknown): void {
  if (DEBUG) {
    if (data !== undefined) {
      console.debug(`[Gitea Issues] ${message}`, data);
    } else {
      console.debug(`[Gitea Issues] ${message}`);
    }
  }
}

/**
 * Transform Gitea API repository to our format
 */
function transformRepository(apiRepo: GiteaAPIRepository): GiteaRepository {
  return {
    id: apiRepo.id,
    name: apiRepo.name,
    fullName: apiRepo.full_name,
    description: apiRepo.description,
    htmlUrl: apiRepo.html_url,
    cloneUrl: apiRepo.clone_url,
    defaultBranch: apiRepo.default_branch,
    private: apiRepo.private,
    empty: apiRepo.empty,
    mirror: apiRepo.mirror,
    size: apiRepo.size,
    owner: {
      id: apiRepo.owner.id,
      login: apiRepo.owner.login,
      fullName: apiRepo.owner.full_name,
      avatarUrl: apiRepo.owner.avatar_url
    }
  };
}

/**
 * Transform Gitea API issue to our format
 */
function transformIssue(apiIssue: GiteaAPIIssue): GiteaIssue {
  return {
    id: apiIssue.id,
    number: apiIssue.number,
    title: apiIssue.title,
    body: apiIssue.body,
    state: apiIssue.state,
    labels: (apiIssue.labels ?? []).map(l => ({
      id: l.id,
      name: l.name,
      color: l.color,
      description: l.description
    })),
    assignees: (apiIssue.assignees ?? []).map(a => ({
      id: a.id,
      login: a.login,
      fullName: a.full_name,
      avatarUrl: a.avatar_url
    })),
    author: {
      id: apiIssue.author.id,
      login: apiIssue.author.login,
      fullName: apiIssue.author.full_name,
      avatarUrl: apiIssue.author.avatar_url
    },
    milestone: apiIssue.milestone ? {
      id: apiIssue.milestone.id,
      title: apiIssue.milestone.title,
      state: apiIssue.milestone.state
    } : undefined,
    createdAt: apiIssue.created_at,
    updatedAt: apiIssue.updated_at,
    closedAt: apiIssue.closed_at,
    commentsCount: apiIssue.comments,
    url: apiIssue.url,
    htmlUrl: apiIssue.html_url,
    repoFullName: apiIssue.repository.full_name,
    repository: transformRepository(apiIssue.repository)
  };
}

/**
 * Transform Gitea API comment to our format
 */
function transformComment(apiComment: GiteaAPIComment): GiteaComment {
  return {
    id: apiComment.id,
    body: apiComment.body,
    author: {
      id: apiComment.author.id,
      login: apiComment.author.login,
      fullName: apiComment.author.full_name,
      avatarUrl: apiComment.author.avatar_url
    },
    createdAt: apiComment.created_at,
    updatedAt: apiComment.updated_at,
    issue: apiComment.issue ? {
      id: apiComment.issue.id,
      number: apiComment.issue.number,
      title: apiComment.issue.title
    } : undefined,
    pullRequest: apiComment.pull_request ? {
      id: apiComment.pull_request.id,
      number: apiComment.pull_request.number,
      title: apiComment.pull_request.title
    } : undefined
  };
}

/**
 * Get issues from Gitea repository
 */
export function registerGetIssues(): void {
  ipcMain.handle(
    IPC_CHANNELS.GITEA_GET_ISSUES,
    async (_event, projectId: string, state?: 'open' | 'closed' | 'all'): Promise<IPCResult<GiteaIssue[]>> => {
      debugLog('getGiteaIssues handler called', { state });

      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const config = await getGiteaConfig(project);
      if (!config) {
        return {
          success: false,
          error: 'Gitea not configured'
        };
      }

      try {
        const encodedRepo = encodeRepositoryPath(config.repository);
        const stateParam = state === 'all' ? 'all' : (state || 'open');

        const apiIssues = await giteaFetch(
          config.token,
          config.instanceUrl,
          `/repos/${encodedRepo}/issues?state=${stateParam}&limit=100`
        ) as GiteaAPIIssue[];

        debugLog('Fetched issues:', apiIssues.length);

        const issues = apiIssues.map(transformIssue);

        return {
          success: true,
          data: issues
        };
      } catch (error) {
        debugLog('Failed to get issues:', error instanceof Error ? error.message : error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get issues'
        };
      }
    }
  );
}

/**
 * Get a single issue by number
 */
export function registerGetIssue(): void {
  ipcMain.handle(
    IPC_CHANNELS.GITEA_GET_ISSUE,
    async (_event, projectId: string, issueNumber: number): Promise<IPCResult<GiteaIssue>> => {
      debugLog('getGiteaIssue handler called', { issueNumber });

      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const config = await getGiteaConfig(project);
      if (!config) {
        return {
          success: false,
          error: 'Gitea not configured'
        };
      }

      try {
        const encodedRepo = encodeRepositoryPath(config.repository);

        const apiIssue = await giteaFetch(
          config.token,
          config.instanceUrl,
          `/repos/${encodedRepo}/issues/${issueNumber}`
        ) as GiteaAPIIssue;

        const issue = transformIssue(apiIssue);

        return {
          success: true,
          data: issue
        };
      } catch (error) {
        debugLog('Failed to get issue:', error instanceof Error ? error.message : error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get issue'
        };
      }
    }
  );
}

/**
 * Get comments for an issue
 */
export function registerGetIssueComments(): void {
  ipcMain.handle(
    IPC_CHANNELS.GITEA_GET_ISSUE_COMMENTS,
    async (_event, projectId: string, issueNumber: number): Promise<IPCResult<GiteaComment[]>> => {
      debugLog('getGiteaIssueComments handler called', { issueNumber });

      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const config = await getGiteaConfig(project);
      if (!config) {
        return {
          success: false,
          error: 'Gitea not configured'
        };
      }

      try {
        const encodedRepo = encodeRepositoryPath(config.repository);

        const apiComments = await giteaFetch(
          config.token,
          config.instanceUrl,
          `/repos/${encodedRepo}/issues/${issueNumber}/comments?limit=100`
        ) as GiteaAPIComment[];

        const comments = apiComments.map(transformComment);

        debugLog('Fetched comments:', comments.length);

        return {
          success: true,
          data: comments
        };
      } catch (error) {
        debugLog('Failed to get comments:', error instanceof Error ? error.message : error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get comments'
        };
      }
    }
  );
}

/**
 * Register all issue handlers
 */
export function registerIssueHandlers(): void {
  debugLog('Registering Gitea issue handlers');
  registerGetIssues();
  registerGetIssue();
  registerGetIssueComments();
  debugLog('Gitea issue handlers registered');
}
