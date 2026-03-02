import { prisma } from '@/db/prisma';
import { EventPayloadSchemas } from '@/contracts/events';

interface EmitEventParams {
  name: string;
  actorUserId?: string;
  studentUserId?: string;
  subjectId?: string;
  skillId?: string;
  itemId?: string;
  attemptId?: string;
  payload: Record<string, unknown>;
}

export async function emitEvent(params: EmitEventParams): Promise<void> {
  const schema = EventPayloadSchemas[params.name];
  if (schema) {
    schema.parse(params.payload);
  }

  await prisma.event.create({
    data: {
      name: params.name,
      actorUserId: params.actorUserId,
      studentUserId: params.studentUserId,
      subjectId: params.subjectId,
      skillId: params.skillId,
      itemId: params.itemId,
      attemptId: params.attemptId,
      payload: params.payload as object,
    },
  });
}
