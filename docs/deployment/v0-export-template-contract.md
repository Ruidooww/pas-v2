# V0 Export Template Contract

PAS V0 renders editable deliverables from template files under `EXPORT_TEMPLATE_ROOT`.
The runtime expects these exact file names:

| Format | Required file | Runtime filler |
| --- | --- | --- |
| `docx` | `proposal.docx` | `docxtemplater` tag fill |
| `pptx` | `proposal.pptx` | PPTX OOXML tag fill |
| `xlsx` | `proposal.xlsx` | `exceljs` row append into fixed sheets |

The current repository includes temporary templates for smoke tests only. Replace those files with approved company
templates under the same names when the real brand assets are ready.

## Shared Fields

These fields may be used in `docx` and `pptx` text placeholders:

| Field | Description |
| --- | --- |
| `{customerName}` | Customer name from the proposal draft. |
| `{title}` | Proposal title. |
| `{generatedAt}` | Generated timestamp. |
| `{reviewNotice}` | Required human-review notice. |
| `{sectionsSummary}` | Plain-text section summary for PPTX. |
| `{citationsSummary}` | Plain-text citation summary for PPTX. |
| `{assumptionsSummary}` | Plain-text assumptions and review notes for PPTX. |

## DOCX Section Tags

`proposal.docx` may use docxtemplater loops:

```text
{#sections}
{index}. {title}
{body}
{traceNote}
{/sections}

{#citations}
[{index}] {title} {source} {location} {chunkId} {documentId}
{/citations}

{#assumptions}
{.}
{/assumptions}
```

## PPTX Tags

`proposal.pptx` should keep flat text placeholders inside text boxes:

```text
{customerName}
{title}
{generatedAt}
{reviewNotice}
{sectionsSummary}
{citationsSummary}
{assumptionsSummary}
```

Do not convert placeholders into images or grouped shapes that cannot be found in slide XML.

## XLSX Sheets

`proposal.xlsx` must contain these sheets:

| Sheet | Appended columns |
| --- | --- |
| `需求矩阵` | `index`, `title`, `body`, `traceNote` |
| `引用证据清单` | `index`, `title`, `source`, `location`, `chunkId`, `documentId` |
| `假设与审核提示` | `reviewNotice`, then one row per assumption |

Sheet names are part of the runtime contract. Changing them requires a code change.

## Validation

Run this after placing real templates:

```powershell
pnpm --filter pas-backend exec vitest run src/export/template-export.renderer.spec.ts
```

Then run the full V0 smoke:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-v0.ps1 `
  -BaseUrl "http://127.0.0.1:18000" `
  -Username "<initial admin username>" `
  -Password "<initial admin password>"
```
