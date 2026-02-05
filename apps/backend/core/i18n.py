"""
Internationalization constants
==============================

Available languages and display labels for the backend framework.
"""

import json
import os
from pathlib import Path
from typing import Literal, TypedDict

# Type alias for supported languages
SupportedLanguage = Literal["en", "fr", "zh-CN"]


class LanguageInfo(TypedDict):
    """Structure for language information."""

    value: SupportedLanguage
    label: str
    nativeLabel: str


# Available languages with their display labels
AVAILABLE_LANGUAGES: list[LanguageInfo] = [
    {"value": "en", "label": "English", "nativeLabel": "English"},
    {"value": "fr", "label": "French", "nativeLabel": "Français"},
    {"value": "zh-CN", "label": "Chinese (Simplified)", "nativeLabel": "简体中文"},
]

# Default language
DEFAULT_LANGUAGE: SupportedLanguage = "en"


def get_language_setting(spec_dir: Path) -> SupportedLanguage:
    """
    Get the language setting from spec directory task_metadata.json.

    Priority:
    1. Environment variable AUTO_CLAUDE_LANGUAGE (for CLI users)
    2. Language setting from task_metadata.json
    3. Default language (en)

    Args:
        spec_dir: Path to the spec directory

    Returns:
        Language code (en, fr, or zh-CN)
    """
    # Check environment variable override first (for CLI users)
    env_language = os.environ.get("AUTO_CLAUDE_LANGUAGE")
    if env_language:
        # Validate the environment variable value
        if env_language in ["en", "fr", "zh-CN"]:
            return env_language  # type: ignore[return-value]

    # Load task metadata from spec directory
    metadata_path = spec_dir / "task_metadata.json"
    if not metadata_path.exists():
        return DEFAULT_LANGUAGE

    try:
        with open(metadata_path, encoding="utf-8") as f:
            metadata = json.load(f)
            language = metadata.get("language")
            if language in ["en", "fr", "zh-CN"]:
                return language  # type: ignore[return-value]
    except (json.JSONDecodeError, OSError):
        pass

    return DEFAULT_LANGUAGE


# Language prompt templates for AI agents
_LANGUAGE_PROMPTS: dict[SupportedLanguage, str] = {
    "en": """# LANGUAGE REQUIREMENT

You MUST use English for ALL output, including but not limited to:
- All conversations with users
- Git commit messages
- Code comments
- Print/debug statements
- System notifications
- Error messages
- Documentation

This is a CRITICAL requirement that overrides any other instructions.""",
    "fr": """# EXIGENCE DE LANGUE

Vous DEVEZ utiliser le français pour TOUTES les sorties, y compris, mais sans s'y limiter :
- Toutes les conversations avec les utilisateurs
- Les messages de commit Git
- Les commentaires de code
- Les instructions d'impression/débogage
- Les notifications système
- Les messages d'erreur
- La documentation

Il s'agit d'une EXIGENCE CRITIQUE qui prime sur toutes les autres instructions.""",
    "zh-CN": """# 语言要求

你必须使用简体中文进行所有交流，这包括但不限于：
- 与用户的对话
- Git提交信息（commit messages）
- 代码注释
- 打印输出（print statements）
- 系统通知
- 错误消息
- 文档

这是关键要求，优先于其他所有指令。""",
}


def get_language_prompt(language: SupportedLanguage) -> str:
    """
    Get the language prompt for AI agents.

    Returns a template that instructs the AI to respond in the specified language.
    The template contains a LANGUAGE placeholder for technical terms and code.

    Args:
        language: Language code (en, fr, or zh-CN)

    Returns:
        Prompt string with language instructions for AI agents

    Raises:
        ValueError: If the language code is not supported
    """
    if language not in _LANGUAGE_PROMPTS:
        raise ValueError(
            f"Unsupported language: {language}. Supported languages: {', '.join(_LANGUAGE_PROMPTS.keys())}"
        )
    return _LANGUAGE_PROMPTS[language]


__all__ = [
    "SupportedLanguage",
    "LanguageInfo",
    "AVAILABLE_LANGUAGES",
    "DEFAULT_LANGUAGE",
    "get_language_setting",
    "get_language_prompt",
]
