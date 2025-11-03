import { WorkflowConfig } from '@/types/workflow'
import { Node, Edge } from 'reactflow'

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
      if (conn.source && !validNodeIds.has(conn.source)) {
        errors.push({ message: `连接源节点 "${conn.source}" 不存在` })
      }
      if (conn.target && !validNodeIds.has(conn.target)) {
        errors.push({ message: `连接目标节点 "${conn.target}" 不存在` })
      }
    })

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * 验证连接参数是否匹配
   * @param edge 连接
   * @param nodes 节点列表
   * @returns 如果连接有效返回true，否则返回false
   */
  static validateConnection(edge: Edge, nodes: Node[]): boolean {
    const sourceNode = nodes.find((n) => n.id === edge.source)
    const targetNode = nodes.find((n) => n.id === edge.target)

    if (!sourceNode || !targetNode) {
      return false
    }

    // 获取源节点的输出参数
    const sourceOutputParams = sourceNode.data?.outputParams || {}
    const sourceHandle = edge.sourceHandle || 'output'

    // 获取目标节点的输入参数
    const targetInputParams = targetNode.data?.inputParams || {}
    const targetHandle = edge.targetHandle || 'input'

    // 检查源节点的输出参数是否存在
    const sourceParam = sourceOutputParams[sourceHandle]
    if (!sourceParam) {
      return false
    }

    // 检查目标节点的输入参数是否存在
    const targetParam = targetInputParams[targetHandle]
    if (!targetParam) {
      return false
    }

    // 验证参数schema是否一致
    const sourceSchema = sourceParam.schema || {}
    const targetSchema = targetParam.schema || {}

    const sourceSchemaKeys = Object.keys(sourceSchema)
    const targetSchemaKeys = Object.keys(targetSchema)

    // 空schema也是一种参数，必须严格匹配
    // 如果输出和输入的schema都为空，则匹配
    if (sourceSchemaKeys.length === 0 && targetSchemaKeys.length === 0) {
      return true
    }

    // 如果输出的schema为空，但输入的schema不为空，则不匹配
    if (sourceSchemaKeys.length === 0 && targetSchemaKeys.length > 0) {
      return false
    }

    // 如果输入的schema为空，但输出的schema不为空，则不匹配
    if (targetSchemaKeys.length === 0 && sourceSchemaKeys.length > 0) {
      return false
    }

    // 两者都不为空时，检查输入参数需要的字段是否都在输出参数中存在，并且类型匹配
    // 这是反向验证：确保输出参数提供了输入参数需要的所有字段
    for (const [fieldName, fieldType] of Object.entries(targetSchema)) {
      if (!(fieldName in sourceSchema)) {
        // 输入参数需要字段，但输出参数没有该字段
        return false
      }
      // 检查类型是否匹配
      const sourceFieldType = sourceSchema[fieldName]
      if (fieldType !== sourceFieldType) {
        // 类型不匹配
        return false
      }
    }

    return true
  }

  /**
   * 验证所有连接并返回无效连接的ID列表
   * @param edges 连接列表
   * @param nodes 节点列表
   * @returns 无效连接的ID列表
   */
  static validateConnections(edges: Edge[], nodes: Node[]): string[] {
    const invalidEdgeIds: string[] = []

    edges.forEach((edge) => {
      if (!this.validateConnection(edge, nodes)) {
        invalidEdgeIds.push(edge.id)
      }
    })

    return invalidEdgeIds
  }
}


