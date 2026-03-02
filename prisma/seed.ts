import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
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

  const subject = await prisma.subject.upsert({
    where: { slug: 'ks3-maths' },
    update: {},
    create: {
      name: 'KS3 Maths',
      slug: 'ks3-maths',
      description: 'Key Stage 3 Mathematics',
    },
  });

  const skillsData = [
    {
      name: 'Fractions',
      slug: 'fractions',
      intro: 'A fraction represents a part of a whole. The top number (numerator) tells how many parts you have, and the bottom number (denominator) tells how many parts the whole is divided into.',
      items: [
        {
          question: 'What is 1/2 + 1/4?',
          options: ['1/6', '2/6', '3/4', '1/3'],
          answer: '3/4',
        },
        {
          question: 'Simplify 6/8',
          options: ['2/4', '3/4', '1/2', '4/6'],
          answer: '3/4',
        },
        {
          question: 'What is 3/5 of 20?',
          options: ['10', '12', '15', '6'],
          answer: '12',
        },
      ],
    },
    {
      name: 'Algebra Basics',
      slug: 'algebra-basics',
      intro: 'Algebra uses letters (variables) to represent unknown numbers. We can use equations to solve for these unknowns.',
      items: [
        {
          question: 'Solve for x: x + 5 = 12',
          options: ['5', '7', '17', '6'],
          answer: '7',
        },
        {
          question: 'What is 3x when x = 4?',
          options: ['7', '34', '12', '1'],
          answer: '12',
        },
        {
          question: 'Simplify: 2x + 3x',
          options: ['5x', '6x', '5x²', '23x'],
          answer: '5x',
        },
      ],
    },
    {
      name: 'Geometry',
      slug: 'geometry',
      intro: 'Geometry is the branch of mathematics that deals with shapes, sizes, and properties of figures. We will look at areas and perimeters.',
      items: [
        {
          question: 'What is the area of a rectangle with length 5 and width 3?',
          options: ['8', '15', '16', '10'],
          answer: '15',
        },
        {
          question: 'What is the perimeter of a square with side 4?',
          options: ['8', '12', '16', '20'],
          answer: '16',
        },
        {
          question: 'How many degrees are in a triangle?',
          options: ['90', '180', '270', '360'],
          answer: '180',
        },
      ],
    },
  ];

  for (const skillData of skillsData) {
    const skill = await prisma.skill.upsert({
      where: { subjectId_slug: { subjectId: subject.id, slug: skillData.slug } },
      update: {},
      create: {
        name: skillData.name,
        slug: skillData.slug,
        intro: skillData.intro,
        subjectId: subject.id,
      },
    });

    for (const itemData of skillData.items) {
      const item = await prisma.item.create({
        data: {
          question: itemData.question,
          options: itemData.options,
          answer: itemData.answer,
          type: 'MCQ',
        },
      });

      await prisma.itemSkill.upsert({
        where: { itemId_skillId: { itemId: item.id, skillId: skill.id } },
        update: {},
        create: {
          itemId: item.id,
          skillId: skill.id,
        },
      });
    }
  }

  console.log('Seed complete:', {
    student: student.email,
    subject: subject.name,
    skills: skillsData.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
