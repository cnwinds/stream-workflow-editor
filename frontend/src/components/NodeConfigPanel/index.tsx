import React, { useEffect, useState } from 'react'
import { Card, Form, Input, Button, Empty, Tabs, message, Typography } from 'antd'
import { useWorkflowStore } from '@/stores/workflowStore'
import { nodeApi } from '@/services/api'
import Editor from '@monaco-editor/react'
import { YamlService } from '@/services/yamlService'
import NodeCreatorModal from '@/components/NodeCreator'
import './NodeConfigPanel.css'

const { TextArea } = Input
const { Text } = Typography

interface NodeConfigPanelProps {
  nodeId: string | null
}

const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({ nodeId }) => {
  const { nodes, updateNodeData } = useWorkflowStore()
  const [form] = Form.useForm()
  const [yamlContent, setYamlContent] = useState('')
  const [isCustomNode, setIsCustomNode] = useState(false)
  const [nodeCreatorVisible, setNodeCreatorVisible] = useState(false)
  const [instanceCount, setInstanceCount] = useState(0)

  const node = nodes.find((n) => n.id === nodeId)

  // 检查节点是否为自定义节点，并统计实例数量
  useEffect(() => {
    const checkIsCustomNode = async () => {
      if (!node) {
        setIsCustomNode(false)
        setInstanceCount(0)
        return
      }

      const nodeType = node.data.type || node.type
      if (!nodeType) {
        setIsCustomNode(false)
        setInstanceCount(0)
        return
      }

      try {
        // 尝试获取自定义节点列表
        const customNodesResponse = await nodeApi.getCustomNodes()
        const customNodes = customNodesResponse.nodes || []
        const isCustom = customNodes.some((n: any) => n.id === nodeType)
        setIsCustomNode(isCustom)
        
        // 统计使用该节点类型的实例数量
        if (isCustom) {
          const count = nodes.filter((n) => (n.data?.type || n.type) === nodeType).length
          setInstanceCount(count)
        } else {
          setInstanceCount(0)
        }
      } catch (error) {
        // 如果获取失败，假设不是自定义节点
        setIsCustomNode(false)
        setInstanceCount(0)
      }
    }

    checkIsCustomNode()
  }, [node, nodes])

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

  const handleFormChange = (changedValues: any, allValues: any) => {
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

  if (!node) {
    return (
      <div className="node-config-panel">
        <Empty description="请选择一个节点进行配置" />
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

