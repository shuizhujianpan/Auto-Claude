#!/usr/bin/env python3
"""
Tests for Prompt Generator Module
===================================

Tests the language instruction generation functions to ensure they correctly
generate language-specific prompts for AI agents.
"""

import os
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

# Add parent directory to path for imports
_backend_dir = Path(__file__).parent.parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from prompts_pkg.prompt_generator import (
    generate_language_instruction,
    get_language_setting,
)


class TestGenerateLanguageInstruction:
    """Test generate_language_instruction function."""

    def test_generate_english_instruction(self):
        """Test generating English language instruction."""
        instruction = generate_language_instruction("en")

        # Check for key sections in English
        assert "Language Requirements" in instruction
        assert "You must use English" in instruction
        assert "User Interaction" in instruction
        assert "Git Commits" in instruction
        assert "Code Documentation" in instruction
        assert "Debug Output" in instruction

    def test_generate_french_instruction(self):
        """Test generating French language instruction."""
        instruction = generate_language_instruction("fr")

        # Check for key sections in French
        assert "Exigences Linguistiques" in instruction
        assert "Vous devez utiliser le français" in instruction
        assert "Interaction Utilisateur" in instruction
        assert "Commits Git" in instruction
        assert "Documentation du Code" in instruction
        assert "Sortie de Débogage" in instruction

    def test_generate_chinese_instruction(self):
        """Test generating Chinese (Simplified) language instruction."""
        instruction = generate_language_instruction("zh-CN")

        # Check for key sections in Chinese
        assert "语言要求" in instruction
        assert "你必须使用中文" in instruction
        assert "用户交互" in instruction
        assert "Git 提交" in instruction
        assert "代码文档" in instruction
        assert "调试输出" in instruction


class TestMissingLanguageDefaultsToEn:
    """Test that missing language defaults to English."""

    def test_get_language_setting_missing_env_var(self):
        """Test get_language_setting when environment variable is not set."""
        # Remove the environment variable if it exists
        with patch.dict(os.environ, {}, clear=False):
            # Remove AUTO_CLAUDE_LANGUAGE if it exists
            os.environ.pop("AUTO_CLAUDE_LANGUAGE", None)

            language = get_language_setting()

            # Should default to "en-US" as defined in the function
            assert language == "en-US"

    @pytest.mark.parametrize("lang_code", ["en", "fr", "zh-CN"])
    def test_generate_instruction_with_supported_languages(self, lang_code):
        """Test that all supported languages generate instructions correctly."""
        instruction = generate_language_instruction(lang_code)

        # Should return a non-empty string
        assert isinstance(instruction, str)
        assert len(instruction) > 0

        # Should not be the fallback English instruction for supported languages
        # (unless it's actually "en")
        if lang_code != "en":
            # Check that it contains language-specific content
            if lang_code == "fr":
                assert "Exigences Linguistiques" in instruction
            elif lang_code == "zh-CN":
                assert "语言要求" in instruction


class TestInvalidLanguageFallback:
    """Test that invalid language codes fall back to English."""

    @pytest.mark.parametrize(
        "invalid_lang",
        [
            "invalid",
            "xx",
            "de",
            "es",
            "ja",
            "",
            "zh-TW",  # Not supported (only zh-CN)
            "en-GB",  # Not supported (only en)
        ],
    )
    def test_invalid_language_fallback_to_english(self, invalid_lang):
        """Test that unsupported language codes fall back to English instruction."""
        instruction = generate_language_instruction(invalid_lang)

        # Should return English instruction as fallback
        assert "Language Requirements" in instruction
        assert "You must use English" in instruction

    def test_none_language_fallback(self):
        """Test that None as language falls back to English."""
        instruction = generate_language_instruction(None)

        # Should return English instruction as fallback
        assert "Language Requirements" in instruction
        assert "You must use English" in instruction


class TestLanguageSettingRetrieval:
    """Test get_language_setting function."""

    def test_get_language_setting_from_env(self):
        """Test retrieving language setting from environment variable."""
        test_cases = [
            ("en", "en"),
            ("fr", "fr"),
            ("zh-CN", "zh-CN"),
            ("en-US", "en-US"),
        ]

        for env_value, expected in test_cases:
            with patch.dict(os.environ, {"AUTO_CLAUDE_LANGUAGE": env_value}):
                language = get_language_setting()
                assert language == expected

    def test_get_language_setting_default(self):
        """Test default language setting when env var is not set."""
        with patch.dict(os.environ, {}, clear=False):
            # Remove AUTO_CLAUDE_LANGUAGE if it exists
            os.environ.pop("AUTO_CLAUDE_LANGUAGE", None)

            language = get_language_setting()

            # Should default to "en-US"
            assert language == "en-US"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
