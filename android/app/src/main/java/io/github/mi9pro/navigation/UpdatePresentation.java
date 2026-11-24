package io.github.mi9pro.navigation;

/** Version copy is separate from transport and never implies an upgrade from a cached result. */
final class UpdatePresentation {
    private UpdatePresentation() { }

    static String version(UpdateFeed.Version value, boolean band) {
        return value == null ? "尚未获取" : band ? value.bandVersion : value.phoneVersion;
    }
    static String source(UpdateFeed.Version value, UpdateChecker.CheckState state) {
        if (value == null) return "检查后显示版本";
        String channel = value.experimental ? "Preview 实验版" : "正式版";
        if (state == UpdateChecker.CheckState.CHECKING) return channel + " · 确认中";
        if (state != UpdateChecker.CheckState.COMPLETE) return channel + " · 待确认";
        return channel;
    }
    static String status(UpdateFeed.Version value, int installed, boolean band, boolean experimental, UpdateChecker.CheckState state) {
        if (state == UpdateChecker.CheckState.CHECKING) return "正在检查更新";
        if (state != UpdateChecker.CheckState.COMPLETE) {
            if (value != null) return "版本信息待确认";
            return state == UpdateChecker.CheckState.INCOMPLETE ? "检查未完成" : "尚未检查更新";
        }
        if (value == null) return "暂无可用发布信息";
        if (band && installed == 0) return "手环版本未知";
        return UpdatePolicy.available(value, installed, experimental, band) ? "有新版本可用" : "当前无需更新";
    }
    static String detail(UpdateFeed.Version value, int installed, boolean band, boolean experimental,
                         UpdateChecker.CheckState state, String failure) {
        if (state == UpdateChecker.CheckState.CHECKING) return "正在读取 GitHub 公开版本信息…";
        if (state == UpdateChecker.CheckState.INCOMPLETE) return failure;
        if (state == UpdateChecker.CheckState.NOT_CHECKED) return value == null
            ? "点击检查，获取所选渠道的最新版本。" : "已保留之前获取的信息，请检查以确认最新版本。";
        if (value == null) return "可稍后重试，或直接查看 GitHub 发布页。";
        if (band && installed == 0) return "连接并打开手环应用后，才能判断是否需要升级。";
        if (UpdatePolicy.available(value, installed, experimental, band)) return "核对双端配套后，再手动更新。";
        return installed > (band ? value.bandCode : value.phoneCode)
            ? "已装版本较新，无需降级。" : "";
    }
    static String notes(UpdateFeed.Version value) {
        if (value == null || value.notes.trim().isEmpty()) return "此版本未提供更新说明，完整信息请查看 GitHub 发布页。";
        return value.notes.replaceAll("(?m)^[ \\t]{0,3}#{1,6}[ \\t]+", "")
            .replaceAll("(?m)^[ \\t]*[-*+][ \\t]+", "• ")
            .replace("**", "").replace("`", "").trim();
    }
}
