# 流式工作流可视化编辑器

为 [stream-workflow](https://github.com/cnwinds/stream-workflow) Python 工作流引擎构建的可视化编辑器前端。

## 特性

- 🎨 **可视化编辑**: 拖拽式节点编辑，直观的工作流设计
- 🔄 **实时预览**: 实时查看工作流配置和验证结果
- 📝 **YAML 支持**: 支持 YAML 格式的导入/导出
- ✅ **配置验证**: 实时验证工作流配置的正确性
- 🚀 **高性能**: 基于 React Flow，支持大量节点的流畅渲染
- 🎯 **类型安全**: 完整的 TypeScript 类型定义

## 项目结构

```
stream-workflow-editor/
├── frontend/          # React 前端应用
├── backend/           # FastAPI 后端服务
└── docs/             # 项目文档
```

## 快速开始

### 前端开发

```bash
cd frontend
npm install
npm run dev
```

前端将在 http://localhost:3000 启动

### 后端开发

```bash
cd backend
pip install -r requirements.txt
python -m api.main
```

后端将在 http://localhost:8000 启动

## 技术栈

### 前端
- React 18 + TypeScript
- React Flow - 工作流画布
- Ant Design - UI 组件库
- Zustand - 状态管理
- Monaco Editor - 代码编辑器
- Vite - 构建工具

### 后端
- FastAPI - Python Web 框架
- Uvicorn - ASGI 服务器

## 功能列表

- [x] 基础框架搭建
- [x] 工作流画布
- [x] 节点管理
- [x] 连接管理
- [x] YAML 集成
- [x] 配置验证
- [ ] 工作流执行
- [ ] 实时预览
- [ ] 性能优化

## 开发计划

详见 `.plan.md` 文件。

## 许可证

MIT License


