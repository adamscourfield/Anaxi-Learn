# Anaxi Learn - Build Strategy

Source: https://drive.google.com/file/d/10IQHfzEHv5UJu8mdcb6NFGxZ2jtcQlR55Z1zHFgI9gs/view

Anaxi Learn – MVP Build Checklist
________________


Phase 1 — Lock the Curriculum Structure
Before any code, the skill graph must exist.
Without this the routing engine cannot function.
1.1 Define the strand scope
Decide exactly what the pilot includes.
Example:
Year 7 – Foundational Number
Possible micro-skills:
1. Place value

2. Compare integers

3. Order integers

4. Add positive integers

5. Add negative integers

6. Subtract integers

7. Multiply integers

8. Divide integers

9. Factors and multipleso

10. Prime numbers

11. Order of operations

12. Fractions ↔ decimals

13. Fractions ↔ percentages

14. Percentage of an amount

15. Ratio basics

16. One-step equations

Target:
15–20 micro-skills
________________


1.2 Build the prerequisite graph
For each micro-skill define:
skill_id
skill_name
curriculum_position
prerequisite_skill_ids
Example:
compare integers
→ add integers
→ subtract integers
→ order of operations
Deliverable:
✔ Skill Graph Document
________________


1.3 Define mastery criteria for each skill
Example:
Skill: subtract integers
Mastery definition:
Student can:
• correctly subtract signed integers
• solve subtraction embedded in expressions
• correctly interpret negative direction
Deliverable:
✔ Mastery definitions list
________________


1.4 Identify misconceptions
Each skill needs 2–4 typical errors.
Example:
Subtract integers:
• treats – – as –
• ignores sign of second number
• applies addition rule incorrectly
Deliverable:
✔ Misconception list per skill
________________


Phase 2 — Question Bank Creation
The diagnostic engine requires tagged questions.
2.1 Create diagnostic questions
Per micro-skill:
4 questions
Roles:
   * anchor

   * misconception

   * prerequisite probe

   * transfer

Example:
Skill: subtract integers
7 − (−4)
3 + (−8)
−3 vs −7 comparison
8 − 13
Deliverable:
✔ 80 diagnostic questions
(20 skills × 4)
________________


2.2 Tag questions with metadata
Each question must include:
question_id
micro_skill_id
question_role
difficulty
misconception_tag
transfer_level
answer_type
correct_answer
Deliverable:
✔ Tagged question database
________________


2.3 Create shadow questions
Each explanation route requires shadow checks.
Per skill:
6 shadow questions
(2 per explanation route)
Total:
20 skills × 6 = 120
Deliverable:
✔ Shadow question bank
________________


Phase 3 — Explanation Content Creation
This is the instructional core.
Each micro-skill must have 3 explanation routes.
________________


3.1 Write explanation routes
For each skill create:
Route A – procedural explanation
Route B – conceptual explanation
Route C – misconception correction
Deliverable:
✔ 60 explanation modules
(20 skills × 3)
________________


3.2 Add worked examples
Per explanation route:
2 worked examples
Total:
60 × 2 = 120
Deliverable:
✔ Worked example library
________________


3.3 Create guided models
Students practise with scaffolding.
Per route:
1–2 guided models
Deliverable:
✔ Guided model set
________________


3.4 Attach shadow checks
Per route:
2 shadow questions
Deliverable:
✔ Explanation → shadow link
________________


Phase 4 — Database Implementation
This is the backend schema.
________________


4.1 Create core tables
Minimum schema:
subjects
year_groups
strands
micro_skills
skill_prerequisites
questions
explanations
worked_examples
guided_models
practice_items
shadow_checks
students
student_skill_status
student_question_attempts
student_explanation_attempts
diagnostic_sessions
Deliverable:
✔ Database schema live
________________


4.2 Implement question metadata
Ensure fields exist for:
difficulty
misconception
transfer_level
question_role
Deliverable:
✔ Fully tagged question table
________________


4.3 Implement student skill tracking
Table:
student_skill_status
Fields:
student_id
micro_skill_id
status
confidence
successful_explanation_id
last_updated
Deliverable:
✔ Student mastery tracking
________________


Phase 5 — Routing Engine
Now build the core diagnostic logic.
________________


5.1 Diagnostic session engine
Algorithm:
Start at expected skill
Serve 3–4 anchor questions
Determine position
Deliverable:
✔ Diagnostic session system
________________


5.2 Branch logic
Rules:
If correct → move up
If incorrect → probe prerequisite
Deliverable:
✔ Skill graph navigation
________________


5.3 Identify boundary skill
Engine determines:
first insecure micro-skill
Deliverable:
✔ Boundary detection
________________


5.4 Explanation routing
System selects:
Route A
Route B
Route C
based on:
misconception
student history
default route
Deliverable:
✔ Explanation delivery
________________


5.5 Shadow validation
After explanation:
serve 2 shadow questions
If correct:
mark skill developing/secure
If incorrect:
next explanation route
Deliverable:
✔ Instructional feedback loop
________________


Phase 6 — Student Interface
The UI should be extremely simple.
________________


6.1 Diagnostic screen
Student sees:
one question
clean layout
no distractions
Deliverable:
✔ Diagnostic UI
________________


6.2 Explanation screen
Shows:
explanation
worked example
guided model
Deliverable:
✔ Instruction UI
________________


6.3 Shadow check screen
Student answers:
1–2 questions
Deliverable:
✔ Mastery validation UI
________________


6.4 Progress feedback
Student sees:
You are secure on…
You need to secure…
Next step…
Deliverable:
✔ Student progress feedback
________________


Phase 7 — Teacher Dashboard (Minimal)
Teachers must see instructionally useful outputs.
________________


7.1 Class overview
Display:
% secure per micro-skill
Deliverable:
✔ Class skill heatmap
________________


7.2 Student skill profile
For each student show:
current position
first gap
recommended next step
Deliverable:
✔ Student skill map
________________


7.3 Content insights
Display:
most common misconceptions
explanation success rates
Deliverable:
✔ Content analytics
________________


Phase 8 — MVP Testing Setup
Before launch, prepare a test group.
________________


8.1 Create test students
Example:
50–100 students
Deliverable:
✔ Test accounts
________________


8.2 Populate data
Seed:
skills
questions
explanations
Deliverable:
✔ Content loaded
________________


8.3 Test diagnostic accuracy
Check:
Does the engine locate gaps correctly?
Deliverable:
✔ Routing validation
________________


8.4 Test explanation success
Measure:
shadow question accuracy
Deliverable:
✔ Explanation effectiveness report
________________


MVP Completion Criteria
You have a working MVP when a student can:
1️⃣ complete a diagnostic
2️⃣ have a skill gap detected
3️⃣ receive an explanation route
4️⃣ complete guided practice
5️⃣ pass a shadow check
6️⃣ move to the next skill
End-to-end.
If that loop works, the system is viable.
________________


True Size of the MVP
You actually only need roughly:
20 micro-skills
80 diagnostic questions
120 shadow questions
60 explanations
120 worked examples
That is small enough to build quickly.
________________
