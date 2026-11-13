package io.github.mi9pro.navigation;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Bounded, in-memory evidence. SDK completion and peer ACK are independent facts. */
final class NavigationDiagnostics {
    private String raw = "", readError = "", sendStatus = "尚未发送";
    private long readAt, goodReadAt, sentAt, sequence, ackSequence, ackAt;
    private NavigationParser.Result parsed, outgoing;

    void read(String text, long now) {
        raw = bound(text, 6144); readAt = goodReadAt = now; readError = "";
    }
    void readFailed(String reason, long now) {
        readAt = now; readError = bound(reason, 200); parsed = null;
    }
    void parsed(NavigationParser.Result result) { parsed = result; }
    void sending(long seq, NavigationParser.Result result, long now) {
        sequence = seq; outgoing = result; sentAt = now; sendStatus = "正在发送";
    }
    void sent(long seq) { if (seq == sequence && "正在发送".equals(sendStatus)) sendStatus = "SDK发送成功"; }
    void failed(long seq, String reason) { if (seq == sequence) sendStatus = bound(reason, 200); }
    void ack(long seq, long now) {
        if (seq != sequence) return;
        ackSequence = seq; ackAt = now;
    }
    private boolean changed() {
        return parsed != null && outgoing != null && !parsed.fingerprint().equals(outgoing.fingerprint());
    }
    String readText() {
        if (readAt == 0) return "尚未读取高德通知";
        if (!readError.isEmpty()) return "读取失败 · " + time(readAt) + "\n" + readError
            + (goodReadAt == 0 ? "" : "\n上次成功读取 · " + time(goodReadAt) + "（历史内容）\n" + raw);
        return "读取时间 · " + time(readAt) + "\n" + (raw.isEmpty() ? "没有可读取的高德通知文字" : raw);
    }
    String parseText() {
        if (!readError.isEmpty()) return "读取不可用，当前解析无效";
        if (parsed == null) return "未识别到导航指引";
        return "状态：" + status(parsed.status) + "\n方向：" + direction(parsed.maneuver)
            + "\n指令：" + parsed.instruction + "\n距离：" + (parsed.distance.isEmpty() ? "未提取" : parsed.distance)
            + "\n解析原文：\n" + parsed.rawText;
    }
    String sendText() {
        if (sequence == 0) return "尚未发送";
        return (changed() ? "等待发送新内容\n" : "") + "消息 #" + sequence + " · " + time(sentAt)
            + "\n" + sendStatus + "\n已提交内容：" + status(outgoing.status) + " · " + outgoing.instruction
            + " · " + (outgoing.distance.isEmpty() ? "无指引距离" : outgoing.distance);
    }
    String ackText() {
        if (sequence == 0) return "尚未发送，暂无手环确认";
        String current = !readError.isEmpty() ? "当前读取不可用，以下仅为历史发送确认"
            : parsed == null ? "当前未识别导航，以下仅为历史发送确认"
            : changed() ? "当前内容尚未发送" : ackSequence == sequence
            ? "当前内容已确认 · 消息 #" + sequence + " · " + time(ackAt)
            : "未收到消息 #" + sequence + " 的手环确认";
        if (ackSequence != 0 && (!readError.isEmpty() || parsed == null || changed() || ackSequence != sequence))
            current += "\n上次确认：#" + ackSequence + " · " + time(ackAt) + "（历史消息）";
        return current + "\n确认表示手环应用收到消息，不代表画面已显示";
    }
    static String time(long value) { return new SimpleDateFormat("HH:mm:ss", Locale.ROOT).format(new Date(value)); }
    private static String bound(String text, int limit) {
        if (text == null) return "";
        return text.length() <= limit ? text : NavigationParser.clip(text, limit) + "\n（内容已截断）";
    }
    private static String status(String value) {
        switch (value) {
            case "active": return "导航中";
            case "ended": return "导航结束";
            case "paused": return "同步暂停";
            case "idle": return "等待导航";
            case "unavailable": return "读取不可用";
            default: return value;
        }
    }
    private static String direction(String value) {
        switch (value) {
            case "left": return "左转";
            case "right": return "右转";
            case "straight": return "直行";
            case "slight_left": return "左前方 / 靠左";
            case "slight_right": return "右前方 / 靠右";
            case "sharp_left": return "左后方";
            case "sharp_right": return "右后方";
            case "uturn": return "掉头";
            case "roundabout": return "环岛";
            case "arrive": return "到达";
            default: return "未知";
        }
    }
}
