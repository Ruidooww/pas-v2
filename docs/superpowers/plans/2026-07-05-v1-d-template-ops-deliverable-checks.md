# V1-D Template Operations and Deliverable Checks

## Scope

Add V1 template operations without pretending generated placeholder templates are final customer templates.

This slice covers:

- export template metadata catalog for `docx`, `pptx`, and `xlsx`
- active/disabled lifecycle operations with audit events
- optional persistence snapshots through `PersistenceSink`
- export-time template availability checks using the same `EXPORT_TEMPLATE_ROOT`
- basic deliverable checks for rendered files
- frontend template operations page

Out of scope for this slice:

- 50/100 regression quality gate
- uploading binary templates
- changing RAGFlow containers, volumes, or compose project
- replacing the existing `docxtemplater` / `pptx-automizer` / `xlsx` fill path

## TDD Plan

1. Add failing backend tests for template catalog lifecycle and availability checks.
2. Add failing export service tests for selected template propagation and failed availability.
3. Add failing renderer test for explicit template file selection.
4. Add failing frontend test for the template operations page.
5. Implement the smallest backend services, routes, persistence snapshot, and renderer changes required.
6. Implement the frontend page and navigation entry.
7. Run focused tests, then full repo verification.

## Acceptance

- Operators can register and enable/disable template metadata.
- Export uses an active template metadata entry when available.
- Export still fails with `TEMPLATE_MISSING` when metadata exists but the real file is missing.
- Rendered zero-byte deliverables fail before file storage.
- Default V0 templates remain usable if the real files exist under `EXPORT_TEMPLATE_ROOT`.
