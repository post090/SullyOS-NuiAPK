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
import org.unifiedpush.android.connector.ConstantsKt;
import org.unifiedpush.android.connector.UnifiedPush;

import java.util.List;

import kotlin.Unit;

/**
 * JS bridge for AMSG 2.0 over UnifiedPush. Contract lives in utils/unifiedPushPlugin.ts.
 */
@CapacitorPlugin(name = "AmsgUnifiedPush")
public class AmsgUnifiedPushPlugin extends Plugin {
    private static final String MESSAGE_FOR_DISTRIBUTOR = "SullyOS 主动消息";

    private static volatile AmsgUnifiedPushPlugin instance;
    private static volatile boolean appVisible = false;

    @Override
    public void load() {
        instance = this;
        appVisible = true;
        Activity activity = getActivity();
        if (activity != null) captureTapPayload(activity.getIntent(), false);
    }

    @Override
    protected void handleOnResume() {
        appVisible = true;
    }

    @Override
    protected void handleOnPause() {
        appVisible = false;
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) instance = null;
        appVisible = false;
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        captureTapPayload(intent, true);
    }

    private void captureTapPayload(Intent intent, boolean live) {
        if (intent == null) return;
        String payload = intent.getStringExtra(AmsgUnifiedPushService.EXTRA_PAYLOAD);
        if (payload == null) return;
        intent.removeExtra(AmsgUnifiedPushService.EXTRA_PAYLOAD);
        if (live) {
            JSObject data = new JSObject();
            data.put("payload", payload);
            notifyListeners("notificationTapped", data, true);
        } else {
            AmsgUnifiedPushStore.saveLaunchPayload(getContext(), payload);
        }
    }

    static boolean isAppVisible() {
        return instance != null && appVisible;
    }

    /** Returns false when no live WebView can take the payload; the caller then queues it. */
    static boolean emitPushReceived(String payload) {
        AmsgUnifiedPushPlugin plugin = instance;
        if (plugin == null || plugin.getBridge() == null) return false;
        JSObject data = new JSObject();
        data.put("payload", payload);
        plugin.notifyListeners("pushReceived", data, true);
        return true;
    }

    static void emitRegistrationChanged() {
        AmsgUnifiedPushPlugin plugin = instance;
        if (plugin == null || plugin.getBridge() == null) return;
        plugin.notifyListeners("registrationChanged", new JSObject());
    }

    private static String currentDistributor(Context ctx) {
        String distributor = UnifiedPush.getAckDistributor(ctx);
        return distributor != null ? distributor : UnifiedPush.getSavedDistributor(ctx);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        Context ctx = getContext();
        JSObject ret = new JSObject();
        ret.put("native", true);
        JSArray distributors = new JSArray();
        try {
            List<String> list = UnifiedPush.getDistributors(ctx);
            for (String item : list) distributors.put(item);
        } catch (Exception ignored) {}
        ret.put("distributors", distributors);
        String distributor = currentDistributor(ctx);
        ret.put("distributor", distributor == null ? JSONObject.NULL : distributor);
        JSONObject subscription = AmsgUnifiedPushStore.readSubscription(ctx);
        ret.put("subscription", subscription == null ? JSONObject.NULL : subscription);
        String lastError = AmsgUnifiedPushStore.readLastError(ctx);
        ret.put("lastError", lastError == null ? JSONObject.NULL : lastError);
        call.resolve(ret);
    }

    @PluginMethod
    public void register(PluginCall call) {
        String vapid = call.getString("vapidPublicKey");
        if (vapid == null || vapid.trim().isEmpty()) {
            call.reject("vapidPublicKey is required");
            return;
        }
        final String cleanVapid = vapid.trim().replace("=", "");
        final Context ctx = getContext();
        JSONObject previous = AmsgUnifiedPushStore.readSubscription(ctx);
        if (previous != null && !cleanVapid.equals(previous.optString("vapidPublicKey"))) {
            AmsgUnifiedPushStore.clearSubscription(ctx);
        }
        AmsgUnifiedPushStore.saveVapid(ctx, cleanVapid);

        if (currentDistributor(ctx) == null) {
            try {
                List<String> list = UnifiedPush.getDistributors(ctx);
                if (list.size() == 1) UnifiedPush.saveDistributor(ctx, list.get(0));
            } catch (Exception ignored) {}
        }

        if (currentDistributor(ctx) != null) {
            doRegister(ctx, cleanVapid);
        } else {
            Activity activity = getActivity();
            if (activity == null) {
                AmsgUnifiedPushStore.saveLastError(ctx, "需要在前台选择推送服务，请回到 App 再试");
            } else {
                activity.runOnUiThread(() -> {
                    try {
                        UnifiedPush.tryUseCurrentOrDefaultDistributor(activity, success -> {
                            if (Boolean.TRUE.equals(success)) {
                                doRegister(ctx, cleanVapid);
                            } else {
                                AmsgUnifiedPushStore.saveLastError(ctx, "没有选择推送服务，或手机上没有可用的 UnifiedPush 服务（例如 ntfy）");
                            }
                            return Unit.INSTANCE;
                        });
                    } catch (Exception e) {
                        AmsgUnifiedPushStore.saveLastError(ctx, "选择推送服务失败：" + e.getMessage());
                    }
                });
            }
        }

        JSObject ret = new JSObject();
        ret.put("pending", true);
        call.resolve(ret);
    }

    private static void doRegister(Context ctx, String vapid) {
        try {
            UnifiedPush.register(ctx, ConstantsKt.INSTANCE_DEFAULT, MESSAGE_FOR_DISTRIBUTOR, vapid);
        } catch (Exception e) {
            AmsgUnifiedPushStore.saveLastError(ctx, "注册推送服务失败：" + e.getMessage());
        }
    }

    @PluginMethod
    public void unregister(PluginCall call) {
        Context ctx = getContext();
        try {
            UnifiedPush.unregister(ctx, ConstantsKt.INSTANCE_DEFAULT);
        } catch (Exception ignored) {}
        AmsgUnifiedPushStore.clearSubscription(ctx);
        AmsgUnifiedPushStore.clearLastError(ctx);
        call.resolve();
    }

    @PluginMethod
    public void drainPendingPushes(PluginCall call) {
        Context ctx = getContext();
        JSONArray pending = AmsgUnifiedPushStore.drainPending(ctx);
        JSArray messages = new JSArray();
        for (int i = 0; i < pending.length(); i++) {
            Object item = pending.opt(i);
            if (item != null) messages.put(item);
        }
        JSObject ret = new JSObject();
        ret.put("messages", messages);
        String launchPayload = AmsgUnifiedPushStore.takeLaunchPayload(ctx);
        if (launchPayload != null) ret.put("launchPayload", launchPayload);
        call.resolve(ret);
    }
}
