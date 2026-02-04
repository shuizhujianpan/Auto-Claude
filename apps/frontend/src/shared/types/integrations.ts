/**
 * External integrations (Linear, GitHub)
 */

// ============================================
// Linear Integration Types
// ============================================

export interface LinearIssue {
  id: string;
  identifier: string; // e.g., "ABC-123"
  title: string;
  description?: string;
  state: {
    id: string;
    name: string;
    type: string; // 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled'
  };
  priority: number; // 0-4, where 1 is urgent
  priorityLabel: string;
  labels: Array<{ id: string; name: string; color: string }>;
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
  project?: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
  url: string;
}

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
}

export interface LinearProject {
  id: string;
  name: string;
  state: string;
}

export interface LinearImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors?: string[];
}

export interface LinearSyncStatus {
  connected: boolean;
  teamName?: string;
  projectName?: string;
  issueCount?: number;
  lastSyncedAt?: string;
  error?: string;
}

// ============================================
// GitHub Integration Types
// ============================================

export interface GitHubRepository {
  id: number;
  name: string;
  fullName: string; // owner/repo
  description?: string;
  url: string;
  defaultBranch: string;
  private: boolean;
  owner: {
    login: string;
    avatarUrl?: string;
  };
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed';
  labels: Array<{ id: number; name: string; color: string; description?: string }>;
  assignees: Array<{ login: string; avatarUrl?: string }>;
  author: {
    login: string;
    avatarUrl?: string;
  };
  milestone?: {
    id: number;
    title: string;
    state: 'open' | 'closed';
  };
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  commentsCount: number;
  url: string;
  htmlUrl: string;
  repoFullName: string;
}

/**
 * Result type for paginated issue fetching
 */
export interface PaginatedIssuesResult {
  issues: GitHubIssue[];
  hasMore: boolean;
}

export interface GitHubSyncStatus {
  connected: boolean;
  repoFullName?: string;
  repoDescription?: string;
  issueCount?: number;
  lastSyncedAt?: string;
  error?: string;
}

export interface GitHubImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors?: string[];
  tasks?: import('./task').Task[];
}

export interface GitHubInvestigationResult {
  success: boolean;
  issueNumber: number;
  analysis: {
    summary: string;
    proposedSolution: string;
    affectedFiles: string[];
    estimatedComplexity: 'simple' | 'standard' | 'complex';
    acceptanceCriteria: string[];
  };
  taskId?: string;
  error?: string;
}

export interface GitHubInvestigationStatus {
  phase: 'idle' | 'fetching' | 'analyzing' | 'creating_task' | 'complete' | 'error';
  issueNumber?: number;
  progress: number;
  message: string;
  error?: string;
}

// ============================================
// GitLab Integration Types
// ============================================

export interface GitLabProject {
  id: number;
  name: string;
  pathWithNamespace: string; // group/project format
  description?: string;
  webUrl: string;
  defaultBranch: string;
  visibility: 'private' | 'internal' | 'public';
  namespace: {
    id: number;
    name: string;
    path: string;
    kind: 'group' | 'user';
  };
  avatarUrl?: string;
}

export interface GitLabIssue {
  id: number;
  iid: number; // Project-scoped ID (GitLab uses iid for display)
  title: string;
  description?: string;
  state: 'opened' | 'closed';
  labels: string[]; // GitLab uses string array, not objects
  assignees: Array<{ username: string; avatarUrl?: string }>;
  author: {
    username: string;
    avatarUrl?: string;
  };
  milestone?: {
    id: number;
    title: string;
    state: 'active' | 'closed';
  };
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  userNotesCount: number; // GitLab's comment count field
  webUrl: string;
  projectPathWithNamespace: string;
}

export interface GitLabMergeRequest {
  id: number;
  iid: number;
  title: string;
  description?: string;
  state: 'opened' | 'closed' | 'merged' | 'locked';
  sourceBranch: string;
  targetBranch: string;
  author: {
    username: string;
    avatarUrl?: string;
  };
  assignees: Array<{ username: string; avatarUrl?: string }>;
  labels: string[];
  webUrl: string;
  createdAt: string;
  updatedAt: string;
  mergedAt?: string;
  mergeStatus: string;
}

export interface GitLabNote {
  id: number;
  body: string;
  author: {
    username: string;
    avatarUrl?: string;
  };
  createdAt: string;
  updatedAt: string;
  system: boolean; // System-generated notes (status changes, etc.)
}

export interface GitLabGroup {
  id: number;
  name: string;
  path: string;
  fullPath: string;
  description?: string;
  avatarUrl?: string;
}

export interface GitLabSyncStatus {
  connected: boolean;
  instanceUrl?: string; // GitLab-specific: base URL of instance
  projectPathWithNamespace?: string;
  projectDescription?: string;
  issueCount?: number;
  lastSyncedAt?: string;
  error?: string;
}

export interface GitLabImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors?: string[];
  tasks?: import('./task').Task[];
}

export interface GitLabInvestigationResult {
  success: boolean;
  issueIid: number; // GitLab uses iid
  analysis: {
    summary: string;
    proposedSolution: string;
    affectedFiles: string[];
    estimatedComplexity: 'simple' | 'standard' | 'complex';
    acceptanceCriteria: string[];
  };
  taskId?: string;
  error?: string;
}

export interface GitLabInvestigationStatus {
  phase: 'idle' | 'fetching' | 'analyzing' | 'creating_task' | 'complete' | 'error';
  issueIid?: number;
  progress: number;
  message: string;
  error?: string;
}

// ============================================
// GitLab MR Review Types
// ============================================

export interface GitLabMRReviewFinding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'security' | 'quality' | 'style' | 'test' | 'docs' | 'pattern' | 'performance';
  title: string;
  description: string;
  file: string;
  line: number;
  endLine?: number;
  suggestedFix?: string;
  fixable: boolean;
}

export interface GitLabMRReviewResult {
  mrIid: number;
  project: string;
  success: boolean;
  findings: GitLabMRReviewFinding[];
  summary: string;
  overallStatus: 'approve' | 'request_changes' | 'comment';
  reviewedAt: string;
  reviewedCommitSha?: string;
  isFollowupReview?: boolean;
  previousReviewId?: number;
  resolvedFindings?: string[];
  unresolvedFindings?: string[];
  newFindingsSinceLastReview?: string[];
  hasPostedFindings?: boolean;
  postedFindingIds?: string[];
}

export interface GitLabMRReviewProgress {
  phase: 'fetching' | 'analyzing' | 'generating' | 'posting' | 'complete';
  mrIid: number;
  progress: number;
  message: string;
}

export interface GitLabNewCommitsCheck {
  hasNewCommits: boolean;
  currentSha?: string;
  reviewedSha?: string;
  newCommitCount?: number;
}

// ============================================
// GitLab Auto-Fix Types
// ============================================

export interface GitLabAutoFixConfig {
  enabled: boolean;
  labels: string[];
  requireHumanApproval: boolean;
  model: string;
  thinkingLevel: string;
}

export interface GitLabAutoFixQueueItem {
  issueIid: number;
  project: string;
  status: 'pending' | 'analyzing' | 'creating_spec' | 'building' | 'qa_review' | 'mr_created' | 'completed' | 'failed';
  specId?: string;
  mrIid?: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface GitLabIssueBatch {
  id: string;
  issues: Array<{ iid: number; title: string; similarity: number }>;
  commonThemes: string[];
  confidence: number;
  reasoning: string;
}

export interface GitLabBatchProgress {
  phase: 'analyzing' | 'grouping' | 'complete';
  progress: number;
  message: string;
  issuesAnalyzed?: number;
  totalIssues?: number;
}

export interface GitLabAutoFixProgress {
  phase: 'checking' | 'fetching' | 'analyzing' | 'batching' | 'creating_spec' | 'building' | 'qa_review' | 'creating_mr' | 'complete';
  issueIid: number;
  progress: number;
  message: string;
}

export interface GitLabAnalyzePreviewResult {
  success: boolean;
  totalIssues: number;
  analyzedIssues: number;
  alreadyBatched: number;
  proposedBatches: Array<{
    primaryIssue: number;
    issues: Array<{
      iid: number;
      title: string;
      labels: string[];
      similarityToPrimary: number;
    }>;
    issueCount: number;
    commonThemes: string[];
    validated: boolean;
    confidence: number;
    reasoning: string;
    theme: string;
  }>;
  singleIssues: Array<{
    iid: number;
    title: string;
    labels: string[];
  }>;
  message: string;
  error?: string;
}

// ============================================
// GitLab Triage Types
// ============================================

export type GitLabTriageCategory = 'bug' | 'feature' | 'documentation' | 'question' | 'duplicate' | 'spam' | 'feature_creep';

export interface GitLabTriageConfig {
  enabled: boolean;
  duplicateThreshold: number;
  spamThreshold: number;
  featureCreepThreshold: number;
  enableComments: boolean;
}

export interface GitLabTriageResult {
  issueIid: number;
  category: GitLabTriageCategory;
  confidence: number;
  labelsToAdd: string[];
  labelsToRemove: string[];
  duplicateOf?: number;
  spamReason?: string;
  featureCreepReason?: string;
  priority: 'high' | 'medium' | 'low';
  comment?: string;
  triagedAt: string;
}

// ============================================
// Roadmap Integration Types (Canny, etc.)
// ============================================

/**
 * Represents a feedback item from an external roadmap service
 */
export interface RoadmapFeedbackItem {
  externalId: string;
  title: string;
  description: string;
  votes: number;
  status: string;  // Provider-specific status
  url: string;
  createdAt: Date;
  updatedAt?: Date;
  author?: string;
  tags?: string[];
}

/**
 * Connection status for a roadmap provider
 */
export interface RoadmapProviderConnection {
  id: string;
  name: string;
  connected: boolean;
  lastSync?: Date;
  error?: string;
}

/**
 * Configuration for a roadmap provider integration
 */
export interface RoadmapProviderConfig {
  enabled: boolean;
  apiKey?: string;
  boardId?: string;
  autoSync?: boolean;
  syncIntervalMinutes?: number;
}

/**
 * Canny-specific status values
 */
export type CannyStatus = 'open' | 'under review' | 'planned' | 'in progress' | 'complete' | 'closed';

// ============================================
// Gitea Integration Types
// ============================================

export interface GiteaRepository {
  id: number;
  name: string;
  fullName: string; // owner/repo
  description?: string;
  htmlUrl: string;
  cloneUrl: string;
  defaultBranch: string;
  private: boolean;
  empty: boolean;
  mirror: boolean;
  size: number;
  owner: {
    id: number;
    login: string;
    fullName?: string;
    avatarUrl?: string;
  };
}

export interface GiteaIssue {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed';
  labels: Array<{
    id: number;
    name: string;
    color: string;
    description?: string;
  }>;
  assignees: Array<{
    id: number;
    login: string;
    fullName?: string;
    avatarUrl?: string;
  }>;
  author: {
    id: number;
    login: string;
    fullName?: string;
    avatarUrl?: string;
  };
  milestone?: {
    id: number;
    title: string;
    state: 'open' | 'closed';
  };
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  commentsCount: number;
  url: string;
  htmlUrl: string;
  repoFullName: string;
  repository: GiteaRepository;
}

export interface GiteaPullRequest {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed' | 'merged';
  merged?: boolean;
  head: {
    label: string; // e.g., "feature-branch:feature"
    ref: string;
    sha: string;
    repo: GiteaRepository;
  };
  base: {
    label: string; // e.g., "main:main"
    ref: string;
    sha: string;
    repo: GiteaRepository;
  };
  author: {
    id: number;
    login: string;
    fullName?: string;
    avatarUrl?: string;
  };
  assignees: Array<{
    id: number;
    login: string;
    fullName?: string;
    avatarUrl?: string;
  }>;
  labels: Array<{
    id: number;
    name: string;
    color: string;
    description?: string;
  }>;
  milestone?: {
    id: number;
    title: string;
    state: 'open' | 'closed';
  };
  mergeable: boolean;
  mergedAt?: string;
  mergedBy?: {
    id: number;
    login: string;
    avatarUrl?: string;
  };
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  htmlUrl: string;
  diffUrl: string;
  patchUrl: string;
  repoFullName: string;
}

export interface GiteaComment {
  id: number;
  body: string;
  author: {
    id: number;
    login: string;
    fullName?: string;
    avatarUrl?: string;
  };
  createdAt: string;
  updatedAt: string;
  issue?: {
    id: number;
    number: number;
    title: string;
  };
  pullRequest?: {
    id: number;
    number: number;
    title: string;
  };
}

export interface GiteaOrganization {
  id: number;
  name: string;
  username: string;
  fullName?: string;
  avatarUrl?: string;
  location?: string;
  website?: string;
  description?: string;
}

export interface GiteaSyncStatus {
  connected: boolean;
  instanceUrl?: string;
  repoFullName?: string;
  repoDescription?: string;
  issueCount?: number;
  lastSyncedAt?: string;
  error?: string;
}

export interface GiteaImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors?: string[];
  tasks?: import('./task').Task[];
}

export interface GiteaInvestigationResult {
  success: boolean;
  issueNumber: number;
  analysis: {
    summary: string;
    proposedSolution: string;
    affectedFiles: string[];
    estimatedComplexity: 'simple' | 'standard' | 'complex';
    acceptanceCriteria: string[];
  };
  taskId?: string;
  error?: string;
}

export interface GiteaInvestigationStatus {
  phase: 'idle' | 'fetching' | 'analyzing' | 'creating_task' | 'complete' | 'error';
  issueNumber?: number;
  progress: number;
  message: string;
  error?: string;
}

// ============================================
// Gitea PR Review Types
// ============================================

export interface GiteaPRReviewFinding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'security' | 'quality' | 'style' | 'test' | 'docs' | 'pattern' | 'performance';
  title: string;
  description: string;
  file: string;
  line: number;
  endLine?: number;
  suggestedFix?: string;
  fixable: boolean;
}

export interface GiteaPRReviewResult {
  prNumber: number;
  repo: string;
  success: boolean;
  findings: GiteaPRReviewFinding[];
  summary: string;
  overallStatus: 'approve' | 'request_changes' | 'comment';
  reviewedAt: string;
  reviewedCommitSha?: string;
  isFollowupReview?: boolean;
  previousReviewId?: number;
  resolvedFindings?: string[];
  unresolvedFindings?: string[];
  newFindingsSinceLastReview?: string[];
  hasPostedFindings?: boolean;
  postedFindingIds?: string[];
}

export interface GiteaPRReviewProgress {
  phase: 'fetching' | 'analyzing' | 'generating' | 'posting' | 'complete';
  prNumber: number;
  progress: number;
  message: string;
}

export interface GiteaNewCommitsCheck {
  hasNewCommits: boolean;
  currentSha?: string;
  reviewedSha?: string;
  newCommitCount?: number;
}

// ============================================
// Gitea Auto-Fix Types
// ============================================

export interface GiteaAutoFixConfig {
  enabled: boolean;
  labels: string[];
  requireHumanApproval: boolean;
  model: string;
  thinkingLevel: string;
}

export interface GiteaAutoFixQueueItem {
  issueNumber: number;
  repo: string;
  status: 'pending' | 'analyzing' | 'creating_spec' | 'building' | 'qa_review' | 'pr_created' | 'completed' | 'failed';
  specId?: string;
  prNumber?: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface GiteaIssueBatch {
  id: string;
  issues: Array<{ number: number; title: string; similarity: number }>;
  commonThemes: string[];
  confidence: number;
  reasoning: string;
}

export interface GiteaBatchProgress {
  phase: 'analyzing' | 'grouping' | 'complete';
  progress: number;
  message: string;
  issuesAnalyzed?: number;
  totalIssues?: number;
}

export interface GiteaAutoFixProgress {
  phase: 'checking' | 'fetching' | 'analyzing' | 'batching' | 'creating_spec' | 'building' | 'qa_review' | 'creating_pr' | 'complete';
  issueNumber: number;
  progress: number;
  message: string;
}

export interface GiteaAnalyzePreviewResult {
  success: boolean;
  totalIssues: number;
  analyzedIssues: number;
  alreadyBatched: number;
  proposedBatches: Array<{
    primaryIssue: number;
    issues: Array<{
      number: number;
      title: string;
      labels: string[];
      similarityToPrimary: number;
    }>;
    issueCount: number;
    commonThemes: string[];
    validated: boolean;
    confidence: number;
    reasoning: string;
    theme: string;
  }>;
  singleIssues: Array<{
    number: number;
    title: string;
    labels: string[];
  }>;
  message: string;
  error?: string;
}

// ============================================
// Gitea Triage Types
// ============================================

export type GiteaTriageCategory = 'bug' | 'feature' | 'documentation' | 'question' | 'duplicate' | 'spam' | 'feature_creep';

export interface GiteaTriageConfig {
  enabled: boolean;
  duplicateThreshold: number;
  spamThreshold: number;
  featureCreepThreshold: number;
  enableComments: boolean;
}

export interface GiteaTriageResult {
  issueNumber: number;
  category: GiteaTriageCategory;
  confidence: number;
  labelsToAdd: string[];
  labelsToRemove: string[];
  duplicateOf?: number;
  spamReason?: string;
  featureCreepReason?: string;
  priority: 'high' | 'medium' | 'low';
  comment?: string;
  triagedAt: string;
}
