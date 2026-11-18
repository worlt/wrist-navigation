package io.github.mi9pro.navigation;

import org.junit.Test;
import java.io.IOException;
import java.util.*;
import static org.junit.Assert.*;

public class GitHubUpdateClientTest {
    private String release(String tag, boolean preview) {
        return "{\"tag_name\":\"" + tag + "\",\"draft\":false,\"prerelease\":" + preview
            + ",\"assets\":[{\"name\":\"update.json\"},{\"name\":\"phone.apk\"},"
            + "{\"name\":\"band.rpk\"},{\"name\":\"band-nofont.rpk\"}]}";
    }
    private String metadata(String tag, int code) {
        return "{\"schemaVersion\":1,\"applicationId\":\"io.github.mi9pro.navigation\",\"releaseTag\":\"" + tag
            + "\",\"phone\":{\"versionName\":\"0.3.5\",\"versionCode\":" + code + ",\"asset\":\"phone.apk\"},"
            + "\"band\":{\"versionName\":\"0.4.7\",\"versionCode\":21,\"fullAsset\":\"band.rpk\",\"noFontAsset\":\"band-nofont.rpk\"}}";
    }
    private static class Fake implements GitHubUpdateClient.Transport {
        final Map<String, String> values = new HashMap<>();
        final List<String> requests = new ArrayList<>();
        public String get(String url, int limit) throws IOException {
            requests.add(url);
            if (!values.containsKey(url)) throw new IOException("offline");
            return values.get(url);
        }
        void manifest(String tag, String value) { values.put(UpdateFeed.WEB + "/releases/download/" + tag + "/update.json", value); }
    }
    @Test public void stableOnlyNeverRequestsPrereleases() throws Exception {
        Fake f = new Fake();
        f.values.put(UpdateFeed.API + "/latest", release("v0.4.9", false)); f.manifest("v0.4.9", metadata("v0.4.9", 20));
        var result = new GitHubUpdateClient(f).check(false);
        assertTrue(result.complete); assertEquals(20, result.version.phoneCode);
        assertEquals(2, f.requests.size());
    }
    @Test public void optInSelectsHigherCodeAcrossPreviewAndStable() throws Exception {
        Fake f = new Fake();
        f.values.put(UpdateFeed.API + "/latest", release("v0.4.9", false)); f.manifest("v0.4.9", metadata("v0.4.9", 22));
        f.values.put(UpdateFeed.API + "?per_page=30&page=1", "[" + release("v0.5.0-beta", true) + "," + release("v0.6.0-beta", true) + "]");
        f.manifest("v0.5.0-beta", metadata("v0.5.0-beta", 21)); f.manifest("v0.6.0-beta", metadata("v0.6.0-beta", 23));
        var result = new GitHubUpdateClient(f).check(true);
        assertTrue(result.complete); assertEquals(23, result.version.phoneCode); assertTrue(result.version.experimental);
    }
    @Test public void paginatesAndIgnoresDrafts() throws Exception {
        Fake f = new Fake(); f.values.put(UpdateFeed.API + "/latest", null);
        List<String> first = new ArrayList<>();
        for (int i = 0; i < 30; i++) first.add("{\"draft\":true}");
        f.values.put(UpdateFeed.API + "?per_page=30&page=1", "[" + String.join(",", first) + "]");
        f.values.put(UpdateFeed.API + "?per_page=30&page=2", "[" + release("v0.5.0-beta", true) + "]");
        f.manifest("v0.5.0-beta", metadata("v0.5.0-beta", 21));
        assertEquals(21, new GitHubUpdateClient(f).check(true).version.phoneCode);
    }
    @Test public void previewFailurePreservesStableButCannotSayUpToDate() throws Exception {
        Fake f = new Fake();
        f.values.put(UpdateFeed.API + "/latest", release("v0.4.9", false)); f.manifest("v0.4.9", metadata("v0.4.9", 20));
        var result = new GitHubUpdateClient(f).check(true);
        assertFalse(result.complete); assertEquals(20, result.version.phoneCode);
    }
    @Test public void missingOrInvalidMetadataNeverInventsVersionOrFallsBackToReleaseTag() throws Exception {
        Fake f = new Fake();
        f.values.put(UpdateFeed.API + "/latest", release("v9.9.9", false).replace("{\"name\":\"update.json\"},", ""));
        var result = new GitHubUpdateClient(f).check(false);
        assertNull(result.version); assertFalse(result.complete); assertTrue(result.missingMetadata);
        f.values.put(UpdateFeed.API + "/latest", release("v9.9.9", false)); f.manifest("v9.9.9", "{}");
        result = new GitHubUpdateClient(f).check(false); assertNull(result.version); assertFalse(result.complete);
    }
    @Test public void noPublishedReleasesIsNotAnErrorAndNetworkFailureIs() throws Exception {
        Fake f = new Fake(); f.values.put(UpdateFeed.API + "/latest", null);
        assertTrue(new GitHubUpdateClient(f).check(false).complete);
        f.values.clear(); assertFalse(new GitHubUpdateClient(f).check(false).complete);
    }
    @Test public void unexpectedPrereleaseInLatestIsNotTreatedAsStable() throws Exception {
        Fake f = new Fake(); f.values.put(UpdateFeed.API + "/latest", release("v0.5.0-beta", true));
        assertNull(new GitHubUpdateClient(f).check(false).version);
    }
    @Test public void allowedRedirectHostsOnlyUseHttpsWithoutUserInfo() throws Exception {
        assertTrue(GitHubUpdateClient.safeUrl("https://api.github.com/repos/worlt/wrist-navigation/releases/latest"));
        assertTrue(GitHubUpdateClient.safeUrl("https://release-assets.githubusercontent.com/github-production-release-asset/file?sig=example"));
        for (String bad : new String[]{"http://github.com/x", "https://github.com.evil.com/x", "https://user@github.com/x", "https://github.com:444/x", "https://evil.com/x"}) {
            assertFalse(GitHubUpdateClient.safeUrl(bad));
        }
    }
    @Test public void responseSizeIsBoundedIncludingBytesWithoutContentLength() throws Exception {
        assertEquals("abc", GitHubUpdateClient.readBounded(new java.io.ByteArrayInputStream("abc".getBytes()), 3));
        assertThrows(IOException.class, () -> GitHubUpdateClient.readBounded(new java.io.ByteArrayInputStream("abcd".getBytes()), 3));
    }
    @Test public void bandQuerySelectsBandCodeEvenIfPhoneCodeIsLower() throws Exception {
        Fake f = new Fake();
        f.values.put(UpdateFeed.API + "/latest", release("v0.4.9", false)); f.manifest("v0.4.9", metadata("v0.4.9", 50));
        f.values.put(UpdateFeed.API + "?per_page=30&page=1", "[" + release("v0.5.0-beta", true) + "]");
        f.manifest("v0.5.0-beta", metadata("v0.5.0-beta", 19).replace("versionCode\":21", "versionCode\":23"));
        assertEquals(23, new GitHubUpdateClient(f).check(true, true).version.bandCode);
        assertEquals(50, new GitHubUpdateClient(f).check(true, false).version.phoneCode);
    }

}
