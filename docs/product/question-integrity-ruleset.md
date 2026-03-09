# Question Integrity Ruleset (for N1.3, N1.4+)

## 1) Question-type contract
- Every item must resolve to one canonical answer type: `MCQ`, `SHORT_TEXT`, `SHORT_NUMERIC`, or `TRUE_FALSE`.
- Type aliases are allowed only at ingest (`SHORT`, `NUMERIC`, `TF`, `BOOLEAN`) and must normalize before delivery.
- Any item with boolean choices/answers must resolve to `TRUE_FALSE`.

## 2) Student-facing display contract
- Stems/options shown to students must be label-clean.
- Curriculum/internal labels (`N1.1`, `SC-A2`, `DQ1`, `[Slide22-Q1]`) must not appear in rendered UI text.
- Internal refs should live in metadata, not the display stem.

## 3) Grading contract
- Each item must have a deterministic accepted-answer set.
- Accepted answers may be multi-form using `|`, `;`, or newline delimiters.
- Grading for normalized items must ignore case, extra whitespace, commas, apostrophes, and `and`/`&` formatting differences.

## 4) Normalization contract
- Numeric text should accept comma/no-comma equivalents where meaning is unchanged.
- Boolean synonyms must normalize (`true/correct/yes`, `false/incorrect/no`).
- Normalization must not change semantic operators (e.g., inequality symbols must remain meaningful).

## 5) Seed-content contract
- Source labels are allowed in source payloads, but import should preserve them as metadata.
- Seed validators must flag label-like prefixes in `question` text as warnings (or errors for new packs).
- `question_ref` should be the canonical source reference key.

## 6) Regression contract
- Every production grading/label bug gets a test case before close.
- CI gate: `npm run validate:items` + test suite must pass before release.

## 7) Release gate for each new subtopic (N1.x)
- Pass all type checks.
- Pass normalization edge-case suite.
- Pass label-pattern scan (no unexpected student-facing label leaks).
- Publish a pass/fail QA note with item IDs and remediation notes.

## CI enforcement
- Run `npm run validate:qa` in CI/pre-merge.
- `validate:n13` is hard-fail for any **new** N1.3+ label leaks and type-contract violations.
- Existing historical N1.3+ label prefixes are baseline-tracked in `scripts/baselines/n13-label-violations.json` and must trend down over time.
