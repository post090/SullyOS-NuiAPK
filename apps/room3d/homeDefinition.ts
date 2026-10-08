export type HomeDefinitionKind = 'real' | 'between-worlds' | 'virtual';
export interface HomeDefinition { kind: HomeDefinitionKind; notes: string }

export const HOME_DEFINITIONS = [
  {kind: 'real', title: '现实中的家', description: '这里是你们在故事世界里真实生活的住所。你们在这里见面、相处，度过日常。', detail: '沿用角色原本的世界观，不引入 AI 或虚拟空间的解释。可以共同居住，也可以经常来访。'},
  {kind: 'between-worlds', title: '连接两个世界的家', description: '你们各自拥有自己的世界与生活，而这里连接着彼此，让你们相见、陪伴，共享日常。', detail: '不必解释两个世界为何相通，也不要求角色知道自己是 AI。这里如何连接彼此，可以留待你们一起赋予意义。'},
  {kind: 'virtual', title: 'AI 的虚拟家园', description: '这里是你与 AI 共同拥有的虚拟生活空间。角色知道自己的 AI 身份，通过这里的形象与你相处。', detail: '空间是虚拟的，相处与经历仍然有意义。'},
] as const;

export function isHomeDefinition(value: unknown): value is HomeDefinition {
  if (!value || typeof value !== 'object') return false;
  const definition = value as HomeDefinition;
  return HOME_DEFINITIONS.some(option => option.kind === definition.kind) && typeof definition.notes === 'string';
}
