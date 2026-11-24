package io.github.mi9pro.navigation;

import org.junit.Test;
import static org.junit.Assert.*;

public class UpdatePresentationTest {
    private UpdateFeed.Version version(boolean preview) {
        return new UpdateFeed.Version("v0.5.1-preview.1", "0.4.1", 26, "phone.apk", "0.5.1", 25,
            "band.rpk", "band-nofont.rpk", "# 修复说明\n\n**测试版**，请核对配套。\n- 保留 `ACK`\n", preview);
    }
    @Test public void latestVersionIsShownEvenWhenNoUpgradeIsAvailable() {
        assertEquals("0.4.1", UpdatePresentation.version(version(true), false));
        assertEquals("0.5.1", UpdatePresentation.version(version(true), true));
        assertEquals("尚未获取", UpdatePresentation.version(null, false));
    }
    @Test public void currentEqualOrHigherVersionIsNotAnUpgrade() {
        assertEquals("当前无需更新", UpdatePresentation.status(version(true), 26, false, true, UpdateChecker.CheckState.COMPLETE));
        assertEquals("", UpdatePresentation.detail(version(true), 26, false, true, UpdateChecker.CheckState.COMPLETE, ""));
        assertEquals("当前无需更新", UpdatePresentation.status(version(false), 27, false, false, UpdateChecker.CheckState.COMPLETE));
        assertTrue(UpdatePresentation.detail(version(false), 27, false, false, UpdateChecker.CheckState.COMPLETE, "").contains("无需降级"));
        assertEquals("有新版本可用", UpdatePresentation.status(version(true), 24, true, true, UpdateChecker.CheckState.COMPLETE));
    }
    @Test public void unknownBandAndMissingCandidateAreNeverCalledUpToDate() {
        assertEquals("手环版本未知", UpdatePresentation.status(version(true), 0, true, true, UpdateChecker.CheckState.COMPLETE));
        assertEquals("暂无可用发布信息", UpdatePresentation.status(null, 26, false, false, UpdateChecker.CheckState.COMPLETE));
    }
    @Test public void cachedFailedAndRunningStatesKeepTheirOwnMeaning() {
        for (UpdateChecker.CheckState state : new UpdateChecker.CheckState[]{UpdateChecker.CheckState.NOT_CHECKED, UpdateChecker.CheckState.INCOMPLETE}) {
            assertEquals("版本信息待确认", UpdatePresentation.status(version(true), 26, false, true, state));
            assertTrue(UpdatePresentation.source(version(true), state).contains("待确认"));
        }
        assertEquals("正在检查更新", UpdatePresentation.status(version(true), 26, false, true, UpdateChecker.CheckState.CHECKING));
        assertTrue(UpdatePresentation.source(version(true), UpdateChecker.CheckState.CHECKING).contains("确认中"));
        assertEquals("网络失败，稍后重试", UpdatePresentation.detail(version(true), 26, false, true, UpdateChecker.CheckState.INCOMPLETE, "网络失败，稍后重试"));
    }
    @Test public void notesAreReadableTextWithExplicitEmptyState() {
        String notes = UpdatePresentation.notes(version(true));
        assertEquals("修复说明\n\n测试版，请核对配套。\n• 保留 ACK", notes);
        assertTrue(UpdatePresentation.notes(null).contains("未提供更新说明"));
    }
}
