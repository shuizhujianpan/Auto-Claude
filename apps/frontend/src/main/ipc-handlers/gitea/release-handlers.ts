/**
 * Gitea release handlers
 * Handles creating releases
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../../shared/constants';
import type { IPCResult } from '../../../shared/types';
import { projectStore } from '../../project-store';
import { getGiteaConfig, giteaFetch, encodeRepositoryPath } from './utils';
import type { GiteaReleaseOptions } from './types';

// Debug logging helper
const DEBUG = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

function debugLog(message: string, data?: unknown): void {
  if (DEBUG) {
    if (data !== undefined) {
      console.debug(`[Gitea Release] ${message}`, data);
    } else {
      console.debug(`[Gitea Release] ${message}`);
    }
  }
}

/**
 * Create a Gitea release
 */
export function registerCreateRelease(): void {
  ipcMain.handle(
    IPC_CHANNELS.GITEA_CREATE_RELEASE,
    async (
      _event,
      projectId: string,
      tagName: string,
      releaseNotes: string,
      options?: GiteaReleaseOptions
    ): Promise<IPCResult<{ url: string }>> => {
      debugLog('createGiteaRelease handler called', { tagName });

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

        // Create the release
        const releaseBody: Record<string, unknown> = {
          tag_name: tagName,
          name: tagName, // Gitea uses name for the release title
          body: options?.description || releaseNotes,
          target: options?.ref || project.settings.mainBranch || 'main'
        };

        const release = await giteaFetch(
          config.token,
          config.instanceUrl,
          `/repos/${encodedRepository}/releases`,
          {
            method: 'POST',
            body: JSON.stringify(releaseBody)
          }
        ) as unknown;

        // Safely extract URL from response
        // Gitea API returns html_url for the release
        const releaseUrl = (
          release &&
          typeof release === 'object' &&
          'html_url' in release &&
          typeof release.html_url === 'string'
        ) ? release.html_url : null;

        if (!releaseUrl) {
          return {
            success: false,
            error: 'Unexpected response format from Gitea API'
          };
        }

        debugLog('Release created:', { tagName, url: releaseUrl });

        return {
          success: true,
          data: { url: releaseUrl }
        };
      } catch (error) {
        debugLog('Failed to create release:', error instanceof Error ? error.message : error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create release'
        };
      }
    }
  );
}

/**
 * Register all release handlers
 */
export function registerReleaseHandlers(): void {
  debugLog('Registering Gitea release handlers');
  registerCreateRelease();
  debugLog('Gitea release handlers registered');
}
