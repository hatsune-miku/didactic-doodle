# 项目约束

这是个人项目，包含 Tauri 桌面端和 `src-editor/` 独立 Web 编辑器。遵循用户在当前对话指定的分支，不覆盖已有工作。

## 规范来源

- [项目规则](https://g.vanillacake.cn/s/QnQxLNG2z_6_.md)
- [CakeDesign UX 指导](https://g.vanillacake.cn/s/hernTCWR-k5m.md)
- [CakeUI 文档索引](https://gallery.vanillacake.cn/llms.txt)
- [CakeUI 完整 API](https://gallery.vanillacake.cn/llms-full.txt)

## 实现要求

- UI 使用 `@a1knla/cakeui`，遵循安装版本的公开类型和原生事件 API。不得重新引入 HeroUI、Tailwind 或另一套 UI 样式系统。
- 显式导入 CakeUI CSS，用公开主题变量和业务 className 定制。不要覆写组件内部 DOM、堆叠 `!important` 或用工具类拼接布局。
- 沿用粉色强调色，CakeProvider 显式设置 `foreground="light"`，粉色强调按钮默认白字，覆盖系统明暗模式。以浅色或系统深色的中性表面承载内容。避免装饰渐变、普通投影、品牌大标题和冗余分区标题。
- 阴影仅用于 solid 内描边或极轻微的大范围氛围。动效限于交互反馈，遵循 CakeDesign 曲线、150–250ms 时长和 reduced-motion。
- 使用系统无衬线字体，不用微软雅黑、图标字体、Emoji、斜体、删除线、下划线或 ligature。
- 命名函数使用 `function`，匿名回调使用箭头函数；遵循根目录 Prettier 配置。
- React 组件采用 `Component/index.tsx` 和 `index.scss`。只被一个组件使用的子组件放在该组件的 `components/` 中；SVG 图标可作为同文件的小组件。
- SCSS 使用完整业务类名和嵌套；不用 BEM、`&-child` 拼接或按无名子元素布局。用 flex/grid；动态颜色等确需运行时值的属性可以内联。
- 保持键盘操作、可访问名称、焦点恢复和可复制的日志/代码。拖动排序必须有键盘等价入口。
- 用户操作失败时展示真实原因与重试/恢复入口，禁止静默吞错。权限说明只在实际被阻止时出现；普通导航无需二次确认。
- 主界面不再有“飞书小工具”或“设置”页签。主题的应用、恢复、导入、排序及必要的飞书进程操作仍保留。

## 验证和文档

- 主前端：`yarn test`、`yarn build`、`yarn format:check`。
- 编辑器：在 `src-editor/` 执行 `yarn build`；修改编辑器模型时运行 `yarn test:editor`。
- 原生代码变更：`cargo test --locked --manifest-path src-tauri/Cargo.toml`。
- 界面变更检查空状态、已有主题、工作/失败/完成、权限引导，以及键盘和窄窗口布局。用临时数据或模拟桥接，不擅自修改真实飞书来测试 UI。
- 更新受影响的 README 和 `docs/`。不自动发布，不宣称完成未执行的跨平台实测。
