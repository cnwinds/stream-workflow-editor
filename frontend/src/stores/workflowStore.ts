import { create } from 'zustand'
import { Node, Edge, Connection, addEdge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from 'reactflow'
import { WorkflowConfig, WorkflowNode, WorkflowConnection } from '@/types/workflow'

interface WorkflowState {
  nodes: Node[]
  edges: Edge[]
  workflowConfig: WorkflowConfig | null
  
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
}

const initialNodes: Node[] = []
const initialEdges: Edge[] = []

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  workflowConfig: null,

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
        // 如果没有 position，自动生成布局（水平排列）
        const position = node.position || {
          x: 200 + (index % 3) * 300,
          y: 100 + Math.floor(index / 3) * 200,
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
            inputParams,
            outputParams,
            ...(node.data || {}),
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
    })
  },

  exportWorkflow: () => {
    const { nodes, edges, workflowConfig } = get()
    
    const workflowNodes: WorkflowNode[] = nodes.map((node) => ({
      id: node.id,
      type: node.data.type || node.type || 'custom',
      position: node.position,
      name: node.data.label || node.id,
      config: node.data.config || {},
      data: node.data,
    }))

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

