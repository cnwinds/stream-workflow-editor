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
  Card,
  Collapse,
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
} from '@ant-design/icons'
import Editor from '@monaco-editor/react'
import { ParameterSchema, CreateNodeRequest } from '@/types/node'
import { nodeApi } from '@/services/api'
import { nodeGenerator } from '@/services/nodeGenerator'
import './NodeCreator.css'

const { TextArea } = Input
const { Option } = Select
const { TabPane } = Tabs
const { Panel } = Collapse

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
}

const NodeCreatorModal: React.FC<NodeCreatorModalProps> = ({
  visible,
  onCancel,
  onSuccess,
  editingNodeId,
}) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')
  const [inputs, setInputs] = useState<InputOutputItem[]>([])
  const [outputs, setOutputs] = useState<InputOutputItem[]>([])
  const [pythonCode, setPythonCode] = useState('')
  const [showCodeEditor, setShowCodeEditor] = useState(false)

  // 加载编辑节点的数据
  useEffect(() => {
    if (visible && editingNodeId) {
      loadNodeData(editingNodeId)
    } else if (visible) {
      // 重置表单
      form.resetFields()
      setInputs([])
      setOutputs([])
      setPythonCode('')
      setShowCodeEditor(false)
      setActiveTab('basic')
    }
  }, [visible, editingNodeId])

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
      setShowCodeEditor(true)
    } catch (error) {
      message.error('加载节点数据失败')
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
        message.error('输入参数名称不能重复')
        return
      }
      if (outputNames.length !== new Set(outputNames).size) {
        message.error('输出参数名称不能重复')
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
        message.error('输入参数名称不能重复')
        return
      }
      if (outputNames.length !== new Set(outputNames).size) {
        message.error('输出参数名称不能重复')
        return
      }

      const inputsDict = convertToDict(inputs)
      const outputsDict = convertToDict(outputs)

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
        pythonCode: showCodeEditor ? pythonCode : undefined,
      }

      if (editingNodeId) {
        await nodeApi.updateCustomNode(editingNodeId, pythonCode)
        message.success('节点更新成功')
      } else {
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
    isInput: boolean,
    onAddField: (key: string) => void,
    onRemoveField: (key: string, fieldName: string) => void,
    onFieldChange: (key: string, fieldName: string, field: 'name' | 'type', value: string) => void
  ) => {
    const schemaFields = Object.entries(item.schema)
    
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#666' }}>Schema字段 ({schemaFields.length})</span>
          <Button
            type="dashed"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => onAddField(item.key)}
          >
            添加字段
          </Button>
        </div>
        {schemaFields.length === 0 ? (
          <div style={{ padding: '8px 0', color: '#999', fontSize: 12, textAlign: 'center' }}>
            暂无字段（可选）
          </div>
        ) : (
          <Table
            size="small"
            dataSource={schemaFields.map(([fieldName, fieldType], idx) => ({
              key: `${item.key}_${fieldName}_${idx}`,
              fieldName,
              fieldType,
            }))}
            pagination={false}
            columns={[
              {
                title: '字段名',
                dataIndex: 'fieldName',
                key: 'fieldName',
                render: (text: string) => (
                  <Input
                    size="small"
                    value={text}
                    onChange={(e) => onFieldChange(item.key, text, 'name', e.target.value)}
                    placeholder="字段名"
                  />
                ),
              },
              {
                title: '类型',
                dataIndex: 'fieldType',
                key: 'fieldType',
                render: (text: string) => (
                  <Select
                    size="small"
                    value={text}
                    onChange={(value) => onFieldChange(item.key, text, 'type', value)}
                    style={{ width: '100%' }}
                  >
                    <Option value="string">string</Option>
                    <Option value="integer">integer</Option>
                    <Option value="float">float</Option>
                    <Option value="boolean">boolean</Option>
                    <Option value="object">object</Option>
                    <Option value="array">array</Option>
                  </Select>
                ),
              },
              {
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
              },
            ]}
          />
        )}
      </div>
    )
  }

  return (
    <Modal
      title={editingNodeId ? '编辑节点' : '创建节点'}
      open={visible}
      onCancel={onCancel}
      width={900}
      footer={[
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
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="基本信息" key="basic">
            <Form.Item
              name="nodeId"
              label="节点ID"
              rules={[
                { required: true, message: '请输入节点ID' },
                { pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/, message: '节点ID只能包含字母、数字和下划线，且不能以数字开头' },
              ]}
            >
              <Input disabled={!!editingNodeId} placeholder="例如: custom_text_process" />
            </Form.Item>

            <Form.Item name="name" label="节点名称" rules={[{ required: true, message: '请输入节点名称' }]}>
              <Input placeholder="例如: 文本处理器" />
            </Form.Item>

            <Form.Item name="description" label="节点描述">
              <TextArea rows={3} placeholder="描述节点的功能" />
            </Form.Item>

            <Form.Item name="category" label="分类" rules={[{ required: true, message: '请输入分类' }]}>
              <Input placeholder="例如: 数据处理.文本 (支持点分隔符进行树状分类)" />
            </Form.Item>

            <Form.Item
              name="executionMode"
              label="执行模式"
              rules={[{ required: true, message: '请选择执行模式' }]}
            >
              <Select>
                <Option value="sequential">顺序执行</Option>
                <Option value="streaming">流式处理</Option>
                <Option value="hybrid">混合模式</Option>
              </Select>
            </Form.Item>

            <Form.Item name="color" label="节点颜色" rules={[{ required: true, message: '请输入颜色' }]}>
              <Input type="color" style={{ width: 100 }} />
            </Form.Item>
          </TabPane>

          <TabPane tab="输入参数" key="inputs">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddInput} block>
                添加输入
              </Button>
              {inputs.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#999' }}>
                  暂无输入参数，点击上方按钮添加
                </div>
              ) : (
                <Collapse>
                  {inputs.map((item) => (
                    <Panel
                      key={item.key}
                      header={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Input
                            size="small"
                            value={item.name}
                            onChange={(e) => handleInputChange(item.key, 'name', e.target.value)}
                            placeholder="输入名称"
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: 200 }}
                          />
                          <Switch
                            checked={item.isStreaming}
                            onChange={(checked) => handleInputChange(item.key, 'isStreaming', checked)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span style={{ fontSize: 12, color: '#666' }}>
                            {item.isStreaming ? '流式' : '非流式'}
                          </span>
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
                        </div>
                      }
                    >
                      {renderSchemaFields(
                        item,
                        true,
                        handleAddInputSchemaField,
                        handleRemoveInputSchemaField,
                        handleInputSchemaFieldChange
                      )}
                    </Panel>
                  ))}
                </Collapse>
              )}
            </Space>
          </TabPane>

          <TabPane tab="输出参数" key="outputs">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddOutput} block>
                添加输出
              </Button>
              {outputs.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#999' }}>
                  暂无输出参数，点击上方按钮添加
                </div>
              ) : (
                <Collapse>
                  {outputs.map((item) => (
                    <Panel
                      key={item.key}
                      header={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Input
                            size="small"
                            value={item.name}
                            onChange={(e) => handleOutputChange(item.key, 'name', e.target.value)}
                            placeholder="输出名称"
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: 200 }}
                          />
                          <Switch
                            checked={item.isStreaming}
                            onChange={(checked) => handleOutputChange(item.key, 'isStreaming', checked)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span style={{ fontSize: 12, color: '#666' }}>
                            {item.isStreaming ? '流式' : '非流式'}
                          </span>
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
                        </div>
                      }
                    >
                      {renderSchemaFields(
                        item,
                        false,
                        handleAddOutputSchemaField,
                        handleRemoveOutputSchemaField,
                        handleOutputSchemaFieldChange
                      )}
                    </Panel>
                  ))}
                </Collapse>
              )}
            </Space>
          </TabPane>

          <TabPane tab="配置Schema" key="config">
            <Form.Item name="configSchema">
              <TextArea
                rows={10}
                placeholder='JSON格式，例如: { "operation": { "type": "string", "default": "uppercase" } }'
              />
            </Form.Item>
          </TabPane>

          {showCodeEditor && (
            <TabPane tab="Python代码" key="code">
              <Editor
                height="500px"
                language="python"
                value={pythonCode}
                onChange={(value) => setPythonCode(value || '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  wordWrap: 'on',
                }}
              />
            </TabPane>
          )}
        </Tabs>
      </Form>
    </Modal>
  )
}

export default NodeCreatorModal

