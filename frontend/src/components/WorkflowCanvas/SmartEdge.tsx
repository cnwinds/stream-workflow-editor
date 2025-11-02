/**
 * 智能边组件 - 自动避开节点和连线交叉
 */
import { useMemo } from 'react'
import { BaseEdge, EdgeProps, getSmoothStepPath } from 'reactflow'
import { calculateSmartPath, generatePathString } from '@/utils/edgeRouter'
import { useWorkflowStore } from '@/stores/workflowStore'

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
}: EdgeProps) {
  const { nodes } = useWorkflowStore()
  
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
      style={style}
    />
  )
}

