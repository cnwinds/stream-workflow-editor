# 架构文档

## 项目概述

流式工作流可视化编辑器是一个前后端分离的 Web 应用，用于可视化编辑和管理 stream-workflow Python 引擎的工作流配置。

## 架构设计

### 整体架构

```
┌─────────────────┐         HTTP/REST API         ┌─────────────────┐
│                 │◄──────────────────────────────►│                 │
│  前端 (React)    │                                │  后端 (FastAPI) │
│                 │                                │                 │
│  - React Flow   │                                │  - FastAPI      │
│  - Zustand      │                                │  - Pydantic     │
│  - Ant Design   │                                │  - 验证/执行     │
└─────────────────┘                                └─────────────────┘
                                                           │
                                                           ▼
                                                  ┌─────────────────┐
                                                  │ stream-workflow │
                                                  │    Python 引擎   │
                                                  └─────────────────┘
```

### 前端架构

#### 技术栈

- **React 18**: UI 框架
- **TypeScript**: 类型安全
- **React Flow**: 工作流画布
- **Zustand**: 状态管理（轻量级）
- **Ant Design**: UI 组件库
- **Monaco Editor**: 代码编辑器
- **Vite**: 构建工具

#### 目录结构

```
frontend/src/
├── components/          # React 组件
│   ├── WorkflowCanvas/   # 工作流画布（核心组件）
│   ├── NodePalette/      # 节点面板
│   ├── NodeConfigPanel/  # 节点配置面板
│   └── Toolbar/          # 工具栏
├── stores/               # 状态管理
│   └── workflowStore.ts  # 工作流状态
├── services/             # API 服务
│   ├── api.ts            # API 客户端
│   └── yamlService.ts    # YAML 处理
├── types/                # TypeScript 类型
│   ├── workflow.ts       # 工作流类型
│   └── node.ts           # 节点类型
└── utils/                # 工具函数
    ├── validators.ts     # 验证器
    └── converters.ts     # 数据转换
```

#### 状态管理

使用 Zustand 进行状态管理，主要状态包括：

- `nodes`: 工作流节点列表
- `edges`: 连接线列表
- `workflowConfig`: 当前工作流配置

#### 数据流

```
用户操作
  ↓
组件事件处理
  ↓
Zustand Store (更新状态)
  ↓
React Flow (重新渲染)
  ↓
导出为 YAML/JSON
  ↓
API 调用
  ↓
后端处理
```

### 后端架构

#### 技术栈

- **FastAPI**: Python Web 框架
- **Uvicorn**: ASGI 服务器
- **Pydantic**: 数据验证
- **PyYAML**: YAML 处理

#### 目录结构

```
backend/
├── api/
│   ├── main.py           # FastAPI 应用入口
│   └── routes/           # API 路由
│       ├── workflow.py   # 工作流管理
│       ├── validate.py   # 配置验证
│       ├── execute.py    # 执行控制
│       └── nodes.py      # 节点信息
└── requirements.txt
```

#### API 设计

RESTful API 设计原则：

- `GET /api/workflows`: 获取列表
- `GET /api/workflows/{id}`: 获取单个
- `POST /api/workflows`: 创建/更新
- `DELETE /api/workflows/{id}`: 删除

## 核心功能实现

### 1. 工作流画布

**技术**: React Flow

**特性**:
- 基于 Canvas 渲染，性能优异
- 支持节点拖拽、移动、缩放
- 支持连接线创建和编辑
- 虚拟化渲染（大量节点优化）

**实现要点**:
- 使用 `ReactFlowProvider` 包裹
- 自定义节点组件 `CustomNode`
- 支持从节点面板拖拽创建节点
- 实现节点选择和高亮

### 2. 节点管理

**节点类型**:
- Sequential: 顺序执行节点
- Streaming: 流式处理节点
- Hybrid: 混合模式节点

**节点面板**:
- 按类别分组显示
- 支持搜索过滤
- 拖拽创建节点

**节点配置**:
- 表单编辑模式
- YAML 代码编辑模式
- 实时验证

### 3. 连接管理

**连接验证**:
- 检查源节点和目标节点存在性
- 验证参数类型兼容性
- 检查循环依赖

**连接样式**:
- 普通连接：实线
- 流式连接：虚线（特殊样式）

### 4. YAML 集成

**序列化**:
- 工作流配置 → YAML 字符串
- 使用 `js-yaml` 库

**反序列化**:
- YAML 字符串 → 工作流配置
- 验证格式正确性

**双向同步**:
- 可视化编辑 → YAML 预览
- YAML 编辑 → 可视化更新（计划中）

### 5. 配置验证

**前端验证**:
- 基本格式验证
- 节点 ID 唯一性
- 连接有效性

**后端验证**:
- 调用 stream-workflow 引擎验证
- 返回详细错误信息

### 6. 性能优化

**React Flow 优化**:
- 虚拟化渲染（只渲染可见区域）
- 节点懒加载
- 防抖优化（配置变更）

**大量节点处理**:
- Canvas 渲染（比 DOM 性能好）
- 按需渲染
- Web Worker 处理大型 YAML（计划中）

## 部署方案

### 开发环境

**前端**:
```bash
cd frontend
npm install
npm run dev  # http://localhost:3000
```

**后端**:
```bash
cd backend
pip install -r requirements.txt
python -m api.main  # http://localhost:8000
```

### 生产环境

**前端构建**:
```bash
cd frontend
npm run build
# 输出到 dist/ 目录
```

**后端部署**:
```bash
# 使用 uvicorn 或 gunicorn
uvicorn api.main:app --host 0.0.0.0 --port 8000
```

**Nginx 配置**:
```nginx
server {
    listen 80;
    server_name example.com;

    # 前端静态文件
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 未来扩展

1. **实时协作**: WebSocket 支持多人协作编辑
2. **版本控制**: Git 集成，工作流版本管理
3. **插件系统**: 支持自定义节点类型
4. **模板库**: 预定义工作流模板
5. **执行监控**: 实时执行状态可视化
6. **性能分析**: 工作流执行性能分析


