# macOS

## 运行

支持 macOS 13.3 及以上，分别生成 Apple Silicon 和 Intel 产物。安装 Node.js、Yarn、Rust stable、Xcode Command Line Tools 后执行：

```sh
yarn install --frozen-lockfile
yarn tauri dev
```

生成当前架构的应用：

```sh
yarn tauri build --bundles app
```

产物为 `src-tauri/target/release/bundle/macos/wal-assistant-lark.app`。不指定 `--bundles app` 时还会生成 DMG。macOS 专用配置在 `src-tauri/tauri.macos.conf.json`，不改变 Windows 安装包。

WAL 自身使用 ad-hoc 签名，尚未配置 Developer ID 和 Apple 公证。公开分发所需的证书配置见 [Tauri macOS 签名文档](https://v2.tauri.app/distribute/sign/macos/)。这与飞书的签名处理是两件事：应用主题时保留飞书原有签名数据，不执行重签；恢复原始 ASAR 字节后恢复其资源签名有效性。

## 飞书定位与主题

依次检查 `/Applications`、`~/Applications` 中的 `Lark.app`、`Feishu.app` 和 `飞书.app`，再通过 Spotlight 查找同名应用。校验应用标识 `com.electron.lark`，并解析 Framework 的 `Versions/Current`，资源目录必须仍在应用包内。

主题里的 ASAR 路径相对于该版本的 Framework `Resources` 目录。例如：

```yaml
id: macos-messenger-example
name: 消息页示例
asarPatches:
  webcontent/messenger.asar:
    - kind: main-script
      subject: messenger
      styleOverridesBySelector:
        body:
          font-family: '-apple-system, sans-serif'
      colorOverrides: {}
      enableDevTools: false
```

Windows 主题的反斜杠路径会自动规范化；ASAR 文件名和内部目标仍须与当前飞书版本对应。不会将不存在的文件猜测映射到其他归档。`main-script` 优先选择唯一 JS；遇到拆分的模块时，核对 HTML 页面引用的唯一 `runtime~<subject>`。无法确认时返回错误，固定 `kind: file` 目标仍可使用。

注入脚本等待 DOM 就绪，使用独立的 style 元素。归档重写保留未修改文件的内容、元数据、外置文件声明和链接，只更新目标内容及对应的 SHA-256 完整性信息。

## 备份和恢复

首次应用或恢复前，需要在系统设置 → 隐私与安全性 → App 管理中允许 `wal-assistant-lark` 修改其他应用。WAL 检查到系统拦截时会先显示授权引导，可直接打开该设置页；开启后返回 WAL 选择「已允许，重试」。列表中没有 WAL 时用 ＋ 添加当前 `.app`；系统要求重新打开时，重启 WAL 后再操作。

App 管理授权与管理员密码是两种权限。检查会在飞书资源目录创建并立即删除临时文件，不改动现有资源；遇到 App 管理拦截时停止，不继续尝试提权。普通文件所有权限制仍会使用管理员授权。若检查后权限被撤销，实际写入遇到系统拦截也会显示同一引导。

- 备份在 `~/Library/Application Support/com.miku.wal/asar-backups/`，不写入飞书应用包。
- 只备份涉及的 ASAR。安装位置与版本指纹分别隔离备份；同一版本的原始备份会复用。
- 每次写入前检查版本、文件哈希和飞书进程，包括显示授权对话框之后。目标目录需要权限时使用 macOS 管理员授权对话框。
- 所有目标准备完成后统一写入，先完成暂存与校验，再用同一磁盘上的 rename 替换目标。批量写入发生常规错误时回滚已替换文件；中断后可通过「恢复到官方原版」恢复已记录的资源，并清理对应的暂存目录。
- 恢复只接受原始内容或 WAL 已记录的补丁内容；遇到外部修改、备份损坏或旧版本资源时停止覆盖并显示错误。
- 多个 WAL 实例通过文件锁协调写入。应用和恢复操作在后台执行，窗口仍可响应。

备份不包含聊天数据。早期可行性脚本的整包备份仍在 `~/Library/Application Support/WAL/macos-probe/`；桌面应用不会使用或自动清理这些备份。

## 验证

常规测试：

```sh
yarn test
yarn build
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

本机已安装飞书时，可额外运行真实 ASAR 副本测试。它读取安装目录，将归档复制到临时目录，在副本上应用并恢复，然后用独立解析器核对所有文件；不修改或启动真实飞书：

```sh
cargo test --release --locked --manifest-path src-tauri/Cargo.toml \
  installed_messenger_archive_round_trip -- --ignored --nocapture
```

首次验证具体飞书版本时，可导入 [验证主题](../examples/macos-test.yaml)，退出飞书后从 WAL 应用，手动打开飞书确认右下角标记；再次退出后从 WAL 恢复官方原版，并检查启动与登录状态。需要检查原签名时执行：

```sh
codesign --verify --deep --strict /Applications/Lark.app
```

前期的「不重签也能启动、标记生效、完整恢复」已经在本机飞书 `147.0.7727.149` 验证。其他版本的启动行为仍需对应实测。
