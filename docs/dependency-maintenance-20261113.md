# 手环构建依赖维护 · 2026-11-13

本轮是独立的构建工具维护。官方 npm 审计从 **28 个受影响包（严重 2 / 高 15 / 中 8 / 低 3）降到 0**。28 是包含传递风险的包数，不是 28 个独立漏洞。手机源码、手环业务源码、协议、包名和签名身份未变；手机仍为 0.3.2/code17，手环仍为 0.4.6/code20。v0.4.8 已发布附件保持原字节，本轮重建包只用于维护验证，没有发布、传输或安装新包，也没有真机验收。

## 处理范围与版本选择

安装边界是 wearable/，根目录无第三方依赖。保留 aiot-toolkit 2.0.5；2026-11-13 从官方 registry 查询的 latest 仍是该版本。审计建议的 2.0.4 属于降级，未使用 npm audit fix --force。wearable/package.json 以明确 npm overrides 修复有漏洞的传递依赖，wearable/package-lock.json 固定整个依赖树及 integrity。

| 依赖或匹配范围 | 固定版本 | 处理原因 |
| --- | --- | --- |
| simple-git | 4.0.2 | 修复 Git 参数/配置安全检查，argv-parser 同步解析为 2.0.1 |
| adm-zip | 0.6.1 | 修复不可信 ZIP 的资源消耗、解压路径、权限与一致性问题 |
| tmp | 0.2.7 | 修复临时文件路径及符号链接问题 |
| @grpc/grpc-js | 1.14.7 | 修复证书授权上下文及错误消息泄露 |
| follow-redirects | 1.16.3 | 修复特定跨域重定向配置下的敏感请求头泄露 |
| source-map-js | 1.2.2 | 修复恶意 source map 引起的事件循环阻塞 |
| fast-uri | 3.1.9 | 使用修复版本，保留当前主版本 API |
| brace-expansion@^1 / @^2 | 1.1.22 / 2.1.8 | 修复花括号扩展的 CPU/递归风险，保留旧调用接口 |
| minimatch@>=7 | 11.0.8 | 修复新版本分支的文件匹配 DoS；旧 v3 分支不跨 API 强升 |
| glob@>=9 | 14.0.6 | 修复取消遍历的安全问题；旧 v7 调用接口保留 |
| ts-morph | 27.0.2 | 旧 common 使用可调用 minimatch 导出，需同步更新；保留 TypeScript 5.9，避免直接切到 TypeScript 6 |

这些依赖只在构建、开发 CLI 或模拟工具运行，不是 Android 运行时依赖。风险边界是下载模板/资源、处理不可信 ZIP、Git 选项、临时路径、源码和文件匹配表达式。这次维护不能替代一加手机的通知读取、解析、发送和 ACK 诊断，也没有证据表明原 28 项导致用户的手环旧左转问题。

## 安装脚本与兼容处理

wearable/.npmrc 固定官方 registry 并设置 ignore-scripts=true；packageManager 记录 npm@11.19.0。首次安装先禁用生命周期脚本，不运行未经审查的安装动作。本轮未启用任何依赖安装脚本：@parcel/watcher 的本地编译 hook、protobufjs 的兼容提示 hook、仅 macOS 的 fsevents hook 均禁用。Windows 已验证 @parcel/watcher 预编译绑定可以接收文件事件；Ubuntu 和 Node22/24 纳入 CI。macOS 未验证。

ignore-scripts 也会跳过 npm prebuild/prerelease/prestart。三个脚本现直接进入 tools/run-wearable.cjs，在执行工具前检查原签名；无字体入口也直接检查。缺少证书、密钥不配对或发布身份不一致时停止。回归测试以禁用生命周期脚本的真实 npm 命令确认 build/release/start 都不会进入 toolkit，更不会生成替代身份。

simple-git 4 的 CommonJS 导出不再是默认工厂，旧 toolkit 的 NetworkUtil.gitClone 会报“default is not a function”。tools/prepare-wearable-toolchain.cjs 对安装目录中的这一处导入做明确替换，改用公开 simpleGit 工厂。补丁只接受 aiot-toolkit 2.0.5 / simple-git 4.0.2 和预期原文，重复执行无副作用，其他版本或无法识别的导入会失败，要求重新审查。每次 npm ci 会恢复原依赖，检查与构建入口会重新准备；不依赖 npm postinstall，也不提交 node_modules。registry 签名校验对应下载的原始包，兼容补丁另由本仓库代码审查和 Git 克隆测试验证。

## 复现

使用 Node.js 22/24，在仓库根目录运行：

~~~sh
npm install --global npm@11.19.0 --ignore-scripts --registry=https://registry.npmjs.org/
npm run deps:wearable
npm run check:toolchain
npm test
npm --prefix wearable audit --audit-level=low
npm --prefix wearable audit signatures
npm run check:public
npm run check:site
~~~

构建需私下恢复现有原签名，不能重新生成身份：

~~~sh
npm run build:wearable
node tools/check-wearable-package.cjs wearable/dist/io.github.mi9pro.navigation.debug.0.4.6.rpk
node tools/verify-rpk-signature.cjs wearable/dist/io.github.mi9pro.navigation.debug.0.4.6.rpk
npm run build:wearable:nofont
~~~

无字体命令自动检查编译后行为和原签名。Windows 本机需使用真正的 npm.cmd；此电脑可用 C:/E/nodejs/npm.cmd，避免 PATH 中其他同名入口。本机 Node v24.21.0 / npm 11.19.0，使用原锁文件干净安装；候选与正式目录均审计为零。正式安装的 703 个包通过 registry 签名校验，其中 158 个通过 attestation 校验。

## 验证与结果

- 133 项根目录测试通过，含禁用生命周期脚本后的签名防绕过回归；根目录测试仍无需安装第三方依赖。
- 6 项工具链检查通过：ZIP 写/读/解压与路径穿越、预存符号链接拒绝；真实 toolkit 文件筛选与 rimraf glob 删除；external-editor 临时文件及非法路径拒绝；本地 Git 模板克隆与危险 sshCommand 配置拒绝；UX AST/循环绑定；预编译文件监听事件。
- 完整字体和无字体两版均重新编译，通过编译后导航、ACK、退出取消/去重、振动、页面生命周期、资源/设置行为与原证书 RPK 签名验证。
- 两版分别与维护前 RPK 解包比较：完整包 714 个条目、无字体包 707 个条目，业务代码、字体、箭头及其他资源逐项字节一致。仅 manifest.json 的 packageInfo.timeStamp、META-INF/build.txt 的 timeStamp 和对应 META-INF/CERT 签名内容变化；整包哈希因此不同，不声称 RPK 整包字节相同。
- .github/workflows/checks.yml 新增 Windows/Ubuntu × Node22/24 四组工具链检查，干净安装、兼容测试和零审计为必过项；原四组无依赖源码检查继续保留。CI 不持有私有签名，不生成安装包，不验证真机。

证据和重建包留在忽略的 outputs/maintenance/dependencies-20261113/ 与 .local/dependency-maintenance/。基线包和 v0.4.8 发布目录保留，避免把依赖维护包当成已发布包。

## 剩余维护事项

npm install 仍提示 8 类 deprecated 包：inflight、@humanwhocodes/config-array、rimraf 3、glob 7、koa-router、@humanwhocodes/object-schema、jsrsasign、eslint 8。这些是上游停止维护或迁移建议，区别于本次已归零的 npm 已知漏洞审计；其中旧 glob/rimraf 分支仍用于旧调用接口。本轮不盲目跨所有 API 大版本替换，后续需要独立迁移验证。完整字体构建的三份 TTF 大于 1MB 提示是原有资源提示，仍需真机观察性能。

审计为零只表示此次 registry 数据没有报告受影响版本，不保证没有未知漏洞；registry 签名和 attestation 也不等于代码绝对安全。新增上游版本时应重新审查补丁、安装脚本、原签名入口和两版编译输出，不应直接删除 overrides。

官方来源：npm registry 包元数据与审计接口，npm [ignore-scripts 文档](https://docs.npmjs.com/cli/v11/using-npm/config#ignore-scripts)、[audit signatures 文档](https://docs.npmjs.com/cli/v11/commands/npm-audit#verifying-registry-signatures)、[simple-git 源码](https://github.com/steveukx/git-js)、[adm-zip 源码](https://github.com/cthackers/adm-zip)。本机原始审计、选定版本元数据和完整执行日志保存在 .local/dependency-maintenance/；原 28 项分类见 outputs/reports/wearable-dependency-audit-20261113.md。
