# SkillCN - Claude Code 技能中文收集站

收集、翻译并分类展示 Claude Code / Agent Skills 的中文资源库。

## 项目简介

[Agent Skills](https://github.com/anthropics/skills) 是 Anthropic 推出的技能扩展系统，允许用户通过 `SKILL.md` 文件为 Claude 添加专业领域知识和工作流程。目前社区中已有 500+ 个技能，但几乎全部为英文。

**SkillCN** 旨在：
- 收集主流技能仓库中的优质技能
- 将技能信息翻译为中文
- 按功能分类整理
- 提供按热度和分类排序的 Web 浏览页面

## 技能分类

| 分类 | 说明 | 数量 |
|------|------|------|
| 🏢 官方技能 | Anthropic 官方发布的技能 | 16 |
| 🔧 开发工具 | 代码质量、测试、构建等开发工具 | 12 |
| 🏗️ 基础设施 | 云平台、数据库、DevOps 工具 | 25 |
| 🌐 Web 开发 | 前端框架、部署、性能优化 | 30 |
| 🎨 设计工具 | UI/UX 设计、组件库、视觉工具 | 8 |
| 🔒 安全审计 | 安全测试、代码审计、漏洞扫描 | 5 |
| 🏭 企业办公 | Google Workspace、协作、通讯 | 30 |
| 🤖 AI/ML | 模型训练、评估、数据集管理 | 10 |
| 👥 社区精选 | 社区开发者贡献的优质技能 | 15 |

## 在线浏览

打开 `index.html` 即可在浏览器中浏览所有技能，支持：
- 按分类筛选
- 按热度排序
- 关键词搜索
- 查看技能详情与安装方式

## 技能来源

- [anthropics/skills](https://github.com/anthropics/skills) - Anthropic 官方技能仓库
- [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) - 500+ 技能合集
- [travisvn/awesome-claude-skills](https://github.com/travisvn/awesome-claude-skills) - 精选技能列表
- [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) - 192+ 技能合集

## 如何安装技能

### 项目级别安装
```bash
# 在项目根目录下
mkdir -p .claude/skills
# 将技能文件夹复制到 .claude/skills/ 目录
```

### 个人级别安装
```bash
# 在用户目录下
mkdir -p ~/.claude/skills
# 将技能文件夹复制到 ~/.claude/skills/ 目录
```

## 贡献指南

欢迎提交 PR 来：
- 添加新的技能翻译
- 修正翻译错误
- 补充技能分类信息

## 许可证

MIT License
