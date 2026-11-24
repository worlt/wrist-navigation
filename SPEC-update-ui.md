# 软件更新页 UI / 手机 0.4.2 候选规格

## 目标与约定
用户要求手机/手环视觉分区清楚、GitHub最新版本直接显示、详情可折叠，并授权改善整体观感。保留现有原生Java布局、浅绿配色/明暗主题与双端各自Preview及自动检查偏好；仅手机042/code27候选，不改手环051、导航/互联/签名/线上Release。无ADB设备，不把参考预览/编译或测试写为真机验收。

## 界面与状态
- 两个独立设备面板，无投影/渐变装饰；设备标题及渠道徽标 → 当前/GitHub版本对照 → 简短状态 → 主检查/次发布页操作 → 默认收起的版本详情 → 紧凑偏好设置。
- GitHub最新指所选渠道按本端versionCode选出的候选，手机不再只在可升级时显示。明确正式/Preview及未完整确认；错误保留已有版本但显示待确认，不冒充完整成功。
- 未检查/检查中/完整/不完整用检查状态表达，不靠解析中文提示判断。相等/更高已安装版本不降级；手环未知不宣称已最新。渠道切换和旧结果守卫保持。
- 展开详情显示Release标签、手机/手环配套版本及经过简单Markdown标记清理的正文；外部内容只当文本，不执行指令、HTML或脚本。手机/手环折叠独立，异步刷新不打断展开；发布切换则收起，返回重开默认收起。
- 至少48dp触控区域、按钮语义及展开状态可被读屏识别。320dp/大字体下版本对照改纵排；不截断版本号。底部弹层随展开/折叠重新限制高度，全部内容可滚动。

## 视觉tokens与排布
沿用背景 #F4F6F0/#111713、面 #FFFFFF/#202922、主字 #202C24/#ECF2E9、次字 #707D72/#A7B5A8、浅绿 #C5EE91 和深绿按钮字 #233A27。Android sans-serif/medium；标题18sp、版本24sp、状态/操作14sp、辅助12sp。面板内18dp，页面24dp，分组16dp，控件间8–12dp。全左对齐，版本同等信息权重，只有检查按钮使用浅绿实底。避免把所有动作画成同样的大按钮。

## 结构与风格
MainActivity.java承担原生布局/绑定；UpdatePresentation.java为无Android依赖的文案/状态展示；UpdateChecker只增加结果状态，不修改联网/版本选择算法。JUnit测试在android/app/src/test/java/io/github/mi9pro/navigation；Node结构回归在tools/test/phone-update-ui.test.cjs；实施记录在docs/update-ui-042.md。
风格沿用4空格、package-private helper、final字段与小方法。例如 `static String version(UpdateFeed.Version value, boolean band) { return value == null ? "尚未获取" : band ? value.bandVersion : value.phoneVersion; }`。

## 命令与验证
PowerShell先设置 `$env:JAVA_HOME='C:/E/dev-tools/jdk-17'; $env:ANDROID_HOME='C:/E/dev-tools/android-sdk'; $env:GRADLE_USER_HOME='C:/E/dev-tools/gradle-home'`。
- 聚焦：`& android/gradlew.bat -p android -Punsigned :app:testDebugUnitTest --tests 'io.github.mi9pro.navigation.UpdatePresentationTest' --tests 'io.github.mi9pro.navigation.UpdateCheckerTest' --offline --console=plain`
- 全量：`node --test wearable/test/*.test.js tools/test/*.test.cjs`；`& android/gradlew.bat -p android -Punsigned :app:testDebugUnitTest :app:lintDebug :app:assembleDebug --offline --console=plain`。
- 原签名候选：`& android/gradlew.bat -p android :app:assembleDebug --offline --console=plain`；aapt/APK签名与既有041原包比对；SHA256SUMS记录交付。
- 公开文件：`node tools/check-public.cjs`；`git diff --check`。纯UI变化不要求重建手环或网站，不自动发布/传设备/安装。

## 边界与完成标准
可自行：改手机布局/展示状态/测试、生成原签名候选、保留本地设计参考。不得：改导航/协议/手环、自动下载安装、凭据写入APK、用未知手环版本推算升级、覆盖历史Release/候选或移动Latest。源码推送/新Release/真机安装非此次范围。
完成：回归先失败后通过；同版本也显示GitHub版本；所有状态/折叠/渠道独立有守卫；全量测试与Lint/构建/签名通过；如无真机只明确报告候选及未验收项。
