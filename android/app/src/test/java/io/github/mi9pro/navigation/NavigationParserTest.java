package io.github.mi9pro.navigation;

import org.junit.Test;
import static org.junit.Assert.*;

/** Synthetic edge cases plus a captured Xiaomi 15 / Gaode 16.22 navigation format. */
public class NavigationParserTest {
    private NavigationParser.Result parse(String text) {
        return NavigationParser.parse(NavigationParser.AMAP_PACKAGE, true, "高德地图", text);
    }
    @Test public void readsOnlyRoadAssociatedWithFirstTurnNotCurrentOrLaterRoads() {
        var result = parse("沿当前路行驶，前方200米右转进入下一路，再左转进入后续路");
        assertEquals("下一路", result.roadName);
        assertEquals("200 米", result.distance);
        assertEquals("right", result.maneuver);
        assertNull(parse("沿当前路行驶，前方200米右转").roadName);
        assertEquals("示例路辅路", parse("前方200米右转进入示例路辅路").roadName);
    }
    @Test public void extractsExplicitUnambiguousRoundaboutExitWithoutFabricatingAnAngle() {
        assertEquals(Integer.valueOf(3), parse("前方200米进入环岛，从第3出口驶出").exitNumber);
        assertEquals(Integer.valueOf(12), parse("前方200米进入环岛，从第十二个出口驶出").exitNumber);
        assertEquals(Integer.valueOf(3), parse("前方200米进入环岛，第３出口驶出").exitNumber);
        for (String text : new String[]{"前方200米进入环岛", "前方200米从第3出口进入环岛",
                "前方200米进入环岛，第3出口或者第4出口驶出", "前方200米进入环岛，第0出口驶出",
                "前方200米进入环岛，第100出口驶出", "前方200米右转，第3出口驶出"}) assertNull(text, parse(text).exitNumber);
    }
    @Test public void extractsTurnDistanceAndKeepsRawText() {
        var result = parse("前方200米后右转，进入示例路");
        assertEquals("right", result.maneuver);
        assertEquals("200 米", result.distance);
        assertTrue(result.rawText.contains("进入示例路"));
    }
    @Test public void acceptsDistanceWithoutOngoingFlag() {
        var result = NavigationParser.parse(NavigationParser.AMAP_PACKAGE, false, "500米后左转");
        assertEquals("left", result.maneuver);
    }
    @Test public void handlesDecimalKilometersAndUTurnBeforeLeft() {
        var result = parse("前方1.2公里掉头");
        assertEquals("uturn", result.maneuver);
        assertEquals("1.2 公里", result.distance);
    }
    @Test public void ignoresOtherAppsAndPromotions() {
        assertNull(NavigationParser.parse("com.example.chat", true, "200米后左转"));
        assertNull(NavigationParser.parse(NavigationParser.AMAP_PACKAGE, false, "开启导航享优惠"));
        assertNull(parse("领取打车优惠券"));
    }
    @Test public void doesNotUseTotalRemainingDistanceAsTurnDistance() {
        assertEquals("", parse("导航中，剩余3公里，右转进入示例路").distance);
        assertEquals("", parse("导航中，剩余3公里右转").distance);
        assertEquals("200 米", parse("导航中，剩余3公里，前方200米右转").distance);
    }
    @Test public void recognizesAutomotiveNavigationWithoutOngoingFlagOrTurnText() {
        for (String text : new String[] {
                "驾车导航中，剩余15分钟，剩余8.2公里，全程12.5公里",
                "汽车导航路线预计18分钟到达 · 还有6公里",
                "开车路线行驶中：距目的地4公里",
                "预计18分钟到达 · 剩余6公里"
        }) {
            var result = NavigationParser.parse(NavigationParser.AMAP_PACKAGE, false, text);
            assertNotNull(text, result);
            assertEquals(text, "active", result.status);
            assertEquals(text, "unknown", result.maneuver);
        }
        assertNull(NavigationParser.parse(NavigationParser.AMAP_PACKAGE, false, "汽车导航优惠券活动"));
    }
    @Test public void preservesUnknownNavigationInsteadOfGuessingStraight() {
        var result = parse("步行导航中，剩余15分钟，1.2公里");
        assertEquals("active", result.status);
        assertEquals("unknown", result.maneuver);
        assertEquals("", result.distance);
    }
    @Test public void arrivalIsOnlyWhenExplicitlyCompleted() {
        assertEquals("ended", parse("已到达目的地，导航结束").status);
        assertEquals("active", parse("步行导航，前方200米到达目的地").status);
    }
    @Test public void deduplicatesExtrasAndLimitsPayload() {
        var result = NavigationParser.parse(NavigationParser.AMAP_PACKAGE, true, "高德导航", "200米右转", "200米右转");
        assertEquals("高德导航\n200米右转", result.rawText);
        assertTrue(parse("导航中" + "示例道路".repeat(300)).rawText.length() <= 480);
    }
    @Test public void handlesMissingFields() {
        assertNull(NavigationParser.parse(NavigationParser.AMAP_PACKAGE, true, null, " "));
    }
    @Test public void parsesCapturedHyperOsWalkingNotificationWithoutOngoingFlag() {
        var result = NavigationParser.parse(NavigationParser.AMAP_PACKAGE, false, "直行152米", "高德导航中");
        assertNotNull(result);
        assertEquals("active", result.status);
        assertEquals("straight", result.maneuver);
        assertEquals("152 米", result.distance);
    }
    @Test public void distanceAfterInstructionDoesNotConsumeTripSummary() {
        assertEquals("", parse("直行，剩余152米").distance);
        assertEquals("", parse("直行\n152米后右转").distance);
        assertEquals("", parse("右转进入示例路，剩余152米").distance);
        assertEquals("1.2 公里", parse("直行1.2公里").distance);
    }
}
