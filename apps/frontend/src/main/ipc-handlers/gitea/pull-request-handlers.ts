/**
 * Gitea Pull Request handlers
 * Handles PR operations (list, get, create, update, merge, approve)
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../../shared/constants';
import type { IPCResult, GiteaPullRequest } from '../../../shared/types';
import { projectStore } from '../../project-store';
import { getGiteaConfig, giteaFetch, encodeRepositoryPath } from './utils';
import type {
  GiteaAPIPullRequest,
  CreatePullRequestOptions,
  UpdatePullRequestOptions,
  MergePullRequestOptions,
  ReviewPullRequestOptions
} from './types';

// Valid pull request states per Gitea API
// - open: PR is open and can be modified/merged
// - closed: PR has been closed without merging
// - merged: PR has been successfully merged
// - all: Query parameter to retrieve PRs in any state
const VALID_PR_STATES = ['open', 'closed', 'merged', 'all'] as const;
type PullRequestState = typeof VALID_PR_STATES[number];

/**
 * Validate pull request state parameter
 */
function isValidPrState(state: string): state is PullRequestState {
  return VALID_PR_STATES.includes(state as PullRequestState);
}

// Debug logging helper - enabled in development OR when DEBUG flag is set
const DEBUG = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

function debugLog(message: string, data?: unknown): void {
  if (DEBUG) {
    if (data !== undefined) {
      console.debug(`[Gitea PR] ${message}`, data);
    } else {
      console.debug(`[Gitea PR] ${message}`);
    }
  }
}

/**
 * Transform Gitea API PR to our format
 * Defensively handles missing/null properties
 */
function transformPullRequest(apiPr: GiteaAPIPullRequest): GiteaPullRequest {
  return {
    id: apiPr.id,
    number: apiPr.number,
    title: apiPr.title || '',
    body: apiPr.body || undefined,
    state: apiPr.state || 'open',
    merged: apiPr.merged || false,
    head: {
      label: apiPr.head?.label || '',
      ref: apiPr.head?.ref || '',
      sha: apiPr.head?.sha || '',
      repo: apiPr.head?.repo
        ? {
            id: apiPr.head.repo.id,
            name: apiPr.head.repo.name || '',
            fullName: apiPr.head.repo.full_name || '',
            description: apiPr.head.repo.description || undefined,
            htmlUrl: apiPr.head.repo.html_url || '',
            cloneUrl: apiPr.head.repo.clone_url || '',
            defaultBranch: apiPr.head.repo.default_branch || '',
            private: apiPr.head.repo.private || false,
            empty: apiPr.head.repo.empty || false,
            mirror: apiPr.head.repo.mirror || false,
            size: apiPr.head.repo.size || 0,
            owner: {
              id: apiPr.head.repo.owner?.id || 0,
              login: apiPr.head.repo.owner?.login || '',
              fullName: apiPr.head.repo.owner?.full_name || undefined,
              avatarUrl: apiPr.head.repo.owner?.avatar_url || undefined
            }
          }
        : {
            id: 0,
            name: '',
            fullName: '',
            htmlUrl: '',
            cloneUrl: '',
            defaultBranch: '',
            private: false,
            empty: false,
            mirror: false,
            size: 0,
            owner: { id: 0, login: '' }
          }
    },
    base: {
      label: apiPr.base?.label || '',
      ref: apiPr.base?.ref || '',
      sha: apiPr.base?.sha || '',
      repo: apiPr.base?.repo
        ? {
            id: apiPr.base.repo.id,
            name: apiPr.base.repo.name || '',
            fullName: apiPr.base.repo.full_name || '',
            description: apiPr.base.repo.description || undefined,
            htmlUrl: apiPr.base.repo.html_url || '',
            cloneUrl: apiPr.base.repo.clone_url || '',
            defaultBranch: apiPr.base.repo.default_branch || '',
            private: apiPr.base.repo.private || false,
            empty: apiPr.base.repo.empty || false,
            mirror: apiPr.base.repo.mirror || false,
            size: apiPr.base.repo.size || 0,
            owner: {
              id: apiPr.base.repo.owner?.id || 0,
              login: apiPr.base.repo.owner?.login || '',
              fullName: apiPr.base.repo.owner?.full_name || undefined,
              avatarUrl: apiPr.base.repo.owner?.avatar_url || undefined
            }
          }
        : {
            id: 0,
            name: '',
            fullName: '',
            htmlUrl: '',
            cloneUrl: '',
            defaultBranch: '',
            private: false,
            empty: false,
            mirror: false,
            size: 0,
            owner: { id: 0, login: '' }
          }
    },
    author: apiPr.author
      ? {
          id: apiPr.author.id || 0,
          login: apiPr.author.login || '',
          fullName: apiPr.author.full_name || undefined,
          avatarUrl: apiPr.author.avatar_url || undefined
        }
      : { id: 0, login: '' },
    assignees: Array.isArray(apiPr.assignees)
      ? apiPr.assignees.map(a => ({
          id: a?.id || 0,
          login: a?.login || '',
          fullName: a?.full_name || undefined,
          avatarUrl: a?.avatar_url || undefined
        }))
      : [],
    labels: Array.isArray(apiPr.labels)
      ? apiPr.labels.map(l => ({
          id: l?.id || 0,
          name: l?.name || '',
          color: l?.color || '',
          description: l?.description || undefined
        }))
      : [],
    milestone: apiPr.milestone
      ? {
          id: apiPr.milestone.id,
          title: apiPr.milestone.title,
          state: apiPr.milestone.state
        }
      : undefined,
    mergeable: apiPr.mergeable ?? false,
    mergedAt: apiPr.merged_at || undefined,
    mergedBy: apiPr.merged_by
      ? {
          id: apiPr.merged_by.id || 0,
          login: apiPr.merged_by.login || '',
          avatarUrl: apiPr.merged_by.avatar_url || undefined
        }
      : undefined,
    createdAt: apiPr.created_at || new Date().toISOString(),
    updatedAt: apiPr.updated_at || apiPr.created_at || new Date().toISOString(),
    closedAt: apiPr.closed_at || undefined,
    htmlUrl: apiPr.html_url || '',
    diffUrl: apiPr.diff_url || '',
    patchUrl: apiPr.patch_url || '',
    repoFullName: apiPr.base?.repo?.full_name || ''
  };
}

/**
 * Get pull requests from Gitea repository
 */
export function registerGetPullRequests(): void {
  ipcMain.handle(
    IPC_CHANNELS.GITEA_GET_PULL_REQUESTS,
    async (_event, projectId: string, state?: string): Promise<IPCResult<GiteaPullRequest[]>> => {
      debugLog('getGiteaPullRequests handler called', { state });

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

      // Validate state parameter
      const stateParam = state ?? 'open';
      if (!isValidPrState(stateParam)) {
        return {
          success: false,
          error: `Invalid pull request state: '${stateParam}'. Must be one of: ${VALID_PR_STATES.join(', ')}`
        };
      }

      try {
        const encodedRepository = encodeRepositoryPath(config.repository);

        const apiPrs = await giteaFetch(
          config.token,
          config.instanceUrl,
          `/repos/${encodedRepository}/pulls?state=${stateParam}&limit=100&sort=recentupdate`
        ) as GiteaAPIPullRequest[];

        debugLog('Fetched pull requests:', apiPrs.length);

        const prs = apiPrs.map(transformPullRequest);

        return {
          success: true,
          data: prs
        };
      } catch (error) {
        debugLog('Failed to get pull requests:', error instanceof Error ? error.message : error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get pull requests'
        };
      }
    }
  );
}

/**
 * Get a single pull request by number
 */
export function registerGetPullRequest(): void {
  ipcMain.handle(
    IPC_CHANNELS.GITEA_GET_PULL_REQUEST,
    async (_event, projectId: string, prNumber: number): Promise<IPCResult<GiteaPullRequest>> => {
      debugLog('getGiteaPullRequest handler called', { prNumber });

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
        const encodedRepository = encodeRepositoryPath(config.repository);

        const apiPr = await giteaFetch(
          config.token,
          config.instanceUrl,
          `/repos/${encodedRepository}/pulls/${prNumber}`
        ) as GiteaAPIPullRequest;

        const pr = transformPullRequest(apiPr);

        return {
          success: true,
          data: pr
        };
      } catch (error) {
        debugLog('Failed to get pull request:', error instanceof Error ? error.message : error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get pull request'
        };
      }
    }
  );
}

/**
 * Create a new pull request
 */
export function registerCreatePullRequest(): void {
  ipcMain.handle(
    IPC_CHANNELS.GITEA_CREATE_PULL_REQUEST,
    async (_event, projectId: string, options: CreatePullRequestOptions): Promise<IPCResult<GiteaPullRequest>> => {
      debugLog('createGiteaPullRequest handler called', { title: options.title });

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
        const encodedRepository = encodeRepositoryPath(config.repository);

        const prBody: Record<string, unknown> = {
          title: options.title,
          head: options.sourceBranch,
          base: options.targetBranch
        };

        if (options.description !== undefined) {
          prBody.body = options.description;
        }

        if (options.assigneeIds !== undefined) {
          prBody.assignees = options.assigneeIds;
        }

        if (options.labels !== undefined) {
          prBody.labels = options.labels;
        }

        if (options.milestone !== undefined) {
          prBody.milestone = options.milestone;
        }

        if (options.draft !== undefined) {
          prBody.draft = options.draft;
        }

        const apiPr = await giteaFetch(
          config.token,
          config.instanceUrl,
          `/repos/${encodedRepository}/pulls`,
          {
            method: 'POST',
            body: JSON.stringify(prBody)
          }
        ) as GiteaAPIPullRequest;

        debugLog('Pull request created:', { number: apiPr.number });

        const pr = transformPullRequest(apiPr);

        return {
          success: true,
          data: pr
        };
      } catch (error) {
        debugLog('Failed to create pull request:', error instanceof Error ? error.message : error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create pull request'
        };
      }
    }
  );
}

/**
 * Update a pull request
 */
export function registerUpdatePullRequest(): void {
  ipcMain.handle(
    IPC_CHANNELS.GITEA_UPDATE_PULL_REQUEST,
    async (
      _event,
      projectId: string,
      prNumber: number,
      updates: UpdatePullRequestOptions
    ): Promise<IPCResult<GiteaPullRequest>> => {
      debugLog('updateGiteaPullRequest handler called', { prNumber });

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
        const encodedRepository = encodeRepositoryPath(config.repository);

        const prBody: Record<string, unknown> = {};

        if (updates.title !== undefined) prBody.title = updates.title;
        if (updates.description !== undefined) prBody.body = updates.description;
        if (updates.targetBranch !== undefined) prBody.base = updates.targetBranch;
        if (updates.assigneeIds !== undefined) prBody.assignees = updates.assigneeIds;
        if (updates.labels !== undefined) prBody.labels = updates.labels;
        if (updates.milestone !== undefined) prBody.milestone = updates.milestone;
        if (updates.draft !== undefined) prBody.draft = updates.draft;

        const apiPr = await giteaFetch(
          config.token,
          config.instanceUrl,
          `/repos/${encodedRepository}/pulls/${prNumber}`,
          {
            method: 'PATCH',
            body: JSON.stringify(prBody)
          }
        ) as GiteaAPIPullRequest;

        debugLog('Pull request updated:', { number: apiPr.number });

        const pr = transformPullRequest(apiPr);

        return {
          success: true,
          data: pr
        };
      } catch (error) {
        debugLog('Failed to update pull request:', error instanceof Error ? error.message : error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update pull request'
        };
      }
    }
  );
}

/**
 * Merge a pull request
 */
export function registerMergePullRequest(): void {
  ipcMain.handle(
    IPC_CHANNELS.GITEA_PR_MERGE,
    async (
      _event,
      projectId: string,
      prNumber: number,
      options: MergePullRequestOptions
    ): Promise<IPCResult<{ message: string }>> => {
      debugLog('mergeGiteaPullRequest handler called', { prNumber, method: options.method });

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
        const encodedRepository = encodeRepositoryPath(config.repository);

        const mergeBody: Record<string, unknown> = {
          Do: options.method || 'merge'
        };

        if (options.title !== undefined) {
          mergeBody.MergeTitleField = options.title;
        }

        if (options.message !== undefined) {
          mergeBody.MergeMessageField = options.message;
        }

        if (options.deleteBranch !== undefined) {
          mergeBody.delete_branch_after_merge = options.deleteBranch;
        }

        await giteaFetch(
          config.token,
          config.instanceUrl,
          `/repos/${encodedRepository}/pulls/${prNumber}/merge`,
          {
            method: 'POST',
            body: JSON.stringify(mergeBody)
          }
        );

        debugLog('Pull request merged:', { prNumber });

        return {
          success: true,
          data: { message: 'Pull request merged successfully' }
        };
      } catch (error) {
        debugLog('Failed to merge pull request:', error instanceof Error ? error.message : error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to merge pull request'
        };
      }
    }
  );
}

/**
 * Approve or review a pull request
 */
export function registerApprovePullRequest(): void {
  ipcMain.handle(
    IPC_CHANNELS.GITEA_PR_APPROVE,
    async (
      _event,
      projectId: string,
      prNumber: number,
      options: ReviewPullRequestOptions
    ): Promise<IPCResult<{ message: string }>> => {
      debugLog('approveGiteaPullRequest handler called', { prNumber, event: options.event });

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
        const encodedRepository = encodeRepositoryPath(config.repository);

        const reviewBody: Record<string, unknown> = {
          event: options.event
        };

        if (options.body !== undefined) {
          reviewBody.body = options.body;
        }

        if (options.comments !== undefined) {
          reviewBody.comments = options.comments;
        }

        await giteaFetch(
          config.token,
          config.instanceUrl,
          `/repos/${encodedRepository}/pulls/${prNumber}/reviews`,
          {
            method: 'POST',
            body: JSON.stringify(reviewBody)
          }
        );

        debugLog('Pull request review submitted:', { prNumber, event: options.event });

        return {
          success: true,
          data: { message: `Pull request ${options.event.toLowerCase()} successfully` }
        };
      } catch (error) {
        debugLog('Failed to review pull request:', error instanceof Error ? error.message : error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to review pull request'
        };
      }
    }
  );
}

/**
 * Register all pull request handlers
 */
export function registerPullRequestHandlers(): void {
  debugLog('Registering Gitea pull request handlers');
  registerGetPullRequests();
  registerGetPullRequest();
  registerCreatePullRequest();
  registerUpdatePullRequest();
  registerMergePullRequest();
  registerApprovePullRequest();
  debugLog('Gitea pull request handlers registered');
}
