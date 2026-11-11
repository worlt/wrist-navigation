package io.github.mi9pro.navigation;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Notification-derived identity, not a route engine or a guaranteed road junction ID. */
public final class TurnIdentity {
    private static final List<String> MANEUVERS = Arrays.asList("left", "right", "straight",
            "slight_left", "slight_right", "sharp_left", "sharp_right", "uturn", "roundabout");
    private static final Pattern DISTANCE = Pattern.compile(
            "^\\s*(\\d+(?:\\.\\d+)?)\\s*(公里|千米|米|km|m)\\s*$", Pattern.CASE_INSENSITIVE);
    private String previousKey;
    private Double nearestDistance;
    private long counter;
    private String id;
    private String roadName;
    private Integer exitNumber;

    public void update(NavigationParser.Result result) {
        if (result == null || !"active".equals(result.status) || !MANEUVERS.contains(result.maneuver)) {
            reset();
            return;
        }
        String key = result.maneuver + "\n" + result.instruction;
        Double distance = distanceMeters(result.distance);
        boolean rebound = nearestDistance != null && distance != null
                && nearestDistance <= 100 && distance > nearestDistance + 100;
        boolean metadataChanged = result.roadName != null && roadName != null && !result.roadName.equals(roadName)
                || result.exitNumber != null && exitNumber != null && !result.exitNumber.equals(exitNumber);
        if (!key.equals(previousKey) || rebound || metadataChanged) {
            id = "turn-" + (++counter);
            nearestDistance = distance;
            roadName = result.roadName;
            exitNumber = result.exitNumber;
        } else if (distance != null && (nearestDistance == null || distance < nearestDistance)) {
            nearestDistance = distance;
        }
        // Missing/late metadata fills gaps, but never creates a new ID by itself.
        if (result.roadName != null) roadName = result.roadName;
        if (result.exitNumber != null) exitNumber = result.exitNumber;
        previousKey = key;
    }

    public String actionId() { return id; }

    /** Do not reset the counter: IDs must not be reused in the same phone process/session. */
    public void reset() { previousKey = null; nearestDistance = null; id = null; roadName = null; exitNumber = null; }

    public static Double distanceMeters(String text) {
        if (text == null) return null;
        Matcher match = DISTANCE.matcher(text);
        if (!match.matches()) return null;
        try {
            double distance = Double.parseDouble(match.group(1));
            String unit = match.group(2).toLowerCase(Locale.ROOT);
            if ("公里".equals(unit) || "千米".equals(unit) || "km".equals(unit)) distance *= 1000;
            return Double.isFinite(distance) && distance >= 0 ? distance : null;
        } catch (NumberFormatException error) { return null; }
    }
}
