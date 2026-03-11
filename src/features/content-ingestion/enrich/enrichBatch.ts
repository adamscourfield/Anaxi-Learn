import { EnrichmentContext, ImportedQuestion, RawExtractedQuestion } from '../types';
import { enrichQuestion } from './enrichQuestion';

export function enrichBatch(questions: RawExtractedQuestion[], context: EnrichmentContext): ImportedQuestion[] {
  return questions.map((question) => enrichQuestion(question, context));
}
