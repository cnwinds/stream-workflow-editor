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

// Schema 字段定义（用于 UI 编辑）
interface SchemaFieldItem {
  fieldName: string
  type: string
  required: boolean
  description: string
  default?: any
}

interface InputOutputItem {
  key: string
  name: string
  isStreaming: boolean
  schemaType: 'simple' | 'struct' // schema 类型：简单类型字符串或结构体字典
  simpleType?: string // 简单类型时的类型字符串
  schemaFields?: SchemaFieldItem[] // 结构体时的字段列表
  description?: string // 参数说明
}

// 配置参数直接就是字段列表（使用 FieldSchema 格式）
// CONFIG_PARAMS 是一个字典，键是字段名，值是 FieldSchemaDef
// FieldSchemaDef 可以是：
// - 简单格式: "string" - 只有类型
// - 详细格式: {"type": "string", "required": True, "description": "...", "default": "..."}
// 不再需要 ConfigParamItem，直接使用 SchemaFieldItem[] 数组

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
  const [configParams, setConfigParams] = useState<SchemaFieldItem[]>([])
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
    configParams?: Record<string, any>
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
        setConfigParams([])
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
      })

      // 转换字典格式为数组格式用于UI显示
      const inputItems: InputOutputItem[] = nodeData.inputs 
        ? Object.entries(nodeData.inputs).map(([name, param]: [string, any]) => {
            const schemaUI = parseSchemaToUI(param.schema || {})
            return {
              key: name,
              name,
              isStreaming: param.isStreaming || false,
              ...schemaUI,
              description: param.description || '',
            }
          })
        : []
      
      const outputItems: InputOutputItem[] = nodeData.outputs
        ? Object.entries(nodeData.outputs).map(([name, param]: [string, any]) => {
            const schemaUI = parseSchemaToUI(param.schema || {})
            return {
              key: name,
              name,
              isStreaming: param.isStreaming || false,
              ...schemaUI,
              description: param.description || '',
            }
          })
        : []

      // 转换配置参数（使用 FieldSchema 格式，直接是字段列表）
      const configFields: SchemaFieldItem[] = nodeData.configParams
        ? parseConfigParamsToUI(nodeData.configParams)
        : []

      setInputs(inputItems)
      setOutputs(outputItems)
      setConfigParams(configFields)
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
        configParams: nodeData.configParams || {},
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
        })
      }

      // 转换字典格式为数组格式用于UI显示
      const inputItems: InputOutputItem[] = schema.INPUT_PARAMS
        ? Object.entries(schema.INPUT_PARAMS).map(([name, param]: [string, any]) => {
            const schemaUI = parseSchemaToUI(param.schema || {})
            return {
              key: name,
              name,
              isStreaming: param.isStreaming || false,
              ...schemaUI,
              description: param.description || '',
            }
          })
        : []
      
      const outputItems: InputOutputItem[] = schema.OUTPUT_PARAMS
        ? Object.entries(schema.OUTPUT_PARAMS).map(([name, param]: [string, any]) => {
            const schemaUI = parseSchemaToUI(param.schema || {})
            return {
              key: name,
              name,
              isStreaming: param.isStreaming || false,
              ...schemaUI,
              description: param.description || '',
            }
          })
        : []

      // 转换配置参数（使用 FieldSchema 格式，直接是字段列表）
      const configFields: SchemaFieldItem[] = schema.CONFIG_PARAMS
        ? parseConfigParamsToUI(schema.CONFIG_PARAMS)
        : []

      setInputs(inputItems)
      setOutputs(outputItems)
      setConfigParams(configFields)
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
        schemaType: 'simple',
        simpleType: 'any',
        description: '',
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

  // 切换 schema 类型（简单类型 <-> 结构体）
  const handleToggleSchemaType = (key: string, type: 'input' | 'output' | 'config') => {
    const updateItem = (item: InputOutputItem) => {
      if (item.key === key) {
        if (item.schemaType === 'simple') {
          // 从简单类型切换到结构体
          return {
            ...item,
            schemaType: 'struct' as const,
            simpleType: undefined,
            schemaFields: [],
          }
        } else {
          // 从结构体切换到简单类型
          return {
            ...item,
            schemaType: 'simple' as const,
            simpleType: 'any',
            schemaFields: undefined,
          }
        }
      }
      return item
    }

    if (type === 'input') {
      setInputs(inputs.map(updateItem))
    } else if (type === 'output') {
      setOutputs(outputs.map(updateItem))
    } else {
      setConfigParams(configParams.map(updateItem))
    }
  }

  const handleAddInputSchemaField = (inputKey: string) => {
    setInputs(inputs.map((item) => {
      if (item.key === inputKey) {
        if (item.schemaType !== 'struct') {
          // 如果不是结构体，先切换为结构体
          return {
            ...item,
            schemaType: 'struct' as const,
            simpleType: undefined,
            schemaFields: [],
          }
        }
        const newFieldName = `field_${(item.schemaFields || []).length + 1}`
        return {
          ...item,
          schemaFields: [
            ...(item.schemaFields || []),
            {
              fieldName: newFieldName,
              type: 'string',
              required: false,
              description: '',
            },
          ],
        }
      }
      return item
    }))
  }

  const handleRemoveInputSchemaField = (inputKey: string, fieldIndex: number) => {
    setInputs(inputs.map((item) => {
      if (item.key === inputKey && item.schemaFields) {
        return {
          ...item,
          schemaFields: item.schemaFields.filter((_, idx) => idx !== fieldIndex),
        }
      }
      return item
    }))
  }

  const handleInputSchemaFieldChange = (inputKey: string, fieldIndex: number, field: keyof SchemaFieldItem, value: any) => {
    setInputs(inputs.map((item) => {
      if (item.key === inputKey && item.schemaFields) {
        return {
          ...item,
          schemaFields: item.schemaFields.map((f, idx) => 
            idx === fieldIndex ? { ...f, [field]: value } : f
          ),
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
        schemaType: 'simple',
        simpleType: 'any',
        description: '',
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
        if (item.schemaType !== 'struct') {
          return {
            ...item,
            schemaType: 'struct' as const,
            simpleType: undefined,
            schemaFields: [],
          }
        }
        const newFieldName = `field_${(item.schemaFields || []).length + 1}`
        return {
          ...item,
          schemaFields: [
            ...(item.schemaFields || []),
            {
              fieldName: newFieldName,
              type: 'string',
              required: false,
              description: '',
            },
          ],
        }
      }
      return item
    }))
  }

  const handleRemoveOutputSchemaField = (outputKey: string, fieldIndex: number) => {
    setOutputs(outputs.map((item) => {
      if (item.key === outputKey && item.schemaFields) {
        return {
          ...item,
          schemaFields: item.schemaFields.filter((_, idx) => idx !== fieldIndex),
        }
      }
      return item
    }))
  }

  const handleOutputSchemaFieldChange = (outputKey: string, fieldIndex: number, field: keyof SchemaFieldItem, value: any) => {
    setOutputs(outputs.map((item) => {
      if (item.key === outputKey && item.schemaFields) {
        return {
          ...item,
          schemaFields: item.schemaFields.map((f, idx) => 
            idx === fieldIndex ? { ...f, [field]: value } : f
          ),
        }
      }
      return item
    }))
  }

  // 配置参数处理函数（直接操作字段列表）
  const handleAddConfigParamField = () => {
    const newFieldName = `field_${configParams.length + 1}`
    setConfigParams([
      ...configParams,
      {
        fieldName: newFieldName,
        type: 'string',
        required: false,
        description: '',
      },
    ])
  }

  const handleRemoveConfigParamField = (fieldIndex: number) => {
    setConfigParams(configParams.filter((_, idx) => idx !== fieldIndex))
  }

  const handleConfigParamFieldChange = (fieldIndex: number, field: keyof SchemaFieldItem, value: any) => {
    setConfigParams(configParams.map((f, idx) => 
      idx === fieldIndex ? { ...f, [field]: value } : f
    ))
  }

  // 将配置参数的 FieldSchema 转换为 UI 格式
  // CONFIG_PARAMS 是一个字典，键是字段名，值是 FieldSchemaDef
  const parseConfigParamsToUI = (configParams: Record<string, any>): SchemaFieldItem[] => {
    if (!configParams || Object.keys(configParams).length === 0) {
      return []
    }
    
    // 直接转换为字段列表
    return Object.entries(configParams).map(([fieldName, fieldDef]) => {
      if (typeof fieldDef === 'string') {
        // 简单格式: "string"
        return {
          fieldName,
          type: fieldDef,
          required: false,
          description: '',
        }
      } else if (typeof fieldDef === 'object' && fieldDef !== null) {
        // 详细格式: {"type": "string", "required": True, "description": "...", "default": "..."}
        return {
          fieldName,
          type: fieldDef.type || 'any',
          required: fieldDef.required || false,
          description: fieldDef.description || '',
          default: fieldDef.default,
        }
      } else {
        return {
          fieldName,
          type: 'any',
          required: false,
          description: '',
        }
      }
    })
  }

  // 将配置参数的 UI 格式转换为 FieldSchema 字典
  // 返回一个字典，键是字段名，值是 FieldSchemaDef
  const convertConfigParamsUIToSchema = (fields: SchemaFieldItem[]): Record<string, any> => {
    const result: Record<string, any> = {}
    
    // 遍历每个字段
    fields.forEach((field) => {
      if (field.fieldName) {
        // 检查是否有详细格式的属性（required、description、default）
        const hasDetailedFormat = field.required || field.description || field.default !== undefined
        
        if (hasDetailedFormat) {
          // 使用详细格式
          result[field.fieldName] = {
            type: field.type || 'any',
          }
          if (field.required) {
            result[field.fieldName].required = true
          }
          if (field.description) {
            result[field.fieldName].description = field.description
          }
          if (field.default !== undefined && field.default !== '') {
            result[field.fieldName].default = field.default
          }
        } else {
          // 使用简单格式：只有类型字符串
          result[field.fieldName] = field.type || 'any'
        }
      }
    })
    
    return result
  }

  // 将 schema 转换为 UI 格式（用于输入/输出参数）
  const parseSchemaToUI = (schema: any): { schemaType: 'simple' | 'struct', simpleType?: string, schemaFields?: SchemaFieldItem[] } => {
    if (typeof schema === 'string') {
      // 简单类型
      return {
        schemaType: 'simple',
        simpleType: schema,
      }
    } else if (typeof schema === 'object' && schema !== null) {
      // 结构体
      const fields: SchemaFieldItem[] = Object.entries(schema).map(([fieldName, fieldDef]: [string, any]) => {
        if (typeof fieldDef === 'string') {
          // 简单格式: {"field_name": "type"}
          return {
            fieldName,
            type: fieldDef,
            required: false,
            description: '',
          }
        } else if (typeof fieldDef === 'object' && fieldDef !== null) {
          // 详细格式: {"field_name": {"type": "string", "required": true, ...}}
          return {
            fieldName,
            type: fieldDef.type || 'any',
            required: fieldDef.required || false,
            description: fieldDef.description || '',
            default: fieldDef.default,
          }
        } else {
          return {
            fieldName,
            type: 'any',
            required: false,
            description: '',
          }
        }
      })
      return {
        schemaType: 'struct',
        schemaFields: fields,
      }
    } else {
      // 默认空结构体
      return {
        schemaType: 'struct',
        schemaFields: [],
      }
    }
  }

  // 将 UI 格式转换为 schema
  const convertUIToSchema = (item: InputOutputItem): any => {
    if (item.schemaType === 'simple') {
      // 简单类型：返回字符串
      return item.simpleType || 'any'
    } else {
      // 结构体：检查是否使用详细格式
      if (!item.schemaFields || item.schemaFields.length === 0) {
        return {}
      }
      
      // 检查是否有字段使用了详细格式的属性（required、description、default）
      const hasDetailedFormat = item.schemaFields.some(
        field => field.required || field.description || field.default !== undefined
      )
      
      if (hasDetailedFormat) {
        // 使用详细格式
        const schema: Record<string, any> = {}
        item.schemaFields.forEach(field => {
          if (field.fieldName) {
            schema[field.fieldName] = {
              type: field.type,
            }
            if (field.required) {
              schema[field.fieldName].required = true
            }
            if (field.description) {
              schema[field.fieldName].description = field.description
            }
            if (field.default !== undefined && field.default !== '') {
              schema[field.fieldName].default = field.default
            }
          }
        })
        return schema
      } else {
        // 使用简单格式
        const schema: Record<string, string> = {}
        item.schemaFields.forEach(field => {
          if (field.fieldName) {
            schema[field.fieldName] = field.type
          }
        })
        return schema
      }
    }
  }

  // 将数组格式转换为字典格式（输入/输出参数）
  const convertToDict = (items: InputOutputItem[]): Record<string, ParameterSchema> => {
    const result: Record<string, ParameterSchema> = {}
    items.forEach((item) => {
      if (item.name) {
        result[item.name] = {
          isStreaming: item.isStreaming,
          schema: convertUIToSchema(item),
          description: item.description || '',
        }
      }
    })
    return result
  }

  // 将配置参数数组转换为字典格式（使用 FieldSchema 格式）
  // 返回一个字典，键是字段名，值是 FieldSchemaDef
  const convertConfigParamsToDict = (fields: SchemaFieldItem[]): Record<string, any> => {
    return convertConfigParamsUIToSchema(fields)
  }

  const generateCode = async () => {
    try {
      const values = await form.validateFields()
      
      // 验证输入输出配置参数名称
      const inputNames = inputs.map((i) => i.name).filter((n) => n)
      const outputNames = outputs.map((o) => o.name).filter((n) => n)
      const configNames = configParams.map((c) => c.name).filter((n) => n)
      
      if (inputNames.length !== new Set(inputNames).size) {
        message.error('输入名称不能重复')
        return
      }
      if (outputNames.length !== new Set(outputNames).size) {
        message.error('输出名称不能重复')
        return
      }
      if (configNames.length !== new Set(configNames).size) {
        message.error('配置参数名称不能重复')
        return
      }
      
      const inputsDict = convertToDict(inputs)
      const outputsDict = convertToDict(outputs)
      const configParamsDict = convertConfigParamsToDict(configParams)
      
      const code = nodeGenerator.generateNodeCode({
        nodeId: values.nodeId,
        name: values.name,
        description: values.description || "",
        category: values.category,
        executionMode: values.executionMode,
        color: values.color,
        inputs: inputsDict,
        outputs: outputsDict,
        configParams: configParamsDict,
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

      // 验证输入输出配置参数名称
      const inputNames = inputs.map((i) => i.name).filter((n) => n)
      const outputNames = outputs.map((o) => o.name).filter((n) => n)
      const configNames = configParams.map((c) => c.name).filter((n) => n)
      
      if (inputNames.length !== new Set(inputNames).size) {
        message.error('输入管理名称不能重复')
        return
      }
      if (outputNames.length !== new Set(outputNames).size) {
        message.error('输出管理名称不能重复')
        return
      }
      if (configNames.length !== new Set(configNames).size) {
        message.error('配置参数名称不能重复')
        return
      }

      const inputsDict = convertToDict(inputs)
      const outputsDict = convertToDict(outputs)
      const configParamsDict = convertConfigParamsToDict(configParams)

      if (editingNodeId) {
        // 检查哪些字段发生了变化
        const hasNameChange = originalData && originalData.name !== values.name
        const hasDescriptionChange = originalData && originalData.description !== (values.description || '')
        const hasCategoryChange = originalData && originalData.category !== values.category
        const hasExecutionModeChange = originalData && originalData.executionMode !== values.executionMode
        const hasColorChange = originalData && originalData.color !== (values.color || '#1890ff')
        const hasConfigParamsChange = originalData && JSON.stringify(originalData.configParams) !== JSON.stringify(configParamsDict)
        const hasInputsChange = originalData && JSON.stringify(originalData.inputs) !== JSON.stringify(inputsDict)
        const hasOutputsChange = originalData && JSON.stringify(originalData.outputs) !== JSON.stringify(outputsDict)
        const hasCodeChange = codeManuallyModified || (showCodeEditor && pythonCode !== originalPythonCode)
        
        // 如果只有参数（inputs/outputs/configParams）变化，且代码没有被手动修改，使用参数更新接口
        const onlyParametersChanged = !hasNameChange && !hasDescriptionChange && !hasCategoryChange && 
                                     !hasExecutionModeChange && !hasColorChange && !hasConfigParamsChange &&
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
            configParams: configParamsDict,
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
                configParams: configParamsDict,
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
              configParams: configParamsDict,
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
            configParams: configParamsDict,
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
            configParams: configParamsDict,
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
          configParams: configParamsDict,
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

  // 渲染 Schema 配置（支持简单类型和结构体）
  const renderSchemaConfig = (
    item: InputOutputItem,
    type: 'input' | 'output' | 'config',
    onAddField: (key: string) => void,
    onRemoveField: (key: string, fieldIndex: number) => void,
    onFieldChange: (key: string, fieldIndex: number, field: keyof SchemaFieldItem, value: any) => void
  ) => {
    return (
      <div style={{ marginTop: 8 }}>
        {item.schemaType === 'simple' ? (
          // 简单类型
          <div>
            <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--theme-textSecondary, #595959)' }}>
              类型
            </div>
            <Select
              size="small"
              value={item.simpleType || 'any'}
              onChange={(value) => {
                if (type === 'input') {
                  handleInputChange(item.key, 'simpleType', value)
                } else if (type === 'output') {
                  handleOutputChange(item.key, 'simpleType', value)
                } else {
                  handleConfigParamChange(item.key, 'simpleType', value)
                }
              }}
              disabled={readOnly}
              style={{ width: '100%' }}
            >
              <Option value="string">string</Option>
              <Option value="integer">integer</Option>
              <Option value="float">float</Option>
              <Option value="bytes">bytes</Option>
              <Option value="boolean">boolean</Option>
              <Option value="dict">dict</Option>
              <Option value="list">list</Option>
              <Option value="any">any</Option>
            </Select>
          </div>
        ) : (
          // 结构体
          <div>
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--theme-textSecondary, #595959)' }}>
                Schema 字段 ({(item.schemaFields || []).length})
              </span>
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
            {(item.schemaFields || []).length === 0 ? (
              <div style={{ padding: '8px 0', color: 'var(--theme-textTertiary, #8c8c8c)', fontSize: 12, textAlign: 'center' }}>
                暂无字段（可选）
              </div>
            ) : (
              <Table
                size="small"
                dataSource={(item.schemaFields || []).map((field, idx) => ({
                  key: `${item.key}_${idx}`,
                  index: idx,
                  ...field,
                }))}
                rowKey={(record) => record.key}
                pagination={false}
                columns={[
                  {
                    title: '字段名',
                    dataIndex: 'fieldName',
                    key: 'fieldName',
                    render: (text: string, record: any) => (
                      <Input
                        key={`input-${record.key}`}
                        size="small"
                        value={text}
                        onChange={(e) => onFieldChange(item.key, record.index, 'fieldName', e.target.value)}
                        disabled={readOnly}
                        placeholder="字段名"
                        className="node-creator-schema-input"
                      />
                    ),
                  },
                  {
                    title: '类型',
                    dataIndex: 'type',
                    key: 'type',
                    render: (text: string, record: any) => (
                      <Select
                        key={`select-${record.key}`}
                        size="small"
                        value={text}
                        onChange={(value) => onFieldChange(item.key, record.index, 'type', value)}
                        disabled={readOnly}
                        style={{ width: '100%' }}
                      >
                        <Option value="string">string</Option>
                        <Option value="integer">integer</Option>
                        <Option value="float">float</Option>
                        <Option value="bytes">bytes</Option>
                        <Option value="boolean">boolean</Option>
                        <Option value="dict">dict</Option>
                        <Option value="list">list</Option>
                        <Option value="any">any</Option>
                      </Select>
                    ),
                  },
                  {
                    title: '必传',
                    dataIndex: 'required',
                    key: 'required',
                    width: 80,
                    render: (_: any, record: any) => (
                      <Switch
                        key={`switch-${record.key}`}
                        size="small"
                        checked={record.required || false}
                        onChange={(checked) => onFieldChange(item.key, record.index, 'required', checked)}
                        disabled={readOnly}
                      />
                    ),
                  },
                  {
                    title: '说明',
                    dataIndex: 'description',
                    key: 'description',
                    render: (text: string, record: any) => (
                      <Input
                        key={`desc-${record.key}`}
                        size="small"
                        value={text || ''}
                        onChange={(e) => onFieldChange(item.key, record.index, 'description', e.target.value)}
                        disabled={readOnly}
                        placeholder="字段说明"
                        className="node-creator-schema-input"
                      />
                    ),
                  },
                  {
                    title: '默认值',
                    dataIndex: 'default',
                    key: 'default',
                    render: (text: any, record: any) => (
                      <Input
                        key={`default-${record.key}`}
                        size="small"
                        value={text !== undefined && text !== null ? String(text) : ''}
                        onChange={(e) => {
                          const value = e.target.value
                          // 尝试解析为 JSON，如果失败则作为字符串
                          let parsedValue: any = value
                          if (value.trim() !== '') {
                            try {
                              parsedValue = JSON.parse(value)
                            } catch {
                              parsedValue = value
                            }
                          } else {
                            parsedValue = undefined
                          }
                          onFieldChange(item.key, record.index, 'default', parsedValue)
                        }}
                        disabled={readOnly}
                        placeholder="默认值"
                        className="node-creator-schema-input"
                      />
                    ),
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
                        onClick={() => onRemoveField(item.key, record.index)}
                      />
                    ),
                  }])
                ]}
              />
            )}
          </div>
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
      className="node-creator-modal"
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
                  <Input 
                    disabled={readOnly || !!editingNodeId} 
                    placeholder="例如: custom_text_process"
                    className="node-creator-input"
                  />
                </Form.Item>

                <Form.Item name="name" label="节点名称" rules={readOnly ? [] : [{ required: true, message: '请输入节点名称' }]}>
                  <Input 
                    disabled={readOnly} 
                    placeholder="例如: 文本处理器"
                    className="node-creator-input"
                  />
                </Form.Item>

                <Form.Item name="description" label="节点描述">
                  <TextArea 
                    rows={3} 
                    disabled={readOnly} 
                    placeholder="描述节点的功能"
                    className="node-creator-input"
                  />
                </Form.Item>

                <Form.Item name="category" label="分类" rules={readOnly ? [] : [{ required: true, message: '请输入分类' }]}>
                  <Input 
                    disabled={readOnly} 
                    placeholder="例如: 数据处理.文本 (支持点分隔符进行树状分类)"
                    className="node-creator-input"
                  />
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                        <Input
                          size="small"
                          value={item.name}
                          onChange={(e) => handleInputChange(item.key, 'name', e.target.value)}
                          placeholder="输入名称"
                          disabled={readOnly}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: 150, flexShrink: 0 }}
                          className="node-creator-input"
                        />
                        <div onClick={(e) => e.stopPropagation()}>
                          <Switch
                            checked={item.isStreaming}
                            onChange={(checked) => handleInputChange(item.key, 'isStreaming', checked)}
                            disabled={readOnly}
                          />
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--theme-textSecondary, #595959)', flexShrink: 0 }}>
                          {item.isStreaming ? '流式' : '非流式'}
                        </span>
                        {!readOnly && (
                          <Select
                            size="small"
                            value={item.schemaType}
                            onChange={(value) => handleToggleSchemaType(item.key, 'input')}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: 'auto', minWidth: 80, flexShrink: 0 }}
                          >
                            <Option value="simple">简单类型</Option>
                            <Option value="struct">结构体</Option>
                          </Select>
                        )}
                        {readOnly && (
                          <span style={{ fontSize: 12, color: 'var(--theme-textSecondary, #595959)', flexShrink: 0 }}>
                            {item.schemaType === 'simple' ? '简单类型' : '结构体'}
                          </span>
                        )}
                        <Input
                          size="small"
                          value={item.description || ''}
                          onChange={(e) => handleInputChange(item.key, 'description', e.target.value)}
                          placeholder="参数说明（可选）"
                          disabled={readOnly}
                          onClick={(e) => e.stopPropagation()}
                          style={{ flex: 1, minWidth: 0 }}
                          className="node-creator-input"
                        />
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
                            style={{ flexShrink: 0 }}
                          >
                            删除
                          </Button>
                        )}
                      </div>
                    ),
                    children: (
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {renderSchemaConfig(
                          item,
                          'input',
                          handleAddInputSchemaField,
                          handleRemoveInputSchemaField,
                          handleInputSchemaFieldChange
                        )}
                      </Space>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                        <Input
                          size="small"
                          value={item.name}
                          onChange={(e) => handleOutputChange(item.key, 'name', e.target.value)}
                          placeholder="输出名称"
                          disabled={readOnly}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: 150, flexShrink: 0 }}
                          className="node-creator-input"
                        />
                        <div onClick={(e) => e.stopPropagation()}>
                          <Switch
                            checked={item.isStreaming}
                            onChange={(checked) => handleOutputChange(item.key, 'isStreaming', checked)}
                            disabled={readOnly}
                          />
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--theme-textSecondary, #595959)', flexShrink: 0 }}>
                          {item.isStreaming ? '流式' : '非流式'}
                        </span>
                        {!readOnly && (
                          <Select
                            size="small"
                            value={item.schemaType}
                            onChange={(value) => handleToggleSchemaType(item.key, 'output')}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: 'auto', minWidth: 80, flexShrink: 0 }}
                          >
                            <Option value="simple">简单类型</Option>
                            <Option value="struct">结构体</Option>
                          </Select>
                        )}
                        {readOnly && (
                          <span style={{ fontSize: 12, color: 'var(--theme-textSecondary, #595959)', flexShrink: 0 }}>
                            {item.schemaType === 'simple' ? '简单类型' : '结构体'}
                          </span>
                        )}
                        <Input
                          size="small"
                          value={item.description || ''}
                          onChange={(e) => handleOutputChange(item.key, 'description', e.target.value)}
                          placeholder="参数说明（可选）"
                          disabled={readOnly}
                          onClick={(e) => e.stopPropagation()}
                          style={{ flex: 1, minWidth: 0 }}
                          className="node-creator-input"
                        />
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
                            style={{ flexShrink: 0 }}
                          >
                            删除
                          </Button>
                        )}
                      </div>
                    ),
                    children: (
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {renderSchemaConfig(
                          item,
                          'output',
                          handleAddOutputSchemaField,
                          handleRemoveOutputSchemaField,
                          handleOutputSchemaFieldChange
                        )}
                      </Space>
                    ),
                  }))}
                />
              )}
            </Space>
            ),
          },
          {
            key: 'config',
            label: '配置参数',
            children: (
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--theme-textSecondary, #595959)' }}>
                  Schema 字段 ({configParams.length})
                </span>
                {!readOnly && (
                  <Button
                    type="dashed"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={handleAddConfigParamField}
                  >
                    添加字段
                  </Button>
                )}
              </div>
              {configParams.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--theme-textTertiary, #8c8c8c)' }}>
                  暂无字段，点击上方按钮添加
                </div>
              ) : (
                <Table
                  size="small"
                  dataSource={configParams.map((field, index) => ({ ...field, index }))}
                  rowKey="index"
                  pagination={false}
                  columns={[
                    {
                      title: '字段名',
                      key: 'fieldName',
                      width: 150,
                      render: (_: any, record: any) => (
                        <Input
                          value={record.fieldName}
                          onChange={(e) => handleConfigParamFieldChange(record.index, 'fieldName', e.target.value)}
                          placeholder="字段名"
                          disabled={readOnly}
                          className="node-creator-schema-input"
                        />
                      ),
                    },
                    {
                      title: '类型',
                      key: 'type',
                      width: 120,
                      render: (_: any, record: any) => (
                        <Select
                          value={record.type}
                          onChange={(value) => handleConfigParamFieldChange(record.index, 'type', value)}
                          disabled={readOnly}
                          style={{ width: '100%' }}
                        >
                          <Option value="string">string</Option>
                          <Option value="integer">integer</Option>
                          <Option value="float">float</Option>
                          <Option value="boolean">boolean</Option>
                          <Option value="bytes">bytes</Option>
                          <Option value="dict">dict</Option>
                          <Option value="list">list</Option>
                          <Option value="any">any</Option>
                        </Select>
                      ),
                    },
                    {
                      title: '必传',
                      key: 'required',
                      width: 80,
                      align: 'center',
                      render: (_: any, record: any) => (
                        <Switch
                          checked={record.required}
                          onChange={(checked) => handleConfigParamFieldChange(record.index, 'required', checked)}
                          disabled={readOnly}
                        />
                      ),
                    },
                    {
                      title: '说明',
                      key: 'description',
                      render: (_: any, record: any) => (
                        <Input
                          value={record.description || ''}
                          onChange={(e) => handleConfigParamFieldChange(record.index, 'description', e.target.value)}
                          placeholder="字段说明"
                          disabled={readOnly}
                          className="node-creator-schema-input"
                        />
                      ),
                    },
                    {
                      title: '默认值',
                      key: 'default',
                      width: 200,
                      render: (_: any, record: any) => (
                        <Input
                          value={record.default !== undefined ? String(record.default) : ''}
                          onChange={(e) => handleConfigParamFieldChange(record.index, 'default', e.target.value)}
                          placeholder="默认值"
                          disabled={readOnly}
                          className="node-creator-schema-input"
                        />
                      ),
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
                          onClick={() => handleRemoveConfigParamField(record.index)}
                        />
                      ),
                    }])
                  ]}
                />
              )}
            </Space>
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

