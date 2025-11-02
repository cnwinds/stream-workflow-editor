# Stream Workflow Editor - 后端

## 快速开始

### 1. 安装依赖

```bash
# 安装 stream-workflow 引擎（从 GitHub）
pip install git+https://github.com/cnwinds/stream-workflow.git@main

# 安装其他依赖
pip install -r requirements.txt
```

### 2. 运行服务

```bash
python -m api.main
```

服务将在 http://localhost:8000 启动

## API 文档

启动服务后，访问 http://localhost:8000/docs 查看 Swagger API 文档

## 项目结构

```
backend/
├── api/
│   ├── main.py              # FastAPI 应用入口
│   ├── routes/              # API 路由
│   │   ├── workflow.py      # 工作流管理
│   │   ├── validate.py      # 配置验证
│   │   ├── execute.py       # 执行控制
│   │   └── nodes.py         # 节点信息
│   └── services/            # 业务逻辑
│       └── workflow_service.py  # 工作流引擎服务封装
└── requirements.txt         # 依赖列表
```

## 依赖说明

- **fastapi**: Web 框架
- **uvicorn**: ASGI 服务器
- **stream-workflow**: 工作流引擎（从 GitHub 安装）
- **pyyaml**: YAML 处理
- **pydantic**: 数据验证

## 注意事项

1. 确保已安装 stream-workflow 引擎
2. 端口 8000 需要可用
3. CORS 已配置允许 localhost:3000（前端）
