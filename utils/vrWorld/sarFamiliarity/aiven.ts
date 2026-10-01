import { formatSARDialogue } from './dialogueText';
import type { AivenExpression, CaianExpression } from '../sarArt';
import type { FamiliarityDailyLines, FamiliarityLine, FamiliarityNode, FamiliarityRank, FamiliarityReward, FamiliarityScene } from './types';

const a = (text: string, expression: AivenExpression = 'normal', sentenceExpressions?: AivenExpression[]): FamiliarityLine => ({ speaker: 'aiven', text: formatSARDialogue(text), expression, ...(sentenceExpressions ? { sentenceExpressions } : {}) });
const c = (text: string, expression: CaianExpression = 'normal', sentenceExpressions?: CaianExpression[]): FamiliarityLine => ({ speaker: 'caian', text: formatSARDialogue(text), expression, ...(sentenceExpressions ? { sentenceExpressions } : {}) });
const n = (text: string): FamiliarityLine => ({ speaker: 'narrator', text });
type Reply = [label: string, lines: FamiliarityLine[], rewards?: FamiliarityReward[]];

/** The source's short bracket labels are joined to their full displayed choices here. */
function topic(id: string, rank: FamiliarityRank, title: string, lines: FamiliarityLine[], replies: Reply[]): FamiliarityScene {
    const nodes: Record<string, FamiliarityNode> = {
        start: { lines, choices: replies.map(([label], index) => ({ label, next: `reply-${index}` })) },
    };
    replies.forEach(([, reply, rewards], index) => { nodes[`reply-${index}`] = { lines: reply, ...(rewards ? { rewards } : {}) }; });
    return { id, npc: 'aiven', rank, kind: 'topic', title, start: 'start', nodes };
}

const topics: FamiliarityScene[] = [
    topic('A1-01', 1, '要坐吗', [a('要坐吗？')], [
        ['坐', [a('嗯。这里不会晒到太阳。')]],
        ['不坐', [a('嗯。')]],
        ['你让一下', [a('……好。别踩到鱼竿。')]],
    ]),
    topic('A1-02', 1, '不用说话', [a('……'), a('不用一直找话说。')], [
        ['那我不说了', [a('嗯。')]],
        ['你倒是说点什么', [a('……。')]],
        ['……', [a('……')]],
    ]),
    topic('A1-03', 1, '鱼没有七秒记忆', [a('鱼不是只有七秒记忆。', 'interested'), a('有些鱼能记住路线、食物的位置，也能分辨其他个体。', 'interested')], [
        ['你怎么突然说这个', [a('刚想到。')]],
        ['原来如此', [a('嗯。七秒那个说法对鱼不太公平。', 'interested')]],
        ['你是谁哟', [a('也的确有一些鱼记忆力不太行。', "interested"), a('你学得很像。', "happy")]],
    ]),
    topic('A1-04', 1, '鱼会睡觉', [a('鱼也会睡。只是大部分鱼没有眼皮。', 'interested')], [
        ['那怎么看它睡没睡', [a('活动减少，对刺激反应变慢。', 'interested'), a('现在这只睡着了……别吵它。', 'interested')]],
        ['好怪', [a('对鱼来说，人闭着眼睛睡，可能也很怪。')]],
        ['Zzzzzzz', [a('晚安。')]],
    ]),
    topic('A1-05', 1, '霸王龙的手', [a('霸王龙前肢很短，但肌肉其实很发达。', 'interested')], [
        ['那这只呢', [a('它的手只是两块胶泥。')]],
        ['你喜欢霸王龙？', [a('还行。很经典。', 'interested')]],
        ['它正在炒外汇', [a('嗯。难怪一直不动。', "normal", ["normal","happy"])]],
    ]),
    topic('A1-06', 1, '三角龙的角', [a('三角龙的角可能不只是用来打架，也可能用于展示或者识别同类。', 'interested')], [
        ['你确定？', [a('不能完全确定。恐龙没有留下说明书。', 'interested')]],
        ['恐龙也看脸？', [a('可能也看角。')]],
        ['也可以用来挂衣服！', [a('看来它拥有了良好的职业规划。', "happy")]],
    ]),
    topic('A1-07', 1, '下雨', [a('你那里在下雨吗。')], [
        ['你喜欢下雨？', [a('嗯。雨在的时候，不说话也不会太安静。', 'happy')]],
        ['这里会下吗？', [a('你那里下雨的话，这里也会。')]],
        ['没错，我们那里已经被淹成地中海了。', [a('那你说话的时候会吐泡泡。'), a('就像鱼一样。')]],
    ]),
    topic('A1-08', 1, '空军', [a('今天没钓到。', 'sad')], [
        ['遗憾', [a('明天再来。', 'sad'), a('…稍微有点不甘心', 'sad')]],
        ['算了', [a('嗯。'), a('明天继续')]],
        ['鱼赢了', [a('嗯。今天它赢了。')]],
    ]),
    topic('A1-09', 1, '为什么有橡皮泥恐龙', [a('刚才又钓到一只恐龙。', 'interested')], [
        ['为什么水里会有橡皮泥恐龙？', [a('不知道。所以才要继续钓。', 'interested')]],
        ['比鱼好吗？', [a('不一样……但挺好。', 'happy')]],
        ['给我！', [a('嗯。拿去。')], [{ kind: 'dinosaur' }]],
    ]),
    {
        id: 'A1-10', npc: 'aiven', rank: 1, kind: 'topic', title: '今天钓到了……', start: 'start',
        nodes: {
            // The manuscript supplies one reveal after three questions; all three lead to it.
            start: { lines: [a('刚才钓到了一个东西。')], choices: ['什么？', '鱼？', '恐龙？'].map(label => ({ label, next: 'card' })) },
            card: { lines: [a('一张角色卡。')], choices: [
                { label: '啊？', next: 'surprise' }, { label: '谁的？', next: 'whose' }, { label: '给我看看！', next: 'look' },
            ] },
            surprise: { lines: [a('嗯。')] },
            whose: { lines: [a('不知道。字泡掉了。')] },
            look: { lines: [a('刚才又掉回去了……下次吧。')] },
        },
    },
    {
        id: 'A2-01', npc: 'aiven', rank: 2, kind: 'topic', title: '你喜欢哪只', start: 'start',
        nodes: {
            start: { lines: [a('你最喜欢哪只恐龙？', 'interested')], choices: ['霸王龙', '三角龙', '剑龙', '说不上来'].map(label => ({ label, next: 'remember', flags: { 'aiven-favorite-dinosaur': label } })) },
            remember: { lines: [a('嗯。记住了。', 'interested')], choices: [{ label: '为什么？', next: 'why' }] },
            why: { lines: [a('以后钓到重复的先给你。')] },
        },
    },
    topic('A2-02', 2, '禽龙的大拇指', [a('以前有人以为禽龙的大拇指尖刺是它的鼻角。', 'interested'), a('所以很长一段时间，禽龙的科学复原图上都有这么一个类似犀牛的角。', 'interested')], [
        ['好蠢', [a('现在看是有点。')]],
        ['也不能怪他们', [a('嗯。没有更多化石的时候只能猜。', 'interested')]],
        ['我觉得鼻子上更帅！', [a('……那只橡皮泥禽龙可以这么装。')]],
    ]),
    topic('A2-03', 2, '伶盗龙有羽毛', [a('真正的伶盗龙比电影里小，而且有羽毛。', 'interested')], [
        ['那这只橡皮泥的捏错了', [a('嗯。不准确也可以留下。')]],
        ['羽毛也可爱', [a('我也觉得。', 'happy')]],
        ['给它粘羽毛！', [a('可以。', 'interested'), a('别用真鸟的。')]],
    ]),
    topic('A2-04', 2, '你改过箱庭', [a('你重新摆过箱庭了吗。')], [
        ['好看吗？', [a('嗯。这里比之前好。', 'happy')]],
        ['你不喜欢？', [a('没有。只是看出来了。')]],
        ['现在霸王龙是财务总监', [a('嗯。那有些恐龙会失业了。')]],
    ]),
    topic('A2-05', 2, '凯恩来过', [a('凯恩刚刚动了那只恐龙。')], [
        ['你没阻止？', [a('为什么阻止。')]],
        ['他放哪了？', [a('那边。他可能觉得那边更好。')]],
        ['一直在挑衅我！', [a('可能的确是这样。')]],
    ]),
    topic('A2-06', 2, '鱼认人', [a('有些鱼能分辨不同的人。养久了会知道谁经常来喂。', 'interested')], [
        ['它们认识你吗？', [a('可能。'), a('也可能只是认识鱼食。')]],
        ['会认识我吗？', [a('你多来几次。', 'interested'), a('也许会。', 'interested')]],
        ['它们会讨厌人吗？', [a('人也会讨厌人。')]],
    ]),
    topic('A2-07', 2, '凯恩今天很高兴', [a('凯恩今天很高兴。')], [
        ['他不是每天都这样？', [a('嗯。所以要仔细看。')]],
        ['你怎么看出来的？', [a('今天说得更快。')]],
        ['他中大奖了？', [a('没有。'), a('不然会更吵。')]],
    ]),
    topic('A2-08', 2, '给你留了一个', [a('刚才钓到两个一样的。这个给你。')], [
        ['你特意留的？', [a('嗯。', 'shy')], [{ kind: 'dinosaur' }]],
        ['谢谢', [a('嗯。')], [{ kind: 'dinosaur' }]],
        ['另一个呢？', [a('在箱庭里。')], [{ kind: 'dinosaur' }]],
    ]),
    topic('A2-09', 2, '天气很好', [a('今天适合钓鱼。', 'interested')], [
        ['为什么？', [a('天气。', 'interested'), a('鱼会知道。', 'interested')]],
        ['你哪天不这么说？', [a('是这样吗？')]],
        ['搞快点！！！！我要钓鱼！！！', [a('好。')]],
    ]),
    topic('A2-10', 2, '听见了吗', [a('刚才水下面有声音。', 'interested')], [
        ['什么声音？', [a('咚。然后咕噜。', 'interested')]],
        ['没听见', [a('那可能只跟我说了。')]],
        ['它在说什么？', [a('不知道。口音很重。')]],
    ]),
    topic('A3-01', 3, '本来想一个人钓', [a('我今天本来想一个人钓的。')], [
        ['那我走？', [a('不用。你来了也行。')]],
        ['我偏不！', [a('……嗯。'), a('猜到了。')]],
        // The source marks this reply [哦], but its displayed choice repeats Aiven's line.
        ['我今天本来想一个人钓', [a('那我走？'), a('感觉进入了什么循环。')]],
    ]),
    topic('A3-02', 3, '看到这个想到你', [a('刚才钓到一只恐龙蛋。', 'interested'), a('看到的时候觉得你可能会喜欢。', 'shy')], [
        ['给我？', [a('嗯。本来就是给你的。')], [{ kind: 'egg' }, { kind: 'unlock', feature: 'eggs' }]],
        ['你居然会想到我', [a('你也很喜欢恐龙的样子。', 'shy')], [{ kind: 'egg' }, { kind: 'unlock', feature: 'eggs' }]],
        ['它会变成操盘手吗', [a('它也有可能只是想当一颗蛋。')], [{ kind: 'egg' }, { kind: 'unlock', feature: 'eggs' }]],
    ]),
    topic('A3-03', 3, '凯恩以前很安静', [a('凯恩以前没这么吵。')], [
        ['为什么变了？', [a('大概觉得不说话的话，有些东西就真的没声音了。', 'sad')]],
        ['你更喜欢以前？', [a('都一样。'), a('只是现在比较吵。')]],
        ['不信', [a('我有证人。'), a('我。')]],
    ]),
    topic('A3-04', 3, '为什么陪凯恩', [a('凯恩以前问过我，既然我对 SAR 没那么感兴趣，为什么还一直待在那里。'), a('因为活动室有插座。')], [
        ['只是这样？', [a('还有，他准我在社团活动时间钓鱼')]],
        ['我懂的！', [a('嗯。')]],
        ['因为你预判到我以后会加入！', [a('被你猜到了。')]],
    ]),
    topic('A3-05', 3, '今天不想说话？', [a('今天不想说话？')], [
        ['嗯', [a('好。那就不说。')]],
        ['只是在发呆', [a('嗯。发呆也很好。')]],
        ['*发出恐龙的叫声', [a('嗯，和我想象中的叫法很像。', 'interested')]],
    ]),
    topic('A3-06', 3, '最近还好吗', [a('最近还好吗？')], [
        ['挺好', [a('嗯，那就好。')]],
        ['一般', [a('那今天先普通一点。')]],
        ['不太好', [a('可以在这里坐一会儿。'), a('天快亮的时候，河面会先变成很淡的灰色，然后对岸的树就能一点一点慢慢看清。'), a('太阳不会偏心。'), a('天会自己亮的。')]],
    ]),
    topic('A3-07', 3, '坏掉的恐龙', [a('发现一只恐龙', 'interested'), a('它少了一只脚。', 'sad')], [
        ['要修吗', [a('不用。'), a('这是它的勋章。')]],
        ['丢掉？', [a('不要。'), a('少一只脚也是它。')]],
        ['给它装轮子', [a('它看起来很期待。')]],
    ]),
    topic('A3-08', 3, '恐龙颜色', [a('大部分恐龙到底是什么颜色，我们不知道。', 'interested')], [
        ['那我涂粉色', [a('可以。'), a('希望它们不会投诉。'), a('或许它们没有审美概念。')]],
        ['你想涂什么', [a('灰蓝。', 'interested'), a('……或者不涂。', 'interested')]],
        ['彩虹色', [a('科学界暂时没有证据反对你。')]],
    ]),
    topic('A3-09', 3, '你没来的时候', [a('你离线了一阵子。')], [
        ['你发现了？', [a('嗯。位置一直空着。')]],
        ['想我了？', [a('……我有想过你什么时候会来。', 'shy')]],
        ['鱼想我了？', [a('它们在尝试给你写信。')]],
    ]),
    topic('A3-10', 3, '今天钓到你的Sully', [a('刚才钓到Sully了。')], [
        ['还给我！', [a('不是本人。似乎是彼方的bug。'), a('……不过它手里的牌子写着“今天不想上班”。')]],
        ['放回去！', [a('它看起来不太领情。'), a('……不过它手里的牌子写着“今天不想上班”。')]],
        ['他说什么了？', [a('看起来只是一个幻象。'), a('……不过它手里的牌子写着“今天不想上班”。')]],
    ]),
];

const events: FamiliarityScene[] = [
    {
        id: 'A1-SPECIAL', npc: 'aiven', rank: 1, kind: 'event', title: '不是鱼', start: 'start',
        nodes: {
            start: { lines: [a('……', 'normal'), a('刚才钓到一个东西。', 'interested')], choices: [
                { label: '鱼？', next: 'fish' }, { label: '恐龙？', next: 'dinosaur' }, { label: '尸体？', next: 'body' },
            ] },
            fish: { lines: [a('不是。')], next: 'show' },
            dinosaur: { lines: [a('不是。')], next: 'show' },
            body: { lines: [a('鱼不喜欢尸体', "sleeping")], next: 'show' },
            show: { lines: [a('这个。', "interested"), n('艾文拿出：猫科语法模块')], effectLine: 1, effect: { kind: 'notice', title: '猫科语法模块', text: '艾文从水里钓上来的模块。' }, choices: [
                { label: '为什么模块会在水里？', next: 'water' }, { label: '还能用吗？', next: 'working' }, { label: '你钓鱼还能钓这个？！', next: 'catch' },
            ] },
            water: { lines: [a('不知道。', "sad")], next: 'give' },
            working: { lines: [a('凯恩试过了。', 'normal'), c('为什么是我试啊喵？！', 'embarrassed'), a('能用。', 'happy')], next: 'give' },
            catch: { lines: [a('现在看来可以。', 'interested')], next: 'give' },
            give: { lines: [a('给你。', "happy")], choices: [
                { label: '真的给我？', next: 'really' }, { label: '不会进水坏了吗？', next: 'wet' }, { label: '你不要？', next: 'want' },
            ] },
            really: { lines: [a('嗯。', 'happy')], next: 'reward' },
            wet: { lines: [a('防水。大概。', 'normal')], next: 'reward' },
            want: { lines: [a('我不需要说喵。', "shy")], next: 'reward' },
            reward: { lines: [c('我本来也不需要啊喵！！', 'embarrassed'), n('获得：猫科语法包 ×1')], rewards: [{ kind: 'module', title: '猫科语法包', count: 1 }, { kind: 'unlock', feature: 'abnormal-catch' }], next: 'end' },
            end: { lines: [n('解锁彩蛋类型：异常钓获'), a('……下一个应该是鱼。', "normal")] },
        },
    },
    {
        id: 'A2-SPECIAL', npc: 'aiven', rank: 2, kind: 'event', title: '今天的风儿很喧嚣啊', start: 'start',
        nodes: {
            start: { lines: [a('今天的风儿很喧嚣啊。', "sleeping")], choices: [
                { label: '你被文艺少年模块污染了吗', next: 'ordinary' }, { label: '活动室哪来的风', next: 'ordinary' }, { label: '可是风儿似乎又在哭泣啊', next: 'understood', flags: { 'aiven-understood-wind': true } },
            ] },
            ordinary: { lines: [a('……', "shy")], next: 'discount' },
            understood: { lines: [a('……', 'happy')], next: 'discount' },
            discount: { lines: [c('诶诶！！', 'curious'), c('今天模块商店怎么突然打八折了？！', 'curious'), n('模块商店限时折扣 80%，剩余时间：？？？')], effectLine: 1, effect: { kind: 'discount', title: '模块商店限时折扣 80%', text: '剩余时间：？？？' }, rewards: [{ kind: 'discount', percent: 20, scope: 'all', minutes: 30 }], next: 'wind' },
            wind: { lines: [c('为什么？！', 'curious'), a('风。', "happy"), c('什么风？！', 'curious'), a('喧嚣的风。', 'interested')], choices: [
                { label: '你干的？', next: 'you' }, { label: '这是什么神秘仪式？', next: 'ritual' }, { label: '快！趁现在买！', next: 'buy' },
            ] },
            you: { lines: [a('谁知道呢。')], next: 'teacher' },
            ritual: { lines: [a('或许是吧。', 'interested'), a('似乎有神秘力量驱使着我说出这种台词。', 'normal')], next: 'teacher' },
            buy: { lines: [a('嗯。', 'normal'), a('你成长了。', 'happy')], next: 'teacher' },
            teacher: { lines: [c('为什么这种时候突然像老师一样？！', 'embarrassed')], next: 'confetti' },
            confetti: { lines: [n('砰！'), n('砰！砰！')], effect: { kind: 'confetti', title: '活动室礼炮突然启动' }, next: 'button' },
            button: { lines: [c('谁装的礼炮？！', "embarrassed"), a('……', "happy"), c('艾文，你手里那个按钮是什么？', 'curious'), c('那就是你干的吧？！', 'embarrassed'), a('是吗。', "sleeping")], next: 'title' },
            title: { lines: [n('获得隐藏称号：听懂风的人'), n('曾经与艾文完成过一次意义不明的交流。没有任何属性加成。')], effect: { kind: 'notice', title: '听懂风的人', text: '曾经与艾文完成过一次意义不明的交流。没有任何属性加成。' }, rewards: [{ kind: 'title', title: '听懂风的人' }, { kind: 'unlock', feature: 'titles' }, { kind: 'unlock', feature: 'environment' }], next: 'end' },
            end: { lines: [n('解锁彩蛋类型：环境异常'), a('……风停了。', "happy"), c('商店折扣怎么还没停？！', 'curious'), a('可能有延迟。', 'interested')] },
        },
    },
    {
        id: 'A3-SPECIAL', npc: 'aiven', rank: 3, kind: 'event', title: '今天有点多', start: 'start',
        nodes: {
            start: { lines: [a('（User名）。', 'normal'), a('帮忙。', 'interested')], choices: [
                { label: '怎么了？', next: 'what' }, { label: '你居然会主动叫我帮忙', next: 'help' }, { label: '鱼把你钓走了？', next: 'fished' },
            ] },
            what: { lines: [a('今天有点多。', 'interested')], next: 'loot' },
            help: { lines: [a('嗯。所以帮忙。', "normal", ["normal","shy"])], next: 'loot' },
            fished: { lines: [a('还没有。', 'normal')], next: 'loot' },
            // This heap is stage scenery. Only the explicitly gifted card and chimera are rewards.
            loot: { lines: [], effect: { kind: 'loot-burst', title: '今天有点多', items: ['猫科语法包 ×1', '恶役大小姐协议 ×1', '一只雨靴', '三条鱼', '凯恩的管理员胸牌', '艾文的备用存档卡 ×1', '模块商店九折券 ×3'] }, choices: [
                { label: '你到底在钓什么？', next: 'fishing' }, { label: '这水池下面是不是仓库？', next: 'warehouse' }, { label: '为什么凯恩的胸牌在里面？', next: 'badge' },
            ] },
            fishing: { lines: [a('鱼。', 'interested')], next: 'caian' },
            warehouse: { lines: [a('不知道。可能。', 'normal')], next: 'caian' },
            badge: { lines: [a('它渴望自由。', 'happy')], next: 'caian' },
            caian: { lines: [c('艾文！！我管理员胸牌呢？！', 'embarrassed'), a('找到了。', "happy"), c('为什么会在那里？！', 'curious'), a('这个是……', 'interested'), c('啊，这不是你的备用存档卡嘛！', 'curious'), c('你根本没有爱惜啊！早知道不帮你做了！', 'embarrassed'), a('（user名），这个给你。', 'shy')], choices: [
                { label: '为什么给我？', next: 'why-card' }, { label: '你自己不用？', next: 'your-card' }, { label: '这是三星奖励？', next: 'three-stars' },
            ] },
            'why-card': { lines: [a('是你钓上来的。', "happy")], next: 'card' },
            'your-card': { lines: [a('或许你能用到。', 'shy')], next: 'card' },
            'three-stars': { lines: [a('或许放在五星事件比较合适。', 'normal'), a('开玩笑的，这是你的了。', 'happy')], next: 'card' },
            card: { lines: [n('获得：艾文的备用存档卡 ×1'), a('还有一个。', 'interested')], effect: { kind: 'memory-card', title: '艾文的备用存档卡', text: '凯恩为艾文制作的备用存档卡。' }, rewards: [{ kind: 'souvenir', id: 'aiven-backup-card', title: '艾文的备用存档卡', description: '凯恩为艾文制作的备用存档卡。艾文说：「或许你能用到。」' }], next: 'chimera' },
            chimera: { lines: [n('再次收线'), n('钓上来：？？？橡皮泥恐龙')], effectLine: 1, effect: { kind: 'chimera', title: '？？？', text: '霸王龙身体、三角龙角、剑龙骨板、腕龙脖子，配色异常。' }, choices: [
                { label: '这是什么恐龙？', next: 'species' }, { label: '好丑', next: 'ugly' }, { label: '好可爱', next: 'cute' }, { label: '这是生物学犯罪', next: 'crime' },
            ] },
            species: { lines: [a('不知道。', 'interested')], next: 'give-chimera' },
            ugly: { lines: [a('嗯。留着吧。', "shy", ["shy","normal"])], next: 'give-chimera' },
            cute: { lines: [a('嗯。我也觉得。', 'happy')], next: 'give-chimera' },
            crime: { lines: [a('已经发生了。', "sleeping")], next: 'give-chimera' },
            'give-chimera': { lines: [a('给你。', 'shy'), n('获得特殊恐龙：？？？')], rewards: [{ kind: 'dinosaur', speciesId: 'aiven-chimera' }, { kind: 'unlock', feature: 'cross-system' }], next: 'record' },
            record: { lines: [n('名称：？？？\n分类：橡皮泥恐龙\n发现地点：SAR 活动室水域\n发现者：Aiven / （User名）\n艾文备注：「不知道是什么。」「所以不用纠正。」'), n('解锁彩蛋类型：跨系统串线'), a('……', 'normal'), a('好了。', 'happy')], choices: [
                { label: '今天到底怎么回事', next: 'today' }, { label: '下次还叫我', next: 'next-time' }, { label: '累死了', next: 'tired' },
            ] },
            today: { lines: [a('不知道。但是挺好。', 'happy')], next: 'end' },
            'next-time': { lines: [a('嗯。本来就打算。', 'shy')], next: 'end' },
            tired: { lines: [a('辛苦了。', 'normal')], next: 'end' },
            end: { lines: [a('……', 'normal'), a('明天应该会正常一点。', "happy"), c('你最好是！！', 'embarrassed')] },
        },
    },
];

const easterEggs: FamiliarityScene[] = [
    {
        id: 'A1-E01', npc: 'aiven', rank: 1, kind: 'easter', title: '没有名字的角色卡', start: 'start',
        nodes: { start: { lines: [a('刚才钓到一张角色卡。'), a('没有名字。')] } },
    },
    {
        id: 'A1-E02', npc: 'aiven', rank: 1, kind: 'easter', title: '关键词消音器', start: 'start',
        nodes: { start: { lines: [a('钓到模块了。'), a('关键词消音器。上面写着■■。', "normal", ["normal","interested"])], rewards: [{ kind: 'module', title: '关键词消音器', count: 1 }] } },
    },
    {
        id: 'A1-E03', npc: 'aiven', rank: 1, kind: 'easter', title: '另一只鞋', start: 'start',
        nodes: { start: { lines: [a('钓到一只鞋。'), a('另一只可能还在下面。', "sleeping")] } },
    },
    {
        id: 'A1-E04', npc: 'aiven', rank: 1, kind: 'easter', title: '鱼给的九折券', start: 'start',
        nodes: {
            start: { lines: [a('这个给你。'), n('模块商店九折券'), a('鱼给的。')], effect: { kind: 'notice', title: '模块商店九折券', text: '鱼给的。' }, rewards: [{ kind: 'coupon', percent: 10, count: 1 }] },
        },
    },
    {
        id: 'A1-E05', npc: 'aiven', rank: 1, kind: 'easter', title: '凯恩的笔', start: 'start',
        nodes: { start: { lines: [a('凯恩的笔。'), c('我找了一上午！！', 'embarrassed'), a('现在找到了。')] } },
    },
    {
        id: 'A1-E06', npc: 'aiven', rank: 1, kind: 'easter', title: '不要再钓了', start: 'start',
        nodes: {
            start: { lines: [a('钓到一张纸。'), n('「不要再钓了。」')], choices: [{ label: '那别钓了', next: 'stop' }, { label: '继续钓', next: 'continue' }] },
            stop: { lines: [a('好。……明天继续。', "sad", ["sad","normal"])] },
            continue: { lines: [a('嗯。', "happy")] },
        },
    },
    {
        id: 'A1-E07', npc: 'aiven', rank: 1, kind: 'easter', title: '字变了', start: 'start', requires: ['A1-E06'],
        nodes: { start: { lines: [a('又是那张纸。'), n('「我说了不要再钓了。」'), a('……字变了。')] } },
    },
    {
        id: 'A2-E01', npc: 'aiven', rank: 2, kind: 'easter', title: '安静的鱼与礼炮', start: 'start',
        nodes: {
            start: { lines: [a('今天鱼很安静。')], next: 'confetti' },
            confetti: { lines: [n('砰！')], effect: { kind: 'confetti' }, next: 'end' },
            end: { lines: [a('……除了这个。', "sleeping")] },
        },
    },
    {
        id: 'A2-E02', npc: 'aiven', rank: 2, kind: 'easter', title: '突然打折', start: 'start',
        nodes: {
            start: { lines: [a('你今天想买模块吗？')], next: 'discount' },
            discount: { lines: [n('随机商品 -20%')], effect: { kind: 'discount', title: '随机商品 -20%' }, rewards: [{ kind: 'discount', percent: 20, scope: 'random-module', minutes: 30 }], next: 'end' },
            end: { lines: [a('现在可以买了。', "happy")] },
        },
    },
    {
        id: 'A2-E03', npc: 'aiven', rank: 2, kind: 'easter', title: '优惠券雨', start: 'start',
        nodes: {
            start: { lines: [a('下雨了。', "interested")], next: 'rain' },
            rain: { lines: [], effect: { kind: 'coupon-rain', title: '模块优惠券', items: ['模块商店九折券', '模块商店九折券', '模块商店九折券'] }, rewards: [{ kind: 'coupon', percent: 10, count: 3 }], next: 'end' },
            end: { lines: [a('这个。', "shy")] },
        },
    },
    // Cross-system catches below are visual jokes, never actual modules, titles or discounts.
    {
        id: 'A3-E01', npc: 'aiven', rank: 3, kind: 'easter', title: '加载失败', start: 'start',
        nodes: {
            start: { lines: [a('这个模块没有名字。')], next: 'error' },
            error: { lines: [n('模块名显示：加载失败')], effect: { kind: 'notice', title: '加载失败', text: '模块名显示：加载失败' }, next: 'end' },
            end: { lines: [a('那就叫加载失败。')] },
        },
    },
    {
        id: 'A3-E02', npc: 'aiven', rank: 3, kind: 'easter', title: '今天也没有空军', start: 'start',
        nodes: {
            start: { lines: [a('钓到一个称号。')], next: 'title' },
            title: { lines: [n('获得临时假称号：今天也没有空军')], effect: { kind: 'notice', title: '今天也没有空军', text: '临时假称号' } },
        },
    },
    {
        id: 'A3-E03', npc: 'aiven', rank: 3, kind: 'easter', title: '不要点', start: 'start',
        nodes: {
            start: { lines: [a('刚才钓到一个按钮。')], next: 'button' },
            button: { lines: [], effect: { kind: 'mystery-button', title: '不要点', interactive: true }, next: 'confetti' },
            confetti: { lines: [], effect: { kind: 'confetti', title: '砰！' } },
        },
    },
    {
        id: 'A3-E04', npc: 'aiven', rank: 3, kind: 'easter', title: '水里的七折', start: 'start',
        nodes: { start: { lines: [a('今天是七折。'), a('水里写的。')], effect: { kind: 'notice', title: '七折', text: '水里写的。' } } },
    },
    {
        id: 'A3-E05', npc: 'aiven', rank: 3, kind: 'easter', title: '鱼不存在', start: 'start',
        nodes: {
            start: { lines: [a('鱼跑了。')], next: 'error' },
            error: { lines: [n('错误：鱼不存在')], effect: { kind: 'notice', title: '错误：鱼不存在' }, next: 'end' },
            end: { lines: [a('……那刚才是什么。')] },
        },
    },
    {
        id: 'A3-E06', npc: 'aiven', rank: 3, kind: 'easter', title: '像素猫的归途', start: 'start',
        nodes: {
            start: { lines: [a('刚才钓到一只像素猫。'), { speaker: 'sully', text: '你有病吧！！！放我回去！！！' }, a('它踏上了回家的旅程。', "sleeping")], rewards: [{ kind: 'sully-message', text: '艾文：刚才钓到一只像素猫。\nSully：你有病吧！！！放我回去！！！\n艾文：它踏上了回家的旅程。' }] },
        },
    },
];

const sullyEncounter: FamiliarityScene = {
    id: 'A-SULLY', npc: 'aiven', rank: 1, kind: 'encounter', title: '你认识我的猫？', start: 'start', condition: 'sully-in-sar',
    nodes: {
        start: { lines: [a('……'), a('Sully。'), a('不对。')], choices: [
            { label: '你认识我的猫？', next: 'your-cat' }, { label: '哪里不对？', next: 'wrong' }, { label: '你们怎么都认识 Sully？', next: 'support' },
        ] },
        'your-cat': { lines: [a('你的？', "interested"), a('我们那里也有一只。')], choices: [
            { label: '也长这样？', next: 'same-look' }, { label: '什么叫“一只”？', next: 'one-cat' }, { label: '原来 Sully 是猫的品种', next: 'breed' },
        ] },
        'same-look': { lines: [a('嗯。'), a('像素猫。'), a('说话也差不多。')], next: 'common' },
        'one-cat': { lines: [a('……'), a('一个。'), a('但是长得像猫。')], next: 'common' },
        breed: { lines: [a('可能。'), a('现在有两只了。', "happy")], next: 'common' },
        wrong: { lines: [a('它刚才看了我一眼。'), a('没反应。'), a('我们那里的 Sully 认识我。')], choices: [
            { label: '可能忘了', next: 'forgot' }, { label: '因为不是同一个', next: 'different' }, { label: '你被猫无视了', next: 'ignored' },
        ] },
        forgot: { lines: [a('也可能。'), a('它每天要处理很多东西。')], next: 'common' },
        different: { lines: [a('嗯。'), a('应该是。')], next: 'common' },
        ignored: { lines: [a('……', 'sad'), a('挫败。', 'sad')], next: 'common' },
        support: { lines: [a('CloudMemory 的客服。'), a('凯恩经常找它。'), a('我偶尔也会。')], choices: [
            { label: '它也这么怪？', next: 'strange' }, { label: '你找客服干嘛？', next: 'account' }, { label: '那个 Sully 好用吗？', next: 'useful' },
        ] },
        strange: { lines: [a('嗯。'), a('有时候比这个怪。')], next: 'common' },
        account: { lines: [a('有一次账号登不上去。'), a('它让我“把登录状态摇匀一点”。'), a('……'), a('后来好了。')], next: 'common' },
        useful: { lines: [a('能解决问题。'), a('过程不一定能理解。')], next: 'common' },
        common: { lines: [a('我们那里那个 Sully，也是像素猫。'), a('也是 AI。'), a('说话的时候偶尔会混进一些奇怪的东西。', "sleeping"), a('……'), a('所以刚才看到的时候，我以为它也来了。')], choices: [
            { label: '你不觉得很奇怪吗？', next: 'odd' }, { label: '所以是平行世界 Sully？', next: 'parallel' }, { label: '说不定就是同一个', next: 'same' },
        ] },
        odd: { lines: [a('有一点。'), a('不过彼方本来就很奇怪。')] },
        parallel: { lines: [a('不知道。'), a('可以问它。')] },
        same: { lines: [a('也有可能。'), a('它看起来不像会老实交代。')] },
    },
};

/** Each named topic, event, easter egg and encounter has a stable one-time ID. */
export const AIVEN_SCENES: FamiliarityScene[] = [...topics, ...events, ...easterEggs, sullyEncounter];

/** Pick one weekday + one time + one weather line. Weekday indices match Date.getDay(). */
export const AIVEN_DAILY: FamiliarityDailyLines = {
    time: {
        morning: ['早。', '你今天来得很早。', '早上水比较安静。'],
        noon: ['中午了。', '吃饭了吗？', '太阳到这里了。'],
        evening: ['晚上好。', '天黑了。', '晚上的水看起来比较深。其实一样深。'],
        night: ['还没睡。', '夜深了。', '这个时间还来，你也挺闲的。'],
    },
    weather: {
        clear: ['今天太阳很好。', '水面有点亮。', '晴天。能看见浮标。'],
        rain: ['下雨了。', '今天鱼可能会靠近一点。', '雨落在水里以后，就分不出来了。'],
        cloudy: ['今天没有太阳。', '阴天也适合钓鱼。', '云很低。看起来快碰到水了。'],
    },
    weekday: [
        ['周日了。', '明天又要上课。', '今天还是可以钓鱼。'],
        ['周一。', '又要上课了。', '凯恩今天早上差点迟到。'],
        ['周二了。', '今天学校没什么特别的。', '还有四天到周末。'],
        ['周三。', '一周过去一半了。', '今天放学以后去钓鱼。'],
        ['周四了。', '快到周末了。', '今天有点想吃鱼。'],
        ['周五。', '明天不用早起。', '凯恩说今晚要通宵。'],
        ['今天不用去学校。', '周六。', '可以钓久一点。'],
    ],
};
