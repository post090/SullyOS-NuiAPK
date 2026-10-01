package com.sullyos.nativeruntime;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * 没装 ntfy 时的兜底通道：WorkManager 每隔约 15 分钟去 Worker 的 GET /outbox 把
 * 主动消息拉回来。Worker 那侧对 poll: 订阅把推送直接视为已送达（见
 * worker/amsg/src/nativeFcm.ts），送达保证就是 outbox 那行，这里把它兑现。
 *
 * 跟前端的语义对齐（utils/amsgInstantChat.ts）：
 *   - 首趟只对齐游标不上屏——存量不是「这台设备丢了的消息」，倒出来就是重放；
 *   - 超过 48 小时的不弹通知，留给 JS 打开 App 时按补收规则判定；
 *   - 只推进自己的游标、从不销账（ack）：接管/超龄/去重的判断只有 WebView 那套做得了。
 */
public class AmsgPollWorker extends Worker {
    public static final String UNIQUE_PERIODIC = "amsg_unified_push_poll";
    public static final String UNIQUE_ONCE = "amsg_unified_push_poll_once";
    private static final int PAGE_LIMIT = 100;
    private static final int MAX_PAGES = 10;
    private static final int CONNECT_TIMEOUT_MS = 15_000;
    private static final int READ_TIMEOUT_MS = 20_000;

    public AmsgPollWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        JSONObject config = AmsgUnifiedPushStore.readPollConfig(ctx);
        if (config == null) return Result.success();
        try {
            pollOnce(ctx, config);
            AmsgUnifiedPushStore.savePollRun(ctx, System.currentTimeMillis(), null);
            return Result.success();
        } catch (Exception e) {
            String message = e.getMessage();
            AmsgUnifiedPushStore.savePollRun(ctx, System.currentTimeMillis(), message == null ? e.getClass().getSimpleName() : message);
            return Result.retry();
        }
    }

    private void pollOnce(Context ctx, JSONObject config) throws Exception {
        String base = config.getString("workerUrl").replaceAll("/+$", "");
        String userId = config.getString("userId");
        String serverToken = config.optString("serverToken", "");
        String userKey = config.getString("userKey");

        boolean adopted = AmsgUnifiedPushStore.isPollAdopted(ctx);
        long cursor = AmsgUnifiedPushStore.readPollCursor(ctx);
        long now = System.currentTimeMillis();

        for (int page = 0; page < MAX_PAGES; page++) {
            JSONObject body = fetchOutbox(base, serverToken, userId, cursor);
            if (!body.optBoolean("success", false) || body.isNull("data")) return;
            JSONObject data = decrypt(body.getJSONObject("data"), userKey);
            JSONArray entries = data.optJSONArray("entries");
            if (entries == null) return;

            long nextCursor = cursor;
            for (int i = 0; i < entries.length(); i++) {
                JSONObject entry = entries.optJSONObject(i);
                if (entry == null) continue;
                long id = entry.optLong("id", 0);
                if (id > nextCursor) nextCursor = id;
                if (!adopted) continue; // 首趟：只对齐游标
                handleEntry(ctx, entry, now);
            }
            long serverCursor = data.optLong("cursor", nextCursor);
            if (serverCursor > nextCursor) nextCursor = serverCursor;
            cursor = nextCursor;

            if (!data.optBoolean("hasMore", false)) break;
        }

        // 整趟跑完才落游标和接管标记：中途失败的话下一趟从头再来，
        // 已弹过通知的靠 seen 名单去重，不会重放。
        AmsgUnifiedPushStore.savePollCursor(ctx, cursor);
        if (!adopted) AmsgUnifiedPushStore.markPollAdopted(ctx);
    }

    private static void handleEntry(Context ctx, JSONObject entry, long now) {
        JSONObject push = entry.optJSONObject("push");
        if (push == null) return;
        String messageId = push.optString("messageId", "");
        if (messageId.isEmpty()) return;
        long createdAt = entry.optLong("createdAt", 0);
        if (createdAt > 0 && now - createdAt > AmsgUnifiedPushStore.POLL_MAX_AGE_MS) return;
        if (!AmsgUnifiedPushStore.rememberPollSeen(ctx, messageId)) return;

        String raw = push.toString();
        AmsgUnifiedPushService.maybeShowNotification(ctx, push, raw, AmsgUnifiedPushPlugin.isAppVisible());
        if (!AmsgUnifiedPushPlugin.emitPushReceived(raw)) {
            AmsgUnifiedPushStore.appendPending(ctx, raw, now);
        }
    }

    private static JSONObject fetchOutbox(String base, String serverToken, String userId, long since) throws Exception {
        URL url = new URL(base + "/outbox?since=" + since + "&limit=" + PAGE_LIMIT);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        try {
            conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(READ_TIMEOUT_MS);
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("X-User-Id", userId);
            if (!serverToken.isEmpty()) conn.setRequestProperty("X-Client-Token", serverToken);
            int code = conn.getResponseCode();
            if (code != 200) throw new IOException("HTTP " + code);
            return new JSONObject(readAll(conn.getInputStream()));
        } finally {
            conn.disconnect();
        }
    }

    private static String readAll(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int read;
        while ((read = in.read(buffer)) > 0) out.write(buffer, 0, read);
        return new String(out.toByteArray(), StandardCharsets.UTF_8);
    }

    /** Worker 响应的 data 段是 AES-GCM（RFC 里面 iv/authTag/encryptedData 全是标准 base64）。 */
    private static JSONObject decrypt(JSONObject data, String userKeyHex) throws Exception {
        byte[] iv = android.util.Base64.decode(data.getString("iv"), android.util.Base64.DEFAULT);
        byte[] ciphertext = android.util.Base64.decode(data.getString("encryptedData"), android.util.Base64.DEFAULT);
        byte[] authTag = android.util.Base64.decode(data.getString("authTag"), android.util.Base64.DEFAULT);
        byte[] combined = new byte[ciphertext.length + authTag.length];
        System.arraycopy(ciphertext, 0, combined, 0, ciphertext.length);
        System.arraycopy(authTag, 0, combined, ciphertext.length, authTag.length);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(hexToBytes(userKeyHex), "AES"), new GCMParameterSpec(128, iv));
        return new JSONObject(new String(cipher.doFinal(combined), StandardCharsets.UTF_8));
    }

    private static byte[] hexToBytes(String hex) {
        int len = hex.length();
        byte[] out = new byte[len / 2];
        for (int i = 0; i < out.length; i++) {
            out[i] = (byte) Integer.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        }
        return out;
    }

    /** 配置好就排周期任务（15 分钟一班，联网才跑），runNow 再补一班立即的（接管游标 + 赶上积压）。 */
    static void schedule(Context ctx, boolean runNow) {
        WorkManager manager = WorkManager.getInstance(ctx);
        Constraints constraints = new Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build();
        PeriodicWorkRequest periodic = new PeriodicWorkRequest.Builder(AmsgPollWorker.class, 15, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build();
        manager.enqueueUniquePeriodicWork(UNIQUE_PERIODIC, ExistingPeriodicWorkPolicy.KEEP, periodic);
        if (runNow) {
            OneTimeWorkRequest once = new OneTimeWorkRequest.Builder(AmsgPollWorker.class)
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build();
            manager.enqueueUniqueWork(UNIQUE_ONCE, ExistingWorkPolicy.REPLACE, once);
        }
    }

    static void cancel(Context ctx) {
        WorkManager manager = WorkManager.getInstance(ctx);
        manager.cancelUniqueWork(UNIQUE_PERIODIC);
        manager.cancelUniqueWork(UNIQUE_ONCE);
    }
}
