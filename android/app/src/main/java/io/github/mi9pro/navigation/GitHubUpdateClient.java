package io.github.mi9pro.navigation;

import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Public GitHub only. Bounded requests, no credentials, device IDs or navigation data. */
final class GitHubUpdateClient {
    interface Transport { String get(String url, int byteLimit) throws IOException; }
    static final class Result {
        UpdateFeed.Version version;
        boolean complete = true, missingMetadata;
    }
    private final Transport transport;
    GitHubUpdateClient(Transport transport) { this.transport = transport; }
    static GitHubUpdateClient online() { return new GitHubUpdateClient(new HttpTransport()); }

    Result check(boolean experimental) {
        return check(experimental, false);
    }
    Result check(boolean experimental, boolean band) {
        Result result = new Result();
        try {
            String latest = transport.get(UpdateFeed.API + "/latest", 512 * 1024);
            if (latest != null) {
                UpdateFeed.Release release = UpdateFeed.release(new JSONObject(latest));
                if (release != null && !release.experimental) add(result, release, experimental, band);
                else result.complete = false;
            }
        } catch (Exception error) { result.complete = false; }
        if (!experimental) return result;
        int manifests = 0;
        try {
            for (int page = 1; page <= 3; page++) {
                String text = transport.get(UpdateFeed.API + "?per_page=30&page=" + page, 2 * 1024 * 1024);
                if (text == null) throw new IOException("Release list unavailable");
                JSONArray list = new JSONArray(text);
                for (int i = 0; i < list.length(); i++) {
                    UpdateFeed.Release release;
                    try { release = UpdateFeed.release(list.getJSONObject(i)); }
                    catch (Exception error) { result.complete = false; continue; }
                    if (release == null || !release.experimental) continue;
                    if (release.hasManifest() && ++manifests > 12) { result.complete = false; return result; }
                    add(result, release, true, band);
                }
                if (list.length() < 30) return result;
            }
            // A bounded scan must not claim an exhaustive, successful check.
            result.complete = false;
        } catch (Exception error) { result.complete = false; }
        return result;
    }

    private void add(Result result, UpdateFeed.Release release, boolean experimental, boolean band) {
        if (!release.hasManifest()) { result.missingMetadata = true; result.complete = false; return; }
        try {
            String text = transport.get(release.manifestUrl(), 32 * 1024);
            if (text == null) throw new IOException("Metadata unavailable");
            result.version = UpdatePolicy.newer(result.version, UpdateFeed.manifest(release, text), experimental, band);
        } catch (Exception error) { result.complete = false; }
    }

    static boolean safeUrl(String value) {
        try {
            URI uri = new URI(value);
            String host = uri.getHost();
            return "https".equals(uri.getScheme()) && uri.getRawUserInfo() == null
                && (uri.getPort() == -1 || uri.getPort() == 443)
                && ("api.github.com".equals(host) || "github.com".equals(host)
                    || "release-assets.githubusercontent.com".equals(host) || "objects.githubusercontent.com".equals(host));
        } catch (Exception error) { return false; }
    }
    static String readBounded(InputStream stream, int limit) throws IOException {
        return readBounded(stream, limit, Long.MAX_VALUE);
    }
    private static String readBounded(InputStream stream, int limit, long deadline) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        byte[] buffer = new byte[4096];
        int count;
        while ((count = stream.read(buffer)) != -1) {
            if (bytes.size() + count > limit || System.nanoTime() > deadline) throw new IOException("Response limit exceeded");
            bytes.write(buffer, 0, count);
        }
        return bytes.toString(StandardCharsets.UTF_8.name());
    }
    private static final class HttpTransport implements Transport {
        private final long deadline = System.nanoTime() + 30_000_000_000L;
        public String get(String address, int limit) throws IOException {
            for (int redirect = 0; redirect < 5; redirect++) {
                if (!safeUrl(address)) throw new IOException("Untrusted update endpoint");
                int remaining = (int) Math.min(8000, (deadline - System.nanoTime()) / 1_000_000);
                if (remaining <= 0) throw new IOException("Update check timed out");
                HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
                try {
                    connection.setInstanceFollowRedirects(false);
                    connection.setConnectTimeout(Math.min(5000, remaining));
                    connection.setReadTimeout(remaining);
                    connection.setRequestProperty("User-Agent", "WristNavigation-UpdateCheck");
                    connection.setRequestProperty("Accept", address.startsWith(UpdateFeed.API) ? "application/vnd.github+json" : "application/json");
                    if (address.startsWith(UpdateFeed.API)) connection.setRequestProperty("X-GitHub-Api-Version", "2022-11-28");
                    int status = connection.getResponseCode();
                    if (status == 404) return null;
                    if (status == 301 || status == 302 || status == 303 || status == 307 || status == 308) {
                        String next = connection.getHeaderField("Location");
                        if (next == null) throw new IOException("Missing redirect");
                        address = new URL(new URL(address), next).toString();
                        continue;
                    }
                    if (status != 200) throw new IOException("Update request failed");
                    if (connection.getContentLengthLong() > limit) throw new IOException("Metadata too large");
                    try (InputStream stream = connection.getInputStream()) { return readBounded(stream, limit, deadline); }
                } finally { connection.disconnect(); }
            }
            throw new IOException("Too many redirects");
        }
    }
}
