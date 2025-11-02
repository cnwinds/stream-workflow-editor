/**
 * 智能连线路径规划工具 - 重构版
 * 核心思路：
 * 1. 直接路径优先
 * 2. 如果被阻挡，使用最短的绕行路径
 * 3. 路径：source -> 水平/垂直延展 -> 绕行段 -> 水平/垂直延展 -> target
 */

import { Node } from 'reactflow'

export interface Point {
  x: number
  y: number
}

export interface NodeBounds {
  x: number
  y: number
  width: number
  height: number
}

/**
 * 计算节点的边界框
 */
export function getNodeBounds(node: Node): NodeBounds {
  const defaultWidth = 200
  const inputParams = (node.data?.inputParams && Object.keys(node.data.inputParams).length) || 0
  const outputParams = (node.data?.outputParams && Object.keys(node.data.outputParams).length) || 0
  const paramCount = Math.max(inputParams, outputParams)
  const defaultHeight = 40 + Math.max(paramCount * 28, 40) + 16
  
  return {
    x: node.position.x,
    y: node.position.y,
    width: (node.width as number) || defaultWidth,
    height: (node.height as number) || defaultHeight,
  }
}

/**
 * 检查点是否在节点边界框内
 */
function pointInBounds(point: Point, bounds: NodeBounds): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  )
}

/**
 * 检查线段是否与节点边界框相交
 */
function lineIntersectsBounds(
  p1: Point,
  p2: Point,
  bounds: NodeBounds
): boolean {
  // 如果起点或终点在节点内，肯定相交
  if (pointInBounds(p1, bounds) || pointInBounds(p2, bounds)) {
    return true
  }

  // 检查线段包围盒是否与节点包围盒相交
  const minX = Math.min(p1.x, p2.x)
  const maxX = Math.max(p1.x, p2.x)
  const minY = Math.min(p1.y, p2.y)
  const maxY = Math.max(p1.y, p2.y)

  // 快速排除不相交的情况
  if (
    maxX < bounds.x ||
    minX > bounds.x + bounds.width ||
    maxY < bounds.y ||
    minY > bounds.y + bounds.height
  ) {
    return false
  }

  // 检查线段是否穿过节点的四条边
  const nodeRight = bounds.x + bounds.width
  const nodeBottom = bounds.y + bounds.height
  
  const edges = [
    { p1: { x: bounds.x, y: bounds.y }, p2: { x: nodeRight, y: bounds.y } },
    { p1: { x: nodeRight, y: bounds.y }, p2: { x: nodeRight, y: nodeBottom } },
    { p1: { x: nodeRight, y: nodeBottom }, p2: { x: bounds.x, y: nodeBottom } },
    { p1: { x: bounds.x, y: nodeBottom }, p2: { x: bounds.x, y: bounds.y } },
  ]

  for (const edge of edges) {
    if (segmentsIntersect(p1, p2, edge.p1, edge.p2)) {
      return true
    }
  }

  return false
}

/**
 * 检查两条线段是否相交
 */
function segmentsIntersect(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point
): boolean {
  const ccw = (a: Point, b: Point, c: Point) => {
    return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x)
  }
  return (
    ccw(p1, p3, p4) !== ccw(p2, p3, p4) &&
    ccw(p1, p2, p3) !== ccw(p1, p2, p4)
  )
}

/**
 * 检查路径是否可行（用于绕行路径）
 */
function isPathClear(
  path: Point[],
  obstaclesBounds: NodeBounds[],
  sourceBounds?: NodeBounds,
  targetBounds?: NodeBounds
): boolean {
  if (path.length < 2) return true

  // 检查与所有障碍物节点的碰撞
  for (const bounds of obstaclesBounds) {
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i]
      const p2 = path[i + 1]
      
      // 跳过起点和终点本身在节点内的情况
      if (pointInBounds(p1, bounds) || pointInBounds(p2, bounds)) {
        continue
      }
      
      if (lineIntersectsBounds(p1, p2, bounds)) {
        return false
      }
    }
  }

  // 检查源节点和目标节点（只检查中间路径段）
  if (sourceBounds && path.length > 1) {
    for (let i = 1; i < path.length - 1; i++) {
      if (!pointInBounds(path[i], sourceBounds) && 
          lineIntersectsBounds(path[i], path[i + 1], sourceBounds)) {
        return false
      }
    }
  }

  if (targetBounds && path.length > 1) {
    for (let i = 0; i < path.length - 2; i++) {
      if (!pointInBounds(path[i + 1], targetBounds) && 
          lineIntersectsBounds(path[i], path[i + 1], targetBounds)) {
        return false
      }
    }
  }

  return true
}

/**
 * 检查线段是否穿过节点的特定边界（排除指定边界）
 */
function checkLineCrossesNodeBounds(
  p1: Point,
  p2: Point,
  bounds: NodeBounds,
  excludeEdges: ('top' | 'right' | 'bottom' | 'left')[] = []
): boolean {
  const right = bounds.x + bounds.width
  const bottom = bounds.y + bounds.height

  if (!excludeEdges.includes('top') && 
      segmentsIntersect(p1, p2, { x: bounds.x, y: bounds.y }, { x: right, y: bounds.y })) {
    return true
  }
  if (!excludeEdges.includes('right') && 
      segmentsIntersect(p1, p2, { x: right, y: bounds.y }, { x: right, y: bottom })) {
    return true
  }
  if (!excludeEdges.includes('bottom') && 
      segmentsIntersect(p1, p2, { x: bounds.x, y: bottom }, { x: right, y: bottom })) {
    return true
  }
  if (!excludeEdges.includes('left') && 
      segmentsIntersect(p1, p2, { x: bounds.x, y: bounds.y }, { x: bounds.x, y: bottom })) {
    return true
  }

  return false
}

/**
 * 计算智能避开路径
 */
export function calculateSmartPath(
  source: Point,
  target: Point,
  nodes: Node[],
  sourceNodeId: string,
  targetNodeId: string
): Point[] {
  // 找到源节点和目标节点
  const sourceNode = nodes.find((n) => n.id === sourceNodeId)
  const targetNode = nodes.find((n) => n.id === targetNodeId)

  if (!sourceNode || !targetNode) {
    return [source, target]
  }

  const sourceBounds = getNodeBounds(sourceNode)
  const targetBounds = getNodeBounds(targetNode)

  // 障碍物节点
  const obstacles = nodes.filter(
    (node) => node.id !== sourceNodeId && node.id !== targetNodeId
  )
  const obstaclesBounds = obstacles.map((node) => getNodeBounds(node))

  const getHandleSide = (
    relativeX: number,
    relativeY: number,
    width: number,
    height: number
  ): 'left' | 'right' | 'top' | 'bottom' | 'center' => {
    const ratioX = relativeX / Math.max(width, 1)
    const ratioY = relativeY / Math.max(height, 1)

    if (ratioX <= 0.2) return 'left'
    if (ratioX >= 0.8) return 'right'
    if (ratioY <= 0.2) return 'top'
    if (ratioY >= 0.8) return 'bottom'
    return 'center'
  }

  // 1. 配置参数
  const GAP = 20 // 与节点的间隙

  // 2. 判断源点和目标点的相对位置
  const dx = target.x - source.x

  // 3. 确定延展方向和距离
  // 判断源点和目标点在各自节点的哪个位置
  const sourceRelativeX = source.x - sourceBounds.x
  const sourceRelativeY = source.y - sourceBounds.y
  const targetRelativeX = target.x - targetBounds.x
  const targetRelativeY = target.y - targetBounds.y
  
  // 判断连接点在节点的哪一侧
  const sourceSide = getHandleSide(
    sourceRelativeX,
    sourceRelativeY,
    sourceBounds.width,
    sourceBounds.height
  )
  const targetSide = getHandleSide(
    targetRelativeX,
    targetRelativeY,
    targetBounds.width,
    targetBounds.height
  )

  // 源点延展：根据连接点位置决定延展方向
  let extendSourceX = source.x
  
  if (sourceSide === 'left') {
    // 连接点在左侧，向左延展
    extendSourceX = sourceBounds.x - GAP
  } else if (sourceSide === 'right') {
    // 连接点在右侧，向右延展
    extendSourceX = sourceBounds.x + sourceBounds.width + GAP
  } else {
    // 连接点在中间，根据目标方向决定
    if (dx > 0) {
      // 目标在右侧，向右延展
      extendSourceX = sourceBounds.x + sourceBounds.width + GAP
    } else {
      // 目标在左侧，向左延展
      extendSourceX = sourceBounds.x - GAP
    }
  }

  // 目标点延展：根据连接点位置决定延展方向
  let extendTargetX = target.x
  
  if (targetSide === 'left') {
    // 连接点在左侧，向左延展
    extendTargetX = targetBounds.x - GAP
  } else if (targetSide === 'right') {
    // 连接点在右侧，向右延展
    extendTargetX = targetBounds.x + targetBounds.width + GAP
  } else {
    // 连接点在中间，根据源点方向决定
    if (dx > 0) {
      // 源在左侧，向左延展（进入节点）
      extendTargetX = targetBounds.x - GAP
    } else {
      // 源在右侧，向右延展（进入节点）
      extendTargetX = targetBounds.x + targetBounds.width + GAP
    }
  }

  // 4. 检查直接路径（优先检查）
  const directPath = [source, target]
  
  // 检查障碍物节点
  let directPathClear = true
  for (const bounds of obstaclesBounds) {
    if (pointInBounds(source, bounds) || pointInBounds(target, bounds)) {
      directPathClear = false
      break
    }
    
    // 快速排除不相交的情况
    const minX = Math.min(source.x, target.x)
    const maxX = Math.max(source.x, target.x)
    const minY = Math.min(source.y, target.y)
    const maxY = Math.max(source.y, target.y)
    
    if (maxX < bounds.x || minX > bounds.x + bounds.width ||
        maxY < bounds.y || minY > bounds.y + bounds.height) {
      continue
    }
    
    if (lineIntersectsBounds(source, target, bounds)) {
      directPathClear = false
      break
    }
  }
  
  // 检查源节点（排除起点所在的边界）
  if (directPathClear && sourceBounds) {
    const excludeEdges: ('top' | 'right' | 'bottom' | 'left')[] = []
    const sourceRight = sourceBounds.x + sourceBounds.width
    const sourceBottom = sourceBounds.y + sourceBounds.height
    
    if (source.x >= sourceRight - 1) excludeEdges.push('right')
    if (source.y >= sourceBottom - 1) excludeEdges.push('bottom')
    if (source.x <= sourceBounds.x + 1) excludeEdges.push('left')
    
    if (checkLineCrossesNodeBounds(source, target, sourceBounds, excludeEdges)) {
      directPathClear = false
    }
  }
  
  // 检查目标节点（排除终点所在的边界）
  if (directPathClear && targetBounds) {
    const excludeEdges: ('top' | 'right' | 'bottom' | 'left')[] = []
    const targetRight = targetBounds.x + targetBounds.width
    const targetBottom = targetBounds.y + targetBounds.height
    
    if (target.x <= targetBounds.x + 1) excludeEdges.push('left')
    if (target.y <= targetBounds.y + 1) excludeEdges.push('top')
    if (target.x >= targetRight - 1) excludeEdges.push('right')
    if (target.y >= targetBottom - 1) excludeEdges.push('bottom')
    
    if (checkLineCrossesNodeBounds(source, target, targetBounds, excludeEdges)) {
      directPathClear = false
    }
  }
  
  if (directPathClear) {
    return directPath
  }

  // 5. 判断连接点位置，决定绕行路径优先级（只有在直接路径被挡住时才执行）
  const sourceInBottomHalf = sourceRelativeY > sourceBounds.height / 2
  const targetInBottomHalf = targetRelativeY > targetBounds.height / 2
  
  // 如果两个连接点都在节点下半部分，优先尝试下方绕行
  const preferBottomPath = sourceInBottomHalf && targetInBottomHalf

  // 方案 B: 向下绕行
  const horizontalStart = Math.min(extendSourceX, extendTargetX)
  const horizontalEnd = Math.max(extendSourceX, extendTargetX)

  let bottomY = Math.max(
    sourceBounds.y + sourceBounds.height,
    targetBounds.y + targetBounds.height
  )

  const relevantNodes = [sourceBounds, targetBounds, ...obstaclesBounds]
  for (const bounds of relevantNodes) {
    const nodeStart = bounds.x
    const nodeEnd = bounds.x + bounds.width
    const overlap = Math.max(horizontalStart, nodeStart) <= Math.min(horizontalEnd, nodeEnd)
    if (overlap) {
      bottomY = Math.max(bottomY, bounds.y + bounds.height)
    }
  }

  bottomY += GAP

  const pathB: Point[] = [
    source,
    { x: extendSourceX, y: source.y },
    { x: extendSourceX, y: bottomY },
    { x: extendTargetX, y: bottomY },
    { x: extendTargetX, y: target.y },
    target
  ]

  // 如果优先下方路径，先尝试方案B
  if (preferBottomPath) {
    if (isPathClear(pathB, obstaclesBounds, sourceBounds, targetBounds)) {
      return pathB
    }
  }

  // 方案 A: source -> 水平到延展点 -> 垂直到目标高度 -> 水平到目标延展点 -> target
  const pathA: Point[] = [
    source,
    { x: extendSourceX, y: source.y },
    { x: extendSourceX, y: target.y },
    { x: extendTargetX, y: target.y },
    target
  ]

  if (isPathClear(pathA, obstaclesBounds, sourceBounds, targetBounds)) {
    return pathA
  }

  // 如果不优先下方路径，现在尝试方案B
  if (!preferBottomPath) {
    if (isPathClear(pathB, obstaclesBounds, sourceBounds, targetBounds)) {
      return pathB
    }
  }

  // 生成水平绕行路径的辅助函数
  const createHorizontalPath = (y: number): Point[] => [
    source,
    { x: extendSourceX, y: source.y },
    { x: extendSourceX, y },
    { x: extendTargetX, y },
    { x: extendTargetX, y: target.y },
    target
  ]

  // 方案 D: 逐步向下尝试
  const maxAttempts = 30
  const step = 10
  for (let i = 0; i < maxAttempts; i++) {
    const testPath = createHorizontalPath(bottomY + i * step)
    if (isPathClear(testPath, obstaclesBounds, sourceBounds, targetBounds)) {
      return testPath
    }
  }

  // 方案 C: 向上绕行（只有在不优先下方路径时才尝试）
  if (!preferBottomPath) {
    const topY = Math.min(sourceBounds.y, targetBounds.y) - GAP
    const topPath = createHorizontalPath(topY)
    
    if (isPathClear(topPath, obstaclesBounds, sourceBounds, targetBounds)) {
      return topPath
    }

    // 方案 E: 逐步向上尝试
    for (let i = 0; i < maxAttempts; i++) {
      const testPath = createHorizontalPath(topY - i * step)
      if (isPathClear(testPath, obstaclesBounds, sourceBounds, targetBounds)) {
        return testPath
      }
    }
  }

  // 如果都不可行，返回简化路径
  return [
    source,
    { x: extendSourceX, y: source.y },
    { x: extendTargetX, y: target.y },
    target
  ]
}

/**
 * 生成 SVG 路径字符串（使用直线连接）
 */
export function generatePathString(path: Point[]): string {
  if (path.length === 2) {
    return `M ${path[0].x} ${path[0].y} L ${path[1].x} ${path[1].y}`
  }

  let d = `M ${path[0].x} ${path[0].y}`
  
  for (let i = 1; i < path.length; i++) {
    d += ` L ${path[i].x} ${path[i].y}`
  }

  return d
}
