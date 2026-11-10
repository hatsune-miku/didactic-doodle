# Wal Assistant Lark

Wal Assistant Lark 是一个基于 Tauri 2、React 和 Vite 的桌面工具，用于给飞书客户端应用主题补丁，并提供恢复官方原版、结束/启动飞书、打开飞书安装目录等辅助功能。

> 当前原生侧主要面向 Windows：项目会读取 Windows 注册表来定位飞书安装目录。

## 目录说明

- `src/`：主应用前端源码。
- `src-tauri/`：Tauri/Rust 原生端源码与桌面应用配置。
- `src-editor/`：独立的主题编辑器前端，和主桌面应用分开安装依赖、分开构建。

## 环境要求

1. Windows 10/11。
2. Node.js LTS。
3. Yarn 1.x 或 pnpm。项目 CI 和 Tauri 配置默认使用 `yarn`。
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

> 说明：内置的 Tauri 自动更新（updater）已移除，更新交由 KFC 统一管理，构建不再生成签名产物（`.sig` / `latest.json`），也不再需要签名私钥。

## KFC

本工具已接入 KFC（统一工具管理），以 zip-portable 归档形式分发（不再使用 NSIS/MSI 安装器）。

打包为 KFC 产物（会先构建再压缩到 `dist-kfc/`）：

```
npm run kfc:pack -- -Version <版本号>
```

发布到 KFC Hub：

```
npm run kfc:publish -- --version <版本号>
```

（产物从 manifest 自动推导，无需 `--artifact`。）

一步完成构建 + 发布：`npm run kfc:release -- -Version <版本号>`。

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

`.github/workflows/main.yml` 会在推送到 `release` 分支时触发 Windows 构建，并创建草稿 Release。

该 workflow 通过 `tauri-apps/tauri-action` 构建，并把签名安装包与 updater 清单 `latest.json` 一并附到草稿 Release。它需要以下 Secret（配置在 `Release` 环境或仓库级 Secrets 中）：

- `TAURI_SIGNING_PRIVATE_KEY`：与 `tauri.conf.json` 中 `pubkey` 配对的签名私钥。
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`：生成私钥时设置的密码（未设置则留空）。

注意：草稿 Release 的资产是非公开的，`latest.json` 中的下载地址需要在 Release 正式发布后（或由具备访问权限的服务转发）才能被 updater 拉取。
