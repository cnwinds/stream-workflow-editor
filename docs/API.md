# API 文档

## 概述

Stream Workflow API 为流式工作流可视化编辑器提供后端服务接口。

## 基础信息

- **Base URL**: `http://localhost:8000/api`
- **Content-Type**: `application/json`

## 工作流管理 API

### 获取工作流列表

```http
GET /api/workflows
```

**响应示例**:
```json
[
  {
    "id": "workflow_1",
    "name": "示例工作流",
    "config": { ... }
  }
]
```

### 获取单个工作流

```http
GET /api/workflows/{workflow_id}
```

### 创建或更新工作流

```http
POST /api/workflows
Content-Type: application/json

{
  "workflow": {
    "name": "工作流名称",
    "nodes": [...],
    "connections": [...]
  }
}
```

### 删除工作流

```http
DELETE /api/workflows/{workflow_id}
```

## 配置验证 API

### 验证工作流配置

```http
POST /api/validate
Content-Type: application/json

{
  "workflow": {
    "name": "工作流名称",
    "nodes": [...],
    "connections": [...]
  }
}
```

**响应示例**:
```json
{
  "valid": true,
  "errors": null
}
```

或错误情况:
```json
{
  "valid": false,
  "errors": [
    {
      "nodeId": "node_1",
      "message": "节点缺少类型",
      "field": "type"
    }
  ]
}
```

## 执行控制 API

### 执行工作流

```http
POST /api/execute
Content-Type: application/json

{
  "config": {
    "workflow": { ... }
  },
  "initialData": {
    "key": "value"
  }
}
```

**响应示例**:
```json
{
  "id": "execution_123",
  "status": "running",
  "createdAt": "2024-01-01T00:00:00",
  "updatedAt": "2024-01-01T00:00:00"
}
```

### 查询执行状态

```http
GET /api/execute/{execution_id}/status
```

### 停止执行

```http
POST /api/execute/{execution_id}/stop
```

## 节点信息 API

### 获取所有节点类型

```http
GET /api/nodes/types
```

**响应示例**:
```json
[
  {
    "id": "start",
    "name": "起始节点",
    "description": "工作流的起始节点",
    "category": "基础",
    "executionMode": "sequential",
    "color": "#1890ff"
  }
]
```

### 获取节点 Schema

```http
GET /api/nodes/{node_type}/schema
```

**响应示例**:
```json
{
  "INPUT_PARAMS": {
    "input1": {
      "type": "string",
      "required": true
    }
  },
  "OUTPUT_PARAMS": {
    "output1": {
      "type": "string"
    }
  },
  "CONFIG_SCHEMA": {
    "url": {
      "type": "string",
      "required": true
    }
  }
}
```

## 错误处理

所有 API 错误响应格式:

```json
{
  "detail": "错误信息"
}
```

HTTP 状态码:
- `200`: 成功
- `400`: 请求参数错误
- `404`: 资源不存在
- `500`: 服务器内部错误


