package com.sullyos.nativeruntime;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

public class SullyNativeRuntimeService extends Service {
    public static final String ACTION_START_FOREGROUND = "com.sullyos.nativeruntime.START_FOREGROUND";
    public static final String ACTION_STOP_FOREGROUND = "com.sullyos.nativeruntime.STOP_FOREGROUND";
    public static final String ACTION_ENQUEUE_HTTP = "com.sullyos.nativeruntime.ENQUEUE_HTTP";
    public static final String ACTION_CANCEL_JOB = "com.sullyos.nativeruntime.CANCEL_JOB";
    public static final String ACTION_EVENT_NOTIFICATION = "com.sullyos.nativeruntime.EVENT_NOTIFICATION";
    public static final String ACTION_CALL_START = "com.sullyos.nativeruntime.CALL_START";
    public static final String ACTION_CALL_UPDATE = "com.sullyos.nativeruntime.CALL_UPDATE";
    public static final String ACTION_CALL_END = "com.sullyos.nativeruntime.CALL_END";
    public static final String ACTION_MUSIC_SHOW = "com.sullyos.nativeruntime.MUSIC_SHOW";
    public static final String ACTION_MUSIC_UPDATE = "com.sullyos.nativeruntime.MUSIC_UPDATE";
    public static final String ACTION_MUSIC_STOP = "com.sullyos.nativeruntime.MUSIC_STOP";
    public static final String ACTION_MUSIC_ACTION = "com.sullyos.nativeruntime.MUSIC_ACTION";
    public static final String ACTION_ALARM_WAKE = "com.sullyos.nativeruntime.ALARM_WAKE";
    /** Intent extra carrying the in-app destination of a notification tap. */
    static final String EXTRA_ROUTE = "sully_route";

    /**
     * Stable per-route PendingIntent request code. Kept in its own range so it never collides
     * with the fixed codes used by the persistent (0), call (93091) and music (94091) cards.
     */
    private static int routeRequestCode(String route) {
        return 100_000 + (route.hashCode() & 0xFFFFF);
    }

    private static final String CHANNEL_ID = "sully_native_runtime";
    private static final String CHANNEL_CALL = "sully_call";
    private static final String CHANNEL_MUSIC = "sully_music";
    // Custom action id for the like/heart button on the system media card.
    private static final String CUSTOM_ACTION_LIKE = "com.sullyos.nativeruntime.TOGGLE_LIKE";
    private static final int NOTIFICATION_ID = 31090;
    private static final int NOTIFICATION_CALL_ID = 31091;
    private static final int NOTIFICATION_MUSIC_ID = 31092;
    private static final ExecutorService EXECUTOR = Executors.newCachedThreadPool();
    private static final AtomicInteger RUNNING_JOBS = new AtomicInteger(0);
    private static final Set<String> CANCELLED = ConcurrentHashMap.newKeySet();
    private static final Set<String> ACTIVE_JOB_IDS = ConcurrentHashMap.newKeySet();
    private static final ConcurrentHashMap<String, HttpURLConnection> CONNECTIONS = new ConcurrentHashMap<>();
    // Jobs whose runAt is farther than this are scheduled via AlarmManager instead of
    // parking a worker thread on Thread.sleep (survives Doze / process death).
    private static final long ALARM_THRESHOLD_MS = 60_000L;
    private static volatile boolean manualForeground = false;
    // Call tracking for resume
    private static volatile long callStartedAtMs = 0;
    private static volatile String callCharId = null;
    private static volatile String callCharName = null;
    private static volatile String callAvatar = null;
    // Music tracking so we can keep the service foreground while playing and rebuild the
    // media notification when another foreground (call/persistent) is torn down.
    private static volatile boolean musicActive = false;
    private static volatile String musicTitle = null;
    private static volatile String musicArtist = null;
    private static volatile String musicAlbum = null;
    private static volatile String musicSongId = null;
    private static volatile boolean musicPlaying = false;
    private static volatile boolean musicLiked = false;
    private static volatile String musicCoverUrl = null;
    private static volatile long musicDurationMs = 0;
    // Position snapshot + capture timestamp so we can extrapolate while playing.
    private static volatile long musicPositionMs = 0;
    private static volatile long musicPositionCapturedAt = 0;
    // Artwork bitmaps (album covers / call avatars) keyed by source URL or data-URI.
    private static final ConcurrentHashMap<String, android.graphics.Bitmap> ART_CACHE = new ConcurrentHashMap<>();
    private static final android.os.Handler MAIN_HANDLER = new android.os.Handler(android.os.Looper.getMainLooper());
    private android.media.session.MediaSession mediaSession;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        try {
            if (mediaSession != null) {
                mediaSession.release();
                mediaSession = null;
            }
        } catch (Exception ignored) {}
        super.onDestroy();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || intent.getAction() == null) return START_NOT_STICKY;
        String action = intent.getAction();
        if (ACTION_EVENT_NOTIFICATION.equals(action)) {
            showEventNotification(
                intent.getStringExtra("title"),
                intent.getStringExtra("body"),
                intent.getStringExtra("tag"),
                intent.getStringExtra("route")
            );
            if (manualForeground || callStartedAtMs != 0 || musicActive || RUNNING_JOBS.get() > 0) {
                // In-flight jobs count too: stopSelf(startId) here would tear down the
                // foreground service in the middle of a background generation.
                return START_STICKY;
            }
            stopSelf(startId);
            return START_NOT_STICKY;
        }
        if (ACTION_CALL_START.equals(action)) {
            String charName = intent.getStringExtra("charName");
            String charId = intent.getStringExtra("charId");
            long startedAt = intent.getLongExtra("startedAt", System.currentTimeMillis());
            String avatar = intent.getStringExtra("avatar");
            callCharId = charId;
            callCharName = charName;
            callStartedAtMs = startedAt;
            if (avatar != null && !avatar.trim().isEmpty()) callAvatar = avatar;
            // Persist for resume after WebView death
            getSharedPreferences("sully_native_runtime", MODE_PRIVATE).edit()
                .putString("call_char_id", charId)
                .putString("call_char_name", charName)
                .putString("call_avatar", callAvatar == null ? "" : callAvatar)
                .putLong("call_started_at", startedAt)
                .putBoolean("call_active", true)
                .apply();
            startForegroundCompatWithCall(charName, startedAt);
            maybeFetchCallAvatar();
            return START_STICKY;
        }
        if (ACTION_CALL_UPDATE.equals(action)) {
            String charName = intent.getStringExtra("charName");
            long startedAt = intent.getLongExtra("startedAt", callStartedAtMs);
            String charId = intent.getStringExtra("charId");
            String avatar = intent.getStringExtra("avatar");
            if (charId != null) callCharId = charId;
            if (charName != null) callCharName = charName;
            if (startedAt != 0) callStartedAtMs = startedAt;
            if (avatar != null && !avatar.trim().isEmpty()) callAvatar = avatar;
            updateCallNotification(charName != null ? charName : callCharName, callStartedAtMs);
            maybeFetchCallAvatar();
            return START_STICKY;
        }
        if (ACTION_CALL_END.equals(action)) {
            callCharId = null;
            callCharName = null;
            callStartedAtMs = 0;
            callAvatar = null;
            getSharedPreferences("sully_native_runtime", MODE_PRIVATE).edit()
                .putBoolean("call_active", false)
                .remove("call_char_id")
                .remove("call_char_name")
                .remove("call_avatar")
                .remove("call_started_at")
                .apply();
            stopCallNotification();
            maybeStop();
            return START_NOT_STICKY;
        }
        if (ACTION_MUSIC_SHOW.equals(action) || ACTION_MUSIC_UPDATE.equals(action)) {
            String title = intent.getStringExtra("title");
            String artist = intent.getStringExtra("artist");
            String album = intent.getStringExtra("album");
            boolean isPlaying = intent.getBooleanExtra("isPlaying", true);
            boolean isLiked = intent.getBooleanExtra("isLiked", false);
            String songId = intent.getStringExtra("songId");
            String coverUrl = intent.getStringExtra("coverUrl");
            long durationMs = intent.getLongExtra("durationMs", 0L);
            long positionMs = intent.getLongExtra("positionMs", 0L);
            showMusicNotification(title, artist, album, isPlaying, isLiked, songId, coverUrl, durationMs, positionMs);
            return START_STICKY;
        }
        if (ACTION_MUSIC_STOP.equals(action)) {
            stopMusicNotification();
            return START_NOT_STICKY;
        }
        if (ACTION_MUSIC_ACTION.equals(action)) {
            String musicAction = intent.getStringExtra("musicAction");
            boolean silent = intent.getBooleanExtra("silent", false);
            if (musicAction != null && !musicAction.trim().isEmpty()) {
                // Store pending action for JS to consume on resume
                getSharedPreferences("sully_native_runtime", MODE_PRIVATE).edit()
                    .putString("pending_music_action", musicAction)
                    .putLong("pending_music_action_at", System.currentTimeMillis())
                    .apply();
                if ("like".equals(musicAction) || "unlike".equals(musicAction)) {
                    // Optimistically flip the heart on the notification while JS persists it.
                    musicLiked = "like".equals(musicAction);
                    if (musicActive) {
                        showMusicNotification(musicTitle, musicArtist, musicAlbum, musicPlaying, musicLiked,
                            musicSongId, musicCoverUrl, musicDurationMs, currentMusicPositionMs());
                    }
                }
                if (!silent) {
                    // Launch app so JS can handle it
                    Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
                    if (launchIntent != null) {
                        launchIntent.putExtra("sully_music_action", musicAction);
                        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                        try { startActivity(launchIntent); } catch (Exception ignored) {}
                    }
                }
            }
            return START_NOT_STICKY;
        }
        if (ACTION_START_FOREGROUND.equals(action)) {
            manualForeground = true;
            // Restore persisted call state BEFORE anchoring the foreground so an active
            // call keeps the CallStyle card as the foreground notification and the
            // generic persistent notification is posted alongside instead.
            if (callStartedAtMs == 0) {
                boolean wasCallActive = getSharedPreferences("sully_native_runtime", MODE_PRIVATE).getBoolean("call_active", false);
                if (wasCallActive) {
                    String savedName = getSharedPreferences("sully_native_runtime", MODE_PRIVATE).getString("call_char_name", null);
                    long savedStarted = getSharedPreferences("sully_native_runtime", MODE_PRIVATE).getLong("call_started_at", System.currentTimeMillis());
                    String savedCharId = getSharedPreferences("sully_native_runtime", MODE_PRIVATE).getString("call_char_id", null);
                    String savedAvatar = getSharedPreferences("sully_native_runtime", MODE_PRIVATE).getString("call_avatar", null);
                    if (savedName != null) {
                        callCharName = savedName;
                        callCharId = savedCharId;
                        callStartedAtMs = savedStarted;
                        if (savedAvatar != null && !savedAvatar.isEmpty()) callAvatar = savedAvatar;
                    }
                }
            }
            startForegroundCompat(
                intent.getStringExtra("title"),
                intent.getStringExtra("text")
            );
            EXECUTOR.execute(this::resumePendingJobs);
            if (callStartedAtMs != 0) maybeFetchCallAvatar();
            return START_STICKY;
        }
        if (ACTION_STOP_FOREGROUND.equals(action)) {
            manualForeground = false;
            // If call is still active, keep service alive for call
            if (callStartedAtMs != 0) {
                // Drop the tagged generic notification that rode alongside the call anchor.
                NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) nm.cancel("sully-fg", NOTIFICATION_ID);
                return START_STICKY;
            }
            maybeStop();
            return START_NOT_STICKY;
        }
        if (ACTION_CANCEL_JOB.equals(action)) {
            String jobId = intent.getStringExtra("jobId");
            if (jobId != null) {
                CANCELLED.add(jobId);
                cancelAlarm(this, jobId);
                HttpURLConnection conn = CONNECTIONS.get(jobId);
                if (conn != null) conn.disconnect();
                try { markCancelled(this, jobId); } catch (Exception ignored) {}
            }
            maybeStop();
            return START_NOT_STICKY;
        }
        if (ACTION_ENQUEUE_HTTP.equals(action)) {
            String jobId = intent.getStringExtra("jobId");
            if (jobId == null) return START_NOT_STICKY;
            // Satisfy the startForegroundService contract before touching disk: the job file
            // carries the full request body and parsing it on the main thread risks ANR.
            startForegroundCompat(
                intent.getStringExtra("title"),
                intent.getStringExtra("text")
            );
            dispatchJob(jobId);
            return START_REDELIVER_INTENT;
        }
        if (ACTION_ALARM_WAKE.equals(action)) {
            // An exact alarm fired. Ensure foreground within 5s, run due jobs, then release.
            startForegroundCompat("SullyOS 正在运行", "");
            String jobId = intent.getStringExtra("jobId");
            if (jobId != null && ACTIVE_JOB_IDS.add(jobId)) {
                RUNNING_JOBS.incrementAndGet();
                EXECUTOR.execute(() -> runHttpJob(jobId));
            }
            // Also pick up any other jobs whose runAt has elapsed (off the main thread).
            EXECUTOR.execute(() -> {
                resumePendingJobs();
                MAIN_HANDLER.post(() -> {
                    restoreMusicForegroundIfIdle();
                    maybeStop();
                });
            });
            return START_NOT_STICKY;
        }
        return START_NOT_STICKY;
    }

    private void resumePendingJobs() {
        File[] files = jobsDir(this).listFiles();
        if (files == null) return;
        long now = System.currentTimeMillis();
        for (File file : files) {
            try {
                JSONObject job = new JSONObject(readAll(new FileInputStream(file)));
                String status = job.optString("status", "");
                if (!"queued".equals(status) && !"running".equals(status)) continue;
                String jobId = job.optString("jobId", "");
                if (jobId.isEmpty()) continue;
                long runAt = job.optLong("runAt", 0L);
                if (runAt > now + ALARM_THRESHOLD_MS) {
                    // Not due yet: (re)schedule an alarm instead of parking a worker thread.
                    scheduleExactAlarm(this, jobId, runAt);
                    continue;
                }
                if (!ACTIVE_JOB_IDS.add(jobId)) continue;
                RUNNING_JOBS.incrementAndGet();
                EXECUTOR.execute(() -> runHttpJob(jobId));
            } catch (Exception ignored) { /* malformed job is left for recovery diagnostics */ }
        }
    }

    private long readJobRunAt(String jobId) {
        try {
            JSONObject job = readJob(this, jobId);
            if (job != null) return job.optLong("runAt", 0L);
        } catch (Exception ignored) {}
        return 0L;
    }

    private static PendingIntent alarmPendingIntent(Context ctx, String jobId) {
        Intent i = new Intent(ctx, SullyNativeRuntimeAlarmReceiver.class);
        i.setAction(SullyNativeRuntimeAlarmReceiver.ACTION_ALARM_FIRE);
        i.putExtra("jobId", jobId);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        // Stable request code derived from jobId so cancel() matches the same PendingIntent.
        return PendingIntent.getBroadcast(ctx, jobId.hashCode(), i, flags);
    }

    static void scheduleExactAlarm(Context ctx, String jobId, long runAt) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null || jobId == null) return;
        PendingIntent pi = alarmPendingIntent(ctx, jobId);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (am.canScheduleExactAlarms()) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, runAt, pi);
                } else {
                    // No exact-alarm permission: inexact but still fires in Doze (may be delayed).
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, runAt, pi);
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, runAt, pi);
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, runAt, pi);
            }
        } catch (Exception e) {
            try { am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, runAt, pi); }
            catch (Exception ignored) {}
        }
    }

    static void cancelAlarm(Context ctx, String jobId) {
        if (jobId == null) return;
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        try { am.cancel(alarmPendingIntent(ctx, jobId)); } catch (Exception ignored) {}
    }

    /** startForeground with an explicit FGS type on Android 14+, falling back to the plain form. */
    private void startForegroundTyped(int id, Notification notification, int type) {
        if (Build.VERSION.SDK_INT >= 34) {
            try {
                startForeground(id, notification, type);
                return;
            } catch (Exception e) {
                // Fall back to the manifest-declared union of types.
            }
        }
        startForeground(id, notification);
    }

    /** Re-establish whichever foreground the service should currently hold, or stop if none. */
    private void reassertForeground() {
        if (callStartedAtMs != 0) {
            // The active call must own the foreground anchor (CallStyle is rejected when
            // posted via notify); the persistent notification rides alongside if enabled.
            startForegroundCompatWithCall(callCharName, callStartedAtMs);
            if (manualForeground) postGenericAlongside(null, null);
        } else if (manualForeground) {
            startForegroundCompat("SullyOS 正在运行", "");
        } else if (musicActive) {
            showMusicNotification(musicTitle, musicArtist, musicAlbum, musicPlaying, musicLiked, musicSongId,
                musicCoverUrl, musicDurationMs, currentMusicPositionMs());
        } else if (RUNNING_JOBS.get() > 0) {
            // Keep the service foreground for in-flight jobs with the generic notification.
            startForegroundCompat(null, null);
        } else {
            stopForegroundAndSelf();
        }
    }

    /** If a transient job foreground displaced the media anchor, put the music notification back. */
    private void restoreMusicForegroundIfIdle() {
        if (musicActive && !manualForeground && callStartedAtMs == 0 && RUNNING_JOBS.get() == 0) {
            reassertForeground();
        }
    }

    private void stopForegroundAndSelf() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel("sully-fg", NOTIFICATION_ID);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        stopSelf();
    }

    private void handleMediaButton(String action) {
        if (action == null || action.trim().isEmpty()) return;
        getSharedPreferences("sully_native_runtime", MODE_PRIVATE).edit()
            .putString("pending_music_action", action)
            .putLong("pending_music_action_at", System.currentTimeMillis())
            .apply();
    }

    private android.media.session.MediaSession ensureMediaSession() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return null;
        if (mediaSession != null) return mediaSession;
        try {
            android.media.session.MediaSession s = new android.media.session.MediaSession(this, "SullyOSMusic");
            s.setCallback(new android.media.session.MediaSession.Callback() {
                @Override public void onPlay() { handleMediaButton("play"); }
                @Override public void onPause() { handleMediaButton("pause"); }
                @Override public void onSkipToNext() { handleMediaButton("next"); }
                @Override public void onSkipToPrevious() { handleMediaButton("prev"); }
                @Override public void onSeekTo(long pos) { handleSeekTo(pos); }
                @Override public void onCustomAction(String customAction, android.os.Bundle args) {
                    if (CUSTOM_ACTION_LIKE.equals(customAction)) handleLikeToggle();
                }
            }, new android.os.Handler(android.os.Looper.getMainLooper()));
            s.setActive(true);
            mediaSession = s;
        } catch (Exception e) {
            mediaSession = null;
        }
        return mediaSession;
    }

    /** Seek from the system media card: optimistic native update while JS moves the <audio>. */
    private void handleSeekTo(long positionMs) {
        long pos = Math.max(0, positionMs);
        if (musicDurationMs > 0 && pos > musicDurationMs) pos = musicDurationMs;
        musicPositionMs = pos;
        musicPositionCapturedAt = System.currentTimeMillis();
        handleMediaButton("seek:" + pos);
        if (musicActive) {
            showMusicNotification(musicTitle, musicArtist, musicAlbum, musicPlaying, musicLiked, musicSongId,
                musicCoverUrl, musicDurationMs, pos);
        }
    }

    /** Like toggled from the media card custom action: flip the heart now, JS persists it. */
    private void handleLikeToggle() {
        handleMediaButton(musicLiked ? "unlike" : "like");
        musicLiked = !musicLiked;
        if (musicActive) {
            showMusicNotification(musicTitle, musicArtist, musicAlbum, musicPlaying, musicLiked, musicSongId,
                musicCoverUrl, musicDurationMs, currentMusicPositionMs());
        }
    }

    private void updateMediaSessionMetadata(String title, String artist, String album, boolean isPlaying,
                                            android.graphics.Bitmap art, long durationMs, long positionMs) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return;
        android.media.session.MediaSession s = ensureMediaSession();
        if (s == null) return;
        try {
            android.media.MediaMetadata.Builder mb = new android.media.MediaMetadata.Builder()
                .putString(android.media.MediaMetadata.METADATA_KEY_TITLE, title == null ? "" : title)
                .putString(android.media.MediaMetadata.METADATA_KEY_ARTIST, artist == null ? "" : artist);
            if (album != null && !album.trim().isEmpty()) {
                mb.putString(android.media.MediaMetadata.METADATA_KEY_ALBUM, album);
            }
            // Duration drives the seekbar in the system media card (NetEase-style progress).
            if (durationMs > 0) {
                mb.putLong(android.media.MediaMetadata.METADATA_KEY_DURATION, durationMs);
            }
            // Album art renders both in the notification and the lockscreen/QS media card.
            if (art != null) {
                mb.putBitmap(android.media.MediaMetadata.METADATA_KEY_ALBUM_ART, art);
                mb.putBitmap(android.media.MediaMetadata.METADATA_KEY_ART, art);
            }
            s.setMetadata(mb.build());
            long actions = android.media.session.PlaybackState.ACTION_PLAY
                | android.media.session.PlaybackState.ACTION_PAUSE
                | android.media.session.PlaybackState.ACTION_PLAY_PAUSE
                | android.media.session.PlaybackState.ACTION_SKIP_TO_NEXT
                | android.media.session.PlaybackState.ACTION_SKIP_TO_PREVIOUS
                | android.media.session.PlaybackState.ACTION_SEEK_TO;
            // Real position + speed lets the system extrapolate the progress bar on its own.
            android.media.session.PlaybackState.Builder psb = new android.media.session.PlaybackState.Builder()
                .setActions(actions)
                .setState(
                    isPlaying ? android.media.session.PlaybackState.STATE_PLAYING
                              : android.media.session.PlaybackState.STATE_PAUSED,
                    positionMs >= 0 ? positionMs : android.media.session.PlaybackState.PLAYBACK_POSITION_UNKNOWN,
                    isPlaying ? 1.0f : 0f);
            // Heart button on the system media card, rendered from the custom action icon.
            try {
                psb.addCustomAction(new android.media.session.PlaybackState.CustomAction.Builder(
                    CUSTOM_ACTION_LIKE,
                    musicLiked ? "取消喜欢" : "喜欢",
                    musicLiked ? R.drawable.ic_sully_liked : R.drawable.ic_sully_like
                ).build());
            } catch (Exception ignored) {}
            s.setPlaybackState(psb.build());
            if (!s.isActive()) s.setActive(true);
        } catch (Exception ignored) {}
    }

    /** Extrapolate the last reported playback position while the track keeps playing. */
    private static long currentMusicPositionMs() {
        long base = musicPositionMs;
        if (musicPlaying && musicPositionCapturedAt > 0) {
            base += System.currentTimeMillis() - musicPositionCapturedAt;
        }
        if (musicDurationMs > 0 && base > musicDurationMs) base = musicDurationMs;
        return Math.max(0, base);
    }

    /** Download (or decode data-URI) artwork off the main thread, cache it, then run onReady on main. */
    private void fetchArtAsync(final String src, final Runnable onReady) {
        EXECUTOR.execute(() -> {
            android.graphics.Bitmap bmp = loadArtBitmap(src);
            if (bmp == null) return;
            if (ART_CACHE.size() > 8) ART_CACHE.clear();
            ART_CACHE.put(src, bmp);
            MAIN_HANDLER.post(onReady);
        });
    }

    private static android.graphics.Bitmap loadArtBitmap(String src) {
        try {
            byte[] data;
            if (src.startsWith("data:")) {
                int comma = src.indexOf(',');
                if (comma < 0) return null;
                data = android.util.Base64.decode(src.substring(comma + 1), android.util.Base64.DEFAULT);
            } else {
                HttpURLConnection conn = (HttpURLConnection) new URL(src).openConnection();
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(15000);
                conn.setInstanceFollowRedirects(true);
                try (InputStream in = conn.getInputStream(); ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
                    data = bos.toByteArray();
                } finally {
                    conn.disconnect();
                }
            }
            android.graphics.BitmapFactory.Options bounds = new android.graphics.BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            android.graphics.BitmapFactory.decodeByteArray(data, 0, data.length, bounds);
            int max = Math.max(bounds.outWidth, bounds.outHeight);
            int sample = 1;
            while (max / sample > 640) sample *= 2;
            android.graphics.BitmapFactory.Options opts = new android.graphics.BitmapFactory.Options();
            opts.inSampleSize = sample;
            return android.graphics.BitmapFactory.decodeByteArray(data, 0, data.length, opts);
        } catch (Exception e) {
            return null;
        }
    }

    /** Fetch the current song's cover if missing, then repost the notification with artwork. */
    private void maybeFetchMusicArt() {
        final String src = musicCoverUrl;
        if (src == null || src.isEmpty() || ART_CACHE.containsKey(src)) return;
        fetchArtAsync(src, () -> {
            if (musicActive && src.equals(musicCoverUrl)) {
                showMusicNotification(musicTitle, musicArtist, musicAlbum, musicPlaying, musicLiked, musicSongId,
                    musicCoverUrl, musicDurationMs, currentMusicPositionMs());
            }
        });
    }

    /** Fetch the call avatar if missing, then refresh the call notification with it. */
    private void maybeFetchCallAvatar() {
        final String src = callAvatar;
        if (src == null || src.isEmpty() || ART_CACHE.containsKey(src)) return;
        fetchArtAsync(src, () -> {
            if (callStartedAtMs != 0 && src.equals(callAvatar)) {
                updateCallNotification(callCharName, callStartedAtMs);
            }
        });
    }

    /**
     * Run a queued job now, or hand it to AlarmManager when it is far in the future.
     * Shared by fresh enqueues and by re-dispatching a job that was replaced (same jobId,
     * new enqueue token) while an older run of it was still in flight.
     */
    private void dispatchJob(String jobId) {
        if (!ACTIVE_JOB_IDS.add(jobId)) return;
        RUNNING_JOBS.incrementAndGet();
        EXECUTOR.execute(() -> {
            long runAt = readJobRunAt(jobId);
            // Far-future jobs: hand off to AlarmManager instead of parking a worker thread.
            if (runAt > System.currentTimeMillis() + ALARM_THRESHOLD_MS) {
                scheduleExactAlarm(this, jobId, runAt);
                ACTIVE_JOB_IDS.remove(jobId);
                RUNNING_JOBS.decrementAndGet();
                MAIN_HANDLER.post(() -> {
                    restoreMusicForegroundIfIdle();
                    maybeStop();
                });
                return;
            }
            runHttpJob(jobId);
        });
    }

    private void runHttpJob(String jobId) {
        // Token of the enqueue this run belongs to. Every write below is conditional on the
        // job file still existing with this token: if JS cleared the job (or replaced it under
        // the same jobId) mid-flight, this run must not resurrect or overwrite it.
        String token = null;
        try {
            JSONObject job = readJob(this, jobId);
            // Cleared before we started: nothing to do. Do NOT write a "failed" record here —
            // that recreated the deleted file and made drainNativeTimers fire a cleared timer.
            if (job == null) return;
            token = job.optString(ENQUEUE_TOKEN_KEY, "");
            String status = job.optString("status", "");
            // Redelivered intents / duplicate wakes must not re-run a finished job.
            if (!"queued".equals(status) && !"running".equals(status)) return;
            if (CANCELLED.contains(jobId)) {
                markCancelledIfCurrent(this, jobId, token);
                return;
            }
            long runAt = job.optLong("runAt", 0L);
            if (runAt > System.currentTimeMillis()) {
                Thread.sleep(Math.min(runAt - System.currentTimeMillis(), 2_147_000_000L));
            }
            if (CANCELLED.contains(jobId)) {
                markCancelledIfCurrent(this, jobId, token);
                return;
            }
            JSONObject request = job.getJSONObject("request");
            updateJobStatus(job, "running", null);
            if (!writeJobIfCurrent(this, jobId, token, job)) return;

            HttpResult result = executeRequestWithRetry(jobId, token, request, job.optInt("timeoutMs", 120000));
            if (CANCELLED.contains(jobId)) {
                markCancelledIfCurrent(this, jobId, token);
                return;
            }

            JSONObject done = baseFinishedJob(job, "completed");
            JSONObject response = new JSONObject();
            response.put("statusCode", result.statusCode);
            response.put("headers", result.headers);
            response.put("body", result.body);
            done.put("response", response);
            writeJobIfCurrent(this, jobId, token, done);
        } catch (Exception e) {
            try {
                JSONObject job = readJob(this, jobId);
                if (job != null) {
                    JSONObject failed = baseFinishedJob(job, "failed");
                    failed.put("error", e.getMessage() == null ? String.valueOf(e) : e.getMessage());
                    writeJobIfCurrent(this, jobId, token, failed);
                }
            } catch (Exception ignored) {}
        } finally {
            CONNECTIONS.remove(jobId);
            CANCELLED.remove(jobId);
            ACTIVE_JOB_IDS.remove(jobId);
            RUNNING_JOBS.decrementAndGet();
            // The job may have been re-enqueued under the same jobId while this run was in
            // flight; that enqueue was dropped by ACTIVE_JOB_IDS, so pick it up now.
            if (token != null && isReplacedQueuedJob(this, jobId, token)) dispatchJob(jobId);
            // If the job foreground displaced the media notification, restore it once idle.
            restoreMusicForegroundIfIdle();
            maybeStop();
        }
    }

    /**
     * executeRequest + 瞬时传输错误自动重试（最多 2 次补枪，间隔 2s）。
     * 背景：app 切后台再回来时，系统 HTTP 栈可能复用一条服务器已掐掉的 keep-alive 连接，
     * 第一枪必炸 "unexpected end of stream" / SSL handshake / connection reset——
     * 换条新连接几乎必成。后台 job 跑的时候 WebView 已冻结，JS 层的重试不在场，
     * 不在这里补枪的话 job 直接落盘 failed，用户切回前台就看到 [回复处理失败]。
     */
    private HttpResult executeRequestWithRetry(String jobId, String token, JSONObject request, int timeoutMs) throws Exception {
        Exception last = null;
        for (int attempt = 0; attempt <= 2; attempt++) {
            // A cleared/replaced job disconnects its connection, which surfaces as a
            // SocketException and would otherwise look "transient" and be re-sent.
            if (CANCELLED.contains(jobId) || !isCurrentJob(this, jobId, token)) break;
            try {
                return executeRequest(jobId, request, timeoutMs);
            } catch (Exception e) {
                last = e;
                if (CANCELLED.contains(jobId) || !isCurrentJob(this, jobId, token)) throw e;
                String msg = e.getMessage() == null ? String.valueOf(e) : e.getMessage();
                String lower = msg.toLowerCase();
                boolean transient_ = lower.contains("unexpected end of stream")
                        || lower.contains("connection reset")
                        || lower.contains("connection abort")
                        || lower.contains("broken pipe")
                        || lower.contains("ssl")
                        || lower.contains("handshake")
                        || lower.contains("econnreset")
                        || lower.contains("failed to connect")
                        || lower.contains("unable to resolve host")
                        || e instanceof java.net.SocketException
                        || e instanceof java.net.SocketTimeoutException
                        || e instanceof javax.net.ssl.SSLException;
                if (!transient_ || attempt >= 2) throw e;
                Thread.sleep(2000L * (attempt + 1));
            }
        }
        throw last == null ? new IllegalStateException("request cancelled") : last;
    }

    private HttpResult executeRequest(String jobId, JSONObject request, int timeoutMs) throws Exception {
        String method = request.optString("method", "POST").toUpperCase();
        URL url = new URL(request.getString("url"));
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        CONNECTIONS.put(jobId, conn);
        conn.setRequestMethod(method);
        conn.setConnectTimeout(timeoutMs);
        conn.setReadTimeout(timeoutMs);
        conn.setInstanceFollowRedirects(true);
        conn.setDoInput(true);

        JSONObject headers = request.optJSONObject("headers");
        if (headers != null) {
            Iterator<String> keys = headers.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                String value = headers.optString(key, "");
                if (!key.trim().isEmpty()) conn.setRequestProperty(key, value);
            }
        }

        String body = request.optString("body", "");
        if (!"GET".equals(method) && body.length() > 0) {
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            conn.setDoOutput(true);
            conn.setFixedLengthStreamingMode(bytes.length);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(bytes);
            }
        }

        int status = conn.getResponseCode();
        InputStream stream = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
        String text = readAll(stream);

        JSONObject responseHeaders = new JSONObject();
        for (String key : conn.getHeaderFields().keySet()) {
            if (key == null) continue;
            responseHeaders.put(key.toLowerCase(), conn.getHeaderField(key));
        }
        conn.disconnect();
        return new HttpResult(status, responseHeaders, text);
    }

    private static String readAll(InputStream stream) throws Exception {
        if (stream == null) return "";
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = stream.read(buf)) >= 0) out.write(buf, 0, n);
        return out.toString("UTF-8");
    }

    private static JSONObject baseFinishedJob(JSONObject job, String status) throws Exception {
        JSONObject out = new JSONObject();
        long now = System.currentTimeMillis();
        out.put("jobId", job.getString("jobId"));
        out.put("status", status);
        out.put("createdAt", job.optLong("createdAt", now));
        out.put("updatedAt", now);
        out.put("timeoutMs", job.optInt("timeoutMs", 120000));
        if (job.has("runAt")) out.put("runAt", job.optLong("runAt"));
        out.put("responseType", job.optString("responseType", "json"));
        if (job.has("meta")) out.put("meta", job.getJSONObject("meta"));
        JSONObject req = job.optJSONObject("request");
        if (req != null) {
            JSONObject safeReq = new JSONObject();
            safeReq.put("url", req.optString("url"));
            safeReq.put("method", req.optString("method", "POST"));
            out.put("request", safeReq);
        }
        return out;
    }

    private static void updateJobStatus(JSONObject job, String status, String error) throws Exception {
        job.put("status", status);
        job.put("updatedAt", System.currentTimeMillis());
        if (error != null) job.put("error", error);
    }

    public static void markCancelled(Context context, String jobId) throws Exception {
        JSONObject job = readJob(context, jobId);
        // Cancelling a job that was already cleared must not recreate its file.
        if (job == null) return;
        writeJob(context, jobId, baseFinishedJob(job, "cancelled"));
    }

    /** Per-enqueue identity stored in the job file; distinguishes reuses of the same jobId. */
    static final String ENQUEUE_TOKEN_KEY = "enqueueToken";

    static String newEnqueueToken() {
        return java.util.UUID.randomUUID().toString();
    }

    /** True when the job file still exists and belongs to the enqueue identified by token. */
    static synchronized boolean isCurrentJob(Context context, String jobId, String token) {
        try {
            JSONObject current = readJob(context, jobId);
            return current != null && current.optString(ENQUEUE_TOKEN_KEY, "").equals(token == null ? "" : token);
        } catch (Exception e) {
            return false;
        }
    }

    /** Write only if the job was neither cleared nor replaced since this run read it. */
    static synchronized boolean writeJobIfCurrent(Context context, String jobId, String token, JSONObject job) throws Exception {
        if (!isCurrentJob(context, jobId, token)) return false;
        writeJob(context, jobId, job);
        return true;
    }

    static synchronized void markCancelledIfCurrent(Context context, String jobId, String token) {
        try {
            JSONObject job = readJob(context, jobId);
            if (job == null || !job.optString(ENQUEUE_TOKEN_KEY, "").equals(token == null ? "" : token)) return;
            writeJob(context, jobId, baseFinishedJob(job, "cancelled"));
        } catch (Exception ignored) {}
    }

    /** A newer enqueue replaced this jobId while the old run was in flight and still needs to run. */
    static synchronized boolean isReplacedQueuedJob(Context context, String jobId, String oldToken) {
        try {
            JSONObject job = readJob(context, jobId);
            if (job == null) return false;
            if (job.optString(ENQUEUE_TOKEN_KEY, "").equals(oldToken)) return false;
            return "queued".equals(job.optString("status", ""));
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Remove a job completely: cancel its alarm, abort an in-flight request and delete the file.
     * Deliberately does NOT add the jobId to CANCELLED: timer jobIds are reused (clear + re-enqueue
     * under the same id), and a lingering CANCELLED entry would kill the next enqueue. The in-flight
     * run notices the missing/replaced file through its enqueue token instead.
     */
    static synchronized void clearJob(Context context, String jobId) {
        cancelAlarm(context, jobId);
        File f = jobFile(context, jobId);
        if (f.exists()) f.delete();
        HttpURLConnection conn = CONNECTIONS.get(jobId);
        if (conn != null) {
            try { conn.disconnect(); } catch (Exception ignored) {}
        }
    }

    private void showEventNotification(String title, String body, String tag, String route) {
        ensureChannel(this);
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        Notification notification = buildNotification(
            title == null || title.trim().isEmpty() ? "SullyOS" : title,
            body == null ? "" : body,
            false,
            route
        );
        int id = 32000 + Math.abs((tag == null ? "sully-event" : tag).hashCode() % 10000);
        manager.notify(tag == null ? "sully-event" : tag, id, notification);
    }

    private void startForegroundCompat(String title, String text) {
        ensureChannel(this);
        Notification generic = buildNotification(
            title == null || title.trim().isEmpty() ? "SullyOS 正在运行" : title,
            text == null || text.trim().isEmpty() ? "" : text,
            true,
            null
        );
        if (callStartedAtMs != 0) {
            // An active call owns the foreground anchor: CallStyle is rejected by the
            // system when posted via notify(), so never displace it. Re-assert the call
            // anchor (satisfies the startForegroundService contract) and post the
            // generic notification alongside with a tag.
            startForegroundCompatWithCall(callCharName, callStartedAtMs);
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                try { manager.notify("sully-fg", NOTIFICATION_ID, generic); } catch (Exception ignored) {}
                // Drop the no-tag form left over from before the call took the anchor —
                // (tag, id) are distinct identities, so otherwise both 31090 notifications co-exist.
                try { manager.cancel(NOTIFICATION_ID); } catch (Exception ignored) {}
            }
            return;
        }
        // Anchoring the no-tag form: drop any tagged form left over from a previous call period.
        NotificationManager mgr = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (mgr != null) { try { mgr.cancel("sully-fg", NOTIFICATION_ID); } catch (Exception ignored) {} }
        startForegroundTyped(NOTIFICATION_ID, generic, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
    }

    /** Post the generic persistent notification without touching the foreground anchor. */
    private void postGenericAlongside(String title, String text) {
        ensureChannel(this);
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        Notification generic = buildNotification(
            title == null || title.trim().isEmpty() ? "SullyOS 正在运行" : title,
            text == null || text.trim().isEmpty() ? "" : text,
            true,
            null
        );
        try { manager.notify("sully-fg", NOTIFICATION_ID, generic); } catch (Exception ignored) {}
        // Same (tag, id) dedupe: drop the no-tag form so only the tagged alongside copy remains.
        try { manager.cancel(NOTIFICATION_ID); } catch (Exception ignored) {}
    }

    private void startForegroundCompatWithCall(String charName, long startedAtMs) {
        ensureChannel(this);
        ensureCallChannel(this);
        // charId is stored in static field callCharId, use it for route if available
        String rawRoute = callCharId != null ? callCharId : (charName != null ? charName : "call");
        String routeCallId = rawRoute.startsWith("call:") ? rawRoute : "call:" + rawRoute;
        Notification notification = buildCallNotification(
            charName,
            charName == null || charName.trim().isEmpty() ? "通话中" : "正在与 " + charName + " 通话",
            "轻触返回通话",
            startedAtMs,
            routeCallId
        );
        startForegroundTyped(NOTIFICATION_CALL_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
    }

    private void updateCallNotification(String charName, long startedAtMs) {
        ensureChannel(this);
        ensureCallChannel(this);
        // CallStyle is only accepted from a foreground service, so an active call must
        // always update through startForeground — the notify() path gets silently
        // rejected by the system and the card disappears.
        if (callStartedAtMs != 0) {
            startForegroundCompatWithCall(charName, startedAtMs);
            return;
        }
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        String rawRoute = callCharId != null ? callCharId : (charName != null ? charName : "call");
        String routeCallId = rawRoute.startsWith("call:") ? rawRoute : "call:" + rawRoute;
        Notification notification = buildCallNotification(
            charName,
            charName == null || charName.trim().isEmpty() ? "通话中" : "正在与 " + charName + " 通话",
            "轻触返回通话",
            startedAtMs,
            routeCallId
        );
        try { manager.notify("sully-call", NOTIFICATION_CALL_ID, notification); } catch (Exception ignored) {}
    }

    private void stopCallNotification() {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.cancel("sully-call", NOTIFICATION_CALL_ID);
        }
        // Restore whichever foreground still applies (persistent / music), or stop the service.
        reassertForeground();
    }

    private Notification buildCallNotification(String charName, String title, String text, long startedAtMs, String charIdForRoute) {
        ensureCallChannel(this);
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent contentIntent = null;
        if (launchIntent != null) {
            // Route is recorded on tap only (see buildNotification); this notification is
            // rebuilt on every call update / avatar load, so a post-time write would keep
            // re-arming the call route long after the user stopped caring.
            launchIntent.putExtra(EXTRA_ROUTE, charIdForRoute != null ? charIdForRoute : "call");
            launchIntent.putExtra("sully_call_resume", true);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
            contentIntent = PendingIntent.getActivity(this, 93091, launchIntent, flags);
        }

        // Hangup action
        Intent hangupIntent = new Intent(this, SullyNativeRuntimeService.class);
        hangupIntent.setAction(ACTION_CALL_END);
        int hangupFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) hangupFlags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent hangupPending = PendingIntent.getService(this, 93092, hangupIntent, hangupFlags);

        android.graphics.Bitmap avatarBmp = callAvatar != null && !callAvatar.isEmpty() ? ART_CACHE.get(callAvatar) : null;

        // API 31+: CallStyle renders the QQ/WeChat-like ongoing-call card with a big
        // avatar and a proper hang-up button. Fall back to the plain style if the
        // system rejects it (CallStyle validates person / foreground requirements).
        if (Build.VERSION.SDK_INT >= 31) {
            try {
                Notification.Builder builder = newCallBuilderBase(title, text, startedAtMs, contentIntent);
                android.app.Person.Builder pb = new android.app.Person.Builder()
                    .setName(charName == null || charName.trim().isEmpty() ? "通话中" : charName)
                    .setImportant(true);
                if (avatarBmp != null) {
                    pb.setIcon(android.graphics.drawable.Icon.createWithBitmap(avatarBmp));
                }
                builder.setStyle(Notification.CallStyle.forOngoingCall(pb.build(), hangupPending));
                return builder.build();
            } catch (Exception ignored) { /* fall through to the legacy layout */ }
        }

        Notification.Builder builder = newCallBuilderBase(title, text, startedAtMs, contentIntent);
        if (avatarBmp != null) builder.setLargeIcon(avatarBmp);
        // Add hangup action for Android
        builder.addAction(new Notification.Action.Builder(
            null,
            "挂断",
            hangupPending
        ).build());
        return builder.build();
    }

    private Notification.Builder newCallBuilderBase(String title, String text, long startedAtMs, PendingIntent contentIntent) {
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_CALL);
        } else {
            builder = new Notification.Builder(this);
        }
        builder.setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(getApplicationInfo().icon)
            .setOngoing(true)
            .setShowWhen(true)
            .setWhen(startedAtMs > 0 ? startedAtMs : System.currentTimeMillis())
            .setUsesChronometer(true)
            .setContentIntent(contentIntent)
            .setCategory(Notification.CATEGORY_CALL);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder.setColorized(true);
        }
        return builder;
    }

    private void showMusicNotification(String title, String artist, String album, boolean isPlaying, boolean isLiked, String songId,
                                       String coverUrl, long durationMs, long positionMs) {
        ensureChannel(this);
        ensureMusicChannel(this);
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        // Remember state so reassertForeground() can rebuild this notification later.
        musicTitle = title;
        musicArtist = artist;
        musicAlbum = album;
        musicPlaying = isPlaying;
        musicLiked = isLiked;
        musicSongId = songId;
        musicCoverUrl = coverUrl;
        musicDurationMs = durationMs;
        musicPositionMs = positionMs;
        musicPositionCapturedAt = System.currentTimeMillis();
        musicActive = true;

        String contentTitle = title != null && !title.trim().isEmpty() ? title : "SullyOS 音乐";
        String contentText = artist != null && !artist.trim().isEmpty() ? artist : (album != null ? album : "正在播放");

        // Post immediately with whatever artwork is cached; if the cover isn't cached yet,
        // kick off a background download and repost once it lands (keeps the 5s FGS contract).
        android.graphics.Bitmap art = coverUrl != null && !coverUrl.isEmpty() ? ART_CACHE.get(coverUrl) : null;
        updateMediaSessionMetadata(contentTitle, contentText, album, isPlaying, art, durationMs, positionMs);
        Notification notification = buildMusicNotification(contentTitle, contentText, isPlaying, isLiked, songId, art);
        if (manualForeground || callStartedAtMs != 0) {
            // Another notification already anchors the foreground; post music alongside it
            // so we don't displace the persistent/call notification.
            manager.notify("sully-music", NOTIFICATION_MUSIC_ID, notification);
        } else {
            // Anchor the service's foreground on the media notification so playback
            // controls keep working with the app in background / screen off.
            startForegroundTyped(NOTIFICATION_MUSIC_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        }
        if (art == null) maybeFetchMusicArt();
    }

    private void stopMusicNotification() {
        musicActive = false;
        musicPlaying = false;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            // The notification may have been posted with a tag (notify path) or without
            // one (startForeground path); cancel both forms.
            manager.cancel("sully-music", NOTIFICATION_MUSIC_ID);
            manager.cancel(NOTIFICATION_MUSIC_ID);
        }
        if (mediaSession != null) {
            try { mediaSession.setActive(false); } catch (Exception ignored) {}
        }
        // Restore whichever foreground still applies (persistent / call), or stop the service.
        reassertForeground();
    }

    private Notification buildMusicNotification(String title, String artist, boolean isPlaying, boolean isLiked, String songId,
                                                android.graphics.Bitmap art) {
        ensureMusicChannel(this);

        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent contentIntent = null;
        if (launchIntent != null) {
            launchIntent.putExtra(EXTRA_ROUTE, "music");
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
            contentIntent = PendingIntent.getActivity(this, 94091, launchIntent, flags);
        }

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_MUSIC);
        } else {
            builder = new Notification.Builder(this);
        }

        builder.setContentTitle(title)
            .setContentText(artist)
            .setSmallIcon(getApplicationInfo().icon)
            .setOngoing(isPlaying) // ongoing when playing, swipe-dismissable when paused
            .setShowWhen(false)
            .setContentIntent(contentIntent);

        // Album cover: largeIcon feeds the notification card; colorized lets the system
        // tint the card from the artwork palette (the NetEase-like look on most OEMs).
        if (art != null) {
            builder.setLargeIcon(art);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                builder.setColorized(true);
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            builder.setCategory(Notification.CATEGORY_TRANSPORT);
        }

        // Build action pending intents
        PendingIntent prevPending = buildMusicActionPendingIntent("prev", 94092, false);
        PendingIntent togglePending = buildMusicActionPendingIntent(isPlaying ? "pause" : "play", 94093, false);
        PendingIntent nextPending = buildMusicActionPendingIntent("next", 94094, false);
        // Like is silent: it just persists the state, no need to yank the app foreground.
        PendingIntent likePending = buildMusicActionPendingIntent(isLiked ? "unlike" : "like", 94095, true);

        // Order: like, prev, play/pause, next — icons are required for MIUI/HyperOS to render them.
        String likeTitle = isLiked ? "取消喜欢" : "喜欢";
        builder.addAction(new Notification.Action.Builder(
            android.graphics.drawable.Icon.createWithResource(this, isLiked ? R.drawable.ic_sully_liked : R.drawable.ic_sully_like),
            likeTitle, likePending).build());
        builder.addAction(new Notification.Action.Builder(
            android.graphics.drawable.Icon.createWithResource(this, R.drawable.ic_sully_prev),
            "上一首", prevPending).build());
        String toggleTitle = isPlaying ? "暂停" : "播放";
        builder.addAction(new Notification.Action.Builder(
            android.graphics.drawable.Icon.createWithResource(this, isPlaying ? R.drawable.ic_sully_pause : R.drawable.ic_sully_play),
            toggleTitle, togglePending).build());
        builder.addAction(new Notification.Action.Builder(
            android.graphics.drawable.Icon.createWithResource(this, R.drawable.ic_sully_next),
            "下一首", nextPending).build());

        // MediaStyle + MediaSession so media buttons / lockscreen controls work (API 21+).
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            try {
                android.media.session.MediaSession session = ensureMediaSession();
                if (session != null) {
                    Notification.MediaStyle style = new Notification.MediaStyle()
                        .setMediaSession(session.getSessionToken())
                        .setShowActionsInCompactView(1, 2, 3); // prev / play-pause / next
                    builder.setStyle(style);
                }
            } catch (Exception ignored) { /* fall back to plain notification */ }
        }
        return builder.build();
    }

    private PendingIntent buildMusicActionPendingIntent(String action, int requestCode, boolean silent) {
        Intent intent = new Intent(this, SullyNativeRuntimeService.class);
        intent.setAction(ACTION_MUSIC_ACTION);
        intent.putExtra("musicAction", action);
        intent.putExtra("silent", silent);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getService(this, requestCode, intent, flags);
    }

    private Notification buildNotification(String title, String text, boolean ongoing, String route) {
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pendingIntent = null;
        if (launchIntent != null) {
            boolean hasRoute = route != null && !route.trim().isEmpty();
            // The route travels with the tap (Intent extra) and is only recorded when the user
            // actually opens this notification (SullyNativeRuntimePlugin.captureLaunchRoute).
            // Writing launch_route here, at post time, made the app jump to the newest event
            // whenever it came back to the foreground — even without any notification tap.
            if (hasRoute) launchIntent.putExtra(EXTRA_ROUTE, route);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
            // One PendingIntent per destination: with a shared request code, FLAG_UPDATE_CURRENT
            // rewrote the extras of every earlier notification to the newest route.
            pendingIntent = PendingIntent.getActivity(this, hasRoute ? routeRequestCode(route) : 0, launchIntent, flags);
        }
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);
        builder
            .setContentTitle(title)
            .setSmallIcon(getApplicationInfo().icon)
        ;
        if (text != null && !text.trim().isEmpty()) {
            builder.setContentText(text);
        }
        builder
            .setOngoing(ongoing)
            .setShowWhen(false)
            .setContentIntent(pendingIntent);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            builder.setCategory(Notification.CATEGORY_SERVICE);
        }
        return builder.build();
    }

    private void maybeStop() {
        if (manualForeground || RUNNING_JOBS.get() > 0 || callStartedAtMs != 0 || musicActive) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        stopSelf();
    }

    public static void startCompat(Context context, Intent intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    private static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "SullyOS 后台任务",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("SullyOS APK 原生后台任务与生成保活");
        manager.createNotificationChannel(channel);
    }

    private static void ensureCallChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || manager.getNotificationChannel(CHANNEL_CALL) != null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_CALL,
            "SullyOS 通话",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("正在进行的通话");
        channel.setShowBadge(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            channel.setAllowBubbles(false);
        }
        manager.createNotificationChannel(channel);
    }

    private static void ensureMusicChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || manager.getNotificationChannel(CHANNEL_MUSIC) != null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_MUSIC,
            "SullyOS 音乐",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("正在播放的音乐");
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    public static File jobsDir(Context context) {
        File dir = new File(context.getFilesDir(), "native-jobs");
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    public static File jobFile(Context context, String jobId) {
        String safe = jobId.replaceAll("[^a-zA-Z0-9._-]", "_");
        return new File(jobsDir(context), safe + ".json");
    }

    public static synchronized void writeJob(Context context, String jobId, JSONObject job) throws Exception {
        File f = jobFile(context, jobId);
        try (FileOutputStream fos = new FileOutputStream(f, false)) {
            fos.write(job.toString().getBytes(StandardCharsets.UTF_8));
        }
    }

    public static synchronized JSONObject readJob(Context context, String jobId) throws Exception {
        File f = jobFile(context, jobId);
        if (!f.exists()) return null;
        try (FileInputStream fis = new FileInputStream(f)) {
            return new JSONObject(readAll(fis));
        }
    }

    public static synchronized JSONArray listJobs(Context context) throws Exception {
        JSONArray arr = new JSONArray();
        File[] files = jobsDir(context).listFiles();
        if (files == null) return arr;
        for (File f : files) {
            if (!f.isFile() || !f.getName().endsWith(".json")) continue;
            try (FileInputStream fis = new FileInputStream(f)) {
                // Summary only: request/response bodies can be megabytes each and the
                // resolve payload is injected via evaluateJavascript on the main thread.
                // Callers that need the full record use getJob(jobId).
                JSONObject job = new JSONObject(readAll(fis));
                job.remove("request");
                job.remove("response");
                arr.put(job);
            } catch (Exception ignored) {}
        }
        return arr;
    }

    private static class HttpResult {
        final int statusCode;
        final JSONObject headers;
        final String body;
        HttpResult(int statusCode, JSONObject headers, String body) {
            this.statusCode = statusCode;
            this.headers = headers;
            this.body = body;
        }
    }
}
