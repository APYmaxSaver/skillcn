#!/usr/bin/env python3
"""
SkillCN 主程序 - 爬取、翻译、排名、生成

用法:
    python tools/run.py                     # 完整流程: 爬取 + 翻译 + 生成
    python tools/run.py --crawl-only        # 仅爬取
    python tools/run.py --translate-only    # 仅翻译（使用已爬取数据）
    python tools/run.py --generate-only     # 仅生成输出文件（使用已翻译数据）

环境变量:
    GITHUB_TOKEN         GitHub API Token（可选，提高速率限制）
    TRANSLATE_API_URL    翻译 API 地址（可选，如 https://api.deepseek.com/v1/chat/completions）
    TRANSLATE_API_KEY    翻译 API 密钥（可选）
"""

import json
import os
import sys

# 确保可以导入同目录模块
sys.path.insert(0, os.path.dirname(__file__))

from crawler import crawl_all, SkillInfo
from translator import SkillTranslator

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
SKILLS_DIR = os.path.join(os.path.dirname(__file__), "..", "skills")

CATEGORIES = [
    {"id": "official", "name": "官方技能", "icon": "🏢", "description": "Anthropic 官方发布的技能", "popularity": 100},
    {"id": "web", "name": "Web 开发", "icon": "🌐", "description": "前端框架、部署、性能优化", "popularity": 95},
    {"id": "infrastructure", "name": "基础设施", "icon": "🏗️", "description": "云平台、数据库、DevOps 工具", "popularity": 88},
    {"id": "development", "name": "开发工具", "icon": "🔧", "description": "代码质量、测试、构建等开发工具", "popularity": 90},
    {"id": "ai-ml", "name": "AI/ML", "icon": "🤖", "description": "模型训练、评估、数据集管理", "popularity": 85},
    {"id": "enterprise", "name": "企业办公", "icon": "🏭", "description": "Google Workspace、协作、通讯", "popularity": 82},
    {"id": "design", "name": "设计工具", "icon": "🎨", "description": "UI/UX 设计、组件库、视觉工具", "popularity": 75},
    {"id": "security", "name": "安全审计", "icon": "🔒", "description": "安全测试、代码审计、漏洞扫描", "popularity": 70},
    {"id": "community", "name": "社区精选", "icon": "👥", "description": "社区开发者贡献的优质技能", "popularity": 78},
]


def step_crawl(token=None) -> list[dict]:
    """步骤 1: 爬取技能"""
    print("\n" + "=" * 60)
    print("步骤 1: 爬取 GitHub 技能仓库")
    print("=" * 60)

    skills = crawl_all(token)

    # 保存爬取结果
    output_path = os.path.join(DATA_DIR, "crawled_skills.json")
    os.makedirs(DATA_DIR, exist_ok=True)

    from dataclasses import asdict
    data = [asdict(s) for s in skills]
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n已保存爬取结果: {output_path} ({len(data)} 个技能)")
    return data


def step_translate(skills: list[dict]) -> list[dict]:
    """步骤 2: 翻译技能"""
    print("\n" + "=" * 60)
    print("步骤 2: 翻译技能为中文")
    print("=" * 60)

    translator = SkillTranslator()
    skills = translator.translate_all(skills)

    # 保存翻译结果
    output_path = os.path.join(DATA_DIR, "translated_skills.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(skills, f, ensure_ascii=False, indent=2)

    print(f"\n已保存翻译结果: {output_path}")
    return skills


def step_generate(skills: list[dict]):
    """步骤 3: 生成 Web 数据和分类文档"""
    print("\n" + "=" * 60)
    print("步骤 3: 生成输出文件")
    print("=" * 60)

    # 按热度排序
    skills.sort(key=lambda s: s.get("popularity", 0), reverse=True)

    # 生成 Web 数据 (data/skills.json)
    web_skills = []
    for s in skills:
        name_cn = s.get("name_cn") or s.get("name_en", "")
        desc_cn = s.get("description_cn") or s.get("description_en", "")
        tags = s.get("tags", [])
        if not tags:
            tags = _generate_tags(s)

        web_skills.append({
            "id": s["id"],
            "name": name_cn,
            "nameEn": s.get("name_en", s["id"]),
            "description": desc_cn,
            "descriptionEn": s.get("description_en", ""),
            "category": s.get("category", "community"),
            "source": s.get("source_repo", ""),
            "sourceUrl": s.get("source_url", ""),
            "popularity": s.get("popularity", 50),
            "tags": tags,
        })

    web_data = {
        "categories": CATEGORIES,
        "skills": web_skills,
    }

    web_path = os.path.join(DATA_DIR, "skills.json")
    with open(web_path, "w", encoding="utf-8") as f:
        json.dump(web_data, f, ensure_ascii=False, indent=2)
    print(f"  ✓ Web 数据: {web_path} ({len(web_skills)} 个技能)")

    # 生成分类 README
    _generate_category_readmes(web_skills)

    # 打印排行榜
    print(f"\n{'='*60}")
    print("热度排行榜")
    print(f"{'='*60}")
    for i, s in enumerate(web_skills[:30], 1):
        pop = s["popularity"]
        icon = "🔥" if pop >= 90 else "⭐" if pop >= 80 else "📌" if pop >= 70 else "📎"
        print(f"  {i:2d}. [{pop:3d}] {icon} {s['name']}  ({s['nameEn']})")

    print(f"\n总计: {len(web_skills)} 个技能，{len(CATEGORIES)} 个分类")


def _generate_tags(skill: dict) -> list[str]:
    """自动生成标签"""
    tags = []
    text = f"{skill.get('id', '')} {skill.get('name_en', '')} {skill.get('description_en', '')}".lower()

    tag_keywords = {
        "React": ["react"],
        "Next.js": ["next.js", "next-"],
        "Vue": ["vue"],
        "Cloudflare": ["cloudflare", "wrangler", "worker"],
        "Netlify": ["netlify"],
        "Vercel": ["vercel"],
        "Terraform": ["terraform"],
        "PostgreSQL": ["postgres", "postgresql"],
        "Stripe": ["stripe"],
        "Hugging Face": ["hugging-face", "hugging face"],
        "AI": ["ai ", " ai", "model", "llm"],
        "部署": ["deploy", "deployment"],
        "测试": ["test", "testing"],
        "安全": ["security", "secure", "audit"],
        "性能": ["performance", "perf", "optimization"],
        "CLI": ["cli", "command"],
        "API": ["api "],
        "MCP": ["mcp"],
    }

    for tag, keywords in tag_keywords.items():
        if any(kw in text for kw in keywords):
            tags.append(tag)

    return tags[:5]  # 最多 5 个标签


def _get_popularity_icon(pop: int) -> str:
    if pop >= 90:
        return "🔥"
    if pop >= 80:
        return "⭐"
    if pop >= 70:
        return "📌"
    return "📎"


def _generate_category_readmes(skills: list[dict]):
    """生成每个分类的 README.md"""
    cat_map = {c["id"]: c for c in CATEGORIES}

    for cat in CATEGORIES:
        cat_skills = [s for s in skills if s["category"] == cat["id"]]
        if not cat_skills:
            continue

        cat_skills.sort(key=lambda s: s["popularity"], reverse=True)

        lines = [
            f"# {cat['icon']} {cat['name']}",
            "",
            cat["description"],
            "",
            f"共 {len(cat_skills)} 个技能。",
            "",
            "| 技能 | 英文名 | 说明 | 热度 |",
            "|------|--------|------|------|",
        ]

        for s in cat_skills:
            icon = _get_popularity_icon(s["popularity"])
            lines.append(
                f"| {s['name']} | {s['nameEn']} | {s['description'][:50]} | {icon} {s['popularity']} |"
            )

        lines.extend([
            "",
            "## 安装方式",
            "",
            "```bash",
            "# 在项目根目录",
            "mkdir -p .claude/skills",
            "# 从源仓库复制对应技能文件夹到 .claude/skills/",
            "```",
        ])

        # 来源
        sources = set()
        for s in cat_skills:
            if s.get("source"):
                sources.add(s["source"])

        if sources:
            lines.extend(["", "## 来源仓库", ""])
            for src in sorted(sources):
                lines.append(f"- [{src}](https://github.com/{src})")

        # 写文件
        cat_dir = os.path.join(SKILLS_DIR, cat["id"])
        os.makedirs(cat_dir, exist_ok=True)
        readme_path = os.path.join(cat_dir, "README.md")
        with open(readme_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
        print(f"  ✓ 分类文档: {readme_path} ({len(cat_skills)} 个技能)")


def load_data(filename: str) -> list[dict]:
    """加载数据文件"""
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        print(f"  [!] 文件不存在: {path}")
        return []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    args = sys.argv[1:]

    if "--help" in args or "-h" in args:
        print(__doc__)
        return

    token = os.environ.get("GITHUB_TOKEN")

    if "--crawl-only" in args:
        step_crawl(token)
    elif "--translate-only" in args:
        skills = load_data("crawled_skills.json")
        if skills:
            step_translate(skills)
    elif "--generate-only" in args:
        skills = load_data("translated_skills.json")
        if not skills:
            skills = load_data("crawled_skills.json")
        if skills:
            step_generate(skills)
    else:
        # 完整流程
        skills = step_crawl(token)
        skills = step_translate(skills)
        step_generate(skills)

    print("\n完成!")


if __name__ == "__main__":
    main()
