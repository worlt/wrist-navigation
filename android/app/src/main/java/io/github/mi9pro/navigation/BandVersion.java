package io.github.mi9pro.navigation;
import org.json.JSONObject;
/** Current connected peer only: no persistent guessed installed version. */
final class BandVersion {
    private int code;
    private String name = "", pending;
    int code() { return code; }
    String name() { return name; }
    void clear() { code = 0; name = ""; pending = null; }
    void request(String id) { pending = id; }
    boolean accept(JSONObject packet) {
        try {
            if (packet.getInt("v") != 1) return false;
            boolean ready = "ready".equals(packet.optString("type"));
            if (!ready && (!"app-version".equals(packet.optString("type")) || pending == null
                || !pending.equals(packet.optString("requestId")))) return false;
            if (ready && !packet.has("appVersion")) { clear(); return true; }
            JSONObject value = packet.getJSONObject("appVersion");
            Object raw = value.get("versionCode");
            if (!(raw instanceof Number)) return false;
            double number = ((Number)raw).doubleValue();
            String version = value.getString("versionName");
            if (!"io.github.mi9pro.navigation".equals(value.getString("applicationId")) || number < 1 || number > Integer.MAX_VALUE
                || number != Math.floor(number) || version.length() > 64
                || !version.matches("[0-9]+\\.[0-9]+\\.[0-9]+(?:-[A-Za-z0-9.-]+)?")) return false;
            code = (int)number; name = version; pending = null; return true;
        } catch (Exception ignored) { return false; }
    }
}
