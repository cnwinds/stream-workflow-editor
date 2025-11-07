/**
 * 智能边组件 - 自动避开节点和连线交叉
 */
import { useMemo } from 'react'
import { BaseEdge, EdgeProps, getSmoothStepPath } from 'reactflow'
import { calculateSmartPath, generatePathString } from '@/utils/edgeRouter'
import { useWorkflowStore } from '@/stores/workflowStore'
import { useThemeStore } from '@/stores/themeStore'

export default function SmartEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const { nodes } = useWorkflowStore()
  const { getCurrentTheme } = useThemeStore()
  
  // 如果连接无效，使用红色
  // data.isValid 明确为 false 时表示无效，undefined 或 true 时表示有效
  const isValid = data?.isValid !== false
  const isHandleHovered = data?.isHandleHovered === true
  
  // 获取当前主题颜色
  const theme = getCurrentTheme()
  
  // 构建边的样式
  // WorkflowCanvas 已经根据验证结果设置了 stroke 颜色，所以优先使用传入的 style
  // 如果 style 中没有 stroke，则根据有效性设置
  // 如果 handle 悬停，使用主题的高亮颜色（使用 streaming 颜色作为高亮色）
  const edgeStyle = {
    ...style,
    stroke: style.stroke !== undefined 
      ? style.stroke 
      : (isValid 
        ? (isHandleHovered ? theme.colors.streaming : undefined) // handle 悬停时使用主题高亮颜色
        : theme.colors.invalid), // 使用主题错误颜色
    strokeWidth: style.strokeWidth !== undefined ? style.strokeWidth : (isValid ? 2 : 3),
  }
  
  // 使用智能路径规划
  const [edgePath] = useMemo(() => {
    try {
      const path = calculateSmartPath(
        { x: sourceX, y: sourceY },
        { x: targetX, y: targetY },
        nodes,
        source || '',
        target || ''
      )

      // 如果路径只有2个点，使用 React Flow 的默认路径
      if (path.length === 2) {
        return getSmoothStepPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
          borderRadius: 20,
        })
      }

      // 否则使用自定义路径
      return [generatePathString(path)]
    } catch (error) {
      console.warn('智能路径生成失败，使用默认路径:', error)
      // 回退到平滑阶梯路径
      return getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 20,
      })
    }
  }, [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, nodes, source, target])

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={edgeStyle}
    />
  )
}

