/**
 * Gitea PR Review IPC handlers
 *
 * Handles AI-powered PR review:
 * 1. Get PR diff
 * 2. Run AI review with code analysis
 * 3. Post review comments
 * 4. Merge PR
 * 5. Assign users
 * 6. Approve PR
 */

import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { IPC_CHANNELS, MODEL_ID_MAP, DEFAULT_FEATURE_MODELS, DEFAULT_FEATURE_THINKING } from '../../../shared/constants';
import type { AuthFailureInfo } from '../../../shared/types/terminal';
import { getGiteaConfig, giteaFetch, encodeRepositoryPath } from './utils';
import { readSettingsFile } from '../../settings-utils';
import type { Project, AppSettings } from '../../../shared/types';
import type {
  PRReviewFinding,
  PRReviewResult,
  PRReviewProgress,
  NewCommitsCheck,
} from './types';
import { createContextLogger } from '../github/utils/logger';
import { withProjectOrNull } from '../github/utils/project-middleware';
import { createIPCCommunicators } from '../github/utils/ipc-communicator';
import {
  runPythonSubprocess,
  getPythonPath,
  buildRunnerArgs,
} from '../github/utils/subprocess-runner';
import { getRunnerEnv } from '../github/utils/runner-env';

/**
 * Get the Gitea runner path
 */
function getGiteaRunnerPath(backendPath: string): string {
  return path.join(backendPath, 'runners', 'gitea', 'runner.py');
}

// Debug logging
const { debug: debugLog } = createContextLogger('Gitea PR');

/**
 * Registry of running PR review processes
 * Key format: `${projectId}:${prNumber}`
 */
const runningReviews = new Map<string, import('child_process').ChildProcess>();

/**
 * Get the registry key for a PR review
 */
function getReviewKey(projectId: string, prNumber: number): string {
  return `${projectId}:${prNumber}`;
}

/**
 * Get the Gitea directory for a project
 */
function getGiteaDir(project: Project): string {
  return path.join(project.path, '.auto-claude', 'gitea');
}

/**
 * Get saved PR review result
 */
function getReviewResult(project: Project, prNumber: number): PRReviewResult | null {
  const reviewPath = path.join(getGiteaDir(project), 'pr', `review_${prNumber}.json`);

  if (fs.existsSync(reviewPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(reviewPath, 'utf-8'));
      return {
        prNumber: data.pr_number,
        project: data.project,
        success: data.success,
        findings: data.findings?.map((f: Record<string, unknown>) => ({
          id: f.id,
          severity: f.severity,
          category: f.category,
          title: f.title,
          description: f.description,
          file: f.file,
          line: f.line,
          endLine: f.end_line,
          suggestedFix: f.suggested_fix,
          fixable: f.fixable ?? false,
        })) ?? [],
        summary: data.summary ?? '',
        overallStatus: data.overall_status ?? 'comment',
        reviewedAt: data.reviewed_at ?? new Date().toISOString(),
        reviewedCommitSha: data.reviewed_commit_sha,
        isFollowupReview: data.is_followup_review ?? false,
        previousReviewId: data.previous_review_id,
        resolvedFindings: data.resolved_findings ?? [],
        unresolvedFindings: data.unresolved_findings ?? [],
        newFindingsSinceLastReview: data.new_findings_since_last_review ?? [],
        hasPostedFindings: data.has_posted_findings ?? false,
        postedFindingIds: data.posted_finding_ids ?? [],
      };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Get Gitea PR model and thinking settings from app settings
 */
function getGiteaPRSettings(): { model: string; thinkingLevel: string } {
  const rawSettings = readSettingsFile() as Partial<AppSettings> | undefined;

  // Get feature models/thinking with defaults
  const featureModels = rawSettings?.featureModels ?? DEFAULT_FEATURE_MODELS;
  const featureThinking = rawSettings?.featureThinking ?? DEFAULT_FEATURE_THINKING;

  // Use GitHub PRs settings as fallback (Gitea PRs not yet in settings)
  const modelShort = featureModels.githubPrs ?? DEFAULT_FEATURE_MODELS.githubPrs;
  const thinkingLevel = featureThinking.githubPrs ?? DEFAULT_FEATURE_THINKING.githubPrs;

  // Convert model short name to full model ID
  const model = MODEL_ID_MAP[modelShort] ?? MODEL_ID_MAP['opus'];

  debugLog('Gitea PR settings', { modelShort, model, thinkingLevel });

  return { model, thinkingLevel };
}

/**
 * Validate Gitea module is properly set up
 */
async function validateGiteaModule(project: Project): Promise<{ valid: boolean; backendPath?: string; error?: string }> {
  if (!project.autoBuildPath) {
    return { valid: false, error: 'Auto Build path not configured for this project' };
  }

  const backendPath = path.join(project.path, project.autoBuildPath);

  // Check if the runners directory exists
  const runnersPath = path.join(backendPath, 'runners', 'gitea');
  if (!fs.existsSync(runnersPath)) {
    return { valid: false, error: 'Gitea runners not found. Please ensure the backend is properly installed.' };
  }

  return { valid: true, backendPath };
}

/**
 * Run the Python PR reviewer
 */
async function runPRReview(
  project: Project,
  prNumber: number,
  mainWindow: BrowserWindow
): Promise<PRReviewResult> {
  const validation = await validateGiteaModule(project);

  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const backendPath = validation.backendPath!;

  const { sendProgress } = createIPCCommunicators<PRReviewProgress, PRReviewResult>(
    mainWindow,
    {
      progress: IPC_CHANNELS.GITEA_PR_REVIEW_PROGRESS,
      error: IPC_CHANNELS.GITEA_PR_REVIEW_ERROR,
      complete: IPC_CHANNELS.GITEA_PR_REVIEW_COMPLETE,
    },
    project.id
  );

  const { model, thinkingLevel } = getGiteaPRSettings();
  const args = buildRunnerArgs(
    getGiteaRunnerPath(backendPath),
    project.path,
    'review-pr',
    [prNumber.toString()],
    { model, thinkingLevel }
  );

  debugLog('Spawning PR review process', { args, model, thinkingLevel });

  // Get runner environment with PYTHONPATH for bundled packages (fixes #139)
  const subprocessEnv = await getRunnerEnv();

  const { process: childProcess, promise } = runPythonSubprocess<PRReviewResult>({
    pythonPath: getPythonPath(backendPath),
    args,
    cwd: backendPath,
    env: subprocessEnv,
    onProgress: (percent, message) => {
      debugLog('Progress update', { percent, message });
      sendProgress({
        phase: 'analyzing',
        prNumber,
        progress: percent,
        message,
      });
    },
    onStdout: (line) => debugLog('STDOUT:', line),
    onStderr: (line) => debugLog('STDERR:', line),
    onAuthFailure: (authFailureInfo: AuthFailureInfo) => {
      debugLog('Auth failure detected in PR review', authFailureInfo);
      mainWindow.webContents.send(IPC_CHANNELS.CLAUDE_AUTH_FAILURE, authFailureInfo);
    },
    onComplete: () => {
      const reviewResult = getReviewResult(project, prNumber);
      if (!reviewResult) {
        throw new Error('Review completed but result not found');
      }
      debugLog('Review result loaded', { findingsCount: reviewResult.findings.length });
      return reviewResult;
    },
  });

  // Register the running process
  const reviewKey = getReviewKey(project.id, prNumber);
  runningReviews.set(reviewKey, childProcess);
  debugLog('Registered review process', { reviewKey, pid: childProcess.pid });

  try {
    const result = await promise;

    if (!result.success) {
      throw new Error(result.error ?? 'Review failed');
    }

    return result.data!;
  } finally {
    runningReviews.delete(reviewKey);
    debugLog('Unregistered review process', { reviewKey });
  }
}

/**
 * Register PR review handlers
 */
export function registerPRReviewHandlers(
  getMainWindow: () => BrowserWindow | null
): void {
  debugLog('Registering PR review handlers');

  // Get PR diff (feature parity with GitHub PR diff)
  ipcMain.handle(
    IPC_CHANNELS.GITEA_PR_GET_DIFF,
    async (_, projectId: string, prNumber: number): Promise<string | null> => {
      return withProjectOrNull(projectId, async (project) => {
        const config = await getGiteaConfig(project);
        if (!config) return null;

        try {
          // Validate prNumber
          if (!Number.isInteger(prNumber) || prNumber <= 0) {
            throw new Error('Invalid PR number');
          }

          const encodedRepo = encodeRepositoryPath(config.repository);
          const diff = await giteaFetch(
            config.token,
            config.instanceUrl,
            `/repos/${encodedRepo}/pulls/${prNumber}.diff`
          ) as string;

          return diff;
        } catch (error) {
          debugLog('Failed to get PR diff', { prNumber, error: error instanceof Error ? error.message : error });
          return null;
        }
      });
    }
  );

  // Get saved review
  ipcMain.handle(
    IPC_CHANNELS.GITEA_PR_GET_REVIEW,
    async (_, projectId: string, prNumber: number): Promise<PRReviewResult | null> => {
      return withProjectOrNull(projectId, async (project) => {
        return getReviewResult(project, prNumber);
      });
    }
  );

  // Run AI review
  ipcMain.on(
    IPC_CHANNELS.GITEA_PR_REVIEW,
    async (_, projectId: string, prNumber: number) => {
      debugLog('runPRReview handler called', { projectId, prNumber });
      const mainWindow = getMainWindow();
      if (!mainWindow) {
        debugLog('No main window available');
        return;
      }

      try {
        await withProjectOrNull(projectId, async (project) => {
          const { sendProgress, sendComplete } = createIPCCommunicators<PRReviewProgress, PRReviewResult>(
            mainWindow,
            {
              progress: IPC_CHANNELS.GITEA_PR_REVIEW_PROGRESS,
              error: IPC_CHANNELS.GITEA_PR_REVIEW_ERROR,
              complete: IPC_CHANNELS.GITEA_PR_REVIEW_COMPLETE,
            },
            projectId
          );

          debugLog('Starting PR review', { prNumber });
          sendProgress({
            phase: 'fetching',
            prNumber,
            progress: 5,
            message: 'Assigning you to PR...',
          });

          // Auto-assign current user to PR
          const config = await getGiteaConfig(project);
          if (config) {
            try {
              // Get current user
              const user = await giteaFetch(config.token, config.instanceUrl, '/user') as { id: number; login: string };
              debugLog('Auto-assigning user to PR', { prNumber, username: user.login });

              // Assign to PR
              const encodedRepo = encodeRepositoryPath(config.repository);
              await giteaFetch(
                config.token,
                config.instanceUrl,
                `/repos/${encodedRepo}/pulls/${prNumber}`,
                {
                  method: 'PATCH',
                  body: JSON.stringify({ assignee: user.login }),
                }
              );
              debugLog('User assigned successfully', { prNumber, username: user.login });
            } catch (assignError) {
              debugLog('Failed to auto-assign user', { prNumber, error: assignError instanceof Error ? assignError.message : assignError });
            }
          }

          sendProgress({
            phase: 'fetching',
            prNumber,
            progress: 10,
            message: 'Fetching PR data...',
          });

          const result = await runPRReview(project, prNumber, mainWindow);

          debugLog('PR review completed', { prNumber, findingsCount: result.findings.length });
          sendProgress({
            phase: 'complete',
            prNumber,
            progress: 100,
            message: 'Review complete!',
          });

          sendComplete(result);
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        debugLog('PR review failed', { prNumber, error: errorMessage });
        const { sendError } = createIPCCommunicators<PRReviewProgress, PRReviewResult>(
          mainWindow,
          {
            progress: IPC_CHANNELS.GITEA_PR_REVIEW_PROGRESS,
            error: IPC_CHANNELS.GITEA_PR_REVIEW_ERROR,
            complete: IPC_CHANNELS.GITEA_PR_REVIEW_COMPLETE,
          },
          projectId
        );
        sendError({ prNumber, error: `PR review failed for PR #${prNumber}: ${errorMessage}` });
      }
    }
  );

  // Post review as comment to PR
  ipcMain.handle(
    IPC_CHANNELS.GITEA_PR_POST_REVIEW,
    async (_, projectId: string, prNumber: number, selectedFindingIds?: string[]): Promise<boolean> => {
      debugLog('postPRReview handler called', { projectId, prNumber, selectedCount: selectedFindingIds?.length });
      const postResult = await withProjectOrNull(projectId, async (project) => {
        const result = getReviewResult(project, prNumber);
        if (!result) {
          debugLog('No review result found', { prNumber });
          return false;
        }

        const config = await getGiteaConfig(project);
        if (!config) {
          debugLog('No Gitea config found');
          return false;
        }

        try {
          // Filter findings if selection provided
          const selectedSet = selectedFindingIds ? new Set(selectedFindingIds) : null;
          const findings = selectedSet
            ? result.findings.filter(f => selectedSet.has(f.id))
            : result.findings;

          debugLog('Posting findings', { total: result.findings.length, selected: findings.length });

          // Build comment body
          let body = `## Auto Claude PR Review\n\n${result.summary}\n\n`;

          if (findings.length > 0) {
            const countText = selectedSet
              ? `${findings.length} selected of ${result.findings.length} total`
              : `${findings.length} total`;
            body += `### Findings (${countText})\n\n`;

            for (const f of findings) {
              const emoji = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵' }[f.severity] || '⚪';
              body += `#### ${emoji} [${f.severity.toUpperCase()}] ${f.title}\n`;
              body += `📁 \`${f.file}:${f.line}\`\n\n`;
              body += `${f.description}\n\n`;
              const suggestedFix = f.suggestedFix?.trim();
              if (suggestedFix) {
                body += `**Suggested fix:**\n\`\`\`\n${suggestedFix}\n\`\`\`\n\n`;
              }
            }
          } else {
            body += `*No findings selected for this review.*\n\n`;
          }

          body += `---\n*This review was generated by Auto Claude.*`;

          const encodedRepo = encodeRepositoryPath(config.repository);

          // Post as comment to the PR
          await giteaFetch(
            config.token,
            config.instanceUrl,
            `/repos/${encodedRepo}/issues/${prNumber}/comments`,
            {
              method: 'POST',
              body: JSON.stringify({ body }),
            }
          );

          debugLog('Review comment posted successfully', { prNumber });

          // Update the stored review result with posted findings
          // Use atomic write with temp file to prevent race conditions
          const reviewPath = path.join(getGiteaDir(project), 'pr', `review_${prNumber}.json`);
          const tempPath = `${reviewPath}.tmp.${randomUUID()}`;
          try {
            const data = JSON.parse(fs.readFileSync(reviewPath, 'utf-8'));
            data.has_posted_findings = true;
            const newPostedIds = findings.map(f => f.id);
            const existingPostedIds = data.posted_finding_ids || [];
            data.posted_finding_ids = [...new Set([...existingPostedIds, ...newPostedIds])];
            // Write to temp file first, then rename atomically
            fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
            fs.renameSync(tempPath, reviewPath);
            debugLog('Updated review result with posted findings', { prNumber, postedCount: newPostedIds.length });
          } catch (error) {
            // Clean up temp file if it exists
            try { fs.unlinkSync(tempPath); } catch { /* ignore cleanup errors */ }
            debugLog('Failed to update review result file', { error: error instanceof Error ? error.message : error });
          }

          return true;
        } catch (error) {
          debugLog('Failed to post review', { prNumber, error: error instanceof Error ? error.message : error });
          return false;
        }
      });
      return postResult ?? false;
    }
  );

  // Post comment to PR
  ipcMain.handle(
    IPC_CHANNELS.GITEA_PR_POST_NOTE,
    async (_, projectId: string, prNumber: number, body: string): Promise<boolean> => {
      debugLog('postPRNote handler called', { projectId, prNumber });
      const postResult = await withProjectOrNull(projectId, async (project) => {
        const config = await getGiteaConfig(project);
        if (!config) return false;

        try {
          const encodedRepo = encodeRepositoryPath(config.repository);
          await giteaFetch(
            config.token,
            config.instanceUrl,
            `/repos/${encodedRepo}/issues/${prNumber}/comments`,
            {
              method: 'POST',
              body: JSON.stringify({ body }),
            }
          );
          debugLog('Comment posted successfully', { prNumber });
          return true;
        } catch (error) {
          debugLog('Failed to post comment', { prNumber, error: error instanceof Error ? error.message : error });
          return false;
        }
      });
      return postResult ?? false;
    }
  );

  // Merge PR
  ipcMain.handle(
    IPC_CHANNELS.GITEA_PR_MERGE,
    async (_, projectId: string, prNumber: number, mergeMethod: 'merge' | 'squash' | 'rebase' = 'squash'): Promise<boolean> => {
      debugLog('mergePR handler called', { projectId, prNumber, mergeMethod });
      const mergeResult = await withProjectOrNull(projectId, async (project) => {
        const config = await getGiteaConfig(project);
        if (!config) return false;

        try {
          // Validate prNumber
          if (!Number.isInteger(prNumber) || prNumber <= 0) {
            throw new Error('Invalid PR number');
          }

          const encodedRepo = encodeRepositoryPath(config.repository);

          // Gitea uses 'Do' suffix for merge methods
          const giteaMergeMethod = mergeMethod === 'merge' ? 'Merge' : mergeMethod;

          debugLog('Merging PR', { prNumber, method: giteaMergeMethod });

          await giteaFetch(
            config.token,
            config.instanceUrl,
            `/repos/${encodedRepo}/pulls/${prNumber}/merge`,
            {
              method: 'POST',
              body: JSON.stringify({ Do: giteaMergeMethod }),
            }
          );

          debugLog('PR merged successfully', { prNumber });
          return true;
        } catch (error) {
          debugLog('Failed to merge PR', { prNumber, error: error instanceof Error ? error.message : error });
          return false;
        }
      });
      return mergeResult ?? false;
    }
  );

  // Assign users to PR
  ipcMain.handle(
    IPC_CHANNELS.GITEA_PR_ASSIGN,
    async (_, projectId: string, prNumber: number, assignee: string): Promise<boolean> => {
      debugLog('assignPR handler called', { projectId, prNumber, assignee });
      const assignResult = await withProjectOrNull(projectId, async (project) => {
        const config = await getGiteaConfig(project);
        if (!config) return false;

        try {
          const encodedRepo = encodeRepositoryPath(config.repository);
          await giteaFetch(
            config.token,
            config.instanceUrl,
            `/repos/${encodedRepo}/pulls/${prNumber}`,
            {
              method: 'PATCH',
              body: JSON.stringify({ assignee }),
            }
          );
          debugLog('User assigned successfully', { prNumber, assignee });
          return true;
        } catch (error) {
          debugLog('Failed to assign user', { prNumber, assignee, error: error instanceof Error ? error.message : error });
          return false;
        }
      });
      return assignResult ?? false;
    }
  );

  // Approve PR
  ipcMain.handle(
    IPC_CHANNELS.GITEA_PR_APPROVE,
    async (_, projectId: string, prNumber: number): Promise<boolean> => {
      debugLog('approvePR handler called', { projectId, prNumber });
      const approveResult = await withProjectOrNull(projectId, async (project) => {
        const config = await getGiteaConfig(project);
        if (!config) return false;

        try {
          const encodedRepo = encodeRepositoryPath(config.repository);
          await giteaFetch(
            config.token,
            config.instanceUrl,
            `/repos/${encodedRepo}/pulls/${prNumber}/reviews`,
            {
              method: 'POST',
              body: JSON.stringify({ event: 'APPROVED' }),
            }
          );
          debugLog('PR approved successfully', { prNumber });
          return true;
        } catch (error) {
          debugLog('Failed to approve PR', { prNumber, error: error instanceof Error ? error.message : error });
          return false;
        }
      });
      return approveResult ?? false;
    }
  );

  // Cancel PR review
  ipcMain.handle(
    IPC_CHANNELS.GITEA_PR_REVIEW_CANCEL,
    async (_, projectId: string, prNumber: number): Promise<boolean> => {
      debugLog('cancelPRReview handler called', { projectId, prNumber });
      const reviewKey = getReviewKey(projectId, prNumber);
      const childProcess = runningReviews.get(reviewKey);

      if (!childProcess) {
        debugLog('No running review found to cancel', { reviewKey });
        return false;
      }

      try {
        debugLog('Killing review process', { reviewKey, pid: childProcess.pid });
        childProcess.kill('SIGTERM');

        setTimeout(() => {
          if (!childProcess.killed) {
            debugLog('Force killing review process', { reviewKey, pid: childProcess.pid });
            childProcess.kill('SIGKILL');
          }
        }, 1000);

        runningReviews.delete(reviewKey);
        debugLog('Review process cancelled', { reviewKey });
        return true;
      } catch (error) {
        debugLog('Failed to cancel review', { reviewKey, error: error instanceof Error ? error.message : error });
        return false;
      }
    }
  );

  // Check for new commits since last review
  ipcMain.handle(
    IPC_CHANNELS.GITEA_PR_CHECK_NEW_COMMITS,
    async (_, projectId: string, prNumber: number): Promise<NewCommitsCheck> => {
      debugLog('checkNewCommits handler called', { projectId, prNumber });

      const result = await withProjectOrNull(projectId, async (project) => {
        const giteaDir = path.join(project.path, '.auto-claude', 'gitea');
        const reviewPath = path.join(giteaDir, 'pr', `review_${prNumber}.json`);

        if (!fs.existsSync(reviewPath)) {
          return { hasNewCommits: false };
        }

        let review: PRReviewResult;
        try {
          const data = fs.readFileSync(reviewPath, 'utf-8');
          review = JSON.parse(data);
        } catch {
          return { hasNewCommits: false };
        }

        const reviewedCommitSha = review.reviewedCommitSha || (review as any).reviewed_commit_sha;
        if (!reviewedCommitSha) {
          debugLog('No reviewedCommitSha in review', { prNumber });
          return { hasNewCommits: false };
        }

        const config = await getGiteaConfig(project);
        if (!config) {
          return { hasNewCommits: false };
        }

        try {
          const encodedRepo = encodeRepositoryPath(config.repository);
          const prData = await giteaFetch(
            config.token,
            config.instanceUrl,
            `/repos/${encodedRepo}/pulls/${prNumber}`
          ) as { head: { sha: string } };

          const currentHeadSha = prData.head?.sha;

          if (reviewedCommitSha === currentHeadSha) {
            return {
              hasNewCommits: false,
              currentSha: currentHeadSha,
              reviewedSha: reviewedCommitSha,
            };
          }

          // Get commits to count new ones
          const commits = await giteaFetch(
            config.token,
            config.instanceUrl,
            `/repos/${encodedRepo}/pulls/${prNumber}/commits`
          ) as Array<{ sha: string }>;

          // Find how many commits are after the reviewed one
          let newCommitCount = 0;
          for (const commit of commits) {
            if (commit.sha === reviewedCommitSha) break;
            newCommitCount++;
          }

          return {
            hasNewCommits: true,
            currentSha: currentHeadSha,
            reviewedSha: reviewedCommitSha,
            newCommitCount: newCommitCount || 1,
          };
        } catch (error) {
          debugLog('Error checking new commits', { prNumber, error: error instanceof Error ? error.message : error });
          return { hasNewCommits: false };
        }
      });

      return result ?? { hasNewCommits: false };
    }
  );

  // Run follow-up review
  ipcMain.on(
    IPC_CHANNELS.GITEA_PR_FOLLOWUP_REVIEW,
    async (_, projectId: string, prNumber: number) => {
      debugLog('followupReview handler called', { projectId, prNumber });
      const mainWindow = getMainWindow();
      if (!mainWindow) {
        debugLog('No main window available');
        return;
      }

      try {
        await withProjectOrNull(projectId, async (project) => {
          const { sendProgress, sendError, sendComplete } = createIPCCommunicators<PRReviewProgress, PRReviewResult>(
            mainWindow,
            {
              progress: IPC_CHANNELS.GITEA_PR_REVIEW_PROGRESS,
              error: IPC_CHANNELS.GITEA_PR_REVIEW_ERROR,
              complete: IPC_CHANNELS.GITEA_PR_REVIEW_COMPLETE,
            },
            projectId
          );

          const validation = await validateGiteaModule(project);
          if (!validation.valid) {
            sendError({ prNumber, error: validation.error || 'Gitea module validation failed' });
            return;
          }

          const backendPath = validation.backendPath!;
          const reviewKey = getReviewKey(projectId, prNumber);

          if (runningReviews.has(reviewKey)) {
            debugLog('Follow-up review already running', { reviewKey });
            return;
          }

          debugLog('Starting follow-up review', { prNumber });
          sendProgress({
            phase: 'fetching',
            prNumber,
            progress: 5,
            message: 'Starting follow-up review...',
          });

          const { model, thinkingLevel } = getGiteaPRSettings();
          const args = buildRunnerArgs(
            getGiteaRunnerPath(backendPath),
            project.path,
            'followup-review-pr',
            [prNumber.toString()],
            { model, thinkingLevel }
          );

          debugLog('Spawning follow-up review process', { args, model, thinkingLevel });

          // Get runner environment with PYTHONPATH for bundled packages (fixes #139)
          const followupSubprocessEnv = await getRunnerEnv();

          const { process: childProcess, promise } = runPythonSubprocess<PRReviewResult>({
            pythonPath: getPythonPath(backendPath),
            args,
            cwd: backendPath,
            env: followupSubprocessEnv,
            onProgress: (percent, message) => {
              debugLog('Progress update', { percent, message });
              sendProgress({
                phase: 'analyzing',
                prNumber,
                progress: percent,
                message,
              });
            },
            onStdout: (line) => debugLog('STDOUT:', line),
            onStderr: (line) => debugLog('STDERR:', line),
            onAuthFailure: (authFailureInfo: AuthFailureInfo) => {
              debugLog('Auth failure detected in follow-up PR review', authFailureInfo);
              mainWindow.webContents.send(IPC_CHANNELS.CLAUDE_AUTH_FAILURE, authFailureInfo);
            },
            onComplete: () => {
              const reviewResult = getReviewResult(project, prNumber);
              if (!reviewResult) {
                throw new Error('Follow-up review completed but result not found');
              }
              debugLog('Follow-up review result loaded', { findingsCount: reviewResult.findings.length });
              return reviewResult;
            },
          });

          runningReviews.set(reviewKey, childProcess);
          debugLog('Registered follow-up review process', { reviewKey, pid: childProcess.pid });

          try {
            const result = await promise;

            if (!result.success) {
              throw new Error(result.error ?? 'Follow-up review failed');
            }

            debugLog('Follow-up review completed', { prNumber, findingsCount: result.data?.findings.length });
            sendProgress({
              phase: 'complete',
              prNumber,
              progress: 100,
              message: 'Follow-up review complete!',
            });

            sendComplete(result.data!);
          } finally {
            runningReviews.delete(reviewKey);
            debugLog('Unregistered follow-up review process', { reviewKey });
          }
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        debugLog('Follow-up review failed', { prNumber, error: errorMessage });
        const { sendError } = createIPCCommunicators<PRReviewProgress, PRReviewResult>(
          mainWindow,
          {
            progress: IPC_CHANNELS.GITEA_PR_REVIEW_PROGRESS,
            error: IPC_CHANNELS.GITEA_PR_REVIEW_ERROR,
            complete: IPC_CHANNELS.GITEA_PR_REVIEW_COMPLETE,
          },
          projectId
        );
        sendError({ prNumber, error: `Follow-up review failed for PR #${prNumber}: ${errorMessage}` });
      }
    }
  );

  debugLog('PR review handlers registered');
}
