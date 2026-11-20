package io.github.mi9pro.navigation;

import org.json.JSONArray;
import org.json.JSONObject;

/** Memory-only, allowlisted metadata. No route text, peer IDs or arbitrary native errors. */
final class CompatibilityDiagnostics {
    private static final String[] EVENTS = {"created","page-ready","link-init","link-open","link-close","link-error","ready-check","ready-missing","ready-fail","rx-reject","rx-accept","send-202","send-fail","storage-read","storage-write","vibrate","terminate","screen","query","disposed"};
    private static final String[] NAMES = {"","Error","TypeError","RangeError","SyntaxError","ReferenceError"};
    private static final String[] COUNTERS = {"rx","accepted","rejected","tx","txfail"};
    private String pending = "", status = "尚未读取手环内部诊断", report = "";
    private long deadline, receivedAt;
    private boolean currentReport;
    private long received, matched, decoded, rejected;
    private String rejection = "无";
    void reset() { pending=""; status="连接已重置，请重新读取"; report=""; deadline=receivedAt=0; currentReport=false; received=matched=decoded=rejected=0; rejection="无"; }
    boolean waiting(long now) { return !pending.isEmpty() && now < deadline; }
    void request(String id, long now) { pending=id; deadline=now+5000; status="正在读取手环内部诊断（最多5秒）"; currentReport=false; }
    void failed(String id) { if (pending.equals(id)) { pending=""; status="诊断查询发送失败；基础导航不受此查询影响"; } }
    void received(boolean samePeer) { received=Math.min(999999,received+1); if(samePeer)matched=Math.min(999999,matched+1); }
    void decoded() { decoded=Math.min(999999,decoded+1); }
    void rejected(String reason) { rejected=Math.min(999999,rejected+1); rejection=reason; }
    static boolean contains(String[] list, String value) { for(String item:list)if(item.equals(value))return true;return false; }
    static int integer(JSONObject p, String key, int low, int high) {
        Object value=p.opt(key); if(!(value instanceof Number))throw new IllegalArgumentException();
        double number=((Number)value).doubleValue(); if(number<low || number>high || Math.floor(number)!=number)throw new IllegalArgumentException();return (int)number;
    }
    boolean accept(JSONObject p, long now) {
        if(pending.isEmpty() || now>=deadline || !pending.equals(p.optString("requestId")))return false;
        try {
            if(integer(p,"v",1,1)!=1 || !"band-diagnostics".equals(p.optString("type")) || integer(p,"schema",1,1)!=1)return false;
            JSONObject version=p.getJSONObject("appVersion");
            if(!"io.github.mi9pro.navigation".equals(version.getString("applicationId")))return false;
            String name=version.getString("versionName");if(name.length()>64 || !name.matches("[0-9]+\\.[0-9]+\\.[0-9]+(?:-[A-Za-z0-9.-]+)?"))return false;
            int code=integer(version,"versionCode",1,Integer.MAX_VALUE);
            if(!(p.opt("connected") instanceof Boolean))return false;
            int shape=integer(p,"sendShape",0,1);
            JSONObject counts=p.getJSONObject("counters");JSONArray events=p.getJSONArray("events");if(events.length()>16)return false;
            StringBuilder text=new StringBuilder("手环 ").append(name).append(" / code ").append(code)
              .append("\n手环连接标记：").append(p.getBoolean("connected")?"已连接":"未连接")
              .append("；发送封包：").append(shape==0?"字符串":"单层嵌套").append("\n计数：");
            for(String key:COUNTERS)text.append(key).append('=').append(integer(counts,key,0,999999)).append(' ');
            text.append("\n最近16条阶段（秒为本次进程启动后时间）：");
            for(int i=0;i<events.length();i++) {
                JSONObject event=events.getJSONObject(i);String id=event.getString("id"),error=event.getString("name");
                if(!contains(EVENTS,id)||!contains(NAMES,error))return false;
                text.append("\n").append(integer(event,"at",0,999999)).append("s ").append(id).append(' ').append(error).append(" #").append(integer(event,"code",-999999,999999));
            }
            report=text.toString();receivedAt=now;currentReport=true;pending="";status="已收到本次手环诊断（非真机屏幕验收）";return true;
        }catch(Exception ignored){return false;}
    }
    String text(long now) {
        if(!pending.isEmpty() && now>=deadline){pending="";status="读取超时：手环未运行、未连接、旧版不支持或回程失败；不能据此认定原因";}
        return status+"\n手机接收计数：收到 "+received+" / 当前设备 "+matched+" / 已解包 "+decoded+" / 拒收 "+rejected
          +"\n最近拒收分类："+rejection
          +(report.isEmpty()?"": "\n\n"+(currentReport?"本次读取":"历史读取（不是本次结果）")+" · "+Math.max(0,(now-receivedAt)/1000)+"秒前\n"+report);
    }
}
