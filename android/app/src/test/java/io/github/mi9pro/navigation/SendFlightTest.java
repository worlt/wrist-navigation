package io.github.mi9pro.navigation;

import org.junit.Test;
import static org.junit.Assert.*;

public class SendFlightTest {
    @Test public void peerAckReleasesFlightBeforeDelayedSdkCallback() {
        SendFlight f = new SendFlight(); long close = f.start(1);
        assertTrue(f.pending()); assertTrue(f.ack(1)); assertFalse(f.pending());
        long cancel = f.start(2); assertFalse(f.complete(close)); assertTrue(f.pending());
        assertTrue(f.complete(cancel)); assertFalse(f.pending());
    }
    @Test public void oldOrFutureAckCannotReleaseANewerFlight() {
        SendFlight f = new SendFlight(); f.start(4);
        assertFalse(f.ack(3)); assertFalse(f.ack(5)); assertTrue(f.pending());
        assertTrue(f.ack(4)); assertFalse(f.ack(4));
    }
    @Test public void disconnectInvalidatesCompletionAndTimeout() {
        SendFlight f = new SendFlight(); long old = f.start(1); f.cancel();
        assertFalse(f.current(old)); assertFalse(f.complete(old));
        long next = f.start(2); assertTrue(f.current(next)); assertFalse(f.current(old));
    }
}
