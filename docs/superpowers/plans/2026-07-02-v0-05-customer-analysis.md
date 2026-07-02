# V0-05 Customer Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build fixed-structure customer analysis that consumes CRM context and RAGFlow evidence for downstream proposal generation.

**Architecture:** `CustomerAnalysisService` reads customer context through `CrmClient`, retrieves supporting chunks through `RagflowClient`, and produces a deterministic analysis object. Judgments with chunks are marked `evidence`; judgments without chunks are marked `inferred`. No arbitrary agent planning or external-system bypass is introduced.

**Tech Stack:** NestJS 11, TypeScript 6, Vitest.

---

### Tasks

- [ ] Extend mock CRM data to at least three customer types.
- [ ] Add customer analysis DTOs and in-memory audit log.
- [ ] Implement `POST /api/internal/customer-analysis/analyze`.
- [ ] Return pain points, risks, entry angles, recommended capabilities, and evidence.
- [ ] Run backend and full repo verification.

## Self-Review

- Scope matches #5 and keeps fixed-structure analysis.
- Real CRM and real RAGFlow data remain behind existing adapters.
- All unsupported conclusions must be marked as inference, not fact.
