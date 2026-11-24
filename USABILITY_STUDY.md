# DataSphere Analytics Usability Study

## Participants
Recruit 8–12 nontechnical analysts with varied spreadsheet experience. Exclude participants who use DataSphere during development.

## Sessions
One 45-minute remote or in-person session per participant. Record:

- Task completion
- Time to first correct outcome
- Errors and recovery attempts
- Perceived difficulty (1–7)
- Confidence in the resulting dataset (1–7)
- Think-aloud comments

## Required Tasks
1. Upload one CSV dataset.
2. Identify missing values and duplicate rows.
3. Inspect join-cardinality diagnostics after loading a second dataset.
4. Preview a join and explain whether duplicate keys may change row count.
5. Choose a preprocessing strategy and review the before/after impact.
6. Confirm the processing pipeline and export a cleaned dataset.
7. Open the exported JSON audit manifest and verify it describes the applied choices.

## Success Criteria
- At least 80% complete Tasks 1–6 without facilitator assistance.
- Median task difficulty no greater than 3/7.
- Median confidence no lower than 5/7.
- No participant executes a destructive join or preprocessing action before reviewing the preview.

## Metrics
Record by task:

- Started/completed/abandoned
- Time in seconds
- Mistake count
- Facilitation prompts
- Severity of any data-loss concern
- Post-task confidence

## Debrief
Ask participants to explain:

- The meaning of duplicate-key cardinality.
- What the Strategy Impact preview changed in their decision.
- Which audit-manifest fields are understandable.
- One action they would remove, rename, or make clearer.
