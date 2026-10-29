package io.github.mi9pro.navigation;

import org.junit.Test;
import static org.junit.Assert.*;

public class ListenerRecoveryTest {
    @Test public void theFirstAttemptRebindsAndLaterOnesToggle() {
        ListenerRecovery policy = new ListenerRecovery();
        assertFalse("a healthy start must not touch the component", policy.toggleNow());
        assertEquals(1, policy.attempts());
        assertTrue("rebinding is a no-op once the system dropped the binding", policy.toggleNow());
        assertEquals(2, policy.attempts());
        assertTrue(policy.toggleNow());
        assertEquals(3, policy.attempts());
    }

    @Test public void retriesStartSubSecondApartAndBackOff() {
        ListenerRecovery policy = new ListenerRecovery();
        policy.toggleNow();
        assertEquals(1000, policy.nextDelayMs());
        policy.toggleNow();
        assertEquals(1500, policy.nextDelayMs());
        policy.toggleNow();
        assertEquals(2500, policy.nextDelayMs());
        policy.toggleNow();
        assertEquals(4000, policy.nextDelayMs());
        policy.toggleNow();
        assertEquals(8000, policy.nextDelayMs());
        policy.toggleNow();
        assertEquals("the steady delay never grows unbounded", 8000, policy.nextDelayMs());
    }

    @Test public void aConnectedListenerClearsTheEscalationAndRestartsTheSchedule() {
        ListenerRecovery policy = new ListenerRecovery();
        policy.toggleNow();
        policy.toggleNow();
        policy.toggleNow();
        policy.reset();
        assertEquals(0, policy.attempts());
        assertFalse(policy.toggleNow());
        assertEquals(1000, policy.nextDelayMs());
    }

    @Test public void theFirstAttemptSequenceStaysWithinThreeSeconds() {
        ListenerRecovery policy = new ListenerRecovery();
        long elapsed = 0;
        policy.toggleNow();
        for (int attempt = 2; attempt <= 3; attempt++) {
            elapsed += policy.nextDelayMs();
            policy.toggleNow();
        }
        assertTrue("two attempts must land inside 3 s, was " + elapsed, elapsed <= 3000);
        assertTrue("the second attempt must already toggle", policy.attempts() >= 2);
    }
}
