# 9 Pro / 10 Pro 共用版本：兼容实验规格

日期：2026-11-20。分支：`preview/band9-band10-compat`。
状态：用户已同意在无实机证据下先做防御性修复，并要求只在手机提供诊断入口；实现及本地验证完成，云端8组和匿名公开7附件通过，已发布Pre-release，正式Latest不变；详见docs/releases/v0.5.0-preview.1.md。

## 目标与已知事实

- 用户要求在新分支尝试一份可供小米手环 9 Pro / 10 Pro 使用的版本，完成后发布 GitHub Preview，不替换正式 Latest。
- 用户本次反馈：9 Pro 能使用的最高版本是 040；当前使用/关注的最新手环版本是 046。此反馈不代表 040 全功能逐项验收。
- 两款手环共用 336 × 480 布局；仅面板相同不能证明 API、生命周期和安装兼容。
- 实际仓库已有 v0.4.8 正式 Release（手环 046）和 v0.4.9-preview.1（手环 048）。本实验从已提交的 ad80126 开始，避免丢失已有工具链安全修复；不能把 Release 标签号和手环包内版本号混为一谈。
- 原 main 工作区存在手机 037/038/039、手环 049 等未提交候选修复。全部保持原样，本实验不自动纳入、不提交或发布它们。

## 已确认边界

- 保持包名、原配对签名、协议校验、336 × 480 显示与现有基本导航功能。
- 目标是共用同一套源码与安装包，不默认按型号分叉。完整版/无字体版可以继续作为可选资源变体，不代表不同机型。
- 振动或退出等接口如果确实在 9 Pro 不可用，应有明确降级；不能在没有固件契约依据时简单删除 manifest feature 或虚构型号检测。
- 不改正式 main、上游 origin 或历史 Release 附件。只向用户仓库 mine 推实验分支及新预发布标签。
- 发布说明必须区分单元测试、签名构建、模拟原生检查和两款手环的实际验收。没有设备证据时只能称兼容试验 Preview，不能声称已双机验证。

## 已定位的调查范围

`git diff v0.4.0 v0.4.6 -- wearable` 显示：

1. manifest 新增 system.vibrator / system.app；minAPILevel、deviceTypeList、designWidth 没变。
2. 040 的互联初始化在页面 onReady；046 新增 App 级会话，在 onCreate 里尝试初始化，页面再订阅会话。
3. 新增振动、退出、旅程提醒及 ACK/重试相关逻辑。
4. 原生调用已有 try/catch；这并不能证明安装器接受新增 feature，也不能证明固件支持 App 级回调。

以上都是待验证的兼容风险，不是已证明的根因。用户没有9 Pro或日志，因此按模拟旧固件风险先防御性修复，并用手机诊断/用户指南收集下一轮实机证据。

## 技术栈、命令与目录

- Vela 快应用，aiot-toolkit 2.0.5，CommonJS 业务模块；Node 测试与实际编译 RPK 的原生 mock 检查。
- Android Java / Gradle：用户要求手机诊断，新增手机主动查询/无路线复制，严格封包解析，不混入原工作区候选。
- 测试：`npm test`；针对行为变化先添加可复现的失败测试，再修复。
- 公开文件：`npm run check:public`；预览/站点：`npm run preview`、`npm run check:site`。
- 手环：`npm --prefix wearable ci --ignore-scripts`、`npm run check:toolchain`、`npm --prefix wearable audit --audit-level=low`、`npm --prefix wearable audit signatures`。
- 原签名构建：`npm --prefix wearable run build`、`npm run build:wearable:nofont`；产物使用 `tools/check-wearable-package.cjs` 和 `tools/verify-rpk-signature.cjs` 检查。
- 交付：`tools/check-release.cjs`；所有附件显式白名单，核对版本、SHA-256、许可及 update.json 渠道。
- 主要代码：wearable/src/app.ux、wearable/src/common/、wearable/src/pages/index/index.ux；测试：wearable/test/、tools/test/。
- 不新增依赖，不改变签名，不把 .local、signing、通知数据或令牌纳入 Git。

## 成功条件

- 能用模拟固件复现启动时序、状态字符串/缺失接口、检查失败与202回传风险，新增针对性回归；基础导航和原有10 Pro逻辑测试不回归。不要求在没有设备时宣称修复已知实机故障。
- 单元测试、源码门禁、工具链安全门禁、两种资源变体签名与编译后行为检查通过。
- 使用不与已发布/未发布候选混淆的版本和 versionCode。
- 在实验分支完成审查及 CI 后建立 Pre-release，保持正式 Latest 不变，公开下载附件与本地 SHA-256 一致。
- 真机验收不足的部分清楚记入 TESTING 和 Release 说明，提供 040 回退提示而不擅自传包/安装。

## 实机未知项

没有9 Pro失败阶段/日志，不继续阻塞本轮防御性试修。手环没有排查模式或新增诊断UI；手机读取手环内存元数据。无法进入应用的安装/崩溃问题仍需用户照片或工具日志。用户指南见docs/band9-band10-compatibility.md。

本地验证：156Node、129Android、Lint0错误3既有警告；工具链10项/审计0/704签名/162attestations，双RPK原签名/编译行为及真实native-wire→JVM通过。版本手机0.4.0/code25，手环0.5.0/code24。未传设备/安装/真机验收。
