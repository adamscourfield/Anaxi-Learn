-- N1.1 MVP Seed SQL (PostgreSQL)
-- Uses existing Anaxi-Learn schema; stores role/tag metadata in Item.options JSON.

BEGIN;

-- 1) Ensure subject exists
WITH upsert_subject AS (
  INSERT INTO "Subject" ("id", "title", "slug", "description", "createdAt")
  VALUES (gen_random_uuid()::text, 'KS3 Mathematics', 'ks3-maths', 'KS3 maths curriculum', NOW())
  ON CONFLICT ("slug") DO UPDATE SET "title" = EXCLUDED."title"
  RETURNING "id"
)
SELECT 1;

-- 2) Ensure skill exists (code unique per subject)
WITH subj AS (
  SELECT "id" FROM "Subject" WHERE "slug"='ks3-maths' LIMIT 1
)
INSERT INTO "Skill" (
  "id","code","name","slug","strand","isStretch","sortOrder","description","intro","subjectId","createdAt"
)
SELECT
  gen_random_uuid()::text,
  'N1.1',
  'Recognise the place value of digits in integers (up to millions)',
  'y7_n1_1_place_value',
  'PV',
  false,
  1,
  'Y7 N1.1 place value MVP micro-skill',
  'Place value columns and digit value interpretation',
  subj."id",
  NOW()
FROM subj
ON CONFLICT ("subjectId","code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "slug" = EXCLUDED."slug",
  "strand" = EXCLUDED."strand",
  "description" = EXCLUDED."description",
  "intro" = EXCLUDED."intro";

-- Helper CTE for skill id
WITH skill_row AS (
  SELECT s."id" AS skill_id
  FROM "Skill" s
  JOIN "Subject" sub ON sub."id" = s."subjectId"
  WHERE sub."slug"='ks3-maths' AND s."code"='N1.1'
  LIMIT 1
)
SELECT 1;

-- 3) Insert diagnostic and shadow items
-- NOTE: idempotency here is by exact question text; adjust if question wording changes.

INSERT INTO "Item" ("id","question","type","options","answer","subjectId","createdAt")
SELECT gen_random_uuid()::text,
       q.question,
       q.type,
       q.options::jsonb,
       q.answer,
       sub."id",
       NOW()
FROM "Subject" sub,
LATERAL (
  VALUES
  ('What is the value of the digit 7 in 3,742,915?','SHORT','{"meta":{"role":"anchor","misconception_tag":"pv_m1_place_vs_value","transfer_level":"none"}}','700000'),
  ('In 504,081, what is the place value of digit 4?','MCQ','{"choices":["thousands","ten-thousands","hundreds","ones"],"meta":{"role":"misconception","misconception_tag":"pv_m2_zero_shift","transfer_level":"none"}}','thousands'),
  ('Write 8,030,406 in expanded form.','SHORT','{"meta":{"role":"prerequisite_probe","misconception_tag":"pv_m2_zero_shift","transfer_level":"low"}}','8000000 + 30000 + 400 + 6'),
  ('Which number has digit 5 worth 50,000?','MCQ','{"choices":["5,203,410","1,052,340","305,214","250,431"],"meta":{"role":"transfer","misconception_tag":"pv_m3_reading_direction","transfer_level":"medium"}}','1,052,340'),
  ('What is the value of 8 in 1,863,205?','SHORT','{"meta":{"role":"shadow","route":"A"}}','800000'),
  ('What place is digit 9 in 4,719,300?','SHORT','{"meta":{"role":"shadow","route":"A"}}','thousands'),
  ('Write 6,040,070 in expanded form.','SHORT','{"meta":{"role":"shadow","route":"B"}}','6000000 + 40000 + 70'),
  ('Select the number where 3 represents 300,000.','MCQ','{"choices":["3,041,220","130,422","43,021","703,012"],"meta":{"role":"shadow","route":"B"}}','3,041,220'),
  ('Correct this: In 2,701,450 the value of 7 is 700,000.','SHORT','{"meta":{"role":"shadow","route":"C"}}','700000'),
  ('Which value of 5 is correct in 950,214?','MCQ','{"choices":["5","50","5000","50000"],"meta":{"role":"shadow","route":"C"}}','50000')
) AS q(question,type,options,answer)
WHERE sub."slug"='ks3-maths'
AND NOT EXISTS (
  SELECT 1 FROM "Item" i WHERE i."question"=q.question AND i."subjectId"=sub."id"
);

-- 4) Link items to skill
WITH skill_row AS (
  SELECT s."id" AS skill_id
  FROM "Skill" s
  JOIN "Subject" sub ON sub."id"=s."subjectId"
  WHERE sub."slug"='ks3-maths' AND s."code"='N1.1'
  LIMIT 1
), item_rows AS (
  SELECT i."id" AS item_id
  FROM "Item" i
  JOIN "Subject" sub ON sub."id"=i."subjectId"
  WHERE sub."slug"='ks3-maths'
    AND i."question" IN (
      'What is the value of the digit 7 in 3,742,915?',
      'In 504,081, what is the place value of digit 4?',
      'Write 8,030,406 in expanded form.',
      'Which number has digit 5 worth 50,000?',
      'What is the value of 8 in 1,863,205?',
      'What place is digit 9 in 4,719,300?',
      'Write 6,040,070 in expanded form.',
      'Select the number where 3 represents 300,000.',
      'Correct this: In 2,701,450 the value of 7 is 700,000.',
      'Which value of 5 is correct in 950,214?'
    )
)
INSERT INTO "ItemSkill" ("itemId","skillId")
SELECT ir.item_id, sr.skill_id
FROM item_rows ir CROSS JOIN skill_row sr
ON CONFLICT ("itemId","skillId") DO NOTHING;

COMMIT;
