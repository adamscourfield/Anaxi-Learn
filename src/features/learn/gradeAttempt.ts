function normalizeAnswer(input: string): string {
  return input
    .toLowerCase()
    .replace(/,/g, ' ')
    .replace(/\band\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function gradeAttempt(correctAnswer: string, submittedAnswer: string): boolean {
  return normalizeAnswer(correctAnswer) === normalizeAnswer(submittedAnswer);
}
