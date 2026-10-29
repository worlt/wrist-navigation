package io.github.mi9pro.navigation;

/**
 * Decides how hard to push the system to bind the notification listener.
 *
 * requestRebind() is only honoured while the system still holds a binding, so a listener
 * that was dropped stays dead and the phone sits on "connecting" forever. Toggling the
 * component makes the package look changed, which makes the system rebind — that is the
 * only action that works once the binding is gone, so it is used from the second attempt on
 * while the first one stays cheap and harmless.
 *
 * Retries start sub-second apart and back off while the listener stays down, so a healthy
 * start is never delayed and a dropped listener recovers within a couple of seconds.
 */
final class ListenerRecovery {
    private static final long[] DELAYS_MS = { 1000, 1500, 2500, 4000 };
    private static final long STEADY_MS = 8000;
    private int attempts;

    int attempts() { return attempts; }

    void reset() { attempts = 0; }

    /** Records one attempt; true when this attempt must toggle the component instead of rebinding. */
    boolean toggleNow() { return ++attempts > 1; }

    /** How long to wait after the attempt just recorded before making the next one. */
    long nextDelayMs() {
        int index = attempts - 1;
        if (index < 0) return DELAYS_MS[0];
        return index < DELAYS_MS.length ? DELAYS_MS[index] : STEADY_MS;
    }
}
