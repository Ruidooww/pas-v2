# 50 Question Regression Template

Use this template after the PAS V0 dataset has been created and the curated materials are imported.

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
