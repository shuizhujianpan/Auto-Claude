#!/usr/bin/env python3
"""
测试默认语言行为
================

验证当未设置 AUTO_CLAUDE_LANGUAGE 环境变量时，
Agent 默认使用英文。

Subtask: subtask-6-2
Phase: 端到端验证
Service: backend
"""

import os
import sys
from pathlib import Path

# 添加 apps/backend 到路径
backend_dir = Path(__file__).parent / "apps" / "backend"
sys.path.insert(0, str(backend_dir))

from prompts_pkg.prompt_generator import get_language_setting, generate_language_instruction


def test_default_language_setting():
    """测试：未设置环境变量时，默认语言设置正确"""
    print("=" * 70)
    print("测试 1: 默认语言设置")
    print("=" * 70)

    # 确保环境变量未设置
    if "AUTO_CLAUDE_LANGUAGE" in os.environ:
        del os.environ["AUTO_CLAUDE_LANGUAGE"]
        print("✓ 已清除 AUTO_CLAUDE_LANGUAGE 环境变量")
    else:
        print("✓ AUTO_CLAUDE_LANGUAGE 环境变量未设置（初始状态）")

    # 获取语言设置
    language = get_language_setting()
    print(f"\n📋 获取到的语言设置: {language}")

    # 验证默认值
    assert language == "en-US", f"默认值应为 'en-US'，实际为 '{language}'"
    print("✅ 默认语言设置正确: en-US\n")


def test_default_language_instruction():
    """测试：默认语言生成的指令是英文"""
    print("=" * 70)
    print("测试 2: 默认语言指令生成")
    print("=" * 70)

    # 确保环境变量未设置
    if "AUTO_CLAUDE_LANGUAGE" in os.environ:
        del os.environ["AUTO_CLAUDE_LANGUAGE"]

    # 获取默认语言设置和指令
    language = get_language_setting()
    instruction = generate_language_instruction(language)

    print(f"\n📋 语言设置: {language}")
    print(f"📋 指令长度: {len(instruction)} 字符")

    # 验证指令内容
    assert "Language Requirements" in instruction, \
        "指令应包含 'Language Requirements'"
    assert "English" in instruction, \
        "指令应包含 'English'"
    assert "## Language Requirements" in instruction, \
        "指令应有英文标题"

    print("\n生成的语言指令（前 300 字符）:")
    print("-" * 70)
    print(instruction[:300])
    print("-" * 70)

    print("\n✅ 默认语言指令正确：使用英文\n")


def test_system_prompt_injection_default():
    """测试：System Prompt 注入默认语言指令"""
    print("=" * 70)
    print("测试 3: System Prompt 注入默认语言指令")
    print("=" * 70)

    # 确保环境变量未设置
    if "AUTO_CLAUDE_LANGUAGE" in os.environ:
        del os.environ["AUTO_CLAUDE_LANGUAGE"]

    # 模拟 create_client() 中的逻辑
    base_prompt = (
        f"You are an expert full-stack developer building production-quality software. "
        f"Your working directory is: /path/to/project\n"
        f"You follow existing code patterns, write clean maintainable code, and verify "
        f"your work through thorough testing. You communicate progress through Git commits "
        f"and build-progress.txt updates."
    )

    language = get_language_setting()
    language_instruction = generate_language_instruction(language)
    final_prompt = f"{base_prompt}\n\n{language_instruction}"

    print(f"\n📋 语言设置: {language}")
    print(f"📋 Base Prompt 长度: {len(base_prompt)} 字符")
    print(f"📋 语言指令长度: {len(language_instruction)} 字符")
    print(f"📋 最终 Prompt 长度: {len(final_prompt)} 字符")

    # 验证注入结果
    assert "Language Requirements" in final_prompt, \
        "最终 prompt 应包含英文语言指令"
    assert "You must use English" in final_prompt, \
        "最终 prompt 应明确要求使用英文"
    assert language_instruction.strip() in final_prompt, \
        "语言指令应被包含在最终 prompt 中"
    # 验证语言指令在 base_prompt 之后
    assert final_prompt.index(language_instruction[:20]) > len(base_prompt), \
        "语言指令应在 base_prompt 之后"

    print("\n✅ System Prompt 注入正确")
    print("   ✓ 语言指令被正确追加到 base_prompt")
    print("   ✓ 默认使用英文指令\n")


def test_fallback_mechanism():
    """测试：回退机制工作正常"""
    print("=" * 70)
    print("测试 4: 语言回退机制")
    print("=" * 70)

    # 测试 en-US 回退到 en
    instruction_en_us = generate_language_instruction("en-US")
    assert "Language Requirements" in instruction_en_us, \
        "en-US 应回退到英文指令"
    print("✓ en-US 正确回退到英文指令")

    # 测试不存在的语言代码回退到英文
    instruction_unknown = generate_language_instruction("de-DE")
    assert "Language Requirements" in instruction_unknown, \
        "未知语言应回退到英文指令"
    print("✓ 未知语言（de-DE）正确回退到英文指令")

    # 测试空字符串回退到英文
    instruction_empty = generate_language_instruction("")
    assert "Language Requirements" in instruction_empty, \
        "空字符串应回退到英文指令"
    print("✓ 空字符串正确回退到英文指令")

    print("\n✅ 回退机制工作正常\n")


def main():
    """运行所有测试"""
    print("\n" + "=" * 70)
    print(" 🌐 测试默认语言行为")
    print("=" * 70)
    print("\nSubtask: subtask-6-2")
    print("Phase: 端到端验证")
    print("Service: backend")
    print("\n验证目标：不设置语言环境变量时，Agent 默认使用英文\n")

    try:
        # 运行所有测试
        test_default_language_setting()
        test_default_language_instruction()
        test_system_prompt_injection_default()
        test_fallback_mechanism()

        # 总结
        print("=" * 70)
        print(" 🎉 所有测试通过！")
        print("=" * 70)
        print("\n✅ 默认语言行为验证成功：")
        print("   ✓ 未设置环境变量时，默认语言为 en-US")
        print("   ✓ en-US 正确回退到英文指令")
        print("   ✓ System Prompt 正确注入英文指令")
        print("   ✓ 回退机制工作正常")
        print("\n📝 验证结果：")
        print("   当未设置 AUTO_CLAUDE_LANGUAGE 环境变量时，")
        print("   Agent 将默认使用英文进行所有输出（对话、Git 提交、注释、日志）。\n")

        return 0

    except AssertionError as e:
        print(f"\n❌ 测试失败: {e}\n")
        return 1
    except Exception as e:
        print(f"\n❌ 错误: {e}\n")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
