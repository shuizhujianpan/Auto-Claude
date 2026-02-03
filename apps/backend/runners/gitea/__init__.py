"""
Gitea integration module for Auto Claude.

Provides Gitea API client and related functionality.
"""

from .gitea_client import GiteaClient, GiteaConfig, load_gitea_config

__all__ = [
    "GiteaClient",
    "GiteaConfig",
    "load_gitea_config",
]
