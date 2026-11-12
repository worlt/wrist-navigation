# 开发环境与首次检出

项目不绑定开发电脑。仓库可放在任意目录；界面预览和 JavaScript 测试不依赖手机、手环、原签名或 Android SDK。运行端目前适配 Android 手机 + 小米手环 10 Pro，9 Pro 共用同一布局但自 0.3.3 起未回归测试，其他穿戴设备尚未适配。

首次使用安装包请看 [首次使用](getting-started.md)，参与开发请看 [贡献指南](../CONTRIBUTING.md)。公开源码不包含私有签名和本地 `outputs/` 安装包。

## 只开发界面：Node.js 即可

安装 Node.js 22+（推荐 24，见 .nvmrc），在仓库根目录运行：

~~~sh
npm run doctor
npm test
npm run dev
~~~

根目录没有第三方依赖，无需先运行 npm install。测试覆盖手环协议、页面生命周期和开发工具。

提交前在完整 Git 检出中运行 `npm run check:public`（需要 Git）。它检查当前候选文件、暂存区和全部本地可达历史的禁止路径及少量凭据模式；浅克隆会被拒绝，应先获取完整历史。CI 在 Windows/Ubuntu 与 Node.js 22/24 上执行 JS 测试、公开文件检查及源码预览生成和已提交 site/ 与源码一致性检查，不持有签名，也不验证真机或 Android 编译。

本地入口与线上入口的首页不同：本地服务的根路径是源码交互预览，静态站点的首页是箭头总览。

| 页面 | 本地地址 | 线上地址 |
| --- | --- | --- |
| 手环交互预览 | [preview.html](http://127.0.0.1:4173/preview.html)（也可用根路径） | [交互预览](https://wrist-navigation.vercel.app/preview.html) |
| 箭头总览 | [index.html](http://127.0.0.1:4173/index.html) | [演示首页](https://wrist-navigation.vercel.app/) |
| 设置设计原型 | [settings.html](http://127.0.0.1:4173/settings.html) | [设置原型](https://wrist-navigation.vercel.app/settings.html) |

源码预览有 18 个导航、环岛和设置场景，各自可操作和保存偏好；箭头总览支持线条 / 实心、颜色、粗细和大小对照，可展开全部 616 张资源。设置原型保留早期设计，其本地字体回退不等于手环内置字体。源码预览和设置原型都使用虚构数据，浏览器模拟接口不能证明真机显示、后台通信、常亮或耗电。

“npm run preview”、“npm run settings”、“node tools/preview-icons.cjs”分别生成独立 HTML 到被忽略的 outputs/previews/。本地服务只监听 127.0.0.1，提供固定预览路径，不暴露源码、签名或手机截图。PORT 环境变量可调整端口；修改预览输入后自动重建，修改生成的 PNG 后运行“npm run site”并刷新页面。

## 生成网站与部署到 Vercel

~~~sh
npm run site
~~~

生成 site/index.html、site/preview.html、site/settings.html，以及 site/licenses/ 中的 MIT、隐私、项目与使用声明、第三方声明和三份字体 OFL。字体和图片内嵌在 HTML 中，源码预览体积较大；具体大小以构建输出为准，不需要后端、手机或 Android SDK。

- `site/` 已纳入 Git；Vercel 直接发布仓库中已生成的页面，不在云端安装依赖或重新构建。`vercel.json` 已配置 `framework: null`、空 `buildCommand`/`installCommand` 和 `outputDirectory: site`。
- 现有 Vercel 项目只需一次在 Settings → Git 关联 `worlt/wrist-navigation`，Production Branch 选 `main`；Root Directory 留空（仓库根目录），Framework Preset 选 Other，Output Directory 选 `site`。不要把 Root Directory 也设为 `site`，否则会重复解析路径；无需删除或重新创建项目。
- 已关联 Git 后，每次推送 `main` 由 Vercel 自动生成新生产部署；不是网站实时从 GitHub 读取文件。若尚未关联 Git，则单纯推送不会更新现有手动部署。
- 修改页面、内嵌模块或声明后，在本地依次运行 `npm run site`、`npm run check:site`，把源码与生成后的 `site/` 一起提交并推送。CI 会检查三页和完整声明是否与当前源码一致，防止忘记更新生成文件。
- 若保留手动部署方式，仅上传整个 `site/`（包括 `licenses/`）；不要上传项目工作目录、签名、`.local/` 或 `outputs/`。Git 自动更新应使用上面的现有项目关联方式。
- Git 自动部署只会包含已经提交和推送的内容。本地生成成功、README 修改或安装包构建成功都不等于线上站点已更新。
- 每个独立 HTML 都包含完整版权和字体许可，保持内嵌声明及 licenses/ 原文。网站声明由 tools/preview-notices.cjs 统一生成；隐私规则见 [PRIVACY.md](../PRIVACY.md)，字体条件见 [字体使用与验证](fonts.md)。

已部署地址为 [wrist-navigation.vercel.app](https://wrist-navigation.vercel.app/)。Vercel 提供 vercel.app 子域名，不需要购买域名。网页只演示虚构数据；访问托管站点会产生网络请求，不能承诺零日志。发布后核对三个页面、默认值、声明入口及资源加载，不把本地截图当作线上已更新的证据。

## Android 检查与无签名构建

需要 JDK 17+、Android SDK Platform 35、Build Tools 34.0.0、Platform Tools。Gradle Wrapper 固定为 8.9（带下载校验），AGP 8.7.3，不需要全局 Gradle。通过 JAVA_HOME 选择 JDK，通过 ANDROID_HOME 或被 Git 忽略的 android/local.properties 配置 SDK。

本机路径通过 JAVA_HOME、ANDROID_HOME 和被忽略的 android/local.properties 配置，不要求与维护者使用同一目录。签名身份在维护者私下管理的 signing/ 和 wearable/sign/ 中；迁移时恢复原证书，不能重新生成第二套身份。

小米互联 SDK AAR 不在仓库中。Windows 从项目根目录运行 tools/fetch-xiaomi-sdk.ps1，从官方示例包下载并核对 SHA-256。macOS/Linux 可下载相同的 [官方 ZIP](https://cdn.cnbj3-fusion.fds.api.mi-img.com/quickapp-vela/interconnect_dev_test_demo.zip)，提取 interconnect_dev_test_demo/libs/xms-wearable-lib_1.4_release.aar 至 android/app/libs/，核对 SHA-256 为 9c40fd1c5409bb948523d503af71e2978ae522c35636afe7d64f474c0f6bc195。

没有原签名也能检查和编译，显式使用 -Punsigned：

~~~powershell
.\android\gradlew.bat -p android -Punsigned :app:testDebugUnitTest :app:lintDebug :app:assembleDebug --console=plain
~~~

macOS/Linux 使用 sh android/gradlew 替换 .\android\gradlew.bat，其余参数相同。无签名产物为 android/app/build/outputs/apk/debug/app-debug-unsigned.apk，仅用于验证编译，不能安装或覆盖现有应用。去掉 -Punsigned 后使用原配置签名；缺少 signing/development.p12 会失败，不会生成另一套身份。

## 生成可安装包

手环提供完整字体与无字体两种构建。`npm run build:wearable` 保持完整字体构建；`npm run build:wearable:nofont` 从临时源码副本生成仅系统字体的包，并自动检查编译后行为和原签名。两版共用包名、版本与手机配套，具体输出和复现方法见 [手环两版构建说明](wearable-variants.md)。

原签名代表应用身份，不绑定电脑。可以通过可信的私下备份迁移至新电脑，也可以将打包集中在持有原签名的构建机；本仓库尚未配置远程签名服务。

恢复原文件：

~~~text
signing/development.p12
signing/passwords.properties
wearable/sign/debug/private.pem
wearable/sign/debug/certificate.pem
~~~

不要用新签名替代原身份。已安装包不能还原签名私钥。tools/prepare-signing.ps1 仅从现有手环 PEM 导入手机密钥库，不生成新身份；缺少手环原证书时会停止。私钥和口令配置始终被 Git 忽略。`signing/passwords.properties` 只在本机保存 `password=<原密钥库口令>`，也可由 `WRIST_SIGNING_PASSWORD` 环境变量提供；勿把真实口令放进命令行、文档或提交。缺少口令时使用 `-Punsigned` 做编译检查；不要轮换原证书。

~~~sh
npm run deps:wearable
npm --prefix wearable test
npm run build:wearable
node tools/check-wearable-package.cjs
~~~

依赖由 wearable/package-lock.json 锁定（aiot-toolkit 2.0.5）。prebuild 在缺少原手环证书时停止，避免 toolkit 回退到自带证书；start 和 release 也有签名前置检查。检查确认文件完整和密钥配对，不代替 APK/RPK 身份一致性及真机验证。发布包需另按 toolkit 约定恢复原发布签名，并与 debug 证书保持同一身份。

RPK 当前源码输出为 wearable/dist/io.github.mi9pro.navigation.debug.0.4.6.rpk（手机 0.3.0 / 手环 0.4.6，为 v0.4.6 Latest 的源码配套；正式发布不代表本版真机验收，见 [发布介绍](releases/v0.4.6.md)）。可使用 `node tools/verify-rpk-signature.cjs wearable/dist/io.github.mi9pro.navigation.debug.0.4.6.rpk` 检查包内签名与摘要。仅通过 AstroBox「快应用」安装至手环，方法见 [安装指南](band-install.md)。手机 APK 与手环 RPK 不可互换。

0.2.4 附加字体 TTF、许可和字符覆盖信息已经放入 wearable/src/common/，普通开发与打包仍只需 Node.js，不读取电脑安装字体。只有重新制作字体子集才需要 Python/fontTools 和原字体文件；来源、哈希及重建方式见 [显示设置记录](display-settings-024.md)。

## 真机联调

只有这一步需要手机/手环。每台新电脑首次连接都需要用户在手机确认 USB 调试授权。

1. 运行 adb devices -l，确认状态为 device。
2. 核对实际版本、通知使用权、同步开关、运动健康连接及互联授权。
3. 用户在高德自行开始导航，分别记录 SDK 发送、ACK、手环画面与锁屏表现。
4. 截图运行 node tools/phone-screenshot.cjs。ADB 按 ADB 环境变量、项目 .local/adb/platform-tools/、Android SDK、PATH 顺序查找，支持各系统文件名。

通知采集继续用 tools/capture-amap.ps1 二次过滤，避免保存其他应用通知。浏览器检查使用可用的浏览器调试工具，先核对当前页面，不把模拟结果写成真机验收。

## 本地资料与交付边界

.local/、outputs/、SDK 路径、缓存、签名、原始通知、手机截图和 SDK AAR 不纳入 Git。旧设计提案已归档到维护者本地，不是开发依赖。当前预览放在 `outputs/previews/`，候选安装包放在 `outputs/releases/<版本>/`，历史产物放在 `outputs/archive/`。构建、传输、安装和实际显示分别记录，见 [交接摘要](../HANDOVER.md) 与 [验证摘要](navigation-verification.md)。

2026-09-18 本次验证环境为 Windows、JDK 17、Node.js 24。其他系统入口按可迁移方式编写，尚未在 macOS/Linux 实测。
