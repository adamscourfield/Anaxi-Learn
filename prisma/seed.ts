import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding KS3 Maths (Number + FDP)...');

  // 1️⃣ Demo student
  const hashedPassword = await bcrypt.hash('password123', 10);
  const student = await prisma.user.upsert({
    where: { email: 'student@example.com' },
    update: {},
    create: {
      email: 'student@example.com',
      password: hashedPassword,
      name: 'Test Student',
      role: 'STUDENT',
    },
  });

  // Admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@anaxi.local' },
    update: {},
    create: {
      email: 'admin@anaxi.local',
      password: adminPassword,
      name: 'Admin',
      role: 'ADMIN',
    },
  });

  // Demo teacher (Observe-linked)
  const teacherPassword = await bcrypt.hash('teacher123', 10);
  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@anaxi.local' },
    update: { role: 'TEACHER' },
    create: {
      email: 'teacher@anaxi.local',
      password: teacherPassword,
      name: 'Demo Teacher',
      role: 'TEACHER',
    },
  });

  const teacherProfile = await prisma.teacherProfile.upsert({
    where: { userId: teacher.id },
    update: {
      externalSource: 'anaxi_observe',
      externalTeacherId: 'observe-teacher-001',
      externalSchoolId: 'observe-school-001',
      displayName: 'Demo Teacher',
    },
    create: {
      userId: teacher.id,
      externalSource: 'anaxi_observe',
      externalTeacherId: 'observe-teacher-001',
      externalSchoolId: 'observe-school-001',
      displayName: 'Demo Teacher',
    },
  });

  const studentProfile = await prisma.studentProfile.upsert({
    where: { userId: student.id },
    update: {
      externalSource: 'anaxi_observe',
      externalStudentId: 'observe-student-001',
      externalSchoolId: 'observe-school-001',
    },
    create: {
      userId: student.id,
      externalSource: 'anaxi_observe',
      externalStudentId: 'observe-student-001',
      externalSchoolId: 'observe-school-001',
    },
  });

  const classroom = await prisma.classroom.upsert({
    where: {
      externalSource_externalClassId: {
        externalSource: 'anaxi_observe',
        externalClassId: 'observe-class-7A-maths',
      },
    },
    update: {
      name: 'Year 7A Maths',
      yearGroup: 'Year 7',
      subjectSlug: 'ks3-maths',
      externalSchoolId: 'observe-school-001',
    },
    create: {
      externalSource: 'anaxi_observe',
      externalClassId: 'observe-class-7A-maths',
      externalSchoolId: 'observe-school-001',
      name: 'Year 7A Maths',
      yearGroup: 'Year 7',
      subjectSlug: 'ks3-maths',
    },
  });

  await prisma.teacherClassroom.upsert({
    where: {
      teacherProfileId_classroomId: {
        teacherProfileId: teacherProfile.id,
        classroomId: classroom.id,
      },
    },
    update: { roleLabel: 'Lead' },
    create: {
      teacherProfileId: teacherProfile.id,
      classroomId: classroom.id,
      roleLabel: 'Lead',
    },
  });

  await prisma.classroomEnrollment.upsert({
    where: {
      classroomId_studentUserId: {
        classroomId: classroom.id,
        studentUserId: student.id,
      },
    },
    update: { studentProfileId: studentProfile.id },
    create: {
      classroomId: classroom.id,
      studentUserId: student.id,
      studentProfileId: studentProfile.id,
    },
  });

  // 2️⃣ Subject
  const subject = await prisma.subject.upsert({
    where: { slug: 'ks3-maths' },
    update: {},
    create: {
      slug: 'ks3-maths',
      title: 'KS3 Maths',
      description: 'Anaxi Learn - Maths (Year 7 Entry) Number and FDP v1',
    },
  });

  // 3️⃣ Skill definitions
  const skillDefs = [
    { code: 'N1.1',  name: 'Recognise the place value of each digit in whole numbers up to millions',             strand: 'PV',  isStretch: false, sortOrder: 5   },
    { code: 'N1.3',  name: 'Compare two numbers using =, ≠, <, >, ≤, ≥',                                            strand: 'PV',  isStretch: false, sortOrder: 10  },
    { code: 'N1.5',  name: 'Find the median from a set of numbers (incl midpoint using a calculator)',               strand: 'STA', isStretch: false, sortOrder: 20  },
    { code: 'N1.6',  name: 'Decimal place value',                                                                    strand: 'PV',  isStretch: false, sortOrder: 30  },
    { code: 'N1.7',  name: 'Compare decimals using =, ≠, <, >, ≤, ≥',                                              strand: 'PV',  isStretch: false, sortOrder: 40  },
    { code: 'N1.8',  name: 'Order a list of decimals',                                                               strand: 'PV',  isStretch: false, sortOrder: 50  },
    { code: 'N1.9',  name: 'Position integers on a number line',                                                     strand: 'PV',  isStretch: false, sortOrder: 60  },
    { code: 'N1.10', name: 'Rounding to the nearest 10, 100, 1000, integer',                                         strand: 'PV',  isStretch: false, sortOrder: 70  },
    { code: 'N1.11', name: 'Position decimals on a number line (incl midpoint using a calculator)',                  strand: 'PV',  isStretch: false, sortOrder: 80  },
    { code: 'N1.12', name: 'Rounding to decimal places',                                                             strand: 'PV',  isStretch: false, sortOrder: 90  },
    { code: 'N1.13', name: 'Position negatives on a number line',                                                    strand: 'PV',  isStretch: false, sortOrder: 100 },
    { code: 'N1.14', name: 'Compare negatives using =, ≠, <, >, ≤, ≥',                                             strand: 'PV',  isStretch: false, sortOrder: 110 },
    { code: 'N1.15', name: 'Order any integers, negatives and decimals',                                             strand: 'PV',  isStretch: false, sortOrder: 120 },
    { code: 'N1.16', name: 'Rounding to significant figures',                                                        strand: 'PV',  isStretch: true,  sortOrder: 130 },
    { code: 'N1.17', name: 'Write 10, 100, 1000 etc. as powers of 10',                                              strand: 'POW', isStretch: true,  sortOrder: 140 },
    { code: 'N1.18', name: 'Write positive integers in the form A × 10^n',                                          strand: 'POW', isStretch: true,  sortOrder: 150 },
    { code: 'N1.19', name: 'Understand negative powers of 10',                                                       strand: 'POW', isStretch: true,  sortOrder: 160 },
    { code: 'N1.20', name: 'Place value systems beyond base 10',                                                     strand: 'PV',  isStretch: true,  sortOrder: 170 },
    { code: 'N2.3',  name: 'Use commutative and associative laws',                                                   strand: 'LAW', isStretch: false, sortOrder: 200 },
    { code: 'N2.5',  name: 'Use formal methods for addition of decimals',                                            strand: 'ADD', isStretch: false, sortOrder: 210 },
    { code: 'N2.7',  name: 'Use formal methods for subtraction of decimals; complement of a decimal (1 − p)',        strand: 'ADD', isStretch: false, sortOrder: 220 },
    { code: 'N2.8',  name: 'Money problems involving addition and subtraction',                                      strand: 'ADD', isStretch: false, sortOrder: 230 },
    { code: 'N2.9',  name: 'Perimeter of irregular polygons',                                                        strand: 'PER', isStretch: false, sortOrder: 240 },
    { code: 'N2.10', name: 'Perimeter of regular polygons',                                                          strand: 'PER', isStretch: false, sortOrder: 250 },
    { code: 'N2.11', name: 'Perimeter of rectangles and parallelograms',                                             strand: 'PER', isStretch: false, sortOrder: 260 },
    { code: 'N2.12', name: 'Perimeter of an isosceles triangle or an isosceles trapezium',                           strand: 'PER', isStretch: false, sortOrder: 270 },
    { code: 'N2.13', name: 'Perimeter of a compound shape',                                                          strand: 'PER', isStretch: false, sortOrder: 280 },
    { code: 'N2.14', name: 'Solve problems involving tables and timetables',                                         strand: 'REP', isStretch: false, sortOrder: 290 },
    { code: 'N2.15', name: 'Solve problems with frequency trees',                                                    strand: 'REP', isStretch: false, sortOrder: 300 },
    { code: 'N2.16', name: 'Add and subtract numbers given in standard form',                                        strand: 'POW', isStretch: true,  sortOrder: 310 },
    { code: 'N3.3',  name: 'Multiply and divide integers and decimals by powers of 10',                             strand: 'MUL', isStretch: false, sortOrder: 400 },
    { code: 'N3.5',  name: 'Multiplication (with carrying)',                                                         strand: 'MUL', isStretch: false, sortOrder: 410 },
    { code: 'N3.6',  name: 'Area of rectangles, parallelograms, triangles and compound shapes',                     strand: 'ARE', isStretch: false, sortOrder: 420 },
    { code: 'N3.8',  name: 'Short division (with carrying)',                                                         strand: 'MUL', isStretch: false, sortOrder: 430 },
    { code: 'N3.9',  name: 'Order of Operations (DM before AS, L→R, indices/roots, brackets, inserting brackets)',  strand: 'ORD', isStretch: false, sortOrder: 440 },
    { code: 'N3.10', name: 'Multiples',                                                                              strand: 'FAC', isStretch: false, sortOrder: 450 },
    { code: 'N3.11', name: 'Factors',                                                                                strand: 'FAC', isStretch: false, sortOrder: 460 },
    { code: 'N3.12', name: 'Lowest Common Multiple',                                                                 strand: 'FAC', isStretch: false, sortOrder: 470 },
    { code: 'N3.13', name: 'Highest Common Factor',                                                                  strand: 'FAC', isStretch: false, sortOrder: 480 },
    { code: 'N3.14', name: 'Convert metric units',                                                                   strand: 'MEA', isStretch: false, sortOrder: 490 },
    { code: 'N3.15', name: 'Decimal multiplication (decimal × integer)',                                             strand: 'MUL', isStretch: false, sortOrder: 500 },
    { code: 'N3.16', name: 'Decimal multiplication (decimal × decimal)',                                             strand: 'MUL', isStretch: false, sortOrder: 510 },
    { code: 'N3.17', name: 'Multiply by 0.1 and 0.01',                                                              strand: 'MUL', isStretch: true,  sortOrder: 520 },
    { code: 'N3.18', name: 'Short division (remainders)',                                                            strand: 'MUL', isStretch: false, sortOrder: 530 },
    { code: 'N3.19', name: 'Short division (decimal answers)',                                                       strand: 'MUL', isStretch: false, sortOrder: 540 },
    { code: 'N3.20', name: 'Divide decimals (by an integer / by a decimal; incl ÷0.1, ÷0.2, ÷0.5 etc.)',           strand: 'MUL', isStretch: true,  sortOrder: 550 },
    { code: 'N3.21', name: 'Find missing lengths given area (rectangles, parallelograms, triangles and compound shapes)', strand: 'ARE', isStretch: false, sortOrder: 560 },
    { code: 'N3.22', name: 'Solve problems using the mean',                                                          strand: 'STA', isStretch: false, sortOrder: 570 },
    { code: 'N3.23', name: 'Square and cube numbers, roots',                                                         strand: 'SQR', isStretch: false, sortOrder: 580 },
    { code: 'N3.24', name: 'Introduction to primes',                                                                 strand: 'FAC', isStretch: false, sortOrder: 590 },
    { code: 'N4.1',  name: 'Understand a fraction as part of a whole and locate simple fractions on a number line',  strand: 'FDP', isStretch: false, sortOrder: 600 },
    { code: 'N4.2',  name: 'Generate equivalent fractions',                                                          strand: 'FDP', isStretch: false, sortOrder: 610 },
    { code: 'N4.3',  name: 'Simplify a fraction using factors/HCF',                                                  strand: 'FDP', isStretch: false, sortOrder: 620 },
    { code: 'N4.4',  name: 'Convert a fraction to a decimal (terminating decimals)',                                  strand: 'FDP', isStretch: false, sortOrder: 630 },
    { code: 'N4.5',  name: 'Convert a decimal to a fraction (simple/terminating)',                                   strand: 'FDP', isStretch: false, sortOrder: 640 },
    { code: 'N4.6',  name: 'Convert a decimal to a percentage and a percentage to a decimal',                        strand: 'FDP', isStretch: false, sortOrder: 650 },
    { code: 'N4.7',  name: 'Convert a fraction to a percentage (via decimal or equivalence to /100)',                strand: 'FDP', isStretch: false, sortOrder: 660 },
    { code: 'N4.8',  name: 'Compare and order fractions, decimals and percentages',                                  strand: 'FDP', isStretch: false, sortOrder: 670 },
    { code: 'N4.9',  name: 'Find a percentage of an amount (using non-calculator-friendly methods)',                  strand: 'FDP', isStretch: false, sortOrder: 680 },
  ];

  // 4️⃣ Upsert skills and build code→id map
  const skillMap = new Map<string, string>();
  for (const def of skillDefs) {
    const slug = def.code.toLowerCase().replace('.', '-');
    const skill = await prisma.skill.upsert({
      where: { subjectId_code: { subjectId: subject.id, code: def.code } },
      update: { name: def.name, strand: def.strand, isStretch: def.isStretch, sortOrder: def.sortOrder, slug },
      create: {
        code: def.code,
        name: def.name,
        slug,
        strand: def.strand,
        isStretch: def.isStretch,
        sortOrder: def.sortOrder,
        subjectId: subject.id,
      },
    });
    skillMap.set(def.code, skill.id);
  }

  // 5️⃣ SkillPrereq edges
  const prereqEdges: Array<{ parentCode: string; childCode: string; weight: number }> = [
    { parentCode: 'N1.3',  childCode: 'N1.9',  weight: 1 },
    { parentCode: 'N1.6',  childCode: 'N1.7',  weight: 1 },
    { parentCode: 'N1.3',  childCode: 'N1.7',  weight: 1 },
    { parentCode: 'N1.7',  childCode: 'N1.8',  weight: 1 },
    { parentCode: 'N1.6',  childCode: 'N1.11', weight: 1 },
    { parentCode: 'N1.9',  childCode: 'N1.11', weight: 1 },
    { parentCode: 'N1.9',  childCode: 'N1.13', weight: 1 },
    { parentCode: 'N1.13', childCode: 'N1.14', weight: 1 },
    { parentCode: 'N1.3',  childCode: 'N1.14', weight: 1 },
    { parentCode: 'N1.8',  childCode: 'N1.15', weight: 1 },
    { parentCode: 'N1.14', childCode: 'N1.15', weight: 1 },
    { parentCode: 'N1.11', childCode: 'N1.15', weight: 1 },
    { parentCode: 'N1.9',  childCode: 'N1.10', weight: 1 },
    { parentCode: 'N1.6',  childCode: 'N1.12', weight: 1 },
    { parentCode: 'N1.11', childCode: 'N1.12', weight: 1 },
    { parentCode: 'N1.10', childCode: 'N1.16', weight: 1 },
    { parentCode: 'N1.12', childCode: 'N1.16', weight: 1 },
    { parentCode: 'N1.3',  childCode: 'N1.5',  weight: 1 },
    { parentCode: 'N1.15', childCode: 'N1.5',  weight: 1 },
    { parentCode: 'N1.3',  childCode: 'N2.3',  weight: 1 },
    { parentCode: 'N1.6',  childCode: 'N2.5',  weight: 1 },
    { parentCode: 'N2.5',  childCode: 'N2.7',  weight: 1 },
    { parentCode: 'N2.5',  childCode: 'N2.8',  weight: 1 },
    { parentCode: 'N2.7',  childCode: 'N2.8',  weight: 1 },
    { parentCode: 'N2.5',  childCode: 'N2.11', weight: 1 },
    { parentCode: 'N2.11', childCode: 'N2.10', weight: 1 },
    { parentCode: 'N2.11', childCode: 'N2.12', weight: 1 },
    { parentCode: 'N2.11', childCode: 'N2.9',  weight: 1 },
    { parentCode: 'N2.9',  childCode: 'N2.13', weight: 1 },
    { parentCode: 'N1.3',  childCode: 'N2.14', weight: 1 },
    { parentCode: 'N1.3',  childCode: 'N2.15', weight: 1 },
    { parentCode: 'N1.6',  childCode: 'N3.3',  weight: 1 },
    { parentCode: 'N2.3',  childCode: 'N3.5',  weight: 1 },
    { parentCode: 'N3.5',  childCode: 'N3.15', weight: 1 },
    { parentCode: 'N1.6',  childCode: 'N3.15', weight: 1 },
    { parentCode: 'N3.15', childCode: 'N3.16', weight: 1 },
    { parentCode: 'N3.5',  childCode: 'N3.8',  weight: 1 },
    { parentCode: 'N3.8',  childCode: 'N3.18', weight: 1 },
    { parentCode: 'N3.8',  childCode: 'N3.19', weight: 1 },
    { parentCode: 'N1.6',  childCode: 'N3.19', weight: 1 },
    { parentCode: 'N3.19', childCode: 'N3.20', weight: 1 },
    { parentCode: 'N3.3',  childCode: 'N3.20', weight: 1 },
    { parentCode: 'N2.5',  childCode: 'N3.6',  weight: 1 },
    { parentCode: 'N3.5',  childCode: 'N3.6',  weight: 1 },
    { parentCode: 'N3.6',  childCode: 'N3.21', weight: 1 },
    { parentCode: 'N3.8',  childCode: 'N3.21', weight: 1 },
    { parentCode: 'N3.3',  childCode: 'N3.14', weight: 1 },
    { parentCode: 'N3.5',  childCode: 'N3.10', weight: 1 },
    { parentCode: 'N3.10', childCode: 'N3.11', weight: 1 },
    { parentCode: 'N3.10', childCode: 'N3.12', weight: 1 },
    { parentCode: 'N3.11', childCode: 'N3.13', weight: 1 },
    { parentCode: 'N3.11', childCode: 'N3.24', weight: 1 },
    { parentCode: 'N3.5',  childCode: 'N3.23', weight: 1 },
    { parentCode: 'N2.5',  childCode: 'N3.9',  weight: 1 },
    { parentCode: 'N2.7',  childCode: 'N3.9',  weight: 1 },
    { parentCode: 'N3.5',  childCode: 'N3.9',  weight: 1 },
    { parentCode: 'N3.23', childCode: 'N3.9',  weight: 1 },
    { parentCode: 'N2.3',  childCode: 'N3.22', weight: 1 },
    { parentCode: 'N2.5',  childCode: 'N3.22', weight: 1 },
    { parentCode: 'N2.7',  childCode: 'N3.22', weight: 1 },
    { parentCode: 'N3.3',  childCode: 'N1.17', weight: 1 },
    { parentCode: 'N1.17', childCode: 'N1.18', weight: 1 },
    { parentCode: 'N1.17', childCode: 'N1.19', weight: 1 },
    { parentCode: 'N1.6',  childCode: 'N1.19', weight: 1 },
    { parentCode: 'N1.18', childCode: 'N2.16', weight: 1 },
    { parentCode: 'N2.5',  childCode: 'N2.16', weight: 1 },
    { parentCode: 'N2.7',  childCode: 'N2.16', weight: 1 },
    { parentCode: 'N1.6',  childCode: 'N1.20', weight: 1 },
    // FDP prereqs
    { parentCode: 'N1.3',  childCode: 'N4.1',  weight: 1 },
    { parentCode: 'N1.9',  childCode: 'N4.1',  weight: 1 },
    { parentCode: 'N1.15', childCode: 'N4.1',  weight: 1 },
    { parentCode: 'N4.1',  childCode: 'N4.2',  weight: 1 },
    { parentCode: 'N3.10', childCode: 'N4.2',  weight: 1 },
    { parentCode: 'N4.2',  childCode: 'N4.3',  weight: 1 },
    { parentCode: 'N3.13', childCode: 'N4.3',  weight: 1 },
    { parentCode: 'N3.19', childCode: 'N4.4',  weight: 1 },
    { parentCode: 'N1.6',  childCode: 'N4.4',  weight: 1 },
    { parentCode: 'N4.3',  childCode: 'N4.4',  weight: 1 },
    { parentCode: 'N4.4',  childCode: 'N4.5',  weight: 1 },
    { parentCode: 'N1.6',  childCode: 'N4.5',  weight: 1 },
    { parentCode: 'N1.6',  childCode: 'N4.6',  weight: 1 },
    { parentCode: 'N3.3',  childCode: 'N4.6',  weight: 1 },
    { parentCode: 'N4.4',  childCode: 'N4.7',  weight: 1 },
    { parentCode: 'N4.2',  childCode: 'N4.7',  weight: 1 },
    { parentCode: 'N4.3',  childCode: 'N4.8',  weight: 1 },
    { parentCode: 'N1.15', childCode: 'N4.8',  weight: 1 },
    { parentCode: 'N4.6',  childCode: 'N4.8',  weight: 1 },
    { parentCode: 'N4.7',  childCode: 'N4.8',  weight: 1 },
    { parentCode: 'N2.5',  childCode: 'N4.9',  weight: 1 },
    { parentCode: 'N3.5',  childCode: 'N4.9',  weight: 1 },
    { parentCode: 'N4.6',  childCode: 'N4.9',  weight: 1 },
  ];

  for (const edge of prereqEdges) {
    const childId = skillMap.get(edge.childCode);
    const parentId = skillMap.get(edge.parentCode);
    if (!childId || !parentId) {
      console.warn(`⚠️  Skipping prereq ${edge.parentCode} → ${edge.childCode}: skill not found`);
      continue;
    }
    await prisma.skillPrereq.upsert({
      where: { skillId_prereqId: { skillId: childId, prereqId: parentId } },
      update: { weight: edge.weight },
      create: { skillId: childId, prereqId: parentId, weight: edge.weight },
    });
  }

  // 6️⃣ Placeholder MCQ items per skill (2 per skill, idempotent by question text)
  for (const def of skillDefs) {
    const skillId = skillMap.get(def.code);
    if (!skillId) continue;
    const placeholderItems = [
      {
        question: `[${def.code}] Placeholder question 1 for: ${def.name}`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        answer: 'Option A',
      },
      {
        question: `[${def.code}] Placeholder question 2 for: ${def.name}`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        answer: 'Option A',
      },
    ];
    for (const itemData of placeholderItems) {
      let item = await prisma.item.findFirst({
        where: { question: itemData.question },
      });
      if (!item) {
        item = await prisma.item.create({
          data: {
            question: itemData.question,
            options: itemData.options,
            answer: itemData.answer,
            type: 'MCQ',
            subjectId: subject.id,
          },
        });
      }
      await prisma.itemSkill.upsert({
        where: { itemId_skillId: { itemId: item.id, skillId } },
        update: {},
        create: { itemId: item.id, skillId },
      });
    }
  }

  // 7️⃣ Real N1.1 item set (diagnostic + shadow + key questions)
  const n11SkillId = skillMap.get('N1.1');
  if (n11SkillId) {
    const n11RealItems: Array<{
      question: string;
      type: string;
      options: unknown;
      answer: string;
      misconceptionMap?: Record<string, string>;
    }> = [
      {
        question: 'N1.1 DQ1: What is the value of the digit 7 in 3,742,915?',
        type: 'MCQ',
        options: {
          choices: ['700000', '70000', '7000', '7'],
          meta: { role: 'anchor', misconception_tag: 'm1', transfer_level: 'none' },
        },
        answer: '700000',
        misconceptionMap: { '70000': 'm2', '7000': 'm3', '7': 'm4' },
      },
      {
        question: 'N1.1 DQ2: In 504,081, what is the place value of digit 4?',
        type: 'MCQ',
        options: {
          choices: ['thousands', 'ten-thousands', 'hundreds', 'ones'],
          meta: { role: 'misconception', misconception_tag: 'm2', transfer_level: 'none' },
        },
        answer: 'thousands',
      },
      {
        question: 'N1.1 DQ3: Write 8,030,406 in expanded form.',
        type: 'SHORT_TEXT',
        options: { meta: { role: 'prerequisite_probe', misconception_tag: 'm2', transfer_level: 'low' } },
        answer: '8000000 + 30000 + 400 + 6',
      },
      {
        question: 'N1.1 DQ4: Which number has digit 5 worth 50,000?',
        type: 'MCQ',
        options: {
          choices: ['5,203,410', '1,052,340', '305,214', '250,431'],
          meta: { role: 'transfer', misconception_tag: 'm3', transfer_level: 'medium' },
        },
        answer: '1,052,340',
      },
      {
        question: 'N1.1 SC-A1: What is the value of 8 in 1,863,205?',
        type: 'SHORT_NUMERIC',
        options: { meta: { role: 'shadow', route: 'A' } },
        answer: '800000',
      },
      {
        question: 'N1.1 SC-A2: What place is digit 9 in 4,719,300?',
        type: 'SHORT_TEXT',
        options: { meta: { role: 'shadow', route: 'A' } },
        answer: 'thousands',
      },
      {
        question: 'N1.1 SC-B1: Write 6,040,070 in expanded form.',
        type: 'SHORT_TEXT',
        options: { meta: { role: 'shadow', route: 'B' } },
        answer: '6000000 + 40000 + 70',
      },
      {
        question: 'N1.1 SC-B2: Select the number where 3 represents 300,000.',
        type: 'MCQ',
        options: {
          choices: ['3,041,220', '130,422', '43,021', '703,012'],
          meta: { role: 'shadow', route: 'B' },
        },
        answer: '3,041,220',
      },
      {
        question: 'N1.1 SC-C1: Correct this: In 2,701,450 the value of 7 is 700,000.',
        type: 'SHORT_NUMERIC',
        options: { meta: { role: 'shadow', route: 'C' } },
        answer: '700000',
      },
      {
        question: 'N1.1 SC-C2: Which value of 5 is correct in 950,214?',
        type: 'MCQ',
        options: {
          choices: ['5', '50', '5000', '50000'],
          meta: { role: 'shadow', route: 'C' },
        },
        answer: '50000',
      },
    ];

    for (const itemData of n11RealItems) {
      let item = await prisma.item.findFirst({ where: { question: itemData.question, subjectId: subject.id } });
      if (!item) {
        item = await prisma.item.create({
          data: {
            question: itemData.question,
            type: itemData.type,
            options: itemData.options as object,
            answer: itemData.answer,
            misconceptionMap: itemData.misconceptionMap as object | undefined,
            subjectId: subject.id,
          },
        });
      } else {
        await prisma.item.update({
          where: { id: item.id },
          data: {
            type: itemData.type,
            options: itemData.options as object,
            answer: itemData.answer,
            misconceptionMap: itemData.misconceptionMap as object | undefined,
          },
        });
      }

      await prisma.itemSkill.upsert({
        where: { itemId_skillId: { itemId: item.id, skillId: n11SkillId } },
        update: {},
        create: { itemId: item.id, skillId: n11SkillId },
      });
    }

    // 8️⃣ N1.1 misconception maps + explanation routes (A/B/C)
    const n11Items = await prisma.item.findMany({
      where: {
        subjectId: subject.id,
        question: { startsWith: 'N1.1 ' },
      },
      select: { id: true, options: true },
    });

    for (const item of n11Items) {
      const options = (item.options as string[]) ?? [];
      const map: Record<string, string> = {};
      if (options[0]) map[options[0]] = 'm1';
      if (options[1]) map[options[1]] = 'm2';
      if (options[2]) map[options[2]] = 'm3';
      if (options[3]) map[options[3]] = 'm4';
      await prisma.item.update({ where: { id: item.id }, data: { misconceptionMap: map } });
    }

    const interactionTypeMap = {
      placeValue: await prisma.interactionType.upsert({
        where: { key_version: { key: 'place_value_select', version: 'v1' } },
        update: { rendererKey: 'place_value_select.v1' },
        create: { key: 'place_value_select', version: 'v1', rendererKey: 'place_value_select.v1' },
      }),
      compareColumns: await prisma.interactionType.upsert({
        where: { key_version: { key: 'compare_columns', version: 'v1' } },
        update: { rendererKey: 'compare_columns.v1' },
        create: { key: 'compare_columns', version: 'v1', rendererKey: 'compare_columns.v1' },
      }),
      decomposeNumber: await prisma.interactionType.upsert({
        where: { key_version: { key: 'decompose_number', version: 'v1' } },
        update: { rendererKey: 'decompose_number.v1' },
        create: { key: 'decompose_number', version: 'v1', rendererKey: 'decompose_number.v1' },
      }),
    };

    const routeDefs = [
      {
        routeType: 'A',
        misconceptionSummary: 'You may be misreading place value columns when comparing or building numbers.',
        workedExample: '3,540 has 3 thousands, 5 hundreds, 4 tens, 0 ones, so it is greater than 3,450.',
        guidedPrompt: 'In 6,204, what value does the 2 represent?',
        guidedAnswer: '200',
        steps: [
          ['Identify columns', 'Read thousands, hundreds, tens, ones left to right.', 'In 4,381, what is the hundreds digit?', ['3', '8', '4', '1'], '3', 'Use a place-value grid and point to the hundreds column before selecting.'],
          ['Compare highest column first', 'Compare thousands first; move right only if equal.', 'Which is greater?', ['5,203', '5,123', 'Same', 'Cannot tell'], '5,203', 'Thousands are tied at 5; compare hundreds next: 2 is greater than 1.'],
          ['Check tricky middle columns', 'Tens and hundreds are often swapped; name each before deciding.', 'In 7,460, the 6 is worth…', ['6', '60', '600', '6000'], '60', 'Say it aloud: 7 thousand, 4 hundred, 6 tens, 0 ones.'],
        ],
      },
      {
        routeType: 'B',
        misconceptionSummary: 'You may be applying a shortcut that breaks when digits shift columns.',
        workedExample: '2,908 vs 2,980: first difference is tens (0 vs 8), so 2,980 is greater.',
        guidedPrompt: 'Which is greater: 8,307 or 8,370?',
        guidedAnswer: '8,370',
        steps: [
          ['Use a compare frame', 'Align numbers by column in a place-value table.', 'Which column is checked first?', ['Ones', 'Tens', 'Hundreds', 'Thousands'], 'Thousands', 'Start at the biggest place value first to avoid noisy lower-digit distractions.'],
          ['Find first difference', 'Move left to right and stop at first non-match.', 'First different column in 4,125 and 4,175?', ['Thousands', 'Hundreds', 'Tens', 'Ones'], 'Tens', 'Columns match at thousands and hundreds; the first change appears in tens (2 vs 7).'],
          ['Decide and justify', 'Bigger digit at first difference means bigger number.', 'Which is greater?', ['9,041', '9,401', 'Same', 'Cannot tell'], '9,401', 'At hundreds, 4 beats 0; you can decide before checking tens/ones.'],
        ],
      },
      {
        routeType: 'C',
        misconceptionSummary: 'You may be reversing place value logic, giving too much weight to ones.',
        workedExample: '1,090 is greater than 1,009 because tens are more valuable than ones.',
        guidedPrompt: 'In 5,072, is the 7 worth 7 or 70?',
        guidedAnswer: '70',
        steps: [
          ['Bigger column bigger impact', 'A change in tens beats a change in ones.', 'Which change is bigger?', ['+1 one', '+1 ten', 'Same', 'Depends'], '+1 ten', 'One ten equals ten ones, so +1 ten always has greater effect.'],
          ['Value by position', 'The same digit has different value in different columns.', 'In 3,604 the 6 is worth…', ['6', '60', '600', '6000'], '600', 'Read the column name first: the 6 is in hundreds, so value is 600.'],
          ['Near-miss practice', 'Use similar-looking pairs to lock in place value logic.', 'Which is greater?', ['6,090', '6,009', 'Same', 'Cannot tell'], '6,090', 'Compare tens: 9 tens is bigger than 0 tens, so 6,090 is larger.'],
        ],
      },
    ] as const;

    for (const routeDef of routeDefs) {
      const route = await prisma.explanationRoute.upsert({
        where: { skillId_routeType: { skillId: n11SkillId, routeType: routeDef.routeType } },
        update: {
          misconceptionSummary: routeDef.misconceptionSummary,
          workedExample: routeDef.workedExample,
          guidedPrompt: routeDef.guidedPrompt,
          guidedAnswer: routeDef.guidedAnswer,
          isActive: true,
        },
        create: {
          skillId: n11SkillId,
          routeType: routeDef.routeType,
          misconceptionSummary: routeDef.misconceptionSummary,
          workedExample: routeDef.workedExample,
          guidedPrompt: routeDef.guidedPrompt,
          guidedAnswer: routeDef.guidedAnswer,
          isActive: true,
        },
      });

      for (let i = 0; i < routeDef.steps.length; i++) {
        const stepTuple = routeDef.steps[i] as readonly [string, string, string, readonly string[], string, string?];
        const [title, explanation, checkpointQuestion, checkpointOptionsRaw, checkpointAnswer, customAlternativeHint] = stepTuple;
        const checkpointOptions = [...checkpointOptionsRaw];
        const alternativeHint = customAlternativeHint ?? `Try this: ${explanation}`;

        const stepType = i === 0 ? 'visual_demo' : i === routeDef.steps.length - 1 ? 'transfer_check' : 'guided_action';
        const visualType = routeDef.routeType === 'A' ? 'place_value_grid' : routeDef.routeType === 'B' ? 'compare_columns' : 'decompose_number';
        const visualPayload =
          routeDef.routeType === 'A'
            ? { number: i === 0 ? '4381' : i === 1 ? '5203' : '7460' }
            : routeDef.routeType === 'B'
              ? i === 0
                ? { left: '8307', right: '8370' }
                : i === 1
                  ? { left: '4125', right: '4175' }
                  : { left: '9041', right: '9401' }
              : { number: i === 0 ? '1090' : i === 1 ? '3604' : '6090' };

        const checkpointOptionsPayload = {
          options: checkpointOptions,
          stepType,
          visualType,
          visualPayload,
        };

        const step = await prisma.explanationStep.upsert({
          where: { explanationRouteId_stepOrder: { explanationRouteId: route.id, stepOrder: i + 1 } },
          update: { title, explanation, stepType, checkpointQuestion, checkpointOptions: checkpointOptionsPayload, checkpointAnswer, alternativeHint },
          create: {
            explanationRouteId: route.id,
            stepOrder: i + 1,
            title,
            explanation,
            stepType,
            checkpointQuestion,
            checkpointOptions: checkpointOptionsPayload,
            checkpointAnswer,
            alternativeHint,
          },
        });

        const interactionTypeId =
          routeDef.routeType === 'A'
            ? interactionTypeMap.placeValue.id
            : routeDef.routeType === 'B'
              ? interactionTypeMap.compareColumns.id
              : interactionTypeMap.decomposeNumber.id;

        const completionRule =
          routeDef.routeType === 'A'
            ? { kind: 'selection_required' }
            : routeDef.routeType === 'B'
              ? { kind: 'first_difference_correct' }
              : { kind: 'all_parts_selected' };

        await prisma.stepInteraction.upsert({
          where: { explanationStepId_sortOrder: { explanationStepId: step.id, sortOrder: 1 } },
          update: {
            interactionTypeId,
            config: visualPayload,
            completionRule,
          },
          create: {
            explanationStepId: step.id,
            sortOrder: 1,
            interactionTypeId,
            config: visualPayload,
            completionRule,
          },
        });
      }
    }
  }

  console.log('✅ Seed complete:', {
    student: student.email,
    subject: subject.title,
    skills: skillDefs.length,
    prereqEdges: prereqEdges.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
