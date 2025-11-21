import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Input, Button, Modal, Space, Select, AutoComplete } from 'antd'
import { MoreOutlined, PlusOutlined, DeleteOutlined, HolderOutlined } from '@ant-design/icons'
import Editor from '@monaco-editor/react'
import { useThemeStore } from '@/stores/themeStore'
import { FieldSchemaDef } from '@/types/node'
import './ConfigEditor.css'

const { TextArea } = Input
const { Option } = Select

interface ConfigFieldDefinition {
  fieldName: string
  type: string
  required: boolean
  description?: string
  default?: any
}

interface ConfigEditorProps {
  value?: Record<string, any>
  onChange?: (value: Record<string, any>) => void
  placeholder?: string
  configParams?: Record<string, FieldSchemaDef> // 配置字段定义
}

const ConfigEditor: React.FC<ConfigEditorProps> = ({
  value = {},
  onChange,
  configParams,
}) => {
  const { theme } = useThemeStore()
  const [items, setItems] = useState<Array<{ key: string; value: any; isRequired?: boolean; fieldDef?: ConfigFieldDefinition }>>([])
  const [editorModalVisible, setEditorModalVisible] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [editorLanguage, setEditorLanguage] = useState<'json' | 'yaml' | 'text'>('json')
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [dragDirection, setDragDirection] = useState<'up' | 'down' | null>(null)
  const configFieldsRef = useRef<{ required: ConfigFieldDefinition[]; optional: ConfigFieldDefinition[] }>({ required: [], optional: [] })
  
  // 根据主题确定Monaco Editor的主题
  const editorTheme = theme === 'dark' ? 'vs-dark' : 'vs'

  // 解析配置字段定义
  const configFields = useMemo(() => {
    if (!configParams) return { required: [], optional: [] }
    
    const required: ConfigFieldDefinition[] = []
    const optional: ConfigFieldDefinition[] = []
    
    Object.entries(configParams).forEach(([fieldName, fieldDef]) => {
      let field: ConfigFieldDefinition
      
      if (typeof fieldDef === 'string') {
        // 简单格式: "string"
        field = {
          fieldName,
          type: fieldDef,
          required: false,
        }
      } else {
        // 详细格式: {"type": "string", "required": true, ...}
        field = {
          fieldName,
          type: fieldDef.type || 'any',
          required: fieldDef.required || false,
          description: fieldDef.description,
          default: fieldDef.default,
        }
      }
      
      if (field.required) {
        required.push(field)
      } else {
        optional.push(field)
      }
    })
    
    return { required, optional }
  }, [configParams])

  // 当configFields变化时，检查并添加必填字段到value中
  useEffect(() => {
    const prevConfigFields = configFieldsRef.current
    configFieldsRef.current = configFields
    
    // 检查是否有新的必填字段需要添加
    const newValue: Record<string, any> = { ...value }
    let hasNewRequiredFields = false
    
    configFields.required.forEach((field) => {
      if (!(field.fieldName in newValue)) {
        hasNewRequiredFields = true
        // 尝试解析默认值
        if (field.default !== undefined) {
          newValue[field.fieldName] = field.default
        } else {
          newValue[field.fieldName] = ''
        }
      }
    })
    
    // 只有当configFields真正变化（新增了必填字段）时才更新value
    if (hasNewRequiredFields && prevConfigFields.required.length !== configFields.required.length) {
      onChange?.(newValue)
    }
  }, [configFields, onChange, value])

  // 将字典转换为数组格式，并确保必填字段存在
  useEffect(() => {
    const currentKeys = new Set(Object.keys(value || {}))
    const itemsArray: Array<{ key: string; value: any; isRequired?: boolean; fieldDef?: ConfigFieldDefinition }> = []
    
    // 首先添加必填字段（如果不存在则创建）
    configFields.required.forEach((field) => {
      if (currentKeys.has(field.fieldName)) {
        // 已存在，使用现有值
        const val = value![field.fieldName]
        itemsArray.push({
          key: field.fieldName,
          value: typeof val === 'string' ? val : JSON.stringify(val, null, 2),
          isRequired: true,
          fieldDef: field,
        })
      } else {
        // 不存在，创建新项（使用默认值或空值）
        const defaultValue = field.default !== undefined 
          ? (typeof field.default === 'string' ? field.default : JSON.stringify(field.default, null, 2))
          : ''
        itemsArray.push({
          key: field.fieldName,
          value: defaultValue,
          isRequired: true,
          fieldDef: field,
        })
      }
    })
    
    // 然后添加已存在的其他字段
    Object.entries(value || {}).forEach(([key, val]) => {
      // 跳过已经在必填字段中处理的
      if (!configFields.required.find(f => f.fieldName === key)) {
        const fieldDef = configFields.optional.find(f => f.fieldName === key) || 
                        configFields.required.find(f => f.fieldName === key)
        itemsArray.push({
      key,
      value: typeof val === 'string' ? val : JSON.stringify(val, null, 2),
          isRequired: false,
          fieldDef,
        })
      }
    })
    
    setItems(itemsArray)
  }, [value, configFields])

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

  const handleAddItem = (fieldName?: string) => {
    if (fieldName) {
      // 从下拉选择添加已定义的字段
      const fieldDef = configFields.optional.find(f => f.fieldName === fieldName)
      const defaultValue = fieldDef?.default !== undefined 
        ? (typeof fieldDef.default === 'string' ? fieldDef.default : JSON.stringify(fieldDef.default, null, 2))
        : ''
      setItems([...items, { key: fieldName, value: defaultValue, isRequired: false, fieldDef }])
    } else {
      // 添加自定义字段
      setItems([...items, { key: '', value: '', isRequired: false }])
    }
  }

  const handleRemoveItem = (index: number) => {
    const item = items[index]
    // 必填字段不能删除
    if (item.isRequired) {
      return
    }
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
      // 检查事件目标
      const target = e.target as HTMLElement
      
      // 优先检查是否在 Monaco Editor 中（Monaco Editor 使用特定的类名和结构）
      // 使用更全面的检测方式，包括包装器和所有可能的 Monaco 元素
      // 向上遍历 DOM 树检查所有父元素
      let currentCheck: HTMLElement | null = target
      let isInMonacoEditor = false
      
      while (currentCheck && currentCheck !== document.body) {
        const classList = currentCheck.classList
        const className = currentCheck.className
        
        // 检查类名中是否包含 monaco 相关字符串
        if (typeof className === 'string' && className.includes('monaco')) {
          isInMonacoEditor = true
          break
        }
        
        // 检查特定的类名
        if (
          classList?.contains('monaco-editor') ||
          classList?.contains('monaco-editor-textarea') ||
          classList?.contains('monaco-inputbox') ||
          classList?.contains('monaco-scrollable-element') ||
          classList?.contains('monaco-editor-wrapper') ||
          classList?.contains('monaco-editor-background')
        ) {
          isInMonacoEditor = true
          break
        }
        
        // 使用 closest 检查
        if (
          currentCheck.closest('.monaco-editor') !== null ||
          currentCheck.closest('.monaco-editor-wrapper') !== null
        ) {
          isInMonacoEditor = true
          break
        }
        
        currentCheck = currentCheck.parentElement
      }
      
      // 如果在 Monaco Editor 中，完全不拦截任何键盘事件（让编辑器正常处理所有输入，包括空格）
      // 这个检查要放在最前面，优先于其他检查
      if (isInMonacoEditor) {
        // 不调用 preventDefault 或 stopPropagation，让事件正常传播到编辑器
        return
      }
      
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

    // 使用普通模式（非 capture）添加事件监听器
    // 这样可以确保 Monaco Editor 先处理键盘事件
    // 只有当事件没有被编辑器处理时，才会到达这里
    document.addEventListener('keydown', handleKeyDown, false)
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, false)
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
              <HolderOutlined style={{ color: 'var(--theme-textTertiary, #8c8c8c)', cursor: 'move' }} />
            </div>
            <div 
              className="config-editor-item-content"
            >
              <div className="config-editor-item-label">
                {item.isRequired ? (
                  // 必填字段：显示为只读，显示字段定义信息
                  <Input
                    value={item.key}
                    disabled
                    style={{ width: '100%' }}
                    title={item.fieldDef?.description || ''}
                  />
                ) : item.fieldDef ? (
                  // 已定义的字段：显示为只读
                <Input
                    value={item.key}
                    disabled
                    style={{ width: '100%' }}
                    title={item.fieldDef?.description || ''}
                  />
                ) : (
                  // 自定义字段：使用AutoComplete，支持从已定义字段中选择或输入新字段名
                  <div
                    onDragStart={(e: React.DragEvent) => e.stopPropagation()}
                    onDragOver={(e: React.DragEvent) => e.stopPropagation()}
                  >
                    <AutoComplete
                  value={item.key}
                      onChange={(val) => handleKeyChange(index, val)}
                  style={{ width: '100%' }}
                      placeholder="配置项名称"
                      options={configFields.optional
                        .filter(f => !items.some(item => item.key === f.fieldName && item !== items[index]))
                        .map(f => ({
                          value: f.fieldName,
                          label: (
                            <div>
                              <div>{f.fieldName}</div>
                              {f.description && (
                                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>{f.description}</div>
                              )}
                            </div>
                          ),
                        }))
                      }
                      filterOption={(inputValue, option) =>
                        option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                      }
                    />
                  </div>
                )}
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
                {!item.isRequired && (
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
                )}
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
      {configParams && Object.keys(configParams).length > 0 ? (
        <Select
          placeholder="添加配置项"
          style={{ width: '100%', marginTop: 8 }}
          onSelect={(value) => {
            if (value === '__custom__') {
              handleAddItem()
            } else {
              handleAddItem(value)
            }
          }}
          dropdownMatchSelectWidth={false}
        >
          {configFields.optional
            .filter(f => !items.some(item => item.key === f.fieldName))
            .map(f => (
              <Option key={f.fieldName} value={f.fieldName}>
                <div>
                  <div>{f.fieldName}</div>
                  {f.description && (
                    <div style={{ fontSize: '12px', color: '#8c8c8c' }}>{f.description}</div>
                  )}
                </div>
              </Option>
            ))}
          <Option value="__custom__">+ 自定义字段</Option>
        </Select>
      ) : (
      <Button
        type="dashed"
        icon={<PlusOutlined />}
          onClick={() => handleAddItem()}
        block
        style={{ marginTop: 8 }}
      >
        添加配置项
      </Button>
      )}

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
            <div 
              className="monaco-editor-wrapper"
              onKeyDown={(e) => {
                // 在 Monaco Editor 包装器上阻止事件冒泡到 document 层
                // 这样 capture 模式的监听器就不会拦截编辑器的事件
                e.stopPropagation()
              }}
            >
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
                  acceptSuggestionOnCommitCharacter: true,
                  acceptSuggestionOnEnter: 'on',
                  tabSize: 2,
                  insertSpaces: true,
                  readOnly: false,
                }}
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default ConfigEditor

