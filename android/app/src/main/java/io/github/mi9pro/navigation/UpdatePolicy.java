package io.github.mi9pro.navigation;

final class UpdatePolicy {
    static final long CHECK_INTERVAL = 24L * 60 * 60 * 1000;
    static boolean shouldCheck(boolean auto, boolean manual, long lastAttempt, long now) {
        return manual || (auto && (lastAttempt <= 0 || now < lastAttempt || now - lastAttempt >= CHECK_INTERVAL));
    }
    static boolean available(UpdateFeed.Version version, int installedCode, boolean experimental) {
        return available(version, installedCode, experimental, false);
    }
    static boolean available(UpdateFeed.Version version, int installedCode, boolean experimental, boolean band) {
        return installedCode > 0 && version != null && (band ? version.bandCode : version.phoneCode) > installedCode && (!version.experimental || experimental);
    }
    static UpdateFeed.Version newer(UpdateFeed.Version a, UpdateFeed.Version b, boolean experimental) {
        return newer(a, b, experimental, false);
    }
    static UpdateFeed.Version newer(UpdateFeed.Version a, UpdateFeed.Version b, boolean experimental, boolean band) {
        if (a != null && a.experimental && !experimental) a = null;
        if (b == null || (b.experimental && !experimental)) return a;
        if (a == null || (band ? b.bandCode : b.phoneCode) > (band ? a.bandCode : a.phoneCode) || ((band ? b.bandCode : b.phoneCode) == (band ? a.bandCode : a.phoneCode) && !b.experimental)) return b;
        return a;
    }
}
