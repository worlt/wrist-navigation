package io.github.mi9pro.navigation;

import org.junit.Test;
import org.json.JSONObject;
import static org.junit.Assert.*;

public class UpdateFeedTest {
    private String manifest(int code) {
        return "{\"schemaVersion\":1,\"applicationId\":\"io.github.mi9pro.navigation\","
            + "\"releaseTag\":\"v0.4.9-preview.1\",\"phone\":{\"versionName\":\"0.3.5\",\"versionCode\":" + code
            + ",\"asset\":\"NAV-PHONE-035.apk\"},\"band\":{\"versionName\":\"0.4.7\",\"versionCode\":21,"
            + "\"fullAsset\":\"NAV-BAND-047.rpk\",\"noFontAsset\":\"NAV-BAND-047-NOFONT.rpk\"},\"notes\":\"示例说明\"}";
    }
    private String release(boolean experimental) {
        return "{\"tag_name\":\"v0.4.9-preview.1\",\"draft\":false,\"prerelease\":" + experimental
            + ",\"assets\":[{\"name\":\"update.json\"},{\"name\":\"NAV-PHONE-035.apk\"},"
            + "{\"name\":\"NAV-BAND-047.rpk\"},{\"name\":\"NAV-BAND-047-NOFONT.rpk\"}]}";
    }
    private UpdateFeed.Release feed(boolean experimental) throws Exception {
        return UpdateFeed.release(new JSONObject(release(experimental)));
    }
    @Test public void parsesMetadataAndUsesApiChannelNotTagOrManifest() throws Exception {
        var value = UpdateFeed.manifest(feed(true), manifest(20));
        assertEquals(20, value.phoneCode);
        assertEquals("0.3.5", value.phoneVersion);
        assertEquals("0.4.7", value.bandVersion);
        assertTrue(value.experimental);
        assertEquals("https://github.com/worlt/wrist-navigation/releases/tag/v0.4.9-preview.1", value.releaseUrl());
        assertFalse(UpdateFeed.manifest(feed(false), manifest(20)).experimental);
    }
    @Test public void draftIsNeverEligible() throws Exception {
        assertNull(UpdateFeed.release(new JSONObject(release(true).replace("\"draft\":false", "\"draft\":true"))));
    }
    @Test public void highestPhoneCodeWinsNotReleaseTagOrListingOrder() throws Exception {
        var older = UpdateFeed.manifest(feed(true), manifest(18));
        var stable = UpdateFeed.manifest(feed(false), manifest(20));
        var newer = UpdateFeed.manifest(feed(true), manifest(21));
        assertSame(newer, UpdatePolicy.newer(stable, newer, true));
        assertSame(stable, UpdatePolicy.newer(stable, older, true));
        assertSame(stable, UpdatePolicy.newer(newer, stable, false));
        assertSame(newer, UpdatePolicy.newer(newer, stable, true));
    }
    @Test public void equalCodeStableWinsAndDowngradeNeverPrompts() throws Exception {
        var preview = UpdateFeed.manifest(feed(true), manifest(20));
        var stable = UpdateFeed.manifest(feed(false), manifest(20));
        assertSame(stable, UpdatePolicy.newer(preview, stable, true));
        assertFalse(UpdatePolicy.available(stable, 20, false));
        assertFalse(UpdatePolicy.available(stable, 21, false));
        assertTrue(UpdatePolicy.available(stable, 19, false));
        assertFalse(UpdatePolicy.available(preview, 19, false));
    }
    @Test public void rejectsWrongPackageTagSchemaAndMissingAssets() throws Exception {
        for (String bad : new String[]{
            manifest(20).replace("io.github.mi9pro.navigation", "another.app"),
            manifest(20).replace("v0.4.9-preview.1", "v9.9.9"),
            manifest(20).replace("schemaVersion\":1", "schemaVersion\":2"),
            manifest(20).replace("NAV-PHONE-035.apk", "../../evil.apk"),
            manifest(20).replace("NAV-BAND-047.rpk", "missing.rpk"),
            manifest(20).replace("versionCode\":20", "versionCode\":20.5"),
            manifest(0), "{}", "not json"
        }) {
            assertThrows(Exception.class, () -> UpdateFeed.manifest(feed(false), bad));
        }
    }
    @Test public void legacyReleaseHasNoManifestAndDoesNotInventPhoneCode() throws Exception {
        var legacy = UpdateFeed.release(new JSONObject(release(false).replace("{\"name\":\"update.json\"},", "")));
        assertFalse(legacy.hasManifest());
    }
    @Test public void rejectsUntrustedOrMalformedTagAndDuplicateAssets() throws Exception {
        for (String bad : new String[]{release(false).replace("v0.4.9-preview.1", "../evil"),
            release(false).replace("{\"name\":\"update.json\"}", "{\"name\":\"update.json\"},{\"name\":\"update.json\"}")}) {
            assertThrows(Exception.class, () -> UpdateFeed.release(new JSONObject(bad)));
        }
    }
    @Test public void dailyAutoCheckManualBypassesAndClockRollbackRecovers() {
        long day = UpdatePolicy.CHECK_INTERVAL;
        assertTrue(UpdatePolicy.shouldCheck(true, false, 0, day));
        assertFalse(UpdatePolicy.shouldCheck(true, false, day, day + 1000));
        assertTrue(UpdatePolicy.shouldCheck(true, false, day, day * 2));
        assertTrue(UpdatePolicy.shouldCheck(false, true, day, day + 1000));
        assertFalse(UpdatePolicy.shouldCheck(false, false, 0, day));
        assertTrue(UpdatePolicy.shouldCheck(true, false, day * 3, day));
    }
    @Test public void bandSelectionIsIndependentFromPhoneCodeAndUnknownNeverPrompts() throws Exception {
        var phoneNewer = UpdateFeed.manifest(feed(true), manifest(50));
        var bandNewer = UpdateFeed.manifest(feed(true), manifest(19).replace("versionCode\":21", "versionCode\":23"));
        assertSame(bandNewer, UpdatePolicy.newer(phoneNewer, bandNewer, true, true));
        assertSame(phoneNewer, UpdatePolicy.newer(phoneNewer, bandNewer, true, false));
        assertTrue(UpdatePolicy.available(bandNewer, 22, true, true));
        assertFalse(UpdatePolicy.available(bandNewer, 0, true, true));
        assertFalse(UpdatePolicy.available(bandNewer, 23, true, true));
        assertFalse(UpdatePolicy.available(bandNewer, 22, false, true));
    }
    @Test public void metadataRoundTripsWithoutTrustingCacheChannel() throws Exception {
        var original = UpdateFeed.manifest(feed(true), manifest(20));
        var restored = UpdateFeed.cached(original.cacheJson(), false);
        assertEquals(original.phoneCode, restored.phoneCode);
        assertFalse(restored.experimental);
        assertThrows(Exception.class, () -> UpdateFeed.cached("{}", true));
    }
}
