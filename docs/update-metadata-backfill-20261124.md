# 2026-11-24 · 正式 Latest 更新元数据补齐

## 修复范围

用户已装手机 0.4.1 / 手环 0.5.1，两个检查入口都提示「部分 Release 未提供 update.json；无法完整判断」。2026-11-24只读核对线上全部8个公开Release：三个Preview都有元数据，正式Latest v0.4.8缺少它。现有 `GitHubUpdateClient` 总会读取正式Latest；Preview勾选后再读取非草稿Pre-release，不读取其他旧正式版的元数据。

已于2026-11-24补充 [v0.4.8 的 update.json](https://github.com/worlt/wrist-navigation/releases/download/v0.4.8/update.json)，不修改应用检查逻辑、不重打包、不替换旧附件、不移动标签、不改变Latest或Preview状态。更早的正式Release此次没有补充。

| 字段 | 经原发布包核对的值 |
| --- | --- |
| releaseTag | v0.4.8 |
| applicationId | io.github.mi9pro.navigation |
| 手机 | 0.3.2 / code17 / NAV-PHONE-032.apk |
| 手环 | 0.4.6 / code20 / NAV-BAND-046.rpk、NAV-BAND-046-NOFONT.rpk |

版本以APK内嵌信息和两RPK的manifest为准，不从Release标签猜测，也不使用当前源码的0.4.1/0.5.1生成历史元数据。原六附件在补充前、后的匿名下载大小/SHA-256均与历史交付一致。

## 附件与校验

- Release id：443781004；新增update.json资产id：785450128。
- update.json：479字节；SHA-256：`3967457d6ccd93128031daaf606f470518fc6b7c3eddb17ef675c103bead7ebe`。
- [元数据逐字节副本](releases/v0.4.8.update.json)与匿名公开下载一致；GitHub资产digest也一致。
- 原 `SHA256SUMS.txt` 保留原字节，**不包含此次新增的update.json**；新增文件校验值单独记录在本节及GitHub资产digest，未冒充被旧校验表覆盖。
- 原本地 `outputs/releases/v0.4.8/` 六附件目录保持，不把增补文件放进去或改写其历史发布门禁。修复与基线证据保存在忽略目录 `.local/update-metadata-20261124/`；凭据只在上传时由Git credential helper读入内存，没有保存或加入应用。

## 验证结果

1. 修复前真实公开元数据快照输入现有Java检查代码：双端/双渠道都 `complete=false, missingMetadata=true`，与用户提示一致；已能读到Preview仍不能宣称完整。
2. 暂存补充后的元数据：四组都 `complete=true, missingMetadata=false`；正式候选为手机0.3.2/code17、手环0.4.6/code20，Preview候选为手机0.4.1/code26、手环0.5.1/code25。
3. 补充后匿名真实联网，用现有 `GitHubUpdateClient.online()` 验证相同四组结果；按用户当前phone code26 / band code25均无可升级版本，不降级。未知手环code0与旧安装版本的渠道守卫在快照及回归测试中通过。
4. Android132项（新增2项增补前后与防降级回归）、Node163项全通过。未修改手机/手环生产代码或依赖；没有重新构建发布安装包、推送源码或运行新云端CI，不引用旧CI代替此次验证。
5. 全8个Release的ID/标签/发布渠道/描述与所有原附件ID/大小/digest/更新时间等保持；所有远程标签refs保持；正式Latest仍为v0.4.8；原六附件再次公开下载验证一致。

上传后的第一次匿名列表读到GitHub短暂缓存（响应 `max-age=60`），完整保存首轮证据后重读已可见新增文件。若手机刚检查仍显示旧提示，稍等约一分钟再分别手动检查，不需要重装APK/RPK。手机原生UI和设备网络未在此次实际操作验收；电脑JVM联网通过不能扩大为手机实测。

## 回退范围

若新增元数据以后发现字段错误，只移除此次新增的资产785450128恢复基线，或在核对版本后单独纠正该元数据。不得删除Release、原安装包/许可/校验表，或移动标签/Latest。此次无需回退，最终公开字节与检查均通过。
