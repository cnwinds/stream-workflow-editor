# Stream Workflow Editor

## 开发环境设置

### 前端开发

1. 安装 Node.js (推荐 v18+)
2. 安装依赖：
```bash
cd frontend
npm install
```

3. 启动开发服务器：
```bash
npm run dev
```

前端将在 http://localhost:3000 启动

### 后端开发

1. 安装 Python 3.8+
2. 创建虚拟环境：
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
```

3. 安装依赖：
```bash
pip install -r requirements.txt
```

4. 启动后端服务：
```bash
python -m api.main
```

后端将在 http://localhost:8000 启动

## 使用说明

### 创建工作流

1. 从左侧节点面板拖拽节点到画布
2. 点击节点之间的连接点创建连接
3. 点击节点进行配置
4. 使用工具栏保存、验证或导出工作流

### 导入/导出

- **导入**: 点击工具栏的"导入"按钮，选择 YAML 文件
- **导出**: 点击工具栏的"导出"按钮，下载 YAML 配置文件

### 配置验证

点击工具栏的"验证"按钮，检查工作流配置是否正确。

## 常见问题

### 前端无法连接后端

确保后端服务已启动在 http://localhost:8000，并且 CORS 配置正确。

### 节点拖拽不工作

确保浏览器支持 HTML5 Drag and Drop API。

### YAML 解析错误

检查 YAML 格式是否正确，确保缩进使用空格而非制表符。

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 许可证

MIT License


