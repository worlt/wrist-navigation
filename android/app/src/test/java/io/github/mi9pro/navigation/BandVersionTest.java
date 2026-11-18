package io.github.mi9pro.navigation;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;
public class BandVersionTest {
    private JSONObject packet(int code) throws Exception {
        return new JSONObject().put("v", 1).put("type", "ready").put("appVersion", new JSONObject()
            .put("applicationId", "io.github.mi9pro.navigation").put("versionName", "0.4.8").put("versionCode", code));
    }
    @Test public void acceptsReadyFromCurrentConnectionAndClearsOnDisconnect() throws Exception {
        var state = new BandVersion(); assertEquals(0, state.code());
        assertTrue(state.accept(packet(22))); assertEquals(22, state.code()); assertEquals("0.4.8", state.name());
        state.clear(); assertEquals(0, state.code());
    }
    @Test public void queryResponseMustMatchCurrentRequestAndIsConsumedOnce() throws Exception {
        var state = new BandVersion(); state.request("query-1");
        var response = packet(22).put("type", "app-version").put("requestId", "old");
        assertFalse(state.accept(response)); assertEquals(0, state.code());
        response.put("requestId", "query-1"); assertTrue(state.accept(response));
        assertFalse(state.accept(response));
    }
    @Test public void oldReadyClearsKnownVersionInsteadOfInventingOrKeepingPreviousApp() throws Exception {
        var state = new BandVersion(); state.accept(packet(22));
        assertTrue(state.accept(new JSONObject().put("v", 1).put("type", "ready"))); assertEquals(0, state.code());
    }
    @Test public void rejectsInvalidMetadataWithoutBreakingNavigation() throws Exception {
        for (Object code : new Object[]{0, -1, 22.5, "22", 2147483648L}) {
            var state = new BandVersion(); var json = packet(22); json.getJSONObject("appVersion").put("versionCode", code);
            assertFalse(state.accept(json)); assertEquals(0, state.code());
        }
        var state = new BandVersion(); var json = packet(22); json.getJSONObject("appVersion").put("applicationId", "other");
        assertFalse(state.accept(json));
    }
}
