import { trackEvent } from '../analytics';

export function trackVoyageResult(step: unknown, succeeded: boolean) {
    if (step === 'send' || step === 'reply') {
        if (succeeded) trackEvent(step === 'send' ? '送出旅行邀请' : '收到旅行回信');
        else trackEvent('旅行邀请未完成', { step });
        return;
    }
    if (step !== 'connect' && step !== 'refresh' && step !== 'submit' && step !== 'approve' && step !== 'return') return;
    if (!succeeded) trackEvent('旅行策划未完成', { step });
    else if (step === 'submit') trackEvent('提交旅行简报');
    else if (step === 'approve' || step === 'return') trackEvent('审核旅行草稿', { decision: step });
}
