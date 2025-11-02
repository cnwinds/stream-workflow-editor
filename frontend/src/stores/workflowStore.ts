import { create } from 'zustand'
import { Node, Edge, Connection, addEdge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from 'reactflow'
import { WorkflowConfig, WorkflowNode, WorkflowConnection } from '@/types/workflow'

interface WorkflowState {
  nodes: Node[]
  edges: Edge[]
  workflowConfig: WorkflowConfig | null
  currentFileName: string | null
  
  // Actions
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  addNode: (node: Node) => void
  removeNode: (nodeId: string) => void
  updateNodeData: (nodeId: string, data: Record<string, any>) => void
  loadWorkflow: (config: WorkflowConfig) => Promise<void>
  exportWorkflow: () => WorkflowConfig
  setCurrentFileName: (filename: string | null) => void
  clearWorkflow: () => void
  updateNodeTypeInstances: (nodeTypeId: string, nodeTypeData: {
    name?: string
    color?: string
    inputParams?: Record<string, any>
    outputParams?: Record<string, any>
  }) => void
}

const initialNodes: Node[] = []
const initialEdges: Edge[] = []

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  workflowConfig: null,
  currentFileName: null,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    })
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    })
  },

  onConnect: (connection) => {
    set({
      edges: addEdge(connection, get().edges),
    })
  },

  addNode: (node) => {
    set({
      nodes: [...get().nodes, node],
    })
  },

  removeNode: (nodeId) => {
    const { nodes, edges } = get()
    set({
      nodes: nodes.filter((n) => n.id !== nodeId),
      edges: edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    })
  },

  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } }
          : node
      ),
    })
  },

  loadWorkflow: async (config) => {
    // 解析节点
    const nodes: Node[] = await Promise.all(
      config.workflow.nodes.map(async (node, index) => {
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

        // 尝试加载节点的 schema
        let inputParams: Record<string, any> = {}
        let outputParams: Record<string, any> = {}
        
        try {
          const { nodeApi } = await import('@/services/api')
          const schema = await nodeApi.getNodeSchema(node.type)
          if (schema.INPUT_PARAMS) {
            inputParams = schema.INPUT_PARAMS
          }
          if (schema.OUTPUT_PARAMS) {
            outputParams = schema.OUTPUT_PARAMS
          }
        } catch (error) {
          console.warn(`无法加载节点 ${node.type} 的 schema:`, error)
        }

        return {
          id: node.id,
          type: 'custom',
          position,
          data: {
            label: node.name || node.id,
            type: node.type,
            config: node.config || {},
            // 优先使用从服务器获取的 schema，而不是文件中可能存在的旧数据
            inputParams,
            outputParams,
            // 如果 data 中有其他字段（不包含 inputParams/outputParams），可以保留
            ...(node.data ? (() => {
              const { inputParams: _, outputParams: __, ...otherData } = node.data
              return otherData
            })() : {}),
          },
        }
      })
    )

    // 解析连接
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
          // 不设置 label，连线不显示文字
        }
      } else {
        // 支持 source/target 格式（React Flow 格式）
        return {
          id: conn.id || `edge-${index}-${conn.source}-${conn.target}`,
          source: conn.source || '',
          sourceHandle: conn.sourceHandle || 'output',
          target: conn.target || '',
          targetHandle: conn.targetHandle || 'input',
          // 不设置 label，连线不显示文字
        }
      }
    })

    set({
      nodes,
      edges,
      workflowConfig: config,
      // 加载工作流时不设置文件名，需要外部调用setCurrentFileName
    })
  },

  setCurrentFileName: (filename) => {
    set({ currentFileName: filename })
  },

  clearWorkflow: () => {
    set({
      nodes: initialNodes,
      edges: initialEdges,
      workflowConfig: null,
      currentFileName: null,
    })
  },

  updateNodeTypeInstances: (nodeTypeId, nodeTypeData) => {
    const { nodes, edges } = get()
    
    // 收集需要更新的节点和受影响的连接
    const updatedNodes = nodes.map((node) => {
      // 只更新匹配节点类型的实例
      if (node.data?.type === nodeTypeId) {
        const updatedData: Record<string, any> = { ...node.data }
        
        // 更新节点名称（如果提供）
        if (nodeTypeData.name !== undefined) {
          updatedData.label = nodeTypeData.name
        }
        
        // 更新颜色（存储到nodeType中）
        if (nodeTypeData.color !== undefined) {
          if (!updatedData.nodeType) {
            updatedData.nodeType = {}
          }
          updatedData.nodeType = {
            ...updatedData.nodeType,
            color: nodeTypeData.color,
          }
        }
        
        // 更新输入输出参数schema
        if (nodeTypeData.inputParams !== undefined) {
          updatedData.inputParams = nodeTypeData.inputParams
        }
        if (nodeTypeData.outputParams !== undefined) {
          updatedData.outputParams = nodeTypeData.outputParams
        }
        
        return {
          ...node,
          data: updatedData,
        }
      }
      return node
    })
    
    // 检查并清理无效的连接（如果参数被删除）
    let updatedEdges = edges
    if (nodeTypeData.inputParams !== undefined || nodeTypeData.outputParams !== undefined) {
      const newInputParams = nodeTypeData.inputParams || {}
      const newOutputParams = nodeTypeData.outputParams || {}
      
      const removedConnections: string[] = []
      
      updatedEdges = edges.filter((edge) => {
        const sourceNode = updatedNodes.find((n) => n.id === edge.source)
        const targetNode = updatedNodes.find((n) => n.id === edge.target)
        
        // 如果源节点是被更新的节点类型，检查输出参数是否存在
        if (sourceNode?.data?.type === nodeTypeId) {
          const outputParam = edge.sourceHandle
          if (outputParam && !newOutputParams[outputParam]) {
            removedConnections.push(edge.id)
            return false
          }
        }
        
        // 如果目标节点是被更新的节点类型，检查输入参数是否存在
        if (targetNode?.data?.type === nodeTypeId) {
          const inputParam = edge.targetHandle
          if (inputParam && !newInputParams[inputParam]) {
            removedConnections.push(edge.id)
            return false
          }
        }
        
        return true
      })
      
      if (removedConnections.length > 0) {
        console.warn(`以下连接因参数被删除而移除: ${removedConnections.join(', ')}`)
      }
    }
    
    set({ nodes: updatedNodes, edges: updatedEdges })
  },

  exportWorkflow: () => {
    const { nodes, edges, workflowConfig } = get()
    
    const workflowNodes: WorkflowNode[] = nodes.map((node) => {
      // 从 data 中排除 inputParams 和 outputParams，因为这些可以从服务器根据节点类型获取
      const { inputParams, outputParams, label, type, config, nodeType, ...restData } = node.data || {}
      
      // 转换 position 格式：内部使用 {x, y}，导出使用 {left, top} 避免 YAML 歧义
      const exportedPosition = node.position
        ? {
            left: node.position.x,
            top: node.position.y,
          }
        : undefined
      
      // 构建导出的节点数据，不包含可以从服务器获取的信息
      const exportedNode: WorkflowNode = {
        id: node.id,
        type: node.data.type || node.type || 'custom',
        position: exportedPosition,
        name: node.data.label || node.id,
        config: node.data.config || {},
      }
      
      // 只有在 restData 中还有其他字段时才添加 data（通常不会有）
      if (Object.keys(restData).length > 0) {
        exportedNode.data = restData
      }
      
      return exportedNode
    })

    // 导出为 from/to 格式（与 stream-workflow 兼容）
    const workflowConnections: WorkflowConnection[] = edges.map((edge) => ({
      id: edge.id,
      from: `${edge.source}.${edge.sourceHandle || 'output'}`,
      to: `${edge.target}.${edge.targetHandle || 'input'}`,
      label: edge.label as string,
    }))

    return {
      workflow: {
        name: workflowConfig?.workflow.name || '未命名工作流',
        description: workflowConfig?.workflow.description,
        config: workflowConfig?.workflow.config || {},
        nodes: workflowNodes,
        connections: workflowConnections,
      },
    }
  },
}))

