package com.sullyos.nativeruntime;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Iterator;

@CapacitorPlugin(name = "SullyNativeRuntime")
public class SullyNativeRuntimePlugin extends Plugin {
    private static volatile SullyNativeRuntimePlugin instance;

    @Override
    public void load() {
        instance = this;
        // Cold start from a notification tap: the route rides on the launching Intent.
        Activity activity = getActivity();
        if (activity != null) captureLaunchRoute(activity.getIntent());
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) instance = null;
    }

    static void signalWindow(String event) {
        SullyNativeRuntimePlugin plugin = instance;
        if (plugin != null && plugin.getBridge() != null) plugin.getBridge().triggerWindowJSEvent(event);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        // Warm start (activity already alive): the tap arrives as a new Intent.
        captureLaunchRoute(intent);
    }

    /**
     * Record the destination of a notification the user actually tapped. JS consumes it via
     * getLaunchRoute() on startup and on every return to the foreground. The extra is removed
     * so a config change / activity recreation does not replay the same jump.
     */
    private void captureLaunchRoute(Intent intent) {
        if (intent == null) return;
        String route = intent.getStringExtra(SullyNativeRuntimeService.EXTRA_ROUTE);
        if (route == null || route.trim().isEmpty()) return;
        intent.removeExtra(SullyNativeRuntimeService.EXTRA_ROUTE);
        getContext().getSharedPreferences("sully_native_runtime", Context.MODE_PRIVATE)
            .edit().putString("launch_route", route).apply();
    }

    // PluginCall.getLong only accepts Long instances, but small JS numbers arrive
    // as Integer through the bridge (durationMs/positionMs), which silently fell
    // back to the default value. Accept any Number instead.
    private static long readLong(PluginCall call, String name, long defaultValue) {
        Object value = call.getData().opt(name);
        if (value instanceof Number) return ((Number) value).longValue();
        return defaultValue;
    }

    @PluginMethod
    public void ping(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("ok", true);
        ret.put("platform", "android");
        call.resolve(ret);
    }

    @PluginMethod
    public void startForegroundTask(PluginCall call) {
        String id = call.getString("id", "sully-runtime");
        String kind = call.getString("kind", "generic");
        String title = call.getString("title", "SullyOS 正在运行");
        String text = call.getString("text", "正在处理后台任务");

        Intent intent = new Intent(getContext(), SullyNativeRuntimeService.class);
        intent.setAction(SullyNativeRuntimeService.ACTION_START_FOREGROUND);
        intent.putExtra("id", id);
        intent.putExtra("kind", kind);
        intent.putExtra("title", title);
        intent.putExtra("text", text);
        SullyNativeRuntimeService.startCompat(getContext(), intent);
        call.resolve();
    }

    @PluginMethod
    public void stopForegroundTask(PluginCall call) {
        Intent intent = new Intent(getContext(), SullyNativeRuntimeService.class);
        intent.setAction(SullyNativeRuntimeService.ACTION_STOP_FOREGROUND);
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void enqueueHttpJob(PluginCall call) {
        enqueueJob(call, false);
    }

    @PluginMethod
    public void enqueueTimer(PluginCall call) {
        enqueueJob(call, true);
    }

    private void enqueueJob(PluginCall call, boolean timer) {
        try {
            String jobId = call.getString("jobId");
            String url = call.getString("url");
            if (jobId == null || jobId.trim().isEmpty()) {
                call.reject("jobId is required");
                return;
            }
            if (!timer && (url == null || url.trim().isEmpty())) {
                call.reject("url is required");
                return;
            }

            JSONObject job = new JSONObject();
            long now = System.currentTimeMillis();
            job.put("jobId", jobId);
            job.put("status", "queued");
            job.put("createdAt", now);
            job.put("updatedAt", now);
            job.put("timeoutMs", call.getInt("timeoutMs", 120000));
            long runAt = readLong(call, "runAt", 0L);
            if (runAt > 0L) job.put("runAt", runAt);
            job.put("responseType", call.getString("responseType", "json"));
            // Per-enqueue identity: lets an in-flight run of an older enqueue under the same
            // jobId detect that it was cleared/replaced and skip writing stale results.
            job.put(SullyNativeRuntimeService.ENQUEUE_TOKEN_KEY, SullyNativeRuntimeService.newEnqueueToken());

            if (!timer) {
                JSONObject request = new JSONObject();
                request.put("url", url);
                request.put("method", call.getString("method", "POST"));
                request.put("headers", toJsonObject(call.getObject("headers", new JSObject())));
                request.put("body", call.getString("body", ""));
                job.put("request", request);
            }

            JSObject meta = call.getObject("meta", null);
            if (meta != null) job.put("meta", toJsonObject(meta));
            if (timer && (!SullyNativeRuntimeService.isLocalTimer(job) || runAt <= 0)) {
                call.reject("Invalid native timer");
                return;
            }

            synchronized (SullyNativeRuntimeService.class) {
                if (timer) SullyNativeRuntimeService.clearJob(getContext(), jobId);
                SullyNativeRuntimeService.writeJob(getContext(), jobId, job);
                if (timer && SullyNativeRuntimeService.scheduleExactAlarm(getContext(), jobId, runAt)) {
                    call.resolve();
                    return;
                }
            }

            Intent intent = new Intent(getContext(), SullyNativeRuntimeService.class);
            intent.setAction(SullyNativeRuntimeService.ACTION_ENQUEUE_HTTP);
            intent.putExtra("jobId", jobId);
            intent.putExtra("title", call.getString("title", "SullyOS 正在生成回复"));
            intent.putExtra("text", call.getString("text", "后台请求处理中"));
            SullyNativeRuntimeService.startCompat(getContext(), intent);

            JSObject ret = new JSObject();
            ret.put("jobId", jobId);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    @PluginMethod
    public void getJob(PluginCall call) {
        String jobId = call.getString("jobId");
        if (jobId == null || jobId.trim().isEmpty()) {
            call.reject("jobId is required");
            return;
        }
        try {
            JSONObject job = SullyNativeRuntimeService.readJob(getContext(), jobId);
            if (job != null && call.getBoolean("omitPendingPayload", false) && !"completed".equals(job.optString("status"))) {
                job.remove("request");
                job.remove("response");
            }
            JSObject ret = new JSObject();
            ret.put("job", job == null ? null : JSObject.fromJSONObject(job));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    @PluginMethod
    public void listJobs(PluginCall call) {
        try {
            JSONArray arr = SullyNativeRuntimeService.listJobs(getContext(), call.getBoolean("timersOnly", false));
            JSArray js = JSArray.from(arr.toString());
            JSObject ret = new JSObject();
            ret.put("jobs", js);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    @PluginMethod
    public void cancelJob(PluginCall call) {
        String jobId = call.getString("jobId");
        if (jobId == null || jobId.trim().isEmpty()) {
            call.reject("jobId is required");
            return;
        }
        try {
            Intent intent = new Intent(getContext(), SullyNativeRuntimeService.class);
            intent.setAction(SullyNativeRuntimeService.ACTION_CANCEL_JOB);
            intent.putExtra("jobId", jobId);
            // Clear any scheduled exact alarm for this job even if the service can't start.
            SullyNativeRuntimeService.cancelAlarm(getContext(), jobId);
            try { getContext().startService(intent); } catch (Exception ignored) { /* background start limits */ }
            SullyNativeRuntimeService.markCancelled(getContext(), jobId);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        JSObject result = new JSObject();
        if (android.os.Build.VERSION.SDK_INT < 33) {
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        boolean granted = getContext().checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                == android.content.pm.PackageManager.PERMISSION_GRANTED;
        result.put("granted", granted);
        if (!granted) {
            // Keep the plugin free of an AppCompat dependency. The APK's Settings
            // screen can return here after the user grants the Android permission.
            try {
                android.content.Intent settings = new android.content.Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                settings.putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
                settings.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(settings);
            } catch (Exception ignored) { /* permission guidance is best effort */ }
        }
        call.resolve(result);
    }

    @PluginMethod
    public void getSystemStatus(PluginCall call) {
        JSObject result = new JSObject();
        // Notifications enabled?
        boolean notificationsEnabled = true;
        try {
            android.app.NotificationManager nm = (android.app.NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
                    notificationsEnabled = nm.areNotificationsEnabled();
                }
            }
        } catch (Exception ignored) { }
        // Battery optimization ignored?
        boolean batteryIgnored = true;
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                android.os.PowerManager pm = (android.os.PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    batteryIgnored = pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
                }
            }
        } catch (Exception ignored) { }
        // Persistent enabled pref?
        boolean persistentEnabled = getContext().getSharedPreferences("sully_native_runtime", Context.MODE_PRIVATE)
            .getBoolean("persistent_enabled", false);

        result.put("notificationsEnabled", notificationsEnabled);
        result.put("batteryOptimizationIgnored", batteryIgnored);
        result.put("persistentEnabled", persistentEnabled);
        // Also report POST_NOTIFICATIONS runtime grant for API 33+
        boolean postNotifGranted = true;
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            try {
                postNotifGranted = getContext().checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                    == android.content.pm.PackageManager.PERMISSION_GRANTED;
            } catch (Exception ignored) { }
        }
        result.put("postNotificationGranted", postNotifGranted);
        call.resolve(result);
    }

    @PluginMethod
    public void requestBatteryOptimizationExemption(PluginCall call) {
        JSObject result = new JSObject();
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                android.content.Intent intent = new android.content.Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(android.net.Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                result.put("opened", true);
            } else {
                result.put("opened", false);
                result.put("reason", "API < 23");
            }
        } catch (Exception e) {
            // Fallback: open general battery optimization settings
            try {
                android.content.Intent fallback = new android.content.Intent(android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                fallback.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(fallback);
                result.put("opened", true);
                result.put("fallback", true);
            } catch (Exception e2) {
                result.put("opened", false);
                result.put("error", e2.getMessage());
            }
        }
        call.resolve(result);
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        try {
            android.content.Intent settings = new android.content.Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            settings.putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            settings.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(settings);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        try {
            android.content.Intent intent = new android.content.Intent(android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    @PluginMethod
    public void getLaunchRoute(PluginCall call) {
        JSObject result = new JSObject();
        String route = getContext().getSharedPreferences("sully_native_runtime", Context.MODE_PRIVATE)
            .getString("launch_route", null);
        if (route != null && !route.trim().isEmpty()) result.put("route", route);
        getContext().getSharedPreferences("sully_native_runtime", Context.MODE_PRIVATE)
            .edit().remove("launch_route").apply();
        call.resolve(result);
    }

    @PluginMethod
    public void setPersistentEnabled(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        getContext().getSharedPreferences("sully_native_runtime", Context.MODE_PRIVATE)
            .edit().putBoolean("persistent_enabled", enabled).apply();
        call.resolve();
    }

    @PluginMethod
    public void showEventNotification(PluginCall call) {
        String title = call.getString("title", "SullyOS");
        String body = call.getString("body", "");
        String tag = call.getString("tag", "sully-event");
        String route = call.getString("route", "");
        Intent intent = new Intent(getContext(), SullyNativeRuntimeService.class);
        intent.setAction(SullyNativeRuntimeService.ACTION_EVENT_NOTIFICATION);
        intent.putExtra("title", title);
        intent.putExtra("body", body);
        intent.putExtra("tag", tag);
        intent.putExtra("route", route);
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void clearJob(PluginCall call) {
        String jobId = call.getString("jobId");
        if (jobId == null || jobId.trim().isEmpty()) {
            call.reject("jobId is required");
            return;
        }
        try {
            synchronized (SullyNativeRuntimeService.class) {
                String expected = call.getString("expectedStatus");
                if (expected != null) {
                    JSONObject job = SullyNativeRuntimeService.readJob(getContext(), jobId);
                    if (job == null || !expected.equals(job.optString("status"))
                        || job.optLong("updatedAt") != readLong(call, "expectedUpdatedAt", -1)
                        || !job.optString(SullyNativeRuntimeService.ENQUEUE_TOKEN_KEY).equals(call.getString("expectedToken", ""))) {
                        call.resolve();
                        return;
                    }
                }
                SullyNativeRuntimeService.clearJob(getContext(), jobId);
            }
            call.resolve();
        } catch (Exception error) { call.reject(error.getMessage(), error); }
    }

    @PluginMethod
    public void startCallNotification(PluginCall call) {
        String charName = call.getString("charName", "通话中");
        String charId = call.getString("charId", "");
        long startedAt = readLong(call, "startedAt", System.currentTimeMillis());
        String avatar = call.getString("avatar", "");
        Intent intent = new Intent(getContext(), SullyNativeRuntimeService.class);
        intent.setAction(SullyNativeRuntimeService.ACTION_CALL_START);
        intent.putExtra("charName", charName);
        intent.putExtra("charId", charId);
        intent.putExtra("startedAt", startedAt);
        intent.putExtra("avatar", avatar);
        SullyNativeRuntimeService.startCompat(getContext(), intent);
        call.resolve();
    }

    @PluginMethod
    public void updateCallNotification(PluginCall call) {
        String charName = call.getString("charName", "通话中");
        String charId = call.getString("charId", "");
        long startedAt = readLong(call, "startedAt", 0L);
        String avatar = call.getString("avatar", "");
        Intent intent = new Intent(getContext(), SullyNativeRuntimeService.class);
        intent.setAction(SullyNativeRuntimeService.ACTION_CALL_UPDATE);
        intent.putExtra("charName", charName);
        intent.putExtra("charId", charId);
        intent.putExtra("startedAt", startedAt);
        intent.putExtra("avatar", avatar);
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void stopCallNotification(PluginCall call) {
        Intent intent = new Intent(getContext(), SullyNativeRuntimeService.class);
        intent.setAction(SullyNativeRuntimeService.ACTION_CALL_END);
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void showMusicNotification(PluginCall call) {
        String title = call.getString("title", "SullyOS 音乐");
        String artist = call.getString("artist", "");
        String album = call.getString("album", "");
        boolean isPlaying = call.getBoolean("isPlaying", true);
        boolean isLiked = call.getBoolean("isLiked", false);
        String songId = call.getString("songId", "");
        String coverUrl = call.getString("coverUrl", "");
        long durationMs = readLong(call, "durationMs", 0L);
        long positionMs = readLong(call, "positionMs", 0L);
        Intent intent = new Intent(getContext(), SullyNativeRuntimeService.class);
        intent.setAction(SullyNativeRuntimeService.ACTION_MUSIC_SHOW);
        intent.putExtra("title", title);
        intent.putExtra("artist", artist);
        intent.putExtra("album", album);
        intent.putExtra("isPlaying", isPlaying);
        intent.putExtra("isLiked", isLiked);
        intent.putExtra("songId", songId);
        intent.putExtra("coverUrl", coverUrl);
        intent.putExtra("durationMs", durationMs);
        intent.putExtra("positionMs", positionMs);
        SullyNativeRuntimeService.startCompat(getContext(), intent);
        call.resolve();
    }

    @PluginMethod
    public void updateMusicNotification(PluginCall call) {
        String title = call.getString("title", "SullyOS 音乐");
        String artist = call.getString("artist", "");
        String album = call.getString("album", "");
        boolean isPlaying = call.getBoolean("isPlaying", true);
        boolean isLiked = call.getBoolean("isLiked", false);
        String songId = call.getString("songId", "");
        String coverUrl = call.getString("coverUrl", "");
        long durationMs = readLong(call, "durationMs", 0L);
        long positionMs = readLong(call, "positionMs", 0L);
        Intent intent = new Intent(getContext(), SullyNativeRuntimeService.class);
        intent.setAction(SullyNativeRuntimeService.ACTION_MUSIC_UPDATE);
        intent.putExtra("title", title);
        intent.putExtra("artist", artist);
        intent.putExtra("album", album);
        intent.putExtra("isPlaying", isPlaying);
        intent.putExtra("isLiked", isLiked);
        intent.putExtra("songId", songId);
        intent.putExtra("coverUrl", coverUrl);
        intent.putExtra("durationMs", durationMs);
        intent.putExtra("positionMs", positionMs);
        SullyNativeRuntimeService.startCompat(getContext(), intent);
        call.resolve();
    }

    @PluginMethod
    public void stopMusicNotification(PluginCall call) {
        Intent intent = new Intent(getContext(), SullyNativeRuntimeService.class);
        intent.setAction(SullyNativeRuntimeService.ACTION_MUSIC_STOP);
        // Plain startService: if the service isn't running there is nothing to stop, and
        // startForegroundService would force a foreground contract we don't want here.
        try { getContext().startService(intent); } catch (Exception ignored) { /* background start limits */ }
        call.resolve();
    }

    @PluginMethod
    public void getPendingMusicAction(PluginCall call) {
        JSObject result = new JSObject();
        android.content.SharedPreferences prefs = getContext().getSharedPreferences("sully_native_runtime", Context.MODE_PRIVATE);
        synchronized (prefs) {
            String action = prefs.getString("pending_music_action", null);
            if (action != null) {
                if (System.currentTimeMillis() - prefs.getLong("pending_music_action_at", 0L) < 10000) result.put("action", action);
                prefs.edit().remove("pending_music_action").remove("pending_music_action_at").apply();
            }
        }
        call.resolve(result);
    }

    @PluginMethod
    public void getCallState(PluginCall call) {
        boolean active = getContext().getSharedPreferences("sully_native_runtime", Context.MODE_PRIVATE)
            .getBoolean("call_active", false);
        String charId = getContext().getSharedPreferences("sully_native_runtime", Context.MODE_PRIVATE)
            .getString("call_char_id", null);
        String charName = getContext().getSharedPreferences("sully_native_runtime", Context.MODE_PRIVATE)
            .getString("call_char_name", null);
        long startedAt = getContext().getSharedPreferences("sully_native_runtime", Context.MODE_PRIVATE)
            .getLong("call_started_at", 0L);
        JSObject result = new JSObject();
        result.put("active", active);
        if (charId != null) result.put("charId", charId);
        if (charName != null) result.put("charName", charName);
        if (startedAt != 0) result.put("startedAt", startedAt);
        call.resolve(result);
    }

    private static JSONObject toJsonObject(JSObject object) throws Exception {
        JSONObject out = new JSONObject();
        Iterator<String> keys = object.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            Object value = object.get(key);
            out.put(key, value);
        }
        return out;
    }
}
