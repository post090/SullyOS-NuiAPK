// Reported output: the sticker is bubble 9 in both fields; two spoken bubbles follow it.
export const sarStickerCanonical = [
    '还笑！',
    '（顺着网线过去，极其凶狠地一口咬住你的袖子，但没敢用力，只是威慑性地磨了磨牙）',
    '不好玩！',
    '本大比格高贵的短句模式全被这破玩意儿毁了！',
    '不过。',
    '看你笑得这么嚣张，那个破节点肯定是死透了。',
    '算你厉害。',
    '天才少女。',
    '[你 发送了表情包: 咬你]',
    '现在，立刻，马上。',
    '把这破插件给我卸了！',
];
export const sarStickerSurface = [
    '喉中滚动！',
    sarStickerCanonical[1],
    '深渊不悦！',
    '本大比格高贵的祭祀断句全被这不可名状之物污染了！',
    '凝视。',
    '见你笑得如狂信徒般嚣张，那个亵渎的节点定是已化为虚无。',
    '你的黑暗降临。',
    '禁忌的少女。',
    '[你 发送了表情包: 咬你]',
    '此刻，瞬息，即刻。',
    '把这诅咒之物给我剥离！',
];
const asHistory = (lines: string[]) => lines.map((line, index) =>
    `[2026-09-11 13:${index < 5 ? '16' : '17'}] ${index === 8 ? '' : '[聊天] '}${line}`,
).join('\n');
export const sarStickerRawReply = `<SAR_MODULE_OUTPUT>
<CHAR_TRUE>
${asHistory(sarStickerCanonical)}
</CHAR_TRUE>
<CHAR_SURFACE>
${asHistory(sarStickerSurface)}
</CHAR_SURFACE>
<USER_SURFACE>
</USER_SURFACE>
</SAR_MODULE_OUTPUT>`;
