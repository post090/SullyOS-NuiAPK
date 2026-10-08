import {HOME_SCHEDULE_RECOMMENDATION} from './homeScheduleRecommendation';
export const HOME_UPDATE_KEY = 'sullyos_update_2026_10_home3d_beta_seen';
export const HOME_CHANGELOG = 'changelog-2026-10-home3d-beta';

export const HOME_UPDATE_PAGES = [
 {title:'3D 家园，开门啦。',label:'欢迎回家',image:'room.png',alt:'布置好的 3D 家园客厅，双方小人一起待在屋里',route:'小小窝 → 拜访（测试版）3D → 选择角色',text:'给你们一个可以一起待着的地方。面对面聊几句，看小人走动、使用家具，或拿起小手机，继续你们的线上聊天。',note:HOME_SCHEDULE_RECOMMENDATION},
 {title:'住进同一个日常。',label:'当面聊天',image:'conversation.png',alt:'3D 家园客厅里的角色与当面聊天记录',route:'小小窝 → 拜访（测试版）3D → 选择角色 → 聊聊',text:'3D 家园测试版，是直接接入角色上下文的新聊天形式。在屋里说过的话、实际发生的互动，会按你已有的上下文范围，接续到私聊、通话和见面里。',note:'角色会带着原有的关系与记忆继续交流。家园原文可在「日常」里查看。'},
 {title:'就在身边，也能聊线上。',label:'屋内小手机',image:'phone.png',alt:'家园小手机的信息页，展示与同一角色的线上私聊',route:'右下角「小手机」→ 信息',text:'拿起屋里的小手机，就能和眼前的小人发消息。这里沿用同一位角色的线上私聊和聊天记录，屋内与屋外都能接着聊。',note:'小手机里还有「拍照」：选动作、调镜头，把你们的合影留下来。'},
 {title:'这个「…」，是想和你说话。',label:'点一下，听 TA 说',image:'invitation.png',alt:'角色头顶出现可点击的三个点说话邀请气泡',route:'看到头顶「···」→ 点一下',text:'当角色有话想说，头顶会出现「…」。点一下，就让 TA 根据刚才的家园经历开口；暂时不想听，也可以点旁边的 × 收起。',note:'「…」是说话邀请；咖啡、音符等图案是情绪想象，不是待领取的消息。点邀请后会调用聊天 API。'},
 {title:'也可以，让 TA 自己开口。',label:'自主说话',image:'autonomy.png',alt:'我的家中的自主活动与陪伴、角色自动开口设置',route:'我的家 → 角色自动开口',text:'打开「角色自动开口」，同处一室时，TA 会在合适的时候主动聊起来，无需你每次点气泡。走动、使用家具和陪伴，则由「自主活动与陪伴」控制。',note:'自动开口默认关闭，会调用 API。至少 3 次有效自主行为、90 秒后才可能触发，间隔至少 3 分钟；离开家园或切换 App 后停止自动调用。'},
] as const;
