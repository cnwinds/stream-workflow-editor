import React, { useCallback, useRef, useEffect, useMemo, createContext, useContext, useState } from 'react'
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
import { message } from 'antd'
import { useWorkflowStore } from '@/stores/workflowStore'
import { NodeType, ParameterSchema } from '@/types/node'
import { WorkflowValidator } from '@/utils/validators'
import { nodeApi } from '@/services/api'
import CustomNode from './CustomNode'
import SmartEdge from './SmartEdge'
import EnhancedMiniMap from './EnhancedMiniMap'
import ConnectionContextMenu from './ConnectionContextMenu'
import './WorkflowCanvas.css'

const nodeTypes = {
  custom: CustomNode,
}

const edgeTypes = {
  smart: SmartEdge,
}

// 创建 Context 用于在 WorkflowCanvas 和 CustomNode 之间共享 handle 悬停状态
interface HandleHoverContextType {
  onHandleMouseEnter: (nodeId: string, handleId: string, handleType: 'source' | 'target') => void
  onHandleMouseLeave: () => void
}

const HandleHoverContext = createContext<HandleHoverContextType | null>(null)

export const useHandleHover = () => {
  const context = useContext(HandleHoverContext)
  return context
}

interface WorkflowCanvasProps {
  onNodeSelect?: (nodeId: string | null) => void
  selectedNodeId?: string | null
  onEdgeSelect?: (edgeId: string | null) => void // 连接线选中回调
}

const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  onNodeSelect,
  selectedNodeId,
  onEdgeSelect,
}) => {
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = React.useState<string | null>(null)
  const [hoveredEdgeId, setHoveredEdgeId] = React.useState<string | null>(null)
  const [hoveredHandleEdges, setHoveredHandleEdges] = React.useState<Set<string>>(new Set())
  
  // 连接上下文菜单相关状态
  const [connectionMenu, setConnectionMenu] = useState<{
    visible: boolean
    x: number
    y: number
    sourceNodeId: string
    sourceHandleId: string
    targetNodeId: string
    handleType: 'source' | 'target' // 记录连接起始的 handle 类型
    isTargetCustomNode: boolean | null // null 表示还未检查
  } | null>(null)
  
  // 连接拖拽状态
  const connectionStartRef = useRef<{
    sourceNodeId: string
    sourceHandleId: string
    handleType: 'source' | 'target' // 记录连接起始的 handle 类型
  } | null>(null)
  
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    removeNode,
    undo,
    redo,
    canUndo,
    canRedo,
    updateNodeData,
  } = useWorkflowStore()

  // 监听 edges 变化，如果选中的连接线被删除，清除选中状态
  useEffect(() => {
    if (selectedEdgeId && !edges.find((e) => e.id === selectedEdgeId)) {
      setSelectedEdgeId(null)
      onEdgeSelect?.(null)
    }
  }, [edges, selectedEdgeId, onEdgeSelect])

  // 处理键盘快捷键（Delete、撤销、重做）
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 避免在输入框中触发
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      // 处理 Delete/Backspace 删除
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        event.stopPropagation()
        
        // 优先删除选中的连接
        if (selectedEdgeId) {
          onEdgesChange([{ id: selectedEdgeId, type: 'remove' }])
          setSelectedEdgeId(null)
          onEdgeSelect?.(null)
        } 
        // 其次删除选中的节点
        else if (selectedNodeId) {
          removeNode(selectedNodeId)
          onNodeSelect?.(null)
        }
      }

      // 处理 Ctrl+Z 撤销
      if (event.key === 'z' && (event.ctrlKey || event.metaKey) && !event.shiftKey) {
        event.preventDefault()
        event.stopPropagation()
        if (canUndo()) {
          undo()
        }
      }

      // 处理 Ctrl+Y 或 Ctrl+Shift+Z 重做
      if (
        (event.key === 'y' && (event.ctrlKey || event.metaKey)) ||
        (event.key === 'z' && (event.ctrlKey || event.metaKey) && event.shiftKey)
      ) {
        event.preventDefault()
        event.stopPropagation()
        if (canRedo()) {
          redo()
        }
      }
    }

    // 使用 capture 模式确保能捕获到事件
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [selectedNodeId, selectedEdgeId, removeNode, onNodeSelect, onEdgesChange, undo, redo, canUndo, canRedo, onEdgeSelect])

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      setSelectedEdgeId(edge.id)
      // 清除节点选中状态
      onNodeSelect?.(null)
      // 通知父组件选中的连接线
      onEdgeSelect?.(edge.id)
    },
    [onNodeSelect, onEdgeSelect]
  )

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeSelect?.(node.id)
      // 清除连接选中状态
      setSelectedEdgeId(null)
      onEdgeSelect?.(null)
    },
    [onNodeSelect, onEdgeSelect]
  )

  const handlePaneClick = useCallback(() => {
    onNodeSelect?.(null)
    setSelectedEdgeId(null)
    onEdgeSelect?.(null)
    // 关闭连接上下文菜单
    if (connectionMenu) {
      setConnectionMenu(null)
    }
  }, [onNodeSelect, onEdgeSelect, connectionMenu])

  // 处理连接开始
  const handleConnectStart = useCallback((_event: React.MouseEvent | React.TouchEvent, params: { nodeId: string | null; handleId: string | null; handleType?: 'source' | 'target' | null }) => {
    const { nodeId, handleId, handleType } = params
    if (!nodeId || !handleId) return

    // 如果没有提供 handleType，通过检查节点数据来判断
    let detectedHandleType: 'source' | 'target' = 'source'
    if (handleType) {
      detectedHandleType = handleType
    } else {
      const node = nodes.find(n => n.id === nodeId)
      if (node) {
        // 如果在 outputParams 中找到，说明是 source；如果在 inputParams 中找到，说明是 target
        const outputParams = node.data?.outputParams || {}
        const inputParams = node.data?.inputParams || {}
        if (outputParams[handleId]) {
          detectedHandleType = 'source'
        } else if (inputParams[handleId]) {
          detectedHandleType = 'target'
        }
      }
    }

    connectionStartRef.current = {
      sourceNodeId: nodeId,
      sourceHandleId: handleId,
      handleType: detectedHandleType,
    }
  }, [nodes])

  // 检查节点是否为自定义节点的辅助函数
  const checkIsCustomNode = useCallback(async (nodeType: string): Promise<boolean> => {
    if (!nodeType) {
      return false
    }
    try {
      // 尝试获取自定义节点列表
      const customNodesResponse = await nodeApi.getCustomNodes()
      const customNodes = customNodesResponse.nodes || []
      return customNodes.some((n: any) => n.id === nodeType)
    } catch (error) {
      // 如果获取失败，假设不是自定义节点
      return false
    }
  }, [])

  // 处理连接结束 - 使用全局 mouseup 事件
  useEffect(() => {
    const handleMouseUp = (event: MouseEvent) => {
      if (!connectionStartRef.current) {
        return
      }

      const { sourceNodeId, sourceHandleId, handleType } = connectionStartRef.current
      
      // 延迟检查，等待 React Flow 的 onConnect 先处理
      setTimeout(() => {
        // 如果连接已经成功，connectionStartRef 会被清除
        if (!connectionStartRef.current || connectionStartRef.current.sourceNodeId !== sourceNodeId) {
          return
        }

        // 清除连接状态
        connectionStartRef.current = null

        // 获取鼠标位置
        const clientX = event.clientX
        const clientY = event.clientY

        // 查找鼠标位置下的节点
        const targetElement = document.elementFromPoint(clientX, clientY)
        if (!targetElement) {
          return
        }

        // 查找最近的节点元素
        let nodeElement: HTMLElement | null = targetElement as HTMLElement
        while (nodeElement && !nodeElement.classList.contains('react-flow__node')) {
          nodeElement = nodeElement.parentElement
        }

        if (!nodeElement) {
          return
        }

        // 获取节点 ID
        const targetNodeId = nodeElement.getAttribute('data-id')
        if (!targetNodeId || targetNodeId === sourceNodeId) {
          return
        }

        // 检查是否连接到了 handle
        const handleElement = targetElement.closest('.react-flow__handle')
        if (handleElement) {
          // 如果连接到了 handle，正常连接处理会由 onConnect 处理
          return
        }

        // 如果没有连接到 handle，显示上下文菜单
        const sourceNode = nodes.find(n => n.id === sourceNodeId)
        if (!sourceNode) {
          return
        }

        // 根据 handleType 获取参数信息
        let sourceParam: ParameterSchema | undefined
        if (handleType === 'source') {
          // 从输出端口拉线，需要获取输出参数
          const outputParams = sourceNode.data.outputParams || {}
          sourceParam = outputParams[sourceHandleId]
        } else {
          // 从输入端口拉线，需要获取输入参数
          const inputParams = sourceNode.data.inputParams || {}
          sourceParam = inputParams[sourceHandleId]
        }
        
        if (!sourceParam) {
          return
        }

        // 根据 handleType 检查相应的节点是否为自定义节点
        const targetNode = nodes.find(n => n.id === targetNodeId)
        
        // 两种情况下都检查目标节点：source 时在目标节点创建输入参数，target 时在目标节点创建输出参数
        const nodeTypeToCheck = targetNode?.data?.type || targetNode?.type
        
        // 显示上下文菜单
        setConnectionMenu({
          visible: true,
          x: clientX,
          y: clientY,
          sourceNodeId,
          sourceHandleId,
          targetNodeId,
          handleType,
          isTargetCustomNode: null, // 初始状态为 null，等待异步检查（注意：对于 target 类型，这里实际检查的是源节点）
        })
        
        // 异步检查节点类型并更新菜单状态
        if (nodeTypeToCheck) {
          checkIsCustomNode(nodeTypeToCheck).then((isCustom) => {
            setConnectionMenu((prev) => {
              if (prev && prev.targetNodeId === targetNodeId && prev.sourceNodeId === sourceNodeId) {
                return { ...prev, isTargetCustomNode: isCustom }
              }
              return prev
            })
          })
        }
      }, 100)
    }

    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [nodes, checkIsCustomNode])

  // 更新节点参数定义的辅助函数（用于自定义节点）
  const updateNodeParameters = useCallback(async (
    nodeType: string,
    inputParams: Record<string, ParameterSchema>,
    outputParams: Record<string, ParameterSchema>
  ) => {
    try {
      const customNodeInfo = await nodeApi.getCustomNode(nodeType)
      if (customNodeInfo) {
        await nodeApi.updateCustomNodeParameters(nodeType, {
          inputs: inputParams,
          outputs: outputParams,
        })
      }
    } catch (error) {
      console.warn(`节点 ${nodeType} 不是自定义节点，只更新内存中的数据:`, error)
    }
  }, [])

  // 处理创建输入参数并连接
  const handleCreateInputAndConnect = useCallback(async () => {
    if (!connectionMenu) return

    const { sourceNodeId, sourceHandleId, targetNodeId } = connectionMenu
    const sourceNode = nodes.find(n => n.id === sourceNodeId)
    const targetNode = nodes.find(n => n.id === targetNodeId)

    if (!sourceNode || !targetNode) return

    // 检查目标节点是否为自定义节点
    const targetNodeType = targetNode.data.type || targetNode.type
    if (targetNodeType) {
      const isCustomNode = await checkIsCustomNode(targetNodeType)
      if (!isCustomNode) {
        message.warning('内置节点的接口不能修改，无法创建输入参数')
        setConnectionMenu(null)
        return
      }
    }

    // 获取源节点的输出参数
    const sourceParam = sourceNode.data.outputParams?.[sourceHandleId] as ParameterSchema
    if (!sourceParam) return

    // 获取目标节点的参数
    const targetInputParams = targetNode.data.inputParams || {}
    const targetOutputParams = targetNode.data.outputParams || {}

    // 如果目标节点已有同名输入参数，直接连接
    if (targetInputParams[sourceHandleId]) {
      onConnect({
        source: sourceNodeId,
        sourceHandle: sourceHandleId,
        target: targetNodeId,
        targetHandle: sourceHandleId,
      })
      setConnectionMenu(null)
      return
    }

    // 创建新的输入参数（复制源输出的参数）
    const newInputParams = {
      ...targetInputParams,
      [sourceHandleId]: {
        isStreaming: sourceParam.isStreaming,
        schema: { ...sourceParam.schema },
      },
    }

    // 更新目标节点的输入参数
    updateNodeData(targetNodeId, { inputParams: newInputParams })

    // 如果是自定义节点，更新服务器端定义
    if (targetNodeType) {
      await updateNodeParameters(targetNodeType, newInputParams, targetOutputParams)
    }

    // 创建连接：源节点输出 → 目标节点输入
    onConnect({
      source: sourceNodeId,
      sourceHandle: sourceHandleId,
      target: targetNodeId,
      targetHandle: sourceHandleId,
    })

    setConnectionMenu(null)
  }, [connectionMenu, nodes, onConnect, updateNodeData, checkIsCustomNode, updateNodeParameters])

  // 处理创建输出参数并连接
  const handleCreateOutputAndConnect = useCallback(async () => {
    if (!connectionMenu) return

    const { sourceNodeId, sourceHandleId, targetNodeId } = connectionMenu
    const sourceNode = nodes.find(n => n.id === sourceNodeId)
    const targetNode = nodes.find(n => n.id === targetNodeId)

    if (!sourceNode || !targetNode) return

    // 检查目标节点是否为自定义节点（在目标节点上创建输出参数）
    const targetNodeType = targetNode.data.type || targetNode.type
    if (targetNodeType) {
      const isCustomNode = await checkIsCustomNode(targetNodeType)
      if (!isCustomNode) {
        message.warning('内置节点的接口不能修改，无法创建输出参数')
        setConnectionMenu(null)
        return
      }
    }

    // 获取源节点的输入参数（从输入端口拉线）
    const sourceParam = sourceNode.data.inputParams?.[sourceHandleId] as ParameterSchema
    if (!sourceParam) return

    // 获取目标节点的参数
    const targetOutputParams = targetNode.data.outputParams || {}
    const targetInputParams = targetNode.data.inputParams || {}

    // 如果目标节点已有同名输出参数，直接连接
    if (targetOutputParams[sourceHandleId]) {
      onConnect({
        source: targetNodeId,
        sourceHandle: sourceHandleId,
        target: sourceNodeId,
        targetHandle: sourceHandleId,
      })
      setConnectionMenu(null)
      return
    }

    // 创建新的输出参数（复制源输入的参数）
    const newOutputParams = {
      ...targetOutputParams,
      [sourceHandleId]: {
        isStreaming: sourceParam.isStreaming,
        schema: { ...sourceParam.schema },
      },
    }

    // 更新目标节点的输出参数
    updateNodeData(targetNodeId, { outputParams: newOutputParams })

    // 如果是自定义节点，更新服务器端定义
    if (targetNodeType) {
      await updateNodeParameters(targetNodeType, targetInputParams, newOutputParams)
    }

    // 创建连接：目标节点输出 → 源节点输入
    onConnect({
      source: targetNodeId,
      sourceHandle: sourceHandleId,
      target: sourceNodeId,
      targetHandle: sourceHandleId,
    })

    setConnectionMenu(null)
  }, [connectionMenu, nodes, onConnect, updateNodeData, checkIsCustomNode, updateNodeParameters])

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
      const rawPosition = reactFlowInstance.current?.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      }) || { x: 0, y: 0 }
      
      // 对齐到10的倍数，实现吸附效果
      const position = {
        x: Math.round(rawPosition.x / 10) * 10,
        y: Math.round(rawPosition.y / 10) * 10,
      }

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
    const handleHoveredEdges: Edge[] = []
    const normalEdges: Edge[] = []
    
    edgesArray.forEach((edge) => {
      if (edge.id === selectedEdgeId) {
        selectedEdges.push(edge)
      } else if (edge.id === hoveredEdgeId) {
        hoveredEdges.push(edge)
      } else if (hoveredHandleEdges.has(edge.id)) {
        handleHoveredEdges.push(edge)
      } else {
        normalEdges.push(edge)
      }
    })
    
    // 排序：普通连线 -> handle悬停高亮连线 -> 悬停连线 -> 选中连线（最后渲染的在最上层）
    return [...normalEdges, ...handleHoveredEdges, ...hoveredEdges, ...selectedEdges]
  }, [edges, selectedEdgeId, hoveredEdgeId, hoveredHandleEdges])

  // 处理连线鼠标事件
  const handleEdgeMouseEnter = useCallback((_event: React.MouseEvent, edge: Edge) => {
    setHoveredEdgeId(edge.id)
  }, [])

  const handleEdgeMouseLeave = useCallback(() => {
    setHoveredEdgeId(null)
  }, [])

  // 处理 Handle 悬停事件
  const handleHandleMouseEnter = useCallback((nodeId: string, handleId: string, handleType: 'source' | 'target') => {
    // 找到所有连接到该 handle 的边
    const connectedEdges = edges.filter((edge) => {
      if (handleType === 'source') {
        return edge.source === nodeId && edge.sourceHandle === handleId
      } else {
        return edge.target === nodeId && edge.targetHandle === handleId
      }
    })
    
    // 收集这些边的 ID
    const edgeIds = new Set(connectedEdges.map((edge) => edge.id))
    setHoveredHandleEdges(edgeIds)
  }, [edges])

  const handleHandleMouseLeave = useCallback(() => {
    setHoveredHandleEdges(new Set())
  }, [])

  // Handle 悬停 Context 值
  const handleHoverContextValue = useMemo(() => ({
    onHandleMouseEnter: handleHandleMouseEnter,
    onHandleMouseLeave: handleHandleMouseLeave,
  }), [handleHandleMouseEnter, handleHandleMouseLeave])

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlowProvider>
        <HandleHoverContext.Provider value={handleHoverContextValue}>
          <ReactFlow
          nodes={nodes}
          edges={sortedEdges.map((edge) => {
            const { label, ...edgeWithoutLabel } = edge
            const isValid = !invalidEdgeIds.includes(edge.id)
            const isSelected = edge.id === selectedEdgeId
            const isHovered = edge.id === hoveredEdgeId
            const isHandleHovered = hoveredHandleEdges.has(edge.id)
            
            return {
              ...edgeWithoutLabel,
              ...edgeOptions,
              selected: isSelected,
              selectable: true, // 确保边可以被选中
              // 如果连接无效，使用红色样式
              style: {
                ...edgeOptions.style,
                stroke: isValid ? undefined : '#ff4d4f', // 红色表示错误
                strokeWidth: isValid ? (isSelected ? 3 : (isHovered ? 2.5 : (isHandleHovered ? 2.5 : 2))) : 3, // 选中/高亮时稍微粗一点
              },
              // 添加数据标记，方便SmartEdge组件使用
              data: {
                isValid,
                isSelected,
                isHovered,
                isHandleHovered,
              },
            }
          })}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={(connection) => {
            // 如果连接成功，清除连接状态
            if (connectionStartRef.current) {
              connectionStartRef.current = null
            }
            onConnect(connection)
          }}
          onConnectStart={handleConnectStart}
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
        {connectionMenu?.visible && (
          <ConnectionContextMenu
            x={connectionMenu.x}
            y={connectionMenu.y}
            onSelect={
              connectionMenu.handleType === 'source' 
                ? handleCreateInputAndConnect 
                : handleCreateOutputAndConnect
            }
            onClose={() => setConnectionMenu(null)}
            disabled={connectionMenu.isTargetCustomNode === false} // 如果是内置节点则禁用
            menuType={connectionMenu.handleType === 'source' ? 'input' : 'output'}
          />
        )}
        </HandleHoverContext.Provider>
      </ReactFlowProvider>
    </div>
  )
}

export default WorkflowCanvas

