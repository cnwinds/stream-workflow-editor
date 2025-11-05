import { create } from 'zustand'
import { Node, Edge, Connection, addEdge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from 'reactflow'
import { WorkflowConfig, WorkflowNode, WorkflowConnection } from '@/types/workflow'

interface HistoryState {
  nodes: Node[]
  edges: Edge[]
}

interface WorkflowState {
  nodes: Node[]
  edges: Edge[]
  workflowConfig: WorkflowConfig | null
  currentFileName: string | null
  
  // 历史记录
  history: HistoryState[]
  historyIndex: number
  
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
  
  // 撤销/重做
  saveHistory: () => void
  syncParameterChangesToServer: (oldNodes: Node[], newNodes: Node[]) => Promise<void>
  undo: () => Promise<void>
  redo: () => Promise<void>
  canUndo: () => boolean
  canRedo: () => boolean
}

const initialNodes: Node[] = []
const initialEdges: Edge[] = []

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  workflowConfig: null,
  currentFileName: null,
  history: [{ nodes: initialNodes, edges: initialEdges }],
  historyIndex: 0,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) => {
    const currentNodes = get().nodes
    
    // 应用所有变化（包括选中状态），确保 UI 正确显示
    let newNodes = applyNodeChanges(changes, currentNodes)
    
    // 过滤掉选中状态的变化，只检测实际的内容变化
    const contentChanges = changes.filter((change) => change.type !== 'select')
    
    // 检测是否有节点位置变化，并对位置进行对齐到10的倍数，实现吸附效果
    const hasPositionChange = contentChanges.some((change) => change.type === 'position')
    if (hasPositionChange) {
      // 对位置进行对齐到10的倍数，实现吸附对齐效果
      // 使用 Math.round(x / 10) * 10 来对齐到最近的10的倍数
      newNodes = newNodes.map((node) => {
        if (node.position) {
          return {
            ...node,
            position: {
              x: Math.round(node.position.x / 10) * 10,
              y: Math.round(node.position.y / 10) * 10,
            },
          }
        }
        return node
      })
    }
    
    set({ nodes: newNodes })
    
    // 只在有实际内容变化时才保存历史（不包括选中状态变化）
    if (contentChanges.length > 0) {
      // 检测是否有节点位置变化完成（drag结束）
      const hasPositionChangeComplete = contentChanges.some(
        (change) => change.type === 'position' && change.dragging === false
      )
      
      // 只在位置变化完成时保存历史，避免拖动过程中保存过多中间状态
      if (hasPositionChangeComplete) {
        // 延迟保存，确保位置已经更新
        setTimeout(() => {
          get().saveHistory()
        }, 100)
      } else if (contentChanges.some((change) => change.type !== 'position')) {
        // 如果有其他类型的内容变化（非位置变化），立即保存历史
        setTimeout(() => {
          get().saveHistory()
        }, 0)
      }
    }
  },

  onEdgesChange: (changes) => {
    // 应用所有变化（包括选中状态），确保 UI 正确显示
    set({
      edges: applyEdgeChanges(changes, get().edges),
    })
    
    // 过滤掉选中状态的变化，只检测实际的内容变化
    const contentChanges = changes.filter((change) => change.type !== 'select')
    
    // 检测是否有删除连接的操作（只考虑内容变化）
    const hasRemove = contentChanges.some((change) => change.type === 'remove')
    if (hasRemove) {
      // 删除连接后保存历史
      setTimeout(() => {
        get().saveHistory()
      }, 0)
    }
  },

  onConnect: (connection) => {
    set({
      edges: addEdge(connection, get().edges),
    })
    // 添加连接后保存历史
    setTimeout(() => {
      get().saveHistory()
    }, 0)
  },

  addNode: (node) => {
    set({
      nodes: [...get().nodes, node],
    })
    // 添加节点后保存历史
    setTimeout(() => {
      get().saveHistory()
    }, 0)
  },

  removeNode: (nodeId) => {
    const { nodes, edges } = get()
    set({
      nodes: nodes.filter((n) => n.id !== nodeId),
      edges: edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    })
    // 删除节点后保存历史
    setTimeout(() => {
      get().saveHistory()
    }, 0)
  },

  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } }
          : node
      ),
    })
    
    // 如果更新了参数或配置，保存历史（这些是实际的内容变化）
    const hasContentChange = 'inputParams' in data || 'outputParams' in data || 'config' in data
    if (hasContentChange) {
      setTimeout(() => {
        get().saveHistory()
      }, 0)
    }
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

        // 尝试加载节点的 schema 和类型信息
        let inputParams: Record<string, any> = {}
        let outputParams: Record<string, any> = {}
        let nodeType: any = null
        
        try {
          const { nodeApi } = await import('@/services/api')
          const schema = await nodeApi.getNodeSchema(node.type)
          if (schema.INPUT_PARAMS) {
            inputParams = schema.INPUT_PARAMS
          }
          if (schema.OUTPUT_PARAMS) {
            outputParams = schema.OUTPUT_PARAMS
          }
          
          // 获取节点类型信息（包括 executionMode 和 color）
          try {
            const nodeTypes = await nodeApi.getNodeTypes()
            const foundNodeType = nodeTypes.find((nt: any) => nt.id === node.type)
            if (foundNodeType) {
              nodeType = {
                id: foundNodeType.id,
                name: foundNodeType.name,
                category: foundNodeType.category,
                executionMode: foundNodeType.executionMode || 'sequential',
                color: foundNodeType.color || '#1890ff',
              }
            }
          } catch (error) {
            console.warn(`无法获取节点类型信息 ${node.type}:`, error)
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
            // 设置 nodeType，确保颜色和执行模式能正确显示
            nodeType,
            // 如果 data 中有其他字段（不包含 inputParams/outputParams/nodeType），可以保留
            ...(node.data ? (() => {
              const { inputParams: _, outputParams: __, nodeType: ___, ...otherData } = node.data
              return otherData
            })() : {}),
          },
        }
      })
    )

    // 解析连接
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
          // 不设置 label，连线不显示文字
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
          // 不设置 label，连线不显示文字
        }
      }
    })

    const initialState = { nodes, edges }
    set({
      nodes,
      edges,
      workflowConfig: config,
      history: [initialState],
      historyIndex: 0,
      // 加载工作流时不设置文件名，需要外部调用setCurrentFileName
    })
  },

  setCurrentFileName: (filename) => {
    set({ currentFileName: filename })
  },

  clearWorkflow: () => {
    const initialState = { nodes: initialNodes, edges: initialEdges }
    set({
      nodes: initialNodes,
      edges: initialEdges,
      workflowConfig: null,
      currentFileName: null,
      history: [initialState],
      historyIndex: 0,
    })
  },

  // 保存历史记录
  saveHistory: () => {
    const { nodes, edges, history, historyIndex } = get()
    
    // 创建不包含选中状态的节点和边副本
    const nodesWithoutSelection = nodes.map((node) => {
      const { selected, ...nodeWithoutSelection } = node
      return nodeWithoutSelection
    })
    
    const edgesWithoutSelection = edges.map((edge) => {
      const { selected, ...edgeWithoutSelection } = edge
      return edgeWithoutSelection
    })
    
    const currentState = {
      nodes: JSON.parse(JSON.stringify(nodesWithoutSelection)), // 深拷贝，不包含选中状态
      edges: JSON.parse(JSON.stringify(edgesWithoutSelection)), // 深拷贝，不包含选中状态
    }

    // 如果当前不在历史记录的末尾，删除当前位置之后的所有记录
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(currentState)

    // 限制历史记录数量（最多保留50个状态）
    const maxHistorySize = 50
    if (newHistory.length > maxHistorySize) {
      newHistory.shift()
    } else {
      set({ historyIndex: newHistory.length - 1 })
    }

    set({ history: newHistory })
  },

  // 检测节点参数变化并同步到服务器
  syncParameterChangesToServer: async (oldNodes: Node[], newNodes: Node[]) => {
    try {
      const { nodeApi } = await import('@/services/api')
      
      // 找出参数发生变化的节点（只检查在两个状态中都存在的节点）
      const parameterChangedNodes: Array<{ nodeId: string; nodeType: string; inputParams: any; outputParams: any }> = []
      
      for (const newNode of newNodes) {
        const oldNode = oldNodes.find(n => n.id === newNode.id)
        // 只处理在两个状态中都存在的节点（排除新增节点）
        if (!oldNode) continue
        
        const oldInputParams = oldNode.data?.inputParams || {}
        const oldOutputParams = oldNode.data?.outputParams || {}
        const newInputParams = newNode.data?.inputParams || {}
        const newOutputParams = newNode.data?.outputParams || {}
        
        // 检查输入参数或输出参数是否发生变化
        const inputParamsChanged = JSON.stringify(oldInputParams) !== JSON.stringify(newInputParams)
        const outputParamsChanged = JSON.stringify(oldOutputParams) !== JSON.stringify(newOutputParams)
        
        if (inputParamsChanged || outputParamsChanged) {
          const nodeType = newNode.data?.type
          if (nodeType) {
            // 检查是否为自定义节点
            try {
              await nodeApi.getCustomNode(nodeType)
              // 如果是自定义节点，记录需要更新的信息
              parameterChangedNodes.push({
                nodeId: newNode.id,
                nodeType,
                inputParams: newInputParams,
                outputParams: newOutputParams,
              })
            } catch (error) {
              // 不是自定义节点，跳过
            }
          }
        }
      }
      
      // 批量更新所有参数发生变化的自定义节点
      for (const nodeInfo of parameterChangedNodes) {
        try {
          await nodeApi.updateCustomNodeParameters(nodeInfo.nodeType, {
            inputs: nodeInfo.inputParams,
            outputs: nodeInfo.outputParams,
          })
        } catch (error) {
          console.warn(`更新节点 ${nodeInfo.nodeId} 的参数失败:`, error)
        }
      }
    } catch (error) {
      console.warn('同步参数变化到服务器失败:', error)
    }
  },

  // 撤销
  undo: async () => {
    const { history, historyIndex, nodes } = get()
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      const state = history[newIndex]
      const newNodes = JSON.parse(JSON.stringify(state.nodes))
      const newEdges = JSON.parse(JSON.stringify(state.edges))
      
      // 检测参数变化并同步到服务器
      await get().syncParameterChangesToServer(nodes, newNodes)
      
      set({
        nodes: newNodes,
        edges: newEdges,
        historyIndex: newIndex,
      })
    }
  },

  // 重做
  redo: async () => {
    const { history, historyIndex, nodes } = get()
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      const state = history[newIndex]
      const newNodes = JSON.parse(JSON.stringify(state.nodes))
      const newEdges = JSON.parse(JSON.stringify(state.edges))
      
      // 检测参数变化并同步到服务器
      await get().syncParameterChangesToServer(nodes, newNodes)
      
      set({
        nodes: newNodes,
        edges: newEdges,
        historyIndex: newIndex,
      })
    }
  },

  // 是否可以撤销
  canUndo: () => {
    return get().historyIndex > 0
  },

  // 是否可以重做
  canRedo: () => {
    const { history, historyIndex } = get()
    return historyIndex < history.length - 1
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
      // 对齐到10的倍数，让节点位置更整齐，便于对齐
      const exportedPosition = node.position
        ? {
            left: Math.round(node.position.x / 10) * 10,
            top: Math.round(node.position.y / 10) * 10,
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
    // 重要：使用节点ID（node.id），而不是节点类型（node.type）
    // 格式：{id}.连接名，例如 "opening_agent_node.opening_text"
    const workflowConnections: WorkflowConnection[] = edges.map((edge) => ({
      id: edge.id,
      from: `${edge.source}.${edge.sourceHandle || 'output'}`, // edge.source 是节点ID
      to: `${edge.target}.${edge.targetHandle || 'input'}`, // edge.target 是节点ID
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

