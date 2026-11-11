package io.github.mi9pro.navigation;

import org.junit.Test;
import static org.junit.Assert.*;

public class PhoneAppLinkPolicyTest {
    @Test public void defaultsDoNotLaunchOrExit() {
        PhoneAppLinkPolicy p = new PhoneAppLinkPolicy(false, false);
        p.setForeground(true, 0); assertEquals(0, p.claimLaunch(0));
        p.setForeground(false, 1); assertEquals(0, p.exitId(1));
        assertFalse(p.blocksNavigationLaunch());
    }
    @Test public void eachVisibleEntryOpensOnlyOnce() {
        PhoneAppLinkPolicy p = new PhoneAppLinkPolicy(true, false);
        p.setForeground(true, 0); long id = p.claimLaunch(0); assertTrue(id > 0);
        p.setForeground(true, 1); assertEquals(0, p.claimLaunch(1));
        assertTrue(p.completeLaunch(id, true, 2)); assertEquals(0, p.claimLaunch(9000));
        p.setForeground(false, 10000); p.setForeground(true, 10001);
        assertTrue(p.claimLaunch(10001) > id);
    }
    @Test public void retriesAreBoundedAndDelayed() {
        PhoneAppLinkPolicy p = new PhoneAppLinkPolicy(true, false); p.setForeground(true, 0);
        for (int i = 0; i < 3; i++) {
            long now = i * 5000L, id = p.claimLaunch(now); assertTrue(id > 0);
            assertTrue(p.completeLaunch(id, false, now)); assertEquals(0, p.claimLaunch(now + 4999));
        }
        assertEquals(0, p.claimLaunch(999999));
    }
    @Test public void exitInvalidatesOpenCallbackAndBlocksBackgroundNavigationLaunch() {
        PhoneAppLinkPolicy p = new PhoneAppLinkPolicy(true, true); p.setForeground(true, 0);
        long open = p.claimLaunch(0); p.setForeground(false, 1);
        assertFalse(p.completeLaunch(open, true, 2)); assertEquals(0, p.claimLaunch(10000));
        long exit = p.exitId(2); assertTrue(exit > 0); assertTrue(p.blocksNavigationLaunch());
        p.ackExit(exit); assertEquals(0, p.exitId(3)); assertTrue(p.blocksNavigationLaunch());
    }
    @Test public void reentryCancelsUnsentExitAndStaleAck() {
        PhoneAppLinkPolicy p = new PhoneAppLinkPolicy(true, true); p.setForeground(true, 0);
        p.setForeground(false, 1); long old = p.exitId(1); p.setForeground(true, 2);
        assertEquals(0, p.exitId(2)); assertFalse(p.blocksNavigationLaunch());
        p.setForeground(false, 3); long next = p.exitId(3); p.ackExit(old);
        assertEquals(next, p.exitId(4));
    }
    @Test public void switchesAreIndependentAndDoNotCloseRetroactively() {
        PhoneAppLinkPolicy p = new PhoneAppLinkPolicy(false, true);
        p.setForeground(true, 0); assertEquals(0, p.claimLaunch(0));
        p.setForeground(false, 1); assertTrue(p.exitId(1) > 0);
        p.setCloseEnabled(false); assertEquals(0, p.exitId(1)); assertFalse(p.blocksNavigationLaunch());
        p.setCloseEnabled(true); assertEquals(0, p.exitId(2));
        p.setForeground(true, 3); p.setOpenEnabled(true); assertTrue(p.claimLaunch(3) > 0);
        p.setOpenEnabled(false); assertEquals(0, p.claimLaunch(9999));
    }
    @Test public void closeExpiresAndDoesNotRepeatOnManualBandReopen() {
        PhoneAppLinkPolicy p = new PhoneAppLinkPolicy(false, true);
        assertFalse(p.blocksNavigationLaunch());
        p.setForeground(true, 0); p.setForeground(false, 1);
        assertTrue(p.exitId(10000) > 0); assertEquals(0, p.exitId(10001));
        p.setForeground(false, 10002); assertEquals(0, p.exitId(10002));
    }
    @Test public void disconnectInvalidatesPendingOpenButKeepsBackoff() {
        PhoneAppLinkPolicy p = new PhoneAppLinkPolicy(true, false); p.setForeground(true, 0);
        long old = p.claimLaunch(0); p.disconnected(1);
        assertFalse(p.completeLaunch(old, true, 2)); assertEquals(0, p.claimLaunch(5000));
        assertTrue(p.claimLaunch(5001) > old);
    }
    @Test public void enablingExitDoesNotInvalidateAnInflightOpen() {
        PhoneAppLinkPolicy p = new PhoneAppLinkPolicy(true, false); p.setForeground(true, 0);
        long id = p.claimLaunch(0); p.setCloseEnabled(true); assertTrue(p.completeLaunch(id, true, 1));
    }
    @Test public void lastInflightAttemptStillOwnsTheLaunchSlot() {
        PhoneAppLinkPolicy p = new PhoneAppLinkPolicy(true, false); p.setForeground(true, 0);
        for (int i = 0; i < 2; i++) p.completeLaunch(p.claimLaunch(i * 5000), false, i * 5000);
        long third = p.claimLaunch(10000); assertTrue(p.launchExpected());
        p.completeLaunch(third, false, 10000); assertFalse(p.launchExpected());
    }
    @Test public void onlyRealVisibleExitCountsNotLockConfigurationOrPermissionSettings() {
        assertTrue(PhoneAppLinkPolicy.shouldExit(false, false, false, true, false));
        assertTrue(PhoneAppLinkPolicy.shouldExit(true, false, true, false, true));
        assertFalse(PhoneAppLinkPolicy.shouldExit(false, true, false, true, false));
        assertFalse(PhoneAppLinkPolicy.shouldExit(false, false, true, true, false));
        assertFalse(PhoneAppLinkPolicy.shouldExit(false, false, false, false, false));
        assertFalse(PhoneAppLinkPolicy.shouldExit(false, false, false, true, true));
    }
    @Test public void staleNativeOpenSuccessReassertsExitAfterTheFirstExitWasAcknowledged() {
        PhoneAppLinkPolicy p = new PhoneAppLinkPolicy(true, true); p.setForeground(true, 0);
        long old = p.claimLaunch(0); p.setForeground(false, 1); long exit = p.exitId(1); p.ackExit(exit);
        assertFalse(p.completeLaunch(old, true, 1000)); p.reassertExit(1000);
        assertTrue(p.exitId(1000) > exit); assertEquals(0, p.exitId(11000));
    }
    @Test public void lateNativeSuccessNeverClosesANewForegroundOrDisabledLink() {
        PhoneAppLinkPolicy p = new PhoneAppLinkPolicy(true, true); p.setForeground(true, 0);
        p.setForeground(false, 1); p.setForeground(true, 2); p.reassertExit(3);
        assertEquals(0, p.exitId(3)); p.setForeground(false, 4); p.setCloseEnabled(false); p.reassertExit(5);
        assertEquals(0, p.exitId(5));
    }
}
