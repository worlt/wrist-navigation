package io.github.mi9pro.navigation;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Explicit current-instruction metadata only; never reconstruct a road or exit direction. */
final class InstructionMetadata {
    private static final Pattern ROAD = Pattern.compile("(?:进入|驶入|转入|沿着|沿)\\s*([^，,。；;：:\\n]{1,40}?(?:大道|公路|街|路|巷|桥))(?=$|[\\s，,。；;、])");
    private static final Pattern EXIT = Pattern.compile("第\\s*([0-9零〇一二两三四五六七八九十百点.]+)\\s*(?:个\\s*)?出口");
    private static final Pattern ENTRANCE = Pattern.compile("^[ \\t，,]*(?:进入|驶入)环岛");
    private static final String DIGITS = "零一二三四五六七八九";

    private static int[] bounds(String text) {
        Matcher turn = NavigationParser.TURN.matcher(text);
        if (!turn.find()) return null;
        int start = turn.end();
        return new int[]{start, turn.find() ? turn.start() : text.length()};
    }

    static String roadName(String text) {
        int[] scope = bounds(text);
        if (scope == null) return null;
        Matcher road = ROAD.matcher(text).region(scope[0], scope[1]);
        return road.find() ? road.group(1).trim() : null;
    }

    static Integer exitNumber(String original) {
        StringBuilder normalized = new StringBuilder(original.length());
        for (int n = 0; n < original.length(); n++) {
            char c = original.charAt(n);
            normalized.append(c >= '０' && c <= '９' ? (char)(c - 0xfee0) : c);
        }
        String text = normalized.toString();
        int[] scope = bounds(text);
        if (scope == null) return null;
        Matcher exits = EXIT.matcher(text).region(scope[0], scope[1]);
        Integer result = null;
        while (exits.find()) {
            if (ENTRANCE.matcher(text.substring(exits.end())).find()) continue;
            Integer number = ordinal(exits.group(1));
            if (number == null || (result != null && !result.equals(number))) return null;
            result = number;
        }
        return result;
    }

    private static Integer ordinal(String token) {
        if (token.matches("[1-9]\\d?")) return Integer.valueOf(token);
        if (token.matches("[一二三四五六七八九]")) return DIGITS.indexOf(token);
        if (token.matches("(?:[一二三四五六七八九])?十[一二三四五六七八九]?")) {
            int split = token.indexOf('十');
            return (split == 0 ? 1 : DIGITS.indexOf(token.charAt(0))) * 10
                    + (split + 1 == token.length() ? 0 : DIGITS.indexOf(token.charAt(split + 1)));
        }
        return null;
    }
}
