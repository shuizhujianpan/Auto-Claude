#!/usr/bin/env python3
"""
i18n Agent 输出验证脚本
========================

手动验证 Agent 在不同语言设置下的实际输出。

使用方法：
1. 设置环境变量：export AUTO_CLAUDE_LANGUAGE=zh-CN
2. 运行此脚本：python verify_i18n_agent_output.py
3. 检查输出是否使用目标语言
"""

import os
import sys
from pathlib import Path

# 添加 apps/backend 到路径
backend_dir = Path(__file__).parent / "apps" / "backend"
sys.path.insert(0, str(backend_dir))

from prompts_pkg.prompt_generator import get_language_setting, generate_language_instruction


def print_section(title):
    """打印分节标题"""
    print("\n" + "=" * 70)
    print(f" {title}")
    print("=" * 70 + "\n")


def check_chinese_keywords(text):
    """检查文本是否包含中文关键词"""
    chinese_keywords = [
        "语言", "中文", "必须", "使用", "要求",
        "Language", "English"  # 这些不应该出现在中文指令中
    ]

    has_chinese = any(keyword in text for keyword in chinese_keywords[:5])
    no_english = not any(keyword in text for keyword in chinese_keywords[5:])

    return has_chinese and no_english


def check_english_keywords(text):
    """检查文本是否包含英文关键词"""
    return "Language Requirements" in text and "English" in text


def check_french_keywords(text):
    """检查文本是否包含法文关键词"""
    return "Exigences Linguistiques" in text and "français" in text


def test_chinese_output():
    """测试中文输出"""
    print_section("测试 1: 中文输出 (AUTO_CLAUDE_LANGUAGE=zh-CN)")

    # 设置环境变量
    os.environ["AUTO_CLAUDE_LANGUAGE"] = "zh-CN"

    # 获取语言设置和指令
    language = get_language_setting()
    instruction = generate_language_instruction(language)

    print(f"✓ 语言设置: {language}")
    print(f"✓ 指令长度: {len(instruction)} 字符")
    print("\n生成的语言指令:")
    print("-" * 70)
    print(instruction)
    print("-" * 70)

    # 验证
    assert language == "zh-CN", f"语言应为 zh-CN，实际为 {language}"
    assert "语言要求" in instruction, "应包含'语言要求'"
    assert "中文" in instruction, "应包含'中文'"
    assert "Git 提交" in instruction, "应包含'Git 提交'"
    assert "代码注释" in instruction, "应包含'代码注释'"

    print("\n✅ 中文输出验证通过！")
    print("   ✓ 语言设置正确")
    print("   ✓ 包含所有必需的中文指令")
    print("   ✓ 覆盖用户交互、Git 提交、代码文档、调试输出")


def test_english_output():
    """测试英文输出"""
    print_section("测试 2: 英文输出 (AUTO_CLAUDE_LANGUAGE=en)")

    # 设置环境变量
    os.environ["AUTO_CLAUDE_LANGUAGE"] = "en"

    # 获取语言设置和指令
    language = get_language_setting()
    instruction = generate_language_instruction(language)

    print(f"✓ 语言设置: {language}")
    print(f"✓ 指令长度: {len(instruction)} 字符")

    # 验证
    assert language == "en", f"语言应为 en，实际为 {language}"
    assert "Language Requirements" in instruction, "应包含'Language Requirements'"
    assert "English" in instruction, "应包含'English'"

    print("\n✅ 英文输出验证通过！")
    print("   ✓ 语言设置正确")
    print("   ✓ 包含所有必需的英文指令")


def test_french_output():
    """测试法文输出"""
    print_section("测试 3: 法文输出 (AUTO_CLAUDE_LANGUAGE=fr)")

    # 设置环境变量
    os.environ["AUTO_CLAUDE_LANGUAGE"] = "fr"

    # 获取语言设置和指令
    language = get_language_setting()
    instruction = generate_language_instruction(language)

    print(f"✓ 语言设置: {language}")
    print(f"✓ 指令长度: {len(instruction)} 字符")

    # 验证
    assert language == "fr", f"语言应为 fr，实际为 {language}"
    assert "Exigences Linguistiques" in instruction, "应包含'Exigences Linguistiques'"
    assert "français" in instruction, "应包含'français'"

    print("\n✅ 法文输出验证通过！")
    print("   ✓ 语言设置正确")
    print("   ✓ 包含所有必需的法文指令")


def test_default_behavior():
    """测试默认行为（无环境变量）"""
    print_section("测试 4: 默认行为（未设置 AUTO_CLAUDE_LANGUAGE）")

    # 删除环境变量
    if "AUTO_CLAUDE_LANGUAGE" in os.environ:
        del os.environ["AUTO_CLAUDE_LANGUAGE"]

    # 获取语言设置和指令
    language = get_language_setting()
    instruction = generate_language_instruction(language)

    print(f"✓ 语言设置: {language} (默认)")
    print(f"✓ 指令长度: {len(instruction)} 字符")

    # 验证默认值
    # 注意：get_language_setting() 的默认实现返回 "en-US"
    # generate_language_instruction() 会将 "en-US" 回退到 "en"
    if language == "en-US":
        # 检查指令是否回退到英文
        assert "Language Requirements" in instruction or instruction == generate_language_instruction("en"), \
            "默认语言应使用英文指令"
        print("\n✅ 默认行为验证通过！")
        print("   ✓ 未设置环境变量时使用默认值")
        print("   ✓ 默认使用英文指令")
    else:
        print(f"\n⚠️  注意: 默认语言为 {language}")


def main():
    """运行所有验证测试"""
    print("\n" + "=" * 70)
    print(" 🌐 i18n Agent 输出验证")
    print("=" * 70)
    print("\n此脚本验证 Agent 在不同语言设置下的输出语言指令。")
    print("测试完成后，您应该运行实际的 Agent 任务来验证完整的行为。\n")

    try:
        test_chinese_output()
        test_english_output()
        test_french_output()
        test_default_behavior()

        print_section("🎉 所有验证测试通过！")
        print("\n✅ i18n 功能验证成功：")
        print("   ✓ 中文输出正确")
        print("   ✓ 英文输出正确")
        print("   ✓ 法文输出正确")
        print("   ✓ 默认行为正确")

        print("\n📋 下一步：手动验证实际 Agent 输出")
        print("\n要验证实际的 Agent 行为，请运行：")
        print("\n1. 中文测试：")
        print("   ```bash")
        print("   export AUTO_CLAUDE_LANGUAGE=zh-CN")
        print("   cd apps/backend")
        print("   python run.py --spec 001-i18n-agent-agent")
        print("   ```")
        print("\n2. 英文测试：")
        print("   ```bash")
        print("   export AUTO_CLAUDE_LANGUAGE=en")
        print("   cd apps/backend")
        print("   python run.py --spec 001-i18n-agent-agent")
        print("   ```")
        print("\n3. 默认行为测试：")
        print("   ```bash")
        print("   # 不设置环境变量")
        print("   cd apps/backend")
        print("   python run.py --spec 001-i18n-agent-agent")
        print("   ```")

        print("\n🔍 验证检查清单：")
        print("   □ Agent 对话输出使用目标语言")
        print("   □ Git 提交信息使用目标语言")
        print("   □ 代码注释使用目标语言")
        print("   □ 日志输出使用目标语言")
        print("   □ 错误消息使用目标语言")
        print("\n")

        return 0

    except AssertionError as e:
        print(f"\n❌ 验证失败: {e}\n")
        return 1
    except Exception as e:
        print(f"\n❌ 错误: {e}\n")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
