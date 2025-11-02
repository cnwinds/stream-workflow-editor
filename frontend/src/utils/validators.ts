import { WorkflowConfig } from '@/types/workflow'

/**
 * 工作流配置验证工具
 */
export class WorkflowValidator {
  /**
   * 验证工作流配置
   */
  static validate(config: WorkflowConfig): {
    valid: boolean
    errors: Array<{ nodeId?: string; message: string; field?: string }>
  } {
    const errors: Array<{ nodeId?: string; message: string; field?: string }> = []

    if (!config.workflow) {
      errors.push({ message: '工作流配置不能为空' })
      return { valid: false, errors }
    }

    if (!config.workflow.name) {
      errors.push({ message: '工作流名称不能为空' })
    }

    if (!config.workflow.nodes || config.workflow.nodes.length === 0) {
      errors.push({ message: '工作流至少需要一个节点' })
    }

    // 验证节点
    const nodeIds = new Set<string>()
    config.workflow.nodes?.forEach((node, index) => {
      if (!node.id) {
        errors.push({ nodeId: node.id, message: `节点 ${index + 1} 缺少 ID` })
      } else if (nodeIds.has(node.id)) {
        errors.push({ nodeId: node.id, message: `节点 ID "${node.id}" 重复` })
      } else {
        nodeIds.add(node.id)
      }

      if (!node.type) {
        errors.push({ nodeId: node.id, message: `节点 "${node.id}" 缺少类型` })
      }

      if (!node.position) {
        errors.push({ nodeId: node.id, message: `节点 "${node.id}" 缺少位置信息` })
      }
    })

    // 验证连接
    const validNodeIds = new Set(config.workflow.nodes?.map((n) => n.id) || [])
    config.workflow.connections?.forEach((conn) => {
      if (!validNodeIds.has(conn.source)) {
        errors.push({ message: `连接源节点 "${conn.source}" 不存在` })
      }
      if (!validNodeIds.has(conn.target)) {
        errors.push({ message: `连接目标节点 "${conn.target}" 不存在` })
      }
    })

    return {
      valid: errors.length === 0,
      errors,
    }
  }
}


