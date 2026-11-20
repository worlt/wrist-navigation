package io.github.mi9pro.navigation;

import java.nio.charset.StandardCharsets;
import org.json.JSONException;
import org.json.JSONObject;

/** Parse the authenticated peer's bounded interconnect message. */
final class PeerPacket {
    static final int MAX_BYTES = 4096;
    static JSONObject decode(byte[] bytes) throws JSONException {
        if (bytes == null || bytes.length > MAX_BYTES) throw new JSONException("Invalid peer packet size");
        JSONObject outer = new JSONObject(new String(bytes, StandardCharsets.UTF_8));
        if (outer.has("v")) return outer;
        // Legacy Vela send({data: {data: JSON.stringify(frame)}}) transmits this object
        // verbatim. Accept exactly one unambiguous wrapper, never arbitrary recursive JSON.
        if (outer.length() != 1 || !(outer.opt("data") instanceof String))
            throw new JSONException("Unsupported peer envelope");
        String text = outer.getString("data");
        if (text.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES)
            throw new JSONException("Inner peer packet too large");
        JSONObject inner = new JSONObject(text);
        if (!inner.has("v")) throw new JSONException("Missing inner protocol version");
        return inner;
    }
}
