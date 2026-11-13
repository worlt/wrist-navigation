# 手机应用与手环快应用联动（0.3.0 / 0.4.6）

手机 0.3.0 的发布行为保留在下文。2026-11-12 v0.4.7 配套手机 0.3.1 已将切后台与明确退出分开，切高德/其他应用和回桌面不再退出手环，详见 [后台与退出修复](phone-background-exit-031.md)。

## 目标与范围
- 在手机「导航偏好」增加两个独立、持久保存且默认关闭的开关：打开手机应用时打开手环；退出手机应用时退出手环。
- 进入手机可见页面时请求打开一次；不依赖高德导航状态或同步总开关，不主动弹出授权。先完成原有连接授权。
- 返回键、回桌面、切换其他应用触发退出；锁屏、配置重建、应用主动打开系统权限设置不触发。强杀/强停及系统回收不保证回调，不声称可靠退出。
- 打开沿用 XMS `launchWearApp`；退出通过原有 v1 导航帧增加可选 `phoneExitId`，手环先 ACK，再延迟 300 ms 调用官方 `@system.app.terminate()`。ACK 只证明收到请求，不证明实际退出。
- 新进入、关闭退出开关取消未发送/待执行退出；旧异步打开回调无效。打开最多三次、5 秒退避；退出请求只在 10 秒窗口内发出，ACK 去重。已确认退出不在手环手动重开后补发。
- 手机后台同步服务不退出。启用退出联动且手机已离开时，阻止通知自动打开抢回手环前台；关闭联动保留旧行为。

## 技术与代码风格
Android Java 17 / API 26–35，JUnit4；Vela aiot-toolkit 2.0.5 / CommonJS，Node test。
纯策略和原生调用分离：`long claimLaunch(long now)`；原生只在主线程串行调用，使用世代标识拒绝过期回调。

## 文件位置
手机策略与 UI：android/app/src/main/java/io/github/mi9pro/navigation/；测试在对应 src/test。
手环协议、退出控制和 App 级会话：wearable/src/common/；测试：wearable/test/。
本说明记录需求、结果及真机限制；tasks/plan.md 与 tasks/todo.md 记录实现检查点。签名口令仅来自被忽略的本机配置或环境变量，不进入公开源码。

## 验证命令
```powershell
npm test
# 按开发文档配置本机 JAVA_HOME / ANDROID_HOME，勿提交本机路径或签名凭据。
& android/gradlew.bat -p android :app:testDebugUnitTest :app:lintDebug :app:assembleDebug --console=plain
npm --prefix wearable run build
node tools/check-wearable-package.cjs
node tools/verify-rpk-signature.cjs
```

## 测试策略与边界
先写失败测试，再实现策略、协议验证与退出时序。覆盖默认关闭、重复进出、设置变化、有限重试、断连、旧回调、ACK、退出前取消、API 缺失及生命周期释放。构建后检查编译产物与原签名；不以 mock 证明固件行为。
始终保留已有未提交改动与签名。未经要求不推送、发布、传包、安装，不更改厂商 SDK、不引入依赖、不记录路线或敏感凭据。

## 依据
- https://iot.mi.com/vela/quickapp/zh/features/basic/app.html ：`app.terminate()`，无参数，退出当前应用。
- https://developer.android.com/guide/components/activities/activity-lifecycle ：用可见生命周期而非 onDestroy 判断页面离开；进程终止不保证销毁回调。
- 本地 XMS 1.4 SDK 及既有 WearBridge.launchWearApp 已验证调用路径，沿用而不假定存在远程退出 API。

## 验收状态
122项Node（含4项发布门禁）、63项Android单元测试、Lint与双端构建通过。RPK编译产物验证退出先ACK、300ms延迟、重复不重启、重入取消、销毁取消和接口缺失安全；APK/RPK复用原配对签名。Lint保留BatteryLife/GradleDependency/UnusedResources三项既有警告，构建保留三套字体大资源提示。

交付 `outputs/releases/v0.4.6/NAV-PHONE-030.apk` / `NAV-BAND-046.rpk` 与 SHA256SUMS；双端需一起更新。源码与配套按 v0.4.6 正式 Release / Latest 发布流程整理；发布记录见 [介绍](releases/v0.4.6.md)。本轮未传输设备、未安装，未完成本版真机验证。

真机待验：默认关闭保留旧行为；分别开启两个开关；首次进入/重复通知/快速进出；返回、桌面、切换高德；锁屏、旋转和权限页排除；关同步仍可联动；断连/恢复、手环手动重开不补退出；原双振功能回归。SDK原生打开请求一旦已发出不能撤回，网络时序/强杀和系统回收不保证退出，不用本地mock代替设备验收。

竞态回归：当前帧ACK可先于迟到SDK回调释放发送门禁，取消帧不等待旧SDK回调；已发出的旧phone/nav原生打开请求若在后台迟到成功，则重新发一个有限窗口的补偿退出。返回前台或关闭退出开关不补偿，超时/失败不补偿。已发出的SDK请求无法物理撤回，因此真机仍须检查最终状态与网络时序。

独立只读竞态复核：原生迟到打开补偿、ACK释放发送门禁两项修复后无新增发现；这是静态代码复核，不代替真机测试。
