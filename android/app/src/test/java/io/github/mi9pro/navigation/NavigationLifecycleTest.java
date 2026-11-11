package io.github.mi9pro.navigation;

import org.junit.Test;
import static org.junit.Assert.*;

public class NavigationLifecycleTest {
    @Test public void idleAtStartupAndStandaloneEndedHaveNoJourney() {
        NavigationLifecycle state = new NavigationLifecycle();
        state.update("idle", 0); state.update("ended", 5000);
        assertNull(state.id()); assertFalse(state.ended());
    }
    @Test public void explicitEndKeepsIdentityAndNextNavigationChangesIt() {
        NavigationLifecycle state = new NavigationLifecycle(); state.update("active", 0);
        String id = state.id(); state.update("active", 1000); assertEquals(id, state.id());
        state.update("ended", 2000); assertTrue(state.ended()); assertEquals(id, state.id());
        state.update("idle", 3000); assertTrue(state.ended());
        state.update("active", 4000); assertNotEquals(id, state.id()); assertFalse(state.ended());
    }
    @Test public void transientMissingNotificationDoesNotEndOrRestartJourney() {
        NavigationLifecycle state = new NavigationLifecycle(); state.update("active", 0);
        String id = state.id(); state.update("idle", 1000); state.update("idle", 5999);
        assertFalse(state.ended()); state.update("active", 6000); assertEquals(id, state.id());
        state.update("idle", 7000); state.update("idle", 12000); assertTrue(state.ended());
    }
    @Test public void pauseAndPermissionLossResetPendingEndConfirmation() {
        for (String status : new String[]{"paused", "unavailable", "demo"}) {
            NavigationLifecycle state = new NavigationLifecycle(); state.update("active", 0);
            String id = state.id(); state.update("idle", 1000); state.update(status, 6000);
            assertFalse(state.ended()); state.update("idle", 7000); assertFalse(state.ended());
            state.update("active", 8000); assertEquals(id, state.id());
        }
    }
    @Test public void onlyFreshEnabledActiveOrConfirmedEndPermitsVibration() {
        NavigationLifecycle state = new NavigationLifecycle(); state.update("active", 0);
        assertTrue(state.allowsVibration(true,true,true,"active",0));
        assertFalse(state.allowsVibration(true,true,true,"idle",0));
        state.update("ended", 1000);
        for (String status : new String[]{"ended", "idle"}) {
            assertTrue(state.allowsVibration(true,true,true,status,19999));
            assertFalse(state.allowsVibration(false,true,true,status,0));
            assertFalse(state.allowsVibration(true,false,true,status,0));
            assertFalse(state.allowsVibration(true,true,false,status,0));
            assertFalse(state.allowsVibration(true,true,true,status,20000));
            assertFalse(state.allowsVibration(true,true,true,status,-1));
        }
        for (String status : new String[]{"demo", "paused", "unavailable"})
            assertFalse(state.allowsVibration(true,true,true,status,0));
    }
}
