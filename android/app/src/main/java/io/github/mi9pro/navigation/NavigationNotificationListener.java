package io.github.mi9pro.navigation;

import android.app.Notification;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import java.util.ArrayList;
import java.util.List;
import java.io.FileDescriptor;
import java.io.PrintWriter;

public final class NavigationNotificationListener extends NotificationListenerService {
    private static NavigationNotificationListener instance;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean connected;
    private WearBridge bridge() { return ((NavigationApp) getApplication()).bridge(); }
    private final Runnable poll = this::refresh;
    private final Runnable refreshTask = this::refresh;

    static void requestRefresh() {
        if (instance == null) return;
        instance.handler.removeCallbacks(instance.refreshTask);
        instance.handler.post(instance.refreshTask);
    }

    @Override public void onListenerConnected() {
        instance = this;
        connected = true;
        bridge().setNotificationListenerConnected(true);
        NavigationSyncService.start(this);
        handler.removeCallbacks(poll);
        handler.post(poll);
    }

    @Override public void onNotificationPosted(StatusBarNotification sbn) { changed(sbn); }
    @Override public void onNotificationRemoved(StatusBarNotification sbn) { changed(sbn); }

    private void changed(StatusBarNotification sbn) {
        if (sbn == null || !NavigationParser.AMAP_PACKAGE.equals(sbn.getPackageName()) || !bridge().enabled()) return;
        // Coalesce remove+repost bursts and reread the active set instead of ending another route.
        handler.removeCallbacks(refreshTask);
        handler.postDelayed(refreshTask, 150);
    }

    private void refresh() {
        handler.removeCallbacks(poll);
        handler.removeCallbacks(refreshTask);
        if (!connected || !bridge().enabled()) return;
        try {
            NavigationParser.Result best = null;
            long newest = Long.MIN_VALUE;
            String lastRaw = "", selectedEvidence = "";
            List<String> evidence = new ArrayList<>();
            long rawTime = Long.MIN_VALUE;
            int count = 0, readable = 0;
            StatusBarNotification[] active = getActiveNotifications();
            if (active == null) {
                bridge().unavailable("暂时无法读取通知");
                return;
            }
            for (StatusBarNotification sbn : active) {
                if (!NavigationParser.AMAP_PACKAGE.equals(sbn.getPackageName())) continue;
                count++;
                Notification notification = sbn.getNotification();
                if ((notification.flags & Notification.FLAG_GROUP_SUMMARY) != 0) continue;
                String[] fields = fields(notification);
                String record = "通知 · " + NavigationDiagnostics.time(sbn.getPostTime())
                    + " · ongoing=" + sbn.isOngoing() + "\n" + diagnosticFields(notification);
                if (evidence.size() < 6 && fields.length > 0) evidence.add(record);
                if (fields.length > 0) readable++;
                if (sbn.getPostTime() >= rawTime) {
                    lastRaw = NavigationParser.clip(String.join("\n", fields), 1000);
                    rawTime = sbn.getPostTime();
                }
                NavigationParser.Result result = NavigationParser.parse(sbn.getPackageName(), sbn.isOngoing(), fields);
                if (result != null && sbn.getPostTime() >= newest) {
                    best = result;
                    newest = sbn.getPostTime();
                    selectedEvidence = record;
                }
            }
            bridge().lastAmapText = lastRaw.isEmpty() ? "没有可读取的高德通知文字" : lastRaw;
            StringBuilder rawEvidence = new StringBuilder();
            if (!selectedEvidence.isEmpty()) rawEvidence.append("解析采用的通知\n").append(selectedEvidence).append("\n");
            for (String record : evidence) {
                if (!record.equals(selectedEvidence)) rawEvidence.append("其他高德通知\n").append(record).append("\n");
            }
            if (readable > evidence.size()) rawEvidence.append("（仅展示最多6条其他通知，解析来源单独保留）");
            bridge().diagnostics.read(rawEvidence.toString().trim(), System.currentTimeMillis());
            bridge().notificationChecked(count, readable, best);
            bridge().updateFromNotifications(best);
        } catch (SecurityException | IllegalStateException error) {
            bridge().unavailable("通知读取不可用，请检查通知使用权");
        } finally {
            if (connected && bridge().enabled()) handler.postDelayed(poll, bridge().pollIntervalMs());
        }
    }

    static String[] fields(Notification notification) {
        Bundle extras = notification.extras;
        List<String> fields = new ArrayList<>();
        if (extras != null) {
            for (String key : new String[] { Notification.EXTRA_TITLE, Notification.EXTRA_TEXT,
                    Notification.EXTRA_BIG_TEXT, Notification.EXTRA_SUB_TEXT, Notification.EXTRA_SUMMARY_TEXT }) {
                CharSequence value = extras.getCharSequence(key);
                if (value != null && value.length() > 0) fields.add(value.toString());
            }
            CharSequence[] lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
            if (lines != null) for (CharSequence line : lines) if (line != null) fields.add(line.toString());
        }
        if (notification.tickerText != null) fields.add(notification.tickerText.toString());
        return fields.toArray(new String[0]);
    }

    private static String diagnosticFields(Notification notification) {
        StringBuilder text = new StringBuilder();
        Bundle extras = notification.extras;
        String[] keys = { Notification.EXTRA_TITLE, Notification.EXTRA_TEXT, Notification.EXTRA_BIG_TEXT,
            Notification.EXTRA_SUB_TEXT, Notification.EXTRA_SUMMARY_TEXT };
        if (extras != null) {
            for (String key : keys) {
                CharSequence value = extras.getCharSequence(key);
                if (value != null && value.length() > 0)
                    text.append(key).append(": ").append(NavigationParser.clip(value.toString(), 512)).append("\n");
            }
            CharSequence[] lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
            if (lines != null) for (int i = 0; i < Math.min(lines.length, 8); i++) {
                if (lines[i] != null) text.append("android.textLines[").append(i).append("]: ")
                    .append(NavigationParser.clip(lines[i].toString(), 512)).append("\n");
            }
        }
        if (notification.tickerText != null) text.append("tickerText: ")
            .append(NavigationParser.clip(notification.tickerText.toString(), 512));
        return text.toString().trim();
    }

    @Override public void onListenerDisconnected() {
        disconnect();
        rebindIfEnabled();
    }
    @Override public void onDestroy() {
        boolean wasConnected = connected;
        disconnect();
        if (wasConnected) rebindIfEnabled();
        super.onDestroy();
    }
    private void rebindIfEnabled() {
        if (bridge().enabled() && NavigationSyncService.hasNotificationAccess(this)) {
            NotificationListenerService.requestRebind(
                    new android.content.ComponentName(this, NavigationNotificationListener.class));
        }
    }
    @Override protected void dump(FileDescriptor fd, PrintWriter writer, String[] args) { bridge().dump(writer); }
    private void disconnect() {
        // A replaced instance may be destroyed after its successor has already connected;
        // only the current instance may clear the shared connection state.
        boolean current = instance == this;
        if (current) instance = null;
        connected = false;
        handler.removeCallbacksAndMessages(null);
        if (!current) return;
        bridge().setNotificationListenerConnected(false);
        bridge().unavailable("通知监听已断开");
    }
}
