package io.github.mi9pro.navigation;

import org.junit.Test;
import static org.junit.Assert.*;

public class SendPolicyTest {
    @Test public void unchangedActiveNotificationsOnlySendOneHeartbeatEveryEightSeconds() {
        SendPolicy policy = new SendPolicy();
        int sends = 0;
        for (int time = 0; time < 60000; time += 1000) {
            if (policy.delay("same navigation", true, time) == 0) {
                policy.sent("same navigation", time);
                sends++;
            }
        }
        assertEquals(8, sends);
    }

    @Test public void terminalAndWaitingStatesAreSentOnceWithoutPeriodicTraffic() {
        for (String state : new String[]{"idle", "ended", "paused", "unavailable"}) {
            SendPolicy policy = new SendPolicy();
            assertEquals(0, policy.delay(state, false, 0));
            policy.sent(state, 0);
            assertEquals(-1, policy.delay(state, false, 60000));
            assertEquals(0, policy.delay("new navigation", true, 61000));
        }
    }

    @Test public void changesArePromptAndBurstsAreBoundedWithoutLosingLatestValue() {
        SendPolicy policy = new SendPolicy();
        policy.sent("straight", 1000);
        assertEquals(400, policy.delay("left", true, 1100));
        assertEquals(200, policy.delay("right", true, 1300));
        assertEquals(0, policy.delay("right", true, 1500));
        policy.sent("right", 1500);
        assertEquals(0, policy.delay("end", false, 2200));
    }

    @Test public void reconnectOrPeerReadyCanImmediatelyRefreshTheSameSnapshot() {
        SendPolicy policy = new SendPolicy();
        policy.sent("navigation", 100);
        policy.reset();
        assertEquals(0, policy.delay("navigation", true, 101));
    }

    @Test public void notificationCallbacksCannotPostponeTheNextFreshHeartbeatRead() {
        SendPolicy policy = new SendPolicy();
        policy.sent("navigation", 1000);
        assertEquals(1000, policy.nextReadDelay(1000));
        assertEquals(1000, policy.nextReadDelay(6000));
        assertEquals(500, policy.nextReadDelay(9000));
    }

    @Test public void missedDistanceCallbackIsRecoveredWithinOneSecondWithoutAWakeRequest() {
        SendPolicy policy = new SendPolicy();
        long firstNewDistance = -1;
        for (long time = 0; time < 4000; time += policy.nextReadDelay(time)) {
            String distance = time < 550 ? "100 米" : "90 米";
            if (policy.delay(distance, true, time) == 0) {
                policy.sent(distance, time);
                if ("90 米".equals(distance) && firstNewDistance < 0) firstNewDistance = time;
            }
        }
        assertEquals(1000, firstNewDistance);
    }
}
