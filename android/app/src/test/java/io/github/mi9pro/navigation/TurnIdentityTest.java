package io.github.mi9pro.navigation;
import org.junit.Test;
import static org.junit.Assert.*;

public class TurnIdentityTest {
    private NavigationParser.Result turn(String maneuver, String instruction, String distance) {
        return new NavigationParser.Result("active", "高德地图", "原文", maneuver, instruction, distance);
    }
    private NavigationParser.Result parsed(String text) {
        return NavigationParser.parse("com.autonavi.minimap", true, "高德导航", text);
    }
    @Test public void roadAndExitChangesDistinguishSameDirectionAtNearbyJunctions() {
        TurnIdentity policy = new TurnIdentity();
        policy.update(parsed("前方30米右转进入示例路")); String id = policy.actionId();
        policy.update(parsed("前方50米右转进入下一路")); assertNotEquals(id, policy.actionId());
        policy.update(parsed("前方30米进入环岛，第3出口驶出")); id = policy.actionId();
        policy.update(parsed("前方50米进入环岛，第4出口驶出")); assertNotEquals(id, policy.actionId());
    }
    @Test public void missingAndLateMetadataDoNotGenerateDuplicateTurns() {
        TurnIdentity policy = new TurnIdentity();
        policy.update(parsed("前方200米右转")); String id = policy.actionId();
        for (String text : new String[]{"前方100米右转进入示例路", "前方90米右转", "前方80米右转进入示例路"}) {
            policy.update(parsed(text)); assertEquals(id, policy.actionId());
        }
        policy.update(parsed("前方200米进入环岛")); id = policy.actionId();
        for (String text : new String[]{"前方100米进入环岛，第3出口驶出", "前方90米进入环岛", "前方80米进入环岛，第3出口驶出"}) {
            policy.update(parsed(text)); assertEquals(id, policy.actionId());
        }
    }
    @Test public void decreasingDistanceAndHeartbeatKeepIdentity() {
        TurnIdentity policy = new TurnIdentity();
        policy.update(turn("right", "右转", "200 米"));
        String id = policy.actionId();
        assertNotNull(id);
        for (String distance : new String[]{"180 米", "30 米", "30 米", ""}) {
            policy.update(turn("right", "右转", distance)); assertEquals(id, policy.actionId());
        }
    }
    @Test public void newDirectionAndConsecutiveSameDirectionAfterReboundGetNewIds() {
        TurnIdentity policy = new TurnIdentity();
        policy.update(turn("right", "右转", "200 米")); String first = policy.actionId();
        policy.update(turn("left", "左转", "200 米")); String second = policy.actionId();
        assertNotEquals(first, second);
        policy.update(turn("left", "左转", "30 米"));
        policy.update(turn("left", "左转", ""));
        policy.update(turn("left", "左转", "250 米"));
        assertNotEquals(second, policy.actionId());
    }
    @Test public void smallDistanceJitterDoesNotCreateANewTurn() {
        TurnIdentity policy = new TurnIdentity();
        policy.update(turn("right", "右转", "30 米")); String id = policy.actionId();
        for (String distance : new String[]{"60 米", "40 米", "100 米"}) {
            policy.update(turn("right", "右转", distance)); assertEquals(id, policy.actionId());
        }
    }
    @Test public void terminalAndPauseResetCurrentIdButNeverReuseAnId() {
        for (String status : new String[]{"idle", "ended", "paused", "unavailable"}) {
            TurnIdentity policy = new TurnIdentity();
            policy.update(turn("right", "右转", "200 米")); String id = policy.actionId();
            policy.update(new NavigationParser.Result(status, "", "", "unknown", "", ""));
            assertNull(policy.actionId());
            policy.update(turn("right", "右转", "200 米")); assertNotEquals(id, policy.actionId());
            id = policy.actionId(); policy.reset();
            policy.update(turn("right", "右转", "200 米")); assertNotEquals(id, policy.actionId());
        }
    }
    @Test public void changedInstructionAndUnknownTransitionAreNotMerged() {
        TurnIdentity policy = new TurnIdentity();
        policy.update(turn("roundabout", "进入环岛", "100 米")); String id = policy.actionId();
        policy.update(turn("roundabout", "驶出环岛", "80 米")); assertNotEquals(id, policy.actionId());
        policy.update(turn("unknown", "请查看原文", "")); assertNull(policy.actionId());
        policy.update(turn("right", "右转", "200 米")); assertNotNull(policy.actionId());
    }
    @Test public void actualParserOutputsPreserveDirectionDistanceAndIgnoreTripRemainder() {
        TurnIdentity policy = new TurnIdentity();
        NavigationParser.Result result = NavigationParser.parse("com.autonavi.minimap", true, "高德导航", "前方200米右转");
        assertNotNull(result); policy.update(result); String id = policy.actionId();
        result = NavigationParser.parse("com.autonavi.minimap", true, "高德导航", "前方30米右转");
        policy.update(result); assertEquals(id, policy.actionId());
        assertEquals(30.0, TurnIdentity.distanceMeters(result.distance), 0.00001);
        result = NavigationParser.parse("com.autonavi.minimap", true, "高德导航", "右转，剩余3公里");
        policy.update(result); assertEquals(id, policy.actionId());
        assertNull(TurnIdentity.distanceMeters(result.distance));
    }
    @Test public void distancesOnlyAcceptStandaloneNonnegativeMetricValues() {
        assertEquals(30.0, TurnIdentity.distanceMeters("0.03 公里"), 0.00001);
        assertEquals(100.0, TurnIdentity.distanceMeters("0.1 KM"), 0.00001);
        assertEquals(0.0, TurnIdentity.distanceMeters("0 米"), 0.00001);
        for (String value : new String[]{"", "剩余30米", "-1m", "NaN m", "1e2 m", "30", "30 mi", "9".repeat(400)+"m"}) assertNull(TurnIdentity.distanceMeters(value));
    }
}
