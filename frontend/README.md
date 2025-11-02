# 流式工作流可视化编辑器 - 前端

基于 React + React Flow 构建的可视化工作流编辑器。

## 技术栈

- React 18 + TypeScript
- React Flow - 工作流画布
- Ant Design - UI 组件库
- Zustand - 状态管理
- Monaco Editor - 代码编辑器
- Vite - 构建工具

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 项目结构

```
src/
├── components/          # React 组件
│   ├── WorkflowCanvas/  # 工作流画布
│   ├── NodePalette/     # 节点面板
│   ├── NodeConfigPanel/ # 节点配置面板
│   └── Toolbar/         # 工具栏
├── stores/              # 状态管理
├── services/            # API 服务
├── types/               # TypeScript 类型定义
└── utils/               # 工具函数
```

## 功能特性

- ✅ 节点拖拽创建
- ✅ 连接线创建
- ✅ 节点配置编辑
- ✅ YAML 导入/导出
- ✅ 工作流验证
- 🔄 工作流执行（开发中）
- 🔄 实时预览（开发中）

## 开发计划

详见项目根目录的 `.plan.md` 文件。


