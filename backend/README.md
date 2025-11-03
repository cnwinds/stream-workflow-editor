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

服务支持多种启动方式，可以在任意目录启动，自动检测或指定自定义节点目录。

#### 方式1: 使用 CLI 工具（推荐）

```bash
# 在当前目录启动（自动检测 custom_nodes 目录）
python cli.py

# 或在项目根目录启动
python backend/cli.py

# 指定工作目录
python cli.py --work-dir /path/to/project

# 直接指定自定义节点目录
python cli.py --nodes-dir /path/to/custom/nodes

# 使用配置文件
python cli.py --config /path/to/config.yaml

# 指定服务地址和端口
python cli.py --host 0.0.0.0 --port 8000

# 开发模式（自动重载）
python cli.py --reload
```

#### 方式2: 使用环境变量

```bash
# 设置自定义节点目录
export CUSTOM_NODES_DIR=/path/to/custom/nodes
export SERVER_HOST=0.0.0.0
export SERVER_PORT=8000

# 启动服务
python cli.py
```

#### 方式3: 使用配置文件

创建 `config.yaml` 文件：

```yaml
custom_nodes_dir: custom_nodes  # 相对路径或绝对路径
host: 0.0.0.0
port: 8000
```

然后运行：

```bash
python cli.py --config config.yaml
```

#### 方式4: 直接运行 main.py（向后兼容）

```bash
python -m api.main
```

注意：此方式会使用默认配置，在当前工作目录下查找 `custom_nodes` 目录。

### 配置优先级

配置加载优先级（从高到低）：
1. **命令行参数** - 最高优先级
2. **环境变量** - `CUSTOM_NODES_DIR`, `SERVER_HOST`, `SERVER_PORT`, `CONFIG_FILE`
3. **配置文件** - YAML 格式配置文件
4. **自动检测** - 在当前工作目录下查找 `custom_nodes` 目录

服务将在 http://localhost:8000 启动（默认配置）

## API 文档

启动服务后，访问 http://localhost:8000/docs 查看 Swagger API 文档

## 项目结构

```
backend/
├── cli.py                   # CLI 工具入口
├── config.yaml              # 配置文件模板
├── api/
│   ├── main.py              # FastAPI 应用入口
│   ├── config.py            # 全局配置管理器
│   ├── routes/              # API 路由
│   │   ├── workflow.py      # 工作流管理
│   │   ├── validate.py      # 配置验证
│   │   ├── execute.py       # 执行控制
│   │   └── nodes.py         # 节点信息
│   └── services/            # 业务逻辑
│       └── workflow_service.py  # 工作流引擎服务封装
├── custom_nodes/            # 自定义节点目录（默认位置）
│   ├── registry.json        # 节点注册表
│   └── templates/           # 节点代码模板
└── requirements.txt         # 依赖列表
```

## 依赖说明

- **fastapi**: Web 框架
- **uvicorn**: ASGI 服务器
- **stream-workflow**: 工作流引擎（从 GitHub 安装）
- **pyyaml**: YAML 处理
- **pydantic**: 数据验证
- **click**: CLI 工具库

## 注意事项

1. 确保已安装 stream-workflow 引擎
2. 端口 8000 需要可用（可通过命令行参数或配置文件修改）
3. CORS 已配置允许 localhost:3000（前端）
4. 自定义节点目录需要包含 Python 节点文件（.py）和 `registry.json` 注册表文件
5. 如果自定义节点目录不存在，服务会自动创建（但不会创建节点文件）
