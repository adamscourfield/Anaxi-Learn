# Question Encoding Rules

These rules define the minimum contract every future encoded question must satisfy before import.

## Canonical formats

- `TRUE_FALSE`: exactly two choices, `True` and `False`.
- `SINGLE_CHOICE`: one correct choice from a unique set of fixed options.
- `SHORT_TEXT`: the student types a word or phrase; at least one accepted answer is required.
- `NUMERIC`: the student types a number; accepted answers or tolerance must be present.
- `ORDER_SEQUENCE`: the student arranges a fixed set of values into the stored order.

Legacy source formats such as `MCQ` and `SHORT` are tolerated during transition, but import code should convert them into the canonical formats above.

## Hard rules

- Every item must expose a student interaction mode that matches the question task.
- `TRUE_FALSE` items must store exactly two choices.
- `SINGLE_CHOICE` items must store unique choices and the canonical answer must appear in those choices.
- `SHORT_TEXT` and `NUMERIC` items must store at least one accepted answer.
- `ORDER_SEQUENCE` items must store the available values and every value in the stored ordered answer must appear in that set.
- Accepted answers must be unique after normalization.

## QA expectations

Before approval, every item should be checked in the QA page for:

- student-facing answer mode is appropriate
- the stored correct answer is enterable/selectable
- accepted answers match expected marking
- no internal or teacher-only wording leaks into student copy

## Approval bar

Questions should only be marked ready for student use when:

- there are no contract errors
- the answer mode has been manually checked
- at least one correct and one incorrect response have been tested in the QA page
