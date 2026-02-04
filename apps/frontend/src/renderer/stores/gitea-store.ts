import { create } from 'zustand';
import type {
  GiteaIssue,
  GiteaPullRequest,
  GiteaSyncStatus,
  GiteaInvestigationStatus,
  GiteaInvestigationResult
} from '../../shared/types';

interface GiteaState {
  // Data
  issues: GiteaIssue[];
  pullRequests: GiteaPullRequest[];
  syncStatus: GiteaSyncStatus | null;

  // UI State
  isLoading: boolean;
  error: string | null;
  selectedIssueNumber: number | null;
  filterState: 'open' | 'closed' | 'all';

  // Investigation state
  investigationStatus: GiteaInvestigationStatus;
  lastInvestigationResult: GiteaInvestigationResult | null;

  // Actions
  setIssues: (issues: GiteaIssue[]) => void;
  addIssue: (issue: GiteaIssue) => void;
  updateIssue: (issueNumber: number, updates: Partial<GiteaIssue>) => void;
  setPullRequests: (pullRequests: GiteaPullRequest[]) => void;
  addPullRequest: (pullRequest: GiteaPullRequest) => void;
  updatePullRequest: (prNumber: number, updates: Partial<GiteaPullRequest>) => void;
  setSyncStatus: (status: GiteaSyncStatus | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  selectIssue: (issueNumber: number | null) => void;
  setFilterState: (state: 'open' | 'closed' | 'all') => void;
  setInvestigationStatus: (status: GiteaInvestigationStatus) => void;
  setInvestigationResult: (result: GiteaInvestigationResult | null) => void;
  clearIssues: () => void;
  clearPullRequests: () => void;

  // Selectors
  getSelectedIssue: () => GiteaIssue | null;
  getFilteredIssues: () => GiteaIssue[];
  getOpenIssuesCount: () => number;
  getPullRequest: (prNumber: number) => GiteaPullRequest | null;
}

export const useGiteaStore = create<GiteaState>((set, get) => ({
  // Initial state
  issues: [],
  pullRequests: [],
  syncStatus: null,
  isLoading: false,
  error: null,
  selectedIssueNumber: null,
  filterState: 'open',
  investigationStatus: {
    phase: 'idle',
    progress: 0,
    message: ''
  },
  lastInvestigationResult: null,

  // Actions
  setIssues: (issues) => set({ issues, error: null }),

  addIssue: (issue) => set((state) => ({
    issues: [issue, ...state.issues.filter(i => i.number !== issue.number)]
  })),

  updateIssue: (issueNumber, updates) => set((state) => ({
    issues: state.issues.map(issue =>
      issue.number === issueNumber ? { ...issue, ...updates } : issue
    )
  })),

  setPullRequests: (pullRequests) => set({ pullRequests }),

  addPullRequest: (pullRequest) => set((state) => ({
    pullRequests: [pullRequest, ...state.pullRequests.filter(pr => pr.number !== pullRequest.number)]
  })),

  updatePullRequest: (prNumber, updates) => set((state) => ({
    pullRequests: state.pullRequests.map(pr =>
      pr.number === prNumber ? { ...pr, ...updates } : pr
    )
  })),

  setSyncStatus: (syncStatus) => set({ syncStatus }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  selectIssue: (selectedIssueNumber) => set({ selectedIssueNumber }),

  setFilterState: (filterState) => set({ filterState }),

  setInvestigationStatus: (investigationStatus) => set({ investigationStatus }),

  setInvestigationResult: (lastInvestigationResult) => set({ lastInvestigationResult }),

  clearIssues: () => set({
    issues: [],
    syncStatus: null,
    selectedIssueNumber: null,
    error: null,
    investigationStatus: { phase: 'idle', progress: 0, message: '' },
    lastInvestigationResult: null
  }),

  clearPullRequests: () => set({ pullRequests: [] }),

  // Selectors
  getSelectedIssue: () => {
    const { issues, selectedIssueNumber } = get();
    return issues.find(i => i.number === selectedIssueNumber) || null;
  },

  getFilteredIssues: () => {
    const { issues, filterState } = get();
    if (filterState === 'all') return issues;
    return issues.filter(issue => issue.state === filterState);
  },

  getOpenIssuesCount: () => {
    const { issues } = get();
    return issues.filter(issue => issue.state === 'open').length;
  },

  getPullRequest: (prNumber) => {
    const { pullRequests } = get();
    return pullRequests.find(pr => pr.number === prNumber) || null;
  }
}));

// Action functions for use outside of React components
export async function loadGiteaIssues(repoOwner: string, repoName: string, state?: 'open' | 'closed' | 'all'): Promise<void> {
  const store = useGiteaStore.getState();
  store.setLoading(true);
  store.setError(null);

  // Sync filterState with the requested state
  if (state) {
    store.setFilterState(state);
  }

  try {
    const result = await window.electronAPI.getGiteaIssues(repoOwner, repoName, state);
    if (result.success && result.data) {
      store.setIssues(result.data);
    } else {
      store.setError(result.error || 'Failed to load Gitea issues');
    }
  } catch (error) {
    store.setError(error instanceof Error ? error.message : 'Unknown error');
  } finally {
    store.setLoading(false);
  }
}

export async function checkGiteaConnection(repoOwner: string, repoName: string): Promise<GiteaSyncStatus | null> {
  const store = useGiteaStore.getState();

  try {
    const result = await window.electronAPI.checkGiteaConnection(repoOwner, repoName);
    if (result.success && result.data) {
      store.setSyncStatus(result.data);
      return result.data;
    } else {
      store.setError(result.error || 'Failed to check Gitea connection');
      return null;
    }
  } catch (error) {
    store.setError(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

export function investigateGiteaIssue(repoOwner: string, repoName: string, issueNumber: number): void {
  const store = useGiteaStore.getState();
  store.setInvestigationStatus({
    phase: 'fetching',
    issueNumber,
    progress: 0,
    message: 'Starting investigation...'
  });
  store.setInvestigationResult(null);

  window.electronAPI.investigateGiteaIssue(repoOwner, repoName, issueNumber);
}

export async function importGiteaIssues(
  repoOwner: string,
  repoName: string,
  issueNumbers: number[]
): Promise<boolean> {
  const store = useGiteaStore.getState();
  store.setLoading(true);

  try {
    const result = await window.electronAPI.importGiteaIssues(repoOwner, repoName, issueNumbers);
    if (result.success) {
      return true;
    } else {
      store.setError(result.error || 'Failed to import Gitea issues');
      return false;
    }
  } catch (error) {
    store.setError(error instanceof Error ? error.message : 'Unknown error');
    return false;
  } finally {
    store.setLoading(false);
  }
}

export async function loadGiteaPullRequests(repoOwner: string, repoName: string, state?: 'open' | 'closed' | 'all'): Promise<void> {
  const store = useGiteaStore.getState();
  store.setLoading(true);
  store.setError(null);

  try {
    const result = await window.electronAPI.getGiteaPullRequests(repoOwner, repoName, state);
    if (result.success && result.data) {
      store.setPullRequests(result.data);
    } else {
      store.setError(result.error || 'Failed to load Gitea pull requests');
    }
  } catch (error) {
    store.setError(error instanceof Error ? error.message : 'Unknown error');
  } finally {
    store.setLoading(false);
  }
}
