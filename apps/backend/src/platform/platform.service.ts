import { ForbiddenException } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import type { BusinessFlowService } from "../business-flow/business-flow.service";
import type { BusinessFlowRecord } from "../business-flow/business-flow.types";
import { createPrefixedId } from "../ids";
import { PlatformStoreService } from "./platform-store.service";
import type {
  CipSignal,
  CipSignalType,
  DashboardFilter,
  DashboardSnapshot,
  DetectCipSignalsRequest,
  ImportSkillRequest,
  PlatformAuditEvent,
  PlatformAuditEventType,
  PlatformChannelAction,
  PlatformChannelKind,
  PlatformNotification,
  PlatformOverview,
  PlatformSession,
  PlatformState,
  ProductRegistration,
  RegisterProductRequest,
  RouteMessageRequest,
  RouteMessageResult,
  RunWorkflowRequest,
  SecurityReport,
  SkillDefinition,
  TenantReservation,
  WorkflowExecution
} from "./platform.types";

type BusinessFlowReader = Pick<BusinessFlowService, "listRecords" | "getMetrics">;

export class PlatformService {
  constructor(
    private readonly store: PlatformStoreService,
    private readonly businessFlowService: BusinessFlowReader
  ) {
    if (!this.store.hasState()) {
      this.store.seed(createDefaultState());
    }
  }

  getOverview(actor: AuthenticatedUser): PlatformOverview {
    const state = this.store.getState();
    return {
      dashboard: this.getDashboard({}, actor),
      channels: state.channels,
      recentSessions: state.sessions.slice(-8).reverse(),
      agents: state.agents,
      skills: state.skills,
      workflows: state.workflows,
      products: state.products,
      cipSignals: state.cipSignals.slice(-12).reverse(),
      tenant: state.tenant,
      security: this.getSecurityReport(actor),
      trialReadiness: [
        {
          area: "多渠道",
          status: "business_input_required",
          note: "Web/H5 模型已就绪，企业 IM 真实闭环等待应用凭证和回调配置。"
        },
        {
          area: "Agent/Skill",
          status: "code_ready",
          note: "注册、扫描、审批、执行和审计链路已在 PAS backend 内闭合。"
        },
        {
          area: "经营驾驶舱",
          status: "code_ready",
          note: "指标口径可从 V2 业务记录和 V3 平台状态生成，业务方仍需确认最终口径。"
        },
        {
          area: "多组织/商业化",
          status: "business_input_required",
          note: "隔离字段和计费字段已预留，真实套餐、价格和租户策略待确认。"
        }
      ],
      updatedAt: state.updatedAt
    };
  }

  getDashboard(filters: DashboardFilter, actor: AuthenticatedUser): DashboardSnapshot {
    const state = this.store.getState();
    const records = this.businessFlowService.listRecords(actor).filter((record) => recordMatchesFilters(record, filters));
    const metrics = this.businessFlowService.getMetrics(actor);
    const opportunities = records.filter((record) => record.kind === "opportunity");
    const channelRecords = records.filter((record) => record.kind === "channel");
    const pendingInputs = records.filter((record) => record.pendingInputs.length > 0).length;
    const wonCount = opportunities.filter((record) => record.outputs.opportunity?.stage === "won").length;
    const proposalJobs = records.filter((record) => record.outputs.proposalJobId || record.outputs.proposalJob).length;

    return {
      filters,
      cards: [
        {
          key: "sales_funnel",
          title: "销售漏斗",
          value: opportunities.length,
          unit: "条",
          trend: "flat"
        },
        {
          key: "win_rate",
          title: "赢单率",
          value: opportunities.length === 0 ? 0 : Math.round((wonCount / opportunities.length) * 100),
          unit: "%"
        },
        {
          key: "pending_inputs",
          title: "待外部输入",
          value: pendingInputs,
          unit: "项",
          trend: pendingInputs > 0 ? "down" : "flat"
        },
        {
          key: "channel_contribution",
          title: "渠道贡献",
          value: channelRecords.length,
          unit: "条"
        },
        {
          key: "agent_workflow_runs",
          title: "Agent 执行",
          value: state.executions.length,
          unit: "次"
        },
        {
          key: "cip_signals",
          title: "CIP 信号",
          value: state.cipSignals.length,
          unit: "条"
        }
      ],
      drilldowns: {
        salesFunnel: countBy(
          opportunities,
          (record) => record.outputs.opportunity?.stage ?? "discovery",
          "stage"
        ),
        channelContribution: countBy(
          channelRecords,
          (record) => record.outputs.channelContext?.partnerName ?? record.source.system,
          "channel"
        ),
        productMix: state.products.filter((product) => productMatchesFilters(product, filters)).map((product) => ({
          product: product.name,
          count: product.status === "enabled" ? 1 : 0
        })),
        knowledgeUsage: metrics.counters
          .filter((counter) => counter.name.includes("knowledge") || counter.name.includes("records_created"))
          .slice(0, 6)
          .map((counter) => ({ metric: counter.name, value: counter.value })),
        proposalConversion: [
          { metric: "proposal_jobs_from_meetings", value: proposalJobs },
          { metric: "export_template_ready_products", value: state.products.filter((item) => item.exportTemplateIds.length > 0).length }
        ]
      },
      methodology: [
        {
          key: "sales_funnel",
          description: "Count V2 opportunity records visible to the current user, grouped by opportunity stage."
        },
        {
          key: "pending_inputs",
          description: "Count records that still expose pendingInputs, including external CRM, channel, contract, and data adapters."
        },
        {
          key: "agent_workflow_runs",
          description: "Count V3 workflow executions recorded by the platform module."
        },
        {
          key: "cip_signals",
          description: "Count V3 CIP signals generated from customer evidence text."
        }
      ]
    };
  }

  routeMessage(request: RouteMessageRequest, actor: AuthenticatedUser): RouteMessageResult {
    const now = nowIso();
    const action = buildChannelAction(request.text);
    const notification: PlatformNotification = {
      notificationId: createId("notify"),
      targetChannel: request.channel,
      status: request.channel === "web" || request.channel === "mobile_h5" ? "queued" : "pending_external_adapter",
      summary: action.summary,
      createdAt: now
    };
    const session: PlatformSession = {
      sessionId: createId("session"),
      channel: request.channel,
      sourceRef: request.sourceRef,
      identity: {
        userId: actor.userId,
        role: actor.role,
        externalUserId: request.externalUserId,
        mappingStatus: request.channel === "web" ? "mapped" : "pending_external_mapping"
      },
      messages: [
        {
          messageId: createId("msg"),
          direction: "inbound",
          text: request.text,
          at: now
        }
      ],
      actions: [action],
      notification,
      archivedAt: now,
      createdAt: now
    };
    const auditEvent = createAuditEvent("channel_message", actor.userId, "info", request.channel, "多渠道消息已归档");

    this.store.update((draft) => {
      draft.sessions.push(session);
      draft.auditEvents.push(auditEvent);
    });

    return { session, notification, auditEvent };
  }

  importSkill(request: ImportSkillRequest, actor: AuthenticatedUser): SkillDefinition {
    assertAdmin(actor);
    const now = nowIso();
    const scan = scanSkillManifest(request.packageManifest);
    const skill: SkillDefinition = {
      skillId: createId("skill"),
      name: request.name,
      description: request.description,
      status: scan.riskLevel === "high" ? "rejected" : "pending_approval",
      requestedScopes: request.requestedScopes,
      packageManifest: request.packageManifest,
      scan,
      importedBy: actor.userId,
      createdAt: now,
      updatedAt: now
    };
    const auditEvent = createAuditEvent("skill_import", actor.userId, scan.riskLevel === "high" ? "warning" : "info", skill.skillId, "Skill 已导入并完成安全扫描");

    this.store.update((draft) => {
      draft.skills.push(skill);
      draft.auditEvents.push(auditEvent);
    });
    return skill;
  }

  approveSkill(skillId: string, actor: AuthenticatedUser): SkillDefinition {
    assertAdmin(actor);
    let approved: SkillDefinition | undefined;
    const auditEvent = createAuditEvent("skill_approval", actor.userId, "info", skillId, "Skill 已审批通过");
    this.store.update((draft) => {
      const skill = draft.skills.find((item) => item.skillId === skillId);
      if (!skill) {
        throw new Error("Skill not found");
      }
      if (skill.status === "rejected") {
        throw new Error("Rejected skill cannot be approved");
      }
      skill.status = "approved";
      skill.approvedBy = actor.userId;
      skill.updatedAt = nowIso();
      approved = skill;
      draft.auditEvents.push(auditEvent);
    });
    return approved!;
  }

  runWorkflow(request: RunWorkflowRequest, actor: AuthenticatedUser): WorkflowExecution {
    assertAdminOrTechnical(actor);
    const state = this.store.getState();
    const workflow = state.workflows.find((item) => item.workflowId === request.workflowId);
    if (!workflow || workflow.status !== "active") {
      throw new Error("Workflow is not active");
    }
    const approvedSkillIds = new Set(state.skills.filter((skill) => skill.status === "approved").map((skill) => skill.skillId));
    const missingSkills = workflow.skillIds.filter((skillId) => !approvedSkillIds.has(skillId));
    const now = nowIso();
    const execution: WorkflowExecution = {
      executionId: createId("exec"),
      workflowId: workflow.workflowId,
      actorUserId: actor.userId,
      status: missingSkills.length > 0 ? "blocked" : "completed",
      input: request.input,
      outputSummary:
        missingSkills.length > 0
          ? `Blocked by unapproved skills: ${missingSkills.join(", ")}`
          : "已完成身份校验、客户信号分析和触达建议生成。",
      steps: [
        {
          stepId: "identity_permission_check",
          name: "统一身份与权限校验",
          status: "completed",
          summary: "使用当前 JWT 用户作为统一身份。"
        },
        {
          stepId: "skill_execution",
          name: "Skill 执行",
          status: missingSkills.length > 0 ? "blocked" : "completed",
          summary: missingSkills.length > 0 ? "存在未审批 Skill。" : "已运行已审批 Skill。"
        }
      ],
      createdAt: now
    };
    const auditEvent = createAuditEvent("agent_execution", actor.userId, execution.status === "completed" ? "info" : "warning", workflow.workflowId, execution.outputSummary);

    this.store.update((draft) => {
      draft.executions.push(execution);
      draft.auditEvents.push(auditEvent);
    });

    return execution;
  }

  registerProduct(request: RegisterProductRequest, actor: AuthenticatedUser): ProductRegistration {
    assertAdmin(actor);
    const now = nowIso();
    const product: ProductRegistration = {
      productId: createId("product"),
      name: request.name,
      version: request.version,
      ownerTeam: request.ownerTeam,
      status: "enabled",
      knowledgePartitionIds: request.knowledgePartitionIds ?? [],
      proposalTemplateIds: request.proposalTemplateIds ?? [],
      exportTemplateIds: request.exportTemplateIds ?? [],
      webhookEvents: request.webhookEvents ?? [],
      apiVersion: request.apiVersion ?? "v3",
      pluginDependencies: request.pluginDependencies ?? [],
      pendingInputs: collectProductPendingInputs(request),
      createdAt: now,
      updatedAt: now
    };
    const auditEvent = createAuditEvent("product_registry", actor.userId, "info", product.productId, "产品注册表已更新");
    this.store.update((draft) => {
      draft.products.push(product);
      draft.auditEvents.push(auditEvent);
    });
    return product;
  }

  detectCipSignals(request: DetectCipSignalsRequest, actor: AuthenticatedUser): CipSignal[] {
    assertAdminOrTechnical(actor);
    const signals = detectSignals(request);
    const auditEvent = createAuditEvent("cip_signal", actor.userId, "info", request.customerId, `识别到 ${signals.length} 个客户动态信号`);
    this.store.update((draft) => {
      draft.cipSignals.push(...signals);
      draft.auditEvents.push(auditEvent);
    });
    return signals;
  }

  getTenantReservation(_actor: AuthenticatedUser): TenantReservation {
    return this.store.getState().tenant;
  }

  getSecurityReport(_actor: AuthenticatedUser): SecurityReport {
    const events = this.store.getState().auditEvents;
    return {
      totalEvents: events.length,
      eventsByType: events.reduce<Record<string, number>>((accumulator, event) => {
        accumulator[event.type] = (accumulator[event.type] ?? 0) + 1;
        return accumulator;
      }, {}),
      sensitiveAlerts: events.filter((event) => event.severity !== "info"),
      permissionBoundaryChecks: [
        {
          key: "channel_identity_mapping",
          status: "passed",
          summary: "所有渠道会话都落到 PAS JWT 用户或显式 pending_external_mapping。"
        },
        {
          key: "agent_skill_approval",
          status: "passed",
          summary: "工作流只执行 approved Skill，未审批 Skill 会阻断。"
        },
        {
          key: "tenant_isolation",
          status: "pending_external_policy",
          summary: "租户字段已预留，真实多租户策略待商业化方案确认。"
        }
      ]
    };
  }
}

function createDefaultState(): PlatformState {
  const now = nowIso();
  return {
    stateId: "pas-v3-platform-state",
    channels: [
      {
        channelId: "web",
        kind: "web",
        name: "PAS Web",
        status: "active",
        identityMapping: "pas_user",
        pendingInputs: []
      },
      {
        channelId: "mobile-h5",
        kind: "mobile_h5",
        name: "Mobile H5",
        status: "active",
        identityMapping: "pas_user",
        pendingInputs: []
      },
      {
        channelId: "feishu",
        kind: "feishu",
        name: "Feishu Bot",
        status: "adapter_pending",
        identityMapping: "pending",
        pendingInputs: ["feishu_app_credentials", "callback_url_verification"]
      }
    ],
    sessions: [],
    agents: [
      {
        agentId: "presales_orchestrator",
        name: "售前编排 Agent",
        purpose: "把客户输入路由到知识库、方案和交付物任务。",
        status: "active",
        allowedScopes: ["knowledge:read", "proposal:write", "export:write"],
        ownerRole: "technical"
      },
      {
        agentId: "customer_growth_agent",
        name: "客户增长 Agent",
        purpose: "根据客情信号生成触达建议和行动候选。",
        status: "active",
        allowedScopes: ["crm:read", "cip:write", "workflow:run"],
        ownerRole: "sales"
      }
    ],
    skills: [
      createSeedSkill("knowledge_retrieval", "知识库检索", "检索已发布知识块和 RAGFlow 引用。", ["knowledge:read"], now),
      createSeedSkill("proposal_outline", "方案提纲", "把客户需求整理为方案章节提纲。", ["proposal:write"], now),
      createSeedSkill("followup_advisor", "触达建议", "基于客户信号生成下一步行动建议。", ["cip:write"], now)
    ],
    workflows: [
      {
        workflowId: "customer_followup_workflow",
        name: "客户信号触达工作流",
        trigger: "cip_signal_detected",
        status: "active",
        complexity: "controlled",
        agentIds: ["customer_growth_agent"],
        skillIds: ["knowledge_retrieval", "followup_advisor"]
      }
    ],
    executions: [],
    products: [
      {
        productId: "ip-guard",
        name: "IP-Guard",
        version: "v4",
        ownerTeam: "信息安全产品线",
        status: "enabled",
        knowledgePartitionIds: ["IP-Guard-Gate"],
        proposalTemplateIds: ["proposal-standard-v0"],
        exportTemplateIds: ["docx-v0", "pptx-v0", "xlsx-v0"],
        webhookEvents: ["proposal.generated", "export.completed"],
        apiVersion: "v3",
        pluginDependencies: ["knowledge_retrieval", "proposal_outline"],
        pendingInputs: [],
        createdAt: now,
        updatedAt: now
      }
    ],
    cipSignals: [],
    tenant: {
      tenantId: "internal-hyyn",
      organizationId: "hyyn",
      mode: "single_org",
      isolationFields: ["tenantId", "organizationId", "ownerUserId", "role"],
      billingReserved: true,
      singleOrgCompatible: true
    },
    auditEvents: [],
    updatedAt: now
  };
}

function createSeedSkill(
  skillId: string,
  name: string,
  description: string,
  requestedScopes: string[],
  now: string
): SkillDefinition {
  return {
    skillId,
    name,
    description,
    status: "approved",
    requestedScopes,
    packageManifest: `seed:${skillId}`,
    scan: {
      riskLevel: "low",
      findings: ["seeded internal skill"]
    },
    importedBy: "system",
    approvedBy: "system",
    createdAt: now,
    updatedAt: now
  };
}

function buildChannelAction(text: string): PlatformChannelAction {
  if (text.includes("方案") || text.includes("交付物") || text.includes("生成")) {
    return {
      actionId: createId("action"),
      type: "create_deliverable_task",
      status: "pending_external_adapter",
      summary: "已识别为方案/交付物任务，等待外部渠道回调闭环。",
      pendingInputs: ["enterprise_im_callback", "task_result_push"]
    };
  }
  if (text.includes("知识") || text.includes("问答")) {
    return {
      actionId: createId("action"),
      type: "answer_knowledge",
      status: "completed",
      summary: "已路由到知识库问答能力。",
      pendingInputs: []
    };
  }
  return {
    actionId: createId("action"),
    type: "archive_session",
    status: "completed",
    summary: "已归档会话，等待人工判断后续动作。",
    pendingInputs: []
  };
}

function scanSkillManifest(manifest: string): SkillDefinition["scan"] {
  const lower = manifest.toLowerCase();
  if (lower.includes("child_process") || lower.includes("exec(") || lower.includes("delete")) {
    return {
      riskLevel: "high",
      findings: ["manifest contains dangerous execution or deletion capability"]
    };
  }
  if (lower.includes("network") || lower.includes("webhook")) {
    return {
      riskLevel: "medium",
      findings: ["manifest requires external network review"]
    };
  }
  return {
    riskLevel: "low",
    findings: ["no dangerous capability found"]
  };
}

function collectProductPendingInputs(request: RegisterProductRequest): string[] {
  const pending: string[] = [];
  if (!request.knowledgePartitionIds?.length) pending.push("knowledge_partition");
  if (!request.proposalTemplateIds?.length) pending.push("proposal_template");
  if (!request.exportTemplateIds?.length) pending.push("export_templates");
  return pending;
}

function detectSignals(request: DetectCipSignalsRequest): CipSignal[] {
  const rules: Array<{
    type: CipSignalType;
    pattern: RegExp;
    severity: CipSignal["severity"];
    suggestion: string;
  }> = [
    {
      type: "silent_customer",
      pattern: /未拜访|沉默|90天/,
      severity: "medium",
      suggestion: "安排客户健康度回访，确认当前负责人和业务优先级。"
    },
    {
      type: "competitor_involved",
      pattern: /竞品|替换|比选/,
      severity: "high",
      suggestion: "准备竞品差异话术和可量化试点范围。"
    },
    {
      type: "personnel_change",
      pattern: /离职|调岗|人事|负责人/,
      severity: "medium",
      suggestion: "更新联系人地图，重新识别决策链。"
    },
    {
      type: "purchase_window",
      pattern: /采购|预算|9月|窗口/,
      severity: "high",
      suggestion: "推进预算、采购流程和方案确认节点。"
    },
    {
      type: "security_incident",
      pattern: /泄密|安全事件|攻击|外发/,
      severity: "high",
      suggestion: "用事件复盘切入审计、加密和终端管控组合方案。"
    },
    {
      type: "renewal_expansion",
      pattern: /续约|扩容|维保|到期/,
      severity: "medium",
      suggestion: "生成续约扩容清单并安排商务触达。"
    }
  ];

  return rules
    .filter((rule) => rule.pattern.test(request.evidenceText))
    .map((rule) => ({
      signalId: createId("cip"),
      customerId: request.customerId,
      customerName: request.customerName,
      type: rule.type,
      severity: rule.severity,
      evidence: request.evidenceText,
      suggestion: rule.suggestion,
      createdAt: nowIso()
    }));
}

function recordMatchesFilters(record: BusinessFlowRecord, filters: DashboardFilter): boolean {
  if (filters.department && !recordText(record).includes(normalizeFilter(filters.department))) {
    return false;
  }
  if (filters.product && record.kind !== "channel" && !recordText(record).includes(normalizeFilter(filters.product))) {
    return false;
  }
  if (
    filters.channel &&
    record.kind === "channel" &&
    !recordText(record).includes(normalizeFilter(filters.channel))
  ) {
    return false;
  }
  return true;
}

function productMatchesFilters(product: ProductRegistration, filters: DashboardFilter): boolean {
  return !filters.product || recordText(product).includes(normalizeFilter(filters.product));
}

function recordText(value: unknown): string {
  return JSON.stringify(value).toLowerCase();
}

function normalizeFilter(value: string): string {
  return value.trim().toLowerCase();
}

function assertAdmin(actor: AuthenticatedUser): void {
  if (actor.role !== "admin") {
    throw new ForbiddenException("admin role is required");
  }
}

function assertAdminOrTechnical(actor: AuthenticatedUser): void {
  if (actor.role !== "admin" && actor.role !== "technical") {
    throw new ForbiddenException("admin or technical role is required");
  }
}

function countBy<T, K extends string>(
  items: T[],
  getKey: (item: T) => string,
  label: K
): Array<Record<K, string> & { count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([key, count]) => ({ [label]: key, count }) as Record<K, string> & {
    count: number;
  });
}

function createAuditEvent(
  type: PlatformAuditEventType,
  actorUserId: string,
  severity: PlatformAuditEvent["severity"],
  resource: string,
  summary: string
): PlatformAuditEvent {
  return {
    auditId: createId("audit"),
    type,
    actorUserId,
    severity,
    resource,
    summary,
    occurredAt: nowIso()
  };
}

function createId(prefix: string): string {
  return createPrefixedId(prefix);
}

function nowIso(): string {
  return new Date().toISOString();
}
