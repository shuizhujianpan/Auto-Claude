import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Loader2, CheckCircle2, AlertCircle, Lock, Globe, ChevronDown, GitBranch, Server } from 'lucide-react';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Separator } from '../../ui/separator';
import { Button } from '../../ui/button';
import { PasswordInput } from '../../project-settings/PasswordInput';
import type { ProjectEnvConfig, GiteaSyncStatus, ProjectSettings, GiteaRepository } from '../../../../shared/types';

// Debug logging
const DEBUG = process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true';
function debugLog(message: string, data?: unknown) {
  if (DEBUG) {
    if (data !== undefined) {
      console.warn(`[GiteaIntegration] ${message}`, data);
    } else {
      console.warn(`[GiteaIntegration] ${message}`);
    }
  }
}

interface GiteaIntegrationProps {
  envConfig: ProjectEnvConfig | null;
  updateEnvConfig: (updates: Partial<ProjectEnvConfig>) => void;
  showGiteaToken: boolean;
  setShowGiteaToken: React.Dispatch<React.SetStateAction<boolean>>;
  giteaConnectionStatus: GiteaSyncStatus | null;
  isCheckingGitea: boolean;
  projectPath?: string;
  // Project settings for mainBranch (used by kanban tasks and terminal worktrees)
  settings?: ProjectSettings;
  setSettings?: React.Dispatch<React.SetStateAction<ProjectSettings>>;
}

/**
 * Gitea integration settings component.
 * Manages Gitea token, repository configuration, and connection status.
 * Supports both gitea.com and self-hosted instances.
 */
export function GiteaIntegration({
  envConfig,
  updateEnvConfig,
  showGiteaToken: _showGiteaToken,
  setShowGiteaToken: _setShowGiteaToken,
  giteaConnectionStatus,
  isCheckingGitea,
  projectPath,
  settings,
  setSettings
}: GiteaIntegrationProps) {
  const { t } = useTranslation('settings');
  const [repos, setRepos] = useState<GiteaRepository[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);

  // Branch selection state
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [branchesError, setBranchesError] = useState<string | null>(null);

  debugLog('Render - projectPath:', projectPath);
  debugLog('Render - envConfig:', envConfig ? { giteaEnabled: envConfig.giteaEnabled, hasToken: !!envConfig.giteaToken, defaultBranch: envConfig.defaultBranch } : null);

  // Fetch branches when Gitea is enabled and project path is available
  useEffect(() => {
    debugLog(`useEffect[branches] - giteaEnabled: ${envConfig?.giteaEnabled}, projectPath: ${projectPath}`);
    if (envConfig?.giteaEnabled && projectPath) {
      debugLog('useEffect[branches] - Triggering fetchBranches');
      fetchBranches();
    } else {
      debugLog('useEffect[branches] - Skipping fetchBranches (conditions not met)');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envConfig?.giteaEnabled, projectPath]);

  /**
   * Handler for branch selection changes.
   * Updates BOTH project.settings.mainBranch (for Electron app) and envConfig.defaultBranch (for CLI backward compatibility).
   */
  const handleBranchChange = (branch: string) => {
    debugLog('handleBranchChange: Updating branch to:', branch);

    // Update project settings (primary source for Electron app)
    if (setSettings) {
      setSettings(prev => ({ ...prev, mainBranch: branch }));
      debugLog('handleBranchChange: Updated settings.mainBranch');
    }

    // Also update envConfig for CLI backward compatibility
    updateEnvConfig({ defaultBranch: branch });
    debugLog('handleBranchChange: Updated envConfig.defaultBranch');
  };

  const fetchBranches = async () => {
    if (!projectPath) {
      debugLog('fetchBranches: No projectPath, skipping');
      return;
    }

    debugLog('fetchBranches: Starting with projectPath:', projectPath);
    setIsLoadingBranches(true);
    setBranchesError(null);

    try {
      debugLog('fetchBranches: Calling getGitBranches...');
      const result = await window.electronAPI.getGitBranches(projectPath);
      debugLog('fetchBranches: getGitBranches result:', { success: result.success, dataType: typeof result.data, dataLength: Array.isArray(result.data) ? result.data.length : 'N/A', error: result.error });

      if (result.success && result.data) {
        setBranches(result.data);
        debugLog('fetchBranches: Loaded branches:', result.data.length);

        // Auto-detect default branch if not set in project settings
        // Priority: settings.mainBranch > envConfig.defaultBranch > auto-detect
        if (!settings?.mainBranch && !envConfig?.defaultBranch) {
          debugLog('fetchBranches: No branch set, auto-detecting...');
          const detectResult = await window.electronAPI.detectMainBranch(projectPath);
          debugLog('fetchBranches: detectMainBranch result:', detectResult);
          if (detectResult.success && detectResult.data) {
            debugLog('fetchBranches: Auto-detected default branch:', detectResult.data);
            handleBranchChange(detectResult.data);
          }
        }
      } else {
        debugLog('fetchBranches: Failed -', result.error || 'No data returned');
        setBranchesError(result.error || 'Failed to load branches');
      }
    } catch (err) {
      debugLog('fetchBranches: Exception:', err);
      setBranchesError(err instanceof Error ? err.message : 'Failed to load branches');
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const fetchUserRepos = async () => {
    debugLog('Fetching user repositories...');
    setIsLoadingRepos(true);
    setReposError(null);

    try {
      const instanceUrl = envConfig?.giteaInstanceUrl || 'https://gitea.com';
      const hostname = instanceUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const result = await window.electronAPI.getGiteaRepositories(hostname);
      debugLog('getGiteaRepositories result:', result);

      if (result.success && result.data) {
        setRepos(result.data);
        debugLog('Loaded repos:', result.data.length);
      } else {
        setReposError(result.error || 'Failed to load repositories');
      }
    } catch (err) {
      debugLog('Error fetching repos:', err);
      setReposError(err instanceof Error ? err.message : 'Failed to load repositories');
    } finally {
      setIsLoadingRepos(false);
    }
  };

  if (!envConfig) {
    debugLog('No envConfig, returning null');
    return null;
  }

  const handleSelectRepo = (repoFullName: string) => {
    debugLog('Selected repo:', repoFullName);
    updateEnvConfig({ giteaRepo: repoFullName });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="font-normal text-foreground">{t('integrationsApp.gitea.enableIssues')}</Label>
          <p className="text-xs text-muted-foreground">
            {t('integrationsApp.gitea.syncDescription')}
          </p>
        </div>
        <Switch
          checked={envConfig.giteaEnabled}
          onCheckedChange={(checked) => updateEnvConfig({ giteaEnabled: checked })}
        />
      </div>

      {envConfig.giteaEnabled && (
        <>
          {/* Instance URL */}
          <InstanceUrlInput
            value={envConfig.giteaInstanceUrl || 'https://gitea.com'}
            onChange={(value) => updateEnvConfig({ giteaInstanceUrl: value })}
          />

          {/* Token Entry */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">{t('integrationsApp.gitea.personalAccessToken')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('integrationsApp.gitea.createTokenFrom')} <code className="px-1 bg-muted rounded">{t('integrationsApp.gitea.repoScope')}</code> {t('integrationsApp.gitea.scopeFrom')}{' '}
              <a
                href={`${envConfig.giteaInstanceUrl || 'https://gitea.com'}/user/settings/applications`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-info hover:underline"
              >
                {t('integrationsApp.gitea.giteaSettings')}
              </a>
            </p>
            <PasswordInput
              value={envConfig.giteaToken || ''}
              onChange={(value) => updateEnvConfig({ giteaToken: value })}
              placeholder={t('integrationsApp.gitea.placeholderToken')}
            />
          </div>

          {/* Repository Input/Selector */}
          <RepositoryInput
            value={envConfig.giteaRepo || ''}
            onChange={(value) => updateEnvConfig({ giteaRepo: value })}
            repos={repos}
            isLoadingRepos={isLoadingRepos}
            reposError={reposError}
            onSelectRepo={handleSelectRepo}
            onRefreshRepos={fetchUserRepos}
          />

          {envConfig.giteaToken && envConfig.giteaRepo && (
            <ConnectionStatus
              isChecking={isCheckingGitea}
              connectionStatus={giteaConnectionStatus}
              t={t}
            />
          )}

          {giteaConnectionStatus?.connected && <IssuesAvailableInfo t={t} />}

          <Separator />

          {/* Default Branch Selector */}
          {projectPath && (
            <BranchSelector
              branches={branches}
              selectedBranch={settings?.mainBranch || envConfig.defaultBranch || ''}
              isLoading={isLoadingBranches}
              error={branchesError}
              onSelect={handleBranchChange}
              onRefresh={fetchBranches}
              t={t}
            />
          )}

          <Separator />

          <AutoSyncToggle
            enabled={envConfig.giteaAutoSync || false}
            onToggle={(checked) => updateEnvConfig({ giteaAutoSync: checked })}
            t={t}
          />
        </>
      )}
    </div>
  );
}

interface InstanceUrlInputProps {
  value: string;
  onChange: (value: string) => void;
}

function InstanceUrlInput({ value, onChange }: InstanceUrlInputProps) {
  const { t } = useTranslation('settings');

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Server className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium text-foreground">{t('integrationsApp.gitea.instance')}</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('integrationsApp.gitea.instanceDescription')}
      </p>
      <Input
        placeholder="https://gitea.com"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

interface RepositoryInputProps {
  value: string;
  onChange: (value: string) => void;
  repos: GiteaRepository[];
  isLoadingRepos: boolean;
  reposError: string | null;
  onSelectRepo: (repoFullName: string) => void;
  onRefreshRepos: () => void;
}

function RepositoryInput({
  value,
  onChange,
  repos,
  isLoadingRepos,
  reposError,
  onSelectRepo,
  onRefreshRepos
}: RepositoryInputProps) {
  const { t } = useTranslation('settings');
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const filteredRepos = repos.filter(repo =>
    repo.fullName.toLowerCase().includes(filter.toLowerCase()) ||
    (repo.description?.toLowerCase().includes(filter.toLowerCase()))
  );

  const selectedRepoData = repos.find(r => r.fullName === value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-foreground">{t('integrationsApp.gitea.repository')}</Label>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefreshRepos}
            disabled={isLoadingRepos}
            className="h-7 px-2"
          >
            <RefreshCw className={`h-3 w-3 ${isLoadingRepos ? 'animate-spin' : ''}`} />
          </Button>
          {!value && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
              className="h-7 text-xs"
            >
              {t('integrationsApp.gitea.selectRepository')}
            </Button>
          )}
        </div>
      </div>

      {reposError && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          {reposError}
        </div>
      )}

      {value ? (
        <>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              disabled={isLoadingRepos}
              className="w-full flex items-center justify-between px-3 py-2 text-sm border border-input rounded-md bg-background hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            >
              {selectedRepoData ? (
                <span className="flex items-center gap-2">
                  {selectedRepoData.private ? (
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <Globe className="h-3 w-3 text-muted-foreground" />
                  )}
                  {value}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Globe className="h-3 w-3 text-muted-foreground" />
                  {value}
                </span>
              )}
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && !isLoadingRepos && (
              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-64 overflow-hidden">
                <div className="p-2 border-b border-border">
                  <Input
                    placeholder={t('integrationsApp.gitea.searchRepositories')}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                  />
                </div>

                <div className="max-h-48 overflow-y-auto">
                  {filteredRepos.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                      {filter ? t('integrationsApp.gitea.noMatchingRepos') : t('integrationsApp.gitea.noReposFound')}
                    </div>
                  ) : (
                    filteredRepos.map((repo) => (
                      <button
                        key={repo.fullName}
                        type="button"
                        onClick={() => {
                          onSelectRepo(repo.fullName);
                          setIsOpen(false);
                          setFilter('');
                        }}
                        className={`w-full px-3 py-2 text-left hover:bg-accent flex items-start gap-2 ${
                          repo.fullName === value ? 'bg-accent' : ''
                        }`}
                      >
                        {repo.private ? (
                          <Lock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        ) : (
                          <Globe className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{repo.fullName}</p>
                          {repo.description && (
                            <p className="text-xs text-muted-foreground truncate">{repo.description}</p>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {t('integrationsApp.gitea.repoFormat')}
          </p>
          <Input
            placeholder={t('integrationsApp.gitea.placeholderOwnerRepo')}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </>
      )}
    </div>
  );
}

interface ConnectionStatusProps {
  isChecking: boolean;
  connectionStatus: GiteaSyncStatus | null;
  t: (key: string, opts?: Record<string, string | number>) => string;
}

function ConnectionStatus({ isChecking, connectionStatus, t }: ConnectionStatusProps) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{t('integrationsApp.gitea.connectionStatus')}</p>
          <p className="text-xs text-muted-foreground">
            {isChecking ? t('projectSettings.connectionStatus.checking') :
              connectionStatus?.connected
                ? t('integrationsApp.gitea.connectedTo', { repo: connectionStatus.repoFullName ?? '' })
                : connectionStatus?.error || t('integrationsApp.gitea.notConnected')}
          </p>
          {connectionStatus?.connected && connectionStatus.repoDescription && (
            <p className="text-xs text-muted-foreground mt-1 italic">
              {connectionStatus.repoDescription}
            </p>
          )}
        </div>
        {isChecking ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : connectionStatus?.connected ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <AlertCircle className="h-4 w-4 text-warning" />
        )}
      </div>
    </div>
  );
}

function IssuesAvailableInfo({ t }: { t: (key: string) => string }) {
  return (
    <div className="rounded-lg border border-info/30 bg-info/5 p-3">
      <div className="flex items-start gap-3">
        <svg className="h-5 w-5 text-info mt-0.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4.5 10.5C3.675 10.5 3 11.175 3 12C3 12.825 3.675 13.5 4.5 13.5C5.325 13.5 6 12.825 6 12C6 11.175 5.325 10.5 4.5 10.5ZM2 21H6V15H2V21ZM8.5 10.5C7.675 10.5 7 11.175 7 12C7 12.825 7.675 13.5 8.5 13.5C9.325 13.5 10 12.825 10 12C10 11.175 9.325 10.5 8.5 10.5ZM7 21H11V15H7V21ZM12.5 10.5C11.675 10.5 11 11.175 11 12C11 12.825 11.675 13.5 12.5 13.5C13.325 13.5 14 12.825 14 12C14 11.175 13.325 10.5 12.5 10.5ZM12 21H16V15H12V21ZM19.5 10.5C18.675 10.5 18 11.175 18 12C18 12.825 18.675 13.5 19.5 13.5C20.325 13.5 21 12.825 21 12C21 11.175 20.325 10.5 19.5 10.5ZM17 21H21V15H17V21Z"/>
        </svg>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">{t('integrationsApp.gitea.issuesAvailable')}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('integrationsApp.gitea.issuesAvailableDescription')}
          </p>
        </div>
      </div>
    </div>
  );
}

interface AutoSyncToggleProps {
  enabled: boolean;
  onToggle: (checked: boolean) => void;
  t: (key: string) => string;
}

function AutoSyncToggle({ enabled, onToggle, t }: AutoSyncToggleProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-info" />
          <Label className="font-normal text-foreground">{t('integrationsApp.gitea.autoSyncOnLoad')}</Label>
        </div>
        <p className="text-xs text-muted-foreground pl-6">
          {t('integrationsApp.gitea.autoSyncDescription')}
        </p>
      </div>
      <Switch checked={enabled} onCheckedChange={onToggle} />
    </div>
  );
}

interface BranchSelectorProps {
  branches: string[];
  selectedBranch: string;
  isLoading: boolean;
  error: string | null;
  onSelect: (branch: string) => void;
  onRefresh: () => void;
  t: (key: string) => string;
}

function BranchSelector({
  branches,
  selectedBranch,
  isLoading,
  error,
  onSelect,
  onRefresh,
  t
}: BranchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const filteredBranches = branches.filter(branch =>
    branch.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-info" />
            <Label className="text-sm font-medium text-foreground">{t('integrationsApp.gitea.defaultBranch')}</Label>
          </div>
          <p className="text-xs text-muted-foreground pl-6">
            {t('integrationsApp.gitea.defaultBranchDescription')}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="h-7 px-2"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive pl-6">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}

      <div className="relative pl-6">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={isLoading}
          className="w-full flex items-center justify-between px-3 py-2 text-sm border border-input rounded-md bg-background hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('integrationsApp.gitea.loadingBranches')}
            </span>
          ) : selectedBranch ? (
            <span className="flex items-center gap-2">
              <GitBranch className="h-3 w-3 text-muted-foreground" />
              {selectedBranch}
            </span>
          ) : (
            <span className="text-muted-foreground">{t('integrationsApp.gitea.autoDetect')}</span>
          )}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && !isLoading && (
          <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-64 overflow-hidden">
            <div className="p-2 border-b border-border">
              <Input
                placeholder={t('integrationsApp.gitea.placeholderSearchBranches')}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="h-8 text-sm"
                autoFocus
              />
            </div>

            <button
              type="button"
              onClick={() => {
                onSelect('');
                setIsOpen(false);
                setFilter('');
              }}
              className={`w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2 ${
                !selectedBranch ? 'bg-accent' : ''
              }`}
            >
              <span className="text-sm text-muted-foreground italic">{t('integrationsApp.gitea.autoDetect')}</span>
            </button>

            <div className="max-h-40 overflow-y-auto border-t border-border">
              {filteredBranches.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                  {filter ? t('integrationsApp.gitea.noMatchingBranches') : t('integrationsApp.gitea.noBranchesFound')}
                </div>
              ) : (
                filteredBranches.map((branch) => (
                  <button
                    key={branch}
                    type="button"
                    onClick={() => {
                      onSelect(branch);
                      setIsOpen(false);
                      setFilter('');
                    }}
                    className={`w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2 ${
                      branch === selectedBranch ? 'bg-accent' : ''
                    }`}
                  >
                    <GitBranch className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{branch}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {selectedBranch && (
        <p className="text-xs text-muted-foreground pl-6">
          {t('integrationsApp.gitea.allTasksBranchFrom')} <code className="px-1 bg-muted rounded">{selectedBranch}</code>
        </p>
      )}
    </div>
  );
}
