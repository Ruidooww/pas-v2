# V1 100 Question Regression Gate

V1 launch evidence must use an approved 100-question set. Do not submit the existing V0 50-question file as V1 launch evidence.

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

## Case Shape

| Field | Required | Description |
| --- | --- | --- |
| `questionId` | Yes | Stable id such as `V1-Q001`. |
| `question` | Yes | Real user, sales, presales, or administrator question. |
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
