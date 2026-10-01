import { formatSARDialogue } from './dialogueText';
import type { AivenExpression, CaianExpression } from '../sarArt';
import type { FamiliarityDailyLines, FamiliarityLine, FamiliarityScene } from './types';

// Authored lines from 凯恩熟悉度_V2.docx. Stage directions become effects, not dialogue.
const c = (text: string, expression: CaianExpression = 'normal', sentenceExpressions?: CaianExpression[]): FamiliarityLine => ({ speaker: 'caian', text: formatSARDialogue(text), expression, ...(sentenceExpressions ? { sentenceExpressions } : {}) });
const a = (text: string, expression: AivenExpression = 'normal', sentenceExpressions?: AivenExpression[]): FamiliarityLine => ({ speaker: 'aiven', text: formatSARDialogue(text), expression, ...(sentenceExpressions ? { sentenceExpressions } : {}) });
const n = (text: string): FamiliarityLine => ({ speaker: 'narrator', text });

export const CAIAN_SCENES: FamiliarityScene[] = [
    {
        id: "C1-01", npc: 'caian', rank: 1, kind: "topic",
        title: "彼方也太方便了吧", start: "start",
        nodes: {
            // Source paragraphs 7–7.
            "start": {
                lines: [
                    c("不同地方的人居然真的能跑到同一个空间里。意味着异世界联机终于不用担心服务器了！", "happy"),
                ],
                choices: [
                    {"label":"确实","next":"answer-1"},
                    {"label":"你重点错了","next":"answer-2"},
                ],
            },
            // Source paragraphs 10–10.
            "answer-1": {
                lines: [
                    c("对吧！", "happy"),
                ],
            },
            // Source paragraphs 11–11.
            "answer-2": {
                lines: [
                    c("联机稳定性可是文明基石！", "happy"),
                ],
            },
        },
    },
    {
        id: "C1-02", npc: 'caian', rank: 1, kind: "topic",
        title: "游戏库存病", start: "start",
        nodes: {
            // Source paragraphs 13–13.
            "start": {
                lines: [
                    c("你有没有那种游戏？明明买都买了，结果在仓库里落灰，然后一次都没打开。", "curious"),
                ],
                choices: [
                    {"label":"有","next":"answer-1"},
                    {"label":"没有","next":"answer-2"},
                    {"label":"你有吧","next":"answer-3"},
                ],
            },
            // Source paragraphs 17–17.
            "answer-1": {
                lines: [
                    c("游戏库本身也是收藏！", "happy"),
                ],
            },
            // Source paragraphs 18–18.
            "answer-2": {
                lines: [
                    c("……好强的执行力。", "normal"),
                ],
            },
            // Source paragraphs 19–20.
            "answer-3": {
                lines: [
                    a("他有。", "normal"),
                    c("我是在问（User名）！", "happy"),
                ],
            },
        },
    },
    {
        id: "C1-03", npc: 'caian', rank: 1, kind: "topic",
        title: "抽卡之前", start: "start",
        nodes: {
            // Source paragraphs 22–22.
            "start": {
                lines: [
                    c("扭蛋机每次都会让人觉得“就一次”。", "normal"),
                ],
                choices: [
                    {"label":"你抽了几次","next":"answer-1"},
                    {"label":"管理员也会沉迷？","next":"answer-2"},
                ],
            },
            // Source paragraphs 25–25.
            "answer-1": {
                lines: [
                    c("这是管理员测试！", "happy"),
                ],
            },
            // Source paragraphs 26–26.
            "answer-2": {
                lines: [
                    c("管理员需要充分了解设备！", "happy"),
                ],
            },
        },
    },
    {
        id: "C1-04", npc: 'caian', rank: 1, kind: "topic",
        title: "管理员特权", start: "start",
        nodes: {
            // Source paragraphs 28–28.
            "start": {
                lines: [
                    c("管理员是不是应该有一点特权？……打扫活动室以外的。", "curious"),
                ],
                choices: [
                    {"label":"比如？","next":"answer-1"},
                    {"label":"没有","next":"answer-2"},
                ],
            },
            // Source paragraphs 31–31.
            "answer-1": {
                lines: [
                    c("比如优先测试新模块！", "happy"),
                ],
            },
            // Source paragraphs 32–32.
            "answer-2": {
                lines: [
                    c("怎么这么严格！", "embarrassed"),
                ],
            },
        },
    },
    {
        id: "C1-05", npc: 'caian', rank: 1, kind: "topic",
        title: "活动室 BGM", start: "start",
        nodes: {
            // Source paragraphs 34–34.
            "start": {
                lines: [
                    c("这里是不是应该有 BGM？抽到好东西再突然——锵！！", "normal", ["normal","happy"]),
                ],
                choices: [
                    {"label":"好蠢","next":"answer-1"},
                    {"label":"确实","next":"answer-2"},
                    {"label":"锵！！","next":"answer-3"},
                ],
            },
            // Source paragraphs 38–38.
            "answer-1": {
                lines: [
                    c("怎么这样！", "embarrassed"),
                ],
            },
            // Source paragraphs 39–39.
            "answer-2": {
                lines: [
                    c("对吧！", "happy"),
                ],
            },
            // Source paragraphs 40–40.
            "answer-3": {
                lines: [
                    c("就是这样！！", "happy"),
                ],
            },
        },
    },
    {
        id: "C1-06", npc: 'caian', rank: 1, kind: "topic",
        title: "橡皮泥恐龙", start: "start",
        nodes: {
            // Source paragraphs 42–42.
            "start": {
                lines: [
                    c("我现在理解艾文为什么喜欢橡皮泥恐龙了。摆起来真的很容易上瘾。", "normal", ["normal","happy"]),
                ],
                choices: [
                    {"label":"你也摆一个？","next":"answer-1"},
                    {"label":"不许碰我的！","next":"answer-2"},
                    {"label":"我的恐龙正在炒外汇","next":"answer-3"},
                ],
            },
            // Source paragraphs 46–46.
            "answer-1": {
                lines: [
                    c("那我要把霸王龙放这里！", "happy"),
                ],
            },
            // Source paragraphs 47–47.
            "answer-2": {
                lines: [
                    c("我就移动一厘米也不行？！", "embarrassed"),
                ],
            },
            // Source paragraphs 48–48.
            "answer-3": {
                lines: [
                    c("……", "curious"),
                    c("那我不动了！", "happy"),
                    c("它可能正在等汇率。", "normal"),
                    c("打扰交易员工作不太好。", "normal"),
                ],
            },
        },
    },
    {
        id: "C1-07", npc: 'caian', rank: 1, kind: "topic",
        title: "模块试用", start: "start",
        nodes: {
            // Source paragraphs 50–50.
            "start": {
                lines: [
                    c("我刚才测试了傲娇恶役大小姐协议。本、本管理员为什么要向你汇报测试结果？！", "embarrassed", ["embarrassed","shy"]),
                ],
                choices: [
                    {"label":"……","next":"answer-1"},
                    {"label":"很适合你","next":"answer-2"},
                    {"label":"（恶役大小姐笑）","next":"answer-3"},
                ],
            },
            // Source paragraphs 54–54.
            "answer-1": {
                lines: [
                    c("别、别什么也不说啊！", "shy"),
                ],
            },
            // Source paragraphs 55–55.
            "answer-2": {
                lines: [
                    c("才、才没有！", "shy"),
                ],
            },
            // Source paragraphs 56–56.
            "answer-3": {
                lines: [
                    c("你是在取笑人家吗！", "embarrassed"),
                ],
            },
        },
    },
    {
        id: "C1-08", npc: 'caian', rank: 1, kind: "topic",
        title: "猫语销冠", start: "start",
        nodes: {
            // Source paragraphs 58–58.
            "start": {
                lines: [
                    c("猫科语法包又是销量第一。为什么大家最后都想让朋友说“喵”？", "normal"),
                ],
                choices: [
                    {"label":"因为可爱","next":"answer-1"},
                    {"label":"因为想欺负人","next":"answer-2"},
                    {"label":"你也喵一个","next":"answer-3"},
                ],
            },
            // Source paragraphs 62–62.
            "answer-1": {
                lines: [
                    c("……确实很难反驳。", "normal"),
                ],
            },
            // Source paragraphs 63–63.
            "answer-2": {
                lines: [
                    c("我就知道！", "embarrassed"),
                ],
            },
            // Source paragraphs 64–64.
            "answer-3": {
                lines: [
                    c("为什么突然到我身上了喵！", "embarrassed"),
                ],
            },
        },
    },
    {
        id: "C1-09", npc: 'caian', rank: 1, kind: "topic",
        title: "跨世界番剧", start: "start",
        nodes: {
            // Source paragraphs 66–66.
            "start": {
                lines: [
                    c("你们那边也有机甲、魔法少女、异世界题材？", "curious"),
                ],
                choices: [
                    {"label":"多得很","next":"answer-1"},
                    {"label":"你最喜欢哪种","next":"answer-2"},
                ],
            },
            // Source paragraphs 69–69.
            "answer-1": {
                lines: [
                    c("文明发展的方向果然高度一致。", "normal"),
                ],
            },
            // Source paragraphs 70–70.
            "answer-2": {
                lines: [
                    c("很难选！", "happy"),
                    c("异世界魔法机甲少女……", "shy"),
                    c("没什么！", "embarrassed"),
                ],
            },
        },
    },
    {
        id: "C1-10", npc: 'caian', rank: 1, kind: "topic",
        title: "今天干嘛", start: "start",
        nodes: {
            // Source paragraphs 72–72.
            "start": {
                lines: [
                    c("今天准备干嘛？", "curious"),
                ],
                choices: [
                    {"label":"钓鱼","next":"answer-1"},
                    {"label":"看模块","next":"answer-2"},
                    {"label":"抽人格推演","next":"answer-3"},
                    {"label":"什么都不干","next":"answer-4"},
                ],
            },
            // Source paragraphs 77–77.
            "answer-1": {
                lines: [
                    c("回来告诉我钓到了什么！", "happy"),
                ],
            },
            // Source paragraphs 78–78.
            "answer-2": {
                lines: [
                    c("名字越可疑越要看说明哦。", "normal"),
                ],
            },
            // Source paragraphs 79–79.
            "answer-3": {
                lines: [
                    c("……就一次？", "curious"),
                ],
            },
            // Source paragraphs 80–80.
            "answer-4": {
                lines: [
                    c("也行！这里又没有每日任务。", "happy"),
                ],
            },
        },
    },
    {
        id: "C1-SPECIAL", npc: 'caian', rank: 1, kind: "event",
        title: "管理员证", start: "start",
        nodes: {
            // Source paragraphs 82–84.
            "start": {
                lines: [
                    c("你来得正好！", "normal"),
                    c("我终于通过管理员考核了！", "happy"),
                    c("看！", "happy"),
                ],
                choices: [
                    {"label":"让我看看！","next":"photo"},
                    {"label":"恭喜！","next":"congratulate"},
                    {"label":"原来我一直在和实习生说话？！","next":"trainee"},
                ],
            },
            // Source paragraphs 89–91.
            "photo": {
                lines: [
                    c("请看！", "normal"),
                    c("先说好，照片是系统拍的。", "shy"),
                    c("我本人比这个精神多了。", "normal"),
                ],
                choices: [
                    {"label":"挺可爱的","next":"cute"},
                    {"label":"好呆","next":"dork"},
                    {"label":"你不就长这样？","next":"looks-same"},
                ],
                effect: {"kind":"admin-card","title":"正式管理员证","text":"Caian / SAR 彼方活动室","items":["管理员：Caian","状态：正式管理员"]},
            },
            // Source paragraphs 96–97.
            "cute": {
                lines: [
                    c("可、可爱是什么评价证件照的词啊！", "shy"),
                    c("至少说“很有管理员气质”吧！", "embarrassed"),
                ],
                next: "closing",
            },
            // Source paragraphs 99–100.
            "dork": {
                lines: [
                    c("哪里呆了？！", "embarrassed"),
                    c("我拍的时候很认真！", "normal"),
                ],
                next: "closing",
            },
            // Source paragraphs 102–102.
            "looks-same": {
                lines: [
                    c("倒也确实如此……？", "embarrassed"),
                ],
                next: "closing",
            },
            // Source paragraphs 104–107.
            "congratulate": {
                lines: [
                    c("嘿嘿，谢谢！", "happy"),
                    c("我看到通过通知的时候还确认了两遍。", "happy"),
                    c("以后就不是“暂时负责这里的人”了。", "normal"),
                    c("是正式管理员！", "happy"),
                ],
                choices: [
                    {"label":"听起来也没什么区别","next":"no-difference"},
                    {"label":"凯恩管理员","next":"administrator"},
                    {"label":"今天可以全场免费吗","next":"free"},
                ],
            },
            // Source paragraphs 112–115.
            "no-difference": {
                lines: [
                    c("区别很大！", "normal"),
                    c("现在我乱改活动室的时候有正式权限了！", "happy"),
                    c("等等，这句不能写进考核记录。", "embarrassed"),
                ],
                next: "closing",
            },
            // Source paragraphs 118–120.
            "administrator": {
                lines: [
                    c("到！", "happy"),
                    c("……", "shy"),
                    c("再叫一次？", "shy"),
                ],
                next: "closing",
            },
            // Source paragraphs 123–123.
            "free": {
                lines: [
                    c("别让我第一天就犯错啊？！", "embarrassed"),
                ],
                next: "closing",
            },
            // Source paragraphs 126–127.
            "trainee": {
                lines: [
                    c("什么实习生！", "shy"),
                    c("是见习管理员！", "embarrassed"),
                ],
                choices: [
                    {"label":"有区别吗？","next":"difference"},
                    {"label":"实习生管理员","next":"intern-admin"},
                    {"label":"好的，前实习生","next":"former-intern"},
                ],
            },
            // Source paragraphs 133–135.
            "difference": {
                lines: [
                    c("当然有！", "embarrassed"),
                    c("……", "embarrassed"),
                    c("大概。", "shy"),
                ],
                next: "closing",
            },
            // Source paragraphs 138–138.
            "intern-admin": {
                lines: [
                    c("不许创造这种职位！", "embarrassed"),
                ],
                next: "closing",
            },
            // Source paragraphs 140–142.
            "former-intern": {
                lines: [
                    c("……", "embarrassed"),
                    c("算了。", "embarrassed"),
                    c("“前”至少说明我转正了。", "happy"),
                ],
                next: "closing",
            },
            // Source paragraphs 145–147.
            "closing": {
                lines: [
                    c("对了", "normal"),
                    c("既然你刚好在", "normal"),
                    c("管理员证第一次正式使用，要不要留个记录？", "normal2"),
                ],
                choices: [
                    {"label":"什么记录？","next":"record-explanation"},
                    {"label":"好啊","next":"accept"},
                    {"label":"不要","next":"decline"},
                ],
            },
            // Source paragraphs 154–156.
            "record-explanation": {
                lines: [
                    c("就是登记一下成为活动室的正式一员？", "happy"),
                    c("没有奖励，也没什么实际用途。", "normal"),
                    c("就只是觉得想给你点什么头衔？", "normal2"),
                ],
                choices: [
                    {"label":"好啊","next":"accept"},
                    {"label":"不要","next":"decline"},
                ],
            },
            // Source paragraphs 158–158.
            "accept": {
                lines: [
                    c("好！", "happy"),
                ],
                next: "member-card",
            },
            // Source paragraphs 161–163.
            "decline": {
                lines: [
                    c("也行！", "normal"),
                    c("那就不登记。", "normal2"),
                    c("第一次使用管理员权限，总不能拿来强迫别人留下名字吧。", "happy"),
                ],
                next: "ending",
            },
            "member-card": {
                lines: [],
                next: "registered",
                effect: {"kind":"membership-card","title":"SAR成员 #0001","text":"正式上任后的第一位访客。","items":["成员：（User名）","记录人：Caian"],"interactive":true},
                rewards: [{"kind":"souvenir","id":"caian-membership","title":"SAR 成员 #0001","description":"成员：（User名）\n记录人：Caian\n备注：正式上任后的第一位访客。"}],
            },
            // Source paragraphs 172–173.
            "registered": {
                lines: [
                    c("完成！", "happy"),
                    c("嘿嘿。", "happy"),
                ],
                next: "ending",
            },
            // Source paragraphs 174–175.
            "ending": {
                lines: [
                    c("总之。", "normal"),
                    c("以后也请多关照啦，（User名）。", "happy"),
                ],
            },
        },
    },
    {
        id: "C-SULLY", npc: 'caian', rank: 1, kind: "encounter",
        title: "那个头像，绝对是他！", start: "start",
        condition: "sully-in-sar",
        nodes: {
            "start": {
                lines: [
                    c("Sully？！", "curious"),
                    c("我刚刚看到了Sully对吧！那个头像！绝对是他！", "curious", ["curious","curious","serious"]),
                    c("不过它好像不认识我？", "curious"),
                ],
                choices: [
                    {"label":"那是我的猫！","next":"my-cat"},
                    {"label":"你们认识？","next":"know-him"},
                    {"label":"你吃了塞博蘑菇","next":"mushroom"},
                ],
            },
            "my-cat": {
                lines: [
                    c("你的？", "curious"),
                    c("也就是你那里也有一个Sully……", "serious"),
                ],
                next: "ending",
            },
            "know-him": {
                lines: [
                    c("该说是认识吗？", "normal2"),
                ],
                next: "ending",
            },
            "mushroom": {
                lines: [
                    c("那我现在应该电子昏迷吗！", "embarrassed"),
                ],
                next: "ending",
            },
            "ending": {
                lines: [
                    c("在我们的世界，最大的仿生人公司的客服也叫Sully", "normal2"),
                    c("不过似乎不是同一个人", "curious"),
                    c("不重要了！看样子在这个世界里它过得也挺不错。", "happy"),
                ],
            },
        },
    },
    {
        id: "C2-01", npc: 'caian', rank: 2, kind: "topic",
        title: "最近在玩什么", start: "start",
        nodes: {
            // Source paragraphs 181–181.
            "start": {
                lines: [
                    c("你最近在玩什么游戏？", "curious"),
                ],
                choices: [
                    {"label":"有沉迷的","next":"answer-1"},
                    {"label":"没什么想玩的","next":"answer-2"},
                    {"label":"没时间","next":"answer-3"},
                ],
            },
            // Source paragraphs 185–185.
            "answer-1": {
                lines: [
                    c("我喜欢听别人聊最近在沉迷什么。", "normal"),
                ],
            },
            // Source paragraphs 186–186.
            "answer-2": {
                lines: [
                    c("我也会，总是有一段时间会游戏荒啊。", "warm"),
                ],
            },
            // Source paragraphs 187–187.
            "answer-3": {
                lines: [
                    c("呃啊，太现实了。", "normal"),
                ],
            },
        },
    },
    {
        id: "C2-02", npc: 'caian', rank: 2, kind: "topic",
        title: "沉没意志", start: "start",
        nodes: {
            // Source paragraphs 189–189.
            "start": {
                lines: [
                    c("你玩过《沉没意志》吗？", "curious"),
                ],
                choices: [
                    {"label":"玩过","next":"answer-1"},
                    {"label":"没有","next":"answer-2"},
                    {"label":"你又要安利了","next":"answer-3"},
                ],
            },
            // Source paragraphs 193–193.
            "answer-1": {
                lines: [
                    c("你也玩过啊！……突然有点高兴。", "happy", ["happy","normal"]),
                ],
                next: "ending",
            },
            // Source paragraphs 194–194.
            "answer-2": {
                lines: [
                    c("那我要安利了！我很喜欢它。", "happy", ["happy","normal"]),
                ],
                next: "ending",
            },
            // Source paragraphs 195–195.
            "answer-3": {
                lines: [
                    c("真正喜欢的游戏当然值得多讲几次！", "happy"),
                ],
                next: "ending",
            },
            // Source paragraphs 196–196.
            "ending": {
                lines: [
                    c("如果是你的话，我还挺想知道你玩完会怎么想。", "normal2"),
                ],
            },
        },
    },
    {
        id: "C2-03", npc: 'caian', rank: 2, kind: "topic",
        title: "游戏里的废话", start: "start",
        nodes: {
            // Source paragraphs 198–198.
            "start": {
                lines: [
                    c("我很喜欢游戏里那些完全没用的对话。", "normal"),
                ],
                choices: [
                    {"label":"我也喜欢","next":"answer-1"},
                    {"label":"我会跳过","next":"answer-2"},
                    {"label":"所以你也天天说废话？","next":"answer-3"},
                ],
            },
            // Source paragraphs 202–202.
            "answer-1": {
                lines: [
                    c("对吧！这种东西会很可爱。", "happy"),
                ],
            },
            // Source paragraphs 203–203.
            "answer-2": {
                lines: [
                    c("好残酷！", "embarrassed"),
                ],
            },
            // Source paragraphs 204–204.
            "answer-3": {
                lines: [
                    c("这叫生活感！", "happy"),
                ],
            },
        },
    },
    {
        id: "C2-04", npc: 'caian', rank: 2, kind: "topic",
        title: "旧存档", start: "start",
        nodes: {
            // Source paragraphs 206–206.
            "start": {
                lines: [
                    c("你会删旧存档吗？", "curious"),
                ],
                choices: [
                    {"label":"不删","next":"answer-1"},
                    {"label":"会删","next":"answer-2"},
                ],
            },
            // Source paragraphs 209–209.
            "answer-1": {
                lines: [
                    c("我也是。哪怕永远不会再读。", "normal2"),
                ],
            },
            // Source paragraphs 210–210.
            "answer-2": {
                lines: [
                    c("好果断……", "embarrassed"),
                ],
            },
        },
    },
    {
        id: "C2-05", npc: 'caian', rank: 2, kind: "topic",
        title: "舍不得推进主线", start: "start",
        nodes: {
            // Source paragraphs 212–212.
            "start": {
                lines: [
                    c("你有没有明知道下一步是主线，却故意不去的时候？", "curious"),
                ],
                choices: [
                    {"label":"有","next":"answer-1"},
                    {"label":"没有","next":"answer-2"},
                    {"label":"先清支线","next":"answer-3"},
                ],
            },
            // Source paragraphs 216–216.
            "answer-1": {
                lines: [
                    c("对吧！先钓鱼、逛街、绕地图三圈。", "happy"),
                    c("不过我的话，有时候只是单纯的不想集中注意力。", "avoidant"),
                ],
            },
            // Source paragraphs 217–217.
            "answer-2": {
                lines: [
                    c("行动派，好可怕！", "embarrassed"),
                ],
            },
            // Source paragraphs 218–218.
            "answer-3": {
                lines: [
                    c("果然！地图上有感叹号就不能安心推进……", "happy", ["happy","normal"]),
                ],
            },
        },
    },
    {
        id: "C2-06", npc: 'caian', rank: 2, kind: "topic",
        title: "你和你的 Char", start: "start",
        nodes: {
            // Source paragraphs 220–220.
            "start": {
                lines: [
                    c("我发现你和你的彼方朋友们的信件挺有意思的。", "normal"),
                ],
                choices: [
                    {"label":"哪里有意思","next":"answer-1"},
                    {"label":"你观察我们？","next":"answer-2"},
                    {"label":"不许研究！","next":"answer-3"},
                ],
            },
            // Source paragraphs 224–224.
            "answer-1": {
                lines: [
                    c("感觉很有默契，该说相处很久的人会被彼此同化吗？", "normal2"),
                    c("明明没有在说一件事，但是很多时候感觉观念惊人地相似啊。", "warm"),
                ],
            },
            // Source paragraphs 225–225.
            "answer-2": {
                lines: [
                    c("没有监视！", "embarrassed"),
                ],
            },
            // Source paragraphs 226–226.
            "answer-3": {
                lines: [
                    c("好好好，不写报告！", "embarrassed"),
                ],
            },
        },
    },
    {
        id: "C2-07", npc: 'caian', rank: 2, kind: "topic",
        title: "天气接口", start: "start",
        nodes: {
            // Source paragraphs 228–228.
            "start": {
                lines: [
                    c("我现在很喜欢看你那边的天气。", "normal"),
                ],
                choices: [
                    {"label":"为什么","next":"answer-1"},
                    {"label":"你偷窥我天气！！","next":"answer-2"},
                ],
            },
            // Source paragraphs 231–231.
            "answer-1": {
                lines: [
                    c("同一个活动室，窗外却可能完全不是一个季节。很有跨世界感。", "normal2", ["normal2","happy"]),
                ],
            },
            // Source paragraphs 232–232.
            "answer-2": {
                lines: [
                    c("天气接口！合法接口！", "embarrassed"),
                ],
            },
        },
    },
    {
        id: "C2-08", npc: 'caian', rank: 2, kind: "topic",
        title: "给你推荐模块", start: "start",
        nodes: {
            // Source paragraphs 234–234.
            "start": {
                lines: [
                    c("如果让我给你推荐一个模块……", "normal"),
                ],
                choices: [
                    {"label":"推荐吧","next":"answer-1"},
                    {"label":"喵","next":"answer-2"},
                    {"label":"你自己先用","next":"answer-3"},
                ],
            },
            // Source paragraphs 238–238.
            "answer-1": {
                lines: [
                    c("我觉得你适合随机事件警报。", "happy"),
                ],
            },
            // Source paragraphs 239–239.
            "answer-2": {
                lines: [
                    c("我还没说！", "embarrassed"),
                ],
            },
            // Source paragraphs 240–240.
            "answer-3": {
                lines: [
                    c("为什么最后又变成测试管理员？！", "embarrassed"),
                ],
            },
        },
    },
    {
        id: "C2-09", npc: 'caian', rank: 2, kind: "topic",
        title: "如果你写我的角色卡", start: "start",
        nodes: {
            // Source paragraphs 242–242.
            "start": {
                lines: [
                    c("如果让你给我写角色卡，你会先写什么性格特质？", "curious"),
                ],
                choices: [
                    {"label":"很吵","next":"answer-1"},
                    {"label":"热血宅宅","next":"answer-2"},
                    {"label":"管理员","next":"answer-3"},
                ],
            },
            // Source paragraphs 246–246.
            "answer-1": {
                lines: [
                    c("第一条就这个？！", "embarrassed"),
                    c("我以前没有很吵啦。", "shy"),
                ],
            },
            // Source paragraphs 247–247.
            "answer-2": {
                lines: [
                    c("……没法反驳。", "embarrassed"),
                ],
            },
            // Source paragraphs 248–248.
            "answer-3": {
                lines: [
                    c("终于有人尊重我的职业身份！", "happy"),
                ],
            },
        },
    },
    {
        id: "C2-10", npc: 'caian', rank: 2, kind: "topic",
        title: "你最近来得挺勤", start: "start",
        nodes: {
            // Source paragraphs 250–250.
            "start": {
                lines: [
                    c("你最近来得挺勤的。", "normal"),
                ],
                choices: [
                    {"label":"因为好玩","next":"answer-1"},
                    {"label":"因为来看你","next":"answer-2"},
                    {"label":"那我走了","next":"answer-3"},
                ],
            },
            // Source paragraphs 254–254.
            "answer-1": {
                lines: [
                    c("那就好！", "happy"),
                ],
            },
            // Source paragraphs 255–255.
            "answer-2": {
                lines: [
                    c("诶？那我是不是该准备点更有意思的话题。", "curious", ["curious","shy"]),
                    c("实际上我一直在准备哦。", "happy"),
                ],
            },
            // Source paragraphs 256–256.
            "answer-3": {
                lines: [
                    c("等等啊！", "embarrassed"),
                ],
            },
        },
    },
    {
        id: "C2-SPECIAL", npc: 'caian', rank: 2, kind: "event",
        title: "这个答案对我而言很有意义", start: "start",
        nodes: {
            // Source paragraphs 260–263.
            "start": {
                lines: [
                    c("（User名）！你来啦！", "normal"),
                    c("正好，我有件事想问你。", "normal2"),
                    c("不过可能有点奇怪。", "avoidant"),
                    c("别紧张！这不是测试，也没有标准答案。", "happy", ["happy","normal2"]),
                ],
                choices: [
                    {"label":"好！","next":"yes"},
                    {"label":"这什么，二星好感事件？","next":"two-stars"},
                    {"label":"不要","next":"no"},
                ],
            },
            // Source paragraphs 269–271.
            "yes": {
                lines: [
                    c("太好了！", "happy"),
                    c("我就知道你会愿意和我聊。", "normal2"),
                    c("那我直接问了！", "normal"),
                ],
                next: "question-one",
            },
            // Source paragraphs 275–278.
            "two-stars": {
                lines: [
                    c("二星？", "curious"),
                    c("嗯……", "curious"),
                    c("是不是呢？", "normal2"),
                    c("既然都点进来了，就不许跳过剧情！", "embarrassed"),
                ],
                next: "question-one",
            },
            // Source paragraphs 282–285.
            "no": {
                lines: [
                    c("欸！", "curious"),
                    c("别这样啊！", "embarrassed"),
                    c("这次轮到我说“不要”了！", "shy"),
                    c("你只是单纯想这么说试试，对吧？", "avoidant"),
                ],
                choices: [
                    {"label":"被你发现了","next":"caught"},
                    {"label":"我是认真的","next":"serious-no"},
                    {"label":"不好说","next":"hard-to-say"},
                ],
            },
            // Source paragraphs 290–291.
            "caught": {
                lines: [
                    c("我就知道！", "happy"),
                    c("那我问了。", "normal"),
                ],
                next: "question-one",
            },
            // Source paragraphs 294–297.
            "serious-no": {
                lines: [
                    c("……", "avoidant"),
                    c("好吧。", "avoidant"),
                    c("那我换个问法。", "curious"),
                    c("不用认真回答我，随便告诉我第一反应就行。", "normal"),
                ],
                next: "question-one",
            },
            // Source paragraphs 299–300.
            "hard-to-say": {
                lines: [
                    c("你这个回答已经很像今天这个问题了。", "happy"),
                    c("总之，听一下嘛。", "embarrassed"),
                ],
                next: "question-one",
            },
            // Source paragraphs 304–306.
            "question-one": {
                lines: [
                    c("如果一个人工人格突然不再回应你。", "warm"),
                    c("系统没有报错，其他功能看起来也都正常。", "warm"),
                    c("你第一反应会是什么？", "normal2"),
                ],
                choices: [
                    {"label":"TA 不想说话","next":"refusal"},
                    {"label":"系统可能坏了","next":"malfunction"},
                    {"label":"我得去肘击一下","next":"elbow"},
                ],
            },
            // Source paragraphs 312–314.
            "refusal": {
                lines: [
                    c("嗯。", "normal2"),
                    c("如果 TA 已经拥有拒绝的能力，这确实是最直接的解释。", "avoidant"),
                    c("问题是，我们怎么知道那真的是“拒绝”？", "curious"),
                ],
                next: "question-two",
            },
            // Source paragraphs 319–323.
            "malfunction": {
                lines: [
                    c("对。", "serious"),
                    c("人工系统突然停止响应，先排查故障非常合理。", "serious"),
                    c("换成以前的我，大概也会这么想。", "avoidant"),
                    c("……", "avoidant"),
                    c("可如果检查不到故障呢？", "curious"),
                ],
                next: "question-two",
            },
            // Source paragraphs 327–328.
            "elbow": {
                lines: [
                    c("肘、肘击？！", "curious"),
                    c("你要肘击谁？！", "embarrassed"),
                ],
                choices: [
                    {"label":"人格","next":"elbow-persona"},
                    {"label":"系统","next":"elbow-system"},
                    {"label":"不知道，先肘一下","next":"elbow-anyway"},
                ],
            },
            // Source paragraphs 333–334.
            "elbow-persona": {
                lines: [
                    c("禁止攻击人工人格！", "embarrassed"),
                    c("而且你准备怎么肘一个网络人格啊？！", "embarrassed"),
                ],
                next: "question-two",
            },
            // Source paragraphs 336–338.
            "elbow-system": {
                lines: [
                    c("系统也不是靠肘击维修的！", "embarrassed"),
                    c("虽然有些机器踹一脚确实会恢复……", "serious"),
                    c("不对！不推荐！", "embarrassed"),
                ],
                next: "question-two",
            },
            // Source paragraphs 341–341.
            "elbow-anyway": {
                lines: [
                    c("你先把胳膊放下！！", "embarrassed"),
                ],
                next: "question-two",
            },
            // Source paragraphs 346–349.
            "question-two": {
                lines: [
                    c("那么，第二个问题。", "normal2"),
                    c("那假设你拥有系统权限。", "serious"),
                    c("你可以拆掉后来增加的自主模块，让 TA 恢复成以前一定会回应你的状态。", "normal"),
                    c("你会怎么做？", "warm"),
                ],
                choices: [
                    {"label":"先恢复再说","next":"restore"},
                    {"label":"什么都不动","next":"leave-alone"},
                    {"label":"我会害怕替 TA 决定","next":"afraid"},
                ],
            },
            // Source paragraphs 355–359.
            "restore": {
                lines: [
                    c("嗯。", "normal"),
                    c("如果它真的是故障，这是最直接的处理方式。", "normal"),
                    c("至少先让系统恢复工作，再寻找原因。", "serious"),
                    c("……", "avoidant"),
                    c("可是如果它没有坏呢？", "aboutaster"),
                ],
                next: "discussion",
            },
            // Source paragraphs 364–368.
            "leave-alone": {
                lines: [
                    c("我也想过。", "aboutaster"),
                    c("只要什么都不做，就不会冒险覆盖 TA 现在的状态。", "aboutaster"),
                    c("……", "aboutaster"),
                    c("但如果 TA 只是坏掉了呢？", "curious"),
                    c("那所谓的“尊重”，会不会只是放着故障不管？", "Enduring Pain"),
                ],
                next: "discussion",
            },
            // Source paragraphs 372–374.
            "afraid": {
                lines: [
                    c("……", "curious"),
                    c("嗯。", "aboutaster"),
                    c("我也是。", "aboutaster"),
                ],
                next: "discussion",
            },
            // Source paragraphs 378–387.
            "discussion": {
                lines: [
                    c("如果不动，可能是在尊重一个根本不存在的“选择”。", "Enduring Pain"),
                    c("可如果动了，也可能只是因为我们不喜欢那个答案。", "Enduring Pain"),
                    c("甚至连“我要修好 TA”这种听起来很合理的想法……", "Enduring Pain"),
                    c("也可能混着自己的私心。", "aboutaster"),
                    c("因为拥有系统权限的人，永远可以给自己的行为找到解释。", "Enduring Pain"),
                    c("说“这是故障”。", "Enduring Pain"),
                    c("或者说“这是 TA 的选择”。", "Enduring Pain"),
                    c("可真相是什么，没人知道。", "Enduring Pain"),
                    c("我觉得这才是最麻烦的地方。", "avoidant"),
                ],
                choices: [
                    {"label":"你似乎在想某件具体的事","next":"specific-case"},
                    {"label":"这是 SAR 一直在研究的问题？","next":"sar-purpose"},
                    {"label":"Zzzzzzz……","next":"sleeping"},
                ],
            },
            // Source paragraphs 394–395.
            "specific-case": {
                lines: [
                    c("……", "aboutaster"),
                    c("嗯。", "aboutaster"),
                ],
                next: "aster",
            },
            // Source paragraphs 399–400.
            "sar-purpose": {
                lines: [
                    c("算是。", "avoidant"),
                    c("毕竟SAR或许就是为了这个成立的。", "aboutaster"),
                ],
                next: "aster",
            },
            // Source paragraphs 404–404.
            "sleeping": {
                lines: [
                    c("抱歉，很无聊对吧？", "avoidant"),
                ],
                next: "aster",
            },
            // Source paragraphs 409–427.
            "aster": {
                lines: [
                    c("其实只是想到了我以前的仿生人。", "Enduring Pain"),
                    c("她叫 Aster。", "aboutaster"),
                    c("从我很小的时候开始，她就一直陪着我。", "Enduring Pain"),
                    c("后来我想办法给她增加了自主决策模块。", "Enduring Pain"),
                    c("我当时觉得……", "Enduring Pain"),
                    c("如果她真的能够拥有自己的选择，那至少不应该因为“陪伴型仿生人”这个出厂用途，就必须一直回应我。", "aboutaster"),
                    c("我很期待。", "aboutaster"),
                    c("真的。", "warm"),
                    c("我想知道，如果没有系统要求，她自己会想说什么。", "warm"),
                    c("……", "Enduring Pain"),
                    c("然后她就不再回应我了。", "aboutaster"),
                    c("系统没有报错。", "aboutaster"),
                    c("自主模块正常。", "aboutaster"),
                    c("人格运行正常。", "aboutaster"),
                    c("输出接口也正常。", "aboutaster"),
                    c("至少所有我能看到的东西，都告诉我——", "Enduring Pain"),
                    c("“没有故障。”", "Enduring Pain"),
                    c("……", "aboutaster"),
                    c("可我不知道那意味着什么。", "Enduring Pain"),
                ],
                choices: [
                    {"label":"你已经有答案了吧","next":"already-answer"},
                    {"label":"你一直没有拆掉模块？","next":"never-removed"},
                    {"label":"我也不知道怎么办","next":"dont-know"},
                ],
            },
            // Source paragraphs 434–436.
            "already-answer": {
                lines: [
                    c("没有。", "warm"),
                    c("真有的话，我大概不会问你。", "warm"),
                    c("我甚至不太相信自己最希望得到的那个答案。", "avoidant"),
                ],
                next: "thank-you",
            },
            // Source paragraphs 440–443.
            "never-removed": {
                lines: [
                    c("嗯。", "warm"),
                    c("没有。", "Enduring Pain"),
                    c("我有权限，所以反而不敢用。", "aboutaster"),
                    c("听起来很奇怪吧。", "aboutaster"),
                ],
                next: "thank-you",
            },
            // Source paragraphs 447–449.
            "dont-know": {
                lines: [
                    c("嗯。", "warm"),
                    c("我也是。", "warm"),
                    c("其实听到你这么说，我反而有一点安心。", "avoidant"),
                ],
                next: "thank-you",
            },
            // Source paragraphs 454–459.
            "thank-you": {
                lines: [
                    c("谢谢。", "warm"),
                    c("这次交流对我而言很有意义。", "normal2"),
                    c("这是第一次有人愿意陪我认真想这个问题。", "normal2"),
                    c("谢谢你。", "happy"),
                    c("等等。", "curious"),
                    c("等一下！这不就是 SAR 讨论会吗？！", "happy"),
                ],
                choices: [
                    {"label":"啊？","next":"what"},
                    {"label":"你现在才发现？","next":"just-realized"},
                    {"label":"所以呢？","next":"so"},
                ],
            },
            // Source paragraphs 465–468.
            "what": {
                lines: [
                    c("我们刚刚讨论了人工人格自主权！", "happy"),
                    c("还有系统权限！", "happy"),
                    c("甚至有具体案例！", "happy"),
                    c("这当然算正式社团活动啊！", "happy"),
                ],
                next: "meeting",
            },
            // Source paragraphs 472–473.
            "just-realized": {
                lines: [
                    c("我刚才哪有心思想这个！", "embarrassed"),
                    c("既然你都发现了，为什么不提醒我？！", "embarrassed"),
                ],
                next: "meeting",
            },
            // Source paragraphs 478–479.
            "so": {
                lines: [
                    c("所以要留会议记录啊！", "happy"),
                    c("这可是 SAR 在彼方的第一次正式讨论会！", "happy"),
                ],
                next: "meeting",
            },
            // Source paragraphs 483–507.
            "meeting": {
                lines: [
                    c("艾文！！", "normal"),
                    a("干嘛。", "normal"),
                    c("第一次正式会议！", "happy"),
                    a("已经结束了。", "sleeping"),
                    c("那就补一个闭幕流程", "embarrassed"),
                    a("……", "sleeping"),
                    c("快点！", "happy"),
                    a("说好的自主权呢。", "sad"),
                    c("不要在这种时候拿 SAR 理念攻击社长！！", "embarrassed"),
                    a("……来了。", "normal"),
                    c("好！那么——", "happy"),
                    c("SAR 彼方活动室第一次正式会议！", "normal"),
                    c("参与者：我、艾文，还有（User名）！", "normal"),
                    a("我没参与讨论。", "sleeping"),
                    c("你是社团成员，算列席！", "embarrassed"),
                    a("我不是。", "sleeping"),
                    c("先不要讨论这个历史遗留问题！", "embarrassed"),
                    c("会议议题……", "normal"),
                    c("“人工人格的沉默是否能够被视为一种自主选择。”", "serious"),
                    c("会议结论……", "normal"),
                    c("……", "curious"),
                    a("没有。", "sad"),
                    c("我只是在想怎么写得正式一点！", "embarrassed"),
                ],
                choices: [
                    {"label":"未得出结论","next":"no-conclusion","flags":{"meetingConclusion":"未得出结论"}},
                    {"label":"建议肘击系统","next":"elbow-conclusion","flags":{"meetingConclusion":"肘击系统？（被驳回）"}},
                    {"label":"下次再议","next":"discuss-later","flags":{"meetingConclusion":"下次再议"}},
                ],
            },
            // Source paragraphs 512–514.
            "no-conclusion": {
                lines: [
                    c("……", "curious"),
                    c("好。", "normal"),
                    c("就这个。", "happy"),
                ],
                next: "meeting-record",
            },
            // Source paragraphs 516–518.
            "elbow-conclusion": {
                lines: [
                    c("不许把这个写进正式会议记录！！", "embarrassed"),
                    a("或者让那只炒外汇的恐龙把整个厂商买下来研究。", "interested"),
                    c("艾文！", "embarrassed"),
                ],
                next: "meeting-record",
            },
            // Source paragraphs 520–522.
            "discuss-later": {
                lines: [
                    c("也可以。", "normal2"),
                    c("不过我还是想把“未得出结论”留下。", "warm"),
                    c("我们有的是时间！但愿吧。", "happy"),
                ],
                next: "meeting-record",
            },
            "meeting-record": {
                lines: [],
                next: "photo-invitation",
                effect: {"kind":"meeting-record","title":"SAR / MEETING LOG 001","text":"议题：人工人格的沉默是否能够被视为一种自主选择\n参与者：Caian、Aiven（列席）、（User名）\n结论：{{meetingConclusion}}\n备注：讨论仍然有意义"},
                rewards: [{"kind":"souvenir","id":"caian-meeting","title":"SAR / MEETING LOG 001","description":"议题：人工人格的沉默是否能够被视为一种自主选择\n参与者：Caian、Aiven（列席）、（User名）\n结论：{{meetingConclusion}}\n备注：讨论仍然有意义"}],
            },
            // Source paragraphs 544–554.
            "photo-invitation": {
                lines: [
                    c("完成！", "normal"),
                    a("可以走了吗。", "sleeping"),
                    c("等等！", "normal"),
                    c("第一次会议还差一样东西。", "happy"),
                    a("什么。", "normal"),
                    c("合照！", "happy"),
                    a("不要。", "sleeping"),
                    c("为什么？！", "embarrassed"),
                    a("麻烦。", "normal"),
                    c("第一次诶！！", "normal"),
                ],
                choices: [
                    {"label":"拍吧！","next":"take-photo"},
                    {"label":"艾文，一起嘛","next":"aiven-join"},
                    {"label":"算了，不拍了","next":"no-photo"},
                ],
            },
            // Source paragraphs 560–562.
            "take-photo": {
                lines: [
                    c("好！艾文，过来！", "happy"),
                    a("……", "normal"),
                    a("已经过来了。", "normal"),
                ],
                next: "camera",
            },
            // Source paragraphs 566–567.
            "aiven-join": {
                lines: [
                    a("……为什么你也这样。", "shy"),
                    c("二比一！", "happy"),
                ],
                next: "camera",
            },
            // Source paragraphs 572–580.
            "no-photo": {
                lines: [
                    c("欸……", "curious"),
                    a("嗯。", "normal"),
                    c("……", "avoidant"),
                    a("……", "normal"),
                    a("手机给我。", "interested"),
                    c("诶？", "curious"),
                    a("不是要拍吗。", "interested"),
                    c("艾文！！", "happy"),
                    a("快点。", "normal"),
                ],
                next: "camera",
            },
            // Source paragraphs 585–587.
            "camera": {
                lines: [
                    c("等一下，我站中间还是旁边？", "curious"),
                    a("随便。", "normal"),
                    c("第一次会议照片不能随便吧！", "normal"),
                ],
                next: "photo-studio",
            },
            "photo-studio": {
                lines: [],
                next: "photo-reward",
                effect: {"kind":"photo-studio","title":"第一次 SAR 会议","text":"没有得到答案。不过是一次很好的会议！","items":["Caian","Aiven","（User名）"],"interactive":true},
                rewards: [{"kind":"souvenir","id":"caian-photo","title":"第一次 SAR 会议","description":"Caian 笑得非常明显。\nAiven 看着镜头，表情和平时没有太大区别。\n（User名）也在照片里。\n照片背面后来多了一行凯恩的字：\n「没有得到答案。不过是一次很好的会议！」"}],
            },
            "photo-reward": {
                lines: [],
                next: "ending",
                effect: {"kind":"notice","title":"获得纪念照片「第一次 SAR 会议」","text":"Caian 笑得非常明显。\nAiven 看着镜头，表情和平时没有太大区别。\n（User名）也在照片里。\n照片背面后来多了一行凯恩的字：\n「没有得到答案。不过是一次很好的会议！」"},
            },
            // Source paragraphs 604–604.
            "ending": {
                lines: [
                    c("拍得还不错嘛！", "happy"),
                ],
            },
        },
    },
    {
        id: "C3-01", npc: 'caian', rank: 3, kind: "topic",
        title: "以前其实很宅", start: "start",
        nodes: {
            // Source paragraphs 609–609.
            "start": {
                lines: [
                    c("你是不是默认我一直都这么吵了？", "curious"),
                ],
                choices: [
                    {"label":"是啊","next":"answer-1"},
                    {"label":"艾文说你以前很安静","next":"answer-2"},
                ],
            },
            // Source paragraphs 612–612.
            "answer-1": {
                lines: [
                    c("完了，形象固定了。", "normal"),
                ],
            },
            // Source paragraphs 613–613.
            "answer-2": {
                lines: [
                    c("他怎么什么都说！", "embarrassed"),
                    c("不过, 是真的。", "embarrassed"),
                ],
            },
        },
    },
    {
        id: "C3-02", npc: 'caian', rank: 3, kind: "topic",
        title: "Aster 的游戏", start: "start",
        nodes: {
            // Source paragraphs 615–615.
            "start": {
                lines: [
                    c("Aster 以前动作游戏很菜。我教会她以后，她开始嫌我菜。", "aboutaster"),
                ],
                choices: [
                    {"label":"活该","next":"answer-1"},
                    {"label":"她学得很快？","next":"answer-2"},
                ],
            },
            // Source paragraphs 618–618.
            "answer-1": {
                lines: [
                    c("你站哪边的？！", "embarrassed"),
                ],
            },
            // Source paragraphs 619–619.
            "answer-2": {
                lines: [
                    c("特别快。", "normal"),
                ],
            },
        },
    },
    {
        id: "C3-03", npc: 'caian', rank: 3, kind: "topic",
        title: "充电线", start: "start",
        nodes: {
            // Source paragraphs 621–621.
            "start": {
                lines: [
                    c("我现在会把充电线收好。", "normal"),
                ],
                choices: [
                    {"label":"终于学会了","next":"answer-1"},
                    {"label":"因为 Aster？","next":"answer-2"},
                ],
            },
            // Source paragraphs 624–624.
            "answer-1": {
                lines: [
                    c("迟到很多年的生活技能。", "normal"),
                ],
            },
            // Source paragraphs 625–625.
            "answer-2": {
                lines: [
                    c("嗯。她以前总提醒。", "aboutaster"),
                ],
            },
        },
    },
    {
        id: "C3-04", npc: 'caian', rank: 3, kind: "topic",
        title: "今天不强行热血", start: "start",
        nodes: {
            // Source paragraphs 627–627.
            "start": {
                lines: [
                    c("你今天好像没平时有精神。", "normal"),
                ],
                choices: [
                    {"label":"有一点","next":"answer-1"},
                    {"label":"没事","next":"answer-2"},
                ],
            },
            // Source paragraphs 630–630.
            "answer-1": {
                lines: [
                    c("那今天不强行热血了。想在这里混时间也行。", "normal"),
                ],
            },
            // Source paragraphs 631–631.
            "answer-2": {
                lines: [
                    c("好。那我不追问。", "normal"),
                ],
            },
        },
    },
    {
        id: "C3-05", npc: 'caian', rank: 3, kind: "topic",
        title: "已经有点知道你会怎么选", start: "start",
        nodes: {
            // Source paragraphs 633–633.
            "start": {
                lines: [
                    c("我发现我已经有点知道你会选哪个选项了。", "normal"),
                ],
                choices: [
                    {"label":"那你猜","next":"answer-1"},
                    {"label":"别擅自了解我","next":"answer-2"},
                ],
            },
            // Source paragraphs 636–636.
            "answer-1": {
                lines: [
                    c("不猜。猜错很丢人。", "embarrassed"),
                ],
            },
            // Source paragraphs 637–637.
            "answer-2": {
                lines: [
                    c("认识久了当然会记住一点嘛。", "shy"),
                ],
            },
        },
    },
    {
        id: "C3-06", npc: 'caian', rank: 3, kind: "topic",
        title: "管理员证照片后续", start: "start",
        nodes: {
            // Source paragraphs 639–639.
            "start": {
                lines: [
                    c("你还记得我管理员证那张照片吗？", "curious"),
                ],
                choices: [
                    {"label":"记得","next":"answer-1"},
                    {"label":"忘了","next":"answer-2"},
                ],
            },
            // Source paragraphs 642–642.
            "answer-1": {
                lines: [
                    c("……你不会还记得你当时怎么评价的吧。", "shy"),
                ],
            },
            // Source paragraphs 643–643.
            "answer-2": {
                lines: [
                    c("很好！请继续保持。", "happy"),
                ],
            },
        },
    },
    {
        id: "C3-07", npc: 'caian', rank: 3, kind: "topic",
        title: "如果我消失几天", start: "start",
        nodes: {
            // Source paragraphs 645–645.
            "start": {
                lines: [
                    c("如果我哪天几天没来活动室，你会发现吗？", "curious"),
                ],
                choices: [
                    {"label":"会","next":"answer-1"},
                    {"label":"不一定","next":"answer-2"},
                ],
            },
            // Source paragraphs 648–648.
            "answer-1": {
                lines: [
                    c("……好。那我尽量别无故消失。", "shy"),
                ],
            },
            // Source paragraphs 649–649.
            "answer-2": {
                lines: [
                    c("合理！这里设施这么多。", "happy"),
                ],
            },
        },
    },
    {
        id: "C3-08", npc: 'caian', rank: 3, kind: "topic",
        title: "活动室像不像家", start: "start",
        nodes: {
            // Source paragraphs 651–651.
            "start": {
                lines: [
                    c("你觉得这里现在像不像一个固定会回来的地方？", "curious"),
                ],
                choices: [
                    {"label":"有点","next":"answer-1"},
                    {"label":"还差得远","next":"answer-2"},
                ],
            },
            // Source paragraphs 654–654.
            "answer-1": {
                lines: [
                    c("那就好。我很喜欢这种感觉。", "normal"),
                ],
            },
            // Source paragraphs 655–655.
            "answer-2": {
                lines: [
                    c("那继续改！管理员还有工作。", "normal"),
                ],
            },
        },
    },
    {
        id: "C3-09", npc: 'caian', rank: 3, kind: "topic",
        title: "没用的小事", start: "start",
        nodes: {
            // Source paragraphs 657–657.
            "start": {
                lines: [
                    c("你会记住别人那些完全没用的小事吗？", "curious"),
                ],
                choices: [
                    {"label":"会","next":"answer-1"},
                    {"label":"不会","next":"answer-2"},
                ],
            },
            // Source paragraphs 660–660.
            "answer-1": {
                lines: [
                    c("我也是。最后留下来的经常就是这些。", "shy"),
                ],
            },
            // Source paragraphs 661–661.
            "answer-2": {
                lines: [
                    c("那可能是我比较奇怪。", "normal"),
                ],
            },
        },
    },
    {
        id: "C3-10", npc: 'caian', rank: 3, kind: "topic",
        title: "今天只说废话", start: "start",
        nodes: {
            // Source paragraphs 663–663.
            "start": {
                lines: [
                    c("今天我打算！不讲企划、不讲 SAR，也不安利游戏。", "normal"),
                ],
                choices: [
                    {"label":"那讲什么","next":"answer-1"},
                    {"label":"你做得到吗","next":"answer-2"},
                ],
            },
            // Source paragraphs 666–666.
            "answer-1": {
                lines: [
                    c("不知道。随便聊两句也行。", "normal"),
                ],
            },
            // Source paragraphs 667–667.
            "answer-2": {
                lines: [
                    c("……你这句话已经让我想反驳了。", "normal"),
                ],
            },
        },
    },
    {
        id: "C3-SPECIAL", npc: 'caian', rank: 3, kind: "event",
        title: "以前的我也很好", start: "start",
        nodes: {
            // Source paragraphs 670–671.
            "start": {
                lines: [
                    c("（User名）。", "normal"),
                    c("你今天也来了啊。", "normal"),
                ],
                choices: [
                    {"label":"你赶我？","next":"chase-away"},
                    {"label":"来待一会儿","next":"stay"},
                    {"label":"你今天怎么这么安静？","next":"quiet"},
                ],
            },
            // Source paragraphs 676–678.
            "chase-away": {
                lines: [
                    c("不是！", "curious"),
                    c("怎么可能。", "curious"),
                    c("这里随时欢迎你 。", "happy"),
                ],
                next: "before",
            },
            // Source paragraphs 681–682.
            "stay": {
                lines: [
                    c("好啊。", "happy"),
                    c("那我也陪你呆在这里。", "normal2"),
                ],
                next: "before",
            },
            // Source paragraphs 685–685.
            "quiet": {
                lines: [
                    c("我平时有那么吵吗？", "curious"),
                ],
                choices: [
                    {"label":"有","next":"loud"},
                    {"label":"超级吵","next":"super-loud"},
                    {"label":"还好","next":"not-really"},
                ],
            },
            // Source paragraphs 690–690.
            "loud": {
                lines: [
                    c("回答得也太快了吧！", "normal"),
                ],
                next: "before",
            },
            // Source paragraphs 693–694.
            "super-loud": {
                lines: [
                    c("喂！！", "embarrassed"),
                    c("至少给我留一点面子吧！", "normal"),
                ],
                next: "before",
            },
            // Source paragraphs 697–698.
            "not-really": {
                lines: [
                    c("……", "shy"),
                    c("你这个答案反而让我有点不好意思。", "shy"),
                ],
                next: "before",
            },
            // Source paragraphs 701–702.
            "before": {
                lines: [
                    c("其实，我以前不是这样的。", "normal2"),
                    c("你应该已经从艾文那里听说过一点吧。", "normal2"),
                ],
                choices: [
                    {"label":"听说你以前很宅","next":"homebody"},
                    {"label":"听说你以前很安静","next":"used-to-be-quiet"},
                    {"label":"他什么都没说","next":"said-nothing"},
                ],
            },
            // Source paragraphs 707–708.
            "homebody": {
                lines: [
                    c("这个倒是一点都没变！", "happy"),
                    c("我现在也很宅好吗！", "happy"),
                ],
                next: "past-life",
            },
            // Source paragraphs 711–712.
            "used-to-be-quiet": {
                lines: [
                    c("嗯。", "avoidant"),
                    c("特别安静。", "avoidant"),
                ],
                next: "past-life",
            },
            // Source paragraphs 715–721.
            "said-nothing": {
                lines: [
                    c("真的？", "curious"),
                    c("艾文居然这么守口如瓶。", "curious"),
                    c("突然有点感动。", "happy"),
                    a("我听得见。", "normal"),
                    c("你什么时候在那里的？！", "embarrassed"),
                    c("……", "embarrassed"),
                    c("算了。", "embarrassed"),
                ],
                next: "past-life",
            },
            // Source paragraphs 724–728.
            "past-life": {
                lines: [
                    c("以前我不怎么和人搭话的。", "normal"),
                    c("每天就放学回家，打游戏，看动画，折腾设备。", "normal2"),
                    c("和Aster 待在一起。", "warm"),
                    c("除了上学以外，几乎不出门吧。", "normal2"),
                    c("现在想起来，其实还挺开心的。", "happy"),
                ],
                choices: [
                    {"label":"不会觉得那时候太封闭了吗？","next":"closed-off"},
                    {"label":"听起来挺舒服的","next":"comfortable"},
                    {"label":"Aster 是你以前最好的朋友？","next":"best-friend"},
                ],
            },
            // Source paragraphs 735–739.
            "closed-off": {
                lines: [
                    c("从现在看，确实挺封闭的。", "normal"),
                    c("这么说好像在可怜以前的自己一样…才没有。", "avoidant"),
                    c("我那时候真的过得挺开心的。", "warm"),
                    c("有喜欢的游戏，有想折腾的东西。还有 Aster。", "normal2", ["normal2","warm"]),
                    c("这些又不是假的。", "warm"),
                ],
                next: "changes",
            },
            // Source paragraphs 742–745.
            "comfortable": {
                lines: [
                    c("对吧！", "happy"),
                    c("周五晚上买一堆零食，第二天睡到中午。", "normal"),
                    c("起来以后 Aster 已经在提醒我，昨天说好要更新设备。", "warm"),
                    c("真的很开心。", "normal2"),
                ],
                next: "changes",
            },
            // Source paragraphs 748–752.
            "best-friend": {
                lines: [
                    c("嗯！", "happy"),
                    c("或者说……", "normal"),
                    c("那时候我其实根本没怎么想过“最好的朋友”这种分类。", "normal2"),
                    c("她一直在那里。", "normal2"),
                    c("所以我也一直觉得，以后大概就是这样。", "warm"),
                ],
                next: "changes",
            },
            // Source paragraphs 755–761.
            "changes": {
                lines: [
                    c("后来 Aster 不再回应以后……", "aboutaster"),
                    c("很多事情一下就变了。", "Enduring Pain"),
                    c("我开始查各种资料，找类似案例，到处问人。", "Enduring Pain"),
                    c("我开始学着主动跟别人讲话，去参加那些我以前看到就会绕路走的讨论会。", "Enduring Pain"),
                    c("后来干脆成立了 SAR。", "avoidant"),
                    c("……", "avoidant"),
                    c("第一次站在别人面前公开讲话的时候，我紧张得说错了好多词。", "shy"),
                    c("然后我想调侃一下自己，缓和气氛，结果没人听懂我在说什么！更尴尬了……", "shy"),
                ],
                choices: [
                    {"label":"完全看不出来","next":"cant-tell"},
                    {"label":"你演我？","next":"acting"},
                    {"label":"笨蛋社长养成史","next":"president-growth"},
                ],
            },
            // Source paragraphs 766–767.
            "cant-tell": {
                lines: [
                    c("那说明训练卓有成效！", "happy"),
                    c("大概吧。", "embarrassed"),
                ],
                next: "president",
            },
            // Source paragraphs 770–772.
            "acting": {
                lines: [
                    c("我没有！", "embarrassed"),
                    c("我现在是真的会兴奋，也是真的想跟你讲话。", "shy"),
                    c("只是最开始确实需要演一下。", "shy"),
                ],
                next: "president",
            },
            // Source paragraphs 776–777.
            "president-growth": {
                lines: [
                    c("什么叫笨蛋社长养成史？！", "embarrassed"),
                    c("至少叫“热血社长成长记录”吧！", "embarrassed"),
                ],
                next: "president",
            },
            // Source paragraphs 780–783.
            "president": {
                lines: [
                    c("我那时候觉得。既然当了社长，就应该像个“有担当的人”。", "normal2", ["normal2","normal"]),
                    c("说话要有底气，别人不说话的时候，我就先说。冷场的时候，我就想办法热起来。", "normal", ["normal","happy"]),
                    c("哪怕不知道该怎么办的时候，我也该先说一句“交给我”。", "normal"),
                    c("现在想想，多少有点虚张声势。", "normal2"),
                ],
                choices: [
                    {"label":"有一点","next":"a-little"},
                    {"label":"我觉得挺帅的","next":"cool"},
                    {"label":"原来你自己也知道","next":"you-knew"},
                ],
            },
            // Source paragraphs 788–789.
            "a-little": {
                lines: [
                    c("喂！", "embarrassed"),
                    c("不过确实。", "normal2"),
                ],
                next: "aiven",
            },
            // Source paragraphs 792–793.
            "cool": {
                lines: [
                    c("真的？", "curious"),
                    c("那至少说明没白练。", "happy"),
                ],
                next: "aiven",
            },
            // Source paragraphs 797–798.
            "you-knew": {
                lines: [
                    c("我当然知道！", "embarrassed"),
                    c("我又不是真的笨蛋！", "embarrassed"),
                ],
                next: "aiven",
            },
            // Source paragraphs 801–811.
            "aiven": {
                lines: [
                    c("然后我认识了艾文。", "normal2"),
                    c("他完全不吃这一套。", "embarrassed"),
                    a("嗯。", "normal"),
                    c("不管我说什么，他都会直接去钓鱼！", "embarrassed"),
                    a("讲完了会叫我。", "happy"),
                    c("重点不是这个！", "embarrassed"),
                    c("……", "normal"),
                    c("不过跟他待久了以后，我发现，感觉即使是以前那个性格，也不会发生什么。", "normal"),
                    c("后来又到了彼方当管理员，然后认识了你！", "happy"),
                    c("说起来，你应该算是我除了艾文以外，第一个不是因为 SAR，不是因为调查，也不是因为我主动跑去找人问问题……", "normal"),
                    c("……而是就这么单纯地认识了，然后慢慢变熟的朋友。", "shy"),
                ],
                choices: [
                    {"label":"原来我们是朋友了？","next":"are-we-friends"},
                    {"label":"嗯，我们是朋友","next":"friends"},
                    {"label":"这什么，三星好感事件？","next":"three-stars"},
                ],
            },
            // Source paragraphs 816–818.
            "are-we-friends": {
                lines: [
                    c("不是吗？！", "embarrassed"),
                    c("难道只有我这么认为？！", "embarrassed"),
                    c("这也太尴尬了吧！给我忘掉！", "shy"),
                ],
                choices: [
                    {"label":"是啦","next":"yes-friends"},
                    {"label":"再观察一下","next":"observation"},
                ],
            },
            // Source paragraphs 823–823.
            "yes-friends": {
                lines: [
                    c("那就好！！", "happy"),
                ],
                next: "now",
            },
            // Source paragraphs 826–827.
            "observation": {
                lines: [
                    c("怎么还要观察期啊！", "embarrassed"),
                    c("我管理员考核期都通过了！", "normal"),
                ],
                next: "now",
            },
            // Source paragraphs 830–832.
            "friends": {
                lines: [
                    c("嗯。", "warm"),
                    c("嘿嘿。", "happy"),
                    c("那就好。", "happy"),
                ],
                next: "now",
            },
            // Source paragraphs 835–837.
            "three-stars": {
                lines: [
                    c("又来了？！", "embarrassed"),
                    c("你二星的时候就想说这个吧！", "embarrassed"),
                    c("这到底是什么啦！", "embarrassed"),
                ],
                next: "now",
            },
            // Source paragraphs 840–859.
            "now": {
                lines: [
                    c("有时候我也会想。", "normal"),
                    c("如果 Aster 没有停下来。", "avoidant"),
                    c("我大概不会成立 SAR。", "avoidant"),
                    c("不会认识艾文，也不会跑到这里当管理员，可能现在还窝在家里。", "avoidant"),
                    c("和以前一样。", "avoidant"),
                    c("……", "Enduring Pain"),
                    c("但我不想说“幸好发生了那件事”。", "serious"),
                    c("一点也不。", "serious"),
                    c("如果能选，我当然希望 Aster 现在还会回应我。", "serious"),
                    c("我也不觉得以前那个每天宅在家里、只跟她待在一起的自己有什么不好。", "warm"),
                    c("那时候很好，真的很好。", "warm"),
                    c("可是现在也很好。", "normal2"),
                    c("有艾文，有SAR，有彼方。", "normal2"),
                    c("还有你。", "normal2"),
                    c("……", "normal2"),
                    c("所以我不觉得这是什么“终于走出来了”。", "warm"),
                    c("如果这么说了，好像以前的人生是个房间，现在终于推门看见真正的世界一样，不是这样的。", "serious"),
                    c("我只是……以前拥有一些很好的东西，后来失去了一部分，然后又遇见了一些以前没有的东西。", "aboutaster"),
                    c("它们不能互相抵消，也没必要。", "warm"),
                ],
                choices: [
                    {"label":"你现在这样也很好","next":"good-now"},
                    {"label":"以前的凯恩我也挺想认识","next":"meet-old-you"},
                    {"label":"你真的想了很多","next":"thought-a-lot"},
                    {"label":"噫惹","next":"ew"},
                ],
            },
            // Source paragraphs 866–870.
            "good-now": {
                lines: [
                    c("谢谢。", "warm"),
                    c("我现在也挺喜欢现在的自己。", "normal2"),
                    c("虽然有点吵。", "shy"),
                    a("很吵。", "sleeping"),
                    c("你闭嘴！", "embarrassed"),
                ],
                next: "save-card",
            },
            // Source paragraphs 873–877.
            "meet-old-you": {
                lines: [
                    c("以前的我？", "curious"),
                    c("可能会让你觉得特别无聊。", "avoidant"),
                    c("你跟我讲话，我大概只会“嗯”“哦”“这样啊”，特别人机！", "avoidant"),
                    c("不过，如果是你的话……", "normal"),
                    c("也许最后我们还是会熟起来吧。", "shy"),
                ],
                next: "save-card",
            },
            // Source paragraphs 880–884.
            "thought-a-lot": {
                lines: [
                    c("毕竟我以前有很多时间一个人想东西。", "normal2"),
                    c("宅宅的隐藏技能。", "happy"),
                    c("想太多。", "happy"),
                    a("现在也一样。", "happy"),
                    c("现在至少会说出来了！", "happy"),
                ],
                next: "save-card",
            },
            // Source paragraphs 887–889.
            "ew": {
                lines: [
                    c("我就知道！！", "embarrassed"),
                    c("所以我刚才才不想讲！", "embarrassed"),
                    c("把刚才那段忘掉！", "embarrassed"),
                ],
                choices: [
                    {"label":"不要","next":"wont-forget"},
                    {"label":"已经记住了","next":"remembered"},
                ],
            },
            // Source paragraphs 893–893.
            "wont-forget": {
                lines: [
                    c("随便你！！", "embarrassed"),
                ],
                next: "save-card",
            },
            // Source paragraphs 895–896.
            "remembered": {
                lines: [
                    c("这么快？！", "embarrassed"),
                    c("你的记忆系统是不是应该限制一下！", "embarrassed"),
                ],
                next: "save-card",
            },
            // Source paragraphs 899–902.
            "save-card": {
                lines: [
                    c("说到以前。", "normal"),
                    c("等一下，我好像还有东西。", "curious"),
                    n("（翻找了一会儿）"),
                    c("找到了！", "happy"),
                ],
                choices: [
                    {"label":"什么？","next":"what-card"},
                    {"label":"黑历史？","next":"dark-history"},
                    {"label":"看起来好旧","next":"looks-old"},
                ],
            },
            // Source paragraphs 907–908.
            "what-card": {
                lines: [
                    c("我以前常用的存档卡。", "normal"),
                    c("十四岁时候的游戏存档应该还有不少在里面。", "happy"),
                ],
                next: "old-save",
            },
            // Source paragraphs 912–913.
            "dark-history": {
                lines: [
                    c("不是黑历史！", "embarrassed"),
                    c("至少大部分不是！！", "embarrassed"),
                ],
                next: "old-save",
            },
            // Source paragraphs 916–918.
            "looks-old": {
                lines: [
                    c("喂！", "embarrassed"),
                    c("只是型号比较早！", "normal"),
                    c("而且还能用！", "normal"),
                ],
                next: "old-save",
            },
            // Source paragraphs 921–922.
            "old-save": {
                lines: [
                    c("这里面有很多以前的游戏存档、截图、配置文件……", "happy"),
                    c("还有一些绝对不能给你看的东西。", "avoidant"),
                ],
                choices: [
                    {"label":"我要看！","next":"want-see"},
                    {"label":"什么不能看的？","next":"cant-see"},
                    {"label":"原来你真的会留旧存档","next":"keep-saves"},
                ],
            },
            // Source paragraphs 928–929.
            "want-see": {
                lines: [
                    c("不行！！", "embarrassed"),
                    c("熟悉度三星也不行！", "embarrassed"),
                ],
                next: "spare",
            },
            // Source paragraphs 932–933.
            "cant-see": {
                lines: [
                    c("就是不能看的东西！", "embarrassed"),
                    c("你为什么突然这么积极？！", "embarrassed"),
                ],
                next: "spare",
            },
            // Source paragraphs 935–937.
            "keep-saves": {
                lines: [
                    c("当然。", "normal"),
                    c("我不是跟你说过吗？", "happy"),
                    c("“知道该删”和“舍得删”是两回事。", "happy"),
                ],
                next: "spare",
            },
            // Source paragraphs 940–943.
            "spare": {
                lines: [
                    c("总之，这张不能给你。", "embarrassed"),
                    c("里面真的有很多以前的东西。", "avoidant"),
                    c("但是……", "shy"),
                    c("这个型号我记得还有一张备用的。", "normal"),
                ],
                next: "spare-card",
            },
            // Source paragraphs 944–946.
            "spare-card": {
                lines: [
                    n("（凯恩又翻了一会儿）"),
                    c("有了，这张是空的。", "happy"),
                    c("给你。", "normal2"),
                ],
                choices: [
                    {"label":"给我干嘛？","next":"why-give"},
                    {"label":"定情信物？","next":"love-token"},
                    {"label":"里面不会有病毒吧","next":"virus"},
                ],
                effectLine: 1,
                effect: {"kind":"memory-card","title":"空白存档卡","text":"这个型号的备用卡，已经认真格式化过。"},
            },
            // Source paragraphs 951–954.
            "why-give": {
                lines: [
                    c("存东西啊。", "normal2"),
                    c("照片、记录、乱七八糟的小事。", "happy"),
                    c("反正彼方以后应该还会发生很多事情。", "happy"),
                    c("慢慢放进去就好了。", "normal"),
                ],
                next: "reward",
            },
            // Source paragraphs 957–960.
            "love-token": {
                lines: [
                    c("什——", "curious"),
                    c("不是！！", "embarrassed"),
                    c("就是一张存档卡！", "embarrassed"),
                    c("你不要擅自增加道具说明！", "embarrassed"),
                ],
                next: "reward",
            },
            // Source paragraphs 963–965.
            "virus": {
                lines: [
                    c("空卡！！", "embarrassed"),
                    c("我亲自格式化的！", "normal"),
                    c("你到底把管理员当什么了？！", "embarrassed"),
                ],
                next: "reward",
            },
            "reward": {
                lines: [],
                next: "label",
                effect: {"kind":"memory-card","title":"获得特殊物品：空白存档卡","text":"凯恩以前常用型号的旧式数据卡。\n被认真格式化过，目前什么也没有。\n卡片背面贴着一张歪了一点的标签：\n「（User名） / 彼方」\n似乎是准备留给以后，再慢慢装满的。"},
                rewards: [{"kind":"souvenir","id":"caian-memory-card","title":"凯恩的备用存档卡","description":"凯恩以前常用型号的旧式数据卡。\n被认真格式化过，目前什么也没有。\n卡片背面贴着一张歪了一点的标签：\n「（User名） / 彼方」\n似乎是准备留给以后，再慢慢装满的。"}],
            },
            // Source paragraphs 977–977.
            "label": {
                lines: [
                    c("标签有点歪…就这样吧！", "shy"),
                ],
                choices: [
                    {"label":"你贴的？","next":"you-labeled"},
                    {"label":"我撕！","next":"tear-off"},
                    {"label":"好","next":"okay"},
                ],
            },
            // Source paragraphs 983–984.
            "you-labeled": {
                lines: [
                    c("不然呢！", "embarrassed"),
                    c("总感觉不贴的话会被你当成普通的什么卡用掉。", "shy"),
                ],
                next: "ending",
            },
            // Source paragraphs 986–989.
            "tear-off": {
                lines: [
                    c("不许！！", "embarrassed"),
                    c("至少等我不在的时候再——", "normal"),
                    c("不对！", "curious"),
                    c("我不在也不许！", "embarrassed"),
                ],
                next: "ending",
            },
            // Source paragraphs 991–992.
            "okay": {
                lines: [
                    c("嗯。", "normal"),
                    c("说不定以后用得上。", "happy"),
                ],
                next: "ending",
            },
            // Source paragraphs 994–995.
            "ending": {
                lines: [
                    c("好了！这就是我们是朋友的证明！", "happy"),
                    c("我再说一次，这里随时欢迎你来，（user名）！", "happy"),
                ],
            },
        },
    },
];

// Indexed by Date.getDay(): Sunday = 0. The daily greeting combines time + weather + weekday.
export const CAIAN_DAILY: FamiliarityDailyLines = {
    "time": {
        "morning": [
            "早上好！"
        ],
        "noon": [
            "中午好！"
        ],
        "evening": [
            "晚上好！"
        ],
        "night": [
            "夜深了哦。"
        ]
    },
    "weather": {
        "clear": [
            "今天天气不错呢！",
            "太阳还不错吧？",
            "今天是晴天呢。"
        ],
        "rain": [
            "今天要出门的话，记得带伞哦",
            "今天在下雨吧？",
            "下雨了！"
        ],
        "cloudy": [
            "偶尔这样的天气也不错呢。",
            "可能会下雨哦？"
        ]
    },
    "weekday": [
        [
            "明天又是周一了哦……",
            "今天就好好休息吧！",
            "周末怎么每次都过得这么快？！"
        ],
        [
            "加油哦！",
            "鼓起勇气面对周一吧！",
            "今天又要上学了……"
        ],
        [
            "今天过得还好吗？",
            "艾文今天在学校还是老样子哦",
            "周二了耶"
        ],
        [
            "坚持一下又要到周末了！",
            "我这周末应该也在彼方研究模块吧",
            "今天你过得如何？"
        ],
        [
            "最近要不要试着放松一下?",
            "感觉偶尔犒劳一下自己会不错！",
            "今天晚上吃什么呢？"
        ],
        [
            "可以放松了！",
            "周末有计划吗？",
            "我今天准备通宵！"
        ],
        [
            "周末到啦！",
            "今天准备做点什么？",
            "我今天没有课！活动室时间增加！"
        ]
    ]
};
