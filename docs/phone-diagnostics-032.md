# 手机首页同步诊断 · 0.3.2

目标：让远程反馈能区分高德通知读取、文字解析、XMS发送和手环ACK四个阶段。默认折叠，首页只占一行；点击展开，在当前页面实时更新，可复制当前诊断文本。每次新建页面默认折叠，配置重建保留本次展开状态。

读取保留高德通知的字段名称和读取时间，区分多个通知及是否选为解析来源；只读取高德，内容有数量/长度上限，仅在内存保存，不自动写日志、文件或上传。解析显示状态、方向、当前指引距离及原文，无距离明确显示未提取。未读到或读取失败要明确显示，不能将旧结果标为当前。

发送显示消息编号、发送时刻、已发送的指引和SDK回调状态；SDK成功不等于收到ACK。确认显示与消息编号对应的ACK，旧ACK不能标记新消息已确认；当前解析已变化而未发送时必须提示等待发送新内容。ACK先到、SDK回调后到不得降低确认状态。断连或暂停保留历史证据并明确其归属。

实现顺序：先为诊断状态和乱序回调写失败测试，再实现内存状态与监听/发送接入，随后添加原生折叠界面和复制入口，最后验证、原签名打包并正式发布v0.4.8。手机0.3.2/code17，手环沿用0.4.6/code20两份原RPK。保持协议、导航解析、同步与签名行为。

验证命令：

```powershell
& android/gradlew.bat -p android -Punsigned :app:testDebugUnitTest :app:lintDebug --console=plain
& android/gradlew.bat -p android :app:assembleDebug --console=plain
npm test
npm run check:public
npm run check:site
node tools/check-release.cjs outputs/releases/v0.4.8
```

验收：折叠48dp单行，展开四项可选择文本；复制只由用户点击触发。测试覆盖读取异常、混合字段、长度边界、新解析未发、旧ACK与乱序回调。正式发布不等于一加/K80U真机验收，不声称修复本次一加导航问题。
