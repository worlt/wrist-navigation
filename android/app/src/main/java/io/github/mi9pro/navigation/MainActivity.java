package io.github.mi9pro.navigation;

import android.Manifest;
import android.app.Activity;
import android.app.Dialog;
import android.content.ComponentName;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.content.res.ColorStateList;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.service.notification.NotificationListenerService;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import android.widget.CheckBox;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;
import java.io.FileDescriptor;
import java.io.PrintWriter;
import java.util.ArrayList;

/** Event-driven daily controls. Permissions and preferences use compact, scrollable sheets. */
public final class MainActivity extends Activity {
    private WearBridge bridge;
    private UpdateChecker updates, bandUpdates;
    private LinearLayout updateNotice, bandUpdateNotice;
    private TextView updateNoticeTitle, updateNoticeDetail, bandNoticeTitle, bandNoticeDetail;
    private TextView homeUpdateCheck, homeBandUpdateCheck;
    private static final class UpdateCardViews {
        TextView current, latest, source, channel, status, statusDetail, check, detailsTitle, tag, pairing, notes;
        LinearLayout detailsToggle, detailsBody;
        View chevron;
        boolean expanded;
        String detailTag;
    }
    private final UpdateCardViews[] updateCards = new UpdateCardViews[2];
    private final Runnable refreshUpdates = this::renderUpdates;
    private TextView status, syncDetail, connectionDetail, action;
    private Switch sync;
    private boolean diagnosticsExpanded;
    private LinearLayout diagnosticsToggle;
    private TextView diagnosticsIndicator;
    private LinearLayout diagnosticsBody;
    private final TextView[] diagnosticValues = new TextView[4];
    private Dialog sheet;
    private OnBackInvokedCallback backCallback;
    private boolean dark;
    private int background, surface, ink, muted, line, accent, accentInk;
    private final Runnable refreshUi = this::render;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        bridge = ((NavigationApp) getApplication()).bridge();
        updates = ((NavigationApp) getApplication()).updates();
        bandUpdates = ((NavigationApp) getApplication()).bandUpdates();
        diagnosticsExpanded = savedInstanceState != null && savedInstanceState.getBoolean("diagnosticsExpanded", false);
        dark = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
            == Configuration.UI_MODE_NIGHT_YES;
        background = color(dark ? "#111713" : "#F4F6F0");
        surface = color(dark ? "#202922" : "#FFFFFF");
        ink = color(dark ? "#ECF2E9" : "#202C24");
        muted = color(dark ? "#A7B5A8" : "#707D72");
        line = color(dark ? "#344036" : "#E9EDE5");
        accent = color("#C5EE91");
        accentInk = color("#233A27");

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(background);
        edgeToEdge(getWindow());
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        ScrollView scroll = new ScrollView(this);
        scroll.setClipToPadding(false);
        scroll.setVerticalScrollBarEnabled(false);
        root.addView(scroll, new FrameLayout.LayoutParams(-1, -1));
        FrameLayout center = new FrameLayout(this);
        scroll.addView(center);
        LinearLayout content = column();
        content.setPadding(dp(24), dp(22), dp(24), dp(28));
        FrameLayout.LayoutParams centered = new FrameLayout.LayoutParams(
            Math.min(getResources().getDisplayMetrics().widthPixels, dp(600)), -2, Gravity.TOP | Gravity.CENTER_HORIZONTAL);
        center.addView(content, centered);

        LinearLayout header = row();
        LinearLayout heading = column();
        heading.addView(label("腕上导航", 29, ink, true));
        TextView subtitle = label("让每一步，都在腕间", 14, muted, false);
        heading.addView(subtitle, space(-1, -2, 7));
        header.addView(heading, new LinearLayout.LayoutParams(0, -2, 1));
        header.addView(iconButton("settings", "设置", view -> settings()), new LinearLayout.LayoutParams(dp(48), dp(48)));
        content.addView(header, space(-1, -2, 0));

        LinearLayout hero = column();
        hero.setPadding(dp(24), dp(22), dp(24), dp(22));
        hero.setBackground(shape(color("#253C2E"), 28));
        status = label("同步已暂停", 12, accent, true);
        status.setPadding(dp(11), dp(6), dp(11), dp(6));
        status.setBackground(shape(color("#3C5140"), 20));
        status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        hero.addView(status, new LinearLayout.LayoutParams(-2, -2));
        TextView heroTitle = label("导航，抬腕即见", 25, Color.WHITE, true);
        hero.addView(heroTitle, space(-1, -2, 16));
        NavigationArtwork illustration = new NavigationArtwork(this, "devices", accent);
        illustration.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        hero.addView(illustration, space(-1, 104, 10));
        LinearLayout deviceLabels = row();
        TextView phone = label("高德地图", 13, color("#C7D7C9"), false);
        TextView watch = label("小米手环", 13, color("#C7D7C9"), false);
        phone.setGravity(Gravity.CENTER); watch.setGravity(Gravity.CENTER);
        deviceLabels.addView(phone, new LinearLayout.LayoutParams(0, -2, 1));
        deviceLabels.addView(watch, new LinearLayout.LayoutParams(0, -2, 1));
        hero.addView(deviceLabels);
        content.addView(hero, space(-1, -2, 26));
        updateNotice = entry("bell", "发现新版本", "查看更新说明与下载", view -> updateSettings());
        LinearLayout updateCopy = (LinearLayout) updateNotice.getChildAt(1);
        updateNoticeTitle = (TextView) updateCopy.getChildAt(0);
        updateNoticeDetail = (TextView) updateCopy.getChildAt(1);
        updateNotice.setVisibility(View.GONE);
        content.addView(updateNotice, space(-1, -2, 16));
        bandUpdateNotice = entry("bell", "手环更新", "查看手环版本与下载", view -> updateSettings());
        LinearLayout bandCopy = (LinearLayout) bandUpdateNotice.getChildAt(1);
        bandNoticeTitle = (TextView) bandCopy.getChildAt(0);
        bandNoticeDetail = (TextView) bandCopy.getChildAt(1);
        bandUpdateNotice.setVisibility(View.GONE);
        content.addView(bandUpdateNotice, space(-1, -2, 12));

        LinearLayout syncCard = row();
        syncCard.setPadding(dp(20), dp(19), dp(14), dp(19));
        syncCard.setBackground(shape(surface, 24));
        LinearLayout syncCopy = column();
        syncCopy.addView(label("同步导航", 18, ink, true));
        syncDetail = label("已暂停转发", 13, muted, false);
        syncCopy.addView(syncDetail, space(-1, -2, 5));
        syncCard.addView(syncCopy, new LinearLayout.LayoutParams(0, -2, 1));
        sync = toggle("同步导航", bridge.enabled());
        sync.setOnCheckedChangeListener((view, checked) -> {
            if (bridge.enabled() == checked) return;
            bridge.setEnabled(checked);
            if (checked) completeSetup();
            render();
        });
        syncCard.addView(sync, new LinearLayout.LayoutParams(dp(62), dp(48)));
        content.addView(syncCard, space(-1, -2, 16));

        LinearLayout links = column();
        links.setBackground(shape(surface, 24));
        LinearLayout connectionRow = entry("link", "连接与权限", "", view -> connectionSettings());
        connectionDetail = (TextView) ((LinearLayout) connectionRow.getChildAt(1)).getChildAt(1);
        links.addView(connectionRow);
        divider(links, 64);
        links.addView(entry("sliders", "导航偏好", "手机联动 · 自动打开 · 屏幕常亮", view -> settings()));
        content.addView(links, space(-1, -2, 16));

        action = filledButton("完成连接设置", view -> completeSetup());
        content.addView(action, space(-1, -2, 16));
        homeUpdateCheck = filledButton("检查手机更新", view -> {
            updateSettings();
            updates.check(true);
        });
        LinearLayout updateButtons = row();
        updateButtons.addView(homeUpdateCheck, new LinearLayout.LayoutParams(0, -2, 1));
        homeBandUpdateCheck = filledButton("检查手环更新", view -> {
            updateSettings();
            bridge.requestBandVersion();
            bandUpdates.check(true);
        });
        LinearLayout.LayoutParams bandButtonSize = new LinearLayout.LayoutParams(0, -2, 1);
        bandButtonSize.setMargins(dp(8), 0, 0, 0);
        updateButtons.addView(homeBandUpdateCheck, bandButtonSize);
        content.addView(updateButtons, space(-1, -2, 12));
        content.addView(diagnosticsPanel(), space(-1, -2, 8));
        TextView privacy = label("仅同步高德导航通知", 12, muted, false);
        privacy.setGravity(Gravity.CENTER);
        content.addView(privacy, space(-1, -2, 24));
        setContentView(root);
        if (Build.VERSION.SDK_INT >= 33) {
            backCallback = this::finish;
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT, backCallback);
        }
    }

    @Override public void onStart() {
        super.onStart();
        bridge.phoneAppVisible();
    }
    @Override public void onStop() {
        if (!isChangingConfigurations()) {
            bridge.phoneAppHidden(PhoneAppLinkPolicy.shouldExit(isFinishing(), isChangingConfigurations()));
        }
        super.onStop();
    }
    @SuppressWarnings("deprecation")
    @Override public void onBackPressed() {
        // Back explicitly closes this page; Home and app switching only put it in the background.
        finish();
    }
    @Override public void onResume() {
        super.onResume();
        bridge.setUiListener(refreshUi);
        updates.setListener(refreshUpdates);
        bandUpdates.setListener(refreshUpdates);
        bandUpdates.installedBandCode(bridge.bandVersionCode());
        bandUpdates.check(false);
        updates.check(false);
        renderUpdates();
        NavigationSyncService.start(this);
        if (NavigationSyncService.hasNotificationAccess(this) && !bridge.listenerConnected) {
            // Opening the page runs the fastest working attempt instead of waiting for the timer,
            // so re-entering the app is no longer a slower substitute for the recovery loop.
            NavigationSyncService.recoverNow();
        }
        NavigationNotificationListener.requestRefresh();
        render();
    }
    @Override public void onPause() { bridge.setUiListener(null); updates.setListener(null); bandUpdates.setListener(null); super.onPause(); }
    @Override public void onDestroy() {
        if (Build.VERSION.SDK_INT >= 33 && backCallback != null) {
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(backCallback);
        }
        if (sheet != null) sheet.dismiss();
        super.onDestroy();
    }
    @Override protected void onSaveInstanceState(Bundle state) {
        state.putBoolean("diagnosticsExpanded", diagnosticsExpanded);
        super.onSaveInstanceState(state);
    }
    @Override public void dump(String prefix, FileDescriptor fd, PrintWriter writer, String[] args) { bridge.dump(writer); }

    private void render() {
        renderUpdates();
        renderDiagnostics();
        if (sync.isChecked() != bridge.enabled()) sync.setChecked(bridge.enabled());
        String state;
        boolean setup = false;
        if (!bridge.enabled()) state = "同步已暂停";
        else if (!NavigationSyncService.hasNotificationAccess(this) || !NavigationSyncService.hasDevicePermission(this)) {
            state = "等待授权"; setup = true;
        } else if (!NavigationSyncService.running()) { state = "后台同步未运行"; setup = true; }
        else if (!bridge.hasConnectedNode()) { state = "等待手环连接"; setup = true; }
        else if (!bridge.listenerConnected) { state = "正在连接通知服务"; setup = true; }
        else if ("尚未检查".equals(bridge.notificationStatus())) { state = "正在读取高德通知"; }
        else if (bridge.notificationStatus().contains("识别=无")) {
            state = bridge.readableNotificationCount() == 0 ? "未读到高德导航通知" : "高德通知暂未识别为导航";
        }
        else if (bridge.isNavigationActive()) { state = "正在同步高德导航"; }
        else state = "已就绪 · 等待导航";
        setText(status, state);
        setText(syncDetail, bridge.enabled() ? "高德开始导航后自动同步" : "开启后自动转发导航");
        String connection = !NavigationSyncService.hasNotificationAccess(this) ? "需要通知使用权"
            : !NavigationSyncService.hasDevicePermission(this) ? "需要附近设备权限"
            : bridge.hasConnectedNode() ? "手机互联已连接" : "通过小米运动健康连接";
        setText(connectionDetail, connection);
        if (bridge.enabled() && bridge.listenerConnected && bridge.hasConnectedNode()
                && bridge.notificationStatus().contains("识别=无")) {
            setText(syncDetail, bridge.readableNotificationCount() == 0
                ? "未读到通知 · 检查高德是否允许显示导航通知"
                : "已收到通知文字但未识别 · 可查看连接与权限状态");
        }
        if (bridge.enabled() && !bridge.listenerConnected && bridge.hasConnectedNode()
                && NavigationSyncService.hasNotificationAccess(this)) {
            setText(syncDetail, "通知服务未连接 · 正在自动重连，也可到系统设置重新开关「通知使用权」");
        }
        action.setVisibility(setup ? View.VISIBLE : View.GONE);
    }

    private LinearLayout diagnosticsPanel() {
        LinearLayout panel = column();
        panel.setBackground(shape(surface, 16));
        diagnosticsToggle = row();
        diagnosticsToggle.setPadding(dp(16), 0, dp(16), 0);
        diagnosticsToggle.addView(label("同步诊断", 13, muted, false), new LinearLayout.LayoutParams(0, -2, 1));
        diagnosticsIndicator = label("", 13, muted, false);
        diagnosticsToggle.addView(diagnosticsIndicator, new LinearLayout.LayoutParams(-2, -2));
        diagnosticsToggle.setBackground(ripple(surface, 16));
        diagnosticsToggle.setOnClickListener(view -> {
            diagnosticsExpanded = !diagnosticsExpanded;
            renderDiagnostics();
        });
        panel.addView(diagnosticsToggle, new LinearLayout.LayoutParams(-1, dp(48)));
        diagnosticsBody = column();
        diagnosticsBody.setPadding(dp(16), 0, dp(16), dp(16));
        TextView copy = label("复制当前诊断", 13, ink, true);
        copy.setGravity(Gravity.CENTER_VERTICAL);
        copy.setPadding(dp(12), 0, dp(12), 0);
        copy.setBackground(ripple(background, 10));
        copy.setOnClickListener(view -> {
            ClipboardManager clipboard = getSystemService(ClipboardManager.class);
            clipboard.setPrimaryClip(ClipData.newPlainText("腕上导航诊断", diagnosticsReport()));
            Toast.makeText(this, "已复制，分享前请隐藏路线信息", Toast.LENGTH_SHORT).show();
        });
        diagnosticsBody.addView(copy, new LinearLayout.LayoutParams(-1, dp(48)));
        TextView readBand = label("读取手环诊断", 13, ink, true);
        readBand.setGravity(Gravity.CENTER_VERTICAL);
        readBand.setPadding(dp(12), 0, dp(12), 0);
        readBand.setBackground(ripple(background, 10));
        readBand.setOnClickListener(view -> { bridge.requestBandDiagnostics(); renderDiagnostics(); });
        diagnosticsBody.addView(readBand, space(-1, dp(48), 8));
        TextView copySafe = label("复制兼容诊断（无路线）", 13, ink, true);
        copySafe.setGravity(Gravity.CENTER_VERTICAL);
        copySafe.setPadding(dp(12), 0, dp(12), 0);
        copySafe.setBackground(ripple(background, 10));
        copySafe.setOnClickListener(view -> {
            getSystemService(ClipboardManager.class).setPrimaryClip(ClipData.newPlainText("腕上导航兼容诊断", compatibilityReport()));
            Toast.makeText(this, "已复制兼容诊断，请补充手环型号和固件版本", Toast.LENGTH_SHORT).show();
        });
        diagnosticsBody.addView(copySafe, space(-1, dp(48), 8));
        String[] labels = { "读取到的文字", "解析结果", "发送状态", "手环确认状态" };
        for (int i = 0; i < labels.length; i++) {
            diagnosticsBody.addView(label(labels[i], 13, ink, true), space(-1, -2, 16));
            diagnosticValues[i] = label("", 12, muted, false);
            diagnosticValues[i].setTextIsSelectable(true);
            diagnosticValues[i].setLineSpacing(dp(3), 1);
            diagnosticsBody.addView(diagnosticValues[i], space(-1, -2, 5));
        }
        panel.addView(diagnosticsBody);
        renderDiagnostics();
        return panel;
    }

    private void renderDiagnostics() {
        if (diagnosticsToggle == null) return;
        setText(diagnosticsIndicator, diagnosticsExpanded ? "收起 ⌃" : "展开 ⌄");
        diagnosticsToggle.setContentDescription(diagnosticsExpanded ? "同步诊断，已展开，点击收起" : "同步诊断，已折叠，点击展开");
        if (Build.VERSION.SDK_INT >= 30) diagnosticsToggle.setStateDescription(diagnosticsExpanded ? "已展开" : "已折叠");
        diagnosticsBody.setVisibility(diagnosticsExpanded ? View.VISIBLE : View.GONE);
        if (!diagnosticsExpanded) return;
        setText(diagnosticValues[0], bridge.diagnostics.readText());
        setText(diagnosticValues[1], bridge.diagnostics.parseText());
        setText(diagnosticValues[2], "连接：" + bridge.statusText + "\n同步：" + (bridge.enabled() ? "开启" : "暂停")
            + "\n" + bridge.diagnostics.sendText());
        setText(diagnosticValues[3], bridge.diagnostics.ackText() + "\n\n兼容诊断\n" + bridge.compatibilityReport());
    }

    private String compatibilityReport() {
        return "腕上导航兼容诊断（无路线）\n手机 " + BuildConfig.VERSION_NAME + " / code " + BuildConfig.VERSION_CODE
            + "\n手机：" + Build.MANUFACTURER + " " + Build.MODEL + " · Android " + Build.VERSION.RELEASE
            + "\n通知监听：" + (bridge.listenerConnected ? "已连接" : "未连接")
            + "\n手环版本报告：" + bridge.bandVersionName() + " / code " + bridge.bandVersionCode()
            + "\n" + bridge.compatibilityReport();
    }

    private String diagnosticsReport() {
        return "腕上导航 " + BuildConfig.VERSION_NAME + " / code " + BuildConfig.VERSION_CODE
            + "\n采集时间：" + new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.ROOT).format(new java.util.Date())
            + "\n手机：" + Build.MANUFACTURER + " " + Build.MODEL + " · Android " + Build.VERSION.RELEASE
            + "\n通知监听：" + (bridge.listenerConnected ? "已连接" : "未连接")
            + "\n" + bridge.notificationStatus()
            + "\n\n读取到的文字\n" + bridge.diagnostics.readText()
            + "\n\n解析结果\n" + bridge.diagnostics.parseText()
            + "\n\n发送状态\n连接：" + bridge.statusText + "\n同步：" + (bridge.enabled() ? "开启" : "暂停")
            + "\n" + bridge.diagnostics.sendText()
            + "\n\n手环确认状态\n" + bridge.diagnostics.ackText()
            + "\n\n兼容诊断\n" + bridge.compatibilityReport();
    }

    private void completeSetup() {
        dismissSheet();
        if (!bridge.enabled()) bridge.setEnabled(true);
        if (!NavigationSyncService.hasNotificationAccess(this)) {
            LinearLayout options = sheetContent("允许读取导航通知", "仅处理高德导航通知，发送至配对手环。");
            options.addView(filledButton("去授权", view -> {
                dismissSheet();
                openSystemSettings(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
            }), space(-1, -2, 22));
            showSheet(options);
            return;
        }
        ArrayList<String> permissions = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= 31 && !NavigationSyncService.hasDevicePermission(this)) permissions.add(Manifest.permission.BLUETOOTH_CONNECT);
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) permissions.add(Manifest.permission.POST_NOTIFICATIONS);
        if (!permissions.isEmpty()) { requestPermissions(permissions.toArray(new String[0]), 1); return; }
        NavigationSyncService.start(this);
        NotificationListenerService.requestRebind(new ComponentName(this, NavigationNotificationListener.class));
        if (!bridge.hasConnectedNode()) bridge.connect(true);
        render();
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == 1) {
            NavigationSyncService.start(this);
            if (NavigationSyncService.hasDevicePermission(this) && !bridge.hasConnectedNode()) bridge.connect(true);
            render();
        }
    }

    private void settings() {
        LinearLayout options = sheetContent("导航偏好", "按你的习惯，调整腕上体验");
        preference(options, "打开手机应用时打开手环", "进入本应用时打开一次；先完成互联授权", bridge.openWithPhoneEnabled(), bridge::setOpenWithPhoneEnabled);
        divider(options, 0);
        preference(options, "退出手机应用时退出手环", "返回退出本应用时联动；回桌面、切换应用和锁屏不退出", bridge.closeWithPhoneEnabled(), bridge::setCloseWithPhoneEnabled);
        divider(options, 0);
        preference(options, "自动打开手环导航", "每次开始导航时打开一次", bridge.autoOpenEnabled(), bridge::setAutoOpenEnabled);
        divider(options, 0);
        preference(options, "导航时手环常亮", "关闭后可减少屏幕耗电", bridge.keepScreenOnEnabled(), bridge::setKeepScreenOnEnabled);
        divider(options, 0);
        preference(options, "手环振动提醒", "开始、结束、转向、临近、暂停和断连；震感在手环设置", bridge.vibrationEnabled(), bridge::setVibrationEnabled);
        divider(options, 0);
        preference(options, "骑行临近提醒", "开启：100 米内；关闭：步行 30 米内", bridge.cyclingReminders(), bridge::setCyclingReminders);
        divider(options, 0);
        options.addView(entry("bell", "软件更新", "检查 GitHub 更新 · 可选择实验版", view -> updateSettings()));
        TextView version = label("腕上导航  " + BuildConfig.VERSION_NAME, 12, muted, false);
        options.addView(version, space(-1, -2, 16));
        showSheet(options);
    }

    private void updateSettings() {
        LinearLayout options = sheetContent("软件更新", "手机与手环，版本和更新各自独立");
        updateSection(options, updates, false);
        updateSection(options, bandUpdates, true);

        LinearLayout settings = column();
        settings.setPadding(dp(16), 0, dp(16), 0);
        settings.setBackground(shape(background, 18));
        LinearLayout settingsBody = column();
        settingsBody.setVisibility(View.GONE);
        TextView settingsTitle = label("检查设置", 14, ink, true);
        View settingsArrow = new NavigationArtwork(this, "chevron", muted);
        LinearLayout settingsToggle = disclosure(settingsTitle, settingsArrow);
        settingsToggle.setContentDescription("检查设置，已收起；自动检查和 Preview");
        settingsToggle.setOnClickListener(view -> {
            boolean expanded = settingsBody.getVisibility() != View.VISIBLE;
            settingsBody.setVisibility(expanded ? View.VISIBLE : View.GONE);
            settingsTitle.setText(expanded ? "检查设置 · 收起" : "检查设置");
            disclosureState(settingsToggle, settingsArrow, expanded, "检查设置");
        });
        settings.addView(settingsToggle);
        updatePreferences(settingsBody, updates, false);
        divider(settingsBody, 0);
        updatePreferences(settingsBody, bandUpdates, true);
        settings.addView(settingsBody);
        options.addView(settings, space(-1, -2, 14));
        options.addView(label("仅检查 GitHub 公开信息，不上传导航或诊断。\n不会自动下载或安装，升级前请核对双端配套。", 12, muted, false), space(-1, -2, 14));
        showSheet(options);
        bridge.requestBandVersion();
        renderUpdates();
    }

    private void updateSection(LinearLayout options, UpdateChecker checker, boolean band) {
        int index = band ? 1 : 0;
        String device = band ? "手环" : "手机";
        UpdateCardViews card = new UpdateCardViews();
        updateCards[index] = card;
        LinearLayout panel = column();
        panel.setPadding(dp(18), dp(16), dp(18), dp(8));
        panel.setBackground(shape(background, 20));
        Configuration configuration = getResources().getConfiguration();
        boolean horizontal = configuration.screenWidthDp >= 360 && configuration.fontScale <= 1.25f;
        LinearLayout header = row();
        header.addView(new NavigationArtwork(this, band ? "band" : "phone", muted), new LinearLayout.LayoutParams(dp(22), dp(22)));
        LinearLayout.LayoutParams titleSize = new LinearLayout.LayoutParams(0, -2, 1);
        titleSize.setMarginStart(dp(8));
        header.addView(label(device + "更新", 18, ink, true), titleSize);
        card.channel = label("", 11, muted, false);
        card.channel.setPadding(dp(8), dp(5), dp(8), dp(5));
        card.channel.setBackground(shape(surface, 8));
        if (horizontal) header.addView(card.channel);
        panel.addView(header);
        if (!horizontal) panel.addView(card.channel, space(-2, -2, 8));
        LinearLayout versions = horizontal ? row() : column();
        versions.setGravity(Gravity.TOP);
        LinearLayout current = column(), latest = column();
        current.addView(label("当前安装", 12, muted, false));
        card.current = label("", 24, ink, true);
        current.addView(card.current, space(-1, -2, 6));
        latest.addView(label("GitHub 最新版本", 12, muted, false));
        card.latest = label("尚未获取", 24, ink, true);
        latest.addView(card.latest, space(-1, -2, 6));
        card.source = label("检查后显示版本", 11, muted, false);
        latest.addView(card.source, space(-1, -2, 5));
        versions.addView(current, new LinearLayout.LayoutParams(horizontal ? 0 : -1, -2, horizontal ? 1 : 0));
        LinearLayout.LayoutParams latestSize = new LinearLayout.LayoutParams(horizontal ? 0 : -1, -2, horizontal ? 1 : 0);
        if (horizontal) latestSize.setMarginStart(dp(14)); else latestSize.topMargin = dp(14);
        versions.addView(latest, latestSize);
        panel.addView(versions, space(-1, -2, 16));

        card.status = label("", 14, ink, true);
        card.status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        LinearLayout statusArea = column();
        statusArea.addView(card.status);
        card.statusDetail = label("", 12, muted, false);
        statusArea.addView(card.statusDetail, space(-1, -2, 5));
        LinearLayout actions = row();
        card.check = filledButton("检查" + device + "更新", view -> {
            if (band) bridge.requestBandVersion();
            checker.check(true);
        });
        card.check.setTextSize(14);
        card.check.setMinimumHeight(dp(48));
        card.check.setPadding(dp(10), dp(14), dp(10), dp(14));
        actions.addView(card.check, new LinearLayout.LayoutParams(0, -2, 1));
        TextView release = filledButton("GitHub 发布页", view -> {
            UpdateFeed.Version version = checker.latestVersion();
            openRelease(version == null ? UpdateFeed.WEB + "/releases" : version.releaseUrl());
        });
        release.setTextColor(ink); release.setTextSize(14);
        release.setMinimumHeight(dp(48));
        release.setPadding(dp(10), dp(14), dp(10), dp(14));
        release.setBackground(ripple(surface, 14));
        LinearLayout.LayoutParams releaseSize = new LinearLayout.LayoutParams(0, -2, 1);
        releaseSize.setMarginStart(dp(10));
        actions.addView(release, releaseSize);
        card.detailsTitle = label("版本详情", 12, muted, false);
        card.chevron = new NavigationArtwork(this, "chevron", muted);
        card.detailsToggle = disclosure(card.detailsTitle, card.chevron);
        card.detailsBody = column();
        card.detailsBody.setVisibility(View.GONE);
        card.detailsBody.setPadding(dp(12), dp(12), dp(12), dp(14));
        card.detailsBody.setBackground(shape(surface, 12));
        card.tag = label("", 12, muted, false);
        card.pairing = label("", 13, ink, true);
        card.notes = label("", 13, ink, false);
        card.notes.setTextIsSelectable(true);
        card.notes.setLineSpacing(dp(5), 1f);
        card.detailsBody.addView(card.tag);
        card.detailsBody.addView(card.pairing, space(-1, -2, 8));
        card.detailsBody.addView(card.notes, space(-1, -2, 12));
        card.detailsToggle.setOnClickListener(view -> {
            card.expanded = !card.expanded;
            renderUpdateDisclosure(card, device);
        });
        LinearLayout summary = horizontal ? row() : column();
        summary.addView(statusArea, new LinearLayout.LayoutParams(horizontal ? 0 : -1, -2, horizontal ? 1 : 0));
        LinearLayout.LayoutParams disclosureSize = new LinearLayout.LayoutParams(horizontal ? dp(90) : -1, -2);
        if (horizontal) disclosureSize.setMarginStart(dp(8));
        summary.addView(card.detailsToggle, disclosureSize);
        panel.addView(summary, space(-1, -2, 10));
        panel.addView(actions, space(-1, -2, 8));
        panel.addView(card.detailsBody, space(-1, -2, 12));
        options.addView(panel, space(-1, -2, 16));
    }

    private void updatePreferences(LinearLayout parent, UpdateChecker checker, boolean band) {
        String device = band ? "手环" : "手机";
        parent.addView(label(device + "更新设置", 14, ink, true), space(-1, -2, 8));
        LinearLayout automatic = row();
        LinearLayout copy = column();
        copy.addView(label("自动检查", 14, ink, false));
        copy.addView(label("每天打开时检查一次", 12, muted, false), space(-1, -2, 4));
        automatic.addView(copy, new LinearLayout.LayoutParams(0, -2, 1));
        Switch toggle = toggle("自动检查" + device + "更新", checker.automatic());
        toggle.setOnCheckedChangeListener((button, value) -> checker.setAutomatic(value));
        automatic.addView(toggle, new LinearLayout.LayoutParams(dp(62), dp(48)));
        parent.addView(automatic, space(-1, -2, 6));
        CheckBox preview = new CheckBox(this);
        preview.setText(band ? R.string.receive_band_preview_updates : R.string.receive_phone_preview_updates);
        preview.setTextSize(14); preview.setTextColor(ink); preview.setMinimumHeight(dp(48));
        preview.setButtonTintList(new ColorStateList(new int[][] {{android.R.attr.state_checked}, {} }, new int[] {dark ? accent : accentInk, muted}));
        preview.setChecked(checker.experimental());
        preview.setOnCheckedChangeListener((view, checked) -> checker.setExperimental(checked));
        parent.addView(preview, space(-1, -2, 2));
        TextView hint = label("仅影响" + device + "；预发布可能不稳定，默认关闭", 12, muted, false);
        LinearLayout.LayoutParams hintSize = space(-1, -2, 0);
        hintSize.bottomMargin = dp(14);
        parent.addView(hint, hintSize);
    }

    private LinearLayout disclosure(TextView title, View chevron) {
        LinearLayout toggle = row();
        toggle.setMinimumHeight(dp(48));
        toggle.setPadding(0, dp(10), 0, dp(10));
        toggle.setBackground(ripple(background, 12));
        toggle.setFocusable(true);
        toggle.addView(title, new LinearLayout.LayoutParams(0, -2, 1));
        chevron.setRotation(90);
        toggle.addView(chevron, new LinearLayout.LayoutParams(dp(16), dp(16)));
        toggle.setAccessibilityDelegate(new View.AccessibilityDelegate() {
            @Override public void onInitializeAccessibilityNodeInfo(View host, android.view.accessibility.AccessibilityNodeInfo info) {
                super.onInitializeAccessibilityNodeInfo(host, info);
                info.setClassName("android.widget.Button");
            }
        });
        return toggle;
    }

    private void disclosureState(LinearLayout toggle, View chevron, boolean expanded, String title) {
        chevron.setRotation(expanded ? 270 : 90);
        toggle.setContentDescription(title + (expanded ? "，已展开，点击收起" : "，已收起，点击展开"));
        if (Build.VERSION.SDK_INT >= 30) toggle.setStateDescription(expanded ? "已展开" : "已收起");
    }

    private void renderUpdateDisclosure(UpdateCardViews card, String device) {
        card.detailsBody.setVisibility(card.expanded ? View.VISIBLE : View.GONE);
        setText(card.detailsTitle, "版本详情");
        disclosureState(card.detailsToggle, card.chevron, card.expanded, device + "版本详情");
    }

    private void checkButtonState(TextView button, UpdateChecker checker, String text) {
        if (button == null) return;
        button.setEnabled(!checker.running());
        setText(button, checker.running() ? "正在检查…" : text);
        button.setAlpha(checker.running() ? 0.6f : 1f);
    }

    private void renderUpdates() {
        bandUpdates.installedBandCode(bridge.bandVersionCode());
        checkButtonState(homeUpdateCheck, updates, "检查手机更新");
        checkButtonState(homeBandUpdateCheck, bandUpdates, "检查手环更新");
        renderUpdateSection(updates, false);
        renderUpdateSection(bandUpdates, true);
    }

    private void renderUpdateSection(UpdateChecker checker, boolean band) {
        int index = band ? 1 : 0;
        String device = band ? "手环" : "手机";
        UpdateFeed.Version newer = checker.available();
        LinearLayout notice = band ? bandUpdateNotice : updateNotice;
        notice.setVisibility(newer == null ? View.GONE : View.VISIBLE);
        if (newer != null) {
            setText(band ? bandNoticeTitle : updateNoticeTitle, device + (newer.experimental ? " Preview 更新 · " : "正式版更新 · ")
                + (band ? newer.bandVersion : newer.phoneVersion));
            setText(band ? bandNoticeDetail : updateNoticeDetail, "点此查看" + device + "更新说明与下载；核对配套要求");
        }
        UpdateCardViews card = updateCards[index];
        if (card == null) return;
        checkButtonState(card.check, checker, "检查" + device + "更新");
        UpdateFeed.Version listed = checker.latestVersion();
        int installed = band ? bridge.bandVersionCode() : BuildConfig.VERSION_CODE;
        UpdateChecker.CheckState state = checker.checkState();
        setText(card.current, band ? installed > 0 ? bridge.bandVersionName() : "未知" : BuildConfig.VERSION_NAME);
        setText(card.latest, UpdatePresentation.version(listed, band));
        setText(card.source, UpdatePresentation.source(listed, state));
        setText(card.channel, checker.experimental() ? "正式 + Preview" : "仅正式版");
        setText(card.status, UpdatePresentation.status(listed, installed, band, checker.experimental(), state));
        int statusColor = ink;
        if (state == UpdateChecker.CheckState.INCOMPLETE) statusColor = color(dark ? "#EAC98F" : "#805511");
        else if (newer != null && state == UpdateChecker.CheckState.COMPLETE) statusColor = dark ? accent : accentInk;
        card.status.setTextColor(statusColor);
        String detail = UpdatePresentation.detail(listed, installed, band, checker.experimental(), state, checker.status());
        setText(card.statusDetail, detail);
        card.statusDetail.setVisibility(detail.isEmpty() ? View.GONE : View.VISIBLE);
        card.detailsToggle.setVisibility(listed == null ? View.GONE : View.VISIBLE);
        String tag = listed == null ? null : listed.tag;
        if (!java.util.Objects.equals(card.detailTag, tag)) {
            card.detailTag = tag;
            card.expanded = false;
        }
        if (listed != null) {
            setText(card.tag, "发布标签：" + listed.tag);
            setText(card.pairing, "此发布配套\n手机 " + listed.phoneVersion + "  /  手环 " + listed.bandVersion);
            setText(card.notes, UpdatePresentation.notes(listed));
        }
        renderUpdateDisclosure(card, device);
    }

    private void openRelease(String url) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
        catch (android.content.ActivityNotFoundException error) {
            Toast.makeText(this, "没有可打开 GitHub 的浏览器", Toast.LENGTH_SHORT).show();
        }
    }

    private void connectionSettings() {
        LinearLayout options = sheetContent("连接与权限", "手机连接小米运动健康后即可同步");
        options.addView(entry("bell", "通知与设备授权", "检查导航通知和手环连接", view -> completeSetup()), space(-1, -2, 14));
        divider(options, 0);
        options.addView(entry("battery", "后台运行", "允许自启动，省电策略设为无限制", view -> {
            dismissSheet();
            PowerManager power = getSystemService(PowerManager.class);
            if (!power.isIgnoringBatteryOptimizations(getPackageName())) {
                try { openSystemSettings(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getPackageName()))); }
                catch (android.content.ActivityNotFoundException error) { appSettings(); }
            } else appSettings();
        }));
        showSheet(options);
    }

    private LinearLayout sheetContent(String title, String description) {
        LinearLayout body = column();
        body.setPadding(dp(24), dp(8), dp(24), dp(26));
        LinearLayout header = row();
        TextView name = label(title, 24, ink, true);
        header.addView(name, new LinearLayout.LayoutParams(0, -2, 1));
        header.addView(iconButton("close", "关闭设置", view -> dismissSheet()), new LinearLayout.LayoutParams(dp(48), dp(48)));
        body.addView(header);
        body.addView(label(description, 14, muted, false), space(-1, -2, 4));
        return body;
    }

    private void showSheet(LinearLayout body) {
        dismissSheet();
        Dialog dialog = new Dialog(this);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        LinearLayout shell = column();
        shell.setBackground(shape(surface, 28));
        View handle = new View(this);
        handle.setBackground(shape(line, 4));
        LinearLayout.LayoutParams handleSize = space(36, 4, 12);
        handleSize.gravity = Gravity.CENTER_HORIZONTAL;
        shell.addView(handle, handleSize);
        ScrollView scrolling = new ScrollView(this);
        scrolling.setVerticalScrollBarEnabled(false);
        scrolling.addView(body);
        shell.addView(scrolling, new LinearLayout.LayoutParams(-1, -2));
        dialog.setContentView(shell);
        dialog.setCanceledOnTouchOutside(true);
        Window window = dialog.getWindow();
        window.setBackgroundDrawableResource(android.R.color.transparent);
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_DIM_BEHIND);
        window.setDimAmount(0.35f);
        window.setGravity(Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
        window.setNavigationBarColor(surface);
        window.setStatusBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 29) window.setNavigationBarContrastEnforced(false);
        shell.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(0, 0, 0, insets.getSystemWindowInsetBottom());
            return insets;
        });
        dialog.show();
        window.setLayout(Math.min(getResources().getDisplayMetrics().widthPixels, dp(600)), -2);
        systemBarIcons(window);
        int maxHeight = Math.round(getResources().getDisplayMetrics().heightPixels * 0.85f);
        Runnable resize = () -> {
            if (!dialog.isShowing() || body.getMeasuredHeight() == 0) return;
            int height = Math.min(body.getMeasuredHeight(),
                Math.max(dp(48), maxHeight - dp(16) - shell.getPaddingBottom()));
            if (scrolling.getLayoutParams().height != height)
                scrolling.setLayoutParams(new LinearLayout.LayoutParams(-1, height));
        };
        body.addOnLayoutChangeListener((view, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom) -> resize.run());
        shell.addOnLayoutChangeListener((view, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom) -> resize.run());
        shell.post(resize);
        sheet = dialog;
    }

    private void dismissSheet() { if (sheet != null) { sheet.dismiss(); sheet = null; } }
    private void openSystemSettings(Intent intent) {
        startActivity(intent);
    }
    private void appSettings() { openSystemSettings(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()))); }
    private interface Preference { void set(boolean value); }
    private void preference(LinearLayout parent, String title, String detail, boolean checked, Preference preference) {
        LinearLayout container = row();
        container.setPadding(0, dp(20), 0, dp(20));
        LinearLayout copy = column();
        copy.addView(label(title, 16, ink, true));
        copy.addView(label(detail, 13, muted, false), space(-1, -2, 5));
        container.addView(copy, new LinearLayout.LayoutParams(0, -2, 1));
        Switch toggle = toggle(title, checked);
        toggle.setOnCheckedChangeListener((button, value) -> preference.set(value));
        container.addView(toggle, new LinearLayout.LayoutParams(dp(62), dp(48)));
        parent.addView(container, space(-1, -2, 6));
    }

    private Switch toggle(String title, boolean checked) {
        Switch toggle = new Switch(this);
        toggle.setContentDescription(title);
        toggle.setChecked(checked);
        toggle.setShowText(false);
        toggle.setSwitchMinWidth(dp(46));
        toggle.setGravity(Gravity.CENTER);
        toggle.setThumbTintList(new ColorStateList(new int[][] { {android.R.attr.state_checked}, {} },
            new int[] { accentInk, dark ? color("#A7B5A8") : Color.WHITE }));
        toggle.setTrackTintList(new ColorStateList(new int[][] { {android.R.attr.state_checked}, {} },
            new int[] { accent, dark ? color("#556358") : color("#C4CDC2") }));
        return toggle;
    }
    private LinearLayout entry(String icon, String title, String detail, View.OnClickListener listener) {
        LinearLayout entry = row();
        entry.setPadding(dp(16), dp(17), dp(16), dp(17));
        entry.setMinimumHeight(dp(76));
        entry.setBackground(ripple(surface, 22));
        entry.setOnClickListener(listener);
        entry.setFocusable(true);
        entry.addView(new NavigationArtwork(this, icon, muted), new LinearLayout.LayoutParams(dp(26), dp(26)));
        LinearLayout copy = column();
        copy.addView(label(title, 16, ink, true));
        copy.addView(label(detail, 12, muted, false), space(-1, -2, 4));
        LinearLayout.LayoutParams copySize = new LinearLayout.LayoutParams(0, -2, 1);
        copySize.setMargins(dp(14), 0, dp(8), 0);
        entry.addView(copy, copySize);
        entry.addView(new NavigationArtwork(this, "chevron", muted), new LinearLayout.LayoutParams(dp(16), dp(20)));
        return entry;
    }
    private View iconButton(String icon, String title, View.OnClickListener listener) {
        NavigationArtwork view = new NavigationArtwork(this, icon, ink);
        view.setPadding(dp(13), dp(13), dp(13), dp(13));
        view.setBackground(ripple(surface, 24));
        view.setContentDescription(title);
        view.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_YES);
        view.setOnClickListener(listener);
        view.setFocusable(true);
        return view;
    }
    private TextView filledButton(String title, View.OnClickListener listener) {
        TextView view = label(title, 16, accentInk, true);
        view.setGravity(Gravity.CENTER);
        view.setPadding(dp(16), dp(16), dp(16), dp(16));
        view.setMinimumHeight(dp(54));
        view.setBackground(ripple(accent, 18));
        view.setOnClickListener(listener);
        view.setFocusable(true);
        view.setAccessibilityDelegate(new View.AccessibilityDelegate() {
            @Override public void onInitializeAccessibilityNodeInfo(View host, android.view.accessibility.AccessibilityNodeInfo info) {
                super.onInitializeAccessibilityNodeInfo(host, info);
                info.setClassName("android.widget.Button");
            }
        });
        return view;
    }
    private void divider(LinearLayout parent, int inset) {
        View divider = new View(this); divider.setBackgroundColor(line);
        LinearLayout.LayoutParams size = new LinearLayout.LayoutParams(-1, dp(1));
        size.setMarginStart(dp(inset)); size.setMarginEnd(dp(20));
        parent.addView(divider, size);
    }
    private TextView label(String value, int size, int tint, boolean bold) {
        TextView text = new TextView(this);
        text.setText(value); text.setTextSize(size); text.setTextColor(tint);
        text.setFontFeatureSettings("kern");
        text.setIncludeFontPadding(false);
        text.setTypeface(Typeface.create(bold ? "sans-serif-medium" : "sans-serif", Typeface.NORMAL));
        text.setLineSpacing(dp(3), 1f);
        return text;
    }
    private LinearLayout column() { LinearLayout view = new LinearLayout(this); view.setOrientation(LinearLayout.VERTICAL); return view; }
    private LinearLayout row() { LinearLayout view = new LinearLayout(this); view.setOrientation(LinearLayout.HORIZONTAL); view.setGravity(Gravity.CENTER_VERTICAL); return view; }
    private LinearLayout.LayoutParams space(int width, int height, int top) {
        LinearLayout.LayoutParams size = new LinearLayout.LayoutParams(width < 0 ? width : dp(width), height < 0 ? height : dp(height));
        size.topMargin = dp(top); return size;
    }
    private GradientDrawable shape(int tint, int radius) {
        GradientDrawable shape = new GradientDrawable(); shape.setColor(tint); shape.setCornerRadius(dp(radius)); return shape;
    }
    private RippleDrawable ripple(int tint, int radius) {
        return new RippleDrawable(ColorStateList.valueOf(color(dark ? "#285B765E" : "#183F6245")), shape(tint, radius), null);
    }
    private void edgeToEdge(Window window) {
        if (Build.VERSION.SDK_INT >= 30) window.setDecorFitsSystemWindows(false);
        else window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        window.setStatusBarColor(Color.TRANSPARENT); window.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 29) window.setNavigationBarContrastEnforced(false);
        systemBarIcons(window);
    }
    private void systemBarIcons(Window window) {
        // HyperOS needs a created decor view before PhoneWindow.getInsetsController().
        View decor = window.getDecorView();
        if (Build.VERSION.SDK_INT >= 30) {
            int flags = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            decor.post(() -> {
                WindowInsetsController controller = decor.getWindowInsetsController();
                if (controller != null) controller.setSystemBarsAppearance(dark ? 0 : flags, flags);
            });
        } else {
            int flags = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            int current = window.getDecorView().getSystemUiVisibility();
            window.getDecorView().setSystemUiVisibility(dark ? current & ~flags : current | flags);
        }
    }
    private void setText(TextView view, String value) { if (!value.contentEquals(view.getText())) view.setText(value); }
    private int color(String value) { return Color.parseColor(value); }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
}
