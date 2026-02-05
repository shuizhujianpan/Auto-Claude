#!/usr/bin/env python3
"""
i18n 端到端测试脚本
===================

测试 AUTO_CLAUDE_LANGUAGE 环境变量是否正确影响 Agent 输出语言。
"""

import os
import sys
from pathlib import Path

# 添加 apps/backend 到路径
backend_dir = Path(__file__).parent / "apps" / "backend"
sys.path.insert(0, str(backend_dir))

from prompts_pkg.prompt_generator import get_language_setting, generate_language_instruction


def test_language_instruction_generation():
    """测试语言指令生成"""
    print("=" * 60)
    print("测试 1: 语言指令生成")
    print("=" * 60)

    # 测试中文
    zh_instruction = generate_language_instruction("zh-CN")
    print("\n✓ 中文指令:")
    print(zh_instruction[:200] + "...")
    assert "语言要求" in zh_instruction, "中文指令应包含'语言要求'"
    assert "中文" in zh_instruction, "中文指令应包含'中文'"

    # 测试英文
    en_instruction = generate_language_instruction("en")
    print("\n✓ 英文指令:")
    print(en_instruction[:200] + "...")
    assert "Language Requirements" in en_instruction, "英文指令应包含'Language Requirements'"

    # 测试法文
    fr_instruction = generate_language_instruction("fr")
    print("\n✓ 法文指令:")
    print(fr_instruction[:200] + "...")
    assert "Exigences Linguistiques" in fr_instruction, "法文指令应包含'Exigences Linguistiques'"

    # 测试回退机制
    unknown_instruction = generate_language_instruction("de")
    print("\n✓ 未知语言回退到英文:")
    print(unknown_instruction[:200] + "...")
    assert "Language Requirements" in unknown_instruction, "未知语言应回退到英文"

    print("\n✅ 语言指令生成测试通过！\n")


def test_language_setting_from_env():
    """测试从环境变量读取语言设置"""
    print("=" * 60)
    print("测试 2: 从环境变量读取语言设置")
    print("=" * 60)

    # 测试中文
    os.environ["AUTO_CLAUDE_LANGUAGE"] = "zh-CN"
    lang = get_language_setting()
    print(f"\n✓ 设置 AUTO_CLAUDE_LANGUAGE=zh-CN")
    print(f"  结果: {lang}")
    assert lang == "zh-CN", f"应为 'zh-CN'，实际为 '{lang}'"

    # 测试英文
    os.environ["AUTO_CLAUDE_LANGUAGE"] = "en"
    lang = get_language_setting()
    print(f"\n✓ 设置 AUTO_CLAUDE_LANGUAGE=en")
    print(f"  结果: {lang}")
    assert lang == "en", f"应为 'en'，实际为 '{lang}'"

    # 测试法文
    os.environ["AUTO_CLAUDE_LANGUAGE"] = "fr"
    lang = get_language_setting()
    print(f"\n✓ 设置 AUTO_CLAUDE_LANGUAGE=fr")
    print(f"  结果: {lang}")
    assert lang == "fr", f"应为 'fr'，实际为 '{lang}'"

    # 测试默认值（删除环境变量）
    if "AUTO_CLAUDE_LANGUAGE" in os.environ:
        del os.environ["AUTO_CLAUDE_LANGUAGE"]
    lang = get_language_setting()
    print(f"\n✓ 未设置 AUTO_CLAUDE_LANGUAGE（默认值）")
    print(f"  结果: {lang}")
    assert lang == "en-US", f"默认值应为 'en-US'，实际为 '{lang}'"

    print("\n✅ 环境变量读取测试通过！\n")


def test_system_prompt_injection():
    """测试 system_prompt 中是否注入了语言指令"""
    print("=" * 60)
    print("测试 3: System Prompt 语言注入")
    print("=" * 60)

    # 模拟 create_client() 中的逻辑
    base_prompt = "You are an expert full-stack developer..."

    # 测试中文注入
    os.environ["AUTO_CLAUDE_LANGUAGE"] = "zh-CN"
    language = get_language_setting()
    language_instruction = generate_language_instruction(language)
    final_prompt = f"{base_prompt}\n\n{language_instruction}"

    print(f"\n✓ 中文注入测试:")
    print(f"  语言设置: {language}")
    print(f"  语言指令长度: {len(language_instruction)} 字符")
    print(f"  最终 prompt 长度: {len(final_prompt)} 字符")
    assert "语言要求" in final_prompt, "中文指令应被注入到 system_prompt"
    assert "中文" in final_prompt, "最终 prompt 应包含中文要求"

    # 测试英文注入
    os.environ["AUTO_CLAUDE_LANGUAGE"] = "en"
    language = get_language_setting()
    language_instruction = generate_language_instruction(language)
    final_prompt = f"{base_prompt}\n\n{language_instruction}"

    print(f"\n✓ 英文注入测试:")
    print(f"  语言设置: {language}")
    print(f"  语言指令长度: {len(language_instruction)} 字符")
    print(f"  最终 prompt 长度: {len(final_prompt)} 字符")
    assert "Language Requirements" in final_prompt, "英文指令应被注入到 system_prompt"

    print("\n✅ System Prompt 注入测试通过！\n")


def main():
    """运行所有测试"""
    print("\n" + "=" * 60)
    print("🌐 i18n 端到端测试")
    print("=" * 60 + "\n")

    try:
        test_language_instruction_generation()
        test_language_setting_from_env()
        test_system_prompt_injection()

        print("=" * 60)
        print("🎉 所有测试通过！")
        print("=" * 60)
        print("\n✅ i18n 功能验证成功：")
        print("   - 语言指令生成正确")
        print("   - 环境变量读取正确")
        print("   - System Prompt 注入正确")
        print("\n📝 下一步：运行实际的 Agent 任务，验证输出语言")
        print("   命令示例：")
        print("   ```bash")
        print("   cd apps/backend")
        print("   export AUTO_CLAUDE_LANGUAGE=zh-CN")
        print("   python run.py --spec 001-i18n-agent-agent")
        print("   ```\n")

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
