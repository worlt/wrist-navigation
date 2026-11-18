package io.github.mi9pro.navigation;

import java.util.List;
import org.junit.Test;
import static org.junit.Assert.*;

public class NotificationTextResolverTest {
    private final String[] generic = { "高德地图持续为您导航", "正在为您步行导航>>" };
    private NotificationTextResolver.Source source(String name, String... text) {
        return new NotificationTextResolver.Source(name, text, true);
    }
    private NotificationTextResolver.Selection resolve(NotificationTextResolver.Source... sources) {
        return NotificationTextResolver.resolve(NavigationParser.AMAP_PACKAGE, true, generic, List.of(sources));
    }
    @Test public void readsStraightDistanceFromCustomViewWhenStandardFieldsAreGeneric() {
        var selected = resolve(source("contentView", "沿示例路", "直行617米", "剩余1km，约17分钟"));
        assertEquals("straight", selected.result.maneuver);
        assertEquals("617 米", selected.result.distance);
        assertEquals("contentView", selected.source);
        assertFalse(selected.result.rawText.contains("正在为您"));
    }
    @Test public void preservesWorkingStandardTurnsAndExplicitEndWithoutReadingCustomViews() {
        for (String text : new String[] {"左转进入示例路", "右转进入示例路", "已到达目的地，导航结束"}) {
            var selected = NotificationTextResolver.resolve(NavigationParser.AMAP_PACKAGE, true,
                new String[]{text}, List.of(source("contentView", "直行617米")));
            assertEquals("标准通知字段", selected.source);
            assertEquals(text, selected.result.rawText);
            assertFalse(NotificationTextResolver.needsCustomView(NavigationParser.AMAP_PACKAGE, true, new String[]{text}));
        }
    }
    @Test public void genericOrMissingCustomTextNeverImpliesStraight() {
        assertEquals("unknown", resolve().result.maneuver);
        assertEquals("unknown", resolve(source("contentView", "剩余1km，约17分钟")).result.maneuver);
        assertEquals("unknown", resolve(source("contentView", "正在为您步行导航>>")).result.maneuver);
    }
    @Test public void doesNotReadOtherAppsOrNonOngoingPromotions() {
        assertFalse(NotificationTextResolver.needsCustomView("com.example.chat", true, generic));
        assertNull(NotificationTextResolver.resolve("com.example.chat", true, generic,
            List.of(source("contentView", "直行617米"))).result);
        var promotion = NotificationTextResolver.resolve(NavigationParser.AMAP_PACKAGE, false,
            new String[]{"开启导航享优惠"}, List.of(source("contentView", "直行617米")));
        assertNull(promotion.result);
    }
    @Test public void contradictoryViewsDoNotChooseAnOldLeftOverCurrentStraight() {
        var selected = resolve(source("contentView", "左转进入示例路"), source("bigContentView", "直行617米"));
        assertEquals("unknown", selected.result.maneuver);
        assertTrue(selected.note.contains("冲突"));
    }
    @Test public void conflictingDistancesOrRoadsAreNotCombined() {
        assertEquals("unknown", resolve(source("contentView", "直行617米"),
            source("bigContentView", "直行520米")).result.maneuver);
        assertEquals("unknown", resolve(source("contentView", "200米右转进入甲路"),
            source("bigContentView", "200米右转进入乙路")).result.maneuver);
    }
    @Test public void richerMiddleViewCannotHideAConflictWithTheFirstView() {
        var selected = resolve(source("contentView", "右转进入甲路"),
            source("bigContentView", "200米右转"), source("headsUpContentView", "200米右转进入乙路"));
        assertEquals("unknown", selected.result.maneuver);
        assertTrue(selected.note.contains("冲突"));
    }
    @Test public void matchingViewsCanSelectOneCompleteSourceWithDistance() {
        var selected = resolve(source("contentView", "直行"), source("bigContentView", "直行617米"));
        assertEquals("bigContentView", selected.source);
        assertEquals("617 米", selected.result.distance);
        assertEquals("直行617米", selected.result.rawText);
    }
    @Test public void incompleteViewCannotSupplyAnInstruction() {
        var selected = resolve(new NotificationTextResolver.Source("contentView", new String[]{"直行617米"}, false));
        assertEquals("unknown", selected.result.maneuver);
        assertTrue(selected.note.contains("截断"));
    }
    @Test public void remainingTripDistanceNeverBecomesInstructionDistance() {
        var selected = resolve(source("contentView", "直行，剩余1km，约17分钟"));
        assertEquals("straight", selected.result.maneuver);
        assertEquals("", selected.result.distance);
    }
    @Test public void customOnlyOngoingNotificationCanSupplyExplicitNavigation() {
        var selected = NotificationTextResolver.resolve(NavigationParser.AMAP_PACKAGE, true,
            new String[0], List.of(source("contentView", "直行617米")));
        assertEquals("straight", selected.result.maneuver);
    }
}
