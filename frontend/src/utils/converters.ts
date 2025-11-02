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
    const workflowNodes: WorkflowNode[] = nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
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
      // 如果没有 position，自动生成布局（水平排列）
      const position = node.position || {
        x: 200 + (index % 3) * 300,
        y: 100 + Math.floor(index / 3) * 200,
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
    const edges: Edge[] = (config.workflow.connections || []).map((conn, index) => {
      // 支持 from/to 格式（如 "vad.audio_stream"）
      if (conn.from && conn.to) {
        const [source, sourceHandle] = conn.from.split('.')
        const [target, targetHandle] = conn.to.split('.')
        
        return {
          id: conn.id || `edge-${index}-${source}-${target}`,
          source: source,
          sourceHandle: sourceHandle || 'output',
          target: target,
          targetHandle: targetHandle || 'input',
          label: conn.label || `${sourceHandle || 'output'} → ${targetHandle || 'input'}`,
        }
      } else {
        // 支持 source/target 格式（React Flow 格式）
        return {
          id: conn.id || `edge-${index}-${conn.source}-${conn.target}`,
          source: conn.source || '',
          sourceHandle: conn.sourceHandle || 'output',
          target: conn.target || '',
          targetHandle: conn.targetHandle || 'input',
          label: conn.label,
        }
      }
    })

    return { nodes, edges }
  }
}

