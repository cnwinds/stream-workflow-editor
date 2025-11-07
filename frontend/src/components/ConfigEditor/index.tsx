import React, { useState, useEffect } from 'react'
import { Input, Button, Modal, Space } from 'antd'
import { MoreOutlined, PlusOutlined, DeleteOutlined, HolderOutlined } from '@ant-design/icons'
import Editor from '@monaco-editor/react'
import { useThemeStore } from '@/stores/themeStore'
import './ConfigEditor.css'

const { TextArea } = Input

interface ConfigEditorProps {
  value?: Record<string, any>
  onChange?: (value: Record<string, any>) => void
  placeholder?: string
}

const ConfigEditor: React.FC<ConfigEditorProps> = ({
  value = {},
  onChange,
}) => {
  const { theme } = useThemeStore()
  const [items, setItems] = useState<Array<{ key: string; value: any }>>([])
  const [editorModalVisible, setEditorModalVisible] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [editorLanguage, setEditorLanguage] = useState<'json' | 'yaml' | 'text'>('json')
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [dragDirection, setDragDirection] = useState<'up' | 'down' | null>(null)
  
  // 根据主题确定Monaco Editor的主题
  const editorTheme = theme === 'dark' ? 'vs-dark' : 'vs'

  // 将字典转换为数组格式
  useEffect(() => {
    const itemsArray = Object.entries(value || {}).map(([key, val]) => ({
      key,
      value: typeof val === 'string' ? val : JSON.stringify(val, null, 2),
    }))
    setItems(itemsArray)
  }, [value])

  // 将数组格式转换为字典
  const updateConfig = (newItems: Array<{ key: string; value: any }>) => {
    const config: Record<string, any> = {}
    newItems.forEach((item) => {
      if (item.key.trim()) {
        // 尝试解析 JSON，如果失败则作为字符串
        try {
          config[item.key] = JSON.parse(item.value)
        } catch {
          config[item.key] = item.value
        }
      }
    })
    onChange?.(config)
  }

  const handleKeyChange = (index: number, newKey: string) => {
    const newItems = [...items]
    newItems[index].key = newKey
    setItems(newItems)
    updateConfig(newItems)
  }

  const handleValueChange = (index: number, newValue: string) => {
    const newItems = [...items]
    newItems[index].value = newValue
    setItems(newItems)
    updateConfig(newItems)
  }

  const handleAddItem = () => {
    setItems([...items, { key: '', value: '' }])
  }

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index)
    setItems(newItems)
    updateConfig(newItems)
  }

  // 拖拽排序处理函数
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.dropEffect = 'move'
    // 设置拖拽图像为透明，使用 CSS 样式显示拖拽状态
    const img = new Image()
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    e.dataTransfer.setDragImage(img, 0, 0)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index)
      // 判断拖拽方向：向下拖动时，插入线在下方；向上拖动时，插入线在上方
      if (draggedIndex < index) {
        setDragDirection('down') // 向下拖动，插入线在下方
      } else {
        setDragDirection('up') // 向上拖动，插入线在上方
      }
    }
  }

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index)
      // 判断拖拽方向
      if (draggedIndex < index) {
        setDragDirection('down') // 向下拖动，插入线在下方
      } else {
        setDragDirection('up') // 向上拖动，插入线在上方
      }
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // 只有当真正离开整个元素时才清除 drag-over 状态
    const target = e.currentTarget as HTMLElement
    const relatedTarget = e.relatedTarget as HTMLElement
    // 检查是否真的离开了元素（不是进入子元素）
    if (!target.contains(relatedTarget)) {
      setDragOverIndex(null)
      setDragDirection(null)
    }
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      setDragDirection(null)
      return
    }

    // 重新排序 items
    const newItems = [...items]
    const draggedItem = newItems[draggedIndex]
    newItems.splice(draggedIndex, 1)
    newItems.splice(dropIndex, 0, draggedItem)
    
    setItems(newItems)
    updateConfig(newItems)
    setDraggedIndex(null)
    setDragOverIndex(null)
    setDragDirection(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
    setDragDirection(null)
  }

  const handleOpenEditor = (index: number) => {
    const item = items[index]
    setEditingIndex(index)
    setEditingContent(item.value)
    // 尝试判断内容类型
    // 如果内容看起来像 JSON，使用 JSON；否则默认使用 Text
    try {
      const parsed = JSON.parse(item.value)
      // 如果解析成功且是对象或数组，使用 JSON
      if (typeof parsed === 'object') {
        setEditorLanguage('json')
      } else {
        setEditorLanguage('text')
      }
    } catch {
      // 如果解析失败，检查是否包含 YAML 特征（如 : 和 - ）
      const trimmed = item.value.trim()
      if (trimmed.includes(':') || trimmed.startsWith('-') || trimmed.includes('---')) {
        setEditorLanguage('yaml')
      } else {
        setEditorLanguage('text')
      }
    }
    setEditorModalVisible(true)
  }

  const handleSaveEditor = () => {
    if (editingIndex === null) return
    
    const newItems = [...items]
    if (editingIndex >= 0 && editingIndex < newItems.length) {
      newItems[editingIndex].value = editingContent
      setItems(newItems)
      updateConfig(newItems)
    }
    setEditorModalVisible(false)
    setEditingIndex(null)
    setEditingContent('')
  }

  const handleCancelEditor = () => {
    setEditorModalVisible(false)
    setEditingIndex(null)
    setEditingContent('')
  }

  // 当 Modal 打开时，阻止 Del 键事件冒泡，并支持 Ctrl+Enter 保存
  useEffect(() => {
    if (!editorModalVisible) {
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // 检查事件目标是否在 Modal 内部
      const target = e.target as HTMLElement
      
      // 检查是否在输入框、文本区域或可编辑内容中
      const isInInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      
      // 检查是否在 Modal 内部（通过查找最近的 modal-content 父元素）
      let currentElement: HTMLElement | null = target
      let isInModal = false
      while (currentElement) {
        if (currentElement.classList?.contains('ant-modal-content') || 
            currentElement.classList?.contains('config-editor-modal-content')) {
          isInModal = true
          break
        }
        currentElement = currentElement.parentElement
      }
      
      // 如果不在 Modal 内，不处理
      if (!isInModal) {
        return
      }

      // 如果是在输入框、文本区域或可编辑内容中，阻止事件冒泡到父组件
      if (isInInput) {
        // 当按下 Del 或 Backspace 键时，阻止事件冒泡
        // 这样就不会触发父组件的删除节点操作
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.stopPropagation()
          // 不阻止默认行为，让编辑器正常处理删除操作
          return
        }
      }

      // Ctrl+Enter 或 Cmd+Enter (Mac) 保存
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        e.stopPropagation()
        // 直接调用保存逻辑，确保使用最新的状态
        if (editingIndex !== null) {
          const newItems = [...items]
          if (editingIndex >= 0 && editingIndex < newItems.length) {
            newItems[editingIndex].value = editingContent
            setItems(newItems)
            updateConfig(newItems)
          }
          setEditorModalVisible(false)
          setEditingIndex(null)
          setEditingContent('')
        }
        return
      }
    }

    // 使用 capture 模式捕获事件，在父组件之前处理
    document.addEventListener('keydown', handleKeyDown, true)
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [editorModalVisible, editingIndex, editingContent, items, updateConfig])

  return (
    <div className="config-editor">
      <div className="config-editor-items">
        {items.map((item, index) => {
          // 判断是否在当前 item 的上方或下方显示插入线
          const showInsertLineAbove = dragOverIndex === index && dragDirection === 'up'
          const showInsertLineBelow = dragOverIndex === index && dragDirection === 'down'
          
          return (
          <React.Fragment key={index}>
            {/* 向上拖动时，在当前 item 上方显示插入线 */}
            {showInsertLineAbove && (
              <div className="config-editor-insert-line"></div>
            )}
            <div 
              className={`config-editor-item ${draggedIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleDragOver(e, index)
              }}
              onDragEnter={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleDragEnter(e, index)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleDragLeave(e)
              }}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleDrop(e, index)
              }}
            >
            <div 
              className="config-editor-item-drag-handle" 
              title="拖动排序"
              draggable
              onDragStart={(e) => {
                e.stopPropagation()
                handleDragStart(e, index)
              }}
              onDragEnd={handleDragEnd}
            >
              <HolderOutlined style={{ color: '#999', cursor: 'move' }} />
            </div>
            <div 
              className="config-editor-item-content"
            >
              <div className="config-editor-item-label">
                <Input
                  placeholder="配置项名称"
                  value={item.key}
                  onChange={(e) => handleKeyChange(index, e.target.value)}
                  onDragStart={(e) => e.stopPropagation()}
                  onDragOver={(e) => e.stopPropagation()}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="config-editor-item-value">
                <Input
                  placeholder="配置值"
                  value={item.value}
                  onChange={(e) => handleValueChange(index, e.target.value)}
                  onDragStart={(e) => e.stopPropagation()}
                  onDragOver={(e) => e.stopPropagation()}
                  style={{ flex: 1 }}
                  suffix={
                    <Button
                      type="text"
                      size="small"
                      icon={<MoreOutlined />}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenEditor(index)
                      }}
                      onDragStart={(e) => e.stopPropagation()}
                      onDragOver={(e) => e.stopPropagation()}
                      title="打开编辑器"
                      style={{ padding: 0, height: 'auto', border: 'none', boxShadow: 'none' }}
                    />
                  }
                />
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveItem(index)
                  }}
                  onDragStart={(e) => e.stopPropagation()}
                  onDragOver={(e) => e.stopPropagation()}
                  title="删除此项"
                />
              </div>
            </div>
          </div>
          {/* 向下拖动时，在当前 item 下方显示插入线 */}
          {showInsertLineBelow && (
            <div className="config-editor-insert-line"></div>
          )}
          </React.Fragment>
          )
        })}
      </div>
      <Button
        type="dashed"
        icon={<PlusOutlined />}
        onClick={handleAddItem}
        block
        style={{ marginTop: 8 }}
      >
        添加配置项
      </Button>

      <Modal
        title={`编辑配置${editingIndex !== null && items[editingIndex] ? `: ${items[editingIndex].key || '未命名'}` : ''}`}
        open={editorModalVisible}
        onOk={handleSaveEditor}
        onCancel={handleCancelEditor}
        width={800}
        okText="保存"
        cancelText="取消"
        keyboard={true}
      >
        <div style={{ marginBottom: 16 }}>
          <Space>
            <span>格式：</span>
            <Button
              type={editorLanguage === 'json' ? 'primary' : 'default'}
              size="small"
              onClick={() => setEditorLanguage('json')}
            >
              JSON
            </Button>
            <Button
              type={editorLanguage === 'yaml' ? 'primary' : 'default'}
              size="small"
              onClick={() => setEditorLanguage('yaml')}
            >
              YAML
            </Button>
            <Button
              type={editorLanguage === 'text' ? 'primary' : 'default'}
              size="small"
              onClick={() => setEditorLanguage('text')}
            >
              Text
            </Button>
          </Space>
        </div>
        <div className="config-editor-modal-content">
          {editorLanguage === 'text' ? (
            <TextArea
              value={editingContent}
              onChange={(e) => setEditingContent(e.target.value)}
              rows={30}
              placeholder="输入纯文本内容"
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          ) : (
            <Editor
              height="600px"
              language={editorLanguage}
              value={editingContent}
              onChange={(value) => setEditingContent(value || '')}
              theme={editorTheme}
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                wordWrap: 'on',
                automaticLayout: true,
              }}
            />
          )}
        </div>
      </Modal>
    </div>
  )
}

export default ConfigEditor

