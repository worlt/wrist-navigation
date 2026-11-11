package io.github.mi9pro.navigation;

/** User-visible phone entries, independent of navigation and synchronization state. */
final class PhoneAppLinkPolicy {
    static final long RETRY_MS = 5000, EXIT_WINDOW_MS = 10000;
    static final int MAX_ATTEMPTS = 3;
    private boolean foreground, observed, openEnabled, closeEnabled, pending, opened;
    private int attempts;
    private long token, exit, exitUntil, retryAt;

    PhoneAppLinkPolicy(boolean openEnabled, boolean closeEnabled) {
        this.openEnabled = openEnabled;
        this.closeEnabled = closeEnabled;
    }
    void setForeground(boolean value, long now) {
        if (foreground == value) return;
        foreground = value; observed = true;
        resetLaunch(); clearExit();
        if (!value && closeEnabled) { exit = ++token; exitUntil = now + EXIT_WINDOW_MS; }
    }
    void setOpenEnabled(boolean value) {
        if (openEnabled == value) return;
        openEnabled = value; resetLaunch();
    }
    void setCloseEnabled(boolean value) {
        closeEnabled = value;
        if (!value) clearExit();
        // Enabling while already in the background waits for the next real exit.
    }
    static boolean shouldExit(boolean finishing, boolean configuring, boolean settings, boolean interactive, boolean locked) {
        return !configuring && (finishing || (!settings && interactive && !locked));
    }
    boolean blocksNavigationLaunch() { return observed && !foreground && closeEnabled; }
    boolean launchExpected() { return foreground && openEnabled && !opened && (pending || attempts < MAX_ATTEMPTS); }
    long claimLaunch(long now) {
        if (!launchExpected() || pending || now < retryAt) return 0;
        pending = true; attempts++; return ++token;
    }
    boolean completeLaunch(long request, boolean success, long now) {
        if (!pending || request != token) return false;
        pending = false; opened = success; retryAt = now + RETRY_MS; return true;
    }
    void disconnected(long now) {
        if (pending) { pending = false; token++; retryAt = now + RETRY_MS; }
    }
    long exitId(long now) {
        if (exit != 0 && now >= exitUntil) clearExit();
        return exit;
    }
    void reassertExit(long now) {
        if (!blocksNavigationLaunch()) return;
        // An obsolete native launch may have run after the earlier exit was ACKed.
        // Only compensate actual launch success, never a timeout or manual band launch.
        exit = ++token; exitUntil = now + EXIT_WINDOW_MS;
    }
    void ackExit(long id) { if (id != 0 && exit == id) clearExit(); }
    private void clearExit() { exit = 0; exitUntil = 0; }
    private void resetLaunch() { pending = opened = false; attempts = 0; retryAt = 0; token++; }
}
