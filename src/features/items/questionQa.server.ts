import { summarizeQuestionQa } from './questionQa';

export function buildQaItemView(item: {
  id: string;
  question: string;
  type: string;
  answer: string;
  options: unknown;
  skills: Array<{ skill: { code: string } }>;
  reviewNotes: Array<{
    id: string;
    status: 'OPEN' | 'RESOLVED';
    category: 'ANSWER_MODE' | 'ANSWER_MAPPING' | 'STEM_COPY' | 'DISTRACTOR_QUALITY' | 'SKILL_MAPPING' | 'OTHER';
    note: string;
    createdAt: Date;
    resolvedAt: Date | null;
    author: { name: string | null; email: string };
  }>;
}) {
  const summary = summarizeQuestionQa(item);

  return {
    id: item.id,
    question: item.question,
    displayQuestion: summary.displayQuestion,
    type: item.type,
    answerType: summary.answerType,
    answerModeLabel: summary.answerModeLabel,
    answer: item.answer,
    options: item.options,
    skills: item.skills.map((entry) => entry.skill.code),
    issues: summary.issues,
    reviewNotes: item.reviewNotes.map((note) => ({
      id: note.id,
      status: note.status,
      category: note.category,
      note: note.note,
      createdAt: note.createdAt.toISOString(),
      resolvedAt: note.resolvedAt?.toISOString() ?? null,
      authorLabel: note.author.name ?? note.author.email,
    })),
  };
}
