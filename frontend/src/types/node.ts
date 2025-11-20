/**
 * 节点类型定义
 */

import { NodeExecutionMode } from './workflow'

export interface NodeType {
  id: string
  name: string
  description?: string
  category: string
  icon?: string
  executionMode: NodeExecutionMode
  color?: string
  inputs?: NodeParameter[]
  outputs?: NodeParameter[]
}

// Schema 字段定义（详细格式）
export interface SchemaFieldDefinition {
  type: string // 字段类型
  required?: boolean // 是否必传（默认 false）
  description?: string // 字段说明（默认空字符串）
  default?: any // 默认值（可选）
}

// Schema 可以是简单类型字符串或结构体字典
export type SchemaValue = 
  | string // 简单类型: "string", "integer", "float", "bytes", "boolean", "dict", "list", "any"
  | Record<string, string> // 结构体简单格式: {"field_name": "type", ...}
  | Record<string, SchemaFieldDefinition> // 结构体详细格式: {"field_name": {"type": "string", "required": true, ...}, ...}

// 输入/输出参数定义
export interface ParameterSchema {
  isStreaming: boolean
  schema: SchemaValue // schema可以是字符串（简单类型）或字典（结构体，支持简单和详细两种格式）
  description?: string // 参数备注说明（默认空字符串）
}

// 配置参数定义（使用 FieldSchema 格式）
// FieldSchemaDef = Union[str, Dict[str, Any]]
// - 简单格式: "string" - 直接是类型字符串
// - 详细格式: {"type": "string", "required": True, "description": "...", "default": "..."}
export type FieldSchemaDef = 
  | string // 简单格式: "string", "integer", "float", "bytes", "boolean", "dict", "list", "any"
  | SchemaFieldDefinition // 详细格式: {"type": "string", "required": true, "description": "...", "default": "..."}

export interface NodeParameter {
  name: string
  type: string
  required?: boolean
  description?: string
  schema?: Record<string, any>
  isStreaming?: boolean
}

export interface NodeSchema {
  INPUT_PARAMS?: Record<string, ParameterSchema>
  OUTPUT_PARAMS?: Record<string, ParameterSchema>
  CONFIG_PARAMS?: Record<string, FieldSchemaDef> // 配置参数，使用 FieldSchema 格式
}

// 创建节点请求
export interface CreateNodeRequest {
  nodeId: string
  name: string
  description: string
  category: string
  executionMode: NodeExecutionMode
  color: string
  inputs: Record<string, ParameterSchema> // 改为字典结构，key是输入名称
  outputs: Record<string, ParameterSchema> // 改为字典结构，key是输出名称
  configParams?: Record<string, FieldSchemaDef> // 配置参数，使用 FieldSchema 格式
  pythonCode?: string
}

// 分类树节点
export interface CategoryTreeNode {
  key: string
  title: string
  children?: Record<string, CategoryTreeNode>
  nodes?: NodeType[]
  isLeaf?: boolean
}


