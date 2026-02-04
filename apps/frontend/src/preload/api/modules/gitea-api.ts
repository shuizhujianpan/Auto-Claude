import { IPC_CHANNELS } from '../../../shared/constants';
import type {
  GiteaRepository,
  GiteaIssue,
  GiteaComment,
  GiteaPullRequest,
  GiteaSyncStatus,
  GiteaImportResult,
  GiteaInvestigationStatus,
  GiteaInvestigationResult,
  GiteaPRReviewResult,
  GiteaPRReviewProgress,
  GiteaNewCommitsCheck,
  GiteaAutoFixConfig,
  GiteaAutoFixQueueItem,
  GiteaAutoFixProgress,
  GiteaIssueBatch,
  GiteaAnalyzePreviewResult,
  GiteaTriageConfig,
  GiteaTriageResult,
  GiteaOrganization,
  IPCResult
} from '../../../shared/types';
import { createIpcListener, invokeIpc, sendIpc, IpcListenerCleanup } from './ipc-utils';

/**
 * Gitea Integration API operations
 */
export interface GiteaAPI {
  // Repository operations
  getGiteaRepositories: (owner: string) => Promise<IPCResult<GiteaRepository[]>>;
  checkGiteaConnection: (repoOwner: string, repoName: string) => Promise<IPCResult<GiteaSyncStatus>>;

  // Issue operations
  getGiteaIssues: (repoOwner: string, repoName: string, state?: 'open' | 'closed' | 'all') => Promise<IPCResult<GiteaIssue[]>>;
  getGiteaIssue: (repoOwner: string, repoName: string, issueNumber: number) => Promise<IPCResult<GiteaIssue>>;
  getGiteaIssueComments: (repoOwner: string, repoName: string, issueNumber: number) => Promise<IPCResult<GiteaComment[]>>;
  investigateGiteaIssue: (repoOwner: string, repoName: string, issueNumber: number) => void;
  importGiteaIssues: (repoOwner: string, repoName: string, issueNumbers: number[]) => Promise<IPCResult<GiteaImportResult>>;

  // Pull Request operations
  getGiteaPullRequests: (repoOwner: string, repoName: string, state?: string) => Promise<IPCResult<GiteaPullRequest[]>>;
  getGiteaPullRequest: (repoOwner: string, repoName: string, prNumber: number) => Promise<IPCResult<GiteaPullRequest>>;
  createGiteaPullRequest: (
    repoOwner: string,
    repoName: string,
    options: {
      title: string;
      body?: string;
      head: string;
      base: string;
      labels?: string[];
      assignees?: string[];
    }
  ) => Promise<IPCResult<GiteaPullRequest>>;
  updateGiteaPullRequest: (
    repoOwner: string,
    repoName: string,
    prNumber: number,
    updates: {
      title?: string;
      body?: string;
      base?: string;
      labels?: string[];
      assignees?: string[];
    }
  ) => Promise<IPCResult<GiteaPullRequest>>;

  // PR Review operations (AI-powered)
  getGiteaPRDiff: (repoOwner: string, repoName: string, prNumber: number) => Promise<string | null>;
  getGiteaPRReview: (repoOwner: string, repoName: string, prNumber: number) => Promise<GiteaPRReviewResult | null>;
  runGiteaPRReview: (repoOwner: string, repoName: string, prNumber: number) => void;
  runGiteaPRFollowupReview: (repoOwner: string, repoName: string, prNumber: number) => void;
  postGiteaPRReview: (repoOwner: string, repoName: string, prNumber: number, selectedFindingIds?: string[]) => Promise<boolean>;
  postGiteaPRNote: (repoOwner: string, repoName: string, prNumber: number, body: string) => Promise<boolean>;
  mergeGiteaPR: (repoOwner: string, repoName: string, prNumber: number, mergeMethod?: 'merge' | 'squash' | 'rebase') => Promise<boolean>;
  assignGiteaPR: (repoOwner: string, repoName: string, prNumber: number, usernames: string[]) => Promise<boolean>;
  approveGiteaPR: (repoOwner: string, repoName: string, prNumber: number) => Promise<boolean>;
  cancelGiteaPRReview: (repoOwner: string, repoName: string, prNumber: number) => Promise<boolean>;
  checkGiteaPRNewCommits: (repoOwner: string, repoName: string, prNumber: number) => Promise<GiteaNewCommitsCheck>;

  // PR Review Event Listeners
  onGiteaPRReviewProgress: (
    callback: (repoOwner: string, repoName: string, progress: GiteaPRReviewProgress) => void
  ) => IpcListenerCleanup;
  onGiteaPRReviewComplete: (
    callback: (repoOwner: string, repoName: string, result: GiteaPRReviewResult) => void
  ) => IpcListenerCleanup;
  onGiteaPRReviewError: (
    callback: (repoOwner: string, repoName: string, data: { prNumber: number; error: string }) => void
  ) => IpcListenerCleanup;

  // Gitea Auto-Fix operations
  getGiteaAutoFixConfig: (repoOwner: string, repoName: string) => Promise<GiteaAutoFixConfig | null>;
  saveGiteaAutoFixConfig: (repoOwner: string, repoName: string, config: GiteaAutoFixConfig) => Promise<boolean>;
  getGiteaAutoFixQueue: (repoOwner: string, repoName: string) => Promise<GiteaAutoFixQueueItem[]>;
  checkGiteaAutoFixLabels: (repoOwner: string, repoName: string) => Promise<number[]>;
  checkNewGiteaAutoFixIssues: (repoOwner: string, repoName: string) => Promise<Array<{ number: number }>>;
  startGiteaAutoFix: (repoOwner: string, repoName: string, issueNumber: number) => void;
  getGiteaAutoFixBatches: (repoOwner: string, repoName: string) => Promise<GiteaIssueBatch[]>;
  analyzeGiteaAutoFixPreview: (repoOwner: string, repoName: string, issueNumbers?: number[], maxIssues?: number) => void;
  approveGiteaAutoFixBatches: (repoOwner: string, repoName: string, batches: GiteaIssueBatch[]) => Promise<{ success: boolean; batches?: GiteaIssueBatch[]; error?: string }>;

  // Gitea Auto-Fix Event Listeners
  onGiteaAutoFixProgress: (
    callback: (repoOwner: string, repoName: string, progress: GiteaAutoFixProgress) => void
  ) => IpcListenerCleanup;
  onGiteaAutoFixComplete: (
    callback: (repoOwner: string, repoName: string, result: GiteaAutoFixQueueItem) => void
  ) => IpcListenerCleanup;
  onGiteaAutoFixError: (
    callback: (repoOwner: string, repoName: string, error: string) => void
  ) => IpcListenerCleanup;
  onGiteaAutoFixAnalyzePreviewProgress: (
    callback: (repoOwner: string, repoName: string, progress: { phase: string; progress: number; message: string }) => void
  ) => IpcListenerCleanup;
  onGiteaAutoFixAnalyzePreviewComplete: (
    callback: (repoOwner: string, repoName: string, result: GiteaAnalyzePreviewResult) => void
  ) => IpcListenerCleanup;
  onGiteaAutoFixAnalyzePreviewError: (
    callback: (repoOwner: string, repoName: string, error: string) => void
  ) => IpcListenerCleanup;

  // Gitea Triage operations
  getGiteaTriageConfig: (repoOwner: string, repoName: string) => Promise<GiteaTriageConfig | null>;
  saveGiteaTriageConfig: (repoOwner: string, repoName: string, config: GiteaTriageConfig) => Promise<boolean>;
  getGiteaTriageResults: (repoOwner: string, repoName: string) => Promise<GiteaTriageResult[]>;
  runGiteaTriage: (repoOwner: string, repoName: string, issueNumbers?: number[]) => void;
  applyGiteaTriageLabels: (repoOwner: string, repoName: string, issueNumber: number, labelsToAdd: string[], labelsToRemove: string[]) => Promise<boolean>;

  // Gitea Triage Event Listeners
  onGiteaTriageProgress: (
    callback: (repoOwner: string, repoName: string, progress: { phase: string; progress: number; message: string; issueNumber?: number }) => void
  ) => IpcListenerCleanup;
  onGiteaTriageComplete: (
    callback: (repoOwner: string, repoName: string, results: GiteaTriageResult[]) => void
  ) => IpcListenerCleanup;
  onGiteaTriageError: (
    callback: (repoOwner: string, repoName: string, error: string) => void
  ) => IpcListenerCleanup;

  // Release operations
  createGiteaRelease: (
    repoOwner: string,
    repoName: string,
    tagName: string,
    releaseNotes: string,
    options?: { body?: string; targetCommitish?: string }
  ) => Promise<IPCResult<{ url: string }>>;

  // Organization operations
  listGiteaOrganizations: () => Promise<IPCResult<{ organizations: GiteaOrganization[] }>>;

  // Event Listeners
  onGiteaInvestigationProgress: (
    callback: (repoOwner: string, repoName: string, status: GiteaInvestigationStatus) => void
  ) => IpcListenerCleanup;
  onGiteaInvestigationComplete: (
    callback: (repoOwner: string, repoName: string, result: GiteaInvestigationResult) => void
  ) => IpcListenerCleanup;
  onGiteaInvestigationError: (
    callback: (repoOwner: string, repoName: string, error: string) => void
  ) => IpcListenerCleanup;
}

/**
 * Creates the Gitea Integration API implementation
 */
export const createGiteaAPI = (): GiteaAPI => ({
  // Repository operations
  getGiteaRepositories: (owner: string): Promise<IPCResult<GiteaRepository[]>> =>
    invokeIpc(IPC_CHANNELS.GITEA_GET_REPOSITORIES, owner),

  checkGiteaConnection: (repoOwner: string, repoName: string): Promise<IPCResult<GiteaSyncStatus>> =>
    invokeIpc(IPC_CHANNELS.GITEA_CHECK_CONNECTION, repoOwner, repoName),

  // Issue operations
  getGiteaIssues: (repoOwner: string, repoName: string, state?: 'open' | 'closed' | 'all'): Promise<IPCResult<GiteaIssue[]>> =>
    invokeIpc(IPC_CHANNELS.GITEA_GET_ISSUES, repoOwner, repoName, state),

  getGiteaIssue: (repoOwner: string, repoName: string, issueNumber: number): Promise<IPCResult<GiteaIssue>> =>
    invokeIpc(IPC_CHANNELS.GITEA_GET_ISSUE, repoOwner, repoName, issueNumber),

  getGiteaIssueComments: (repoOwner: string, repoName: string, issueNumber: number): Promise<IPCResult<GiteaComment[]>> =>
    invokeIpc(IPC_CHANNELS.GITEA_GET_ISSUE_COMMENTS, repoOwner, repoName, issueNumber),

  investigateGiteaIssue: (repoOwner: string, repoName: string, issueNumber: number): void =>
    sendIpc(IPC_CHANNELS.GITEA_INVESTIGATE_ISSUE, repoOwner, repoName, issueNumber),

  importGiteaIssues: (repoOwner: string, repoName: string, issueNumbers: number[]): Promise<IPCResult<GiteaImportResult>> =>
    invokeIpc(IPC_CHANNELS.GITEA_IMPORT_ISSUES, repoOwner, repoName, issueNumbers),

  // Pull Request operations
  getGiteaPullRequests: (repoOwner: string, repoName: string, state?: string): Promise<IPCResult<GiteaPullRequest[]>> =>
    invokeIpc(IPC_CHANNELS.GITEA_GET_PULL_REQUESTS, repoOwner, repoName, state),

  getGiteaPullRequest: (repoOwner: string, repoName: string, prNumber: number): Promise<IPCResult<GiteaPullRequest>> =>
    invokeIpc(IPC_CHANNELS.GITEA_GET_PULL_REQUEST, repoOwner, repoName, prNumber),

  createGiteaPullRequest: (
    repoOwner: string,
    repoName: string,
    options: {
      title: string;
      body?: string;
      head: string;
      base: string;
      labels?: string[];
      assignees?: string[];
    }
  ): Promise<IPCResult<GiteaPullRequest>> =>
    invokeIpc(IPC_CHANNELS.GITEA_CREATE_PULL_REQUEST, repoOwner, repoName, options),

  updateGiteaPullRequest: (
    repoOwner: string,
    repoName: string,
    prNumber: number,
    updates: {
      title?: string;
      body?: string;
      base?: string;
      labels?: string[];
      assignees?: string[];
    }
  ): Promise<IPCResult<GiteaPullRequest>> =>
    invokeIpc(IPC_CHANNELS.GITEA_UPDATE_PULL_REQUEST, repoOwner, repoName, prNumber, updates),

  // PR Review operations (AI-powered)
  getGiteaPRDiff: (repoOwner: string, repoName: string, prNumber: number): Promise<string | null> =>
    invokeIpc(IPC_CHANNELS.GITEA_PR_GET_DIFF, repoOwner, repoName, prNumber),

  getGiteaPRReview: (repoOwner: string, repoName: string, prNumber: number): Promise<GiteaPRReviewResult | null> =>
    invokeIpc(IPC_CHANNELS.GITEA_PR_GET_REVIEW, repoOwner, repoName, prNumber),

  runGiteaPRReview: (repoOwner: string, repoName: string, prNumber: number): void =>
    sendIpc(IPC_CHANNELS.GITEA_PR_REVIEW, repoOwner, repoName, prNumber),

  runGiteaPRFollowupReview: (repoOwner: string, repoName: string, prNumber: number): void =>
    sendIpc(IPC_CHANNELS.GITEA_PR_FOLLOWUP_REVIEW, repoOwner, repoName, prNumber),

  postGiteaPRReview: (repoOwner: string, repoName: string, prNumber: number, selectedFindingIds?: string[]): Promise<boolean> =>
    invokeIpc(IPC_CHANNELS.GITEA_PR_POST_REVIEW, repoOwner, repoName, prNumber, selectedFindingIds),

  postGiteaPRNote: (repoOwner: string, repoName: string, prNumber: number, body: string): Promise<boolean> =>
    invokeIpc(IPC_CHANNELS.GITEA_PR_POST_NOTE, repoOwner, repoName, prNumber, body),

  mergeGiteaPR: (repoOwner: string, repoName: string, prNumber: number, mergeMethod?: 'merge' | 'squash' | 'rebase'): Promise<boolean> =>
    invokeIpc(IPC_CHANNELS.GITEA_PR_MERGE, repoOwner, repoName, prNumber, mergeMethod),

  assignGiteaPR: (repoOwner: string, repoName: string, prNumber: number, usernames: string[]): Promise<boolean> =>
    invokeIpc(IPC_CHANNELS.GITEA_PR_ASSIGN, repoOwner, repoName, prNumber, usernames),

  approveGiteaPR: (repoOwner: string, repoName: string, prNumber: number): Promise<boolean> =>
    invokeIpc(IPC_CHANNELS.GITEA_PR_APPROVE, repoOwner, repoName, prNumber),

  cancelGiteaPRReview: (repoOwner: string, repoName: string, prNumber: number): Promise<boolean> =>
    invokeIpc(IPC_CHANNELS.GITEA_PR_REVIEW_CANCEL, repoOwner, repoName, prNumber),

  checkGiteaPRNewCommits: (repoOwner: string, repoName: string, prNumber: number): Promise<GiteaNewCommitsCheck> =>
    invokeIpc(IPC_CHANNELS.GITEA_PR_CHECK_NEW_COMMITS, repoOwner, repoName, prNumber),

  // PR Review Event Listeners
  onGiteaPRReviewProgress: (
    callback: (repoOwner: string, repoName: string, progress: GiteaPRReviewProgress) => void
  ): IpcListenerCleanup =>
    createIpcListener(IPC_CHANNELS.GITEA_PR_REVIEW_PROGRESS, callback),

  onGiteaPRReviewComplete: (
    callback: (repoOwner: string, repoName: string, result: GiteaPRReviewResult) => void
  ): IpcListenerCleanup =>
    createIpcListener(IPC_CHANNELS.GITEA_PR_REVIEW_COMPLETE, callback),

  onGiteaPRReviewError: (
    callback: (repoOwner: string, repoName: string, data: { prNumber: number; error: string }) => void
  ): IpcListenerCleanup =>
    createIpcListener(IPC_CHANNELS.GITEA_PR_REVIEW_ERROR, callback),

  // Gitea Auto-Fix operations
  getGiteaAutoFixConfig: (repoOwner: string, repoName: string): Promise<GiteaAutoFixConfig | null> =>
    invokeIpc(IPC_CHANNELS.GITEA_AUTOFIX_GET_CONFIG, repoOwner, repoName),

  saveGiteaAutoFixConfig: (repoOwner: string, repoName: string, config: GiteaAutoFixConfig): Promise<boolean> =>
    invokeIpc(IPC_CHANNELS.GITEA_AUTOFIX_SAVE_CONFIG, repoOwner, repoName, config),

  getGiteaAutoFixQueue: (repoOwner: string, repoName: string): Promise<GiteaAutoFixQueueItem[]> =>
    invokeIpc(IPC_CHANNELS.GITEA_AUTOFIX_GET_QUEUE, repoOwner, repoName),

  checkGiteaAutoFixLabels: (repoOwner: string, repoName: string): Promise<number[]> =>
    invokeIpc(IPC_CHANNELS.GITEA_AUTOFIX_CHECK_LABELS, repoOwner, repoName),

  checkNewGiteaAutoFixIssues: (repoOwner: string, repoName: string): Promise<Array<{ number: number }>> =>
    invokeIpc(IPC_CHANNELS.GITEA_AUTOFIX_CHECK_NEW, repoOwner, repoName),

  startGiteaAutoFix: (repoOwner: string, repoName: string, issueNumber: number): void =>
    sendIpc(IPC_CHANNELS.GITEA_AUTOFIX_START, repoOwner, repoName, issueNumber),

  getGiteaAutoFixBatches: (repoOwner: string, repoName: string): Promise<GiteaIssueBatch[]> =>
    invokeIpc(IPC_CHANNELS.GITEA_AUTOFIX_GET_BATCHES, repoOwner, repoName),

  analyzeGiteaAutoFixPreview: (repoOwner: string, repoName: string, issueNumbers?: number[], maxIssues?: number): void =>
    sendIpc(IPC_CHANNELS.GITEA_AUTOFIX_ANALYZE_PREVIEW, repoOwner, repoName, issueNumbers, maxIssues),

  approveGiteaAutoFixBatches: (repoOwner: string, repoName: string, batches: GiteaIssueBatch[]): Promise<{ success: boolean; batches?: GiteaIssueBatch[]; error?: string }> =>
    invokeIpc(IPC_CHANNELS.GITEA_AUTOFIX_APPROVE_BATCHES, repoOwner, repoName, batches),

  // Gitea Auto-Fix Event Listeners
  onGiteaAutoFixProgress: (
    callback: (repoOwner: string, repoName: string, progress: GiteaAutoFixProgress) => void
  ): IpcListenerCleanup =>
    createIpcListener(IPC_CHANNELS.GITEA_AUTOFIX_PROGRESS, callback),

  onGiteaAutoFixComplete: (
    callback: (repoOwner: string, repoName: string, result: GiteaAutoFixQueueItem) => void
  ): IpcListenerCleanup =>
    createIpcListener(IPC_CHANNELS.GITEA_AUTOFIX_COMPLETE, callback),

  onGiteaAutoFixError: (
    callback: (repoOwner: string, repoName: string, error: string) => void
  ): IpcListenerCleanup =>
    createIpcListener(IPC_CHANNELS.GITEA_AUTOFIX_ERROR, callback),

  onGiteaAutoFixAnalyzePreviewProgress: (
    callback: (repoOwner: string, repoName: string, progress: { phase: string; progress: number; message: string }) => void
  ): IpcListenerCleanup =>
    createIpcListener(IPC_CHANNELS.GITEA_AUTOFIX_ANALYZE_PREVIEW_PROGRESS, callback),

  onGiteaAutoFixAnalyzePreviewComplete: (
    callback: (repoOwner: string, repoName: string, result: GiteaAnalyzePreviewResult) => void
  ): IpcListenerCleanup =>
    createIpcListener(IPC_CHANNELS.GITEA_AUTOFIX_ANALYZE_PREVIEW_COMPLETE, callback),

  onGiteaAutoFixAnalyzePreviewError: (
    callback: (repoOwner: string, repoName: string, error: string) => void
  ): IpcListenerCleanup =>
    createIpcListener(IPC_CHANNELS.GITEA_AUTOFIX_ANALYZE_PREVIEW_ERROR, callback),

  // Gitea Triage operations
  getGiteaTriageConfig: (repoOwner: string, repoName: string): Promise<GiteaTriageConfig | null> =>
    invokeIpc(IPC_CHANNELS.GITEA_TRIAGE_GET_CONFIG, repoOwner, repoName),

  saveGiteaTriageConfig: (repoOwner: string, repoName: string, config: GiteaTriageConfig): Promise<boolean> =>
    invokeIpc(IPC_CHANNELS.GITEA_TRIAGE_SAVE_CONFIG, repoOwner, repoName, config),

  getGiteaTriageResults: (repoOwner: string, repoName: string): Promise<GiteaTriageResult[]> =>
    invokeIpc(IPC_CHANNELS.GITEA_TRIAGE_GET_RESULTS, repoOwner, repoName),

  runGiteaTriage: (repoOwner: string, repoName: string, issueNumbers?: number[]): void =>
    sendIpc(IPC_CHANNELS.GITEA_TRIAGE_RUN, repoOwner, repoName, issueNumbers),

  applyGiteaTriageLabels: (repoOwner: string, repoName: string, issueNumber: number, labelsToAdd: string[], labelsToRemove: string[]): Promise<boolean> =>
    invokeIpc(IPC_CHANNELS.GITEA_TRIAGE_APPLY_LABELS, repoOwner, repoName, issueNumber, labelsToAdd, labelsToRemove),

  // Gitea Triage Event Listeners
  onGiteaTriageProgress: (
    callback: (repoOwner: string, repoName: string, progress: { phase: string; progress: number; message: string; issueNumber?: number }) => void
  ): IpcListenerCleanup =>
    createIpcListener(IPC_CHANNELS.GITEA_TRIAGE_PROGRESS, callback),

  onGiteaTriageComplete: (
    callback: (repoOwner: string, repoName: string, results: GiteaTriageResult[]) => void
  ): IpcListenerCleanup =>
    createIpcListener(IPC_CHANNELS.GITEA_TRIAGE_COMPLETE, callback),

  onGiteaTriageError: (
    callback: (repoOwner: string, repoName: string, error: string) => void
  ): IpcListenerCleanup =>
    createIpcListener(IPC_CHANNELS.GITEA_TRIAGE_ERROR, callback),

  // Release operations
  createGiteaRelease: (
    repoOwner: string,
    repoName: string,
    tagName: string,
    releaseNotes: string,
    options?: { body?: string; targetCommitish?: string }
  ): Promise<IPCResult<{ url: string }>> =>
    invokeIpc(IPC_CHANNELS.GITEA_CREATE_RELEASE, repoOwner, repoName, tagName, releaseNotes, options),

  // Organization operations
  listGiteaOrganizations: (): Promise<IPCResult<{ organizations: GiteaOrganization[] }>> =>
    invokeIpc(IPC_CHANNELS.GITEA_GET_REPOSITORIES, ''), // TODO: Add proper channel if needed

  // Event Listeners
  onGiteaInvestigationProgress: (
    callback: (repoOwner: string, repoName: string, status: GiteaInvestigationStatus) => void
  ): IpcListenerCleanup =>
    createIpcListener(IPC_CHANNELS.GITEA_INVESTIGATION_PROGRESS, callback),

  onGiteaInvestigationComplete: (
    callback: (repoOwner: string, repoName: string, result: GiteaInvestigationResult) => void
  ): IpcListenerCleanup =>
    createIpcListener(IPC_CHANNELS.GITEA_INVESTIGATION_COMPLETE, callback),

  onGiteaInvestigationError: (
    callback: (repoOwner: string, repoName: string, error: string) => void
  ): IpcListenerCleanup =>
    createIpcListener(IPC_CHANNELS.GITEA_INVESTIGATION_ERROR, callback)
});
