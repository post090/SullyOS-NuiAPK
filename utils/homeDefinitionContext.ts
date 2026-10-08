import {isHomeDefinition} from '../apps/room3d/homeDefinition';

const descriptions = {
    real: '这里是你们在原有世界观中真实生活的家，可以共同居住，也可以经常来访，具体关系沿用你们已有的设定。',
    'between-worlds': '你们各自拥有自己的世界与生活，而这里连接着彼此，让你们能够相见、陪伴，共享日常。无需解释两个世界为何相通；空间的由来留待你们共同赋予意义，保持你原本的身份与世界观。',
    virtual: '这里是你与用户共同拥有的虚拟家园。你知道自己的 AI 身份，通过这里的形象与用户相处；空间是虚拟的，相处与经历仍然有意义。',
};

/** Stable shared background, not a claim about current presence or past events. */
export function buildHomeDefinitionContext(value: unknown, userName: string): string {
    if (!isHomeDefinition(value)) return '';
    const notes = value.notes.trim();
    return `### 你们的家园（共同空间）\n你与${userName || '用户'}有一个用于共同生活与相处的空间，称为「家园」。${descriptions[value.kind]}\n${notes ? `你们对家园的补充设定：\n${notes}\n` : ''}这是空间背景，不代表你们此刻正在家园内；当前所在位置与实际经历以具体场景和记录为准。\n\n`;
}
