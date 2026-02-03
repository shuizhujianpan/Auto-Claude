/**
 * Gitea repository handlers
 * Handles connection status and repository management
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../../shared/constants';
import type { IPCResult, GiteaSyncStatus } from '../../../shared/types';
import { projectStore } from '../../project-store';
import { getGiteaConfig, giteaFetch, giteaFetchWithCount, encodeRepositoryPath } from './utils';
import type { GiteaAPIRepository } from './types';

// Debug logging helper
const DEBUG = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

function debugLog(message: string, data?: unknown): void {
  if (DEBUG) {
    if (data !== undefined) {
      console.debug(`[Gitea Repo] ${message}`, data);
    } else {
      console.debug(`[Gitea Repo] ${message}`);
    }
  }
}

/**
 * Check Gitea connection status for a project
 */
export function registerCheckConnection(): void {
  ipcMain.handle(
    IPC_CHANNELS.GITEA_CHECK_CONNECTION,
    async (_event, projectId: string): Promise<IPCResult<GiteaSyncStatus>> => {
      debugLog('checkGiteaConnection handler called', { projectId });

      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const config = await getGiteaConfig(project);
      if (!config) {
        debugLog('No Gitea config found');
        return {
          success: true,
          data: {
            connected: false,
            error: 'Gitea not configured. Please add GITEA_TOKEN and GITEA_REPOSITORY to your .env file.'
          }
        };
      }

      try {
        const encodedRepository = encodeRepositoryPath(config.repository);

        // Fetch repository info
        const repositoryInfo = await giteaFetch(
          config.token,
          config.instanceUrl,
          `/repos/${encodedRepository}`
        ) as GiteaAPIRepository;

        debugLog('Repository info retrieved:', { name: repositoryInfo.name });

        // Get issue count from X-Total header
        const { totalCount: issueCount } = await giteaFetchWithCount(
          config.token,
          config.instanceUrl,
          `/repos/${encodedRepository}/issues?state=open&limit=1`
        );

        return {
          success: true,
          data: {
            connected: true,
            instanceUrl: config.instanceUrl,
            repoFullName: repositoryInfo.full_name,
            repoDescription: repositoryInfo.description,
            issueCount,
            lastSyncedAt: new Date().toISOString()
          }
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to connect to Gitea';
        debugLog('Connection check failed:', errorMessage);
        return {
          success: true,
          data: {
            connected: false,
            error: errorMessage
          }
        };
      }
    }
  );
}

/**
 * Get list of Gitea repositories accessible to the user
 */
export function registerGetRepositories(): void {
  ipcMain.handle(
    IPC_CHANNELS.GITEA_GET_REPOSITORIES,
    async (_event, projectId: string): Promise<IPCResult<GiteaAPIRepository[]>> => {
      debugLog('getGiteaRepositories handler called');

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
        const repositories = await giteaFetch(
          config.token,
          config.instanceUrl,
          '/user/repos?limit=100'
        ) as GiteaAPIRepository[];

        debugLog('Found repositories:', repositories.length);

        return {
          success: true,
          data: repositories
        };
      } catch (error) {
        debugLog('Failed to get repositories:', error instanceof Error ? error.message : error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get repositories'
        };
      }
    }
  );
}

/**
 * Register all repository handlers
 */
export function registerRepositoryHandlers(): void {
  debugLog('Registering Gitea repository handlers');
  registerCheckConnection();
  registerGetRepositories();
  debugLog('Gitea repository handlers registered');
}
