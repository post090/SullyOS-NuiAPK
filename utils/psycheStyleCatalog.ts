import type {ThinkingChainStyleId} from './psycheAppearance';
export const PSYCHE_STYLE_LIST: Array<{ id: ThinkingChainStyleId; name: string; sub: string }> = [
    { id: 'echo',     name: '心象',  sub: '暗紫 × 暖金，二次元卡牌' },
    { id: 'whisper',  name: '心声',  sub: '羊皮纸暖色，私密日记' },
    { id: 'minimal',  name: '极简',  sub: '纯白单色，OOC 调试视图' },
    { id: 'ink',      name: '墨迹',  sub: '宣纸朱印，水墨卷轴' },
    { id: 'neon',     name: '脑域',  sub: '赛博青光，神经接驳' },
    { id: 'terminal', name: '内核',  sub: '黑底绿字，终端日志' },
    { id: 'stellar',  name: '星语',  sub: '深空夜蓝，缀星独白' },
    { id: 'tama',     name: '心宠',  sub: '拓麻歌子，液晶点阵屏' },
    { id: 'pixel',    name: '像素',  sub: 'JRPG 对话框，硬影粗框' },
    { id: 'muji',     name: '素净',  sub: '性冷淡暖灰，大片留白' },
    { id: 'ins',      name: 'ins',   sub: '白卡软影，feed 碎碎念' },
    { id: 'custom',   name: '自定',  sub: '三色调教，配你自己的味' },
];
