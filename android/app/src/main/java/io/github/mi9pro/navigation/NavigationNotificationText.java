package io.github.mi9pro.navigation;

import android.app.Notification;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.RemoteViews;
import android.widget.TextView;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** Gaode-only read. Custom views stay unattached and no click/action is invoked. */
final class NavigationNotificationText {
    private static final String[] KEYS = { Notification.EXTRA_TITLE, Notification.EXTRA_TEXT,
        Notification.EXTRA_BIG_TEXT, Notification.EXTRA_SUB_TEXT, Notification.EXTRA_SUMMARY_TEXT };
    static final class Read {
        final NotificationTextResolver.Selection selection;
        final String evidence;
        Read(NotificationTextResolver.Selection selection, String evidence) {
            this.selection = selection; this.evidence = evidence;
        }
    }
    private static final NotificationViewText.Access<View> ACCESS = new NotificationViewText.Access<>() {
        public boolean visible(View view) { return view.getVisibility() == View.VISIBLE; }
        public CharSequence text(View view) { return view instanceof TextView ? ((TextView) view).getText() : null; }
        public int childCount(View view) { return view instanceof ViewGroup ? ((ViewGroup) view).getChildCount() : 0; }
        public View child(View view, int index) { return ((ViewGroup) view).getChildAt(index); }
    };
    static Read read(Context context, String packageName, boolean ongoing, Notification notification) {
        if (!NavigationParser.AMAP_PACKAGE.equals(packageName))
            return new Read(new NotificationTextResolver.Selection(null, NotificationTextResolver.STANDARD,
                new String[0], ""), "");
        String[] standard = standardFields(notification);
        List<NotificationTextResolver.Source> sources = new ArrayList<>();
        StringBuilder custom = new StringBuilder();
        RemoteViews[] views = { notification.bigContentView, notification.contentView, notification.headsUpContentView };
        String[] names = { "bigContentView", "contentView", "headsUpContentView" };
        boolean needed = NotificationTextResolver.needsCustomView(packageName, ongoing, standard);
        for (int i = 0; i < views.length; i++) {
            RemoteViews view = views[i];
            custom.append(names[i]).append(": ");
            if (view == null) { custom.append("无\n"); continue; }
            if (!needed) { custom.append("存在，标准字段已足够，未补读\n"); continue; }
            try {
                if (!NavigationParser.AMAP_PACKAGE.equals(view.getPackage())) {
                    custom.append("来源包名不匹配，未补读\n"); continue;
                }
                // apply uses the RemoteViews package resources; it does not attach or display the view.
                View root = view.apply(context, new FrameLayout(context));
                var text = NotificationViewText.collect(root, ACCESS);
                sources.add(new NotificationTextResolver.Source(names[i], text.fields, text.complete));
                custom.append(text.fields.length == 0 ? "未读到可见文字" : text.complete ? "文字已读取" : "文字截断，未用于补读").append("\n");
                for (int n = 0; n < Math.min(text.fields.length, 8); n++)
                    custom.append(names[i]).append('[').append(n).append("]: ").append(text.fields[n]).append("\n");
                if (text.fields.length > 8) custom.append("（仅展示前8条视图文字）\n");
            } catch (RuntimeException | LinkageError error) {
                // A resources/RemoteViews failure must not drop the standard navigation result.
                // Class only: exception messages may contain route text or private resource URIs.
                custom.append("读取失败 (").append(error.getClass().getSimpleName()).append(")\n");
            }
        }
        var selection = NotificationTextResolver.resolve(packageName, ongoing, standard, sources);
        StringBuilder evidence = new StringBuilder("解析文字来源：").append(selection.source).append("\n");
        if (!selection.note.isEmpty()) evidence.append(selection.note).append("\n");
        evidence.append(extraNames(notification.extras)).append("\n").append(standardEvidence(notification)).append(custom);
        return new Read(selection, NavigationParser.clip(evidence.toString().trim(), 3072));
    }
    @SuppressWarnings("deprecation")
    static String environment(Context context) {
        String amapVersion = "未读取";
        try { amapVersion = context.getPackageManager().getPackageInfo(NavigationParser.AMAP_PACKAGE, 0).versionName; }
        catch (PackageManager.NameNotFoundException | RuntimeException ignored) { /* Version lookup is diagnostic only. */ }
        return "手机端 " + BuildConfig.VERSION_NAME + " · Android " + Build.VERSION.RELEASE + " / API " + Build.VERSION.SDK_INT
            + "\n机型：" + NavigationParser.clip(Build.MANUFACTURER + " " + Build.MODEL, 96)
            + "\n高德版本：" + NavigationParser.clip(String.valueOf(amapVersion), 80) + "\n";
    }
    static String[] standardFields(Notification notification) {
        List<String> fields = new ArrayList<>();
        Bundle extras = notification.extras;
        if (extras != null) {
            for (String key : KEYS) {
                try { CharSequence value = extras.getCharSequence(key); if (value != null && value.length() > 0) fields.add(value.toString()); }
                catch (RuntimeException ignored) { /* A malformed field cannot suppress other Gaode fields. */ }
            }
            try {
                CharSequence[] lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
                if (lines != null) for (CharSequence line : lines) if (line != null) fields.add(line.toString());
            } catch (RuntimeException ignored) { /* See above. */ }
        }
        if (notification.tickerText != null) fields.add(notification.tickerText.toString());
        return fields.toArray(new String[0]);
    }
    private static String standardEvidence(Notification notification) {
        StringBuilder text = new StringBuilder();
        Bundle extras = notification.extras;
        if (extras != null) {
            for (String key : KEYS) {
                try {
                    CharSequence value = extras.getCharSequence(key);
                    if (value != null && value.length() > 0) text.append(key).append(": ")
                        .append(NavigationParser.clip(value.toString(), 512)).append("\n");
                } catch (RuntimeException error) { text.append(key).append(": 字段读取失败\n"); }
            }
            try {
                CharSequence[] lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
                if (lines != null) for (int i = 0; i < Math.min(lines.length, 8); i++)
                    if (lines[i] != null) text.append("android.textLines[").append(i).append("]: ")
                        .append(NavigationParser.clip(lines[i].toString(), 512)).append("\n");
            } catch (RuntimeException error) { text.append("android.textLines: 字段读取失败\n"); }
        }
        if (notification.tickerText != null) text.append("tickerText: ")
            .append(NavigationParser.clip(notification.tickerText.toString(), 512)).append("\n");
        return text.toString();
    }
    @SuppressWarnings("deprecation")
    private static String extraNames(Bundle extras) {
        if (extras == null) return "扩展字段：无";
        StringBuilder text = new StringBuilder("扩展字段（只列名称与类型，不展示值）：\n");
        try {
            List<String> keys = new ArrayList<>(extras.keySet());
            keys.sort(Comparator.comparing((String key) -> key.startsWith("android.") ? 1 : 0).thenComparing(key -> key));
            for (int i = 0; i < Math.min(keys.size(), 24); i++) {
                String key = keys.get(i);
                text.append(NavigationParser.clip(key, 96)).append(": ");
                try { Object value = extras.get(key); text.append(value == null ? "null" : value.getClass().getSimpleName()); }
                catch (RuntimeException error) { text.append("类型不可读"); }
                text.append("\n");
            }
            if (keys.size() > 24) text.append("（仅列前24个扩展字段）");
        } catch (RuntimeException error) { text.append("名称不可读"); }
        return text.toString();
    }
}
