# 飞书 macOS 可行性验证

脚本默认检查 `/Applications/Lark.app`。请用普通用户运行，写入权限不足时会单独提示输入管理员密码。

所有阶段均由你手动执行。脚本检查飞书主进程和应用包内的辅助进程，仍有进程时拒绝修改；启动和退出飞书由你完成。

## 1. 检查

飞书正在使用时也可以运行：

```bash
/Users/miku/projects/didactic-doodle/scripts/macos-probe.command check
```

输出安装路径、版本、签名状态、当前进程和补丁目标。当前客户端的消息页使用 `runtime~messenger` 脚本，脚本会检查它确实被消息页 HTML 引用。

## 2. 备份并应用

完全退出飞书后运行：

```bash
/Users/miku/projects/didactic-doodle/scripts/macos-probe.command apply
```

此阶段先完整备份应用包，校验文件 SHA-256、权限、符号链接和原签名，再向消息页脚本追加一个右下角 `WAL macOS TEST` 标记。其他 ASAR 文件内容及元数据保持原值。

备份和报告保存在 `~/Library/Application Support/WAL/macos-probe/`。当前安装包约 1.8 GB；脚本会为备份和恢复预留约 4 GB 空间。成功恢复后会同时保留原包备份及测试过的应用包。

本阶段保留原签名，因此修改后的资源签名校验失败是预期结果。接下来手动打开飞书，记录：

- 能否正常启动。
- 消息页右下角是否出现 `WAL macOS TEST`。
- 已有登录态、消息列表和现有会话页面是否正常。

## 3. 可选：临时签名

需要对比重新签名后的行为时，完全退出飞书，再运行：

```bash
/Users/miku/projects/didactic-doodle/scripts/macos-probe.command resign
```

此阶段将应用包内已签名的 Mach-O 和嵌套包由内向外进行 ad-hoc 签名，保留各自的 identifier、entitlements、flags 和 runtime。它会改变应用的代码身份，登录态及钥匙串访问需要实际验证。签名校验通过后，手动启动飞书，观察与上一阶段相同的结果。

重新签名会修改可执行文件，因此恢复使用完整应用包备份。[Apple 的签名与嵌套代码说明](https://developer.apple.com/library/archive/technotes/tn2206/_index.html)

## 4. 保存报告并恢复

保存当前阶段的签名结果、进程和补丁目标：

```bash
/Users/miku/projects/didactic-doodle/scripts/macos-probe.command report
```

然后完全退出飞书，恢复官方原包：

```bash
/Users/miku/projects/didactic-doodle/scripts/macos-probe.command restore
```

恢复前会重新验证备份；完整原包会先复制到暂存目录，校验通过后再替换安装目录。恢复成功时会再次验证文件哈希和原签名，再手动打开飞书。恢复被中断后可再次运行同一命令。

如果飞书版本已改变，脚本会停止覆盖并保留备份，避免将新版本降级。报告会打印 `report.json` 的具体路径；反馈时附上报告及手动观察结果即可。

## 脚本测试

```bash
cd /Users/miku/projects/didactic-doodle
/usr/bin/python3 -I -m unittest discover -s scripts/tests -v
```

测试使用临时目录内的微型签名应用，验证真实 `ditto`、`codesign` 和恢复流程，以及运行中拦截、备份损坏、版本变化和恢复中断。
