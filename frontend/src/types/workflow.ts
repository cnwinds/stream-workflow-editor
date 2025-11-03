/**
 * 工作流配置类型定义
 */

export type NodeExecutionMode = 'sequential' | 'streaming' | 'hybrid'

export interface WorkflowNode {
  id: string
  type: string
  // 导出时使用 left/top 避免 YAML 歧义（y 是布尔值 true 的别名）
  // 但为了向后兼容，也支持 x/y 格式
  position?: { x?: number; y?: number; left?: number; top?: number }
  name?: string
  data?: Record<string, any>
  config?: Record<string, any>
}

export interface WorkflowConnection {
  id?: string
  // 支持两种格式：
  // 1. from/to 格式（如 "opening_agent_node.opening_text"）
  //    重要：使用的是节点ID（node.id），而不是节点类型（node.type）
  //    格式：{id}.连接名，例如 "opening_agent_node.opening_text"
  from?: string // 格式：节点ID.连接名
  to?: string // 格式：节点ID.连接名
  // 2. source/target 格式（React Flow 格式）
  //    source/target 也应该是节点ID
  source?: string // 节点ID
  sourceHandle?: string
  target?: string // 节点ID
  targetHandle?: string
  label?: string
}

export interface WorkflowConfig {
  workflow: {
    name: string
    description?: string
    config?: {
      stream_timeout?: number
      [key: string]: any
    }
    nodes: WorkflowNode[]
    connections?: WorkflowConnection[]
  }
}

export interface WorkflowValidationResult {
  valid: boolean
  errors?: Array<{
    nodeId?: string
    message: string
    field?: string
  }>
}

