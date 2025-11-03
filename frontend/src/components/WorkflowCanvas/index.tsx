import React, { useCallback, useRef, useEffect, useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  Node,
  Edge,
  ReactFlowProvider,
  ReactFlowInstance,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useWorkflowStore } from '@/stores/workflowStore'
import { NodeType } from '@/types/node'
import { WorkflowValidator } from '@/utils/validators'
import CustomNode from './CustomNode'
import SmartEdge from './SmartEdge'
import EnhancedMiniMap from './EnhancedMiniMap'
import './WorkflowCanvas.css'

const nodeTypes = {
  custom: CustomNode,
}

const edgeTypes = {
  smart: SmartEdge,
}

interface WorkflowCanvasProps {
  onNodeSelect?: (nodeId: string | null) => void
  selectedNodeId?: string | null
}

const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  onNodeSelect,
  selectedNodeId,
}) => {
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = React.useState<string | null>(null)
  const [hoveredEdgeId, setHoveredEdgeId] = React.useState<string | null>(null)
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    removeNode,
  } = useWorkflowStore()

  // 处理 Delete 键删除节点或连接
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 避免在输入框中删除
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        event.stopPropagation()
        
        // 优先删除选中的连接
        if (selectedEdgeId) {
          onEdgesChange([{ id: selectedEdgeId, type: 'remove' }])
          setSelectedEdgeId(null)
        } 
        // 其次删除选中的节点
        else if (selectedNodeId) {
          removeNode(selectedNodeId)
          onNodeSelect?.(null)
        }
      }
    }

    // 使用 capture 模式确保能捕获到事件
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [selectedNodeId, selectedEdgeId, removeNode, onNodeSelect, onEdgesChange])

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      setSelectedEdgeId(edge.id)
      // 清除节点选中状态
      onNodeSelect?.(null)
    },
    [onNodeSelect]
  )

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeSelect?.(node.id)
      // 清除连接选中状态
      setSelectedEdgeId(null)
    },
    [onNodeSelect]
  )

  const handlePaneClick = useCallback(() => {
    onNodeSelect?.(null)
    setSelectedEdgeId(null)
  }, [onNodeSelect])

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance
  }, [])

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault()

      const nodeTypeJson = event.dataTransfer.getData('application/reactflow')
      if (!nodeTypeJson) {
        return
      }

      const nodeType: NodeType = JSON.parse(nodeTypeJson)
      const position = reactFlowInstance.current?.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      }) || { x: 0, y: 0 }

      // 加载节点的 schema
      let inputParams: Record<string, any> = {}
      let outputParams: Record<string, any> = {}
      
      try {
        const { nodeApi } = await import('@/services/api')
        const schema = await nodeApi.getNodeSchema(nodeType.id)
        if (schema.INPUT_PARAMS) {
          inputParams = schema.INPUT_PARAMS
        }
        if (schema.OUTPUT_PARAMS) {
          outputParams = schema.OUTPUT_PARAMS
        }
      } catch (error) {
        console.warn(`无法加载节点 ${nodeType.id} 的 schema:`, error)
      }

      const newNode: Node = {
        id: `${nodeType.id}-${Date.now()}`,
        type: 'custom',
        position,
        data: {
          label: nodeType.name,
          nodeType,
          type: nodeType.id,
          inputParams,
          outputParams,
        },
      }

      addNode(newNode)
    },
    [addNode]
  )

  // 验证所有连接，找出无效的连接
  const invalidEdgeIds = useMemo(() => {
    return WorkflowValidator.validateConnections(edges, nodes)
  }, [edges, nodes])

  // 自定义边的样式（不显示标签，使用智能路径）
  const edgeOptions = {
    type: 'smart', // 使用智能边类型
    markerEnd: {
      type: MarkerType.ArrowClosed,
    },
    style: {
      strokeWidth: 2,
    },
  }

  // 处理连线的渲染顺序：选中的和高亮的放在最后渲染（显示在最上层）
  const sortedEdges = useMemo(() => {
    const edgesArray = [...edges]
    
    // 分离选中的、高亮的和普通的连线
    const selectedEdges: Edge[] = []
    const hoveredEdges: Edge[] = []
    const normalEdges: Edge[] = []
    
    edgesArray.forEach((edge) => {
      if (edge.id === selectedEdgeId) {
        selectedEdges.push(edge)
      } else if (edge.id === hoveredEdgeId) {
        hoveredEdges.push(edge)
      } else {
        normalEdges.push(edge)
      }
    })
    
    // 排序：普通连线 -> 高亮连线 -> 选中连线（最后渲染的在最上层）
    return [...normalEdges, ...hoveredEdges, ...selectedEdges]
  }, [edges, selectedEdgeId, hoveredEdgeId])

  // 处理连线鼠标事件
  const handleEdgeMouseEnter = useCallback((_event: React.MouseEvent, edge: Edge) => {
    setHoveredEdgeId(edge.id)
  }, [])

  const handleEdgeMouseLeave = useCallback(() => {
    setHoveredEdgeId(null)
  }, [])

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={sortedEdges.map((edge) => {
            const { label, ...edgeWithoutLabel } = edge
            const isValid = !invalidEdgeIds.includes(edge.id)
            const isSelected = edge.id === selectedEdgeId
            const isHovered = edge.id === hoveredEdgeId
            
            return {
              ...edgeWithoutLabel,
              ...edgeOptions,
              selected: isSelected,
              // 如果连接无效，使用红色样式
              style: {
                ...edgeOptions.style,
                stroke: isValid ? undefined : '#ff4d4f', // 红色表示错误
                strokeWidth: isValid ? (isSelected ? 3 : (isHovered ? 2.5 : 2)) : 3, // 选中/高亮时稍微粗一点
              },
              // 添加数据标记，方便SmartEdge组件使用
              data: {
                isValid,
                isSelected,
                isHovered,
              },
            }
          })}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onEdgeMouseEnter={handleEdgeMouseEnter}
          onEdgeMouseLeave={handleEdgeMouseLeave}
          onPaneClick={handlePaneClick}
          edgesUpdatable={true}
          edgesFocusable={true}
          onInit={onInit}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          attributionPosition="bottom-left"
          defaultEdgeOptions={edgeOptions}
        >
          <Background />
          <Controls />
          <EnhancedMiniMap reactFlowInstance={reactFlowInstance.current} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}

export default WorkflowCanvas

