package com.sullyos.nativeruntime;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;

import com.getcapacitor.JSObject;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.UUID;

/**
 * Persistent state for the AMSG UnifiedPush bridge.
 *
 * Push messages can arrive while the WebView is dead, so everything the JS side
 * needs later (subscription, pending payloads, the payload of a tapped notification,
 * partially received multipart chunks) lives in SharedPreferences. All methods are
 * synchronized on the class: PushService callbacks and plugin calls run on different
 * threads.
 */
final class AmsgUnifiedPushStore {
    private static final String PREFS = "amsg_unified_push";
    private static final String KEY_SUBSCRIPTION = "subscription";
    private static final String KEY_REGISTRATION_REVISION = "registration_revision";
    private static final String KEY_ACKNOWLEDGED_REGISTRATION = "acknowledged_registration";
    private static final String KEY_VAPID = "vapid";
    private static final String KEY_LAST_ERROR = "last_error";
    private static final String KEY_PENDING = "pending";
    private static final String KEY_LAUNCH_PAYLOAD = "launch_payload";
    private static final String KEY_MULTIPART = "multipart";
    private static final String KEY_POLL_CONFIG = "poll_config";
    private static final String KEY_POLL_CURSOR = "poll_cursor";
    private static final String KEY_POLL_ADOPTED = "poll_adopted";
    private static final String KEY_POLL_LAST_RUN = "poll_last_run";
    private static final String KEY_POLL_LAST_ERROR = "poll_last_error";
    private static final String KEY_POLL_SEEN = "poll_seen";

    /** 内置拉取（没装 ntfy 的兜底）显示一条消息的时效窗，与前端 OUTBOX_BACKFILL_MAX_AGE_MS 一致。 */
    static final long POLL_MAX_AGE_MS = 48L * 60 * 60 * 1000;
    /** 已见 messageId 名单上限，与待收队列同量级。 */
    private static final int POLL_MAX_SEEN = 200;

    /** Keep at most this many undelivered payloads; older ones are recoverable from the Worker outbox. */
    private static final int MAX_PENDING = 200;
    /** Mirrors DEFAULT_MULTIPART_* in @rei-standard/amsg-shared. */
    static final int MULTIPART_VERSION = 1;
    static final String MULTIPART_KIND = "_multipart";
    static final String MULTIPART_ENCODING = "json-utf8-base64url";
    private static final long MULTIPART_TTL_MS = 60_000L;
    private static final int MULTIPART_MAX_CHUNKS = 128;
    private static final int MULTIPART_MAX_TOTAL_BYTES = 256_000;

    private AmsgUnifiedPushStore() {}

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static synchronized void saveVapid(Context context, String vapid) {
        prefs(context).edit().putString(KEY_VAPID, vapid).remove(KEY_LAST_ERROR).apply();
    }

    static synchronized String readVapid(Context context) {
        return prefs(context).getString(KEY_VAPID, null);
    }

    static synchronized void saveSubscription(Context context, JSONObject subscription) {
        prefs(context).edit()
            .putString(KEY_SUBSCRIPTION, subscription.toString())
            .putString(KEY_REGISTRATION_REVISION, UUID.randomUUID().toString())
            .remove(KEY_LAST_ERROR)
            .apply();
    }

    static synchronized JSONObject readSubscription(Context context) {
        String raw = prefs(context).getString(KEY_SUBSCRIPTION, null);
        if (raw == null) return null;
        try {
            return new JSONObject(raw);
        } catch (Exception e) {
            return null;
        }
    }

    static synchronized void clearSubscription(Context context) {
        prefs(context).edit().remove(KEY_SUBSCRIPTION).remove(KEY_REGISTRATION_REVISION).remove(KEY_ACKNOWLEDGED_REGISTRATION).apply();
    }

    static synchronized void saveLastError(Context context, String error) {
        prefs(context).edit().putString(KEY_LAST_ERROR, error).apply();
    }

    static synchronized String readLastError(Context context) {
        return prefs(context).getString(KEY_LAST_ERROR, null);
    }

    static synchronized void clearLastError(Context context) {
        prefs(context).edit().remove(KEY_LAST_ERROR).apply();
    }

    static synchronized String registrationRevision(Context context) {
        SharedPreferences storage = prefs(context);
        String revision = storage.getString(KEY_REGISTRATION_REVISION, null);
        if (revision == null && readSubscription(context) != null) {
            revision = UUID.randomUUID().toString();
            storage.edit().putString(KEY_REGISTRATION_REVISION, revision).apply();
        }
        return revision;
    }

    static synchronized String acknowledgedRegistration(Context context) {
        return prefs(context).getString(KEY_ACKNOWLEDGED_REGISTRATION, null);
    }

    static synchronized void acknowledgeRegistration(Context context, String revision) {
        if (revision != null && revision.equals(registrationRevision(context))) {
            prefs(context).edit().putString(KEY_ACKNOWLEDGED_REGISTRATION, revision).apply();
        }
    }

    /** Use one durable commit for cross-transport deduplication and queue insertion. */
    static synchronized String enqueue(Context context, String messageId, String payload, long receivedAt) {
        SharedPreferences storage = prefs(context);
        JSONArray seen = readArray(storage.getString(KEY_POLL_SEEN, null));
        for (int i = 0; !messageId.isEmpty() && i < seen.length(); i++) {
            if (messageId.equals(seen.optString(i, null))) return null;
        }
        JSONArray pending = peekPending(context);
        JSONArray next = new JSONArray();
        for (int i = Math.max(0, pending.length() - MAX_PENDING + 1); i < pending.length(); i++) {
            next.put(pending.opt(i));
        }
        String id = UUID.randomUUID().toString();
        try {
            JSONObject entry = new JSONObject();
            entry.put("id", id).put("payload", payload).put("receivedAt", receivedAt);
            next.put(entry);
        } catch (org.json.JSONException error) {
            throw new IllegalStateException("Unable to queue push", error);
        }
        SharedPreferences.Editor write = storage.edit().putString(KEY_PENDING, next.toString());
        if (!messageId.isEmpty()) {
            JSONArray recent = new JSONArray();
            recent.put(messageId);
            for (int i = Math.max(0, seen.length() - POLL_MAX_SEEN + 1); i < seen.length(); i++) {
                recent.put(seen.opt(i));
            }
            write.putString(KEY_POLL_SEEN, recent.toString());
        }
        if (!write.commit()) throw new IllegalStateException("Unable to persist push");
        return id;
    }

    static synchronized JSONArray peekPending(Context context) {
        SharedPreferences storage = prefs(context);
        JSONArray pending = readArray(storage.getString(KEY_PENDING, null));
        boolean migrated = false;
        for (int i = 0; i < pending.length(); i++) {
            JSONObject item = pending.optJSONObject(i);
            if (item == null || item.has("id")) continue;
            try {
                item.put("id", UUID.randomUUID().toString());
                migrated = true;
            } catch (org.json.JSONException error) {
                throw new IllegalStateException("Unable to migrate push queue", error);
            }
        }
        if (migrated && !storage.edit().putString(KEY_PENDING, pending.toString()).commit()) {
            throw new IllegalStateException("Unable to persist push queue migration");
        }
        return pending;
    }

    static synchronized void acknowledgePush(Context context, String id) {
        if (id == null || id.isEmpty()) return;
        JSONArray pending = peekPending(context);
        JSONArray next = new JSONArray();
        for (int i = 0; i < pending.length(); i++) {
            JSONObject item = pending.optJSONObject(i);
            if (item != null && !id.equals(item.optString("id"))) next.put(item);
        }
        if (next.length() != pending.length()) {
            prefs(context).edit().putString(KEY_PENDING, next.toString()).apply();
        }
    }

    static synchronized void recordNotification(Context context, String id, String outcome) {
        JSONArray pending = peekPending(context);
        for (int i = 0; i < pending.length(); i++) {
            JSONObject item = pending.optJSONObject(i);
            if (item == null || !id.equals(item.optString("id"))) continue;
            try {
                item.put("notificationAt", System.currentTimeMillis());
                item.put("notificationOutcome", outcome);
                prefs(context).edit().putString(KEY_PENDING, pending.toString()).apply();
            } catch (org.json.JSONException ignored) {}
            return;
        }
    }

    static synchronized void saveLaunchPayload(Context context, String payload) {
        prefs(context).edit().putString(KEY_LAUNCH_PAYLOAD, payload).apply();
    }

    static synchronized String takeLaunchPayload(Context context) {
        String value = prefs(context).getString(KEY_LAUNCH_PAYLOAD, null);
        if (value != null) prefs(context).edit().remove(KEY_LAUNCH_PAYLOAD).apply();
        return value;
    }

    /**
     * Accept one multipart chunk. Returns the reassembled JSON payload once every
     * chunk has arrived, otherwise null. Invalid or expired groups are dropped; the
     * Worker outbox lets the JS side recover the content on the next catch-up.
     */
    static synchronized JSONObject acceptMultipartChunk(Context context, JSONObject payload) {
        JSONObject meta = payload.optJSONObject("multipart");
        String chunk = payload.optString("chunk", null);
        if (meta == null || chunk == null) return null;
        if (meta.optInt("version", -1) != MULTIPART_VERSION) return null;
        if (!MULTIPART_ENCODING.equals(meta.optString("encoding"))) return null;
        String id = meta.optString("id", "");
        int index = meta.optInt("index", 0);
        int total = meta.optInt("total", 0);
        if (id.isEmpty() || total <= 0 || total > MULTIPART_MAX_CHUNKS || index <= 0 || index > total) return null;

        long now = System.currentTimeMillis();
        JSONObject all = readObject(prefs(context).getString(KEY_MULTIPART, null));
        pruneExpired(all, now);

        JSONObject group = all.optJSONObject(id);
        if (group == null || group.optInt("total", -1) != total) {
            group = new JSONObject();
            try {
                group.put("total", total);
                group.put("expiresAt", now + MULTIPART_TTL_MS);
                group.put("chunks", new JSONObject());
            } catch (Exception ignored) {}
        }
        JSONObject chunks = group.optJSONObject("chunks");
        if (chunks == null) chunks = new JSONObject();
        try {
            chunks.put(String.valueOf(index), chunk);
            group.put("chunks", chunks);
            all.put(id, group);
        } catch (Exception ignored) {}

        JSONObject restored = null;
        if (chunks.length() >= total) {
            restored = restoreMultipart(chunks, total);
            all.remove(id);
        }
        prefs(context).edit().putString(KEY_MULTIPART, all.toString()).apply();
        return restored;
    }

    private static JSONObject restoreMultipart(JSONObject chunks, int total) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            for (int i = 1; i <= total; i++) {
                String part = chunks.optString(String.valueOf(i), null);
                if (part == null) return null;
                byte[] bytes = Base64.decode(part, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
                out.write(bytes);
                if (out.size() > MULTIPART_MAX_TOTAL_BYTES) return null;
            }
            return new JSONObject(new String(out.toByteArray(), StandardCharsets.UTF_8));
        } catch (Exception e) {
            return null;
        }
    }

    private static void pruneExpired(JSONObject all, long now) {
        Iterator<String> keys = all.keys();
        java.util.List<String> expired = new java.util.ArrayList<>();
        while (keys.hasNext()) {
            String key = keys.next();
            JSONObject group = all.optJSONObject(key);
            if (group == null || group.optLong("expiresAt", 0L) <= now) expired.add(key);
        }
        for (String key : expired) all.remove(key);
    }

    private static JSONArray readArray(String raw) {
        if (raw == null) return new JSONArray();
        try {
            return new JSONArray(raw);
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    private static JSONObject readObject(String raw) {
        if (raw == null) return new JSONObject();
        try {
            return new JSONObject(raw);
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    // ─── 内置拉取（poll）：没装 ntfy 时 WorkManager 定时 GET /outbox ────────────

    static synchronized void savePollConfig(Context context, String workerUrl, String userId, String userKey, String serverToken) {
        try {
            JSONObject config = new JSONObject();
            config.put("workerUrl", workerUrl);
            config.put("userId", userId);
            config.put("userKey", userKey);
            config.put("serverToken", serverToken == null ? "" : serverToken);
            prefs(context).edit().putString(KEY_POLL_CONFIG, config.toString()).apply();
        } catch (Exception ignored) {}
    }

    static synchronized JSONObject readPollConfig(Context context) {
        String raw = prefs(context).getString(KEY_POLL_CONFIG, null);
        if (raw == null) return null;
        try {
            JSONObject config = new JSONObject(raw);
            if (!config.optString("workerUrl", "").isEmpty()
                && !config.optString("userId", "").isEmpty()
                && !config.optString("userKey", "").isEmpty()) return config;
            return null;
        } catch (Exception e) {
            return null;
        }
    }

    static synchronized void clearPollConfig(Context context) {
        prefs(context).edit()
            .remove(KEY_POLL_CONFIG)
            .remove(KEY_POLL_CURSOR)
            .remove(KEY_POLL_ADOPTED)
            .remove(KEY_POLL_LAST_RUN)
            .remove(KEY_POLL_LAST_ERROR)
            // KEY_POLL_SEEN is kept: it is also the delivery dedupe for the ntfy path
            // (AmsgUnifiedPushService.onMessage), and syncNativePollMode clears the poll
            // config on every start while ntfy is active. Bounded by POLL_MAX_SEEN.
            .apply();
    }

    static synchronized long readPollCursor(Context context) {
        return prefs(context).getLong(KEY_POLL_CURSOR, 0L);
    }

    static synchronized void savePollCursor(Context context, long cursor) {
        prefs(context).edit().putLong(KEY_POLL_CURSOR, cursor).apply();
    }

    /** 首趟只对齐游标不上屏（对齐前端的 outbox 接管语义），跑完整一趟才算接管完成。 */
    static synchronized boolean isPollAdopted(Context context) {
        return prefs(context).getBoolean(KEY_POLL_ADOPTED, false);
    }

    static synchronized void markPollAdopted(Context context) {
        prefs(context).edit().putBoolean(KEY_POLL_ADOPTED, true).apply();
    }

    static synchronized void savePollRun(Context context, long at, String error) {
        prefs(context).edit()
            .putLong(KEY_POLL_LAST_RUN, at)
            .putString(KEY_POLL_LAST_ERROR, error)
            .apply();
    }

    static synchronized JSObject readPollStatus(Context context) {
        JSObject status = new JSObject();
        try {
            status.put("enabled", readPollConfig(context) != null);
            status.put("cursor", readPollCursor(context));
            status.put("adopted", isPollAdopted(context));
            status.put("lastRunAt", prefs(context).getLong(KEY_POLL_LAST_RUN, 0L));
            String error = prefs(context).getString(KEY_POLL_LAST_ERROR, null);
            status.put("lastError", error == null ? JSONObject.NULL : error);
        } catch (Exception ignored) {}
        return status;
    }

}
