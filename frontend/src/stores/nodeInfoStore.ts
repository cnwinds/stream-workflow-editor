import { create } from 'zustand'
import { NodeType } from '@/types/node'

interface NodeInfoState {
  // 所有节点类型（内置+自定义）的缓存
  nodeTypes: NodeType[]
  // 自定义节点详细信息缓存（key: nodeId, value: 节点详细信息）
  customNodeDetails: Record<string, any>
  // 自定义节点ID列表（用于快速判断是否为自定义节点）
  customNodeIds: Set<string>
  // 加载状态
  loading: boolean
  
  // Actions
  setNodeTypes: (nodeTypes: NodeType[]) => void
  setCustomNodeDetails: (nodeId: string, details: any) => void
  setCustomNodes: (customNodes: any[]) => void
  isCustomNode: (nodeType: string) => boolean
  getNodeDescription: (nodeType: string) => string | undefined
  clearCache: () => void
}

export const useNodeInfoStore = create<NodeInfoState>((set, get) => ({
  nodeTypes: [],
  customNodeDetails: {},
  customNodeIds: new Set<string>(),
  loading: false,

  setNodeTypes: (nodeTypes) => set({ nodeTypes }),
  
  setCustomNodeDetails: (nodeId, details) => 
    set((state) => ({
      customNodeDetails: {
        ...state.customNodeDetails,
        [nodeId]: details,
      },
      // 同时更新自定义节点ID集合
      customNodeIds: new Set([...state.customNodeIds, nodeId]),
    })),
  
  setCustomNodes: (customNodes) => {
    // 将自定义节点列表转换为节点类型格式，并合并到nodeTypes中
    const currentNodeTypes = get().nodeTypes
    const builtInNodeTypes = currentNodeTypes.filter(nt => !customNodes.some((cn: any) => cn.id === nt.id))
    
    const customNodeTypes: NodeType[] = customNodes.map((cn: any) => ({
      id: cn.id,
      name: cn.name,
      description: cn.description,
      category: cn.category,
      executionMode: cn.executionMode,
      color: cn.color,
      configSchema: cn.configSchema,
    }))
    
    // 更新自定义节点ID集合
    const customNodeIds = new Set(customNodes.map((cn: any) => cn.id))
    
    set({ 
      nodeTypes: [...builtInNodeTypes, ...customNodeTypes],
      customNodeIds,
    })
  },
  
  isCustomNode: (nodeType) => {
    return get().customNodeIds.has(nodeType)
  },
  
  getNodeDescription: (nodeType) => {
    const state = get()
    
    // 先从缓存的自定义节点详情中查找
    if (state.customNodeDetails[nodeType]?.description) {
      return state.customNodeDetails[nodeType].description
    }
    
    // 再从节点类型列表中查找
    const nodeTypeInfo = state.nodeTypes.find(nt => nt.id === nodeType)
    return nodeTypeInfo?.description
  },
  
  clearCache: () => set({ nodeTypes: [], customNodeDetails: {}, customNodeIds: new Set() }),
}))

