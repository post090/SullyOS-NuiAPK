/**
 * SAR 临时模块回合状态在 React 之外被改写后的通知事件。
 *
 * 即时对话的回复由 activeMsgRuntime 在 React 外落库，顺手把角色 / 用户身上的
 * vrState.sarModule 推进一回合直写进 DB。OSContext 监听这个事件，把 DB 里的最新
 * sarModule 搬回内存——不搬的话，下一次 updateCharacter / updateUserProfile 会拿
 * 旧内存整份写回，把刚推进的回合抹掉。
 *
 * 单独成文件：两边都要 import，而它不该把 React 或整条收件箱管线拖进对方的依赖里。
 */
export const SAR_MODULE_RUNTIME_CHANGED_EVENT = 'sar-module-runtime-changed';

export interface SarModuleRuntimeChangedDetail {
    /** 改的是谁身上的模块。 */
    target: 'character' | 'user';
    /** 这一轮对话的角色；target 为 'user' 时也带上，便于排查。 */
    charId: string;
}
