"""
SkillCN 爬虫 - 从 GitHub 技能仓库抓取技能信息并按热度排名
"""

import json
import os
import re
import time
import urllib.request
import urllib.error
from dataclasses import dataclass, field, asdict
from typing import Optional


@dataclass
class SkillInfo:
    """技能信息"""
    id: str
    name_en: str
    description_en: str
    name_cn: str = ""
    description_cn: str = ""
    category: str = "community"
    source_repo: str = ""
    source_url: str = ""
    stars: int = 0
    popularity: int = 0
    tags: list = field(default_factory=list)


# 要爬取的技能仓库列表，按优先级排序
SKILL_REPOS = [
    {
        "owner": "anthropics",
        "repo": "skills",
        "label": "Anthropic 官方",
        "category_default": "official",
        "skills_path": "skills",
    },
    {
        "owner": "nichochar",
        "repo": "cloudflare-skills",
        "label": "Cloudflare",
        "category_default": "infrastructure",
        "skills_path": ".",
    },
    {
        "owner": "nichochar",
        "repo": "stitch-skills",
        "label": "Google Labs Stitch",
        "category_default": "design",
        "skills_path": ".",
    },
    {
        "owner": "nichochar",
        "repo": "google-workspace-skills",
        "label": "Google Workspace",
        "category_default": "enterprise",
        "skills_path": ".",
    },
    {
        "owner": "nichochar",
        "repo": "google-gemini-skills",
        "label": "Google Gemini",
        "category_default": "ai-ml",
        "skills_path": ".",
    },
    {
        "owner": "daymade",
        "repo": "claude-code-skills",
        "label": "daymade 社区",
        "category_default": "community",
        "skills_path": "skills",
    },
    {
        "owner": "glebis",
        "repo": "claude-skills",
        "label": "glebis 社区",
        "category_default": "community",
        "skills_path": "skills",
    },
]


class GitHubFetcher:
    """GitHub API 数据获取器"""

    BASE_URL = "https://api.github.com"

    def __init__(self, token: Optional[str] = None):
        self.token = token or os.environ.get("GITHUB_TOKEN", "")
        self.request_count = 0

    def _make_request(self, url: str) -> Optional[dict | list]:
        """发送 GitHub API 请求"""
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "SkillCN-Crawler/1.0",
        }
        if self.token:
            headers["Authorization"] = f"token {self.token}"

        req = urllib.request.Request(url, headers=headers)
        self.request_count += 1

        # 速率限制
        if self.request_count % 10 == 0:
            time.sleep(1)

        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            if e.code == 403:
                print(f"  [!] API 速率限制，等待 60 秒...")
                time.sleep(60)
                try:
                    with urllib.request.urlopen(req, timeout=15) as resp:
                        return json.loads(resp.read().decode())
                except Exception:
                    pass
            elif e.code == 404:
                print(f"  [!] 未找到: {url}")
            else:
                print(f"  [!] HTTP 错误 {e.code}: {url}")
            return None
        except Exception as e:
            print(f"  [!] 请求失败: {e}")
            return None

    def get_repo_info(self, owner: str, repo: str) -> Optional[dict]:
        """获取仓库信息（包含 stars）"""
        url = f"{self.BASE_URL}/repos/{owner}/{repo}"
        return self._make_request(url)

    def list_directory(self, owner: str, repo: str, path: str = "") -> Optional[list]:
        """列出仓库目录内容"""
        url = f"{self.BASE_URL}/repos/{owner}/{repo}/contents/{path}"
        return self._make_request(url)

    def get_file_content(self, owner: str, repo: str, path: str) -> Optional[str]:
        """获取文件原始内容"""
        url = f"https://raw.githubusercontent.com/{owner}/{repo}/main/{path}"
        headers = {"User-Agent": "SkillCN-Crawler/1.0"}
        req = urllib.request.Request(url, headers=headers)
        self.request_count += 1

        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return resp.read().decode()
        except Exception:
            # 尝试 master 分支
            url2 = url.replace("/main/", "/master/")
            req2 = urllib.request.Request(url2, headers=headers)
            try:
                with urllib.request.urlopen(req2, timeout=15) as resp:
                    return resp.read().decode()
            except Exception as e:
                print(f"  [!] 获取文件失败: {path} - {e}")
                return None


def parse_skill_md(content: str) -> dict:
    """解析 SKILL.md 文件的 YAML frontmatter"""
    result = {"name": "", "description": ""}

    # 匹配 YAML frontmatter
    match = re.match(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
    if not match:
        return result

    frontmatter = match.group(1)

    # 简单 YAML 解析
    for line in frontmatter.split("\n"):
        line = line.strip()
        if line.startswith("name:"):
            result["name"] = line[5:].strip().strip('"').strip("'")
        elif line.startswith("description:"):
            val = line[12:].strip().strip('"').strip("'")
            result["description"] = val

    # 如果 description 是多行的
    if not result["description"]:
        desc_match = re.search(
            r'description:\s*["|]([^"]+)["|]', frontmatter, re.DOTALL
        )
        if desc_match:
            result["description"] = desc_match.group(1).strip()

    return result


def crawl_repo(fetcher: GitHubFetcher, repo_config: dict) -> list[SkillInfo]:
    """爬取单个仓库的技能列表"""
    owner = repo_config["owner"]
    repo = repo_config["repo"]
    label = repo_config["label"]
    category = repo_config["category_default"]
    skills_path = repo_config["skills_path"]

    print(f"\n{'='*50}")
    print(f"正在爬取: {owner}/{repo} ({label})")
    print(f"{'='*50}")

    skills = []

    # 获取仓库 stars
    repo_info = fetcher.get_repo_info(owner, repo)
    stars = repo_info.get("stargazers_count", 0) if repo_info else 0
    print(f"  Stars: {stars}")

    # 列出技能目录
    contents = fetcher.list_directory(owner, repo, skills_path)
    if not contents:
        print(f"  [!] 无法列出目录: {skills_path}")
        return skills

    # 过滤出子目录（每个目录可能是一个技能）
    skill_dirs = []
    for item in contents:
        if item.get("type") == "dir":
            skill_dirs.append(item["name"])
        elif item.get("type") == "file" and item["name"] == "SKILL.md" and skills_path == ".":
            # 根目录就有 SKILL.md 的情况
            pass

    # 如果 skills_path 是 "."，技能目录就是根目录下的子目录
    if not skill_dirs and skills_path == ".":
        for item in contents:
            if item.get("type") == "dir" and not item["name"].startswith("."):
                skill_dirs.append(item["name"])

    print(f"  找到 {len(skill_dirs)} 个可能的技能目录")

    for dirname in skill_dirs:
        skill_path = f"{skills_path}/{dirname}" if skills_path != "." else dirname
        skill_md_path = f"{skill_path}/SKILL.md"

        # 获取 SKILL.md
        content = fetcher.get_file_content(owner, repo, skill_md_path)
        if not content:
            continue

        parsed = parse_skill_md(content)
        skill_name = parsed["name"] or dirname
        skill_desc = parsed["description"] or ""

        skill = SkillInfo(
            id=dirname,
            name_en=skill_name,
            description_en=skill_desc,
            category=category,
            source_repo=f"{owner}/{repo}",
            source_url=f"https://github.com/{owner}/{repo}/tree/main/{skill_path}",
            stars=stars,
        )

        skills.append(skill)
        print(f"  ✓ {skill_name}")

    print(f"  共获取 {len(skills)} 个技能")
    return skills


def calculate_popularity(skills: list[SkillInfo]) -> list[SkillInfo]:
    """基于 stars 和仓库来源计算热度评分"""
    if not skills:
        return skills

    max_stars = max(s.stars for s in skills) or 1

    # 来源权重
    source_weight = {
        "anthropics/skills": 1.0,
        "nichochar/cloudflare-skills": 0.9,
        "nichochar/stitch-skills": 0.85,
        "nichochar/google-workspace-skills": 0.85,
        "nichochar/google-gemini-skills": 0.85,
    }

    for skill in skills:
        # Stars 占 60%
        star_score = (skill.stars / max_stars) * 60

        # 来源权重占 30%
        weight = source_weight.get(skill.source_repo, 0.5)
        source_score = weight * 30

        # 描述完整度占 10%
        desc_score = 10 if skill.description_en else 0

        skill.popularity = min(100, int(star_score + source_score + desc_score))

    return skills


def crawl_all(token: Optional[str] = None) -> list[SkillInfo]:
    """爬取所有仓库的技能"""
    fetcher = GitHubFetcher(token)
    all_skills = []

    for repo_config in SKILL_REPOS:
        try:
            skills = crawl_repo(fetcher, repo_config)
            all_skills.extend(skills)
        except Exception as e:
            print(f"  [!] 爬取 {repo_config['owner']}/{repo_config['repo']} 失败: {e}")

    # 去重（按 id）
    seen = set()
    unique_skills = []
    for s in all_skills:
        if s.id not in seen:
            seen.add(s.id)
            unique_skills.append(s)

    # 计算热度
    unique_skills = calculate_popularity(unique_skills)

    # 按热度排序
    unique_skills.sort(key=lambda s: s.popularity, reverse=True)

    print(f"\n{'='*50}")
    print(f"总计: {len(unique_skills)} 个独立技能")
    print(f"API 请求次数: {fetcher.request_count}")
    print(f"{'='*50}")

    return unique_skills


if __name__ == "__main__":
    import sys

    token = sys.argv[1] if len(sys.argv) > 1 else None
    skills = crawl_all(token)

    # 保存原始爬取结果
    output_path = os.path.join(os.path.dirname(__file__), "..", "data", "crawled_skills.json")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    data = [asdict(s) for s in skills]
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n已保存到 {output_path}")
    print("\n热度排名 Top 20:")
    for i, s in enumerate(skills[:20], 1):
        print(f"  {i:2d}. [{s.popularity:3d}] {s.name_en} ({s.source_repo})")
