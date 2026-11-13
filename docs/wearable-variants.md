# 手环完整版与无字体版

2026-11-12 起，当前 [v0.4.7 Release](https://github.com/worlt/wrist-navigation/releases/tag/v0.4.7) 提供两种手环安装包，按需选择一个。

| 项目 | 完整版 | 无字体版 |
| --- | --- | --- |
| 文件 | `NAV-BAND-046.rpk` | `NAV-BAND-046-NOFONT.rpk` |
| 大小 | 11,004,746 字节（10.50 MiB） | 3,036,271 字节（2.90 MiB） |
| 字体 | 系统默认、宋体、楷体、圆体 | 仅设备系统字体 |
| 字体选择入口 | 保留 | 移除 |
| 设置底部版本文字 | v0.4.6 | v0.4.6 无字体版 |
| 字号、颜色、箭头、振动、手机联动 | 保留 | 保留 |
| 手机配套 | `NAV-PHONE-031.apk`，0.3.1 / code 16 | 相同；已有手环0.4.6只需更新手机 |

无字体版减少 7,968,475 字节，约 72.4%。它不内置或复制系统字库，使用手环固件提供的 `sans-serif`；字形覆盖取决于固件。体积减少不代表已经验证启动更快、内存或耗电更低。

两版都是手环 0.4.6 / code 20，包名 `io.github.mi9pro.navigation` 和原配对签名相同，均为 debug 构建。它们是同一应用的两种打包方式，不能同时安装。通过 AstroBox「快应用」导入所选 RPK；安装步骤见 [手环安装指南](band-install.md)。

从完整版覆盖到无字体版时，若安装工具保留应用数据，旧宋体/楷体/圆体设置会自动回退到系统字体，其余显示与振动设置继续保留。无字体版保存显示设置后，切回完整版需自行重新选择字体。同版本覆盖是否允许尚未真机确认；若安装器拒绝同版本覆盖，卸载手环应用后再装所选版本会清除手环设置，互联授权也可能需要重新确认。无需为此重置手环。

## 源码与构建

`wearable/src/` 始终保留完整字体版本。无字体版脚本从该源码创建临时副本，移除三份 TTF 及其字体许可、字体覆盖表、字体注册和字体设置行，限定设置为系统字体，完成构建和原签名/编译包检查后清理临时目录。完整源码与完整版包不会在此过程中被修改。

安装 Node.js 22+ 和锁定依赖，并从私下备份恢复原签名后，在仓库根目录执行：

```sh
npm --prefix wearable ci
npm run build:wearable
npm run build:wearable:nofont
```

完整版输出 `wearable/dist/io.github.mi9pro.navigation.debug.0.4.6.rpk`，无字体版输出 `wearable/dist/NAV-BAND-046-NOFONT.rpk`。本次发布保留初次发布的完整版原文件，只补充新构建的无字体版；构建时间戳与签名元数据会影响重新构建后的哈希。

v0.4.7 标签与 GitHub 自动源码归档包含无字体版构建脚本及手机后台退出修复。原 v0.4.6 标签保持初次发布内容，历史 Release 正文另附无字体版对应源码提交链接。v0.4.7 两份 RPK 沿用 v0.4.6 原字节，手环内部版本仍为0.4.6。

```sh
npm test
node tools/check-wearable-package.cjs outputs/releases/v0.4.6/NAV-BAND-046.rpk
node tools/check-wearable-package.cjs wearable/dist/NAV-BAND-046-NOFONT.rpk --no-fonts
node tools/verify-rpk-signature.cjs outputs/releases/v0.4.6/NAV-BAND-046.rpk wearable/dist/NAV-BAND-046-NOFONT.rpk
node tools/check-release.cjs
```

## 验证与许可

两版均通过编译后导航、ACK、双振、暂停/断连、页面生命周期、退出联动和设置检查。无字体版额外检查没有字体文件/引用/选择入口，旧字体设置在启动读取及保存时回退到系统字体，字号和其余选项继续有效。两版签名区、内容摘要、ZIP CRC 与原证书校验通过。

无字体版尚未传包、安装或真机验收；同版本互换、系统字形、后台、耗电等仍需真机反馈。其他手机未测试，9 Pro 自 0.3.3 起未回归。原版的新联动与双振等验证边界见 [发布说明](releases/v0.4.6.md)。

完整版继续随包包含三款字体的完整 OFL 许可。无字体版不分发这些字体，因此不打包相应字体许可；项目源码和 Release 共用的 `THIRD_PARTY_NOTICES.txt` 仍保留完整 MIT、字体 OFL、Apache/Gradle 等许可，适用于各自所含组件。
