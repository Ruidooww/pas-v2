# 50 Question Regression Template

Use this template after the PAS V0 dataset has been created and the curated materials are imported.

## Candidate Bootstrap

When the business-approved 50 questions are not ready yet, use
`docs/ragflow/v0-candidate-regression-questions.json` as a draft review pool.
The file already contains exactly 50 generated questions and expected intents.
Its `review_status` field is not sufficient approval evidence by itself.

Candidate questions may be used for smoke and retrieval tuning only:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-v0.ps1 `
  -BaseUrl "http://127.0.0.1:18000" `
  -Username "<initial admin username>" `
  -Password "<initial admin password>" `
  -CandidateQuestionFile ".\docs\ragflow\v0-candidate-regression-questions.json" `
  -CandidateQuestionLimit 5
```

Before a V0 launch gate, the assigned Technical Department reviewer must convert exactly 50 questions into reviewed
regression cases with pass/fail evidence. The reviewer role is available for this trial, but the candidate file itself
must not be submitted as go-live evidence until reviewer decisions, citations, and timestamps are recorded.

## Report Columns

| Column | Required | Description |
| --- | --- | --- |
| `question_id` | Yes | Stable id such as `Q001`. |
| `question` | Yes | Real user or Technical Department question. |
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

## Reviewer Workflow

1. Start from all 50 entries in `v0-candidate-regression-questions.json`; do not add, remove, or duplicate IDs during a gate run.
2. Run each question against the internal-trial endpoint and capture the dataset, chunk ids, citations, and answer status.
3. The assigned Technical Department reviewer records `pass`, `partial`, or `fail`, plus reviewer role/name and `reviewed_at`.
4. A technical `answered` result is not automatically a human `pass`; correctness and citation quality still require review.

## Gate

V0 is not ready for launch until all 50 questions have a reviewed result and blocking failures are resolved.
