package io.github.mi9pro.navigation;

/** Suppress identical snapshots, retain active heartbeats, and coalesce rapid changes. */
final class SendPolicy {
    static final long HEARTBEAT_MS = 8000;
    static final long MIN_UPDATE_MS = 500;
    static final long ACTIVE_READ_MS = 1000;
    private String sentFingerprint;
    private long sentAt = -1;

    long delay(String fingerprint, boolean active, long now) {
        if (sentAt < 0) return 0;
        if (!fingerprint.equals(sentFingerprint)) return Math.max(0, MIN_UPDATE_MS - (now - sentAt));
        if (!active) return -1;
        return Math.max(0, HEARTBEAT_MS - (now - sentAt));
    }

    void sent(String fingerprint, long now) { sentFingerprint = fingerprint; sentAt = now; }
    long nextReadDelay(long now) {
        // Read independently of send heartbeats: OEMs may update a distance without a callback.
        long heartbeat = sentAt < 0 ? HEARTBEAT_MS : Math.max(MIN_UPDATE_MS, HEARTBEAT_MS - (now - sentAt));
        return Math.min(ACTIVE_READ_MS, heartbeat);
    }
    void reset() { sentFingerprint = null; sentAt = -1; }
}
