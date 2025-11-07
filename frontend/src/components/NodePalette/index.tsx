import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Card, Input, Empty, message, Collapse } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { nodeApi } from '@/services/api'
import { NodeType, CategoryTreeNode } from '@/types/node'
import { useNodeInfoStore } from '@/stores/nodeInfoStore'
import { useThemeStore } from '@/stores/themeStore'
import './NodePalette.css'

const NodePalette: React.FC = () => {
  const { setNodeTypes, setCustomNodes } = useNodeInfoStore()
  const { getCurrentTheme } = useThemeStore()
  const [nodeTypes, setNodeTypesLocal] = useState<NodeType[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const [activeKeys, setActiveKeys] = useState<string[]>([])
  const searchInputRef = useRef<any>(null)
  const nodeItemsRef = useRef<HTMLDivElement[]>([])

  useEffect(() => {
    loadNodeTypes()
    
    // 监听节点创建成功事件，自动刷新节点列表
    const handleNodeCreated = () => {
      loadNodeTypes()
    }
    
    window.addEventListener('nodeCreated', handleNodeCreated)
    
    return () => {
      window.removeEventListener('nodeCreated', handleNodeCreated)
    }
  }, [])

  // 快捷键：Ctrl+K 或 Cmd+K 聚焦搜索框
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 检查是否按下了 Ctrl+K (Windows/Linux) 或 Cmd+K (Mac)
      const isModKey = event.ctrlKey || event.metaKey
      if (isModKey && event.key === 'k') {
        // 避免在输入框、文本区域或可编辑内容中触发
        const target = event.target as HTMLElement
        const isInInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
        
        // 检查是否在 Modal 内部
        let currentElement: HTMLElement | null = target
        let isInModal = false
        while (currentElement) {
          if (currentElement.classList?.contains('ant-modal-content') || 
              currentElement.closest('.ant-modal')) {
            isInModal = true
            break
          }
          currentElement = currentElement.parentElement
        }
        
        // 如果不在输入框或 Modal 中，聚焦搜索框
        if (!isInInput && !isInModal) {
          event.preventDefault()
          event.stopPropagation()
          // 延迟一下确保 ref 已设置
          setTimeout(() => {
            // Ant Design Input 组件的 ref 结构
            if (searchInputRef.current) {
              const inputElement = searchInputRef.current.input || searchInputRef.current
              if (inputElement && typeof inputElement.focus === 'function') {
                inputElement.focus()
                // 全选搜索框内的文字
                if (inputElement.select && typeof inputElement.select === 'function') {
                  inputElement.select()
                } else if (inputElement.setSelectionRange && typeof inputElement.setSelectionRange === 'function') {
                  const length = inputElement.value ? inputElement.value.length : 0
                  inputElement.setSelectionRange(0, length)
                }
              }
            }
          }, 0)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const loadNodeTypes = async () => {
    try {
      setLoading(true)
      // 尝试从后端获取节点类型
      try {
        const types = await nodeApi.getNodeTypes()
        setNodeTypesLocal(types)
        // 同时更新缓存
        setNodeTypes(types)
        
        // 加载自定义节点列表并更新缓存
        try {
          const customNodesResponse = await nodeApi.getCustomNodes()
          if (customNodesResponse?.nodes) {
            setCustomNodes(customNodesResponse.nodes)
          }
        } catch (error) {
          console.warn('加载自定义节点列表失败:', error)
        }
      } catch (error) {
        console.error('从后端加载节点类型失败，使用默认类型:', error)
        // 如果后端连接失败，使用默认节点类型
        const theme = getCurrentTheme()
        const defaultColor = theme.colors.primary
        const defaultTypes: NodeType[] = [
          {
            id: 'start',
            name: '起始节点',
            category: '基础',
            executionMode: 'sequential',
            color: defaultColor,
          },
          {
            id: 'http',
            name: 'HTTP 请求',
            category: '网络',
            executionMode: 'sequential',
            color: defaultColor,
          },
          {
            id: 'transform',
            name: '数据转换',
            category: '数据处理',
            executionMode: 'sequential',
            color: defaultColor,
          },
          {
            id: 'condition',
            name: '条件判断',
            category: '流程控制',
            executionMode: 'sequential',
            color: defaultColor,
          },
          {
            id: 'merge',
            name: '合并节点',
            category: '流程控制',
            executionMode: 'sequential',
            color: defaultColor,
          },
          {
            id: 'output',
            name: '输出节点',
            category: '基础',
            executionMode: 'sequential',
            color: defaultColor,
          },
        ]
        setNodeTypesLocal(defaultTypes)
        setNodeTypes(defaultTypes)
      }
    } catch (error) {
      console.error('加载节点类型失败:', error)
      message.error('加载节点类型失败，请检查后端连接')
    } finally {
      setLoading(false)
    }
  }

  const filteredNodes = useMemo(() => {
    if (!searchTerm) return nodeTypes
    return nodeTypes.filter((node) =>
      node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [nodeTypes, searchTerm])

  // 构建分类树
  const categoryTree = useMemo(() => {
    const tree: Record<string, CategoryTreeNode> = {}

    filteredNodes.forEach((node) => {
      const categoryParts = node.category.split('.')
      let current = tree

      categoryParts.forEach((part, index) => {
        if (!current[part]) {
          current[part] = {
            key: categoryParts.slice(0, index + 1).join('.'),
            title: part,
            children: {} as Record<string, CategoryTreeNode>,
            nodes: [],
          }
        }

        if (index === categoryParts.length - 1) {
          // 最后一层，添加节点
          if (!current[part].nodes) {
            current[part].nodes = []
          }
          current[part].nodes!.push(node)
        } else {
          // 中间层，继续遍历
          if (!current[part].children) {
            current[part].children = {} as Record<string, CategoryTreeNode>
          }
          current = current[part].children!
        }
      })
    })

    return tree
  }, [filteredNodes])

  // 获取所有可见的节点项（扁平化列表）
  const flatNodeList = useMemo(() => {
    const flattenNodes = (tree: Record<string, CategoryTreeNode>): NodeType[] => {
      const result: NodeType[] = []
      Object.values(tree).forEach((node) => {
        if (node.nodes && node.nodes.length > 0) {
          result.push(...node.nodes)
        }
        if (node.children && Object.keys(node.children).length > 0) {
          result.push(...flattenNodes(node.children))
        }
      })
      return result
    }
    return flattenNodes(categoryTree)
  }, [categoryTree])

  // 在画布中心创建节点
  const createNodeAtCenter = async (nodeType: NodeType) => {
    // 发送全局事件，让 WorkflowCanvas 处理节点创建
    const event = new CustomEvent('createNodeAtCenter', {
      detail: { nodeType },
    })
    window.dispatchEvent(event)
  }

  // 键盘导航处理
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const isInInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      
      // 如果焦点在搜索框，处理搜索框内的键盘事件
      // 检查是否是搜索框的 input 元素
      let isSearchInput = false
      if (isInInput && searchInputRef.current) {
        const inputElement = searchInputRef.current.input || searchInputRef.current
        // 检查目标元素是否是搜索框或其子元素
        isSearchInput = target === inputElement || 
                       (inputElement && inputElement.contains && inputElement.contains(target)) ||
                       target.closest('.node-palette-header') !== null
      }
      
      // 如果焦点在搜索框，处理搜索框内的键盘事件
      if (isInInput && isSearchInput) {
        if (event.key === 'Enter') {
          event.preventDefault()
          // 如果只有一个节点，直接创建
          if (flatNodeList.length === 1) {
            createNodeAtCenter(flatNodeList[0])
            setSearchTerm('') // 清空搜索框
          } else if (flatNodeList.length > 1) {
            // 如果有多个节点，选中第一个
            setSelectedIndex(0)
            // 滚动到第一个节点
            if (nodeItemsRef.current[0]) {
              nodeItemsRef.current[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            }
          }
          // 让搜索框失去焦点，这样后续的上下键可以在节点列表中导航
          if (searchInputRef.current) {
            const inputElement = searchInputRef.current.input || searchInputRef.current
            if (inputElement && typeof inputElement.blur === 'function') {
              inputElement.blur()
            }
          }
          return
        } else if (event.key === 'ArrowDown') {
          event.preventDefault()
          if (flatNodeList.length > 0) {
            // 在搜索框内：方向下键跳转到第一个节点
            setSelectedIndex(0)
            if (nodeItemsRef.current[0]) {
              nodeItemsRef.current[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            }
            // 让搜索框失去焦点，这样后续的上下键可以在节点列表中导航
            if (searchInputRef.current) {
              const inputElement = searchInputRef.current.input || searchInputRef.current
              if (inputElement && typeof inputElement.blur === 'function') {
                inputElement.blur()
              }
            }
          }
          return
        } else if (event.key === 'ArrowUp') {
          event.preventDefault()
          if (flatNodeList.length > 0) {
            // 在搜索框内：方向上键跳转到最后一个节点
            const lastIndex = flatNodeList.length - 1
            setSelectedIndex(lastIndex)
            if (nodeItemsRef.current[lastIndex]) {
              nodeItemsRef.current[lastIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            }
            // 让搜索框失去焦点，这样后续的上下键可以在节点列表中导航
            if (searchInputRef.current) {
              const inputElement = searchInputRef.current.input || searchInputRef.current
              if (inputElement && typeof inputElement.blur === 'function') {
                inputElement.blur()
              }
            }
          }
          return
        }
        // 其他按键不处理，让搜索框正常使用
        return
      }
      
      // 如果焦点在其他输入框，不处理导航
      if (isInInput) {
        return
      }

      // 检查是否在 Modal 内部
      let currentElement: HTMLElement | null = target
      let isInModal = false
      while (currentElement) {
        if (currentElement.classList?.contains('ant-modal-content') || 
            currentElement.closest('.ant-modal')) {
          isInModal = true
          break
        }
        currentElement = currentElement.parentElement
      }
      if (isInModal) return

      // 不在搜索框内时：方向键在节点列表中循环移动
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedIndex((prev) => {
          // 如果当前没有选中，从第一个开始
          if (prev < 0) {
            const firstIndex = 0
            if (nodeItemsRef.current[firstIndex]) {
              nodeItemsRef.current[firstIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            }
            return firstIndex
          }
          // 循环移动：到达最后一个后回到第一个
          const next = prev < flatNodeList.length - 1 ? prev + 1 : 0
          if (nodeItemsRef.current[next]) {
            nodeItemsRef.current[next].scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          }
          return next
        })
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedIndex((prev) => {
          // 如果当前没有选中，从最后一个开始
          if (prev < 0) {
            const lastIndex = flatNodeList.length - 1
            if (nodeItemsRef.current[lastIndex]) {
              nodeItemsRef.current[lastIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            }
            return lastIndex
          }
          // 循环移动：到达第一个后回到最后一个
          const next = prev > 0 ? prev - 1 : flatNodeList.length - 1
          if (nodeItemsRef.current[next]) {
            nodeItemsRef.current[next].scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          }
          return next
        })
      } else if (event.key === 'Enter' && selectedIndex >= 0 && selectedIndex < flatNodeList.length) {
        event.preventDefault()
        const selectedNode = flatNodeList[selectedIndex]
        createNodeAtCenter(selectedNode)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedIndex, flatNodeList, createNodeAtCenter])

  // 当搜索词或节点列表变化时，重置选中索引
  useEffect(() => {
    setSelectedIndex(-1)
    nodeItemsRef.current = []
  }, [searchTerm, categoryTree])

  // 当有搜索词时，强制展开所有分类；没有搜索词时，使用默认展开状态
  useEffect(() => {
    if (searchTerm) {
      // 有搜索词时，展开所有分类
      const allKeys: string[] = []
      const collectKeys = (tree: Record<string, CategoryTreeNode>) => {
        Object.values(tree).forEach((node) => {
          allKeys.push(node.key)
          if (node.children && Object.keys(node.children).length > 0) {
            collectKeys(node.children)
          }
        })
      }
      collectKeys(categoryTree)
      setActiveKeys(allKeys)
    } else {
      // 没有搜索词时，展开所有顶级分类
      setActiveKeys(Object.keys(categoryTree))
    }
  }, [searchTerm, categoryTree])

  // 递归构建树节点 items
  const buildCategoryTreeItems = (tree: Record<string, CategoryTreeNode>, level = 0): any[] => {
    const entries = Object.values(tree)

    if (entries.length === 0) {
      return []
    }

    return entries
      .filter((node) => {
        const hasChildren = node.children && Object.keys(node.children).length > 0
        const hasNodes = node.nodes && node.nodes.length > 0
        return hasChildren || hasNodes
      })
      .map((node) => {
        const hasChildren = node.children && Object.keys(node.children).length > 0
        const hasNodes = node.nodes && node.nodes.length > 0

        const title = (
          <span style={{ fontWeight: level === 0 ? 'bold' : 'normal' }}>
            {node.title}
            {hasNodes && ` (${node.nodes!.length})`}
          </span>
        )

        const childrenContent: React.ReactNode[] = []
        
        if (hasNodes) {
          childrenContent.push(
            <div key="nodes" className="node-category-items">
              {node.nodes!.map((nodeType) => {
                const globalIndex = flatNodeList.findIndex(n => n.id === nodeType.id)
                const isSelected = globalIndex === selectedIndex
                return (
                  <Card
                    key={nodeType.id}
                    ref={(el) => {
                      if (el && globalIndex >= 0) {
                        nodeItemsRef.current[globalIndex] = el as any
                      }
                    }}
                    className={`node-item ${isSelected ? 'node-item-selected' : ''}`}
                    draggable
                    onDragStart={(e) => handleNodeDragStart(e, nodeType)}
                    onClick={() => createNodeAtCenter(nodeType)}
                    hoverable
                    size="small"
                  >
                    <div className="node-item-content">
                      <div
                        className="node-item-icon"
                        style={{ backgroundColor: nodeType.color }}
                      />
                      <div className="node-item-info">
                        <div className="node-item-name">{nodeType.name}</div>
                        {nodeType.description && (
                          <div className="node-item-desc">{nodeType.description}</div>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )
        }
        
        if (hasChildren) {
          const nestedItems = buildCategoryTreeItems(node.children!, level + 1)
          if (nestedItems.length > 0) {
            // 嵌套的 Collapse 也使用 items API
            childrenContent.push(
              <Collapse key="children" ghost items={nestedItems} />
            )
          }
        }

        return {
          key: node.key,
          label: title,
          children: childrenContent.length > 0 ? <>{childrenContent}</> : undefined,
        }
      })
  }

  const handleNodeDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeType))
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="node-palette">
      <div className="node-palette-header">
        <Input
          ref={searchInputRef}
          placeholder="搜索节点... (Ctrl+K)"
          prefix={<SearchOutlined />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          allowClear
        />
      </div>
      <div className="node-palette-content">
        {loading ? (
          <Empty description="加载中..." />
        ) : Object.keys(categoryTree).length === 0 ? (
          <Empty description="未找到节点" />
        ) : (
          <Collapse 
            activeKey={activeKeys}
            onChange={(keys) => {
              // 如果有搜索词，不允许折叠（强制展开所有）
              if (searchTerm) {
                return
              }
              // 没有搜索词时，允许用户手动折叠/展开
              setActiveKeys(keys as string[])
            }}
            items={buildCategoryTreeItems(categoryTree)}
          />
        )}
      </div>
    </div>
  )
}

export default NodePalette
