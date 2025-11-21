import React, { useEffect, useState, useMemo, useRef } from 'react'
import { Card, Form, Input, Button, Empty, Tabs, message, Typography, Tag, Alert } from 'antd'
import { useWorkflowStore } from '@/stores/workflowStore'
import { useNodeInfoStore } from '@/stores/nodeInfoStore'
import { useThemeStore } from '@/stores/themeStore'
import { nodeApi } from '@/services/api'
import Editor from '@monaco-editor/react'
import { YamlService } from '@/services/yamlService'
import NodeCreatorModal from '@/components/NodeCreator'
import ConfigEditor from '@/components/ConfigEditor'
import { WorkflowValidator } from '@/utils/validators'
import './NodeConfigPanel.css'

const { Text } = Typography

interface NodeConfigPanelProps {
  nodeId: string | null
  edgeId?: string | null
}

const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({ nodeId, edgeId }) => {
  const { nodes, edges, updateNodeData, updateNodeId } = useWorkflowStore()
  const { nodeTypes, customNodeDetails, getNodeDescription, isCustomNode: checkIsCustomNode, setCustomNodeDetails, setNodeTypes } = useNodeInfoStore()
  const { theme } = useThemeStore()
  const [form] = Form.useForm()
  const [yamlContent, setYamlContent] = useState('')
  const [isCustomNode, setIsCustomNode] = useState(false)
  const [nodeCreatorVisible, setNodeCreatorVisible] = useState(false)
  const [instanceCount, setInstanceCount] = useState(0)
  const [nodeDescription, setNodeDescription] = useState<string>('')
  const [configParams, setConfigParams] = useState<Record<string, any> | undefined>(undefined)
  
  // 根据主题确定Monaco Editor的主题
  const editorTheme = theme === 'dark' ? 'vs-dark' : 'vs'

  const node = nodes.find((n) => n.id === nodeId)
  const nodeType = node?.data?.type || node?.type
  const edge = edgeId ? edges.find((e) => e.id === edgeId) : null
  
  const prevNodeIdRef = useRef<string | null>(null)
  const configParamsRef = useRef<Record<string, any> | undefined>(undefined)

  // 计算连接线的详细信息
  const connectionInfo = useMemo(() => {
    if (!edge) return null

    const sourceNode = nodes.find((n) => n.id === edge.source)
    const targetNode = nodes.find((n) => n.id === edge.target)

    if (!sourceNode || !targetNode) return null

    const sourceHandle = edge.sourceHandle || 'output'
    const targetHandle = edge.targetHandle || 'input'

    const sourceOutputParams = sourceNode.data?.outputParams || {}
    const targetInputParams = targetNode.data?.inputParams || {}

    const sourceParam = sourceOutputParams[sourceHandle]
    const targetParam = targetInputParams[targetHandle]

    const isValid = WorkflowValidator.validateConnection(edge, nodes)

    // 获取详细的验证错误信息
    let validationErrors: string[] = []
    if (!isValid) {
      if (!sourceParam) {
        validationErrors.push(`源节点 "${sourceNode.data?.label || sourceNode.id}" 的输出端口 "${sourceHandle}" 不存在`)
      } else if (!targetParam) {
        validationErrors.push(`目标节点 "${targetNode.data?.label || targetNode.id}" 的输入端口 "${targetHandle}" 不存在`)
      } else {
        const sourceSchema = sourceParam.schema || {}
        const targetSchema = targetParam.schema || {}
        const sourceSchemaKeys = Object.keys(sourceSchema)
        const targetSchemaKeys = Object.keys(targetSchema)

        if (sourceSchemaKeys.length === 0 && targetSchemaKeys.length > 0) {
          validationErrors.push('源端口 schema 为空，但目标端口需要字段')
        } else if (targetSchemaKeys.length === 0 && sourceSchemaKeys.length > 0) {
          validationErrors.push('目标端口 schema 为空，但源端口提供了字段')
        } else {
          // 检查缺失的字段和类型不匹配
          for (const [fieldName, fieldType] of Object.entries(targetSchema)) {
            if (!(fieldName in sourceSchema)) {
              validationErrors.push(`目标端口需要字段 "${fieldName}"，但源端口没有提供`)
            } else if (sourceSchema[fieldName] !== fieldType) {
              validationErrors.push(`字段 "${fieldName}" 类型不匹配：源端口为 "${sourceSchema[fieldName]}"，目标端口需要 "${fieldType}"`)
            }
          }
        }
      }
    }

    return {
      sourceNode,
      targetNode,
      sourceHandle,
      targetHandle,
      sourceParam,
      targetParam,
      isValid,
      validationErrors,
    }
  }, [edge, nodes])

  // 当选中连接线时，清除节点选中状态
  useEffect(() => {
    if (edgeId && nodeId) {
      // 如果同时有 edgeId 和 nodeId，优先显示连接线信息
      // 这里不需要清除 nodeId，因为 App.tsx 已经处理了
    }
  }, [edgeId, nodeId])

  const prevNodeTypeRef = useRef<string | null>(null)
  const fetchingRef = useRef<boolean>(false)

  useEffect(() => {
    let cancelled = false

    if (nodeType === prevNodeTypeRef.current && fetchingRef.current) {
      return
    }

    const checkNodeInfo = async () => {
      if (!nodeId || !nodeType) {
        setIsCustomNode(false)
        setInstanceCount(0)
        setNodeDescription('')
        prevNodeTypeRef.current = null
        fetchingRef.current = false
        return
      }

      const needFetchSchema = nodeType !== prevNodeTypeRef.current || !configParamsRef.current
      
      if (nodeType === prevNodeTypeRef.current && !needFetchSchema) {
        const currentNodes = useWorkflowStore.getState().nodes
        const cachedIsCustom = checkIsCustomNode(nodeType)
        const count = currentNodes.filter((n) => (n.data?.type || n.type) === nodeType).length
        if (!cancelled) {
          setInstanceCount(cachedIsCustom ? count : 0)
        }
        return
      }

      prevNodeTypeRef.current = nodeType
      fetchingRef.current = true

      const cachedDescription = getNodeDescription(nodeType)
      if (cachedDescription) {
        setNodeDescription(cachedDescription)
      }

      const cachedIsCustom = checkIsCustomNode(nodeType)
      setIsCustomNode(cachedIsCustom)

      const currentNodes = useWorkflowStore.getState().nodes
      const count = currentNodes.filter((n) => (n.data?.type || n.type) === nodeType).length
      if (!cancelled) {
        setInstanceCount(cachedIsCustom ? count : 0)
      }

      try {
        const schema = await nodeApi.getNodeSchema(nodeType)
        if (!cancelled && schema?.CONFIG_PARAMS) {
          configParamsRef.current = schema.CONFIG_PARAMS
          setConfigParams(schema.CONFIG_PARAMS)
        } else if (!cancelled) {
          configParamsRef.current = undefined
          setConfigParams(undefined)
        }
      } catch (error) {
        console.warn('获取节点schema失败:', error)
        if (!cancelled) {
          configParamsRef.current = undefined
          setConfigParams(undefined)
        }
      }

      try {
        if (!cachedDescription) {
          if (cachedIsCustom) {
            const currentCustomNodeDetails = useNodeInfoStore.getState().customNodeDetails
            const cachedCustomNodeDetails = currentCustomNodeDetails[nodeType]
            if (cachedCustomNodeDetails?.description) {
              if (!cancelled) {
                setNodeDescription(cachedCustomNodeDetails.description)
                fetchingRef.current = false
              }
            } else {
              try {
                const customNodeInfo = await nodeApi.getCustomNode(nodeType)
                if (cancelled) {
                  fetchingRef.current = false
                  return
                }
                
                setCustomNodeDetails(nodeType, customNodeInfo)
                
                if (customNodeInfo?.description && !cancelled) {
                  setNodeDescription(customNodeInfo.description)
                }
                fetchingRef.current = false
              } catch (error) {
                console.warn('获取自定义节点信息失败:', error)
                fetchingRef.current = false
              }
            }
          } else {
            const currentNodeTypes = useNodeInfoStore.getState().nodeTypes
            if (currentNodeTypes.length === 0) {
              try {
                const types = await nodeApi.getNodeTypes()
                if (cancelled) {
                  fetchingRef.current = false
                  return
                }
                
                setNodeTypes(types)
                const foundNodeType = types.find((nt: any) => nt.id === nodeType)
                if (!cancelled && foundNodeType?.description) {
                  setNodeDescription(foundNodeType.description)
                }
                fetchingRef.current = false
              } catch (error) {
                console.warn('获取节点类型列表失败:', error)
                fetchingRef.current = false
              }
            } else {
              const foundNodeType = currentNodeTypes.find((nt: any) => nt.id === nodeType)
              if (!cancelled && foundNodeType?.description) {
                setNodeDescription(foundNodeType.description)
              }
              fetchingRef.current = false
            }
          }
        } else {
          fetchingRef.current = false
        }
      } catch (error) {
        console.warn('检查节点信息失败:', error)
        fetchingRef.current = false
      }
    }

    checkNodeInfo()

    return () => {
      cancelled = true
      fetchingRef.current = false
    }
  }, [nodeId, nodeType, getNodeDescription, checkIsCustomNode, setCustomNodeDetails, setNodeTypes])

  useEffect(() => {
    const currentNodeId = node?.id || null
    const nodeChanged = prevNodeIdRef.current !== currentNodeId || prevNodeIdRef.current !== nodeId
    
    if (nodeChanged) {
      prevNodeIdRef.current = currentNodeId || nodeId
      
      if (node) {
        form.resetFields()
        form.setFieldsValue({
          id: node.id,
          type: node.data.type || node.type,
          label: node.data.label || node.id,
          config: node.data.config || {},
        })
        
        const nodeYaml = {
          id: node.id,
          type: node.data.type || node.type,
          name: node.data.label || node.id,
          config: node.data.config || {},
        }
        setYamlContent(YamlService.stringify({ workflow: { name: '', nodes: [nodeYaml] } }))
      } else {
        form.resetFields()
        setYamlContent('')
        configParamsRef.current = undefined
        setConfigParams(undefined)
      }
    }
  }, [node, nodeId, form])

  const handleFormChange = (_changedValues: any, allValues: any) => {
    if (node) {
      const config = allValues.config || {}
      updateNodeData(node.id, {
        label: allValues.label || node.data.label,
        config: config,
      })
    }
  }

  const handleSave = () => {
    form.validateFields().then((values) => {
      if (node) {
        const config = values.config || {}
        const newNodeId = values.id?.trim()
        
        if (newNodeId && newNodeId !== node.id) {
          const result = updateNodeId(node.id, newNodeId)
          if (!result.success) {
            message.error(result.error || '更新节点ID失败')
            form.setFieldsValue({ id: node.id })
            return
          }
          message.success('节点ID已更新，所有连接已同步更新')
          
          if (nodeId === node.id) {
            window.dispatchEvent(new CustomEvent('nodeIdUpdated', { 
              detail: { oldId: node.id, newId: newNodeId } 
            }))
          }
        }
        
        updateNodeData(newNodeId || node.id, {
          label: values.label || node.data.label,
          config: config,
        })
        
        if (!newNodeId || newNodeId === node.id) {
          message.success('配置已保存')
        }
      }
    }).catch((errorInfo) => {
      console.error('表单验证失败:', errorInfo)
    })
  }

  if (edgeId) {
    if (!connectionInfo) {
      return (
        <div className="node-config-panel">
          <Card 
            title={`连接信息: ${edge?.source || '未知'} → ${edge?.target || '未知'}`}
            size="small"
          >
            <Alert
              message="无法加载连接信息"
              description="可能的原因：连接的源节点或目标节点不存在，或连接数据无效"
              type="warning"
              showIcon
            />
          </Card>
        </div>
      )
    }

    const { sourceNode, targetNode, sourceHandle, targetHandle, sourceParam, targetParam, isValid, validationErrors } = connectionInfo

    return (
      <div className="node-config-panel">
        <Card 
          title={`连接信息: ${sourceNode.data?.label || sourceNode.id} → ${targetNode.data?.label || targetNode.id}`}
          size="small"
        >
          <div style={{ marginBottom: 16 }}>
            {isValid ? (
              <Alert message="连接有效" type="success" showIcon />
            ) : (
              <Alert
                message="连接参数不匹配"
                description={
                  <div>
                    {validationErrors.map((error, index) => (
                      <div key={index} style={{ marginTop: 4 }}>• {error}</div>
                    ))}
                  </div>
                }
                type="error"
                showIcon
              />
            )}
          </div>

          {/* 合并成一张表，三列布局：属性标签 | 源端口 | 目标端口 */}
          <div style={{ border: '1px solid var(--theme-borderSecondary, #d9d9d9)', borderRadius: 4 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--theme-border, #e8e8e8)' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 'bold', width: 100, background: 'var(--theme-backgroundSecondary, #fafafa)', borderRight: '1px solid var(--theme-border, #e8e8e8)', fontSize: 12, color: 'var(--theme-text, #262626)' }}>节点</td>
                  <td style={{ padding: '6px 8px', wordBreak: 'break-word', fontSize: 12, color: 'var(--theme-text, #262626)' }}>
                    <div>
                      <div style={{ color: 'var(--theme-primary, #1890ff)', fontWeight: 500, marginBottom: 2, fontSize: 11 }}>源端口</div>
                      {sourceNode.data?.label || sourceNode.id}
                    </div>
                  </td>
                  <td style={{ padding: '6px 8px', wordBreak: 'break-word', fontSize: 12, color: 'var(--theme-text, #262626)' }}>
                    <div>
                      <div style={{ color: '#52c41a', fontWeight: 500, marginBottom: 2, fontSize: 11 }}>目标端口</div>
                      {targetNode.data?.label || targetNode.id}
                    </div>
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--theme-border, #e8e8e8)' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 'bold', background: 'var(--theme-backgroundSecondary, #fafafa)', borderRight: '1px solid var(--theme-border, #e8e8e8)', fontSize: 12, color: 'var(--theme-text, #262626)' }}>节点类型</td>
                  <td style={{ padding: '6px 8px', wordBreak: 'break-word', fontSize: 12, color: 'var(--theme-text, #262626)' }}>{sourceNode.data?.type || sourceNode.type}</td>
                  <td style={{ padding: '6px 8px', wordBreak: 'break-word', fontSize: 12, color: 'var(--theme-text, #262626)' }}>{targetNode.data?.type || targetNode.type}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--theme-border, #e8e8e8)' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 'bold', background: 'var(--theme-backgroundSecondary, #fafafa)', borderRight: '1px solid var(--theme-border, #e8e8e8)', fontSize: 12, color: 'var(--theme-text, #262626)' }}>端口名称</td>
                  <td style={{ padding: '6px 8px', wordBreak: 'break-word', fontSize: 12, color: 'var(--theme-text, #262626)' }}>{sourceHandle}</td>
                  <td style={{ padding: '6px 8px', wordBreak: 'break-word', fontSize: 12, color: 'var(--theme-text, #262626)' }}>{targetHandle}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--theme-border, #e8e8e8)' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 'bold', background: 'var(--theme-backgroundSecondary, #fafafa)', borderRight: '1px solid var(--theme-border, #e8e8e8)', fontSize: 12, color: 'var(--theme-text, #262626)' }}>端口类型</td>
                  <td style={{ padding: '6px 8px', wordBreak: 'break-word', fontSize: 12 }}>{sourceParam?.isStreaming ? (
                      <Tag color="green">流式</Tag>
                    ) : (
                      <Tag color="default">非流式</Tag>
                    )}</td>
                  <td style={{ padding: '6px 8px', wordBreak: 'break-word', fontSize: 12 }}>{targetParam?.isStreaming ? (
                      <Tag color="green">流式</Tag>
                    ) : (
                      <Tag color="default">非流式</Tag>
                    )}</td>
                </tr>
                {(sourceParam?.description || targetParam?.description) && (
                  <tr style={{ borderBottom: '1px solid var(--theme-border, #e8e8e8)' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 'bold', background: 'var(--theme-backgroundSecondary, #fafafa)', borderRight: '1px solid var(--theme-border, #e8e8e8)', verticalAlign: 'top', fontSize: 12, color: 'var(--theme-text, #262626)' }}>参数说明</td>
                    <td style={{ padding: '6px 8px', wordBreak: 'break-word', verticalAlign: 'top', fontSize: 12, color: 'var(--theme-text, #262626)' }}>
                      {sourceParam?.description ? (
                        <div style={{ fontSize: 11, whiteSpace: 'pre-wrap' }}>{sourceParam.description}</div>
                      ) : (
                        <Text type="secondary" style={{ fontSize: 12 }}>-</Text>
                      )}
                    </td>
                    <td style={{ padding: '6px 8px', wordBreak: 'break-word', verticalAlign: 'top', fontSize: 12, color: 'var(--theme-text, #262626)' }}>
                      {targetParam?.description ? (
                        <div style={{ fontSize: 11, whiteSpace: 'pre-wrap' }}>{targetParam.description}</div>
                      ) : (
                        <Text type="secondary" style={{ fontSize: 12 }}>-</Text>
                      )}
                    </td>
                  </tr>
                )}
                <tr style={{ borderBottom: '1px solid var(--theme-border, #e8e8e8)' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 'bold', background: 'var(--theme-backgroundSecondary, #fafafa)', borderRight: '1px solid var(--theme-border, #e8e8e8)', verticalAlign: 'top', fontSize: 12, color: 'var(--theme-text, #262626)' }}>Schema</td>
                  <td style={{ padding: '6px 8px', wordBreak: 'break-word', verticalAlign: 'top', fontSize: 12, color: 'var(--theme-text, #262626)' }}>
                    {sourceParam ? (
                      <div style={{ 
                        fontSize: 11, 
                        maxHeight: 200, 
                        overflowY: 'auto',
                        overflowX: 'visible',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                        color: 'var(--theme-text, #262626)'
                      }}>
                        {JSON.stringify(sourceParam.schema || {}, null, 2)}
                      </div>
                    ) : (
                      <Text type="danger" style={{ fontSize: 12 }}>端口不存在</Text>
                    )}
                  </td>
                  <td style={{ padding: '6px 8px', wordBreak: 'break-word', verticalAlign: 'top', fontSize: 12, color: 'var(--theme-text, #262626)' }}>
                    {targetParam ? (
                      <div style={{ 
                        fontSize: 11, 
                        maxHeight: 200, 
                        overflowY: 'auto',
                        overflowX: 'visible',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                        color: 'var(--theme-text, #262626)'
                      }}>
                        {JSON.stringify(targetParam.schema || {}, null, 2)}
                      </div>
                    ) : (
                      <Text type="danger" style={{ fontSize: 12 }}>端口不存在</Text>
                    )}
                  </td>
                </tr>
                {sourceParam && targetParam && Object.keys(sourceParam.schema || {}).length > 0 && (
                  <tr>
                    <td style={{ padding: '6px 8px', fontWeight: 'bold', background: 'var(--theme-backgroundSecondary, #fafafa)', borderRight: '1px solid var(--theme-border, #e8e8e8)', fontSize: 12, color: 'var(--theme-text, #262626)' }}>字段对比</td>
                    <td style={{ padding: '6px 8px', wordBreak: 'break-word', fontSize: 12 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {Object.entries(sourceParam.schema || {}).map(([key, value]) => (
                          <Tag key={key} style={{ margin: 0, background: 'var(--theme-backgroundTertiary, #f5f5f5)', color: 'var(--theme-text, #262626)', borderColor: 'var(--theme-border, #e8e8e8)' }}>
                            {key}: {String(value)}
                          </Tag>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '6px 8px', wordBreak: 'break-word', fontSize: 12 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {Object.entries(targetParam.schema || {}).map(([key, value]) => {
                          const sourceValue = sourceParam.schema?.[key]
                          const matches = sourceValue === value
                          return (
                            <Tag 
                              key={key} 
                              color={matches ? undefined : 'red'} 
                              style={{ margin: 0 }}
                            >
                              {key}: {String(value)}
                            </Tag>
                          )
                        })}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    )
  }

  if (!node) {
    return (
      <div className="node-config-panel">
        <Empty description="请选择一个节点或连接线进行查看" />
      </div>
    )
  }

  const handleNodeCreatorSuccess = () => {
    message.success('节点定义已更新，所有实例已同步')
    setNodeCreatorVisible(false)
    window.dispatchEvent(new CustomEvent('nodeCreated'))
  }

  return (
    <div className="node-config-panel">
      <Card 
        title={`节点配置: ${node.data.label || node.id}`}
        size="small"
        className="node-config-card"
      >
        <Tabs
          defaultActiveKey="info"
          items={[
            {
              key: 'info',
              label: '信息',
              children: (
                <>
                  <Form
                    form={form}
                    layout="vertical"
                    onValuesChange={handleFormChange}
                    onFinish={handleSave}
                  >
                    <Form.Item 
                      label="节点ID" 
                      name="id"
                      rules={[
                        { required: true, message: '请输入节点ID' },
                        { 
                          pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/, 
                          message: '节点ID只能包含字母、数字和下划线，且不能以数字开头' 
                        },
                        {
                          validator: async (_, value) => {
                            if (!value || value === node.id) {
                              return Promise.resolve()
                            }
                            const { nodes: currentNodes } = useWorkflowStore.getState()
                            if (currentNodes.some((n) => n.id === value && n.id !== node.id)) {
                              return Promise.reject(new Error(`节点ID "${value}" 已存在，请使用其他ID`))
                            }
                            return Promise.resolve()
                          }
                        }
                      ]}
                    >
                      <Input 
                        placeholder="输入节点ID" 
                        onBlur={(e) => {
                          // 失焦时，如果值未改变，恢复原值
                          const value = e.target.value.trim()
                          if (!value || value === node.id) {
                            form.setFieldsValue({ id: node.id })
                          }
                        }}
                      />
                    </Form.Item>
                    <Form.Item label="节点类型" name="type">
                      <Input disabled value={node.data.type || node.type} />
                    </Form.Item>
                    <Form.Item label="节点名称" name="label">
                      <Input 
                        placeholder="输入节点名称" 
                      />
                    </Form.Item>
                    <Form.Item label="节点配置" name="config">
                      <ConfigEditor
                        placeholder="输入节点配置（JSON格式）"
                        configParams={configParams}
                        onChange={(config) => {
                          form.setFieldsValue({ config })
                          updateNodeData(node.id, { config })
                        }}
                      />
                    </Form.Item>
                    <Form.Item>
                      <Button type="primary" htmlType="submit" block>
                        保存配置
                      </Button>
                    </Form.Item>
                  </Form>
                  {/* 节点说明区域 */}
                  {nodeDescription && (
                    <div style={{ 
                      marginTop: 24, 
                      padding: '16px', 
                      background: 'var(--theme-backgroundTertiary)', 
                      borderRadius: '4px',
                      border: '1px solid var(--theme-border)'
                    }}>
                      <div 
                        style={{ 
                          fontSize: '12px',
                          marginBottom: 0,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          color: 'var(--theme-textSecondary)',
                          lineHeight: 1.6
                        }}
                      >
                        {nodeDescription}
                      </div>
                    </div>
                  )}
                </>
              ),
            },
            {
              key: 'yaml',
              label: 'YAML',
              children: (
                <div className="yaml-editor-container">
                  <Editor
                    height="400px"
                    language="yaml"
                    value={yamlContent}
                    onChange={(value) => setYamlContent(value || '')}
                    theme={editorTheme}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 12,
                      wordWrap: 'on',
                      readOnly: true,
                    }}
                  />
                </div>
              ),
            },
            {
              key: 'node',
              label: '节点',
              children: (
                <div style={{ padding: '20px' }}>
                  {isCustomNode && instanceCount > 0 && (
                    <div style={{ marginBottom: 16, padding: 12, background: 'var(--theme-backgroundTertiary)', borderRadius: 4 }}>
                      <Text>
                        工作流中有 <Text strong style={{ color: 'var(--theme-primary)' }}>{instanceCount}</Text> 个该节点类型的实例
                      </Text>
                    </div>
                  )}
                  <div style={{ textAlign: 'center' }}>
                    <Button 
                      type="primary" 
                      onClick={() => {
                        const nodeType = node.data.type || node.type
                        if (nodeType) {
                          setNodeCreatorVisible(true)
                        }
                      }}
                    >
                      查看节点详细信息
                    </Button>
                  </div>
                </div>
              ),
            },
          ]}
        />
      </Card>
      <NodeCreatorModal
        visible={nodeCreatorVisible}
        onCancel={() => setNodeCreatorVisible(false)}
        onSuccess={handleNodeCreatorSuccess}
        editingNodeId={isCustomNode ? (node?.data.type || node?.type || undefined) : undefined}
        readOnly={!isCustomNode}
        viewingNodeId={!isCustomNode ? (node?.data.type || node?.type || undefined) : undefined}
      />
    </div>
  )
}

export default NodeConfigPanel

