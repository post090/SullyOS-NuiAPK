package com.sullyos.nativeruntime;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Local deadlines only persist a completion. HTTP jobs still use the runtime service. */
public class SullyNativeRuntimeAlarmReceiver extends BroadcastReceiver {
    static final String ACTION_ALARM_FIRE = "com.sullyos.nativeruntime.ALARM_FIRE";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;
        String jobId = intent.getStringExtra("jobId");
        if (jobId == null || !ACTION_ALARM_FIRE.equals(intent.getAction())) return;
        if (jobId.startsWith("sully-timer-")) {
            PendingResult pending = goAsync();
            new Thread(() -> {
                try {
                    if (!SullyNativeRuntimeService.completeAlarmTimer(context, jobId)) wakeService(context, jobId);
                } catch (Exception error) {
                    wakeService(context, jobId);
                } finally { pending.finish(); }
            }, "SullyTimerAlarm").start();
        } else wakeService(context, jobId);
    }

    private static void wakeService(Context context, String jobId) {
        Intent service = new Intent(context, SullyNativeRuntimeService.class);
        service.setAction(SullyNativeRuntimeService.ACTION_ALARM_WAKE);
        service.putExtra("jobId", jobId);
        try {
            SullyNativeRuntimeService.startCompat(context, service);
        } catch (Exception ignored) { /* best-effort wake; boot/next alarm will retry */ }
    }
}
