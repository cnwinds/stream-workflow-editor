import React, { useState } from 'react'
import { Button, Space, Upload, message, Modal } from 'antd'
import {
  SaveOutlined,
  FolderOpenOutlined,
  DownloadOutlined,
  UploadOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { useWorkflowStore } from '@/stores/workflowStore'
import { workflowApi, validationApi } from '@/services/api'
import { YamlService } from '@/services/yamlService'
import NodeCreatorModal from '@/components/NodeCreator'
import './Toolbar.css'

const Toolbar: React.FC = () => {
  const { nodes, edges, loadWorkflow, exportWorkflow } = useWorkflowStore()
  const [loading, setLoading] = useState(false)
  const [nodeCreatorVisible, setNodeCreatorVisible] = useState(false)

  const handleNodeCreatorSuccess = () => {
    // 节点创建成功后，触发事件通知 NodePalette 刷新节点列表
    window.dispatchEvent(new CustomEvent('nodeCreated'))
    message.success('节点创建成功，节点列表已更新')
  }

  const handleSave = async () => {
    try {
      setLoading(true)
      const config = exportWorkflow()
      await workflowApi.saveWorkflow(config)
      message.success('工作流保存成功')
    } catch (error) {
      message.error('保存失败: ' + (error instanceof Error ? error.message : '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    try {
      const config = exportWorkflow()
      const yaml = YamlService.stringify(config)
      const blob = new Blob([yaml], { type: 'text/yaml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${config.workflow.name || 'workflow'}.yaml`
      a.click()
      URL.revokeObjectURL(url)
      message.success('导出成功')
    } catch (error) {
      message.error('导出失败: ' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  const handleImport = (file: File) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string
        const config = YamlService.parse(content)
        await loadWorkflow(config)
        message.success('导入成功')
      } catch (error) {
        message.error('导入失败: ' + (error instanceof Error ? error.message : '未知错误'))
      }
    }
    reader.readAsText(file)
    return false
  }

  const handleValidate = async () => {
    try {
      setLoading(true)
      const config = exportWorkflow()
      const result = await validationApi.validate(config)
      if (result.valid) {
        message.success('工作流配置验证通过')
      } else {
        const errors = result.errors?.map((e) => e.message).join('\n') || '配置有误'
        Modal.error({
          title: '验证失败',
          content: errors,
        })
      }
    } catch (error) {
      message.error('验证失败: ' + (error instanceof Error ? error.message : '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="toolbar">
      <Space>
        <Button icon={<SaveOutlined />} onClick={handleSave} loading={loading}>
          保存
        </Button>
        <Button icon={<FolderOpenOutlined />}>打开</Button>
        <Upload
          accept=".yaml,.yml"
          showUploadList={false}
          beforeUpload={handleImport}
        >
          <Button icon={<UploadOutlined />}>导入</Button>
        </Upload>
        <Button icon={<DownloadOutlined />} onClick={handleExport}>
          导出
        </Button>
        <Button icon={<CheckCircleOutlined />} onClick={handleValidate} loading={loading}>
          验证
        </Button>
        <Button icon={<PlayCircleOutlined />} type="primary">
          执行
        </Button>
        <Button icon={<PlusOutlined />} onClick={() => setNodeCreatorVisible(true)}>
          创建节点
        </Button>
      </Space>
      <NodeCreatorModal
        visible={nodeCreatorVisible}
        onCancel={() => setNodeCreatorVisible(false)}
        onSuccess={handleNodeCreatorSuccess}
      />
    </div>
  )
}

export default Toolbar

