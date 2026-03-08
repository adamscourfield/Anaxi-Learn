# Teaching Step Schema (v1)

## Purpose
Ensure reteach content teaches process in small, visual, measurable steps.

## Core principle
Each step should require one cognitive action only.

## Step object contract
Required fields:
- `stepId` (string)
- `stepOrder` (number)
- `stepType` (`goal` | `visual_demo` | `guided_action` | `checkpoint` | `transfer_check`)
- `instructionText` (max ~90 chars)
- `visualType` (`place_value_grid` | `compare_columns` | `decompose_number` | `number_line` | `none`)
- `visualPayload` (JSON)
- `expectedActionType` (`select` | `fill` | `tap` | `order`)
- `expectedAnswer` (string/json)
- `hint1` (string)
- `hint2` (string)
- `feedbackCorrect` (string)
- `feedbackIncorrect` (string)

Optional fields:
- `masteryWeight` (number, default 1)
- `maxRetriesBeforeAlternative` (number, default 2)
- `alternativeExplanation` (string)

## Delivery rules
1. Display one step at a time.
2. Block “next” until step outcome is known (or explicit skip policy).
3. Show one hint at a time; do not reveal full answer immediately.
4. Track duration/retries/hints for each step.

## Quality constraints
- No paragraph-only teaching steps.
- Every non-goal step must include either a visual or a manipulable action.
- Every visual_demo must be followed by a guided_action.
- Every sequence must end with transfer_check.

## DB mapping suggestion
Current `ExplanationStep` model can be extended via:
- `stepType` string
- `visualType` string
- `visualPayload` Json
- `expectedActionType` string
- `masteryWeight` float

Until schema update, store this in structured JSON per step payload.