# SkillCN 工具集

自动化爬取 GitHub 技能仓库、翻译为中文并按热度排名的工具。

## 系统要求

- Python 3.10+（无需第三方依赖，仅使用标准库）

## 快速开始

```bash
# 完整流程：爬取 → 翻译 → 生成
python tools/run.py

# 仅爬取（从 GitHub 获取技能数据）
python tools/run.py --crawl-only

# 仅翻译（使用已爬取数据）
python tools/run.py --translate-only

# 仅生成输出文件（使用已翻译数据）
python tools/run.py --generate-only
```

## 环境变量

| 变量 | 说明 | 必需 |
|------|------|------|
| `GITHUB_TOKEN` | GitHub Personal Access Token，提高 API 速率限制 | 推荐 |
| `TRANSLATE_API_URL` | 翻译 API 地址（兼容 OpenAI 格式） | 可选 |
| `TRANSLATE_API_KEY` | 翻译 API 密钥 | 可选 |

### 配置 GitHub Token

```bash
export GITHUB_TOKEN="ghp_xxxxxxxxxxxx"
```

不配置 Token 时，GitHub API 限制为 60 次/小时；配置后为 5000 次/小时。

### 配置翻译 API（可选）

支持任何兼容 OpenAI 格式的 API：

```bash
# DeepSeek
export TRANSLATE_API_URL="https://api.deepseek.com/v1/chat/completions"
export TRANSLATE_API_KEY="sk-xxxx"

# 智谱 AI
export TRANSLATE_API_URL="https://open.bigmodel.cn/api/paas/v4/chat/completions"
export TRANSLATE_API_KEY="xxxx"

# 本地 Ollama
export TRANSLATE_API_URL="http://localhost:11434/v1/chat/completions"
export TRANSLATE_API_KEY="ollama"
```

不配置翻译 API 时，使用内置词典翻译（覆盖 100+ 常见技能）。

## 工具说明

### crawler.py - 爬虫

从以下仓库爬取技能信息：

1. `anthropics/skills` - Anthropic 官方
2. `nichochar/cloudflare-skills` - Cloudflare
3. `nichochar/stitch-skills` - Google Labs Stitch
4. `nichochar/google-workspace-skills` - Google Workspace
5. `nichochar/google-gemini-skills` - Google Gemini
6. `daymade/claude-code-skills` - 社区：金融/研究
7. `glebis/claude-skills` - 社区：健康/认知

爬取流程：
1. 获取仓库 Stars 数
2. 列出技能目录
3. 读取每个技能的 `SKILL.md`
4. 解析 YAML frontmatter 提取名称和描述

### translator.py - 翻译器

翻译模式：
- **内置词典**：预定义 100+ 技能名称翻译 + 术语替换
- **AI 翻译**：调用兼容 OpenAI 格式的 API 进行全文翻译
- **翻译缓存**：自动缓存已翻译内容，避免重复调用

### run.py - 主程序

协调爬虫和翻译器，生成：
- `data/skills.json` - Web 页面数据
- `data/crawled_skills.json` - 原始爬取数据
- `data/translated_skills.json` - 翻译后数据
- `skills/*/README.md` - 各分类 README

## 热度评分算法

```
热度 = Stars 分数 (60%) + 来源权重 (30%) + 描述完整度 (10%)

Stars 分数 = (仓库 Stars / 最高 Stars) × 60
来源权重 = 来源系数 × 30
  - anthropics/skills: 1.0
  - cloudflare/vercel 等官方: 0.85-0.9
  - 社区仓库: 0.5
描述完整度 = 有描述 ? 10 : 0
```

## 输出示例

```
热度排行榜
====================
  1. [98] 🔥 Word 文档处理  (docx)
  2. [97] 🔥 PDF 文档处理  (pdf)
  3. [96] 🔥 Next.js 最佳实践  (next-best-practices)
  ...
```
