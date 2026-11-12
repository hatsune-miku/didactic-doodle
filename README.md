# Wal Assistant Lark

Wal Assistant Lark 是一个基于 Tauri 2、React 和 Vite 的桌面工具，用于给飞书客户端应用主题补丁，支持主题导入、组合、排序、应用和恢复原版。主界面保留必要的飞书进程操作。

支持 Windows 与 macOS。Windows 通过注册表定位飞书；macOS 识别「应用程序」目录中的飞书应用包。

## 目录说明

- `src/`：主应用前端源码。
- `src-tauri/`：Tauri/Rust 原生端源码与桌面应用配置。
- `src-editor/`：独立的主题编辑器前端，和主桌面应用分开安装依赖、分开构建。

## 前端约束

桌面端和独立编辑器统一使用 React 19、CakeUI 与 SCSS，遵循 [项目约束](AGENTS.md) 和 [界面规范](docs/UI.md)。不再使用 HeroUI 或 Tailwind；主界面不再提供飞书小工具和设置页签。

验证命令：`yarn test`、`yarn test:editor`、`yarn format:check`、`yarn build`。独立编辑器在 `src-editor/` 执行 `yarn build`。

## 环境要求

1. Windows 10/11，或 macOS 13.3 及以上。
2. Node.js LTS。
3. Yarn 1.x 或 pnpm。项目 CI 和 Tauri 配置默认使用 `yarn`。
4. Rust stable。
5. Tauri 在 Windows 上需要的系统依赖：
   - Microsoft Edge WebView2 Runtime
   - Microsoft C++ Build Tools，包含 MSVC 和 Windows SDK
6. macOS 需要 Xcode Command Line Tools，可通过 `xcode-select --install` 安装。

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

内置的 Tauri 自动更新（updater）已移除，更新交由 KFC 统一管理。当前配置不生成 updater 签名产物 `.sig`，也不需要 `TAURI_SIGNING_PRIVATE_KEY` 或 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`。

## KFC

本工具已接入 KFC（统一工具管理），通过 KFC 分发 zip-portable 归档。Tauri 构建仍会生成常规安装包，KFC 打包脚本提取可执行文件及配套资源制作 ZIP。

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

macOS 使用：

```sh
yarn kfc:pack:macos --version 0.1.8
# 可选：--target aarch64-apple-darwin 或 --target x86_64-apple-darwin
yarn kfc:publish --version 0.1.8
```

Mac ZIP 包包含完整 `.app` 和 `launch.command`。启动脚本会恢复 KFC 解压时丢失的执行权限，并透传启动参数。版本号必须与 `src-tauri/tauri.conf.json` 一致。仅打包不发布时只执行第一条命令。

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

编辑器把草稿暂存在当前浏览器中，刷新页面不会丢失；交给桌面端导入的仍是导出的 YAML 文件。

部署到 <https://wal-theme.vanillacake.cn/>（需要能免密 `ssh miku@vanillacake.cn`）：

```powershell
yarn online
```

脚本先构建，再上传带哈希名的资源，最后替换 `index.html`，避免访问者拿到引用缺失资源的页面。旧资源会保留，已缓存的旧页面仍能打开。

## 发布流程

`.github/workflows/main.yml` 会在推送到 `release` 分支时运行测试，构建 Windows x64、macOS Apple Silicon 和 Intel 版本，并创建 GitHub 草稿 Release。该流程通过 `tauri-apps/tauri-action` 上传常规构建产物；macOS KFC ZIP 另存为 workflow artifact。不生成 updater 清单 `latest.json`，也不需要 updater 签名 Secret。

GitHub Release 和 KFC Hub 是两个发布入口；该 workflow 不会自动发布到 KFC。发布到 KFC 时使用上面的 `kfc:release`，通过 `KFC_HUB` 指定 Hub 地址，通过 `KFC_TOKEN` 提供认证凭据。

## 测试

前端逻辑测试和类型检查：

```powershell
yarn test
yarn build
```

原生回归测试在 Windows 和 macOS 上运行，使用临时 ASAR 文件和应用目录，不修改已安装的飞书：

```powershell
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

## macOS

运行、备份机制、打包和验证步骤见 [macOS 适配说明](docs/MACOS.md)。前期的独立验证脚本保留在 [macOS 验证指南](scripts/MACOS_PROBE.md)，它的整包备份与桌面应用现在使用的 ASAR 备份相互独立。
