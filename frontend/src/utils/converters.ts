import { Node, Edge } from 'reactflow'
import { WorkflowConfig, WorkflowNode, WorkflowConnection } from '@/types/workflow'

/**
 * 数据转换工具：React Flow 数据结构与工作流配置格式之间的转换
 */
export class WorkflowConverter {
  /**
   * 将 React Flow 节点和边转换为工作流配置格式
   */
  static reactFlowToWorkflowConfig(
    nodes: Node[],
    edges: Edge[],
    workflowName: string = '未命名工作流'
  ): WorkflowConfig {
    const workflowNodes: WorkflowNode[] = nodes
      .filter((node) => node.type) // 过滤掉没有类型的节点
      .map((node) => ({
        id: node.id,
        type: node.type!,
        position: node.position
          ? {
              // 对齐到10的倍数，让节点位置更整齐，便于对齐
              x: Math.round(node.position.x / 10) * 10,
              y: Math.round(node.position.y / 10) * 10,
            }
          : undefined,
        data: node.data,
      }))

    const workflowConnections: WorkflowConnection[] = edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      sourceHandle: edge.sourceHandle || '',
      target: edge.target,
      targetHandle: edge.targetHandle || '',
      label: edge.label as string,
    }))

    return {
      workflow: {
        name: workflowName,
        nodes: workflowNodes,
        connections: workflowConnections,
      },
    }
  }

  /**
   * 将工作流配置转换为 React Flow 节点和边
   */
  static workflowConfigToReactFlow(config: WorkflowConfig): {
    nodes: Node[]
    edges: Edge[]
  } {
    // 解析节点
    const nodes: Node[] = config.workflow.nodes.map((node, index) => {
      // 转换 position 格式：支持 {left, top} 和 {x, y} 两种格式（向后兼容）
      let position: { x: number; y: number }
      if (node.position) {
        if ('left' in node.position && 'top' in node.position) {
          // 新格式：{left, top}
          position = {
            x: node.position.left!,
            y: node.position.top!,
          }
        } else if ('x' in node.position && 'y' in node.position) {
          // 旧格式：{x, y}（向后兼容）
          position = {
            x: node.position.x!,
            y: node.position.y!,
          }
        } else {
          // 默认值
          position = {
            x: 200 + (index % 3) * 300,
            y: 100 + Math.floor(index / 3) * 200,
          }
        }
      } else {
        // 如果没有 position，自动生成布局（水平排列）
        position = {
          x: 200 + (index % 3) * 300,
          y: 100 + Math.floor(index / 3) * 200,
        }
      }

      return {
        id: node.id,
        type: 'custom',
        position,
        data: {
          label: node.name || node.id,
          type: node.type,
          config: node.config || {},
          ...(node.data || {}),
        },
      }
    })

    // 解析连接 - 支持 from/to 格式和 source/target 格式
    // 重要：连接配置中使用的是节点ID（node.id），而不是节点类型（node.type）
    // 格式：{id}.连接名，例如 "opening_agent_node.opening_text"
    const edges: Edge[] = (config.workflow.connections || []).map((conn, index) => {
      // 支持 from/to 格式（如 "opening_agent_node.opening_text"）
      // from/to 的第一部分是节点ID，第二部分是连接名称
      if (conn.from && conn.to) {
        const [source, sourceHandle] = conn.from.split('.')
        const [target, targetHandle] = conn.to.split('.')
        
        return {
          id: conn.id || `edge-${index}-${source}-${target}`,
          source: source, // 节点ID
          sourceHandle: sourceHandle || 'output',
          target: target, // 节点ID
          targetHandle: targetHandle || 'input',
          label: conn.label || `${sourceHandle || 'output'} → ${targetHandle || 'input'}`,
        }
      } else {
        // 支持 source/target 格式（React Flow 格式）
        // source/target 也应该是节点ID
        return {
          id: conn.id || `edge-${index}-${conn.source}-${conn.target}`,
          source: conn.source || '', // 节点ID
          sourceHandle: conn.sourceHandle || 'output',
          target: conn.target || '', // 节点ID
          targetHandle: conn.targetHandle || 'input',
          label: conn.label,
        }
      }
    })

    return { nodes, edges }
  }
}

