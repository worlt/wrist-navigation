package io.github.mi9pro.navigation;

/** A peer ACK proves delivery even when the SDK completion callback arrives later. */
final class SendFlight {
    private boolean pending;
    private long generation, sequence;
    long start(long sequence) { this.sequence = sequence; pending = true; return ++generation; }
    boolean pending() { return pending; }
    boolean current(long request) { return pending && request == generation; }
    boolean complete(long request) { if (!current(request)) return false; pending = false; return true; }
    boolean ack(long sequence) {
        if (!pending || sequence != this.sequence) return false;
        cancel(); return true;
    }
    void cancel() { pending = false; generation++; }
}
