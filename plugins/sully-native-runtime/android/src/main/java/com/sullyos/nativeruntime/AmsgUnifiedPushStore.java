package com.sullyos.nativeruntime;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;

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
    private static final String KEY_VAPID = "vapid";
    private static final String KEY_LAST_ERROR = "last_error";
    private static final String KEY_PENDING = "pending";
    private static final String KEY_LAUNCH_PAYLOAD = "launch_payload";
    private static final String KEY_MULTIPART = "multipart";

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
        prefs(context).edit().remove(KEY_SUBSCRIPTION).apply();
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

    static synchronized void appendPending(Context context, String payload, long receivedAt) {
        JSONArray current = readArray(prefs(context).getString(KEY_PENDING, null));
        JSONArray next = new JSONArray();
        int start = Math.max(0, current.length() - (MAX_PENDING - 1));
        for (int i = start; i < current.length(); i++) {
            Object item = current.opt(i);
            if (item != null) next.put(item);
        }
        try {
            JSONObject entry = new JSONObject();
            entry.put("payload", payload);
            entry.put("receivedAt", receivedAt);
            next.put(entry);
        } catch (Exception ignored) {}
        prefs(context).edit().putString(KEY_PENDING, next.toString()).apply();
    }

    static synchronized JSONArray drainPending(Context context) {
        JSONArray current = readArray(prefs(context).getString(KEY_PENDING, null));
        prefs(context).edit().remove(KEY_PENDING).apply();
        return current;
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
}
