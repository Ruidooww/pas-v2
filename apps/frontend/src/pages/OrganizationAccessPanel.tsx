import { PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert, Button, Input, Select, Spin, Switch, Tag, Tooltip, Tree, Typography } from "antd";
import type { TreeProps } from "antd";
import { api } from "../api";
import type { OrganizationCatalog, OrganizationUnit, OrganizationUnitKind, ProjectGroup } from "../types";

type OrganizationAccessPanelProps = {
  onCatalogChange(catalog: OrganizationCatalog): void;
};

type NewUnitDraft = {
  name: string;
  kind: Exclude<OrganizationUnitKind, "company">;
  parentUnitId: string;
};

const EMPTY_UNIT_DRAFT: NewUnitDraft = {
  name: "",
  kind: "team",
  parentUnitId: "org-company"
};

const UNIT_KIND_OPTIONS = [
  { label: "department", value: "department" },
  { label: "team", value: "team" }
];

export function OrganizationAccessPanel({ onCatalogChange }: OrganizationAccessPanelProps) {
  const [units, setUnits] = useState<OrganizationUnit[]>([]);
  const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([]);
  const [unitNames, setUnitNames] = useState<Record<string, string>>({});
  const [groupNames, setGroupNames] = useState<Record<string, string>>({});
  const [newUnit, setNewUnit] = useState<NewUnitDraft>(EMPTY_UNIT_DRAFT);
  const [newProjectGroupName, setNewProjectGroupName] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshCatalog();
  }, []);

  const treeData = useMemo(
    () => buildUnitTree(units, (unit) => renderUnitRow(unit)),
    [units, unitNames, savingKey]
  );

  return (
    <section className="organization-access-panel" aria-labelledby="organization-access-title">
      <div className="organization-access-heading">
        <div>
          <Typography.Title id="organization-access-title" level={4}>组织与项目权限</Typography.Title>
          <Typography.Text type="secondary">维护技术部层级、项目组及账号成员范围。</Typography.Text>
        </div>
        <div className="organization-access-counts">
          <Tag>{units.filter((unit) => unit.active).length} active units</Tag>
          <Tag>{projectGroups.filter((group) => group.active).length} active groups</Tag>
        </div>
      </div>

      {error && <Alert type="error" showIcon title={error} closable onClose={() => setError(null)} />}

      {loading ? (
        <div className="system-loading"><Spin /></div>
      ) : (
        <div className="organization-access-grid">
          <div className="organization-admin-section">
            <div className="organization-section-heading">
              <Typography.Title level={5}>组织层级</Typography.Title>
              <Typography.Text type="secondary">停用后立即撤销相关角色与文档范围。</Typography.Text>
            </div>

            <div className="organization-create-row organization-create-unit">
              <Input
                aria-label="新组织名称"
                placeholder="新组织名称"
                value={newUnit.name}
                onChange={(event) => setNewUnit((current) => ({ ...current, name: event.target.value }))}
              />
              <Select
                aria-label="父级组织"
                virtual={false}
                options={units.filter((unit) => unit.active).map((unit) => ({ label: unit.name, value: unit.unitId }))}
                value={newUnit.parentUnitId}
                onChange={(parentUnitId) => setNewUnit((current) => ({ ...current, parentUnitId }))}
              />
              <Select
                aria-label="组织类型"
                virtual={false}
                options={UNIT_KIND_OPTIONS}
                value={newUnit.kind}
                onChange={(kind) => setNewUnit((current) => ({ ...current, kind }))}
              />
              <Tooltip title="创建组织单元">
                <Button
                  aria-label="创建组织单元"
                  icon={<PlusOutlined />}
                  loading={savingKey === "new-unit"}
                  disabled={!newUnit.name.trim() || !newUnit.parentUnitId}
                  onClick={() => void createUnit()}
                />
              </Tooltip>
            </div>

            <Tree blockNode defaultExpandAll selectable={false} treeData={treeData} />
          </div>

          <div className="organization-admin-section">
            <div className="organization-section-heading">
              <Typography.Title level={5}>项目组</Typography.Title>
              <Typography.Text type="secondary">项目组用于跨部门文档授权。</Typography.Text>
            </div>

            <div className="organization-create-row organization-create-group">
              <Input
                aria-label="新项目组名称"
                placeholder="新项目组名称"
                value={newProjectGroupName}
                onChange={(event) => setNewProjectGroupName(event.target.value)}
              />
              <Tooltip title="创建项目组">
                <Button
                  aria-label="创建项目组"
                  icon={<PlusOutlined />}
                  loading={savingKey === "new-project-group"}
                  disabled={!newProjectGroupName.trim()}
                  onClick={() => void createProjectGroup()}
                />
              </Tooltip>
            </div>

            <div className="organization-group-list">
              {projectGroups.map((group) => (
                <div className="organization-record-row" key={group.projectGroupId}>
                  <div className="organization-record-label">
                    <Typography.Text strong>{group.name}</Typography.Text>
                    <Tag color={group.active ? "green" : "default"}>{group.active ? "active" : "disabled"}</Tag>
                  </div>
                  <div className="organization-record-controls">
                    <Input
                      aria-label={`${group.name} 名称`}
                      value={groupNames[group.projectGroupId] ?? group.name}
                      onChange={(event) =>
                        setGroupNames((current) => ({ ...current, [group.projectGroupId]: event.target.value }))
                      }
                    />
                    <Tooltip title="保存名称">
                      <Button
                        aria-label={`${group.name} 保存名称`}
                        icon={<SaveOutlined />}
                        loading={savingKey === `group-name:${group.projectGroupId}`}
                        disabled={!(groupNames[group.projectGroupId] ?? group.name).trim()}
                        onClick={() => void updateProjectGroup(group, { name: groupNames[group.projectGroupId] ?? group.name }, "name")}
                      />
                    </Tooltip>
                    <Switch
                      aria-label={`${group.name} 启用`}
                      checked={group.active}
                      loading={savingKey === `group-active:${group.projectGroupId}`}
                      onChange={(active) => void updateProjectGroup(group, { active }, "active")}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );

  function renderUnitRow(unit: OrganizationUnit): ReactNode {
    return (
      <div className="organization-record-row organization-tree-row">
        <div className="organization-record-label">
          <Typography.Text strong>{unit.name}</Typography.Text>
          <Tag>{unit.kind}</Tag>
          <Tag color={unit.active ? "green" : "default"}>{unit.active ? "active" : "disabled"}</Tag>
        </div>
        <div className="organization-record-controls">
          <Input
            aria-label={`${unit.name} 名称`}
            value={unitNames[unit.unitId] ?? unit.name}
            onChange={(event) => setUnitNames((current) => ({ ...current, [unit.unitId]: event.target.value }))}
          />
          <Tooltip title="保存名称">
            <Button
              aria-label={`${unit.name} 保存名称`}
              icon={<SaveOutlined />}
              loading={savingKey === `unit-name:${unit.unitId}`}
              disabled={!(unitNames[unit.unitId] ?? unit.name).trim()}
              onClick={() => void updateUnit(unit, { name: unitNames[unit.unitId] ?? unit.name }, "name")}
            />
          </Tooltip>
          <Switch
            aria-label={`${unit.name} 启用`}
            checked={unit.active}
            disabled={unit.unitId === "org-company"}
            loading={savingKey === `unit-active:${unit.unitId}`}
            onChange={(active) => void updateUnit(unit, { active }, "active")}
          />
        </div>
      </div>
    );
  }

  async function refreshCatalog(): Promise<void> {
    setLoading(true);
    setError(null);
    const [unitResult, groupResult] = await Promise.allSettled([
      api<OrganizationUnit[]>("/api/internal/organization/units"),
      api<ProjectGroup[]>("/api/internal/organization/project-groups")
    ]);
    const nextUnits = unitResult.status === "fulfilled" && Array.isArray(unitResult.value) ? unitResult.value : [];
    const nextProjectGroups =
      groupResult.status === "fulfilled" && Array.isArray(groupResult.value) ? groupResult.value : [];
    setUnits(nextUnits);
    setProjectGroups(nextProjectGroups);
    onCatalogChange({ units: nextUnits, projectGroups: nextProjectGroups });
    const failure =
      unitResult.status === "rejected"
        ? unitResult.reason
        : groupResult.status === "rejected"
          ? groupResult.reason
          : !Array.isArray(unitResult.value) || !Array.isArray(groupResult.value)
            ? new Error("组织权限数据格式无效")
            : null;
    if (failure) setError(toErrorMessage(failure, "组织权限加载失败"));
    setLoading(false);
  }

  async function createUnit(): Promise<void> {
    setSavingKey("new-unit");
    setError(null);
    try {
      const created = await api<OrganizationUnit>("/api/internal/organization/units", {
        method: "POST",
        body: { ...newUnit, name: newUnit.name.trim() }
      });
      replaceUnits([...units, created]);
      setNewUnit((current) => ({ ...current, name: "" }));
    } catch (err) {
      setError(toErrorMessage(err, "组织单元创建失败"));
    } finally {
      setSavingKey(null);
    }
  }

  async function updateUnit(unit: OrganizationUnit, patch: { name?: string; active?: boolean }, field: "name" | "active"): Promise<void> {
    setSavingKey(`unit-${field}:${unit.unitId}`);
    setError(null);
    try {
      const updated = await api<OrganizationUnit>(`/api/internal/organization/units/${unit.unitId}`, {
        method: "PATCH",
        body: patch.name === undefined ? patch : { ...patch, name: patch.name.trim() }
      });
      replaceUnits(units.map((item) => (item.unitId === updated.unitId ? updated : item)));
      if (field === "name") {
        setUnitNames((current) => {
          const next = { ...current };
          delete next[unit.unitId];
          return next;
        });
      }
    } catch (err) {
      setError(toErrorMessage(err, "组织单元更新失败"));
    } finally {
      setSavingKey(null);
    }
  }

  async function createProjectGroup(): Promise<void> {
    setSavingKey("new-project-group");
    setError(null);
    try {
      const created = await api<ProjectGroup>("/api/internal/organization/project-groups", {
        method: "POST",
        body: { name: newProjectGroupName.trim() }
      });
      replaceProjectGroups([...projectGroups, created]);
      setNewProjectGroupName("");
    } catch (err) {
      setError(toErrorMessage(err, "项目组创建失败"));
    } finally {
      setSavingKey(null);
    }
  }

  async function updateProjectGroup(group: ProjectGroup, patch: { name?: string; active?: boolean }, field: "name" | "active"): Promise<void> {
    setSavingKey(`group-${field}:${group.projectGroupId}`);
    setError(null);
    try {
      const updated = await api<ProjectGroup>(`/api/internal/organization/project-groups/${group.projectGroupId}`, {
        method: "PATCH",
        body: patch.name === undefined ? patch : { ...patch, name: patch.name.trim() }
      });
      replaceProjectGroups(projectGroups.map((item) => (item.projectGroupId === updated.projectGroupId ? updated : item)));
      if (field === "name") {
        setGroupNames((current) => {
          const next = { ...current };
          delete next[group.projectGroupId];
          return next;
        });
      }
    } catch (err) {
      setError(toErrorMessage(err, "项目组更新失败"));
    } finally {
      setSavingKey(null);
    }
  }

  function replaceUnits(nextUnits: OrganizationUnit[]): void {
    setUnits(nextUnits);
    onCatalogChange({ units: nextUnits, projectGroups });
  }

  function replaceProjectGroups(nextProjectGroups: ProjectGroup[]): void {
    setProjectGroups(nextProjectGroups);
    onCatalogChange({ units, projectGroups: nextProjectGroups });
  }
}

type TreeNode = NonNullable<TreeProps["treeData"]>[number];

function buildUnitTree(units: OrganizationUnit[], renderTitle: (unit: OrganizationUnit) => ReactNode): TreeNode[] {
  const unitIds = new Set(units.map((unit) => unit.unitId));
  const roots = units.filter((unit) => !unit.parentUnitId || !unitIds.has(unit.parentUnitId));
  const toNode = (unit: OrganizationUnit): TreeNode => ({
    key: unit.unitId,
    title: renderTitle(unit),
    children: units.filter((candidate) => candidate.parentUnitId === unit.unitId).map(toNode)
  });
  return roots.map(toNode);
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
