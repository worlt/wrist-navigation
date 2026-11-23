package io.github.mi9pro.navigation;

import java.nio.file.*;
import org.json.*;

/** Offline check of wire bytes produced by the actual compiled RPK smoke test. */
public final class VerifyCompatibilityWire {
    public static void main(String[] args) throws Exception {
        JSONObject root = new JSONObject(Files.readString(Path.of(args[0])));
        for (String profile : new String[]{"normal", "nested", "nested-code", "nested-throw", "nested-async"}) {
            JSONArray wires=root.getJSONArray(profile);boolean ack=false,version=false,diagnostic=false;
            for(int i=0;i<wires.length();i++) {
                byte[] bytes=wires.getString(i).getBytes(java.nio.charset.StandardCharsets.UTF_8);
                JSONObject p=PeerPacket.decode(bytes);
                if(p.getInt("v")!=1)throw new AssertionError("protocol");
                switch(p.getString("type")) {
                    case "ack": if(!"realtime-package".equals(p.getString("session")) || p.getInt("seq")!=1)throw new AssertionError("ACK changed");ack=true;break;
                    case "app-version": if(!args[1].equals(p.getJSONObject("appVersion").getString("versionName")) || p.getJSONObject("appVersion").getInt("versionCode")!=Integer.parseInt(args[2]))throw new AssertionError("version mismatch");version=true;break;
                    case "band-diagnostics":
                        var state=new CompatibilityDiagnostics();state.request("compiled-diag-"+profile,1000);
                        if(!state.accept(p,1001))throw new AssertionError("actual native report rejected");
                        if(!state.text(1001).contains(args[1]+" / code "+args[2]))throw new AssertionError("report version");
                        diagnostic=true;break;
                    default:break;
                }
            }
            if(!ack || !version || !diagnostic)throw new AssertionError("missing frame type");
        }
        System.out.println("Actual compiled native-wire -> JVM decode/diagnostics passed: "+Path.of(args[0]).getFileName());
    }
}
