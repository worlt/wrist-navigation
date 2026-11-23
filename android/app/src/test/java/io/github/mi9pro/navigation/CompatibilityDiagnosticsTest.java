package io.github.mi9pro.navigation;
import org.json.*;
import org.junit.Test;
import static org.junit.Assert.*;
public class CompatibilityDiagnosticsTest {
    private JSONObject report(String id) throws Exception {
        return new JSONObject().put("v",1).put("type","band-diagnostics").put("requestId",id).put("schema",1)
          .put("appVersion",new JSONObject().put("applicationId","io.github.mi9pro.navigation").put("versionName","0.5.0").put("versionCode",24))
          .put("connected",true).put("sendShape",1).put("counters",new JSONObject().put("rx",3).put("accepted",1).put("rejected",2).put("tx",4).put("txfail",1))
          .put("events",new JSONArray().put(new JSONObject().put("id","send-202").put("at",1).put("code",202).put("name","TypeError")));
    }
    @Test public void readsOnlyRequestedMatchingTimelyBoundedMetadata() throws Exception {
        var state=new CompatibilityDiagnostics();assertFalse(state.accept(report("q-1"),100));state.request("q-1",100);
        assertFalse(state.accept(report("other"),101));assertTrue(state.accept(report("q-1"),102));
        assertTrue(state.text(102).contains("0.5.0 / code 24"));assertTrue(state.text(102).contains("send-202"));
        assertFalse(state.accept(report("q-1"),103));
    }
    @Test public void staleAndResetQueriesCannotAcceptLateReports() throws Exception {
        var state=new CompatibilityDiagnostics();state.request("q-1",100);assertFalse(state.accept(report("q-1"),6100));
        assertTrue(state.text(6100).contains("超时"));state.request("q-2",7000);state.reset();assertFalse(state.accept(report("q-2"),7001));
    }
    @Test public void malformedReportsAndUntrustedFieldsCannotLeakThroughText() throws Exception {
        var state=new CompatibilityDiagnostics();state.request("q-1",100);var p=report("q-1");p.getJSONArray("events").getJSONObject(0).put("id","secret route");assertFalse(state.accept(p,101));
        p=report("q-1");p.getJSONObject("appVersion").put("applicationId","other");assertFalse(state.accept(p,101));
        p=report("q-1");p.getJSONObject("counters").put("rx",-1);assertFalse(state.accept(p,101));
        p=report("q-1");p.getJSONObject("counters").put("rx","3");assertFalse(state.accept(p,101));
        p=report("q-1");for(int i=0;i<17;i++)p.getJSONArray("events").put(p.getJSONArray("events").getJSONObject(0));assertFalse(state.accept(p,101));
        p=report("q-1");p.put("rawText","secret route");assertTrue(state.accept(p,101));assertFalse(state.text(101).contains("secret route"));
    }
    @Test public void failuresDoNotDiscardHistoricalReportOrImplyNewSuccess() throws Exception {
        var state=new CompatibilityDiagnostics();state.request("q-1",100);assertTrue(state.accept(report("q-1"),101));state.request("q-2",200);
        assertTrue(state.text(200).contains("历史"));state.failed("q-2");assertTrue(state.text(201).contains("发送失败"));assertTrue(state.text(201).contains("历史"));
    }
    @Test public void reconnectKeepsReceiveEvidenceAndMarksOldReportHistorical() throws Exception {
        var state=new CompatibilityDiagnostics();state.request("q-1",100);assertTrue(state.accept(report("q-1"),101));
        state.received(true);state.decoded();state.received(false);state.rejected("非当前设备");
        state.request("q-2",200);state.reset();
        assertFalse(state.accept(report("q-2"),201));
        String text=state.text(202);
        assertTrue(text.contains("收到 2 / 匹配设备 1 / 已解包 1 / 拒收 1"));
        assertTrue(text.contains("非当前设备"));assertTrue(text.contains("历史读取"));
        state.connected();assertTrue(state.text(203).contains("当前连接尚未读取"));
        assertTrue(state.text(203).contains("收到 2"));
    }
}
