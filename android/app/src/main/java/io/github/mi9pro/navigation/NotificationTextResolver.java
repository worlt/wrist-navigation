package io.github.mi9pro.navigation;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/** Keep each notification view separate: never concatenate an old turn with a new card. */
final class NotificationTextResolver {
    static final String STANDARD = "标准通知字段";
    static final class Source {
        final String name; final String[] fields; final boolean complete;
        Source(String name, String[] fields, boolean complete) {
            this.name = name; this.fields = fields.clone(); this.complete = complete;
        }
    }
    static final class Selection {
        final NavigationParser.Result result;
        final String source, note;
        final String[] fields;
        Selection(NavigationParser.Result result, String source, String[] fields, String note) {
            this.result = result; this.source = source; this.fields = fields.clone(); this.note = note;
        }
    }
    static boolean needsCustomView(String packageName, boolean ongoing, String[] standard) {
        if (!NavigationParser.AMAP_PACKAGE.equals(packageName)) return false;
        var result = NavigationParser.parse(packageName, ongoing, standard);
        return result == null ? ongoing : "active".equals(result.status) && "unknown".equals(result.maneuver);
    }
    static Selection resolve(String packageName, boolean ongoing, String[] standard, List<Source> sources) {
        var base = NavigationParser.parse(packageName, ongoing, standard);
        var fallback = new Selection(base, STANDARD, standard, "");
        if (!needsCustomView(packageName, ongoing, standard)) return fallback;
        Selection selected = null;
        List<NavigationParser.Result> accepted = new ArrayList<>();
        boolean incomplete = false;
        for (Source source : sources) {
            if (!source.complete) { incomplete = true; continue; }
            var result = NavigationParser.parse(packageName, ongoing, source.fields);
            if (result == null || !"active".equals(result.status) || "unknown".equals(result.maneuver)) continue;
            for (var previous : accepted) if (conflicts(previous, result))
                return new Selection(base, STANDARD, standard, "自定义视图的方向、距离或道路冲突，未用于补读");
            accepted.add(result);
            if (selected == null || (selected.result.distance.isEmpty() && !result.distance.isEmpty()))
                selected = new Selection(result, source.name, source.fields, "");
        }
        if (selected != null) return selected;
        return new Selection(base, STANDARD, standard, incomplete
            ? "自定义视图文字已截断，未用于补读" : "未从此通知读到明确的方向指令");
    }
    private static boolean conflicts(NavigationParser.Result first, NavigationParser.Result second) {
        return !first.maneuver.equals(second.maneuver)
            || (!first.distance.isEmpty() && !second.distance.isEmpty() && !first.distance.equals(second.distance))
            || (first.roadName != null && second.roadName != null && !Objects.equals(first.roadName, second.roadName));
    }
}
