package io.github.mi9pro.navigation;

import org.junit.Test;
import static org.junit.Assert.*;

public class NavigationDiagnosticsTest {
    private NavigationParser.Result straight() {
        return NavigationParser.parse(NavigationParser.AMAP_PACKAGE, true, "直行488米");
    }
    private NavigationParser.Result left() {
        return NavigationParser.parse(NavigationParser.AMAP_PACKAGE, true, "导航中", "左转进入示例路");
    }
    @Test public void separatesSdkSuccessFromPeerConfirmation() {
        var d = new NavigationDiagnostics();
        d.parsed(straight());
        d.sending(1, straight(), 1000);
        d.sent(1);
        assertTrue(d.sendText().contains("SDK发送成功"));
        assertTrue(d.ackText().contains("未收到"));
        d.ack(1, 1100);
        assertTrue(d.ackText().contains("当前内容已确认"));
    }
    @Test public void oldAckCannotConfirmNewFrameAndLateSuccessCannotDowngradeAck() {
        var d = new NavigationDiagnostics();
        d.parsed(straight()); d.sending(1, straight(), 1000); d.ack(1, 1010); d.sent(1);
        assertTrue(d.ackText().contains("当前内容已确认"));
        d.sending(2, straight(), 2000); d.ack(1, 2100); d.sent(1);
        assertTrue(d.sendText().contains("正在发送"));
        assertTrue(d.ackText().contains("未收到消息 #2"));
        assertTrue(d.ackText().contains("上次确认：#1"));
    }
    @Test public void newlyParsedContentIsNotConfirmedByTheOldSnapshot() {
        var d = new NavigationDiagnostics();
        d.parsed(left()); d.sending(1, left(), 1000); d.ack(1, 1100);
        d.parsed(straight());
        assertTrue(d.ackText().contains("当前内容尚未发送"));
        assertTrue(d.sendText().contains("等待发送新内容"));
        assertTrue(d.sendText().contains("左转"));
    }
    @Test public void readFailureDoesNotPresentOldTextAsFreshOrOldParseAsCurrent() {
        var d = new NavigationDiagnostics();
        d.read("标题：直行488米", 1000);
        d.parsed(straight()); d.sending(1, straight(), 1200); d.ack(1, 1300);
        d.readFailed("通知读取不可用", 2000);
        assertTrue(d.readText().contains("读取失败"));
        assertTrue(d.readText().contains("上次成功读取"));
        assertTrue(d.parseText().contains("读取不可用"));
        assertFalse(d.parseText().contains("488"));
        assertFalse(d.ackText().contains("当前内容已确认"));
        assertTrue(d.ackText().contains("历史发送确认"));
    }
    @Test public void keepsFieldOrderAndBoundsRawEvidenceWithoutBreakingSurrogates() {
        var d = new NavigationDiagnostics();
        d.read("标题：左转进入示例路\n正文：直行488米", 1000);
        d.parsed(NavigationParser.parse(NavigationParser.AMAP_PACKAGE, true, "左转进入示例路", "直行488米"));
        assertTrue(d.readText().contains("正文：直行488米"));
        assertTrue(d.parseText().contains("左转"));
        assertTrue(d.parseText().contains("未提取"));
        d.read("示例😀".repeat(3000), 2000);
        assertTrue(d.readText().length() < 7000);
        assertTrue(d.readText().contains("截断"));
        assertFalse(Character.isHighSurrogate(d.readText().charAt(d.readText().length() - 1)));
    }
    @Test public void failureRetainsMessageIdentityAndOldAckWithoutClaimingCurrentDelivery() {
        var d = new NavigationDiagnostics();
        d.parsed(straight()); d.sending(1, straight(), 1000); d.ack(1, 1100);
        d.sending(2, straight(), 2000); d.failed(2, "发送超时");
        d.sent(2); // Completion after timeout must not erase the failure.
        assertTrue(d.sendText().contains("发送超时"));
        assertTrue(d.ackText().contains("未收到消息 #2"));
        assertTrue(d.ackText().contains("上次确认：#1"));
    }
    @Test public void missingReadAndMissingParseHaveExplicitStates() {
        var d = new NavigationDiagnostics();
        assertTrue(d.readText().contains("尚未读取"));
        d.read("", 1000); d.parsed(null);
        assertTrue(d.readText().contains("没有可读取"));
        assertTrue(d.parseText().contains("未识别"));
        assertTrue(d.ackText().contains("尚未发送"));
    }
}
