package io.github.mi9pro.navigation;
import org.json.*;
import java.nio.charset.StandardCharsets;
import org.junit.Test;
import static org.junit.Assert.*;
public class PeerPacketTest {
    private byte[] bytes(JSONObject p){return p.toString().getBytes(StandardCharsets.UTF_8);}
    @Test public void directAndSingleStringWrapperPreserveAckSessionAndSequence() throws Exception {
        var p=new JSONObject().put("v",1).put("type","ack").put("session","phone").put("seq",137);
        assertEquals(p.toString(),PeerPacket.decode(bytes(p)).toString());
        var decoded=PeerPacket.decode(bytes(new JSONObject().put("data",p.toString())));
        assertEquals("phone",decoded.getString("session"));assertEquals(137,decoded.getInt("seq"));
    }
    @Test public void refusesAmbiguousRecursiveNonStringAndOversizeEnvelopes() throws Exception {
        var p=new JSONObject().put("v",1);
        assertThrows(JSONException.class,()->PeerPacket.decode(bytes(new JSONObject().put("data",p.toString()).put("extra",1))));
        assertThrows(JSONException.class,()->PeerPacket.decode(bytes(new JSONObject().put("data",p))));
        assertThrows(JSONException.class,()->PeerPacket.decode(bytes(new JSONObject().put("data",new JSONObject().put("data",p.toString()).toString()))));
        assertThrows(JSONException.class,()->PeerPacket.decode(bytes(new JSONObject().put("v",1).put("text","汉".repeat(1400)))));
    }
    @Test public void protocolVersionOnOuterObjectRemainsAuthoritative() throws Exception {
        assertEquals(2,PeerPacket.decode(bytes(new JSONObject().put("v",2).put("data","{\"v\":1}"))).getInt("v"));
    }
}
