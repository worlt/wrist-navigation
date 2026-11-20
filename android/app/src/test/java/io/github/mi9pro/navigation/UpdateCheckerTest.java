package io.github.mi9pro.navigation;

import android.content.SharedPreferences;
import java.lang.reflect.Proxy;
import java.util.*;
import org.junit.Test;
import static org.junit.Assert.*;

public class UpdateCheckerTest {
    private static class Harness {
        final Map<String, Object> saved = new HashMap<>();
        final Deque<Runnable> work = new ArrayDeque<>(), ui = new ArrayDeque<>();
        final List<Boolean> channels = new ArrayList<>();
        GitHubUpdateClient.Result result = new GitHubUpdateClient.Result();
        long now = UpdatePolicy.CHECK_INTERVAL;
        final UpdateChecker checker;
        Harness() {
            SharedPreferences.Editor edit = (SharedPreferences.Editor) Proxy.newProxyInstance(getClass().getClassLoader(),
                new Class<?>[]{SharedPreferences.Editor.class}, (proxy, method, args) -> {
                    if (method.getName().startsWith("put")) { saved.put((String) args[0], args[1]); return proxy; }
                    if (method.getName().equals("remove")) { saved.remove(args[0]); return proxy; }
                    return null;
                });
            SharedPreferences prefs = (SharedPreferences) Proxy.newProxyInstance(getClass().getClassLoader(),
                new Class<?>[]{SharedPreferences.class}, (proxy, method, args) -> {
                    if (method.getName().equals("edit")) return edit;
                    if (method.getName().startsWith("get")) return saved.getOrDefault(args[0], args[1]);
                    return null;
                });
            checker = new UpdateChecker(prefs, work::add, ui::add, preview -> { channels.add(preview); return result; }, () -> now);
        }
        void finish() { work.remove().run(); ui.remove().run(); }
        UpdateFeed.Version version(boolean experimental, int code) {
            return new UpdateFeed.Version("v0.4.9", "0.3.6", code, "phone.apk", "0.4.7", 21,
                "band.rpk", "band-nofont.rpk", "fixture", experimental);
        }
    }
    @Test public void defaultsDailyLimitManualBypassAndOptOut() {
        var h = new Harness(); assertTrue(h.checker.automatic()); assertFalse(h.checker.experimental());
        h.checker.check(false); assertTrue(h.checker.running()); h.finish();
        h.checker.check(false); assertEquals(0, h.work.size());
        h.checker.check(true); h.finish(); assertEquals(Arrays.asList(false, false), h.channels);
        h.checker.setAutomatic(false); h.now *= 2; h.checker.check(false); assertEquals(0, h.work.size());
        h.checker.check(true); h.finish(); assertEquals(3, h.channels.size());
    }
    @Test public void switchingOffPreviewDropsBannerAndLateResultCannotRestoreIt() {
        var h = new Harness(); h.checker.setExperimental(true);
        h.result.version = h.version(true, BuildConfig.VERSION_CODE + 1); h.finish(); assertNotNull(h.checker.available());
        h.checker.check(true); h.checker.setExperimental(false);
        assertNull(h.checker.available()); h.finish();
        assertNull(h.checker.available()); assertEquals(1, h.work.size());
        h.result.version = h.version(false, BuildConfig.VERSION_CODE + 1); h.finish(); assertFalse(h.checker.available().experimental);
        assertEquals(Arrays.asList(true, true, false), h.channels);
    }
    @Test public void repeatedManualClicksCoalesceAndDetachedUiIsNotCalled() {
        var h = new Harness(); int[] events = {0}; h.checker.setListener(() -> events[0]++);
        h.checker.check(true); h.checker.check(true); h.checker.check(true); assertEquals(1, h.work.size());
        h.checker.setListener(null); h.finish(); h.finish(); assertEquals(2, h.channels.size()); assertEquals(1, events[0]);
    }
    @Test public void failurePreservesKnownNewerButSuccessfulWithdrawalClearsCache() {
        var h = new Harness(); h.result.version = h.version(false, BuildConfig.VERSION_CODE + 1); h.checker.check(true); h.finish();
        assertNotNull(h.checker.available()); assertTrue(h.saved.containsKey("cache.stable"));
        h.result = new GitHubUpdateClient.Result(); h.result.complete = false;
        h.checker.check(true); h.finish(); assertNotNull(h.checker.available()); assertTrue(h.checker.status().contains("未完成"));
        h.result.complete = true; h.checker.check(true); h.finish();
        assertNull(h.checker.available()); assertFalse(h.saved.containsKey("cache.stable"));
    }
    @Test public void oldOrEqualVersionNeverShowsBannerAndChannelPreferencePersists() {
        var h = new Harness(); h.result.version = h.version(false, BuildConfig.VERSION_CODE);
        h.checker.check(true); h.finish(); assertNull(h.checker.available());
        h.checker.setExperimental(true); assertEquals(true, h.saved.get("experimental"));
    }
    @Test public void phoneAndBandPreferencesAndPromptsAreIndependent() {
        var phone = new Harness(); var band = new Harness(); band.checker.setDevice(true);
        band.result.version = band.version(true, 50); band.checker.setExperimental(true); band.finish();
        assertFalse(phone.checker.experimental()); assertTrue(band.checker.experimental());
        assertNotNull(band.checker.latestVersion()); assertNull(band.checker.available());
        band.checker.installedBandCode(20); assertNotNull(band.checker.available());
        band.checker.installedBandCode(21); assertNull(band.checker.available());
        band.checker.installedBandCode(0); assertNull(band.checker.available());
        assertTrue(band.checker.status().contains("手环") || band.checker.status().contains("版本"));
    }

}
