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
  configSchema?: Record<string, any>
}

// 输入/输出参数定义
export interface ParameterSchema {
  isStreaming: boolean
  schema: Record<string, string> // schema是字段名到类型的映射，如 {"text": "string", "is_final": "boolean"}
}

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
  CONFIG_SCHEMA?: Record<string, any>
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
  configSchema: Record<string, any>
  pythonCode?: string
}

// 分类树节点
export interface CategoryTreeNode {
  key: string
  title: string
  children?: CategoryTreeNode[]
  nodes?: NodeType[]
  isLeaf?: boolean
}


