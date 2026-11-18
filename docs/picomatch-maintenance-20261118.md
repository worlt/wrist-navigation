# picomatch 安全修复与构建维护 · 2026-11-18

## 修复选择

用户要求“修复再 release”。原始 [GitHub 公告 GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) 在 2026-11-18 核对时仍覆盖 picomatch <=4.0.7，官方 latest4.0.7，无官方 first_patched_version。本轮不降级 aiot-toolkit，不隐藏公告、不降低 npm audit 阈值。

使用明确 npm override：`picomatch: npm:@ryotsu/picomatch@4.0.7-a`。这是 [公开安全修复分支](https://github.com/ryotsu-kankichi/secured-picomatch/tree/3ab5a7627d480259e3d9ca67fbc14c125d374f0e)，**并非 picomatch 原维护者发布**。保留 aiot-toolkit2.0.5、已有其他 overrides、npm11.19.0 和禁用安装脚本；alias 覆盖所有 picomatch 消费者，包括原 v2 接口调用。精确版本及 SHA-512 integrity 入锁文件；工具链兼容性必须单独验证，不能因为重命名后 npm audit 为零就认定安全。

## 源码及供应链审查

- 下载 npm 原版4.0.7和 fork4.0.7-a 归档并逐文件比较。运行时代码只有 lib/parse.js 与 lib/constants.js 不同；入口、核心 picomatch API、scan、utils、posix 和 MIT LICENSE 原字节不变。
- 安全修复在重复 extglob 中分析单分支星号：仅可证明等价时消除冗余重复；无法证明的复杂形式按现有安全策略字面化。分支还含原项目后续 globstar/换行、POSIX标点/否定与相邻字面量匹配修复，均纳入测试，而非声称只有单行改动。
- npm 构建来源证明指向上述确切 commit/tag4.0.7-a；公开 tarball 的每个运行时文件与 commit 归档逐字节一致。没有新增运行时依赖或安装钩子。npm registry 签名和 attestations 核对通过，不是只读取未验证的来源 JSON。
- `tools/dependency-test/picomatch-security.test.cjs` 针对所有已安装副本校验 identity/version/integrity/registry 地址和两份审查代码 SHA-256，发现漂移即失败。
- 原官方4.0.7攻击 `+(*a)` / 80个a加感叹号在2秒受限子进程超时，修复版14组攻击在默认/windows/capture模式、每个实际副本中均按时完成。恶意输入只在子进程测试，不在主进程无界执行。
- 有限匹配语料覆盖12种模式、5组参数，验证可安全化重复的语义；另验证复杂模式与转义/引号/括号字面量。不是全面安全保证。
- anymatch/readdirp/tinyglobby 的源码文件选择实测通过；旧6项ZIP、Git、UX解析、临时文件、监听兼容测试仍通过，合计10项工具链测试。安全分支的完整2004项测试也在隔离忽略目录执行通过。

## 验证结果

干净 `npm ci --ignore-scripts` 后官方 npm11.19.0 audit（阈值low）**0漏洞**；704个安装依赖registry signatures核对通过，162个包attestations核对通过。既有8类deprecated警告仍存在，不因审计归零就称依赖都长期维护。

149项项目Node测试与122项Android单测/Lint（0错误/3既有警告）、原签名APK及双RPK构建/编译行为/版本ready与查询/共享证书/嵌套签名另核对。Android输入不变，本轮使用Gradle匹配缓存；手环完整/无字体包实际重建。手机仍0.3.6/code21、手环仍0.4.8/code22，不为纯构建依赖维护虚增业务版本。

重建的两RPK与原候选 ZIP条目比较：代码、字体、图像、页面和资源字节相同；只有 manifest.json 的 packageInfo.timeStamp、META-INF/build.txt 时间戳和对应 META-INF/CERT 改变。原手机APK字节保持。旧候选另存，未替换已公开v0.4.8附件。三大TTF大于1MiB的既有构建警告仍在，真机字体性能待验证。

本地日志在忽略目录 `.local/release-049-fix/`；包含官方公告、registry、公开源码/来源证据、原版复现、干净安装审计签名、2004项分支测试、10项工具链测试、Android/双RPK构建和包差异。高置信度公开文件/历史/候选附件扫描另执行，不能保证不存在任意秘密或供应链风险。

## 发布门禁

修复源码分步推mine/main后，仍须核对Ubuntu/Windows × Node22/24全部8组CI通过，才给相应提交创建v0.4.9-preview.1标签和GitHub Pre-release。旧失败运行44299055346保留作历史，不能删除失败历史来声称通过。实际CI、交付哈希、公开下载与Release状态以HANDOVER顶部为准；本文件不能把“准备”解读成已发布。

发布只上传APK、两个RPK、update.json、TESTING.txt、完整许可、SHA256SUMS七个明确附件；Preview不替代正式Latest v0.4.8。未传设备、安装或本版真机验收，手机匿名网络/独立Preview持久化/固件物理刷新与耗电仍待用户设备验证。

## 修复提交 CI

维护提交 `4b6b5ac65d90986a50206aff955ec67ae1b021db` 的 [Actions44304981188](https://github.com/worlt/wrist-navigation/actions/runs/44304981188) 已完成，4组源码+4组工具链 **全部8组通过**，工具链包含安全回归、npm audit及registry签名门禁。最终发布准备提交仍单独核对CI，Release实际结果见HANDOVER顶部。

## 最终发布结果

最终标签提交dd9726ea6ea59a7295d44123816f13d9f64d20e9的 [Actions44306028472](https://github.com/worlt/wrist-navigation/actions/runs/44306028472) 全8组通过。v0.4.9-preview.1已于2026-11-18本地20:54:34发布Pre-release449974357，七附件匿名下载字节一致，正式Latestv0.4.8/六附件保持。实际包SHA/CI/上传超时恢复/公开API限流和验证边界见HANDOVER顶部；旧“待发布”段保留为过程历史，未传设备/安装/本版真机验收。
