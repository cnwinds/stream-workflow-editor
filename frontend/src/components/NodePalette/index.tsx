import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Card, Input, Empty, message, Collapse } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { nodeApi } from '@/services/api'
import { NodeType, CategoryTreeNode } from '@/types/node'
import { useNodeInfoStore } from '@/stores/nodeInfoStore'
import './NodePalette.css'

const NodePalette: React.FC = () => {
  const { setNodeTypes, setCustomNodes } = useNodeInfoStore()
  const [nodeTypes, setNodeTypesLocal] = useState<NodeType[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const searchInputRef = useRef<any>(null)

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
        const defaultTypes: NodeType[] = [
          {
            id: 'start',
            name: '起始节点',
            category: '基础',
            executionMode: 'sequential',
            color: '#1890ff',
          },
          {
            id: 'http',
            name: 'HTTP 请求',
            category: '网络',
            executionMode: 'sequential',
            color: '#1890ff',
          },
          {
            id: 'transform',
            name: '数据转换',
            category: '数据处理',
            executionMode: 'sequential',
            color: '#1890ff',
          },
          {
            id: 'condition',
            name: '条件判断',
            category: '流程控制',
            executionMode: 'sequential',
            color: '#1890ff',
          },
          {
            id: 'merge',
            name: '合并节点',
            category: '流程控制',
            executionMode: 'sequential',
            color: '#1890ff',
          },
          {
            id: 'output',
            name: '输出节点',
            category: '基础',
            executionMode: 'sequential',
            color: '#1890ff',
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
              {node.nodes!.map((nodeType) => (
                <Card
                  key={nodeType.id}
                  className="node-item"
                  draggable
                  onDragStart={(e) => handleNodeDragStart(e, nodeType)}
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
              ))}
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
            defaultActiveKey={Object.keys(categoryTree)}
            items={buildCategoryTreeItems(categoryTree)}
          />
        )}
      </div>
    </div>
  )
}

export default NodePalette
