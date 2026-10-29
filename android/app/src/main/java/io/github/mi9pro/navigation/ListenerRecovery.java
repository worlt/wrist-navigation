package io.github.mi9pro.navigation;

/**
 * Decides how hard to push the system to bind the notification listener.
 *
 * requestRebind() is only honoured while the system still holds a binding, so a listener
 * that was dropped stays dead and the phone sits on "connecting" forever. Escalating to a
 * component toggle makes the package look changed, which makes the system rebind.
 */
final class ListenerRecovery {
    private static final int TOGGLE_EVERY = 3;
    private int attempts;

    int attempts() { return attempts; }

    void reset() { attempts = 0; }

    /** Records one attempt; true when this attempt should toggle the component instead of rebinding. */
    boolean toggleNow() { return ++attempts % TOGGLE_EVERY == 0; }
}
