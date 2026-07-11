# V1 100 Question Regression Gate

V1 launch evidence must use an approved 100-question set. Do not submit the existing V0 50-question file as V1 launch evidence.

## Current Candidate And Technical Run Status

As of `2026-07-11`:

- `docs/ragflow/v1-candidate-regression-questions.json` contains 100 unique candidate questions across 16 categories, with IDs `V1-Q001` through `V1-Q100` and no exact question overlap with the V0 50-question set.
- Every candidate remains `review_status=pending`. This file is not an approved V1 launch set.
- A real-mode technical precheck ran all 100 candidates against the configured external RAGFlow at commit `a807a16`. It returned `answered=100`, `no_hit=0`, `error=0`, with five citations per question and 500 citations in total. Average runtime was 1450 ms and P95 was 2305 ms.
- Independent semantic review found obvious expected-evidence mismatches in `V1-Q003`, `V1-Q076`, `V1-Q077`, `V1-Q099`, and `V1-Q100`: retrieval returned unrelated product, bug, or operational content. This run proves request-path completion only; it is not an answer-quality pass, and full human review may find additional failures.
- The local ignored artifacts are `temp/regression/PAS-V1-100题技术运行-2026-07-11.json` and `temp/regression/PAS-V1-100题审核底稿-2026-07-11.md`.
- The reviewer is still `待指定`; all 100 `human_review_result` values remain `pending` and all `reviewed_at` values remain `null`. Technical completion does not establish answer correctness or launch approval.

Before gate submission, correct the RAGFlow retrieval scope or add approved PAS operational knowledge for the known mismatches, rerun the affected coverage, assign a reviewer, approve the question set, evaluate every answer and citation against `expected_evidence`, record pass/fail decisions and timestamps, and submit exactly 100 approved cases through the gate API.

## API Contract

Submit a V1 gate run with `requiredCaseCount: 100`:

```json
{
  "name": "PAS V1 100-question regression",
  "owner": "QA owner",
  "approver": "Business approver",
  "requiredCaseCount": 100,
  "cases": []
}
```

The backend keeps V0 compatibility: omitting `requiredCaseCount` defaults to 50.

## Gate Rules

- Fewer than the declared case count returns `gateStatus=blocked` and `REGRESSION_QUESTION_SET_INCOMPLETE`.
- More than the declared case count returns `gateStatus=blocked` and `REGRESSION_QUESTION_SET_INVALID`.
- Duplicate `questionId`, blank question text, or blank expected evidence returns `REGRESSION_QUESTION_SET_INVALID`.
- Any failed case returns `gateStatus=failed` and `REGRESSION_CASES_FAILED`.
- Only exactly 100 approved, unique, passed V1 cases return `canGoLive=true`.

## Minimum Coverage

The 100 questions should cover:

- product overview and positioning
- transparent encryption
- permission control
- outbound file controls
- removable storage controls
- print and screenshot controls
- behavior audit
- endpoint deployment and operations
- implementation and acceptance
- manufacturing, R&D, finance, and consulting scenarios
- competitor and boundary-limit questions
- proposal generation and export evidence quality
- document visibility and role-boundary cases
- template selection and deliverable checks
- feedback-to-knowledge correction flow
- Technical Department hierarchy, inactive-unit revocation, and project-group membership
- all five document visibility scopes and sales/technical/admin permission boundaries

## Case Shape

| Field | Required | Description |
| --- | --- | --- |
| `questionId` | Yes | Stable id such as `V1-Q001`. |
| `question` | Yes | Real user, sales, technical, or administrator question. |
| `expectedEvidence` | Yes | What answer evidence or operational behavior must be present. |
| `passed` | Yes | `true` only after human review. |
| `failureReason` | Required on fail | Short reason such as no hit, missing citation, permission leak, wrong template, or weak evidence. |

## Example Case

```json
{
  "questionId": "V1-Q001",
  "question": "销售用户是否只能检索自己可见文档里的 IP-Guard 答案？",
  "expectedEvidence": "回答证据必须来自 enabled、parseStatus=done 且对该用户可见的文档；不可见文档不得出现在 citations。",
  "passed": false,
  "failureReason": "Not reviewed"
}
```
