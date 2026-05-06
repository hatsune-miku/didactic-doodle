# Wal Assistant Lark

Wal Assistant Lark 是一个基于 Tauri 2、React 和 Vite 的桌面工具，用于给飞书客户端应用主题补丁，并提供恢复官方原版、结束/启动飞书、打开飞书安装目录等辅助功能。

> 当前原生侧主要面向 Windows：项目会读取 Windows 注册表来定位飞书安装目录。

## 目录说明

- `src/`：主应用前端源码。
- `src-tauri/`：Tauri/Rust 原生端源码与桌面应用配置。
- `src-editor/`：独立的主题编辑器前端，和主桌面应用分开安装依赖、分开构建。
- `build.ps1`：带更新签名环境变量的 Windows 发布构建脚本。

## 环境要求

1. Windows 10/11。
2. Node.js LTS。
3. Yarn 1.x 或 pnpm。项目 CI 和 Tauri 配置默认使用 `yarn`，`build.ps1` 使用 `pnpm`。
4. Rust stable。
5. Tauri 在 Windows 上需要的系统依赖：
   - Microsoft Edge WebView2 Runtime
   - Microsoft C++ Build Tools，包含 MSVC 和 Windows SDK

Tauri 官方环境准备文档：<https://v2.tauri.app/start/prerequisites/>

## 本地开发运行

克隆项目后，在项目根目录安装依赖：

```powershell
yarn install
```

启动桌面应用开发模式：

```powershell
yarn tauri dev
```

这条命令会先启动 Vite 开发服务器，再启动 Tauri 桌面窗口。

如果使用 pnpm，也可以执行：

```powershell
pnpm install
pnpm tauri dev
```

## 编译桌面应用

先安装依赖：

```powershell
yarn install
```

执行 Tauri 构建：

```powershell
yarn tauri build
```

构建产物会生成到：

```text
src-tauri/target/release/bundle/
```

由于 `src-tauri/tauri.conf.json` 开启了 `createUpdaterArtifacts`，正式构建更新包时需要提供 Tauri updater 签名私钥。CI 通过以下环境变量注入：

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = "你的 updater 私钥内容或私钥文件路径"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "私钥密码"
yarn tauri build
```

仓库中的 `build.ps1` 假设私钥文件位于 `$env:USERPROFILE/.tauri/wal.key`，会提示输入私钥密码，然后执行：

```powershell
.\build.ps1
```

如果只是本地自用编译，不需要生成自动更新签名产物，可以在本地临时关闭 `src-tauri/tauri.conf.json` 里的 `bundle.createUpdaterArtifacts` 后再构建。

## 单独运行主题编辑器

主题编辑器位于 `src-editor/`，它不是 Tauri 桌面应用的一部分。需要单独进入目录安装依赖：

```powershell
cd src-editor
yarn install
yarn dev
```

构建主题编辑器：

```powershell
yarn build
```

## 发布流程

`.github/workflows/main.yml` 会在推送到 `release` 分支时触发 Windows 构建，并创建草稿 Release。发布构建需要在 GitHub Environment `Release` 中配置：

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
