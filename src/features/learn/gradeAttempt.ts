export function gradeAttempt(correctAnswer: string, submittedAnswer: string): boolean {
  return correctAnswer.trim().toLowerCase() === submittedAnswer.trim().toLowerCase();
}
