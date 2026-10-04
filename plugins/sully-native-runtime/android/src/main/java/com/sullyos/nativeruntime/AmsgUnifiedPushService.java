package com.sullyos.nativeruntime;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONObject;
import org.unifiedpush.android.connector.FailedReason;
import org.unifiedpush.android.connector.PushService;
import org.unifiedpush.android.connector.UnifiedPush;
import org.unifiedpush.android.connector.data.PublicKeySet;
import org.unifiedpush.android.connector.data.PushEndpoint;
import org.unifiedpush.android.connector.data.PushMessage;

import java.nio.charset.StandardCharsets;

/**
 * Receives AMSG 2.0 Web Push messages through a UnifiedPush distributor (e.g. ntfy).
 *
 * The connector library already decrypts RFC8291 aes128gcm, so {@link PushMessage#getContent()}
 * is the JSON envelope the Worker sent. This service mirrors the Service Worker in
 * worker/sw-keep-alive.ts: reassemble multipart chunks, decide whether to show a system
 * notification, then hand the payload to the WebView (live) or queue it (WebView dead).
 */
public class AmsgUnifiedPushService extends PushService {
    static final String CHANNEL_ID = "amsg2";
    static final String EXTRA_PAYLOAD = "amsg_unified_push_payload";
    /** Group used only to silence individual notifications (see maybeShowNotification). */
    private static final String SILENT_GROUP = "amsg2_silent";

    @Override
    public void onNewEndpoint(PushEndpoint endpoint, String instance) {
        Context ctx = getApplicationContext();
        try {
            JSONObject subscription = new JSONObject();
            subscription.put("endpoint", endpoint.getUrl());
            JSONObject keys = new JSONObject();
            PublicKeySet keySet = endpoint.getPubKeySet();
            if (keySet != null) {
                keys.put("p256dh", keySet.getPubKey());
                keys.put("auth", keySet.getAuth());
            }
            subscription.put("keys", keys);
            String distributor = UnifiedPush.getAckDistributor(ctx);
            if (distributor == null) distributor = UnifiedPush.getSavedDistributor(ctx);
            subscription.put("distributor", distributor == null ? JSONObject.NULL : distributor);
            subscription.put("temporary", endpoint.getTemporary());
            String vapid = AmsgUnifiedPushStore.readVapid(ctx);
            subscription.put("vapidPublicKey", vapid == null ? JSONObject.NULL : vapid);
            if (keySet == null) {
                AmsgUnifiedPushStore.saveLastError(ctx, "推送服务没有返回加密公钥，无法接收 Web Push 加密消息");
            } else {
                AmsgUnifiedPushStore.saveSubscription(ctx, subscription);
            }
        } catch (Exception e) {
            AmsgUnifiedPushStore.saveLastError(ctx, "保存推送订阅失败：" + e.getMessage());
        }
        AmsgUnifiedPushPlugin.emitRegistrationChanged();
    }

    @Override
    public void onMessage(PushMessage message, String instance) {
        Context ctx = getApplicationContext();
        if (!message.getDecrypted()) return;
        String raw = new String(message.getContent(), StandardCharsets.UTF_8);
        JSONObject payload;
        try {
            payload = new JSONObject(raw);
        } catch (Exception e) {
            return;
        }
        if (AmsgUnifiedPushStore.MULTIPART_KIND.equals(payload.optString("messageKind"))) {
            JSONObject restored = AmsgUnifiedPushStore.acceptMultipartChunk(ctx, payload);
            if (restored == null) return;
            payload = restored;
            raw = restored.toString();
        }

        long receivedAt = System.currentTimeMillis();
        // Same delivery twice (distributor redelivery, or ntfy + the poll fallback both
        // catching it): the JS inbox dedupes by messageId, but the system notification is
        // posted here, before JS ever sees the payload, so it must be gated natively too.
        // The SW path gets the same guarantee from amsg-sw's delivery dedupe.
        String messageId = payload.optString("messageId", "");
        if (!messageId.isEmpty() && !AmsgUnifiedPushStore.rememberPollSeen(ctx, messageId)) return;
        boolean visible = AmsgUnifiedPushPlugin.isAppVisible();
        maybeShowNotification(ctx, payload, raw, visible);
        if (!AmsgUnifiedPushPlugin.emitPushReceived(raw)) {
            AmsgUnifiedPushStore.appendPending(ctx, raw, receivedAt);
        }
    }

    @Override
    public void onRegistrationFailed(FailedReason reason, String instance) {
        String text;
        switch (reason) {
            case NETWORK:
                text = "推送服务注册失败：网络不可用，请联网后重试";
                break;
            case ACTION_REQUIRED:
                text = "推送服务需要你在 ntfy 里确认一下，打开 ntfy 处理后重试";
                break;
            case VAPID_REQUIRED:
                text = "推送服务要求 VAPID 公钥，请先在设置里更新主动消息 Worker";
                break;
            default:
                text = "推送服务注册失败（" + reason.name() + "）";
                break;
        }
        AmsgUnifiedPushStore.saveLastError(getApplicationContext(), text);
        AmsgUnifiedPushPlugin.emitRegistrationChanged();
    }

    @Override
    public void onUnregistered(String instance) {
        AmsgUnifiedPushStore.clearSubscription(getApplicationContext());
        AmsgUnifiedPushPlugin.emitRegistrationChanged();
    }

    private static String notificationIntent(JSONObject payload) {
        JSONObject notification = payload.optJSONObject("notification");
        if (notification != null && notification.has("show")) {
            Object show = notification.opt("show");
            if (Boolean.FALSE.equals(show)) return "never";
            if ("always".equals(show)) return "always";
            if ("when-hidden".equals(show)) return "when-hidden";
        }
        String kind = payload.optString("messageKind", "");
        if (kind.isEmpty() || "content".equals(kind) || "result".equals(kind)) return "always";
        return "never";
    }

    private static String firstNonEmpty(String... values) {
        for (String v : values) {
            if (v != null && !v.trim().isEmpty()) return v;
        }
        return null;
    }

    private static String optStringOrNull(JSONObject obj, String key) {
        if (obj == null || !obj.has(key) || obj.isNull(key)) return null;
        Object value = obj.opt(key);
        return value instanceof String ? (String) value : null;
    }

    static void maybeShowNotification(Context ctx, JSONObject payload, String raw, boolean visible) {
        String intent = notificationIntent(payload);
        if ("never".equals(intent)) return;
        if ("when-hidden".equals(intent) && visible) return;

        JSONObject notification = payload.optJSONObject("notification");
        String contactName = optStringOrNull(payload, "contactName");
        String title = firstNonEmpty(
            optStringOrNull(notification, "title"),
            optStringOrNull(payload, "title"),
            contactName != null ? "来自 " + contactName : null,
            "新消息"
        );
        String body = firstNonEmpty(
            optStringOrNull(notification, "body"),
            optStringOrNull(payload, "body"),
            optStringOrNull(payload, "message"),
            "你收到一条新消息"
        );
        String tag = firstNonEmpty(
            optStringOrNull(notification, "tag"),
            optStringOrNull(payload, "tag"),
            optStringOrNull(payload, "messageId"),
            "amsg2"
        );
        boolean silent = notification != null && (
            Boolean.TRUE.equals(notification.opt("silent"))
                || ("when-visible".equals(notification.opt("silent")) && visible)
        );
        boolean renotify = notification != null
            ? notification.optBoolean("renotify", payload.optBoolean("renotify", false))
            : payload.optBoolean("renotify", false);

        NotificationManager manager = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        ensureChannel(manager);

        PendingIntent contentIntent = null;
        Intent launchIntent = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            launchIntent.putExtra(EXTRA_PAYLOAD, raw);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
            contentIntent = PendingIntent.getActivity(ctx, tag.hashCode(), launchIntent, flags);
        }

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(ctx, CHANNEL_ID)
            : new Notification.Builder(ctx);
        builder
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new Notification.BigTextStyle().bigText(body))
            .setSmallIcon(ctx.getApplicationInfo().icon)
            .setAutoCancel(true)
            .setShowWhen(true)
            .setWhen(System.currentTimeMillis())
            .setContentIntent(contentIntent);
        if (silent) {
            builder.setOnlyAlertOnce(true);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // On O+ sound/vibration belong to the channel, and setOnlyAlertOnce only
                // quiets *updates* — a fresh post on this IMPORTANCE_HIGH channel still rings.
                // A group child with GROUP_ALERT_SUMMARY never alerts, which is how
                // NotificationCompat implements setSilent(). Mirrors the SW honouring
                // silent / 'when-visible' (user is looking at the chat: no ring).
                builder.setGroup(SILENT_GROUP);
                builder.setGroupAlertBehavior(Notification.GROUP_ALERT_SUMMARY);
            } else {
                builder.setSound(null).setVibrate(null);
            }
        } else {
            // Web Notification semantics, which the Worker payload is written against: replacing
            // a same-tag notification is quiet unless `renotify` is set. The Worker marks only
            // the first segment of a reply with renotify, so a multi-part reply rings once.
            // A brand-new notification always alerts regardless of this flag.
            builder.setOnlyAlertOnce(!renotify);
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                builder.setDefaults(Notification.DEFAULT_ALL);
                builder.setPriority(Notification.PRIORITY_HIGH);
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            builder.setCategory(Notification.CATEGORY_MESSAGE);
        }
        try {
            manager.notify(tag, 0, builder.build());
        } catch (SecurityException ignored) {
            // POST_NOTIFICATIONS revoked: the payload is still delivered to the inbox.
        }
    }

    private static void ensureChannel(NotificationManager manager) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "主动消息",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("角色主动发来的消息");
        manager.createNotificationChannel(channel);
    }
}
