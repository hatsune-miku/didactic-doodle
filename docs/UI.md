# 界面约束与验证

## 规范与依赖

桌面端和独立主题编辑器统一使用 React 19、TypeScript、SCSS 和 `@a1knla/cakeui` 0.4.0。HeroUI、Tailwind 和对应配置已移除。长期规则见根目录 [AGENTS.md](../AGENTS.md)。

规范来源：[项目规则](https://g.vanillacake.cn/s/QnQxLNG2z_6_.md)、[CakeDesign](https://g.vanillacake.cn/s/hernTCWR-k5m.md)、[CakeUI API](https://gallery.vanillacake.cn/llms-full.txt)。用户指定 CakeUI 为本项目组件库；不再引入其他 UI 样式系统。

## 设计选择

- 沿用原有粉色强调色 `#e8788a`，由 CakeProvider 派生背景、表面、文字及明暗模式。强调色仅用于主要操作、选中状态和交互反馈。两端 CakeProvider 显式使用 `foreground="light"`，粉色强调区域默认白字，不使用自动前景选择。
- 使用系统无衬线字体、13–14px 基础字号、紧凑控件密度。中文优先 PingFang SC / Noto Sans CJK SC；代码使用等宽字体并禁用连字。
- 桌面端由主题列表和运行记录组成，不再有飞书小工具或设置页签。主题操作保留导入、启用、排序、详情、应用和恢复原版；飞书进程操作位于状态旁。
- 独立编辑器保持表单与 YAML 预览并列，窄屏顺序排列。元信息、补丁、输入对话框和预览各有独立组件；新建和结构变更可撤销。
- 不使用装饰渐变、普通投影、卡片套卡片或品牌大标题。布局使用业务 className；动态颜色预览是内联样式的特例。
- 打开主题编辑器无需二次确认。结束飞书进程保留明确确认；App 管理对话框只在实际被系统阻止后出现。

## 交互与失败恢复

排序在拖动结束时持久化，排序按钮支持上下方向键，详情中也提供上移/下移。持久化失败保留旧的选中状态和顺序，并提供重试。

读取启用主题失败时停止应用，不静默忽略后恢复原版。导入、主题清单和应用错误显示原始原因；原生主题文件命令保留 IO 错误文本。权限引导用 CakeUI Dialog，支持系统设置入口、重试、Esc 关闭及焦点恢复。

运行记录使用 CakeUI LogView，向上阅读时暂停跟随，滚到底部继续；文本允许选择复制。移除了 Tauri 原来强制禁止所有文字选择的运行时样式。

主题写入是短时文件操作，沿用原生锁、校验和回滚，不提供中途强制终止写入的按钮。CakeDesign 的可选扩展不作为已全部实现的声明。

## 本地验证

```sh
yarn test
yarn test:editor
yarn format:check
yarn build
cd src-editor && yarn build
```

`tests/ui/desktop.html` 是开发用模拟页面，不连接真实飞书，也不参与生产打包。启动 `yarn dev` 后可访问 `/tests/ui/desktop.html`，通过 `scenario` 查询参数检查 `ready`、`empty`、`error`、`permission`、`working`、`running` 和 `missing`。权限场景的设置按钮仅模拟授权。

界面检查覆盖桌面 800×600、窄窗口、主题排序、详情、应用、错误重试、权限恢复，以及编辑器导入、编辑、撤销/重做和 YAML 导出。真实 macOS 授权和飞书修改验收依照 [MACOS.md](MACOS.md)。
