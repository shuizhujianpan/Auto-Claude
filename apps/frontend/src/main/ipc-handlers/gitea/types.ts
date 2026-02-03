/**
 * Gitea module types and interfaces
 */

export interface GiteaConfig {
  token: string;
  instanceUrl: string; // e.g., "https://gitea.com" or "https://gitea.example.com"
  repository: string; // Can be numeric ID or "owner/repo" path
}

export interface GiteaAPIRepository {
  id: number;
  name: string;
  full_name: string; // owner/repo
  description?: string;
  html_url: string;
  clone_url: string;
  default_branch: string;
  private: boolean;
  empty: boolean;
  mirror: boolean;
  size: number;
  owner: {
    id: number;
    login: string;
    full_name?: string;
    avatar_url?: string;
  };
}

export interface GiteaAPIIssue {
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
    full_name?: string;
    avatar_url?: string;
  }>;
  author: {
    id: number;
    login: string;
    full_name?: string;
    avatar_url?: string;
  };
  milestone?: {
    id: number;
    title: string;
    state: 'open' | 'closed';
  };
  created_at: string;
  updated_at: string;
  closed_at?: string;
  comments: number;
  url: string;
  html_url: string;
  repository: GiteaAPIRepository;
}

export interface GiteaAPIComment {
  id: number;
  body: string;
  author: {
    id: number;
    login: string;
    full_name?: string;
    avatar_url?: string;
  };
  created_at: string;
  updated_at: string;
  issue?: {
    id: number;
    number: number;
    title: string;
  };
  pull_request?: {
    id: number;
    number: number;
    title: string;
  };
}

export interface GiteaAPIPullRequest {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed' | 'merged';
  merged: boolean;
  head: {
    label: string; // e.g., "feature-branch:feature"
    ref: string;
    sha: string;
    repo: GiteaAPIRepository;
  };
  base: {
    label: string; // e.g., "main:main"
    ref: string;
    sha: string;
    repo: GiteaAPIRepository;
  };
  author: {
    id: number;
    login: string;
    full_name?: string;
    avatar_url?: string;
  };
  assignees: Array<{
    id: number;
    login: string;
    full_name?: string;
    avatar_url?: string;
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
  merged_at?: string;
  merged_by?: {
    id: number;
    login: string;
    avatar_url?: string;
  };
  created_at: string;
  updated_at: string;
  closed_at?: string;
  html_url: string;
  diff_url: string;
  patch_url: string;
}

export interface GiteaAPIOrganization {
  id: number;
  name: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  location?: string;
  website?: string;
  description?: string;
}

export interface GiteaReleaseOptions {
  description?: string;
  ref?: string; // Branch/tag to create release from
  milestones?: string[];
}
