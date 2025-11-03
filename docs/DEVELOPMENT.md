# 开发指南

本文档说明项目的开发流程和目录结构。

## 项目结构

```
stream-workflow-editor/
├── src/stream_workflow_editor/   # 后端源码目录（在这里开发后端）
│   ├── api/                      # FastAPI 后端服务
│   │   ├── routes/               # API 路由
│   │   ├── services/             # 业务逻辑
│   │   ├── config.py             # 配置管理
│   │   └── main.py               # FastAPI 应用入口
│   ├── custom_nodes/             # 自定义节点
│   ├── static/                   # 前端静态文件（构建后，自动生成）
│   ├── cli.py                    # CLI 入口
│   ├── server.py                 # 服务器启动模块
│   └── client.py                 # 客户端启动模块
│
├── frontend/                     # 前端源码目录（在这里开发前端）
│   ├── src/                      # React 源码
│   ├── dist/                     # 构建产物（临时，自动生成）
│   └── package.json
│
├── docs/                         # 项目文档
├── build_frontend.py             # 前端构建脚本
├── pyproject.toml                # Python 包配置
└── README.md
```

## 开发流程

### 1. 初始化开发环境

```bash
# 1. 安装 Python 依赖（开发模式）
pip install -e .

# 2. 安装前端依赖
cd frontend
npm install
cd ..
```

### 2. 前端开发

**开发位置**: `frontend/` 目录

```bash
cd frontend
npm run dev
```

- 前端开发服务器：http://localhost:3000
- 支持热重载，修改代码自动刷新

### 3. 后端开发

**开发位置**: `src/stream_workflow_editor/` 目录

```bash
# 方式1: 使用 CLI 工具（推荐）
stream-workflow server

# 方式2: 同时启动前后端
stream-workflow start

# 方式3: 直接运行模块
python -m stream_workflow_editor.api.main
```

- 后端服务器：http://localhost:3010
- 使用 `--reload` 参数启用自动重载

### 4. 同时启动前后端（开发模式）

```bash
stream-workflow start
```

这将同时启动：
- 后端服务器：http://localhost:3010
- 前端开发服务器：http://localhost:3000

### 5. 构建前端（打包前）

在发布包之前，需要构建前端：

```bash
python build_frontend.py
```

该脚本会：
1. 在 `frontend/` 目录运行 `npm run build`
2. 将 `frontend/dist/` 的内容复制到 `src/stream_workflow_editor/static/`
3. 打包时，`static/` 目录会被包含在 Python 包中

### 6. 打包 Python 包

```bash
# 构建前端（必须先执行）
python build_frontend.py

# 构建 Python 包
pip install build
python -m build
```

## 开发原则

### 后端开发
- ✅ **直接在 `src/stream_workflow_editor/` 目录开发**
- ✅ 这是包的源码目录，修改后可直接测试安装效果
- ✅ 不需要手动同步代码

### 前端开发
- ✅ **在 `frontend/` 目录开发**
- ✅ 构建时通过脚本自动复制到 `src/stream_workflow_editor/static/`
- ✅ 开发时使用 Vite 开发服务器，不依赖后端静态文件

## 文件说明

### 后端重要文件

- `src/stream_workflow_editor/cli.py`: 统一 CLI 入口，支持 `server`、`client`、`start` 命令
- `src/stream_workflow_editor/server.py`: 服务器启动逻辑
- `src/stream_workflow_editor/client.py`: 前端开发服务器启动逻辑
- `src/stream_workflow_editor/api/main.py`: FastAPI 应用入口

### 前端重要文件

- `frontend/src/App.tsx`: 主应用组件
- `frontend/src/components/`: React 组件
- `frontend/src/stores/workflowStore.ts`: 状态管理

### 构建脚本

- `build_frontend.py`: 构建前端并复制到包目录

## 常见问题

### Q: 为什么没有 backend 目录？

A: 为了简化开发流程，统一在 `src/stream_workflow_editor/` 目录开发。这是 Python 包的源码目录，可以直接开发和测试，无需手动同步代码。

### Q: 前端开发时如何连接后端？

A: 前端开发服务器（Vite）已经配置了代理，将 `/api` 请求代理到 `http://localhost:3010`。直接启动后端服务器即可。

### Q: 如何测试打包后的效果？

A: 
```bash
# 构建前端
python build_frontend.py

# 本地安装
pip install -e .

# 测试命令
stream-workflow-server --help
stream-workflow --help
```

### Q: 修改后端代码后需要重启吗？

A: 使用 `stream-workflow server --reload` 可以启用自动重载。或者使用 `stream-workflow start` 同时启动前后端。

## 开发工作流示例

1. **开始开发**
   ```bash
   pip install -e .
   cd frontend && npm install && cd ..
   stream-workflow start
   ```

2. **修改后端代码**
   - 在 `src/stream_workflow_editor/` 目录修改
   - 保存后自动重载（如果使用了 `--reload`）

3. **修改前端代码**
   - 在 `frontend/` 目录修改
   - 保存后自动刷新（Vite 热重载）

4. **打包发布**
   ```bash
   python build_frontend.py
   python -m build
   ```

