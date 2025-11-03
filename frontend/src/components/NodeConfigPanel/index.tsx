import React, { useEffect, useState, useMemo } from 'react'
import { Card, Form, Input, Button, Empty, Tabs, message, Typography, Tag, Alert } from 'antd'
import { useWorkflowStore } from '@/stores/workflowStore'
import { nodeApi } from '@/services/api'
import Editor from '@monaco-editor/react'
import { YamlService } from '@/services/yamlService'
import NodeCreatorModal from '@/components/NodeCreator'
import { WorkflowValidator } from '@/utils/validators'
import './NodeConfigPanel.css'

const { TextArea } = Input
const { Text } = Typography

interface NodeConfigPanelProps {
  nodeId: string | null
  edgeId?: string | null
}

const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({ nodeId, edgeId }) => {
  const { nodes, edges, updateNodeData } = useWorkflowStore()
  const [form] = Form.useForm()
  const [yamlContent, setYamlContent] = useState('')
  const [isCustomNode, setIsCustomNode] = useState(false)
  const [nodeCreatorVisible, setNodeCreatorVisible] = useState(false)
  const [instanceCount, setInstanceCount] = useState(0)

  const node = nodes.find((n) => n.id === nodeId)
  const nodeType = node?.data?.type || node?.type
  const edge = edgeId ? edges.find((e) => e.id === edgeId) : null

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

  // 检查节点是否为自定义节点，并统计实例数量
  useEffect(() => {
    // 使用 ref 标记，避免重复调用
    let cancelled = false

    const checkIsCustomNode = async () => {
      if (!nodeId || !nodeType) {
        setIsCustomNode(false)
        setInstanceCount(0)
        return
      }

      try {
        // 尝试获取自定义节点列表
        const customNodesResponse = await nodeApi.getCustomNodes()
        if (cancelled) return
        
        const customNodes = customNodesResponse.nodes || []
        const isCustom = customNodes.some((n: any) => n.id === nodeType)
        setIsCustomNode(isCustom)
        
        // 统计使用该节点类型的实例数量 - 从 store 获取最新值，而不是依赖 props
        if (isCustom) {
          const currentNodes = useWorkflowStore.getState().nodes
          const count = currentNodes.filter((n) => (n.data?.type || n.type) === nodeType).length
          if (!cancelled) {
            setInstanceCount(count)
          }
        } else {
          if (!cancelled) {
            setInstanceCount(0)
          }
        }
      } catch (error) {
        // 如果获取失败，假设不是自定义节点
        if (!cancelled) {
          setIsCustomNode(false)
          setInstanceCount(0)
        }
      }
    }

    checkIsCustomNode()

    return () => {
      cancelled = true
    }
  }, [nodeId, nodeType]) // 只依赖 nodeId 和 nodeType，不依赖整个 nodes 数组

  useEffect(() => {
    if (node) {
      // 设置表单值
      form.setFieldsValue({
        id: node.id,
        type: node.data.type || node.type,
        label: node.data.label || node.id,
        config: JSON.stringify(node.data.config || {}, null, 2),
      })
      
      // 生成当前节点的 YAML 片段
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
    }
  }, [node, form])

  const handleFormChange = (_changedValues: any, allValues: any) => {
    if (node) {
      // 解析 config JSON
      let config = {}
      try {
        if (allValues.config) {
          config = JSON.parse(allValues.config)
        }
      } catch {
        // 如果 JSON 无效，保持原配置
        config = node.data.config || {}
      }
      
      updateNodeData(node.id, {
        label: allValues.label || node.data.label,
        config: config,
      })
    }
  }

  const handleSave = () => {
    form.validateFields().then((values) => {
      if (node) {
        let config = {}
        try {
          if (values.config) {
            config = JSON.parse(values.config)
          }
        } catch (e) {
          message.error('配置 JSON 格式错误')
          return
        }
        
        updateNodeData(node.id, {
          label: values.label || node.data.label,
          config: config,
        })
        message.success('配置已保存')
      }
    })
  }

  // 如果选中了连接线，显示连接线信息
  if (edgeId) {
    // 如果 connectionInfo 为 null，可能是找不到节点，但仍应显示基本信息
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
          <div style={{ border: '1px solid #d9d9d9', borderRadius: 4 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 'bold', width: 100, background: '#fafafa', borderRight: '1px solid #f0f0f0' }}>节点</td>
                  <td style={{ padding: '8px 12px', wordBreak: 'break-word' }}>
                    <div>
                      <div style={{ color: '#1890ff', fontWeight: 500, marginBottom: 4 }}>源端口</div>
                      {sourceNode.data?.label || sourceNode.id}
                    </div>
                  </td>
                  <td style={{ padding: '8px 12px', wordBreak: 'break-word' }}>
                    <div>
                      <div style={{ color: '#52c41a', fontWeight: 500, marginBottom: 4 }}>目标端口</div>
                      {targetNode.data?.label || targetNode.id}
                    </div>
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 'bold', background: '#fafafa', borderRight: '1px solid #f0f0f0' }}>节点类型</td>
                  <td style={{ padding: '8px 12px', wordBreak: 'break-word' }}>{sourceNode.data?.type || sourceNode.type}</td>
                  <td style={{ padding: '8px 12px', wordBreak: 'break-word' }}>{targetNode.data?.type || targetNode.type}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 'bold', background: '#fafafa', borderRight: '1px solid #f0f0f0' }}>端口名称</td>
                  <td style={{ padding: '8px 12px', wordBreak: 'break-word' }}>{sourceHandle}</td>
                  <td style={{ padding: '8px 12px', wordBreak: 'break-word' }}>{targetHandle}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 'bold', background: '#fafafa', borderRight: '1px solid #f0f0f0' }}>端口类型</td>
                  <td style={{ padding: '8px 12px', wordBreak: 'break-word' }}>
                    {sourceParam?.isStreaming ? (
                      <Tag color="green">流式</Tag>
                    ) : (
                      <Tag color="default">非流式</Tag>
                    )}
                  </td>
                  <td style={{ padding: '8px 12px', wordBreak: 'break-word' }}>
                    {targetParam?.isStreaming ? (
                      <Tag color="green">流式</Tag>
                    ) : (
                      <Tag color="default">非流式</Tag>
                    )}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 'bold', background: '#fafafa', borderRight: '1px solid #f0f0f0', verticalAlign: 'top' }}>Schema</td>
                  <td style={{ padding: '8px 12px', wordBreak: 'break-word', verticalAlign: 'top' }}>
                    {sourceParam ? (
                      <div style={{ 
                        fontSize: 12, 
                        maxHeight: 200, 
                        overflowY: 'auto',
                        overflowX: 'visible',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {JSON.stringify(sourceParam.schema || {}, null, 2)}
                      </div>
                    ) : (
                      <Text type="danger">端口不存在</Text>
                    )}
                  </td>
                  <td style={{ padding: '8px 12px', wordBreak: 'break-word', verticalAlign: 'top' }}>
                    {targetParam ? (
                      <div style={{ 
                        fontSize: 12, 
                        maxHeight: 200, 
                        overflowY: 'auto',
                        overflowX: 'visible',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {JSON.stringify(targetParam.schema || {}, null, 2)}
                      </div>
                    ) : (
                      <Text type="danger">端口不存在</Text>
                    )}
                  </td>
                </tr>
                {sourceParam && targetParam && Object.keys(sourceParam.schema || {}).length > 0 && (
                  <tr>
                    <td style={{ padding: '8px 12px', fontWeight: 'bold', background: '#fafafa', borderRight: '1px solid #f0f0f0' }}>字段对比</td>
                    <td style={{ padding: '8px 12px', wordBreak: 'break-word' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {Object.entries(sourceParam.schema || {}).map(([key, value]) => (
                          <Tag key={key} style={{ margin: 0 }}>
                            {key}: {String(value)}
                          </Tag>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '8px 12px', wordBreak: 'break-word' }}>
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

  // 如果没有选中连接线，显示节点信息
  if (!node) {
    return (
      <div className="node-config-panel">
        <Empty description="请选择一个节点或连接线进行查看" />
      </div>
    )
  }

  const handleNodeCreatorSuccess = () => {
    // 节点定义已更新，所有实例已自动同步更新
    message.success('节点定义已更新，所有实例已同步')
    setNodeCreatorVisible(false)
    // 触发节点列表刷新事件
    window.dispatchEvent(new CustomEvent('nodeCreated'))
  }

  return (
    <div className="node-config-panel">
      <Card 
        title={`节点配置: ${node.data.label || node.id}`}
        size="small"
      >
        <Tabs
          defaultActiveKey="info"
          items={[
            {
              key: 'info',
              label: '信息',
              children: (
                <Form
                  form={form}
                  layout="vertical"
                  onValuesChange={handleFormChange}
                  onFinish={handleSave}
                >
                  <Form.Item label="节点ID" name="id">
                    <Input disabled value={node.id} />
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
                    <TextArea 
                      rows={8} 
                      placeholder="输入节点配置（JSON格式）"
                      onChange={(e) => {
                        try {
                          const config = JSON.parse(e.target.value)
                          updateNodeData(node.id, { config })
                        } catch {
                          // 忽略 JSON 解析错误，允许用户继续编辑
                        }
                      }}
                    />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" block>
                      保存配置
                    </Button>
                  </Form.Item>
                </Form>
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
                    <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
                      <Text>
                        工作流中有 <Text strong style={{ color: '#1890ff' }}>{instanceCount}</Text> 个该节点类型的实例
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

