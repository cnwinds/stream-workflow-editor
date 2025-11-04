import React, { useState, useEffect } from 'react'
import { Input, Button, Modal, Space } from 'antd'
import { MoreOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import Editor from '@monaco-editor/react'
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
  const [items, setItems] = useState<Array<{ key: string; value: any }>>([])
  const [editorModalVisible, setEditorModalVisible] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [editorLanguage, setEditorLanguage] = useState<'json' | 'yaml' | 'text'>('json')

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

  return (
    <div className="config-editor">
      <div className="config-editor-items">
        {items.map((item, index) => (
          <div key={index} className="config-editor-item">
            <div className="config-editor-item-label">
              <Input
                placeholder="配置项名称"
                value={item.key}
                onChange={(e) => handleKeyChange(index, e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div className="config-editor-item-value">
              <Input
                placeholder="配置值"
                value={item.value}
                onChange={(e) => handleValueChange(index, e.target.value)}
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
                    title="打开编辑器"
                    style={{ padding: 0, height: 'auto', border: 'none', boxShadow: 'none' }}
                  />
                }
              />
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleRemoveItem(index)}
                title="删除此项"
              />
            </div>
          </div>
        ))}
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
              rows={15}
              placeholder="输入纯文本内容"
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          ) : (
            <Editor
              height="400px"
              language={editorLanguage}
              value={editingContent}
              onChange={(value) => setEditingContent(value || '')}
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

