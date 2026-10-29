# 腕上导航维护交接

更新日期：2026-10-28。工作目录以当前仓库根目录为准，与用户使用中文沟通。

## 2026-10-28 手环 0.3.2 / 手机 0.2.1（10 Pro 移植 + 双端同证书自建）

上一轮遗留的「手机端无节点」已解决：本机安装 JDK 17（Temurin 17.0.20.1）与 Android SDK（platform-35、build-tools 34/35、platform-tools），均在 `C:\E\dev-tools`（这台机器没有 E: 盘符，`C\E` 才是用户口中的 E 盘），`JAVA_HOME` / `ANDROID_HOME` / `ANDROID_SDK_ROOT` 已写入用户环境变量，`android/local.properties` 指向该 SDK。小米互联 AAR 从官方示例包取回并核对 SHA-256 `9c40fd1c…6bc195`。`signing/development.p12` 由 `wearable/sign/debug` 的 PEM **导入**（新增 `tools/ImportSigning.java`，导入前校验私钥与证书配对），`tools/prepare-signing.ps1` 不再在缺 p12 时生成新身份（原逻辑会覆盖手环 PEM，直接毁掉配对）。手机端重建后双端证书同为 `0B:6E:D8…:94`，**用户确认互联配对成功**。

## 2026-10-28 手环 0.3.2（小米手环 10 Pro 移植）

用户要求把手环端移植到小米手环 10 Pro（Vela 5.0 / 480×336），并保持与现有手机端协议兼容。10 Pro 与 9 Pro 共用 1.74 英寸 336 × 480 面板，所以没有重画界面；改动是新增 `wearable/src/common/geometry.js` 集中页面几何（288 内容宽、齿轮 136×400、设置区 66/398、导航区高度上限 166），`presentation.js` 与 `pages/index/index.ux` 改用该模块，manifest 与 package 版本升到 0.3.2 / code 12。包名 `io.github.mi9pro.navigation` 与签名身份未动，可与手机 0.2.1 任意顺序混用升级；v1 报文、`ready`/`ack`、同 session 递增 seq、20 秒过期、`keepScreenOn` 语义均未改。

验证：`npm test` 49 项通过（新增 3 项几何测试与 1 项载荷切换测试）。当前检出没有作者原签名，已按 fork 路径用 openssl 生成自签 RSA-2048 身份（`wearable/sign/debug/`，指纹 `0B:6E:…:94`），安装 aiot-toolkit 2.0.5 后构建出 `wearable/dist/io.github.mi9pro.navigation.debug.0.3.2.rpk`（8,170,413 字节，SHA-256 `55f22a56…43860`），`check-wearable-package` 与 `verify-rpk-signature` 均通过。

2026-10-28 真机情况：用户已把 0.3.0 装到 10 Pro，手环报「发送失败 202 invalid args」，手机端「等待手环连接」。已定位 202 为 `interconnect.send` 载荷结构不符（Vela 5.0 要求 `{ data: { data } }` 信封，9 Pro 容忍裸字符串），0.3.2 改为先发字符串、遇 202 自动切信封重发，并在设置页显示互联诊断行。手机端无节点是**另一个未解决**的问题，最可能是自签 RPK 与作者 APK 证书不匹配，需自建手机端验证。**不存在作者身份的 0.3.2 包。**

自签身份的约束：不能覆盖作者签名的 0.2.4（需先卸载）；手机 0.2.1 能否识别该 RPK 取决于小米互联是否只按包名配对，需实测；`wearable/sign/debug/` 必须备份，丢失后再构建就是另一个身份。

下一步最小动作：把 RPK 传到手机，用 AstroBox「快应用」装到 10 Pro，再用现成 0.2.1 APK 看 `isWearAppInstalled` 是否为 true；随后按 [10 Pro 移植说明](docs/port-10pro.md) 的 15 项清单逐项验收。若手机端认不出，则需自建手机端（JDK 17+ 与 Android SDK），包名与证书双端统一。验收前不要把 0.3.2 写成「已适配」。

## 当前版本与证据

- 手机：0.2.1 / code 6，已核对安装状态；发布候选为从设备恢复并验证的原签名调试 APK。
- 手环：0.2.4 / code 9，已构建、传至手机且核对 SHA-256，用户于 2026-09-22 确认安装使用正常。
- 已实现四种字体、全页面字号联动、箭头大小与粗细、设置滚动、保存和恢复默认。默认字号 30、箭头 42、粗细 8、图文间距 26；齿轮 42，点击区 64×64。旧设置保留。
- 本地 JS、RPK 编译/签名及浏览器交互检查已有通过记录；字体真实加载、资源性能、全部设置、长期锁屏、重启恢复、ACK 和耗电未逐项验收。详见 [验证摘要](docs/navigation-verification.md)。

## 本轮发布范围

用户要求先发布 GitHub，暂停米坛发布，发布前整理文件并参考近期同类项目。原创代码采用 MIT；“仅供学习、研究与技术交流”表达项目定位，不增加 MIT 之外的限制。联系邮箱为 2858005527@qq.com。

公开目录保留双端源码、测试、开发工具、当前截图与必要文档；旧设计图、提示词、米坛草稿和冗长开发记录归档在被忽略的 `.local/archive/github-prep-2026-09-23/`。历史安装包与旧源码 ZIP 在 `outputs/archive/2026-09-23/`。公开 Git 历史未改写，归档不表示旧提交中的已跟踪文档被抹除。

GitHub 仓库现已公开；[v0.2.4 测试版](https://github.com/Gu-Mie/wrist-navigation/releases/tag/v0.2.4) 已发布，标签对应提交 `0f89a92`。该提交的 Windows/Ubuntu × Node.js 22/24 四组 CI 全部通过；四个附件已在未登录状态下载并核对哈希，GitHub 自动源码归档为 188 个文件，不含签名、SDK AAR、安装包或本地资料。

发布附件位于 `outputs/releases/v0.2.4/`；当前预览输出到 `outputs/previews/`。用户随后要求按米坛发布表单截图准备填写文档，已生成 `outputs/publication/bandbbs-v0.2.4/米坛发布填写指南-v0.2.4.md`、纯文本正文、192×192 图标和源码预览图，使用实际 GitHub 下载链接；未向米坛提交资源。

## 仓库更名（2026-09-23）

仓库已改名为 `Gu-Mie/wrist-navigation`，Git origin、当前文档、Release 说明及本地米坛填写材料已同步使用新地址。保留 v0.2.4 标签、Release 和四个附件；安装包的包名、签名及校验值不变。本地工作目录仍以当前检出路径为准。已同步保留用户在 GitHub 对 README 的最新修改。

## 后续工作

1. 保留用户认可的手机界面与当前互联消息格式。
2. 双端必须保持包名 `io.github.mi9pro.navigation` 和原匹配签名；维护现有应用不得重新生成、轮换或公开私钥。
3. 如继续真机联调，先重新查 ADB 状态，只读取本项目与高德相关数据；传包后核对 SHA-256。
4. 优先核对字体实际变化、最大字号滚动、重开保存与导航结束/断连释放常亮；历史成功不替代当前版本验收。
5. 小米 SDK 保留第三方权利说明。已查看的文档未给出可确认的独立分发条款，不声称额外授权，也不把未知事项写成已确认的禁止发布规定。

源码位置与操作边界见 [AGENTS.md](AGENTS.md)，安装与开发入口见 [文档索引](docs/README.md)。
