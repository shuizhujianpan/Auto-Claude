/**
 * Gitea spec utilities
 * Handles creating task specs from Gitea issues
 */

import { mkdir, writeFile, readFile, stat } from 'fs/promises';
import path from 'path';
import type { Project } from '../../../shared/types';
import type { GiteaAPIIssue, GiteaConfig } from './types';
import { labelMatchesWholeWord } from '../shared/label-utils';
import { stripControlChars, sanitizeText, sanitizeStringArray } from '../shared/sanitize';

/**
 * Simplified task info returned when creating a spec from a Gitea issue.
 * This is not a full Task object - it's just the basic info needed for the UI.
 */
export interface GiteaTaskInfo {
  id: string;
  specId: string;
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

type IssueLike = {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed';
  labels: Array<{ name: string } | string>;
  assignees: Array<{ login: string }>;
  milestone?: { title: string };
  created_at: string;
  html_url: string;
};

interface SanitizedGiteaIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
  assignees: Array<{ login: string }>;
  milestone?: { title: string };
  created_at: string;
  html_url: string;
}

// Debug logging helper
const DEBUG = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

function debugLog(message: string, data?: unknown): void {
  if (DEBUG) {
    if (data !== undefined) {
      console.debug(`[Gitea Spec] ${message}`, data);
    } else {
      console.debug(`[Gitea Spec] ${message}`);
    }
  }
}

/**
 * Determine task category based on Gitea issue labels
 * Maps to TaskCategory type from shared/types/task.ts
 */
function determineCategoryFromLabels(labels: string[]): 'feature' | 'bug_fix' | 'refactoring' | 'documentation' | 'security' | 'performance' | 'ui_ux' | 'infrastructure' | 'testing' {
  const lowerLabels = labels.map(l => l.toLowerCase());

  if (lowerLabels.some(l => l.includes('bug') || l.includes('defect') || l.includes('error') || l.includes('fix'))) {
    return 'bug_fix';
  }
  if (lowerLabels.some(l => l.includes('security') || l.includes('vulnerability') || l.includes('cve'))) {
    return 'security';
  }
  if (lowerLabels.some(l => l.includes('performance') || l.includes('optimization') || l.includes('speed'))) {
    return 'performance';
  }
  if (lowerLabels.some(l => l.includes('ui') || l.includes('ux') || l.includes('design') || l.includes('styling'))) {
    return 'ui_ux';
  }
  // Use whole-word matching for 'ci' and 'cd' to avoid false positives like 'acid' or 'decide'
  if (lowerLabels.some(l =>
    l.includes('infrastructure') ||
    l.includes('devops') ||
    l.includes('deployment') ||
    labelMatchesWholeWord(l, 'ci') ||
    labelMatchesWholeWord(l, 'cd')
  )) {
    return 'infrastructure';
  }
  if (lowerLabels.some(l => l.includes('test') || l.includes('testing') || l.includes('qa'))) {
    return 'testing';
  }
  if (lowerLabels.some(l => l.includes('refactor') || l.includes('cleanup') || l.includes('maintenance') || l.includes('chore') || l.includes('tech-debt') || l.includes('technical debt'))) {
    return 'refactoring';
  }
  if (lowerLabels.some(l => l.includes('documentation') || l.includes('docs'))) {
    return 'documentation';
  }
  return 'feature';
}

function sanitizeIssueNumber(value: unknown): number {
  const issueId = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(issueId) || issueId <= 0) {
    return 0;
  }
  return issueId;
}

function sanitizeIssueState(value: unknown): 'open' | 'closed' {
  return value === 'closed' ? 'closed' : 'open';
}

function extractLabelName(label: { name: string } | string): string {
  return typeof label === 'string' ? label : label.name;
}

function sanitizeAssignees(value: unknown): Array<{ login: string }> {
  if (!Array.isArray(value)) return [];
  const sanitized: Array<{ login: string }> = [];
  for (const assignee of value) {
    if (!assignee || typeof assignee !== 'object') continue;
    const login = sanitizeText((assignee as { login?: unknown }).login, 100);
    if (login) {
      sanitized.push({ login });
    }
    if (sanitized.length >= 20) {
      break;
    }
  }
  return sanitized;
}

function sanitizeMilestone(value: unknown): { title: string } | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const title = sanitizeText((value as { title?: unknown }).title, 200);
  return title ? { title } : undefined;
}

function sanitizeIsoDate(value: unknown): string {
  if (typeof value !== 'string') {
    return new Date().toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function sanitizeIssueUrl(rawUrl: unknown, instanceUrl: string): string {
  if (typeof rawUrl !== 'string') return '';
  try {
    const parsedUrl = new URL(rawUrl);
    const expectedHost = new URL(instanceUrl).host;
    if (parsedUrl.host !== expectedHost) return '';
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') return '';
    // Reject URLs with embedded credentials (security risk)
    if (parsedUrl.username || parsedUrl.password) return '';
    return parsedUrl.toString();
  } catch {
    return '';
  }
}

function sanitizeInstanceUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
    if (parsed.username || parsed.password) return '';
    return parsed.origin;
  } catch {
    return '';
  }
}

function sanitizeIssueForSpec(issue: IssueLike, instanceUrl: string): SanitizedGiteaIssue {
  const issueNumber = sanitizeIssueNumber(issue.number);
  const title = sanitizeText(issue.title, 200) || `Issue ${issueNumber || 'unknown'}`;

  // Extract label names (Gitea can have either objects with name or strings)
  const labelNames = Array.isArray(issue.labels)
    ? issue.labels.map(extractLabelName)
    : [];

  return {
    id: sanitizeIssueNumber(issue.id),
    number: issueNumber,
    title,
    body: sanitizeText(issue.body ?? '', 20000, true),
    state: sanitizeIssueState(issue.state),
    labels: sanitizeStringArray(labelNames, 50, 100),
    assignees: sanitizeAssignees(issue.assignees),
    milestone: sanitizeMilestone(issue.milestone),
    created_at: sanitizeIsoDate(issue.created_at),
    html_url: sanitizeIssueUrl(issue.html_url, instanceUrl),
  };
}

/**
 * Generate a spec directory name from issue title
 */
function generateSpecDirName(issueNumber: number, title: string): string {
  // Clean title for directory name
  const cleanTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);

  // Format: 001-issue-title (padded issue number)
  const paddedNumber = String(issueNumber).padStart(3, '0');
  return `${paddedNumber}-${cleanTitle}`;
}

/**
 * Build issue context for spec creation
 */
export function buildIssueContext(issue: IssueLike, repositoryPath: string, instanceUrl: string): string {
  const lines: string[] = [];
  const safeRepositoryPath = sanitizeText(repositoryPath, 200);
  const safeIssue = sanitizeIssueForSpec(issue, instanceUrl);

  lines.push(`# Gitea Issue #${safeIssue.number}: ${safeIssue.title}`);
  lines.push('');
  lines.push(`**Repository:** ${safeRepositoryPath}`);
  lines.push(`**State:** ${safeIssue.state}`);
  lines.push(`**Created:** ${new Date(safeIssue.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`);

  if (safeIssue.labels.length > 0) {
    lines.push(`**Labels:** ${safeIssue.labels.join(', ')}`);
  }

  if (safeIssue.assignees.length > 0) {
    lines.push(`**Assignees:** ${safeIssue.assignees.map(a => a.login).join(', ')}`);
  }

  if (safeIssue.milestone) {
    lines.push(`**Milestone:** ${safeIssue.milestone.title}`);
  }

  lines.push('');
  lines.push('## Description');
  lines.push('');
  lines.push(safeIssue.body || '_No description provided_');
  lines.push('');
  lines.push(`**Web URL:** ${safeIssue.html_url}`);

  return lines.join('\n');
}

/**
 * Check if a path exists (async)
 */
async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a task spec from a Gitea issue
 */
export async function createSpecForIssue(
  project: Project,
  issue: GiteaAPIIssue,
  config: GiteaConfig,
  baseBranch?: string
): Promise<GiteaTaskInfo | null> {
  try {
    // Validate and sanitize network data before writing to disk
    const safeIssue = sanitizeIssueForSpec(issue, config.instanceUrl);
    if (!safeIssue.number) {
      debugLog('Skipping issue with invalid number', { number: issue.number });
      return null;
    }
    const safeRepository = sanitizeText(config.repository, 200);
    const safeInstanceUrl = sanitizeInstanceUrl(config.instanceUrl);

    const specsDir = path.join(project.path, project.autoBuildPath, 'specs');

    // Ensure specs directory exists
    await mkdir(specsDir, { recursive: true });

    // Generate spec directory name
    const specDirName = generateSpecDirName(safeIssue.number, safeIssue.title);
    const specDir = path.join(specsDir, specDirName);
    const metadataPath = path.join(specDir, 'metadata.json');

    // Check if spec already exists
    if (await pathExists(specDir)) {
      debugLog('Spec already exists for issue:', { number: safeIssue.number, specDir });

      // Read existing metadata for accurate timestamps
      let createdAt = new Date(safeIssue.created_at);
      let updatedAt = createdAt;

      if (await pathExists(metadataPath)) {
        try {
          const metadataContent = await readFile(metadataPath, 'utf-8');
          const metadata = JSON.parse(metadataContent);
          if (metadata.createdAt) {
            createdAt = new Date(metadata.createdAt);
          }
          // Use file modification time for updatedAt
          const stats = await stat(metadataPath);
          updatedAt = new Date(stats.mtimeMs);
        } catch {
          // Fallback to issue dates if metadata read fails
        }
      }

      // Return existing task info
      return {
        id: specDirName,
        specId: specDirName,
        title: safeIssue.title,
        description: safeIssue.body || '',
        createdAt,
        updatedAt
      };
    }

    // Create spec directory
    await mkdir(specDir, { recursive: true });

    // Create TASK.md with issue context
    const taskContent = buildIssueContext(safeIssue, safeRepository, config.instanceUrl);
    await writeFile(path.join(specDir, 'TASK.md'), taskContent, 'utf-8');

    // Create metadata.json (legacy format for Gitea-specific data)
    const metadata = {
      source: 'gitea',
      gitea: {
        issueId: safeIssue.id,
        issueNumber: safeIssue.number,
        instanceUrl: safeInstanceUrl,
        repository: safeRepository,
        webUrl: safeIssue.html_url,
        state: safeIssue.state,
        labels: safeIssue.labels,
        createdAt: safeIssue.created_at
      },
      createdAt: new Date().toISOString(),
      status: 'pending'
    };
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

    // Create task_metadata.json (consistent with GitHub format for backend compatibility)
    const taskMetadata = {
      sourceType: 'gitea' as const,
      giteaIssueNumber: safeIssue.number,
      giteaUrl: safeIssue.html_url,
      category: determineCategoryFromLabels(safeIssue.labels || []),
      // Store baseBranch for worktree creation and QA comparison
      ...(baseBranch && { baseBranch })
    };
    await writeFile(
      path.join(specDir, 'task_metadata.json'),
      JSON.stringify(taskMetadata, null, 2),
      'utf-8'
    );

    debugLog('Created spec for issue:', { number: safeIssue.number, specDir });

    // Return task info
    return {
      id: specDirName,
      specId: specDirName,
      title: safeIssue.title,
      description: safeIssue.body || '',
      createdAt: new Date(safeIssue.created_at),
      updatedAt: new Date()
    };
  } catch (error) {
    debugLog('Failed to create spec for issue:', { number: issue.number, error });
    return null;
  }
}
