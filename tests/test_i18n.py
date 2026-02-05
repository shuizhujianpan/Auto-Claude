#!/usr/bin/env python3
"""
Tests for i18n Module
=====================

Tests the core/i18n.py module functionality including:
- Language setting detection from environment variables
- Language setting detection from task_metadata.json
- Default language fallback behavior
- Language prompt generation for each supported language
"""

import json
import os
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from core.i18n import (
    DEFAULT_LANGUAGE,
    AVAILABLE_LANGUAGES,
    get_language_setting,
    get_language_prompt,
)


class TestGetLanguageSetting:
    """Tests for get_language_setting() function."""

    @pytest.fixture(autouse=True)
    def clear_env(self):
        """Clear AUTO_CLAUDE_LANGUAGE environment variable before each test."""
        os.environ.pop("AUTO_CLAUDE_LANGUAGE", None)
        yield
        # Cleanup after test
        os.environ.pop("AUTO_CLAUDE_LANGUAGE", None)

    def test_returns_default_language_when_no_sources(self, temp_dir: Path):
        """Returns DEFAULT_LANGUAGE when no env var or task_metadata.json exists."""
        result = get_language_setting(temp_dir)
        assert result == DEFAULT_LANGUAGE
        assert result == "en"

    def test_reads_from_task_metadata_json(self, temp_dir: Path):
        """Reads language setting from task_metadata.json in spec directory."""
        # Create task_metadata.json with French language
        metadata_path = temp_dir / "task_metadata.json"
        metadata_path.write_text(json.dumps({"language": "fr"}), encoding="utf-8")

        result = get_language_setting(temp_dir)
        assert result == "fr"

    def test_reads_chinese_simplified_from_metadata(self, temp_dir: Path):
        """Reads zh-CN language code from task_metadata.json."""
        metadata_path = temp_dir / "task_metadata.json"
        metadata_path.write_text(json.dumps({"language": "zh-CN"}), encoding="utf-8")

        result = get_language_setting(temp_dir)
        assert result == "zh-CN"

    def test_reads_english_from_metadata(self, temp_dir: Path):
        """Reads en language code from task_metadata.json."""
        metadata_path = temp_dir / "task_metadata.json"
        metadata_path.write_text(json.dumps({"language": "en"}), encoding="utf-8")

        result = get_language_setting(temp_dir)
        assert result == "en"

    def test_env_var_takes_precedence_over_metadata(self, temp_dir: Path):
        """Environment variable AUTO_CLAUDE_LANGUAGE overrides task_metadata.json."""
        # Create task_metadata.json with French
        metadata_path = temp_dir / "task_metadata.json"
        metadata_path.write_text(json.dumps({"language": "fr"}), encoding="utf-8")

        # Set environment variable to Chinese
        os.environ["AUTO_CLAUDE_LANGUAGE"] = "zh-CN"

        result = get_language_setting(temp_dir)
        assert result == "zh-CN"

    def test_env_var_validates_supported_languages(self, temp_dir: Path):
        """Only accepts supported language codes from environment variable."""
        # Valid language codes
        for lang in ["en", "fr", "zh-CN"]:
            os.environ["AUTO_CLAUDE_LANGUAGE"] = lang
            result = get_language_setting(temp_dir)
            assert result == lang

    def test_env_var_invalid_value_falls_back_to_metadata(self, temp_dir: Path):
        """Invalid env var value falls back to task_metadata.json."""
        metadata_path = temp_dir / "task_metadata.json"
        metadata_path.write_text(json.dumps({"language": "fr"}), encoding="utf-8")

        # Set invalid language code in env var
        os.environ["AUTO_CLAUDE_LANGUAGE"] = "de"

        result = get_language_setting(temp_dir)
        # Should fall back to metadata value since env var is invalid
        assert result == "fr"

    def test_env_var_invalid_value_falls_back_to_default(self, temp_dir: Path):
        """Invalid env var value with no metadata falls back to default."""
        # Set invalid language code in env var, no metadata file
        os.environ["AUTO_CLAUDE_LANGUAGE"] = "invalid"

        result = get_language_setting(temp_dir)
        assert result == DEFAULT_LANGUAGE

    def test_metadata_missing_language_field(self, temp_dir: Path):
        """Returns default when task_metadata.json exists but has no language field."""
        metadata_path = temp_dir / "task_metadata.json"
        metadata_path.write_text(json.dumps({"name": "test-spec"}), encoding="utf-8")

        result = get_language_setting(temp_dir)
        assert result == DEFAULT_LANGUAGE

    def test_metadata_invalid_language_value(self, temp_dir: Path):
        """Returns default when task_metadata.json has invalid language value."""
        metadata_path = temp_dir / "task_metadata.json"
        metadata_path.write_text(json.dumps({"language": "de"}), encoding="utf-8")

        result = get_language_setting(temp_dir)
        assert result == DEFAULT_LANGUAGE

    def test_metadata_json_decode_error_returns_default(self, temp_dir: Path):
        """Returns default when task_metadata.json contains invalid JSON."""
        metadata_path = temp_dir / "task_metadata.json"
        metadata_path.write_text("{invalid json}", encoding="utf-8")

        result = get_language_setting(temp_dir)
        assert result == DEFAULT_LANGUAGE

    def test_metadata_file_read_error_returns_default(self, temp_dir: Path):
        """Returns default when task_metadata.json cannot be read."""
        # Create directory instead of file to cause read error
        metadata_path = temp_dir / "task_metadata.json"
        metadata_path.mkdir()

        result = get_language_setting(temp_dir)
        assert result == DEFAULT_LANGUAGE

    def test_empty_env_var_ignored(self, temp_dir: Path):
        """Empty string environment variable is ignored."""
        metadata_path = temp_dir / "task_metadata.json"
        metadata_path.write_text(json.dumps({"language": "fr"}), encoding="utf-8")

        os.environ["AUTO_CLAUDE_LANGUAGE"] = ""

        result = get_language_setting(temp_dir)
        # Empty env var should be falsy, fall back to metadata
        assert result == "fr"

    def test_all_supported_languages_from_metadata(self, temp_dir: Path):
        """All supported languages can be read from metadata."""
        for lang_info in AVAILABLE_LANGUAGES:
            lang_code = lang_info["value"]
            metadata_path = temp_dir / "task_metadata.json"
            metadata_path.write_text(json.dumps({"language": lang_code}), encoding="utf-8")

            result = get_language_setting(temp_dir)
            assert result == lang_code

    def test_all_supported_languages_from_env_var(self, temp_dir: Path):
        """All supported languages can be set via environment variable."""
        for lang_info in AVAILABLE_LANGUAGES:
            lang_code = lang_info["value"]
            os.environ["AUTO_CLAUDE_LANGUAGE"] = lang_code

            result = get_language_setting(temp_dir)
            assert result == lang_code

    def test_case_sensitive_language_codes(self, temp_dir: Path):
        """Language codes are case-sensitive."""
        # Test uppercase variations (should fail validation)
        os.environ["AUTO_CLAUDE_LANGUAGE"] = "EN"
        result = get_language_setting(temp_dir)
        assert result == DEFAULT_LANGUAGE

        os.environ["AUTO_CLAUDE_LANGUAGE"] = "FR"
        result = get_language_setting(temp_dir)
        assert result == DEFAULT_LANGUAGE

        os.environ["AUTO_CLAUDE_LANGUAGE"] = "ZH-CN"
        result = get_language_setting(temp_dir)
        assert result == DEFAULT_LANGUAGE


class TestGetLanguagePrompt:
    """Tests for get_language_prompt() function."""

    def test_returns_prompt_for_english(self):
        """Returns language prompt for English."""
        prompt = get_language_prompt("en")
        assert isinstance(prompt, str)
        assert len(prompt) > 0
        assert "LANGUAGE REQUIREMENT" in prompt
        assert "English" in prompt

    def test_returns_prompt_for_french(self):
        """Returns language prompt for French."""
        prompt = get_language_prompt("fr")
        assert isinstance(prompt, str)
        assert len(prompt) > 0
        assert "EXIGENCE DE LANGUE" in prompt
        assert "français" in prompt

    def test_returns_prompt_for_chinese_simplified(self):
        """Returns language prompt for Chinese (Simplified)."""
        prompt = get_language_prompt("zh-CN")
        assert isinstance(prompt, str)
        assert len(prompt) > 0
        assert "语言要求" in prompt
        assert "简体中文" in prompt

    def test_all_output_types_mentioned_in_prompts(self):
        """All language prompts mention key output types in their respective languages."""
        # Define expected keywords for each language
        language_keywords = {
            "en": ["conversations", "commit", "comments", "notifications", "messages"],
            "fr": ["conversations", "commit", "commentaires", "notifications", "messages"],
            "zh-CN": ["对话", "提交", "注释", "通知", "消息"],
        }

        for lang_code, keywords in language_keywords.items():
            prompt = get_language_prompt(lang_code)
            prompt_lower = prompt.lower()
            for keyword in keywords:
                # Each prompt should mention these output types
                assert keyword.lower() in prompt_lower, f"Keyword '{keyword}' not found in {lang_code} prompt"

    def test_raises_error_for_unsupported_language(self):
        """Raises ValueError for unsupported language code."""
        with pytest.raises(ValueError) as exc_info:
            get_language_prompt("de")

        assert "Unsupported language" in str(exc_info.value)
        assert "de" in str(exc_info.value)

    def test_raises_error_for_invalid_language_format(self):
        """Raises ValueError for invalid language code format."""
        with pytest.raises(ValueError):
            get_language_prompt("")

        with pytest.raises(ValueError):
            get_language_prompt("xyz")

        with pytest.raises(ValueError):
            get_language_prompt("zh")  # Should be zh-CN

    def test_all_supported_languages_have_prompts(self):
        """Every supported language has a valid prompt."""
        for lang_info in AVAILABLE_LANGUAGES:
            lang_code = lang_info["value"]
            prompt = get_language_prompt(lang_code)
            assert isinstance(prompt, str)
            assert len(prompt) > 0
            # Should contain the language header in some form
            assert "LANGUAGE" in prompt or "LANGUE" in prompt or "语言" in prompt

    def test_prompt_contains_critical_requirement_note(self):
        """All prompts indicate the language requirement is critical."""
        for lang_code in ["en", "fr", "zh-CN"]:
            prompt = get_language_prompt(lang_code)
            # Check for critical/important/emergency keywords
            assert (
                "CRITICAL" in prompt
                or "CRITIQUE" in prompt
                or "关键" in prompt
                or "IMPORTANT" in prompt
                or "要求" in prompt
            )


class TestLanguageInjection:
    """Integration tests for language prompt injection in create_client()."""

    @pytest.fixture(autouse=True)
    def clear_env(self):
        """Clear AUTO_CLAUDE_LANGUAGE environment variable before each test."""
        os.environ.pop("AUTO_CLAUDE_LANGUAGE", None)
        yield
        # Cleanup after test
        os.environ.pop("AUTO_CLAUDE_LANGUAGE", None)

    def test_language_injection_from_metadata(self, temp_dir: Path, monkeypatch):
        """Verify language prompt is injected when language is set in task_metadata.json."""
        from core.client import create_client

        # Create task_metadata.json with French language
        metadata_path = temp_dir / "task_metadata.json"
        metadata_path.write_text(json.dumps({"language": "fr"}), encoding="utf-8")

        # Mock the SDK client to capture options
        captured_options = {}

        def mock_sdk_init(options):
            """Capture the options passed to the SDK client."""
            captured_options["system_prompt"] = options.system_prompt
            captured_options["model"] = options.model
            return MagicMock()

        # Mock dependencies
        monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "sk-ant-oat01-test-token")
        monkeypatch.setattr("core.auth.get_token_from_keychain", lambda: None)

        with patch("core.client.ClaudeSDKClient", side_effect=mock_sdk_init):
            create_client(temp_dir, temp_dir, "claude-sonnet-4", "coder")

        # Verify the language prompt was injected into the system prompt
        system_prompt = captured_options.get("system_prompt", "")
        assert len(system_prompt) > 0, "System prompt should not be empty"

        # Check for French language prompt markers
        assert "EXIGENCE DE LANGUE" in system_prompt, "French language header should be in system prompt"
        assert "français" in system_prompt, "French language instruction should be in system prompt"
        assert "CRITIQUE" in system_prompt, "Critical requirement marker should be in system prompt"

    def test_language_injection_from_env_var(self, temp_dir: Path, monkeypatch):
        """Verify language prompt is injected when language is set via environment variable."""
        from core.client import create_client

        # Set language via environment variable
        monkeypatch.setenv("AUTO_CLAUDE_LANGUAGE", "zh-CN")

        # Mock the SDK client to capture options
        captured_options = {}

        def mock_sdk_init(options):
            """Capture the options passed to the SDK client."""
            captured_options["system_prompt"] = options.system_prompt
            captured_options["model"] = options.model
            return MagicMock()

        # Mock dependencies
        monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "sk-ant-oat01-test-token")
        monkeypatch.setattr("core.auth.get_token_from_keychain", lambda: None)

        with patch("core.client.ClaudeSDKClient", side_effect=mock_sdk_init):
            create_client(temp_dir, temp_dir, "claude-sonnet-4", "coder")

        # Verify the language prompt was injected into the system prompt
        system_prompt = captured_options.get("system_prompt", "")
        assert len(system_prompt) > 0, "System prompt should not be empty"

        # Check for Chinese language prompt markers
        assert "语言要求" in system_prompt, "Chinese language header should be in system prompt"
        assert "简体中文" in system_prompt, "Chinese language instruction should be in system prompt"
        assert "关键" in system_prompt or "要求" in system_prompt, "Critical requirement marker should be in system prompt"

    def test_language_injection_default_english(self, temp_dir: Path, monkeypatch):
        """Verify English language prompt is injected when no language setting is configured."""
        from core.client import create_client

        # No task_metadata.json and no AUTO_CLAUDE_LANGUAGE env var
        # Should default to English

        # Mock the SDK client to capture options
        captured_options = {}

        def mock_sdk_init(options):
            """Capture the options passed to the SDK client."""
            captured_options["system_prompt"] = options.system_prompt
            captured_options["model"] = options.model
            return MagicMock()

        # Mock dependencies
        monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "sk-ant-oat01-test-token")
        monkeypatch.setattr("core.auth.get_token_from_keychain", lambda: None)

        with patch("core.client.ClaudeSDKClient", side_effect=mock_sdk_init):
            create_client(temp_dir, temp_dir, "claude-sonnet-4", "coder")

        # Verify the language prompt was injected into the system prompt
        system_prompt = captured_options.get("system_prompt", "")
        assert len(system_prompt) > 0, "System prompt should not be empty"

        # Check for English language prompt markers
        assert "LANGUAGE REQUIREMENT" in system_prompt, "English language header should be in system prompt"
        assert "English" in system_prompt, "English language instruction should be in system prompt"
        assert "CRITICAL" in system_prompt, "Critical requirement marker should be in system prompt"

    def test_language_injection_env_var_overrides_metadata(self, temp_dir: Path, monkeypatch):
        """Verify environment variable overrides task_metadata.json language setting."""
        from core.client import create_client

        # Create task_metadata.json with French language
        metadata_path = temp_dir / "task_metadata.json"
        metadata_path.write_text(json.dumps({"language": "fr"}), encoding="utf-8")

        # Set environment variable to English (should override French)
        monkeypatch.setenv("AUTO_CLAUDE_LANGUAGE", "en")

        # Mock the SDK client to capture options
        captured_options = {}

        def mock_sdk_init(options):
            """Capture the options passed to the SDK client."""
            captured_options["system_prompt"] = options.system_prompt
            return MagicMock()

        # Mock dependencies
        monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "sk-ant-oat01-test-token")
        monkeypatch.setattr("core.auth.get_token_from_keychain", lambda: None)

        with patch("core.client.ClaudeSDKClient", side_effect=mock_sdk_init):
            create_client(temp_dir, temp_dir, "claude-sonnet-4", "coder")

        # Verify English language prompt was used (not French)
        system_prompt = captured_options.get("system_prompt", "")
        assert "LANGUAGE REQUIREMENT" in system_prompt, "English should be used (from env var)"
        assert "EXIGENCE DE LANGUE" not in system_prompt, "French should not be used"

    def test_language_injection_all_supported_languages(self, temp_dir: Path, monkeypatch):
        """Verify all supported languages are properly injected into the system prompt."""
        from core.client import create_client

        # Test each supported language
        test_cases = [
            ("en", "LANGUAGE REQUIREMENT", "English"),
            ("fr", "EXIGENCE DE LANGUE", "français"),
            ("zh-CN", "语言要求", "简体中文"),
        ]

        for lang_code, expected_header, expected_content in test_cases:
            # Reset captured options
            captured_options = {}

            def mock_sdk_init(options):
                """Capture the options passed to the SDK client."""
                captured_options["system_prompt"] = options.system_prompt
                return MagicMock()

            # Set language via environment variable
            monkeypatch.setenv("AUTO_CLAUDE_LANGUAGE", lang_code)

            # Clear and reset auth token for each iteration
            monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "sk-ant-oat01-test-token")
            monkeypatch.setattr("core.auth.get_token_from_keychain", lambda: None)

            with patch("core.client.ClaudeSDKClient", side_effect=mock_sdk_init):
                create_client(temp_dir, temp_dir, "claude-sonnet-4", "coder")

            # Verify the language prompt was injected
            system_prompt = captured_options.get("system_prompt", "")
            assert expected_header in system_prompt, f"{expected_header} should be in system prompt for {lang_code}"
            assert expected_content in system_prompt, f"{expected_content} should be in system prompt for {lang_code}"

            # Clean up for next iteration
            os.environ.pop("AUTO_CLAUDE_LANGUAGE", None)
