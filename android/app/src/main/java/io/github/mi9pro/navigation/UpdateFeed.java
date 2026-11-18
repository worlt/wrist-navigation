package io.github.mi9pro.navigation;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.LinkedHashSet;
import java.util.Set;

/** Only version metadata is accepted; URLs are constructed for the fixed project. */
final class UpdateFeed {
    static final String REPOSITORY = "worlt/wrist-navigation";
    static final String WEB = "https://github.com/" + REPOSITORY;
    static final String API = "https://api.github.com/repos/" + REPOSITORY + "/releases";
    static final String PACKAGE = "io.github.mi9pro.navigation";
    static final String MANIFEST = "update.json";

    static final class Release {
        final String tag;
        final boolean experimental;
        final Set<String> assets;
        Release(String tag, boolean experimental, Set<String> assets) {
            this.tag = tag; this.experimental = experimental; this.assets = assets;
        }
        boolean hasManifest() { return assets.contains(MANIFEST); }
        String manifestUrl() { return WEB + "/releases/download/" + tag + "/" + MANIFEST; }
    }

    static Release release(JSONObject json) throws JSONException {
        if (json.getBoolean("draft")) return null;
        String tag = json.getString("tag_name");
        if (!tag.matches("[A-Za-z0-9][A-Za-z0-9._-]{0,99}")) throw new JSONException("Invalid release tag");
        JSONArray list = json.getJSONArray("assets");
        if (list.length() > 100) throw new JSONException("Too many assets");
        Set<String> assets = new LinkedHashSet<>();
        for (int i = 0; i < list.length(); i++) {
            String name = list.getJSONObject(i).getString("name");
            if (!assets.add(name)) throw new JSONException("Duplicate asset");
        }
        return new Release(tag, json.getBoolean("prerelease"), assets);
    }

    static final class Version {
        final String tag, phoneVersion, phoneAsset, bandVersion, fullAsset, noFontAsset, notes;
        final int phoneCode, bandCode;
        final boolean experimental;
        Version(String tag, String phoneVersion, int phoneCode, String phoneAsset,
                String bandVersion, int bandCode, String fullAsset, String noFontAsset,
                String notes, boolean experimental) {
            this.tag = tag; this.phoneVersion = phoneVersion; this.phoneCode = phoneCode;
            this.phoneAsset = phoneAsset; this.bandVersion = bandVersion; this.bandCode = bandCode;
            this.fullAsset = fullAsset; this.noFontAsset = noFontAsset;
            this.notes = notes; this.experimental = experimental;
        }
        String releaseUrl() { return WEB + "/releases/tag/" + tag; }
        String cacheJson() throws JSONException {
            return new JSONObject().put("schemaVersion", 1).put("applicationId", PACKAGE)
                .put("releaseTag", tag).put("notes", notes)
                .put("phone", new JSONObject().put("versionName", phoneVersion).put("versionCode", phoneCode).put("asset", phoneAsset))
                .put("band", new JSONObject().put("versionName", bandVersion).put("versionCode", bandCode)
                    .put("fullAsset", fullAsset).put("noFontAsset", noFontAsset)).toString();
        }
    }

    static Version manifest(Release release, String text) throws JSONException {
        JSONObject json = new JSONObject(text);
        if (number(json, "schemaVersion") != 1 || !PACKAGE.equals(json.getString("applicationId"))
                || !release.tag.equals(json.getString("releaseTag"))) throw new JSONException("Mismatched manifest");
        JSONObject phone = json.getJSONObject("phone"), band = json.getJSONObject("band");
        String phoneAsset = asset(phone, "asset", ".apk", release);
        String full = asset(band, "fullAsset", ".rpk", release);
        String noFont = asset(band, "noFontAsset", ".rpk", release);
        if (full.equals(noFont)) throw new JSONException("Duplicate band variants");
        String notes = json.optString("notes", "");
        if (notes.length() > 6000) throw new JSONException("Notes too long");
        return new Version(release.tag, version(phone), number(phone, "versionCode"), phoneAsset,
            version(band), number(band, "versionCode"), full, noFont, notes, release.experimental);
    }

    static Version cached(String text, boolean experimental) throws JSONException {
        JSONObject json = new JSONObject(text);
        JSONObject phone = json.getJSONObject("phone"), band = json.getJSONObject("band");
        JSONArray assets = new JSONArray();
        for (String name : new String[]{MANIFEST, phone.getString("asset"), band.getString("fullAsset"), band.getString("noFontAsset")}) {
            assets.put(new JSONObject().put("name", name));
        }
        Release release = release(new JSONObject().put("tag_name", json.getString("releaseTag"))
            .put("draft", false).put("prerelease", experimental).put("assets", assets));
        return manifest(release, text);
    }

    private static int number(JSONObject json, String key) throws JSONException {
        Object value = json.get(key);
        if (!(value instanceof Number)) throw new JSONException("Invalid version code");
        double number = ((Number) value).doubleValue();
        if (number < 1 || number > Integer.MAX_VALUE || number != Math.floor(number)) throw new JSONException("Invalid version code");
        return (int) number;
    }
    private static String version(JSONObject json) throws JSONException {
        String value = json.getString("versionName");
        if (!value.matches("[0-9]+\\.[0-9]+\\.[0-9]+(?:-[A-Za-z0-9.-]+)?") || value.length() > 64) throw new JSONException("Invalid version name");
        return value;
    }
    private static String asset(JSONObject json, String key, String extension, Release release) throws JSONException {
        String value = json.getString(key);
        if (!value.matches("[A-Za-z0-9][A-Za-z0-9_.-]{0,119}") || !value.endsWith(extension)
                || !release.assets.contains(value)) throw new JSONException("Missing or unsafe package asset");
        return value;
    }
}
