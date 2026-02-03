/**
 * Gitea utility functions
 */

import { readFile, access } from 'fs/promises';
import path from 'path';
import type { Project } from '../../../shared/types';
import { parseEnvFile } from '../utils';
import type { GiteaConfig } from './types';

const DEFAULT_GITEA_URL = 'https://gitea.com';

function parseInstanceUrl(value: string): string | null {
  const candidate = value.trim();
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    if (parsed.username || parsed.password) {
      return null;
    }
    if (!parsed.hostname) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function normalizeInstanceUrl(value: string | undefined): string | null {
  const candidate = value || DEFAULT_GITEA_URL;
  return parseInstanceUrl(candidate);
}

function sanitizeToken(value: string | undefined): string | null {
  if (!value) return null;
  let sanitized = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1F || code === 0x7F) {
      continue;
    }
    sanitized += value[i];
  }
  const trimmed = sanitized.trim();
  if (!trimmed) return null;
  return trimmed.length > 512 ? trimmed.substring(0, 512) : trimmed;
}

// Max length for repository references (owner/repo paths)
const MAX_REPO_REF_LENGTH = 1024;

function sanitizeRepoRef(value: string | undefined): string | null {
  if (!value) return null;
  let sanitized = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1F || code === 0x7F) {
      continue;
    }
    sanitized += value[i];
  }
  const trimmed = sanitized.trim();
  if (!trimmed) return null;
  // Reject excessively long inputs as defense-in-depth
  if (trimmed.length > MAX_REPO_REF_LENGTH) return null;
  return trimmed;
}

// Gitea environment variable keys
const GITEA_ENV_KEYS = {
  ENABLED: 'GITEA_ENABLED',
  TOKEN: 'GITEA_TOKEN',
  INSTANCE_URL: 'GITEA_INSTANCE_URL',
  REPOSITORY: 'GITEA_REPOSITORY'
} as const;

/**
 * Check if a file exists (async)
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get Gitea configuration from project environment file
 * Returns null if Gitea is explicitly disabled via GITEA_ENABLED=false
 */
export async function getGiteaConfig(project: Project): Promise<GiteaConfig | null> {
  if (!project.autoBuildPath) return null;
  const envPath = path.join(project.path, project.autoBuildPath, '.env');
  if (!(await fileExists(envPath))) return null;

  try {
    const content = await readFile(envPath, 'utf-8');
    const vars = parseEnvFile(content);

    // Check if Gitea is explicitly disabled
    if (vars[GITEA_ENV_KEYS.ENABLED]?.toLowerCase() === 'false') {
      return null;
    }

    const token = sanitizeToken(vars[GITEA_ENV_KEYS.TOKEN]);
    const repository = sanitizeRepoRef(vars[GITEA_ENV_KEYS.REPOSITORY]);
    const instanceUrl = normalizeInstanceUrl(vars[GITEA_ENV_KEYS.INSTANCE_URL]);
    if (!instanceUrl) return null;

    if (!token || !repository) return null;
    return { token, instanceUrl, repository };
  } catch {
    return null;
  }
}

/**
 * Normalize a Gitea repository reference to owner/repo format
 * Handles:
 * - owner/repo (already normalized)
 * - owner/repo format with nested owners
 * - https://gitea.com/owner/repo
 * - https://gitea.com/owner/repo.git
 * - git@gitea.com:owner/repo.git
 * - Numeric repository ID (returns as-is)
 */
export function normalizeRepositoryReference(repository: string, instanceUrl: string = DEFAULT_GITEA_URL): string {
  if (!repository) return '';

  // If it's a numeric ID, return as-is
  if (/^\d+$/.test(repository)) {
    return repository;
  }

  // Remove trailing .git if present
  let normalized = repository.replace(/\.git$/, '');

  // Extract hostname for comparison
  let giteaHostname: string;
  try {
    giteaHostname = new URL(instanceUrl).hostname;
  } catch {
    giteaHostname = 'gitea.com';
  }

  // Escape special regex characters in hostname to prevent ReDoS
  const escapedHostname = giteaHostname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Handle full Gitea URLs
  const httpsPattern = new RegExp(`^https?://${escapedHostname}/`);
  if (httpsPattern.test(normalized)) {
    normalized = normalized.replace(httpsPattern, '');
  } else if (normalized.startsWith(`git@${giteaHostname}:`)) {
    normalized = normalized.replace(`git@${giteaHostname}:`, '');
  }

  return normalized.trim();
}

/**
 * URL-encode a repository path for Gitea API
 * Gitea API requires repository paths to be URL-encoded (e.g., owner%2Frepo)
 */
export function encodeRepositoryPath(repositoryPath: string): string {
  // If it's a numeric ID, return as-is
  if (/^\d+$/.test(repositoryPath)) {
    return repositoryPath;
  }
  return encodeURIComponent(repositoryPath);
}

// Default timeout for Gitea API requests (30 seconds)
const GITEA_API_TIMEOUT_MS = 30000;

/**
 * Make a request to the Gitea API with timeout
 */
export async function giteaFetch(
  token: string,
  instanceUrl: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<unknown> {
  // Ensure instanceUrl doesn't have trailing slash
  const baseUrl = parseInstanceUrl(instanceUrl);
  if (!baseUrl) {
    throw new Error('Invalid Gitea instance URL');
  }
  if (!endpoint.startsWith('/')) {
    throw new Error('Gitea endpoint must be a relative path');
  }
  const url = `${baseUrl}/api/v1${endpoint}`;
  const safeToken = sanitizeToken(token);
  if (!safeToken) {
    throw new Error('Invalid Gitea token');
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GITEA_API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
        Authorization: `token ${safeToken}`
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Gitea API error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Gitea API timeout after ${GITEA_API_TIMEOUT_MS / 1000}s: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Make a request to the Gitea API and return both data and total count from headers
 * Useful for paginated endpoints where we need the total count
 */
export async function giteaFetchWithCount(
  token: string,
  instanceUrl: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: unknown; totalCount: number }> {
  // Ensure instanceUrl doesn't have trailing slash
  const baseUrl = parseInstanceUrl(instanceUrl);
  if (!baseUrl) {
    throw new Error('Invalid Gitea instance URL');
  }
  if (!endpoint.startsWith('/')) {
    throw new Error('Gitea endpoint must be a relative path');
  }
  const url = `${baseUrl}/api/v1${endpoint}`;
  const safeToken = sanitizeToken(token);
  if (!safeToken) {
    throw new Error('Invalid Gitea token');
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GITEA_API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
        Authorization: `token ${safeToken}`
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Gitea API error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    // Get total count from X-Total header (Gitea's pagination header)
    const totalCountHeader = response.headers.get('X-Total');
    const totalCount = totalCountHeader ? parseInt(totalCountHeader, 10) : 0;

    const data = await response.json();
    return { data, totalCount };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Gitea API timeout after ${GITEA_API_TIMEOUT_MS / 1000}s: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
