import React, { useState, useEffect } from 'react'
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Space,
  message,
  Tabs,
  Table,
  Switch,
  Collapse,
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import Editor from '@monaco-editor/react'
import { ParameterSchema, CreateNodeRequest } from '@/types/node'
import { nodeApi } from '@/services/api'
import { nodeGenerator } from '@/services/nodeGenerator'
import { useWorkflowStore } from '@/stores/workflowStore'
import { useThemeStore } from '@/stores/themeStore'
import './NodeCreator.css'

const { TextArea } = Input
const { Option } = Select

interface InputOutputItem {
  key: string
  name: string
  isStreaming: boolean
  schema: Record<string, string> // 字段名 -> 类型
}

interface NodeCreatorModalProps {
  visible: boolean
  onCancel: () => void
  onSuccess: () => void
  editingNodeId?: string
  readOnly?: boolean // 只读模式，用于查看内置节点
  viewingNodeId?: string // 查看的节点ID（内置节点）
}

const NodeCreatorModal: React.FC<NodeCreatorModalProps> = ({
  visible,
  onCancel,
  onSuccess,
  editingNodeId,
  readOnly = false,
  viewingNodeId,
}) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')
  const [inputs, setInputs] = useState<InputOutputItem[]>([])
  const [outputs, setOutputs] = useState<InputOutputItem[]>([])
  const [pythonCode, setPythonCode] = useState('')
  const [originalPythonCode, setOriginalPythonCode] = useState('') // 保存加载时的原始代码
  const [showCodeEditor, setShowCodeEditor] = useState(false)
  const [codeManuallyModified, setCodeManuallyModified] = useState(false) // 标记代码是否被手动修改
  const [originalData, setOriginalData] = useState<{
    name: string
    description: string
    category: string
    executionMode: string
    color: string
    configSchema: Record<string, any>
    inputs: Record<string, any>
    outputs: Record<string, any>
  } | null>(null)
  const { updateNodeTypeInstances } = useWorkflowStore()
  const { theme } = useThemeStore()
  
  // 根据主题确定Monaco Editor的主题
  const editorTheme = theme === 'dark' ? 'vs-dark' : 'vs'

  // 加载编辑节点的数据或查看内置节点数据
  useEffect(() => {
    if (!visible) {
      return
    }
    
    // 使用 requestAnimationFrame 确保 Form 组件已经挂载
    const rafId = requestAnimationFrame(() => {
      if (editingNodeId) {
        loadNodeData(editingNodeId)
      } else if (viewingNodeId && readOnly) {
        loadBuiltinNodeData(viewingNodeId)
      } else {
        // 重置表单 - 延迟执行确保 Form 已挂载
        requestAnimationFrame(() => {
          try {
            form.resetFields()
          } catch (e) {
            // Form 可能还未挂载，忽略错误
          }
        })
        setInputs([])
        setOutputs([])
        setPythonCode('')
        setOriginalPythonCode('')
        setCodeManuallyModified(false)
        setShowCodeEditor(false)
        setActiveTab('basic')
        setOriginalData(null)
      }
    })
    
    return () => cancelAnimationFrame(rafId)
  }, [visible, editingNodeId, viewingNodeId, readOnly, form])

  const loadNodeData = async (nodeId: string) => {
    try {
      setLoading(true)
      const nodeData = await nodeApi.getCustomNode(nodeId)
      const codeData = await nodeApi.getNodeCode(nodeId)

      form.setFieldsValue({
        nodeId: nodeData.id,
        name: nodeData.name,
        description: nodeData.description,
        category: nodeData.category,
        executionMode: nodeData.executionMode,
        color: nodeData.color,
        configSchema: JSON.stringify(nodeData.configSchema || {}, null, 2),
      })

      // 转换字典格式为数组格式用于UI显示
      const inputItems: InputOutputItem[] = nodeData.inputs 
        ? Object.entries(nodeData.inputs).map(([name, param]: [string, any]) => ({
            key: name,
            name,
            isStreaming: param.isStreaming || false,
            schema: param.schema || {},
          }))
        : []
      
      const outputItems: InputOutputItem[] = nodeData.outputs
        ? Object.entries(nodeData.outputs).map(([name, param]: [string, any]) => ({
            key: name,
            name,
            isStreaming: param.isStreaming || false,
            schema: param.schema || {},
          }))
        : []

      setInputs(inputItems)
      setOutputs(outputItems)
      setPythonCode(codeData.code)
      setOriginalPythonCode(codeData.code) // 保存原始代码
      setCodeManuallyModified(false) // 重置修改标记
      setShowCodeEditor(true)
      
      // 保存原始数据用于比较变化
      setOriginalData({
        name: nodeData.name,
        description: nodeData.description || '',
        category: nodeData.category,
        executionMode: nodeData.executionMode,
        color: nodeData.color || '#1890ff',
        configSchema: nodeData.configSchema || {},
        inputs: nodeData.inputs || {},
        outputs: nodeData.outputs || {},
      })
    } catch (error) {
      message.error('加载节点数据失败')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // 加载内置节点数据（只读模式）
  const loadBuiltinNodeData = async (nodeId: string) => {
    try {
      setLoading(true)
      // 获取节点类型信息
      const nodeTypes = await nodeApi.getNodeTypes()
      const nodeType = nodeTypes.find((t: any) => t.id === nodeId)
      
      // 获取节点schema
      const schema = await nodeApi.getNodeSchema(nodeId)

      if (nodeType) {
        form.setFieldsValue({
          nodeId: nodeType.id,
          name: nodeType.name,
          description: nodeType.description || '',
          category: nodeType.category,
          executionMode: nodeType.executionMode,
          color: nodeType.color || '#1890ff',
          configSchema: JSON.stringify(nodeType.configSchema || {}, null, 2),
        })
      }

      // 转换字典格式为数组格式用于UI显示
      const inputItems: InputOutputItem[] = schema.INPUT_PARAMS
        ? Object.entries(schema.INPUT_PARAMS).map(([name, param]: [string, any]) => ({
            key: name,
            name,
            isStreaming: param.isStreaming || false,
            schema: param.schema || {},
          }))
        : []
      
      const outputItems: InputOutputItem[] = schema.OUTPUT_PARAMS
        ? Object.entries(schema.OUTPUT_PARAMS).map(([name, param]: [string, any]) => ({
            key: name,
            name,
            isStreaming: param.isStreaming || false,
            schema: param.schema || {},
          }))
        : []

      setInputs(inputItems)
      setOutputs(outputItems)
      setPythonCode('') // 内置节点不显示代码
      setOriginalPythonCode('')
      setCodeManuallyModified(false)
      setShowCodeEditor(false) // 内置节点不显示代码编辑器
    } catch (error) {
      message.error('加载节点信息失败')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddInput = () => {
    const newKey = `input_${Date.now()}`
    setInputs([
      ...inputs,
      {
        key: newKey,
        name: '',
        isStreaming: false,
        schema: {},
      },
    ])
  }

  const handleRemoveInput = (key: string) => {
    setInputs(inputs.filter((item) => item.key !== key))
  }

  const handleInputChange = (key: string, field: string, value: any) => {
    setInputs(inputs.map((item) => 
      item.key === key ? { ...item, [field]: value } : item
    ))
  }

  const handleAddInputSchemaField = (inputKey: string) => {
    setInputs(inputs.map((item) => {
      if (item.key === inputKey) {
        const newFieldName = `field_${Object.keys(item.schema).length + 1}`
        return {
          ...item,
          schema: { ...item.schema, [newFieldName]: 'string' },
        }
      }
      return item
    }))
  }

  const handleRemoveInputSchemaField = (inputKey: string, fieldName: string) => {
    setInputs(inputs.map((item) => {
      if (item.key === inputKey) {
        const newSchema = { ...item.schema }
        delete newSchema[fieldName]
        return { ...item, schema: newSchema }
      }
      return item
    }))
  }

  const handleInputSchemaFieldChange = (inputKey: string, fieldName: string, field: 'name' | 'type', value: string) => {
    setInputs(inputs.map((item) => {
      if (item.key === inputKey) {
        if (field === 'name') {
          // 重命名字段
          const newSchema: Record<string, string> = {}
          Object.entries(item.schema).forEach(([k, v]) => {
            if (k === fieldName) {
              newSchema[value] = v
            } else {
              newSchema[k] = v
            }
          })
          return { ...item, schema: newSchema }
        } else {
          // 修改类型
          return {
            ...item,
            schema: { ...item.schema, [fieldName]: value },
          }
        }
      }
      return item
    }))
  }

  const handleAddOutput = () => {
    const newKey = `output_${Date.now()}`
    setOutputs([
      ...outputs,
      {
        key: newKey,
        name: '',
        isStreaming: false,
        schema: {},
      },
    ])
  }

  const handleRemoveOutput = (key: string) => {
    setOutputs(outputs.filter((item) => item.key !== key))
  }

  const handleOutputChange = (key: string, field: string, value: any) => {
    setOutputs(outputs.map((item) => 
      item.key === key ? { ...item, [field]: value } : item
    ))
  }

  const handleAddOutputSchemaField = (outputKey: string) => {
    setOutputs(outputs.map((item) => {
      if (item.key === outputKey) {
        const newFieldName = `field_${Object.keys(item.schema).length + 1}`
        return {
          ...item,
          schema: { ...item.schema, [newFieldName]: 'string' },
        }
      }
      return item
    }))
  }

  const handleRemoveOutputSchemaField = (outputKey: string, fieldName: string) => {
    setOutputs(outputs.map((item) => {
      if (item.key === outputKey) {
        const newSchema = { ...item.schema }
        delete newSchema[fieldName]
        return { ...item, schema: newSchema }
      }
      return item
    }))
  }

  const handleOutputSchemaFieldChange = (outputKey: string, fieldName: string, field: 'name' | 'type', value: string) => {
    setOutputs(outputs.map((item) => {
      if (item.key === outputKey) {
        if (field === 'name') {
          // 重命名字段
          const newSchema: Record<string, string> = {}
          Object.entries(item.schema).forEach(([k, v]) => {
            if (k === fieldName) {
              newSchema[value] = v
            } else {
              newSchema[k] = v
            }
          })
          return { ...item, schema: newSchema }
        } else {
          // 修改类型
          return {
            ...item,
            schema: { ...item.schema, [fieldName]: value },
          }
        }
      }
      return item
    }))
  }

  // 将数组格式转换为字典格式
  const convertToDict = (items: InputOutputItem[]): Record<string, ParameterSchema> => {
    const result: Record<string, ParameterSchema> = {}
    items.forEach((item) => {
      if (item.name) {
        result[item.name] = {
          isStreaming: item.isStreaming,
          schema: item.schema,
        }
      }
    })
    return result
  }

  const generateCode = async () => {
    try {
      const values = await form.validateFields()
      let configSchema = {}
      try {
        if (values.configSchema) {
          configSchema = typeof values.configSchema === 'string' 
            ? JSON.parse(values.configSchema) 
            : values.configSchema
        }
      } catch (e) {
        message.error('配置Schema格式错误，请检查JSON格式')
        return
      }
      
      // 验证输入输出名称
      const inputNames = inputs.map((i) => i.name).filter((n) => n)
      const outputNames = outputs.map((o) => o.name).filter((n) => n)
      
      if (inputNames.length !== new Set(inputNames).size) {
        message.error('输入名称不能重复')
        return
      }
      if (outputNames.length !== new Set(outputNames).size) {
        message.error('输出名称不能重复')
        return
      }
      
      const inputsDict = convertToDict(inputs)
      const outputsDict = convertToDict(outputs)
      
      const code = nodeGenerator.generateNodeCode({
        nodeId: values.nodeId,
        name: values.name,
        description: values.description || "",
        category: values.category,
        executionMode: values.executionMode,
        color: values.color,
        inputs: inputsDict,
        outputs: outputsDict,
        configSchema,
      })
      setPythonCode(code)
      // 如果是编辑模式，检查代码是否被手动修改
      if (editingNodeId) {
        // 如果当前代码等于原始代码，说明没有被手动修改，重置标记
        if (code === originalPythonCode) {
          setCodeManuallyModified(false)
        }
        // 更新原始代码为最新生成的代码
        setOriginalPythonCode(code)
      }
      setShowCodeEditor(true)
      message.success('代码生成成功')
    } catch (error) {
      message.error('请先填写基本信息')
    }
  }

  const handleSubmit = async () => {
    try {
      setLoading(true)
      const values = await form.validateFields()
      
      let configSchema = {}
      try {
        if (values.configSchema) {
          configSchema = typeof values.configSchema === 'string' 
            ? JSON.parse(values.configSchema) 
            : values.configSchema
        }
      } catch (e) {
        message.error('配置Schema格式错误，请检查JSON格式')
        return
      }

      // 验证输入输出名称
      const inputNames = inputs.map((i) => i.name).filter((n) => n)
      const outputNames = outputs.map((o) => o.name).filter((n) => n)
      
      if (inputNames.length !== new Set(inputNames).size) {
        message.error('输入管理名称不能重复')
        return
      }
      if (outputNames.length !== new Set(outputNames).size) {
        message.error('输出管理名称不能重复')
        return
      }

      const inputsDict = convertToDict(inputs)
      const outputsDict = convertToDict(outputs)

      if (editingNodeId) {
        // 检查哪些字段发生了变化
        const hasNameChange = originalData && originalData.name !== values.name
        const hasDescriptionChange = originalData && originalData.description !== (values.description || '')
        const hasCategoryChange = originalData && originalData.category !== values.category
        const hasExecutionModeChange = originalData && originalData.executionMode !== values.executionMode
        const hasColorChange = originalData && originalData.color !== (values.color || '#1890ff')
        const hasConfigSchemaChange = originalData && JSON.stringify(originalData.configSchema) !== JSON.stringify(configSchema)
        const hasInputsChange = originalData && JSON.stringify(originalData.inputs) !== JSON.stringify(inputsDict)
        const hasOutputsChange = originalData && JSON.stringify(originalData.outputs) !== JSON.stringify(outputsDict)
        const hasCodeChange = codeManuallyModified || (showCodeEditor && pythonCode !== originalPythonCode)
        
        // 如果只有参数（inputs/outputs）变化，且代码没有被手动修改，使用参数更新接口
        const onlyParametersChanged = !hasNameChange && !hasDescriptionChange && !hasCategoryChange && 
                                     !hasExecutionModeChange && !hasColorChange && !hasConfigSchemaChange &&
                                     !hasCodeChange && (hasInputsChange || hasOutputsChange)
        
        if (onlyParametersChanged) {
          // 只更新参数，使用新接口，保留其他代码
          await nodeApi.updateCustomNodeParameters(editingNodeId, {
            inputs: inputsDict,
            outputs: outputsDict,
          })
          
          // 更新所有使用该节点类型的实例
          const { edges: edgesBefore } = useWorkflowStore.getState()
          updateNodeTypeInstances(editingNodeId, {
            inputParams: inputsDict,
            outputParams: outputsDict,
          })
          const { edges: edgesAfter } = useWorkflowStore.getState()
          
          // 检查是否有连接被删除
          const removedConnections = edgesBefore.filter(
            (e) => !edgesAfter.find((ea) => ea.id === e.id)
          )
          
          if (removedConnections.length > 0) {
            message.warning(
              `参数更新成功（已保留您的代码）。所有实例已同步更新，但有 ${removedConnections.length} 个连接因参数被删除而移除。`
            )
          } else {
            message.success('参数更新成功（已保留您的代码，所有实例已同步更新）')
          }
        } else {
          // 有其他字段变化或代码变化，使用完整更新接口
          // 在编辑模式下，智能判断使用哪个代码
          let finalPythonCode: string | undefined = undefined
          
          if (showCodeEditor && pythonCode) {
            // 如果代码被手动修改过，使用用户修改的代码
            if (codeManuallyModified) {
              finalPythonCode = pythonCode
              console.log('使用手动修改的代码')
            } else {
              // 如果代码没有被手动修改，根据新参数生成代码
              // 这样参数的变化会反映到代码中
              const generatedCode = nodeGenerator.generateNodeCode({
                nodeId: values.nodeId,
                name: values.name,
                description: values.description || "",
                category: values.category,
                executionMode: values.executionMode,
                color: values.color,
                inputs: inputsDict,
                outputs: outputsDict,
                configSchema,
              })
              finalPythonCode = generatedCode
              console.log('代码未被手动修改，使用新生成的代码')
            }
          } else {
            // 如果没有显示代码编辑器，根据新参数生成代码
            const generatedCode = nodeGenerator.generateNodeCode({
              nodeId: values.nodeId,
              name: values.name,
              description: values.description || "",
              category: values.category,
              executionMode: values.executionMode,
              color: values.color,
              inputs: inputsDict,
              outputs: outputsDict,
              configSchema,
            })
            finalPythonCode = generatedCode
            console.log('没有显示代码编辑器，生成新代码')
          }

          const request: CreateNodeRequest = {
            nodeId: values.nodeId,
            name: values.name,
            description: values.description || "",
            category: values.category,
            executionMode: values.executionMode,
            color: values.color,
            inputs: inputsDict,
            outputs: outputsDict,
            configSchema,
            pythonCode: finalPythonCode,
          }
          
          await nodeApi.updateCustomNodeFull(editingNodeId, request)
          
          // 更新所有使用该节点类型的实例
          const { edges: edgesBefore } = useWorkflowStore.getState()
          updateNodeTypeInstances(editingNodeId, {
            name: values.name,
            color: values.color,
            inputParams: inputsDict,
            outputParams: outputsDict,
          })
          const { edges: edgesAfter } = useWorkflowStore.getState()
          
          // 检查是否有连接被删除
          const removedConnections = edgesBefore.filter(
            (e) => !edgesAfter.find((ea) => ea.id === e.id)
          )
          
          if (codeManuallyModified) {
            if (removedConnections.length > 0) {
              message.warning(
                `节点更新成功（已保留您的代码修改）。所有实例已同步更新，但有 ${removedConnections.length} 个连接因参数被删除而移除。`
              )
            } else {
              message.success('节点更新成功（已保留您的代码修改，所有实例已同步更新）')
            }
          } else {
            if (removedConnections.length > 0) {
              message.warning(
                `节点更新成功。所有实例已同步更新，但有 ${removedConnections.length} 个连接因参数被删除而移除。`
              )
            } else {
              message.success('节点更新成功（所有实例已同步更新）')
            }
          }
        }
      } else {
        // 创建模式：使用代码编辑器中的代码或生成新代码
        const finalPythonCode = showCodeEditor && pythonCode ? pythonCode : undefined

        const request: CreateNodeRequest = {
          nodeId: values.nodeId,
          name: values.name,
          description: values.description || "",
          category: values.category,
          executionMode: values.executionMode,
          color: values.color,
          inputs: inputsDict,
          outputs: outputsDict,
          configSchema,
          pythonCode: finalPythonCode,
        }
        
        await nodeApi.createCustomNode(request)
        message.success('节点创建成功')
      }

      onSuccess()
      onCancel()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // 渲染输入/输出的Schema字段表格
  const renderSchemaFields = (
    item: InputOutputItem,
    onAddField: (key: string) => void,
    onRemoveField: (key: string, fieldName: string) => void,
    onFieldChange: (key: string, fieldName: string, field: 'name' | 'type', value: string) => void
  ) => {
    const schemaFields = Object.entries(item.schema)
    
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--theme-textSecondary, #595959)' }}>Schema字段 ({schemaFields.length})</span>
          {!readOnly && (
            <Button
              type="dashed"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => onAddField(item.key)}
            >
              添加字段
            </Button>
          )}
        </div>
        {schemaFields.length === 0 ? (
          <div style={{ padding: '8px 0', color: 'var(--theme-textTertiary, #8c8c8c)', fontSize: 12, textAlign: 'center' }}>
            暂无字段（可选）
          </div>
        ) : (
          <Table
            size="small"
            dataSource={schemaFields.map(([fieldName, fieldType], idx) => ({
              key: `${item.key}_${idx}`, // 使用索引作为稳定的key，不依赖字段名
              fieldName,
              fieldType,
            }))}
            rowKey={(record) => record.key} // 明确指定 rowKey
            pagination={false}
            columns={[
              {
                title: '字段名',
                dataIndex: 'fieldName',
                key: 'fieldName',
                render: (text: string, record: any) => (
                  <Input
                    key={`input-${record.key}`} // 为输入框添加稳定的key，基于行的key
                    size="small"
                    value={text}
                    onChange={(e) => {
                      // text 是当前的字段名，在 onChange 时使用它作为旧字段名
                      onFieldChange(item.key, text, 'name', e.target.value)
                    }}
                    disabled={readOnly}
                    placeholder="字段名"
                  />
                ),
              },
              {
                title: '类型',
                dataIndex: 'fieldType',
                key: 'fieldType',
                render: (text: string, record: any) => {
                  // 获取当前行的字段名（从 record.fieldName）
                  const currentFieldName = record.fieldName
                  return (
                    <Select
                      key={`select-${record.key}`} // 为选择框添加稳定的key，基于行的key
                      size="small"
                      value={text}
                      onChange={(value) => {
                        // 使用当前行的字段名来定位要更新的字段
                        onFieldChange(item.key, currentFieldName, 'type', value)
                      }}
                      disabled={readOnly}
                      style={{ width: '100%' }}
                    >
                      <Option value="string">string</Option>
                      <Option value="integer">integer</Option>
                      <Option value="float">float</Option>
                      <Option value="boolean">boolean</Option>
                      <Option value="object">object</Option>
                      <Option value="array">array</Option>
                    </Select>
                  )
                },
              },
              ...(readOnly ? [] : [{
                title: '操作',
                key: 'action',
                width: 80,
                render: (_: any, record: any) => (
                  <Button
                    type="link"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => onRemoveField(item.key, record.fieldName)}
                  />
                ),
              }])
            ]}
          />
        )}
      </div>
    )
  }

  return (
    <Modal
      title={readOnly ? '查看节点信息' : (editingNodeId ? '编辑节点' : '创建节点')}
      open={visible}
      onCancel={onCancel}
      width={900}
      footer={readOnly ? [
        <Button key="close" type="primary" onClick={onCancel}>
          关闭
        </Button>,
      ] : [
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="generate" onClick={generateCode}>
          生成代码
        </Button>,
        <Button key="submit" type="primary" loading={loading} onClick={handleSubmit}>
          {editingNodeId ? '更新' : '创建'}
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical">
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
          {
            key: 'basic',
            label: '基本信息',
            children: (
              <>
                <Form.Item
                  name="nodeId"
                  label="节点ID"
                  rules={readOnly ? [] : [
                    { required: true, message: '请输入节点ID' },
                    { pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/, message: '节点ID只能包含字母、数字和下划线，且不能以数字开头' },
                  ]}
                >
                  <Input disabled={readOnly || !!editingNodeId} placeholder="例如: custom_text_process" />
                </Form.Item>

                <Form.Item name="name" label="节点名称" rules={readOnly ? [] : [{ required: true, message: '请输入节点名称' }]}>
                  <Input disabled={readOnly} placeholder="例如: 文本处理器" />
                </Form.Item>

                <Form.Item name="description" label="节点描述">
                  <TextArea rows={3} disabled={readOnly} placeholder="描述节点的功能" />
                </Form.Item>

                <Form.Item name="category" label="分类" rules={readOnly ? [] : [{ required: true, message: '请输入分类' }]}>
                  <Input disabled={readOnly} placeholder="例如: 数据处理.文本 (支持点分隔符进行树状分类)" />
                </Form.Item>

                <Form.Item
                  name="executionMode"
                  label="执行模式"
                  rules={readOnly ? [] : [{ required: true, message: '请选择执行模式' }]}
                >
                  <Select disabled={readOnly}>
                    <Option value="sequential">顺序执行</Option>
                    <Option value="streaming">流式处理</Option>
                    <Option value="hybrid">混合模式</Option>
                  </Select>
                </Form.Item>

                <Form.Item name="color" label="节点颜色" rules={readOnly ? [] : [{ required: true, message: '请输入颜色' }]}>
                  <Input type="color" disabled={readOnly} style={{ width: 100 }} />
                </Form.Item>
              </>
            ),
          },
          {
            key: 'inputs',
            label: '输入管理',
            children: (
            <Space direction="vertical" style={{ width: '100%' }}>
              {!readOnly && (
                <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddInput} block>
                  添加输入
                </Button>
              )}
              {inputs.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--theme-textTertiary, #8c8c8c)' }}>
                  暂无内容，点击上方按钮添加
                </div>
              ) : (
                <Collapse
                  items={inputs.map((item) => ({
                    key: item.key,
                    label: (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Input
                          size="small"
                          value={item.name}
                          onChange={(e) => handleInputChange(item.key, 'name', e.target.value)}
                          placeholder="输入名称"
                          disabled={readOnly}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: 200 }}
                        />
                        <div onClick={(e) => e.stopPropagation()}>
                          <Switch
                            checked={item.isStreaming}
                            onChange={(checked) => handleInputChange(item.key, 'isStreaming', checked)}
                            disabled={readOnly}
                          />
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--theme-textSecondary, #595959)' }}>
                          {item.isStreaming ? '流式' : '非流式'}
                        </span>
                        {!readOnly && (
                          <Button
                            type="link"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveInput(item.key)
                            }}
                          >
                            删除
                          </Button>
                        )}
                      </div>
                    ),
                    children: renderSchemaFields(
                      item,
                      handleAddInputSchemaField,
                      handleRemoveInputSchemaField,
                      handleInputSchemaFieldChange
                    ),
                  }))}
                />
              )}
            </Space>
            ),
          },
          {
            key: 'outputs',
            label: '输出管理',
            children: (
            <Space direction="vertical" style={{ width: '100%' }}>
              {!readOnly && (
                <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddOutput} block>
                  添加输出
                </Button>
              )}
              {outputs.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--theme-textTertiary, #8c8c8c)' }}>
                  暂无内容，点击上方按钮添加
                </div>
              ) : (
                <Collapse
                  items={outputs.map((item) => ({
                    key: item.key,
                    label: (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Input
                          size="small"
                          value={item.name}
                          onChange={(e) => handleOutputChange(item.key, 'name', e.target.value)}
                          placeholder="输出名称"
                          disabled={readOnly}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: 200 }}
                        />
                        <div onClick={(e) => e.stopPropagation()}>
                          <Switch
                            checked={item.isStreaming}
                            onChange={(checked) => handleOutputChange(item.key, 'isStreaming', checked)}
                            disabled={readOnly}
                          />
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--theme-textSecondary, #595959)' }}>
                          {item.isStreaming ? '流式' : '非流式'}
                        </span>
                        {!readOnly && (
                          <Button
                            type="link"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveOutput(item.key)
                            }}
                          >
                            删除
                          </Button>
                        )}
                      </div>
                    ),
                    children: renderSchemaFields(
                      item,
                      handleAddOutputSchemaField,
                      handleRemoveOutputSchemaField,
                      handleOutputSchemaFieldChange
                    ),
                  }))}
                />
              )}
            </Space>
            ),
          },
          {
            key: 'config',
            label: '配置Schema',
            children: (
              <Form.Item name="configSchema">
                <TextArea
                  rows={10}
                  disabled={readOnly}
                  placeholder='JSON格式，例如: { "operation": { "type": "string", "default": "uppercase" } }'
                />
              </Form.Item>
            ),
          },
          ...(showCodeEditor ? [{
            key: 'code',
            label: 'Python代码',
            children: (
              <>
                <Editor
                  height="500px"
                  language="python"
                  value={pythonCode}
                  onChange={(value) => {
                    if (!readOnly) {
                      const newCode = value || ''
                      setPythonCode(newCode)
                      // 检测代码是否被手动修改（与原始代码不同）
                      if (editingNodeId && newCode !== originalPythonCode) {
                        setCodeManuallyModified(true)
                      }
                    }
                  }}
                  theme={editorTheme}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    wordWrap: 'on',
                    readOnly: readOnly,
                  }}
                />
                {editingNodeId && codeManuallyModified && (
                  <div style={{ 
                    marginTop: 8, 
                    padding: 8, 
                    background: 'var(--theme-backgroundSecondary, #fff7e6)', 
                    border: '1px solid var(--theme-border, #ffd591)',
                    borderRadius: 4,
                    fontSize: 12,
                    color: 'var(--theme-text, #d46b08)'
                  }}>
                    ⚠️ 代码已被手动修改。修改参数后，您的代码修改将被保留。
                  </div>
                )}
              </>
            ),
          }] : []),
        ]} />
      </Form>
    </Modal>
  )
}

export default NodeCreatorModal

