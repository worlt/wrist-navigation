package io.github.mi9pro.navigation;

/** A journey survives notification refreshes, disconnections and sync pauses. */
public final class NavigationLifecycle {
    public static final long END_CONFIRM_MS = 5000;
    private long counter;
    private String id;
    private boolean ended;
    private long idleSince = -1;

    public void update(String status, long now) {
        if ("active".equals(status)) {
            if (id == null || ended) id = "navigation-" + (++counter);
            ended = false;
            idleSince = -1;
        } else if ("ended".equals(status) && id != null) {
            ended = true;
            idleSince = -1;
        } else if ("idle".equals(status) && id != null && !ended) {
            if (idleSince < 0 || now < idleSince) idleSince = now;
            if (now - idleSince >= END_CONFIRM_MS) ended = true;
        } else {
            // Losing permission/connection or pausing is not evidence of arrival.
            idleSince = -1;
        }
    }

    public String id() { return id; }
    public boolean ended() { return ended; }
    public boolean allowsVibration(boolean sync, boolean preference, boolean listener,
                                   String status, long age) {
        return sync && preference && listener && age >= 0 && age < 20000
                && ("active".equals(status) || (ended && ("ended".equals(status) || "idle".equals(status))));
    }
}
