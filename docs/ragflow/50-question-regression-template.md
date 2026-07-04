# 50 Question Regression Template

Use this template after the PAS V0 dataset has been created and the curated materials are imported.

## Candidate Bootstrap

When the business-approved 50 questions are not ready yet, use
`docs/ragflow/v0-candidate-regression-questions.json` as a draft review pool.
Those records are deliberately marked with `review_status: "candidate"` and are not an approval artifact.

Candidate questions may be used for smoke and retrieval tuning only:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-v0.ps1 `
  -BaseUrl "http://127.0.0.1:18000" `
  -Username "<initial admin username>" `
  -Password "<initial admin password>" `
  -CandidateQuestionFile ".\docs\ragflow\v0-candidate-regression-questions.json" `
  -CandidateQuestionLimit 5
```

Before a V0 launch gate, a product or presales reviewer must convert exactly 50 approved questions into reviewed
regression cases with pass/fail evidence. Do not submit the candidate file itself as the go-live evidence.

## Report Columns

| Column | Required | Description |
| --- | --- | --- |
| `question_id` | Yes | Stable id such as `Q001`. |
| `question` | Yes | Real user or presales question. |
| `expected_intent` | Yes | What a correct answer must cover. |
| `dataset_id` | Yes | Runtime dataset id used during the run. Do not commit filled reports with secret-like values. |
| `hit_chunk_ids` | Yes | Comma-separated retrieved `chunkId` values. |
| `citations` | Yes | Source document titles or filenames shown to reviewers. |
| `answer_status` | Yes | `pass`, `partial`, or `fail`. |
| `failure_reason` | Required on fail | Examples: no hit, wrong product, stale source, missing citation, low score. |
| `human_review_result` | Yes | Reviewer decision and notes. |
| `reviewer` | Yes | Reviewer name or role. |
| `reviewed_at` | Yes | Review date. |

## Markdown Table

| question_id | question | expected_intent | dataset_id | hit_chunk_ids | citations | answer_status | failure_reason | human_review_result | reviewer | reviewed_at |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Q001 |  |  |  |  |  |  |  |  |  |  |

## Gate

V0 is not ready for launch until all 50 questions have a reviewed result and blocking failures are resolved.
