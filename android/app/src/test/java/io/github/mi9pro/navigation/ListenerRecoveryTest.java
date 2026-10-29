package io.github.mi9pro.navigation;

import org.junit.Test;
import static org.junit.Assert.*;

public class ListenerRecoveryTest {
    @Test public void firstAttemptsRebindBeforeTogglingTheComponent() {
        ListenerRecovery policy = new ListenerRecovery();
        assertFalse(policy.toggleNow());
        assertEquals(1, policy.attempts());
        assertFalse(policy.toggleNow());
        assertEquals(2, policy.attempts());
        assertTrue(policy.toggleNow());
        assertEquals(3, policy.attempts());
    }

    @Test public void togglingKeepsEscalatingWhileTheListenerStaysDown() {
        ListenerRecovery policy = new ListenerRecovery();
        for (int attempt = 1; attempt <= 9; attempt++) {
            assertEquals("attempt " + attempt, attempt % 3 == 0, policy.toggleNow());
        }
    }

    @Test public void aConnectedListenerClearsTheEscalation() {
        ListenerRecovery policy = new ListenerRecovery();
        policy.toggleNow();
        policy.toggleNow();
        policy.reset();
        assertEquals(0, policy.attempts());
        assertFalse(policy.toggleNow());
    }
}
