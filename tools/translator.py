"""
SkillCN 翻译器 - 将技能名称和描述翻译为中文

支持两种模式:
1. 内置词典 - 使用预定义的翻译映射（离线可用）
2. AI 翻译 - 调用翻译 API（需要联网）
"""

import json
import os
import re
import urllib.request
import urllib.error

# ============================================================
# 内置翻译词典
# ============================================================

# 技能名称翻译映射
NAME_TRANSLATIONS = {
    # Anthropic 官方
    "docx": "Word 文档处理",
    "pdf": "PDF 文档处理",
    "pptx": "PPT 演示文稿处理",
    "xlsx": "Excel 电子表格处理",
    "doc-coauthoring": "文档协作编辑",
    "algorithmic-art": "算法生成艺术",
    "canvas-design": "画布设计",
    "frontend-design": "前端设计",
    "slack-gif-creator": "Slack GIF 创建器",
    "theme-factory": "主题工厂",
    "web-artifacts-builder": "Web 制品构建器",
    "mcp-builder": "MCP 服务器构建器",
    "webapp-testing": "Web 应用测试",
    "brand-guidelines": "品牌指南",
    "internal-comms": "内部通讯",
    "skill-creator": "技能创建器",
    # Cloudflare
    "agents-sdk": "Cloudflare AI Agent SDK",
    "building-ai-agent-on-cloudflare": "在 Cloudflare 构建 AI Agent",
    "building-mcp-server-on-cloudflare": "在 Cloudflare 构建 MCP 服务器",
    "cloudflare-skill": "Cloudflare 平台参考",
    "commands": "命令行参考",
    "durable-objects": "Durable Objects 持久对象",
    "web-perf": "Web 性能优化",
    "wrangler": "Wrangler CLI 工具",
    # Vercel / Next.js
    "next-best-practices": "Next.js 最佳实践",
    "next-cache-components": "Next.js 缓存组件",
    "next-upgrade": "Next.js 版本升级",
    "react-best-practices": "React 最佳实践",
    "composition-patterns": "React 组合模式",
    "web-design-guidelines": "Web 设计指南",
    "vercel-deploy-claimable": "Vercel 部署",
    "react-native-skills": "React Native 技能",
    # Stitch / Design
    "design-md": "DESIGN.md 设计文档",
    "enhance-prompt": "提示词增强",
    "react-components": "Stitch 转 React 组件",
    "remotion": "Remotion 编程视频",
    "shadcn-ui": "shadcn/ui 组件库",
    "stitch-loop": "Stitch 迭代循环",
    # Infrastructure
    "terraform-code-generation": "Terraform 代码生成",
    "terraform-module-generation": "Terraform 模块生成",
    "terraform-provider-development": "Terraform Provider 开发",
    "postgres-best-practices": "PostgreSQL 最佳实践",
    "using-neon": "Neon 无服务器 Postgres",
    "stripe-best-practices": "Stripe 集成最佳实践",
    "upgrade-stripe": "Stripe SDK 升级",
    "tinybird-best-practices": "Tinybird 最佳实践",
    "sanity-best-practices": "Sanity CMS 最佳实践",
    "content-modeling-best-practices": "内容建模最佳实践",
    "seo-aeo-best-practices": "SEO 与答案引擎优化",
    "content-experimentation-best-practices": "内容实验",
    "clickhouse": "ClickHouse 最佳实践",
    # Netlify
    "netlify-functions": "Netlify 无服务器函数",
    "netlify-edge-functions": "Netlify 边缘函数",
    "netlify-blobs": "Netlify Blobs 对象存储",
    "netlify-db": "Netlify 数据库",
    "netlify-image-cdn": "Netlify 图片 CDN",
    "netlify-forms": "Netlify 表单处理",
    "netlify-frameworks": "Netlify 框架部署",
    "netlify-caching": "Netlify 缓存配置",
    "netlify-config": "Netlify 配置参考",
    "netlify-cli-and-deploy": "Netlify CLI 与部署",
    "netlify-deploy": "Netlify 部署",
    "netlify-ai-gateway": "Netlify AI 网关",
    # Hugging Face
    "hugging-face-cli": "Hugging Face CLI",
    "hugging-face-datasets": "Hugging Face 数据集",
    "hugging-face-evaluation": "Hugging Face 模型评估",
    "hugging-face-jobs": "Hugging Face 计算任务",
    "hugging-face-model-trainer": "Hugging Face 模型训练",
    "hugging-face-paper-publisher": "Hugging Face 论文发布",
    "hugging-face-tool-builder": "Hugging Face 工具构建",
    "hugging-face-trackio": "Hugging Face 实验追踪",
    # Security
    "ask-questions-if-underspecified": "模糊需求澄清",
    "audit-context-building": "审计上下文构建",
    "building-secure-contracts": "安全智能合约构建",
    # Other
    "replicate": "Replicate AI 模型",
    "typefully": "Typefully 社交媒体发布",
    "firecrawl-cli": "Firecrawl 命令行工具",
    "firecrawl-claude-plugin": "Firecrawl Claude 插件",
    "github": "GitHub 工作流",
    "react-native-best-practices": "React Native 最佳实践",
    "upgrading-react-native": "React Native 升级指南",
    "expo-app-design": "Expo 应用设计",
    "expo-deployment": "Expo 部署",
    "upgrading-expo": "Expo SDK 升级",
    "better-auth-best-practices": "Better Auth 最佳实践",
    "create-auth": "Better Auth 认证设置",
    "create-voltagent": "创建 VoltAgent 项目",
    "voltagent-best-practices": "VoltAgent 最佳实践",
    "voltagent-core-reference": "VoltAgent 核心参考",
    "voltagent-docs-bundle": "VoltAgent 文档包",
    "composio": "Composio 应用集成",
    "google-workspace-cli": "Google Workspace CLI",
    "sentry-code-review": "Sentry 代码审查",
}

# 常用英文技术词汇 -> 中文翻译对照表（用于自动翻译描述）
TERM_DICT = {
    "best practices": "最佳实践",
    "deployment": "部署",
    "serverless": "无服务器",
    "edge functions": "边缘函数",
    "caching": "缓存",
    "configuration": "配置",
    "authentication": "认证",
    "authorization": "授权",
    "middleware": "中间件",
    "optimization": "优化",
    "performance": "性能",
    "security": "安全",
    "vulnerability": "漏洞",
    "smart contract": "智能合约",
    "code review": "代码审查",
    "workflow": "工作流",
    "integration": "集成",
    "plugin": "插件",
    "component": "组件",
    "framework": "框架",
    "template": "模板",
    "database": "数据库",
    "storage": "存储",
    "compute": "计算",
    "scheduling": "调度",
    "monitoring": "监控",
    "logging": "日志",
    "debugging": "调试",
    "testing": "测试",
    "build": "构建",
    "deploy": "部署",
    "upgrade": "升级",
    "migration": "迁移",
    "CLI": "命令行工具",
    "API": "API 接口",
    "SDK": "开发套件",
    "model": "模型",
    "dataset": "数据集",
    "training": "训练",
    "evaluation": "评估",
    "inference": "推理",
    "fine-tuning": "微调",
}

# 分类关键词映射
CATEGORY_KEYWORDS = {
    "official": ["anthropic", "claude"],
    "web": [
        "next.js", "react", "vue", "angular", "frontend", "web",
        "netlify", "vercel", "expo", "css", "html", "svelte",
        "shadcn", "tailwind", "ui component", "SSR", "SSG",
    ],
    "infrastructure": [
        "cloudflare", "terraform", "docker", "kubernetes", "aws",
        "gcp", "azure", "postgres", "mysql", "redis", "neon",
        "supabase", "stripe", "payment", "tinybird", "clickhouse",
        "sanity", "cms", "durable", "worker", "wrangler",
    ],
    "development": [
        "github", "git", "sentry", "firecrawl", "crawl", "scrape",
        "auth", "voltagent", "agent", "remotion", "video",
        "lint", "test", "ci/cd", "debug",
    ],
    "ai-ml": [
        "hugging face", "model", "training", "dataset", "ml",
        "machine learning", "ai", "gemini", "replicate", "llm",
        "evaluation", "trackio", "experiment",
    ],
    "design": [
        "design", "stitch", "ui/ux", "figma", "sketch",
        "prompt", "visual", "art", "canvas",
    ],
    "security": [
        "security", "audit", "vulnerability", "secure",
        "trail of bits", "penetration", "contract",
    ],
    "enterprise": [
        "google workspace", "drive", "sheets", "gmail",
        "composio", "typefully", "social media", "slack",
        "office", "enterprise", "collaboration",
    ],
}


def auto_categorize(skill_id: str, description: str, source_repo: str) -> str:
    """根据技能 ID、描述和来源自动判断分类"""
    # 优先根据来源判断
    if "anthropics/skills" in source_repo:
        return "official"

    text = f"{skill_id} {description}".lower()

    scores = {}
    for category, keywords in CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw.lower() in text)
        if score > 0:
            scores[category] = score

    if scores:
        return max(scores, key=scores.get)

    return "community"


def translate_name(skill_id: str, name_en: str) -> str:
    """翻译技能名称"""
    # 先查词典
    if skill_id in NAME_TRANSLATIONS:
        return NAME_TRANSLATIONS[skill_id]

    # 尝试用英文名查
    name_lower = name_en.lower().replace(" ", "-")
    if name_lower in NAME_TRANSLATIONS:
        return NAME_TRANSLATIONS[name_lower]

    # 返回原始英文名（未能翻译）
    return name_en


def translate_description_simple(desc_en: str) -> str:
    """简单的描述翻译（基于术语替换，非完整翻译）

    注意：这只是一个基础的术语替换，不是真正的翻译。
    完整翻译需要使用 AI API。
    """
    if not desc_en:
        return ""

    result = desc_en
    # 按长度降序排列，防止短词先匹配导致长词无法匹配
    sorted_terms = sorted(TERM_DICT.items(), key=lambda x: len(x[0]), reverse=True)

    for en, cn in sorted_terms:
        pattern = re.compile(re.escape(en), re.IGNORECASE)
        result = pattern.sub(cn, result)

    return result


DEFAULT_SYSTEM_PROMPT = (
    "你是一个技术文档翻译专家。将以下英文技术描述翻译为简洁的中文。"
    "保留专有名词（如 React、Next.js、Cloudflare 等）不翻译。"
    "翻译要简洁、专业、自然。只返回翻译结果，不要解释。"
)


def _detect_api_format(api_url: str) -> str:
    """根据 URL 自动检测 API 格式

    返回 "responses" 或 "chat_completions"
    """
    if "/responses" in api_url:
        return "responses"
    return "chat_completions"


def _build_chat_completions_payload(
    text: str, model: str, system_prompt: str
) -> dict:
    """构建 Chat Completions 格式请求体 (/v1/chat/completions)"""
    return {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": system_prompt or DEFAULT_SYSTEM_PROMPT,
            },
            {"role": "user", "content": text},
        ],
        "temperature": 0.3,
        "max_tokens": 200,
    }


def _build_responses_payload(
    text: str, model: str, system_prompt: str
) -> dict:
    """构建 Responses 格式请求体 (/v1/responses)"""
    return {
        "model": model,
        "instructions": system_prompt or DEFAULT_SYSTEM_PROMPT,
        "input": text,
        "store": False,
    }


def _parse_chat_completions_response(result: dict) -> str:
    """解析 Chat Completions 格式响应"""
    return result["choices"][0]["message"]["content"].strip()


def _parse_responses_response(result: dict) -> str:
    """解析 Responses 格式响应

    Responses API 返回 output 数组，每项有 type 和 content。
    文本输出的 type 为 "message"，content 为 content 数组。
    """
    for item in result.get("output", []):
        if item.get("type") == "message":
            for content in item.get("content", []):
                if content.get("type") == "output_text":
                    return content.get("text", "").strip()
    # 兜底：尝试 output_text 字段（简化响应格式）
    if result.get("output_text"):
        return result["output_text"].strip()
    return ""


def translate_with_api(
    text: str,
    api_url: str,
    api_key: str,
    model: str = "gpt-4o-mini",
    system_prompt: str = "",
    api_format: str = "",
) -> str:
    """使用翻译 API 翻译文本

    支持两种 API 格式：

    1. Chat Completions (/v1/chat/completions) - 经典格式
       - OpenAI 官方、DeepSeek、智谱、通义千问、Kimi、Azure、Ollama 等

    2. Responses (/v1/responses) - OpenAI 新版格式
       - OpenAI 官方 (https://api.openai.com/v1/responses)
       - Azure OpenAI Responses API

    格式自动检测：URL 包含 "/responses" 则使用 Responses 格式，否则使用 Chat Completions。
    也可通过 api_format 参数或 TRANSLATE_API_FORMAT 环境变量显式指定。
    """
    fmt = api_format or _detect_api_format(api_url)

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    if fmt == "responses":
        payload_dict = _build_responses_payload(text, model, system_prompt)
    else:
        payload_dict = _build_chat_completions_payload(text, model, system_prompt)

    payload = json.dumps(payload_dict).encode("utf-8")
    req = urllib.request.Request(api_url, data=payload, headers=headers)

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode())

            if fmt == "responses":
                return _parse_responses_response(result)
            else:
                return _parse_chat_completions_response(result)
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        print(f"  [!] 翻译 API HTTP {e.code}: {body[:200]}")
        return ""
    except Exception as e:
        print(f"  [!] 翻译 API 失败: {e}")
        return ""


class SkillTranslator:
    """技能翻译器"""

    def __init__(
        self,
        api_url: str = "",
        api_key: str = "",
        model: str = "",
        system_prompt: str = "",
        api_format: str = "",
    ):
        self.api_url = api_url or os.environ.get("TRANSLATE_API_URL", "")
        self.api_key = api_key or os.environ.get("TRANSLATE_API_KEY", "")
        self.model = model or os.environ.get("TRANSLATE_MODEL", "gpt-4o-mini")
        self.system_prompt = system_prompt or os.environ.get("TRANSLATE_SYSTEM_PROMPT", "")
        self.api_format = api_format or os.environ.get("TRANSLATE_API_FORMAT", "")
        self.use_api = bool(self.api_url and self.api_key)
        self.cache = {}
        self._load_cache()

    def _cache_path(self) -> str:
        return os.path.join(
            os.path.dirname(__file__), "..", "data", "translation_cache.json"
        )

    def _load_cache(self):
        path = self._cache_path()
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                self.cache = json.load(f)
            print(f"  已加载翻译缓存: {len(self.cache)} 条")

    def _save_cache(self):
        path = self._cache_path()
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.cache, f, ensure_ascii=False, indent=2)

    def translate_skill(self, skill: dict) -> dict:
        """翻译单个技能的名称和描述"""
        skill_id = skill.get("id", "")
        name_en = skill.get("name_en", "")
        desc_en = skill.get("description_en", "")

        # 翻译名称（优先使用词典）
        skill["name_cn"] = translate_name(skill_id, name_en)

        # 翻译描述
        cache_key = f"desc:{desc_en}"
        if cache_key in self.cache:
            skill["description_cn"] = self.cache[cache_key]
        elif self.use_api and desc_en:
            translated = translate_with_api(
                desc_en, self.api_url, self.api_key,
                self.model, self.system_prompt, self.api_format,
            )
            if translated:
                skill["description_cn"] = translated
                self.cache[cache_key] = translated
            else:
                skill["description_cn"] = translate_description_simple(desc_en)
        else:
            skill["description_cn"] = translate_description_simple(desc_en)

        # 自动分类
        if not skill.get("category") or skill["category"] == "community":
            skill["category"] = auto_categorize(
                skill_id, desc_en, skill.get("source_repo", "")
            )

        return skill

    def translate_all(self, skills: list[dict]) -> list[dict]:
        """翻译所有技能"""
        print(f"\n开始翻译 {len(skills)} 个技能...")
        if self.use_api:
            fmt = self.api_format or _detect_api_format(self.api_url)
            print(f"  使用 API 翻译: {self.api_url} (模型: {self.model}, 格式: {fmt})")
        else:
            print("  使用内置词典翻译（设置 TRANSLATE_API_URL 和 TRANSLATE_API_KEY 启用 API 翻译）")

        for i, skill in enumerate(skills, 1):
            skill = self.translate_skill(skill)
            name = skill.get("name_cn") or skill.get("name_en", "?")
            print(f"  [{i:3d}/{len(skills)}] {name}")

        # 保存缓存
        if self.cache:
            self._save_cache()
            print(f"  已保存翻译缓存: {len(self.cache)} 条")

        return skills
