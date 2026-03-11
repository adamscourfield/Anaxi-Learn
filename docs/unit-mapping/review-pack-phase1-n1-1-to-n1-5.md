# Phase 1 Review Pack: N1.1 to N1.5

Corrected review-and-fix pack for the first Unit 1 subtopics.

File:
- `docs/unit-mapping/review-pack-phase1-n1-1-to-n1-5.jsonl`

Scope:
- `N1.1` Recognise the place value of any number in an integer up to one billion
- `N1.2` Write integers in words and figures
- `N1.3` Compare two numbers using `=`, `≠`, `<`, `>`, `≤`, `≥`
- `N1.4` Order a list of integers
- `N1.5` Finding the median from a set of numbers

Item count:
- `N1.1`: 4 items
- `N1.2`: 4 items
- `N1.3`: 4 items
- `N1.4`: 4 items
- `N1.5`: 5 items
- Total: `21`

Routing intent in `source.question_ref`:
- `ONB`: onboarding
- `LRN`: main learn/practice
- `RT`: reteach

Why this pack exists:
- the earlier discovery material for these subtopics was too rough to use directly
- `N1.2` in particular was contaminated by an unrelated `N1.20` challenge slide in the old candidate list
- several `N1.4` and `N1.5` items were effectively placeholders rather than properly authored student tasks

Answer-mode intent in this pack:
- `N1.1`: direct numeric answers for digit value and number-building tasks
- `N1.2`: short-text for words and numeric entry for words-to-figures translation
- `N1.3`: true/false or symbol-entry, not padded four-choice MCQ
- `N1.4`: ordered-list output as short response rather than fake MCQ
- `N1.5`: direct numeric answers for median, including even-set midpoint cases

Important notes:
- `N1.4` ordering tasks are encoded as ordered-output strings because the real learner task is sequencing values, not choosing a single option.
- `N1.5` explicitly includes both odd and even numbers of data points so the learner has to distinguish “middle value” from “midpoint of the middle two”.
- This pack is intended to replace the weak early-phase candidates for these subtopics when the offline review packs are imported later.
