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
  const [customInputMode, setCustomInputMode] = useState<Set<number>>(new Set())
  const configFieldsRef = useRef<{ required: ConfigFieldDefinition[]; optional: ConfigFieldDefinition[] }>({ required: [], optional: [] })
  const prevConfigParamsRef = useRef<Record<string, FieldSchemaDef> | undefined>(undefined)
  
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
    
    // 如果 configParams 不存在，不添加任何必填字段
    if (!configParams) {
      return
    }
    
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
    // 并且只有在必填字段数量增加时才更新（避免在字段减少时错误更新）
    if (hasNewRequiredFields && prevConfigFields.required.length < configFields.required.length) {
      onChange?.(newValue)
    }
  }, [configFields, onChange, value, configParams])

  // 将字典转换为数组格式，并确保必填字段存在
  useEffect(() => {
    const currentKeys = new Set(Object.keys(value || {}))
    const itemsArray: Array<{ key: string; value: any; isRequired?: boolean; fieldDef?: ConfigFieldDefinition }> = []
    
    // 获取所有有效的字段名（必填和可选）
    const validFieldNames = new Set([
      ...configFields.required.map(f => f.fieldName),
      ...configFields.optional.map(f => f.fieldName)
    ])
    
    // 首先添加必填字段
    configFields.required.forEach((field) => {
      if (currentKeys.has(field.fieldName)) {
        const val = value![field.fieldName]
        itemsArray.push({
          key: field.fieldName,
          value: typeof val === 'string' ? val : JSON.stringify(val, null, 2),
          isRequired: true,
          fieldDef: field,
        })
      } else {
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
    
    // 然后添加已存在的其他字段（只添加有效的字段，过滤掉不属于当前节点的字段）
    Object.entries(value || {}).forEach(([key, val]) => {
      // 跳过必填字段（已经在上面处理了）
      if (configFields.required.find(f => f.fieldName === key)) {
        return
      }
      
      // 如果 configParams 存在，只保留在有效字段列表中的字段
      if (configParams) {
        if (validFieldNames.has(key)) {
          const fieldDef = configFields.optional.find(f => f.fieldName === key) || 
                          configFields.required.find(f => f.fieldName === key)
          itemsArray.push({
            key,
            value: typeof val === 'string' ? val : JSON.stringify(val, null, 2),
            isRequired: false,
            fieldDef,
          })
        }
      } else {
        // 没有 configParams 时，保留所有非必填字段（自定义字段）
        // 注意：这里不保留必填字段，因为当前节点没有必填字段定义
        itemsArray.push({
          key,
          value: typeof val === 'string' ? val : JSON.stringify(val, null, 2),
          isRequired: false,
          fieldDef: undefined,
        })
      }
    })
    
    // 保留当前items中正在编辑的自定义字段（只保留不在必填字段中的）
    items.forEach((item) => {
      if (item.isRequired) return
      
      const existingIndex = itemsArray.findIndex(i => i.key === item.key)
      
      if (existingIndex === -1) {
        itemsArray.push({
          key: item.key || '',
          value: item.value || '',
          isRequired: false,
          fieldDef: item.fieldDef,
        })
      } else if (item.value !== undefined && item.value !== null) {
        itemsArray[existingIndex].value = item.value
      }
    })
    
    // 清理掉不属于当前节点的字段
    // 如果 configParams 存在，只保留在有效字段列表中的字段
    // 如果 configParams 不存在，清理掉所有必填字段（因为当前节点没有必填字段定义）
    const configParamsChanged = prevConfigParamsRef.current !== configParams
    prevConfigParamsRef.current = configParams
    
    const cleanedItems = itemsArray.filter(item => {
      // 保留空的自定义字段（正在编辑中）
      if (!item.key) return true
      
      if (configParams) {
        // 有 configParams 时，保留必填字段和有效字段
        if (item.isRequired) return true
        if (validFieldNames.has(item.key)) return true
        return false
      } else {
        // 没有 configParams 时，不保留必填字段（因为当前节点没有必填字段定义）
        if (item.isRequired) return false
        // 保留所有非必填字段（自定义字段）
        return true
      }
    })
    
    // 只在 configParams 变化时才检查是否需要清理字段
    if (configParamsChanged) {
      // 检查是否有字段被过滤掉
      const removedKeys = itemsArray
        .filter(item => !cleanedItems.includes(item))
        .map(item => item.key)
        .filter(key => key && key.trim())
      
      // 如果清理后字段有变化，更新 value
      if (removedKeys.length > 0) {
        const cleanedConfig: Record<string, any> = {}
        cleanedItems.forEach((item) => {
          if (item.key && item.key.trim()) {
            try {
              cleanedConfig[item.key] = JSON.parse(item.value)
            } catch {
              cleanedConfig[item.key] = item.value !== undefined && item.value !== null ? item.value : ''
            }
          }
        })
        // 使用 setTimeout 避免在 useEffect 中直接调用 onChange 导致无限循环
        setTimeout(() => {
          onChange?.(cleanedConfig)
        }, 0)
        setItems(cleanedItems)
        return
      }
    }
    
    setItems(itemsArray)
  }, [value, configFields, configParams, onChange])

  // 将数组格式转换为字典
  const updateConfig = (newItems: Array<{ key: string; value: any }>) => {
    const config: Record<string, any> = {}
    newItems.forEach((item) => {
      if (item.key && item.key.trim()) {
        // 尝试解析 JSON，如果失败则作为字符串
        // 即使value是空字符串，也要保存key
        try {
          config[item.key] = JSON.parse(item.value)
        } catch {
          config[item.key] = item.value !== undefined && item.value !== null ? item.value : ''
        }
      }
    })
    onChange?.(config)
  }

  const handleKeyChange = (index: number, newKey: string) => {
    const newItems = [...items]
    newItems[index].key = newKey
    setItems(newItems)
    if (!newKey) {
      setCustomInputMode(prev => {
        const next = new Set(prev)
        next.delete(index)
        return next
      })
    }
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
      const fieldDef = configFields.optional.find(f => f.fieldName === fieldName)
      const defaultValue = fieldDef?.default !== undefined 
        ? (typeof fieldDef.default === 'string' ? fieldDef.default : JSON.stringify(fieldDef.default, null, 2))
        : ''
      const newItems = [...items, { key: fieldName, value: defaultValue, isRequired: false, fieldDef }]
      setItems(newItems)
      updateConfig(newItems)
    } else {
      setItems([...items, { key: '', value: '', isRequired: false }])
    }
  }

  const handleRemoveItem = (index: number) => {
    const item = items[index]
    if (item.isRequired) {
      return
    }
    const newItems = items.filter((_, i) => i !== index)
    setItems(newItems)
    updateConfig(newItems)
    setCustomInputMode(prev => {
      const next = new Set<number>()
      prev.forEach(idx => {
        if (idx < index) {
          next.add(idx)
        } else if (idx > index) {
          next.add(idx - 1)
        }
      })
      return next
    })
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

  useEffect(() => {
    if (!editorModalVisible) {
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      
      let currentCheck: HTMLElement | null = target
      let isInMonacoEditor = false
      
      while (currentCheck && currentCheck !== document.body) {
        const classList = currentCheck.classList
        const className = currentCheck.className
        
        if (typeof className === 'string' && className.includes('monaco')) {
          isInMonacoEditor = true
          break
        }
        
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
        
        if (
          currentCheck.closest('.monaco-editor') !== null ||
          currentCheck.closest('.monaco-editor-wrapper') !== null
        ) {
          isInMonacoEditor = true
          break
        }
        
        currentCheck = currentCheck.parentElement
      }
      
      if (isInMonacoEditor) {
        return
      }
      
      const isInInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      
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
      
      if (!isInModal) {
        return
      }

      if (isInInput) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.stopPropagation()
          return
        }
      }

      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        e.stopPropagation()
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

    document.addEventListener('keydown', handleKeyDown, false)
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, false)
    }
  }, [editorModalVisible, editingIndex, editingContent, items, updateConfig])

  return (
    <div className="config-editor">
      <div className="config-editor-items">
        {items.map((item, index) => {
          const showInsertLineAbove = dragOverIndex === index && dragDirection === 'up'
          const showInsertLineBelow = dragOverIndex === index && dragDirection === 'down'
          
          return (
          <React.Fragment key={index}>
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
                  // 自定义字段：优先使用Select下拉选择模板中的key，也支持输入自定义key
                  <div
                    onDragStart={(e: React.DragEvent) => e.stopPropagation()}
                    onDragOver={(e: React.DragEvent) => e.stopPropagation()}
                  >
                    {(() => {
                      // 获取所有可选的模板字段
                      const allOptionalFields = configFields.optional
                      // 获取未使用的模板字段
                      const availableTemplateFields = allOptionalFields.filter(
                        f => !items.some(item => item.key === f.fieldName && item !== items[index])
                      )
                      // 检查当前字段是否已被使用（用于标记）
                      const isFieldUsed = (fieldName: string) => 
                        items.some(item => item.key === fieldName && item !== items[index])
                      
                      // 如果key为空且存在配置模板字段，且不在自定义输入模式，优先显示Select下拉选择器
                      if (!item.key && allOptionalFields.length > 0 && !customInputMode.has(index)) {
                        return (
                          <Select
                            value={item.key || undefined}
                            onChange={(val) => {
                              if (val === '__custom__') {
                                // 选择"自定义"后，切换到自定义输入模式
                                setCustomInputMode(prev => new Set(prev).add(index))
                              } else {
                                handleKeyChange(index, val)
                                // 选择模板字段后，退出自定义输入模式
                                setCustomInputMode(prev => {
                                  const next = new Set(prev)
                                  next.delete(index)
                                  return next
                                })
                              }
                            }}
                            style={{ width: '100%' }}
                            placeholder="选择配置项"
                            showSearch
                            allowClear
                            filterOption={(inputValue, option) => {
                              if (option?.value === '__custom__') return true
                              const label = option?.label
                              if (typeof label === 'string') {
                                return label.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                              }
                              if (label && typeof label === 'object' && 'props' in label) {
                                const text = label.props?.children?.[0]?.props?.children || ''
                                return text.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                              }
                              return false
                            }}
                            dropdownMatchSelectWidth={false}
                          >
                            {allOptionalFields.map(f => {
                              const used = isFieldUsed(f.fieldName)
                              return (
                                <Option 
                                  key={f.fieldName} 
                                  value={f.fieldName}
                                  disabled={false}
                                >
                                  <div>
                                    <div style={{ color: 'var(--theme-text, #262626)' }}>
                                      {f.fieldName}
                                      {used && (
                                        <span style={{ marginLeft: 8, fontSize: '12px', color: 'var(--theme-textTertiary, #8c8c8c)' }}>
                                          (已使用)
                                        </span>
                                      )}
                                    </div>
                                    {f.description && (
                                      <div style={{ fontSize: '12px', color: 'var(--theme-textSecondary, #595959)' }}>{f.description}</div>
                                    )}
                                  </div>
                                </Option>
                              )
                            })}
                            <Option value="__custom__">+ 自定义字段</Option>
                          </Select>
                        )
                      }
                      
                      // 否则使用AutoComplete，支持从模板中选择或输入自定义key
                      return (
                        <AutoComplete
                          value={item.key}
                          onChange={(val) => {
                            handleKeyChange(index, val)
                            // 当输入了值后，如果值在模板中，退出自定义输入模式
                            if (val && allOptionalFields.some(f => f.fieldName === val)) {
                              setCustomInputMode(prev => {
                                const next = new Set(prev)
                                next.delete(index)
                                return next
                              })
                            }
                          }}
                          style={{ width: '100%' }}
                          placeholder={customInputMode.has(index) ? "输入自定义配置项名称" : "配置项名称（可从模板中选择）"}
                          options={availableTemplateFields.map(f => ({
                            value: f.fieldName,
                            label: (
                              <div>
                                <div style={{ color: 'var(--theme-text, #262626)' }}>{f.fieldName}</div>
                                {f.description && (
                                  <div style={{ fontSize: '12px', color: 'var(--theme-textSecondary, #595959)' }}>{f.description}</div>
                                )}
                              </div>
                            ),
                          }))}
                          filterOption={(inputValue, option) =>
                            option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                          }
                        />
                      )
                    })()}
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
                  <div style={{ color: 'var(--theme-text, #262626)' }}>{f.fieldName}</div>
                  {f.description && (
                    <div style={{ fontSize: '12px', color: 'var(--theme-textSecondary, #595959)' }}>{f.description}</div>
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

