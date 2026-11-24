package io.github.mi9pro.navigation;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import static org.junit.Assert.*;

/** Historical metadata repair must not invent versions or require rewriting older releases. */
public class UpdateMetadataBackfillTest {
    private static final String STABLE = "v0.4.8", PREVIEW = "v0.5.1-preview.1";

    private JSONObject metadata(String tag, boolean preview) throws Exception {
        return new JSONObject().put("schemaVersion", 1).put("applicationId", UpdateFeed.PACKAGE)
            .put("releaseTag", tag)
            .put("phone", new JSONObject().put("versionName", preview ? "0.4.1" : "0.3.2")
                .put("versionCode", preview ? 26 : 17).put("asset", preview ? "NAV-PHONE-041.apk" : "NAV-PHONE-032.apk"))
            .put("band", new JSONObject().put("versionName", preview ? "0.5.1" : "0.4.6")
                .put("versionCode", preview ? 25 : 20).put("fullAsset", preview ? "NAV-BAND-051.rpk" : "NAV-BAND-046.rpk")
                .put("noFontAsset", preview ? "NAV-BAND-051-NOFONT.rpk" : "NAV-BAND-046-NOFONT.rpk"));
    }

    private String release(String tag, boolean preview, boolean withMetadata) throws Exception {
        JSONObject manifest = metadata(tag, preview);
        JSONArray assets = new JSONArray();
        if (withMetadata) assets.put(new JSONObject().put("name", "update.json"));
        assets.put(new JSONObject().put("name", manifest.getJSONObject("phone").getString("asset")))
            .put(new JSONObject().put("name", manifest.getJSONObject("band").getString("fullAsset")))
            .put(new JSONObject().put("name", manifest.getJSONObject("band").getString("noFontAsset")));
        return new JSONObject().put("tag_name", tag).put("draft", false).put("prerelease", preview).put("assets", assets).toString();
    }

    private static final class Transport implements GitHubUpdateClient.Transport {
        final Map<String, String> values = new HashMap<>();
        final List<String> requests = new ArrayList<>();
        public String get(String url, int limit) throws IOException {
            requests.add(url);
            if (!values.containsKey(url)) throw new IOException("Unexpected metadata request");
            return values.get(url);
        }
    }

    @Test public void addingOnlyLatestMetadataCompletesBothChannelsAndBothTargets() throws Exception {
        for (boolean preview : new boolean[]{false, true}) {
            for (boolean band : new boolean[]{false, true}) {
                Transport f = new Transport();
                f.values.put(UpdateFeed.API + "/latest", release(STABLE, false, false));
                f.values.put(UpdateFeed.API + "?per_page=30&page=1", "[" + release(PREVIEW, true, true)
                    + "," + release(STABLE, false, false) + "," + release("v0.4.7", false, false) + "]");
                f.values.put(UpdateFeed.WEB + "/releases/download/" + PREVIEW + "/update.json", metadata(PREVIEW, true).toString());
                GitHubUpdateClient.Result before = new GitHubUpdateClient(f).check(preview, band);
                assertFalse(before.complete);
                assertTrue(before.missingMetadata);
                assertEquals(preview, before.version != null);

                f.values.put(UpdateFeed.API + "/latest", release(STABLE, false, true));
                f.values.put(UpdateFeed.WEB + "/releases/download/" + STABLE + "/update.json", metadata(STABLE, false).toString());
                GitHubUpdateClient.Result after = new GitHubUpdateClient(f).check(preview, band);
                assertTrue(after.complete);
                assertFalse(after.missingMetadata);
                assertEquals(preview ? PREVIEW : STABLE, after.version.tag);
                assertEquals(preview ? 26 : 17, after.version.phoneCode);
                assertEquals(preview ? 25 : 20, after.version.bandCode);
                assertFalse(f.requests.stream().anyMatch(url -> url.contains("/v0.4.7/")));
            }
        }
    }

    @Test public void repairedMetadataDoesNotDowngradeOrUpgradeUnknownInstalledVersion() throws Exception {
        for (boolean preview : new boolean[]{false, true}) {
            String tag = preview ? PREVIEW : STABLE;
            UpdateFeed.Version version = UpdateFeed.manifest(UpdateFeed.release(new JSONObject(release(tag, preview, true))), metadata(tag, preview).toString());
            assertFalse(UpdatePolicy.available(version, 26, preview, false));
            assertFalse(UpdatePolicy.available(version, 25, preview, true));
            assertFalse(UpdatePolicy.available(version, 0, preview, true));
            assertEquals(preview, UpdatePolicy.available(version, 17, preview, false));
            assertEquals(preview, UpdatePolicy.available(version, 20, preview, true));
        }
    }
}
