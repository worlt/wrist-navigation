package io.github.mi9pro.navigation;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.function.LongSupplier;

/** Application-scoped work; UI listeners are attached only while an Activity is resumed. */
final class UpdateChecker {
    private final SharedPreferences preferences;
    interface Source { GitHubUpdateClient.Result check(boolean experimental); }
    private final Executor worker, main;
    private final Source source;
    private final LongSupplier clock;
    private boolean band;
    private int installedCode = BuildConfig.VERSION_CODE;
    private Runnable listener;
    private boolean running, pending;
    private int generation;
    private UpdateFeed.Version candidate;
    private String status = "尚未检查";

    UpdateChecker(Context context) { this(context, false); }
    UpdateChecker(Context context, boolean band) {
        this(context.getApplicationContext().getSharedPreferences(band ? "updates.band.v1" : "updates.v1", Context.MODE_PRIVATE),
            Executors.newSingleThreadExecutor(r -> {
                Thread thread = new Thread(r, band ? "band-version-check" : "phone-version-check"); thread.setDaemon(true); return thread;
            }), mainExecutor(), preview -> GitHubUpdateClient.online().check(preview, band), System::currentTimeMillis);
        setDevice(band);
    }
    void setDevice(boolean band) { this.band = band; installedCode = band ? 0 : BuildConfig.VERSION_CODE; loadCache(); }
    void installedBandCode(int code) {
        if (band && installedCode != code) {
            installedCode = code;
            if (status.startsWith("已检查")) status = code == 0
                ? "已检查发布信息；当前手环版本未知，无法判断是否需要升级"
                : available() != null ? "发现手环新版本" : "已检查，当前所选渠道没有可升级的手环版本";
            notifyUi();
        }
    }
    UpdateFeed.Version latestVersion() { return candidate; }
    // Same state machine as production, with a deterministic worker, UI queue and clock in tests.
    UpdateChecker(SharedPreferences preferences, Executor worker, Executor main, Source source, LongSupplier clock) {
        this.preferences = preferences; this.worker = worker; this.main = main; this.source = source; this.clock = clock;
        loadCache();
    }
    private static Executor mainExecutor() {
        Handler handler = new Handler(Looper.getMainLooper());
        return task -> handler.post(task);
    }
    boolean automatic() { return preferences.getBoolean("automatic", true); }
    boolean experimental() { return preferences.getBoolean("experimental", false); }
    boolean running() { return running; }
    UpdateFeed.Version available() { return UpdatePolicy.available(candidate, installedCode, experimental(), band) ? candidate : null; }
    String status() { return running ? "正在检查 GitHub 更新…" : status; }
    void setListener(Runnable value) { listener = value; }
    void setAutomatic(boolean value) {
        preferences.edit().putBoolean("automatic", value).apply();
        if (value) check(false);
    }
    void setExperimental(boolean value) {
        if (experimental() == value) return;
        preferences.edit().putBoolean("experimental", value).apply();
        generation++;
        loadCache(); status = "更新渠道已切换，尚未检查";
        notifyUi(); check(true);
    }
    private String channel(boolean experimental) { return experimental ? "preview" : "stable"; }
    private void loadCache() {
        candidate = readCache(false);
        if (experimental()) candidate = UpdatePolicy.newer(candidate, readCache(true), true, band);
    }
    private UpdateFeed.Version readCache(boolean preview) {
        String key = "cache." + channel(preview);
        try {
            String json = preferences.getString(key, null);
            return json == null ? null : UpdateFeed.cached(json, preferences.getBoolean(key + ".experimental", false));
        } catch (Exception error) { preferences.edit().remove(key).remove(key + ".experimental").apply(); return null; }
    }
    void check(boolean manual) {
        if (running) { if (manual) pending = true; return; }
        boolean preview = experimental();
        String lastKey = "lastAttempt." + channel(preview);
        long now = clock.getAsLong();
        if (!UpdatePolicy.shouldCheck(automatic(), manual, preferences.getLong(lastKey, 0), now)) return;
        preferences.edit().putLong(lastKey, now).apply();
        final int request = generation;
        running = true; notifyUi();
        worker.execute(() -> {
            GitHubUpdateClient.Result result = source.check(preview);
            main.execute(() -> {
                running = false;
                if (request == generation) {
                    if (result.complete) candidate = result.version;
                    else candidate = UpdatePolicy.newer(candidate, result.version, preview, band);
                    saveCache(preview);
                    if (!result.complete) status = result.missingMetadata
                        ? "部分 Release 未提供 update.json；无法完整判断，请查看发布页"
                        : "检查未完成，可能是网络或 GitHub 限流；可稍后重试";
                    else if (available() != null) status = "发现新版本";
                    else status = band && installedCode == 0
                        ? "已检查发布信息；当前手环版本未知，无法判断是否需要升级"
                        : "已检查，当前所选渠道没有可升级的" + (band ? "手环" : "手机") + "版本";
                    notifyUi();
                }
                if (pending) { pending = false; check(true); }
            });
        });
    }
    private void saveCache(boolean preview) {
        String key = "cache." + channel(preview);
        SharedPreferences.Editor edit = preferences.edit();
        try {
            if (candidate == null) edit.remove(key).remove(key + ".experimental");
            else edit.putString(key, candidate.cacheJson()).putBoolean(key + ".experimental", candidate.experimental);
            edit.apply();
        } catch (Exception ignored) { /* Metadata cache is optional. */ }
    }
    private void notifyUi() { if (listener != null) listener.run(); }
}
