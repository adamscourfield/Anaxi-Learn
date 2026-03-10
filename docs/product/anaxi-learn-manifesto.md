# Anaxi Learn - Manifesto

Source: https://drive.google.com/file/d/1-qoKTgyarr2T7FA16-zJ0v_bmihdExf3wGBjid2LhLU/view

Anaxi Learn – Product Manifesto and System Architecture Blueprint
1. Product Thesis
Anaxi Learn is a curriculum‑anchored diagnostic and mastery platform.
 
Its purpose is to identify what a student can already do securely, detect the first prerequisite gap in the curriculum, deliver the explanation route most likely to unlock understanding, and return the student to the teacher‑led curriculum as quickly as possible.
 
The platform is not designed as a fully self‑paced learning environment. Instead, it supports a fixed curriculum spine used by teachers while providing adaptive diagnostics and targeted catch‑up around that spine.
 
Core principle:
Not every student needs a different curriculum. They need accurate diagnosis against the same curriculum, followed by efficient support to reach it.
2. Core Problems the Platform Solves
1. Teachers often cannot identify the precise prerequisite gap when a student struggles.
2. Students are forced to practise material they already understand.
3. Catch‑up work is often broad, inefficient, and poorly targeted.
4. Explanations vary in effectiveness across students but this is rarely measured.
 
Anaxi Learn solves these problems through curriculum‑linked diagnostics, structured micro‑skills, and multiple explanation routes per skill.
3. System Design Principles
1. Curriculum Anchored
The teacher’s curriculum sequence remains the central spine.
 
2. Boundary Detection
Diagnostics aim to find the boundary between secure and insecure knowledge.
 
3. Minimal Diagnostic Length
Approximately 9–13 questions are sufficient to locate mastery boundaries.
 
4. Multiple Explanation Pathways
Each micro‑skill contains three distinct explanation routes.
 
5. Instructional Feedback Loops
The system records which explanation route leads to mastery.
 
6. Rapid Reintegration
Students return to the class curriculum as quickly as possible.
4. Curriculum Structure Model
Hierarchy:
 
Subject
Year Group
Strand
Micro‑Skill
 
Each micro‑skill represents a single teachable concept.
 
Example (Year 7 Foundational Number):
 
1 Compare integers
2 Add integers
3 Subtract integers
4 Multiply integers
5 Order of operations
6 Fraction/decimal/percentage conversion
 
Micro‑skills form a directed graph connected by prerequisite relationships.
5. Micro‑Skill Schema
Each micro‑skill requires the following attributes:
 
skill_id
skill_name
strand_id
curriculum_position
description
mastery_definition
prerequisite_skill_ids
common_misconceptions
transfer_level_expectation
6. Question Architecture
Each micro‑skill contains a small set of diagnostic questions.
 
Recommended minimum:
 
4 diagnostic items per micro‑skill
 
Question roles:
Anchor question
Prerequisite probe
Misconception check
Transfer question
Confirmation question
Shadow question
 
Question metadata schema:
 
question_id
subject_id
year_group_id
strand_id
micro_skill_id
question_text
answer_format
correct_answer
difficulty_level
transfer_level
misconception_tag
question_role
curriculum_position
worked_solution
7. Explanation Architecture
Each micro‑skill contains three explanation routes.
 
Route A: Procedural Explanation
Step‑by‑step explanation and worked examples.
 
Route B: Conceptual / Visual Explanation
Uses representations such as diagrams or number lines.
 
Route C: Misconception‑Corrective Explanation
Targets specific incorrect rules or misunderstandings.
 
Explanation schema:
 
explanation_id
micro_skill_id
route_type
explanation_title
explanation_body
target_misconception
default_priority_rank
8. Explanation Content Requirements
Each explanation route must contain:
 
2 worked examples
1–2 guided models
1 short practice set
2 shadow check questions
 
Shadow checks verify whether the explanation successfully unlocked the skill.
9. Student Skill State Model
Each student‑skill pair has one of three states:
 
Secure
Developing
Not Yet Secure
 
Secure:
Student answers independent and transfer questions correctly.
 
Developing:
Student can perform after explanation but stability is uncertain.
 
Not Yet Secure:
Student still fails after explanation routes.
10. Diagnostic Session Structure
Phase 1 – Anchor Questions
3–4 questions at expected curriculum level.
 
Phase 2 – Branch Questions
4–6 questions moving upward or downward in skill difficulty.
 
Phase 3 – Confirmation Questions
2–3 questions confirming placement.
 
Typical diagnostic length: 9–13 questions.
11. Instructional Routing Logic
1 Student begins at expected curriculum skill.
 
2 If correct:
Move upward in skill sequence.
 
3 If incorrect:
Probe prerequisite skill.
 
4 Identify the first unstable micro‑skill.
 
5 Deliver explanation route.
 
6 After explanation:
Serve shadow questions.
 
7 If success:
Mark skill as developing or secure.
 
8 If failure:
Serve alternative explanation route.
 
9 If still unsuccessful:
Route to prerequisite reteach.
12. Explanation Effectiveness Logging
For each explanation attempt the platform records:
 
student_id
micro_skill_id
explanation_id
attempt_order
time_spent
shadow_question_accuracy
misconception_detected
led_to_mastery (true/false)
 
This data allows the system to learn:
 
Which explanations work best
Which explanations work best for specific misconceptions
Which explanation styles work best for specific students
13. Student Data Model
Student skill tracking schema:
 
student_skill_status
 
student_id
micro_skill_id
status
confidence_score
successful_explanation_id
last_updated
 
Student interaction logs:
 
student_question_attempts
student_explanation_attempts
diagnostic_sessions
14. Core Database Tables
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
15. Student Experience Flow
1 Student answers diagnostic questions.
 
2 System identifies current mastery boundary.
 
3 Student receives targeted explanation route.
 
4 Student completes guided example.
 
5 Student answers shadow questions.
 
6 If correct:
Student progresses to next skill.
 
7 If incorrect:
System presents alternative explanation route.
 
8 Once secure:
Student returns to class curriculum sequence.
16. Teacher Dashboard Outputs
Class level:
Percentage secure per micro‑skill
Most common prerequisite gaps
Common misconceptions
Students needing catch‑up
 
Student level:
Current curriculum position
First insecure micro‑skill
Recommended next action
Successful explanation route
 
Content level:
Explanation effectiveness rates
Question discrimination quality
Curriculum bottlenecks
