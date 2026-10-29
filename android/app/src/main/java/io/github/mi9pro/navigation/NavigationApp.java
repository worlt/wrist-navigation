package io.github.mi9pro.navigation;

import android.app.Application;
import android.content.ComponentName;
import android.content.pm.PackageManager;

public final class NavigationApp extends Application {
    private WearBridge bridge;

    @Override public void onCreate() {
        super.onCreate();
        // A recovery toggle that was cut short by a crash would leave the listener component
        // disabled, and no permission change can revive that. Always restore it before anything
        // else runs so the app can never be left permanently unable to listen.
        ComponentName listener = new ComponentName(this, NavigationNotificationListener.class);
        PackageManager manager = getPackageManager();
        try {
            if (manager.getComponentEnabledSetting(listener) != PackageManager.COMPONENT_ENABLED_STATE_DEFAULT) {
                manager.setComponentEnabledSetting(listener,
                    PackageManager.COMPONENT_ENABLED_STATE_DEFAULT, PackageManager.DONT_KILL_APP);
                android.util.Log.i("WristNav", "listener component restored");
            }
        } catch (IllegalArgumentException | SecurityException error) {
            android.util.Log.w("WristNav", "listener component restore failed: " + error.getClass().getSimpleName());
        }
    }

    public synchronized WearBridge bridge() {
        if (bridge == null) bridge = new WearBridge(this);
        return bridge;
    }
}
