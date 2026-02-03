"""
Gitea integration module for Auto Claude.

Provides Gitea API client and related functionality.
"""

from .gitea_client import GiteaClient, GiteaConfig, load_gitea_config

# Import models for convenient access
from . import models  # noqa: F401

__all__ = [
    "GiteaClient",
    "GiteaConfig",
    "load_gitea_config",
    "models",
]
