import React, { useEffect, useRef, useState } from 'react'
import { MiniMap, MiniMapProps, ReactFlowInstance } from 'reactflow'
import { useThemeStore } from '@/stores/themeStore'

interface EnhancedMiniMapProps extends MiniMapProps {
  reactFlowInstance?: ReactFlowInstance | null
}

/**
 * 增强版 MiniMap 组件
 * 支持：
 * 1. 点击导航：在 MiniMap 上点击任意位置，主画布会跳转到对应位置
 * 2. 拖拽导航：在 MiniMap 上拖拽视口框，主画布会跟随移动（通过 pannable 启用）
 * 3. 滚轮切换：在 MiniMap 上使用滚轮可以在 fit view 模式和当前窗口之间切换
 */
const EnhancedMiniMap: React.FC<EnhancedMiniMapProps> = ({
  reactFlowInstance,
  ...props
}) => {
  const { getCurrentTheme, theme: themeMode } = useThemeStore()
  const theme = getCurrentTheme()
  const minimapRef = useRef<HTMLDivElement>(null)
  const [fitViewMode, setFitViewMode] = useState(false)
  const savedViewportRef = useRef<{ x: number; y: number; zoom: number } | null>(null)

  useEffect(() => {
    if (!minimapRef.current || !reactFlowInstance) return

    const minimapElement = minimapRef.current.querySelector('.react-flow__minimap') as HTMLElement
    if (!minimapElement) return

    const handleClick = (event: MouseEvent) => {
      // 如果点击的是视口框（白色矩形），不处理（让拖拽功能处理）
      const viewportMask = minimapElement.querySelector('.react-flow__minimap-mask') as HTMLElement
      if (viewportMask && event.target && viewportMask.contains(event.target as HTMLElement)) {
        return
      }

      // 获取画布边界（从节点位置计算）
      const nodes = reactFlowInstance.getNodes()
      if (nodes.length === 0) return

      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity

      nodes.forEach((node) => {
        // 使用节点的默认尺寸或实际尺寸
        const nodeWidth = (node.width as number) || 200
        const nodeHeight = (node.height as number) || 100
        
        minX = Math.min(minX, node.position.x)
        minY = Math.min(minY, node.position.y)
        maxX = Math.max(maxX, node.position.x + nodeWidth)
        maxY = Math.max(maxY, node.position.y + nodeHeight)
      })

      // 添加边距
      const padding = 200
      minX -= padding
      minY -= padding
      maxX += padding
      maxY += padding

      const width = maxX - minX
      const height = maxY - minY

      // 计算点击位置相对于 MiniMap 的百分比
      const rect = minimapElement.getBoundingClientRect()
      const clickX = (event.clientX - rect.left) / rect.width
      const clickY = (event.clientY - rect.top) / rect.height

      // 计算目标位置（使点击位置居中）
      const targetX = minX + clickX * width
      const targetY = minY + clickY * height

      // 跳转到目标位置，保持当前缩放级别
      const currentViewport = reactFlowInstance.getViewport()
      reactFlowInstance.setCenter(targetX, targetY, { zoom: currentViewport.zoom })
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      event.stopPropagation()

      // 向下滚动：切换到 fit view
      // 向上滚动：恢复之前的视图
      if (event.deltaY > 0) {
        if (!fitViewMode) {
          // 保存当前视图状态
          const viewport = reactFlowInstance.getViewport()
          savedViewportRef.current = { ...viewport }
          
          setFitViewMode(true)
          reactFlowInstance.fitView({ padding: 0.2, duration: 300 })
        }
      } else {
        if (fitViewMode && savedViewportRef.current) {
          setFitViewMode(false)
          // 恢复之前的视图
          reactFlowInstance.setViewport(savedViewportRef.current, { duration: 300 })
        }
      }
    }

    minimapElement.addEventListener('click', handleClick)
    minimapElement.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      minimapElement.removeEventListener('click', handleClick)
      minimapElement.removeEventListener('wheel', handleWheel)
    }
  }, [reactFlowInstance, fitViewMode])

  // 根据主题设置 minimap 的颜色
  // 为了增加对比度，在不同主题下使用合适的节点颜色
  const getNodeColor = () => {
    if (themeMode === 'dark') {
      // 暗色主题：使用更亮的颜色以增加对比度
      return '#e8e8e8' // 浅灰色，在深色背景上更清晰
    } else if (themeMode === 'eye-care') {
      // 护眼主题：使用稍微亮一点的颜色
      return '#d4d3cc'
    } else {
      // 明亮主题：使用更深的颜色以增加对比度（浅色背景上）
      return '#b1b1b7' // 使用更深的灰色填充，在浅色背景上更显眼
    }
  }
  
  const nodeColor = getNodeColor()
  const maskColor = theme.colors.primary || '#1890ff'
  const maskStrokeColor = theme.colors.border || '#e8e8e8'

  return (
    <div ref={minimapRef} className="enhanced-minimap">
      <MiniMap 
        pannable 
        zoomable 
        nodeColor={nodeColor}
        maskColor={maskColor}
        maskStrokeColor={maskStrokeColor}
        style={{
          backgroundColor: theme.colors.backgroundSecondary || '#fafafa',
        }}
        {...props} 
      />
    </div>
  )
}

export default EnhancedMiniMap

