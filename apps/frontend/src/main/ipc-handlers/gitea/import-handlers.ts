/**
 * Gitea import handlers
 * Handles bulk importing issues as tasks
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../../shared/constants';
import type { IPCResult, GiteaImportResult } from '../../../shared/types';
import { projectStore } from '../../project-store';
import { getGiteaConfig, giteaFetch, encodeRepositoryPath } from './utils';
import type { GiteaAPIIssue } from './types';
import { createSpecForIssue, GiteaTaskInfo } from './spec-utils';

// Debug logging helper
const DEBUG = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

function debugLog(message: string, data?: unknown): void {
  if (DEBUG) {
    if (data !== undefined) {
      console.debug(`[Gitea Import] ${message}`, data);
    } else {
      console.debug(`[Gitea Import] ${message}`);
    }
  }
}

/**
 * Import multiple Gitea issues as tasks
 */
export function registerImportIssues(): void {
  ipcMain.handle(
    IPC_CHANNELS.GITEA_IMPORT_ISSUES,
    async (_event, projectId: string, issueNumbers: number[]): Promise<IPCResult<GiteaImportResult>> => {
      debugLog('importGiteaIssues handler called', { issueNumbers });

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

      const tasks: GiteaTaskInfo[] = [];
      const errors: string[] = [];
      let imported = 0;
      let failed = 0;

      for (const number of issueNumbers) {
        try {
          const encodedRepository = encodeRepositoryPath(config.repository);

          // Fetch the issue
          const apiIssue = await giteaFetch(
            config.token,
            config.instanceUrl,
            `/repos/${encodedRepository}/issues/${number}`
          ) as GiteaAPIIssue;

          // Create a spec/task from the issue
          const task = await createSpecForIssue(project, apiIssue, config, project.settings?.mainBranch);

          if (task) {
            tasks.push(task);
            imported++;
            debugLog('Imported issue:', { number, taskId: task.id });
          } else {
            failed++;
            errors.push(`Failed to create task for issue #${number}`);
          }
        } catch (error) {
          failed++;
          const errorMessage = error instanceof Error ? error.message : `Unknown error for issue #${number}`;
          errors.push(errorMessage);
          debugLog('Failed to import issue:', { number, error: errorMessage });
        }
      }

      // Note: IPCResult.success indicates transport success (IPC call completed without system error).
      // data.success indicates operation success (at least one issue was imported).
      // This distinction allows the UI to differentiate between system failures and partial imports.
      return {
        success: true,
        data: {
          success: imported > 0,
          imported,
          failed,
          errors: errors.length > 0 ? errors : undefined
        }
      };
    }
  );
}

/**
 * Register all import handlers
 */
export function registerImportHandlers(): void {
  debugLog('Registering Gitea import handlers');
  registerImportIssues();
  debugLog('Gitea import handlers registered');
}
