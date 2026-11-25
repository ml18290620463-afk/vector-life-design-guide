import { commitAvatarOntology } from './avatarOntologyStore';

/** A guardrail is advisory and stays off until the user explicitly enables it. */
export async function setAvatarGuardrailEnabled(
  expectedRevision: number,
  objectId: string,
  enabled: boolean,
) {
  return commitAvatarOntology(expectedRevision, (graph) => {
    const object = graph.objects.find((item) => item.id === objectId);
    if (!object || object.status !== 'confirmed' || !object.guardrail)
      throw new Error('认知资料校验失败：仅可切换已确认的个人护栏');
    object.guardrail.enabled = enabled;
    object.updatedAt = new Date().toISOString();
  });
}
