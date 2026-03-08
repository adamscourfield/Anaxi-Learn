-- N1.1 MVP seed (idempotent)
-- Creates one skill + 10 items (4 diagnostic + 6 shadow)

with subject_row as (
  select id from "Subject" where slug='ks3-maths' limit 1
), skill_upsert as (
  insert into "Skill" (id, code, name, slug, strand, "isStretch", "sortOrder", "subjectId", "createdAt")
  select gen_random_uuid()::text, 'N1.1', 'Place value foundations', 'n1-1', 'PV', false, 1, id, now()
  from subject_row
  where not exists (
    select 1 from "Skill" s join subject_row sr on s."subjectId"=sr.id where s.code='N1.1'
  )
  returning id
)
select 1;

-- Ensure item rows exist
insert into "Item" (id, question, type, options, answer, "subjectId", "createdAt")
select gen_random_uuid()::text, q.question, 'MCQ', q.options::jsonb, q.answer, s.id, now()
from "Subject" s
join (
  values
    ('N1.1 D1 Anchor', '["1204","1240","1024","1420"]', '1204'),
    ('N1.1 D2 Misconception', '["3005","3050","3500","5003"]', '3050'),
    ('N1.1 D3 Prereq probe', '["0.4","0.04","4","40"]', '0.04'),
    ('N1.1 D4 Transfer', '["7,060","7,600","760","70,600"]', '7,600'),
    ('N1.1 S1 Shadow', '["9,030","9,300","903","90,300"]', '9,300'),
    ('N1.1 S2 Shadow', '["0.8","0.08","8","80"]', '0.08'),
    ('N1.1 S3 Shadow', '["2,105","2,150","2,015","21,500"]', '2,150'),
    ('N1.1 S4 Shadow', '["6,450","6,405","645","64,500"]', '6,450'),
    ('N1.1 S5 Shadow', '["5.6","0.56","56","0.056"]', '0.56'),
    ('N1.1 S6 Shadow', '["4,020","4,200","402","40,200"]', '4,020')
) as q(question, options, answer) on true
where s.slug='ks3-maths'
and not exists (select 1 from "Item" i where i.question=q.question);

-- Link N1.1 skill to items
insert into "ItemSkill" ("itemId", "skillId")
select i.id, sk.id
from "Item" i
join "Skill" sk on sk.code='N1.1'
join "Subject" s on s.id=sk."subjectId" and s.slug='ks3-maths'
where i.question like 'N1.1 %'
and not exists (
  select 1 from "ItemSkill" x where x."itemId"=i.id and x."skillId"=sk.id
);
