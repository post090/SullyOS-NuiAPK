import { sarNpcContentEnabled } from './sarNpcPreference';
/** Public setting, not private star-event knowledge or a record of having met anyone. */
export const SAR_PUBLIC_CONTEXT = `《彼方》里还有一间 SAR 活动室，有芯片扭蛋、模块柜台、收藏柜、布告板，以及可以钓鱼、摆弄橡皮泥恐龙的水域。
凯恩和艾文是来自另一个世界的玩家，也是这里的兼职管理员。凯恩热情健谈，喜欢游戏、动画和新技术，热衷折腾活动室里的各种设备；艾文话少，喜欢鱼和恐龙，经常待在水边，也会按当天行情收鱼。
你知道他们的基本身份，但是否见过、聊过、熟不熟，要以实际活动记录和记忆为准。你可以按自己的性格看待他们，不必默认亲近。`;
export const sarPublicContext = () => sarNpcContentEnabled() ? SAR_PUBLIC_CONTEXT : SAR_PUBLIC_CONTEXT.split('\n')[0];
