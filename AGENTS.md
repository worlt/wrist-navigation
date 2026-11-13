# 项目开发约定

本项目把 Android 高德地图导航通知同步到小米手环 10 Pro。9 Pro 与 10 Pro 共用 336 × 480 面板和同一套布局代码，但自手环 0.3.3 起未再在 9 Pro 上回归测试，涉及 9 Pro 的表述不能写成已验证。与用户使用中文沟通。

2026-09-22 开源准备后用户接入手机：已只读核对手机 0.2.1/code 6，恢复原签名 `outputs/releases/v0.2.4/NAV-PHONE-021.apk` 并核对手机/电脑/历史 SHA-256 一致，APK 签名与手环 0.2.4 原证书匹配。它是历史 debug 构建，不是 unsigned 或新 release 构建。随后按用户要求将 `NAV-BAND-024.rpk` 传至手机 `/sdcard/Download/` 并核对两端 SHA-256 和大小一致；没有点击安装界面。用户自行安装后反馈“已经ok”，记录为 0.2.4 已安装、基本使用正常（用户确认），不扩展为全部功能或长时稳定性验收通过。最新记录优先看 HANDOVER.md 顶部。

## 开始工作

2026-11-13发布轮：用户已授权推送和Release。v0.4.7配套手机0.3.1/code16、手环0.4.6/code20；两RPK沿用v0.4.6原字节，已有手环0.4.6只需更新手机。仅推mine/main，保留旧标签与Release；六附件白名单及许可/哈希门禁，正式Latest。当前发布进度看HANDOVER顶部，发布前不要记为完成。本版修复未传包/安装/真机验收，APK/RPK仍原签名debug。

2026-11-12本地修复候选为手机0.3.1/code16，沿用手环0.4.6/code20（完整版/无字体版）；只需更新手机。用户反馈切后台误退出，现已区分后台与明确退出：桌面/切高德或其他应用/锁屏/权限页/配置重建不退出手环、不屏蔽后台导航自动打开；主页面返回键或手势finish才按退出开关联动。67项Android、129项Node、Lint/原签名APK及公开文件检查通过，交付outputs/releases/phone-v0.3.1/；未提交/推送/发布/传包/安装/真机验收。详见HANDOVER顶部及docs/phone-background-exit-031.md；下文0.3.0将切后台当退出的描述只适用于旧版。

2026-11-11发布轮已完成：用户明确要求分步推送并将v0.4.6作为正式Release设为Latest，不用预发布状态。三步推送c96a2ec/2621262/520ea10及v0.4.6标签均在mine；Release id441600950，GitHub Latest已核对，五附件公开下载哈希一致，四组源码CI通过。设备传输/安装/本版真机验收未进行。必须在正文说明新功能尚未真机验收、手机0.3.0/code15与手环0.4.6/code20需一起更新、APK/RPK仍为原签名debug构建。签名口令改用被忽略的signing/passwords.properties或WRIST_SIGNING_PASSWORD，不轮换原身份；推送只到mine（worlt/wrist-navigation），不得推原作者origin。发布前附件白名单/完整许可/本地与远端SHA-256复核，实际状态以HANDOVER顶部为准。下面保留当时开发记录。

2026-11-11当前本地候选为手机0.3.0(code15) / 手环0.4.6(code20)。新增两个独立、默认关闭且持久保存的「打开手机应用时打开手环」「退出手机应用时退出手环」开关，位于手机导航偏好。打开联动不依赖同步总开关或高德状态，需已有互联授权；可见进入打开一次，有限重试。返回、回桌面和切换应用触发退出，锁屏、配置重建和主动打开权限设置不触发。退出通过v1可选phoneExitId，手环先ACK，300ms后调用system.app.terminate；重入的新帧可取消待退出。收到ACK后不发正常帧取消退出，手机后台且退出联动开启时抑制通知自动重开；后台同步服务保持运行。118项Node、63项Android、Lint及双端构建、RPK编译后退出/ACK/取消/去重/API缺失检查、原签名检查通过；详见docs/phone-app-link-046.md。交付outputs/releases/v0.4.6/，尚未提交推送、发布、传包、安装或真机验证。强杀/强停、断连及固件时序不保证退出；ACK不等于实际退出成功。

历史0.4.5记录：2026-11-11当时为手机0.2.9(code14) / 手环0.4.5(code19)。用户追加“暂停、断联也要震动”，已加入暂停同步/确认断连各一组两下；两端振动开关控制，重复事件不重振。手机传reminderEnabled独立偏好（暂停时vibrationEnabled仍false），手环按最后收到的偏好判断断连。仅onclose、状态2或1006确认断连；未建立连接、普通诊断错误、初始已暂停均不报。恢复连接/同步取消旧事件第二下，重新发生可再提醒。110项Node、47项Android、Lint/双端构建/编译RPK/原签名校验通过。完整功能需双端更新，详见docs/haptic-reminders-045.md；交付outputs/releases/v0.4.5/，未提交推送、发布、传包、安装或本版真机验证。

历史0.4.4记录：2026-11-11当时源码/交付为手机0.2.8(code13) / 手环0.4.4(code18)。用户确认此前基本振动成功，要求双振、可选震感，随后追加开始/结束提醒与总开关。已完成：开始与首条转向合并一组两下，正常结束一组两下；手机导航ID/结束标识，通知消失至少5秒并经再次读取确认（常规轮询8秒），存在无法解析的高德通知不猜结束；暂停/断连不当作结束。手环振动提醒总开关控制全部事件和试振，默认开，震感默认明显（两次long），可选轻柔（两次short）；偏好独立保存，启动读取前静默，不补播。需双端更新，0.2.7只有基础转向/临近。104项Node、47项Android测试、Lint/双端构建/编译后检查及原证书签名通过，详见docs/haptic-reminders-044.md。新包未提交/推送、发布、传包、安装或真机验证；用户确认仅针对此前基础振动，不能扩大。

历史0.4.3记录（已被0.4.4替代）：用户反馈此前振动测试成功、一次偏弱；基本振动可用已获确认，未扩展为息屏/长时等全部验收。新手环0.4.3 / code17改为每次双振，手环设置可选轻柔（两次short）/明显（两次long，默认），并提供试振；档位App启动读取且独立持久化。手机保持0.2.7无需更新。见docs/haptic-reminders-043.md。96项Node、编译后RPK时序/设置/恢复/生命周期/资源及原签名检查通过；新包未提交/推送、发布、传包、安装或真机验证。

历史记录：2026-11-10源码为手机0.2.7 / 手环0.4.2振动优化本地候选（2026-11-10），已构建与本地检查，未提交/推送、未发布/传包/安装或真机验证，详见docs/haptic-reminders-042.md。用户要求参考项目优化，互联/ACK/去重/短振已移到App级，页面隐藏/销毁不主动关闭；去掉前台/设置页限制，但固件后台保活与实际震感未验证，不伪造音频/下载/定位保活。手机增加当前指令道路/环岛出口身份，缺字段不重复，原两段短振规则保留。0.4.1仅属历史前台候选。用户说的手机振动是高德自身行为，仅供参考；明确只开发手环振动，不能新增手机振动或反复追问。已发布v0.4.0配套仍为手机0.2.5 / 手环0.4.0。2026-11-05 默认字号 36、箭头 160、粗细 8、实心薄荷绿、白色正文，箭头范围 32–232、图文间距 8；旧设置保留。同日用户确认已在红米 K80 Ultra（K80U）试用，并要求转为正式发布、设为 Latest；其他手机因没有设备尚未测试。现有本地检查与用户试用反馈均应保留，不能把反馈扩展为所有字体、功能、耗电或机型逐项验收通过。标签与四个附件保持不变，APK / RPK 仍为原有签名调试构建；此前手机 0.2.5 / 手环 0.3.3 保留在 v0.2.5。以下 0.2.4 段落为历史记录，当前数值以 `settings.js`、`geometry.js` 与 HANDOVER 顶部为准。

用户已于 2026-09-20 明确“开始开发”，第 5 版方案已实施为手环 0.2.4 / code 9，不再受此前“仅预览、等待确认”限制。默认字号 30、箭头 42、粗细 8、图文间距 26，底部齿轮仍为 42 / 64×64 点击区；全页面字体字号联动、字体选择、设置滚动、恢复默认已实现并通过本地检查。旧设置保留；查看新默认比例需在设置底部点“恢复默认”。

原生新增系统默认、宋体、楷体、圆体选择，附加字体资源和许可随包内置，不依赖电脑本地字体。源码浏览器预览已加载字体，RPK 编译事件/资源已检查；手环固件字体支持、资源加载性能与显示效果仍待真机，不能把构建或浏览器当作真机验收。新源码截图 outputs/previews/wearable-native-024.png / wearable-fonts-024.png；实现和边界见 docs/display-settings-024.md。历史 font-controls-proposal 系列仅是概念图。

1. 先读根目录 `HANDOVER.md`，了解最近的用户反馈、已安装版本和未完成工作，再读相关源码。
2. `docs/navigation-verification.md` 保存验证摘要；完整历史联调记录归档在被忽略的 `.local/archive/`。`docs/band-install.md` 保存安装方法。不要把历史验证结果当作当前版本已验证。
3. 工作目录以当前检出的仓库根目录为准，不依赖旧电脑绝对路径。当前为 Windows PowerShell；使用 main 分支，每次先检查工作区和远程状态。可迁移开发入口见 docs/development.md。
4. 手机 0.2.1 已于 2026-09-22 重新核对；0.2.2 实拍证明导航能显示，0.2.3 后续实拍证明设置页已恢复显示。0.2.4 本地 39 项测试、1779 项浏览器交互/几何断言、RPK 编译检查及签名验证通过；交付 outputs/releases/v0.2.4/NAV-BAND-024.rpk，2026-09-22 已传至手机并核对 SHA-256，用户确认安装使用正常，具体功能与长期表现尚未逐项验收。保留用户认可的手机界面。
5. 0.2.4 开发轮仅在电脑验证；2026-09-22 经用户授权只传包，未操作安装界面。以后传包仍需重新查 ADB 状态并核对 SHA-256。浏览器操作使用 agent-browser，源码交互预览为 http://127.0.0.1:4173/。字体、字号联动、原生滚动和保存等需本版本真机反馈，旧版自动打开、锁屏常亮不能替代当前验收。

## 核心边界

- Android APK 与 Vela RPK 必须保持相同包名 `io.github.mi9pro.navigation` 和匹配的签名。复用 `signing/development.p12` 与 `wearable/sign/debug/`，不要重新生成或轮换证书。
- 手环只安装 RPK；AstroBox 中使用「快应用」类型。手机 APK 不能安装到手环。
- 只处理 `com.autonavi.minimap` 的通知。保留无法识别的原文，不编造转向、距离、道路或路线。
- 同步启停、导航开始/结束、断连、过期、页面隐藏和销毁必须分别处理。自动打开手环页面应按一次导航控制，不能每次通知更新都抢回前台。
- 保留已能显示的通信格式，除非取得不兼容证据。SDK 发送成功、收到 ACK、用户看到画面是不同证据。
- 常亮是手环导航页面在前台保持点亮，不等于后台显示或系统 AOD。手机 0.1.3 的自动打开及超过两分钟锁屏同步已获用户确认；长时与重启恢复等限制见交接文件。
- 不因缺少 ACK 就否认用户已确认的实际显示；也不能用模拟原生接口的测试证明真机常亮或后台运行成功。
- 普通开发、构建、检查和已授权的安装联调无需反复确认。不要自行 root、降级/替换运动健康、重置手环或改用他人的签名。

## 代码位置

| 文件 | 作用 |
| --- | --- |
| `android/app/src/main/java/io/github/mi9pro/navigation/NavigationParser.java` | 纯 Java 通知文字解析 |
| 同目录 `NavigationNotificationListener.java` | 通知监听、150 毫秒去抖、活动心跳补读、监听掉线自动重连 |
| 同目录 `WearBridge.java`、`SendPolicy.java` | XMS 授权、连接、发送去重/节流、手动打开调试、诊断 |
| 同目录 `MainActivity.java` | 手机设置及诊断页面 |
| 同目录 `NavigationSyncService.java`、`SyncRestoreReceiver.java` | 后台同步、唤醒锁、停止和恢复、监听重连退避（`ListenerRecovery`） |
| 同目录 `AutoLaunchPolicy.java` | 按导航控制自动打开、短暂无通知去抖、有限重试 |
| `wearable/src/pages/index/index.ux` | 手环固定尺寸页面、互联、常亮与生命周期 |
| `wearable/src/common/protocol.js` | 消息校验、去重、20 秒过期与显示状态 |
| `wearable/src/common/presentation.js` | 原文分行及错误显示 |
| `wearable/src/common/settings.js` | 显示设置边界、原生存储、串行写入与销毁保护 |

## 本机工具与验证

离线界面开发只需要 Node.js 22+（推荐 24）：npm test、npm run dev。无需手机、手环、签名或 Android SDK。

从项目根目录运行 Android 检查（先配置 JAVA_HOME 为 JDK 17+，ANDROID_HOME 为本机 SDK；本次电脑可先执行 `. .local/environment.ps1`，该文件不提交）：

```powershell
& android/gradlew.bat -p android -Punsigned :app:testDebugUnitTest :app:lintDebug :app:assembleDebug --console=plain
```

无签名 APK 仅验证编译，不能安装。生成可安装包时恢复原签名并去掉 -Punsigned。手环改动（构建需要原签名，npm 脚本会在缺失时拦截，禁止回退为 toolkit 默认签名）：

```powershell
npm --prefix wearable test
npm --prefix wearable run build
node tools/check-wearable-package.cjs
```

- 针对行为变化增加有意义的测试，尤其自动启动的去重、重试和结束状态；文档变动不必重跑构建。
- 构建后更新 `outputs/releases/<版本>/` 中交付文件和同目录 `SHA256SUMS.txt`。推送手机后核对 SHA-256，并分别记录「已构建」「已传输」「已安装」「真机已验证」。
- 更新交接记录时保留未验证的限制，不能把计划写成实现。
- `site/` 按用户要求纳入 Git，不能恢复为忽略目录。改预览代码或内嵌声明后运行 `npm run site` / `npm run check:site`，源码与生成文件一起提交；Vercel 在仓库根目录读取配置、直接发布 site/，跳过安装和构建。云端现有项目需已关联 mine 的 main；未核对云端前不能声称部署已更新。
- 网站演示地址为 https://wrist-navigation.vercel.app/ ，本地 `site/` 修改不等于已经部署。预览页需保留虚构数据、非真机验收、第三方托管隐私、原作者、MIT 与字体 OFL 声明。README 旧截图 `docs/images/wearable-native-024.png` 按用户要求保留，不再展示；不要删除或覆盖。

## ADB 与本地数据

- 本次 ADB 为 `.local/adb/platform-tools/adb.exe`；截图工具也支持 ADB / ANDROID_HOME 环境变量和 PATH。每次联调先运行 `adb devices -l`，不要假定手机仍连接、解锁或处于上次页面。
- 手机截图使用 `node tools/phone-screenshot.cjs`，输出 `.local/screenshots/phone.png`；不要通过 PowerShell 文本重定向保存 PNG。
- UI 自动化必须以新鲜的 UI 树或截图为依据；`uiautomator dump` 超时、空树或页面被用户切换后，不能用旧坐标继续点击。
- 原始手机截图为 1200×2670，工具展示时可能缩放；点击坐标要按原始尺寸换算。
- 采集高德通知使用 `tools/capture-amap.ps1`。该手机可能忽略 `dumpsys notification` 包过滤，脚本会在保存前二次过滤。不要直接输出或保存所有应用的通知；`dumpsys notification --help` 在此手机也可能直接输出通知。
- `.local/`、签名目录、通知样本和工具缓存不应公开。不要在文档或日志中写入 AuthKey、私钥、账号令牌或用户路线详情。
- 只检查任务相关应用的数据；暂停点击时应明确告知用户，避免与其同时操作手机。
