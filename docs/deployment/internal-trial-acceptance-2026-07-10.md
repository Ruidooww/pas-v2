# PAS V0 内网试运行验收单 - 2026-07-12

## 验收结论

当前代码、容器、权限模型、AI 模型接入代码和历史 50 题技术运行已通过本机技术
预检，但 **尚未获得正式试运行放行**。实际多用户内网入口仍需完成 HTTPS、
RAGFlow 文档元数据登记和真实模型激活；随后必须重新执行 50 题，由技术部审核人
逐题确认，并将审核结论提交到回归门禁接口，得到 `gateStatus=passed` 和
`canGoLive=true`。

## 试运行边界

- 目标环境：公司内网试运行；`http://127.0.0.1:18000` 仅为当前本机预检入口，
  不是其他内网用户的正式入口。
- 应用代码基线：`7bbaa1c5065d28b683305b6f335e073c93b88da3`。后续验收证据提交只修改文档。
- PAS 只维护 `HYYN-frontend`、`HYYN-backend`、`HYYN-postgres`、
  `HYYN-redis` 四个容器。
- RAGFlow 为外部依赖，当前使用 `real` 模式。
- CRM 暂缓，当前继续使用 `mock` 数据。
- 导出先使用镜像内置的当前系统模板，后续由业务方提供品牌模板替换；当前系统
  模板只获得本次内网试运行使用确认，不等同于正式品牌模板批准。
- 技术部统一维护知识库；技术部下设售前、技术、售后三个团队。
- 当前权限模板沿用默认模型，不增加试运行专用权限分支。

## 验收证据

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| 单元测试 | 通过 | backend `67` files / `364` tests；frontend `16` files / `73` tests |
| 类型检查 | 通过 | `pnpm typecheck` |
| 构建 | 通过 | `pnpm build`；37 个 JavaScript chunk，入口约 `164.07 kB`，最大共享 chunk 约 `527.72 kB`，原 800 kB 告警已消除 |
| Compose 合同 | 通过 | `pnpm compose:config`；仅四个 PAS 服务 |
| 菜单 smoke | 通过 | `pnpm test:smoke` 和真实栈 smoke；6 个一级菜单、24 个可见二级菜单 |
| 容器健康 | 通过 | 四个 HYYN 容器均为 `healthy` |
| API 健康 | 通过 | `/api/health=ok`、`/api/ragflow/health=ok` |
| V0 真实 smoke | 通过 | 不使用 `-AllowMissingExportTemplates`；登录、RAGFlow、CRM mock、QA、客户分析、方案、三格式导出和反馈均通过 |
| 当前导出模板 | 通过，限试运行 | 容器内 `proposal.docx`、`proposal.pptx`、`proposal.xlsx` 均存在，真实 smoke 已完成导出 |
| 浏览器检查 | 通过 | `1280x720` 与 `390x844` 无横向溢出、标签裁切或控件重叠 |
| 权限 smoke | 通过 | 技术部三个子团队可维护文档；销售写入被拒绝；项目授权读取与无关用户隔离生效 |
| 本地密钥配置 | 通过 | `.env` 已持久化 `REDIS_PASSWORD`；Compose 与运行容器关键配置一致，不记录密钥值 |
| AI 模型接入代码 | 通过 | 管理员菜单/API、加密持久化、白名单、HTTPS 写保护、RAGFlow 只读状态、QA/客户分析/方案生成和降级审计均已验证；独立复审结论为可合并 |
| AI 模型部署配置 | **待完成** | 当前 `.env` 仍为 `LLM_CLIENT_MODE=mock`，且未持久化 `MODEL_CONFIG_ENCRYPTION_KEY`、`MODEL_ENDPOINT_ALLOWLIST` 和真实 API Key |
| 历史 50 题技术运行 | 通过，仅作预检 | 旧基线 50 个唯一批准题目：`answered=50`、`no_hit=0`、`error=0`、引用 `250` 条 |
| 最终 50 题技术运行 | **待完成** | HTTPS、51 份文档元数据和真实模型配置固定后，基于 `7bbaa1c` 应用代码重新执行 |
| 50 题人工审核 | **待完成** | 审核人为技术部审核人；必须审核最终重跑材料，现有旧材料 50 题均为 `human_review_result=pending` |
| 回归门禁入库 | **待完成** | 人工审核后提交 `/api/internal/regression-runs`，必须返回 `gateStatus=passed`、`canGoLive=true` |
| 内网 HTTPS 入口 | **待完成** | 实际多用户入口必须终止 HTTPS，设置 `COOKIE_SECURE=true` 并按真实代理层数复测 |

## 50 题审核材料

以下材料保留在本机 Git 忽略目录，不包含在代码提交中：

- `temp/regression/PAS-V0-50题技术运行-2026-07-10.json`
- `temp/regression/PAS-V0-50题审核底稿-2026-07-10.md`

这两份材料记录模型接入前的历史技术预检。它们可用于对照，但不得直接作为
`7bbaa1c` 应用代码和真实模型配置的最终放行材料。

技术运行材料满足以下完整性检查：

- 恰好 50 条结果，`question_id` 全部唯一；
- 50 条候选题均为 `review_status=approved`；
- 50 条结果全部绑定当前数据集和指定审核人；
- 每题保留技术回答、引用详情、运行耗时和失败原因字段；
- 50 条人工审核结论和审核时间均保持待填写状态；
- 审核底稿包含 50 个逐题证据区块。

技术运行只证明检索和回答链路可用，不证明答案内容正确。审核人必须逐题核对：

1. 回答是否覆盖 `expected_intent`；
2. 引用是否直接支持回答中的关键结论；
3. 是否存在不受证据支持的承诺、参数或产品能力；
4. 不通过时填写明确失败原因；
5. 记录逐题审核结论和审核时间。

审核完成后，提交 `POST /api/internal/regression-runs`。请求体必须包含
`name`、`owner`、`approver`、`requiredCaseCount=50` 和恰好 50 条 `cases`。
逐题字段按以下规则映射：

- `questionId` 取本地材料的 `question_id`；
- `question` 取本地材料的 `question`；
- `expectedEvidence` 取本地材料的 `expected_intent`；
- `passed` 仅在 `human_review_result=passed` 时设为 `true`；
- `failureReason` 记录人工审核不通过原因。

少于或多于 50 题、重复题号、空题号、空问题或空 `expectedEvidence` 都应得到
`gateStatus=blocked`；任何一题 `passed=false` 都应得到
`gateStatus=failed`。不得通过修改技术运行记录绕过门禁。

## 本机 HTTP 与内网 HTTPS 边界

本次入口没有 TLS，因此本机 `.env` 使用 `COOKIE_SECURE=false`，以保证浏览器
能够在 HTTP 环境发送会话 Cookie。该配置只允许用于 `127.0.0.1` 本机预检，
不得作为其他内网用户的试运行入口。实际内网入口必须先接入 HTTPS 终止代理，
改为 `COOKIE_SECURE=true`，并按实际代理层数设置 `TRUST_PROXY_HOPS`；随后重新
创建 backend 容器并复测登录、CSRF、客户端 IP 识别和限流行为。

## 本机启动与复核

```powershell
docker compose --env-file .env config --services
docker compose --env-file .env up -d
docker compose --env-file .env ps

Invoke-RestMethod http://127.0.0.1:18000/api/health
Invoke-RestMethod http://127.0.0.1:18000/api/ragflow/health
```

试运行前重新执行：

```powershell
pnpm test
pnpm typecheck
pnpm build
pnpm compose:config
pnpm test:smoke
pnpm smoke:local -- --base-url http://127.0.0.1:18000
```

## 回滚

应用回滚只切换到上一个已验证镜像标签，不删除 PostgreSQL、Redis 或 RAGFlow
数据卷：

```powershell
notepad .env
# 将 PAS_BACKEND_IMAGE 和 PAS_FRONTEND_IMAGE 改回上一个已验证的 commit SHA tag。

docker compose --env-file .env pull pas-backend pas-frontend
docker compose --env-file .env up -d pas-backend pas-frontend
docker compose --env-file .env ps
```

回滚后重新执行 `scripts/smoke-v0.ps1`。禁止运行
`docker compose down -v`，数据库数据变更需按已批准备份执行人工恢复。

## 签字

| 角色 | 姓名 | 结论 | 时间 | 备注 |
| --- | --- | --- | --- | --- |
| 技术部审核人 | 待填写 | 待填写 | 待填写 | 完成 50 题逐题审核后填写 |
| 试运行负责人 | 待填写 | 待填写 | 待填写 | 仅在回归门禁通过后签字 |
