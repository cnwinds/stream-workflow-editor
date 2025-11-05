import React, { useState } from 'react'
import { Button, Space, Upload, message, Modal, Input, Select } from 'antd'
import {
  SaveOutlined,
  FolderOpenOutlined,
  DownloadOutlined,
  UploadOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  CopyOutlined,
  BgColorsOutlined,
} from '@ant-design/icons'
import { useThemeStore, ThemeMode } from '@/stores/themeStore'
import { useWorkflowStore } from '@/stores/workflowStore'
import { validationApi, fileApi } from '@/services/api'
import { YamlService } from '@/services/yamlService'
import NodeCreatorModal from '@/components/NodeCreator'
import FileManager from '@/components/FileManager'
import './Toolbar.css'

const Toolbar: React.FC = () => {
  const { loadWorkflow, exportWorkflow, currentFileName, setCurrentFileName } = useWorkflowStore()
  const { theme, setTheme } = useThemeStore()
  const [loading, setLoading] = useState(false)
  const [nodeCreatorVisible, setNodeCreatorVisible] = useState(false)
  const [fileManagerVisible, setFileManagerVisible] = useState(false)
  const [saveAsVisible, setSaveAsVisible] = useState(false)
  const [saveAsFileName, setSaveAsFileName] = useState('')

  const themeOptions: { label: string; value: ThemeMode }[] = [
    { label: '明亮', value: 'light' },
    { label: '护眼', value: 'eye-care' },
    { label: '暗色', value: 'dark' },
  ]

  const handleNodeCreatorSuccess = () => {
    // 节点创建成功后，触发事件通知 NodePalette 刷新节点列表
    window.dispatchEvent(new CustomEvent('nodeCreated'))
    message.success('节点创建成功，节点列表已更新')
  }

  const handleSave = async () => {
    try {
      setLoading(true)
      const config = exportWorkflow()
      
      if (currentFileName) {
        // 保存到已有文件
        await fileApi.updateFile(currentFileName, config, true)
        message.success('文件保存成功')
      } else {
        // 如果没有文件名，弹出另存为对话框
        setSaveAsVisible(true)
        setSaveAsFileName('')
      }
    } catch (error) {
      message.error('保存失败: ' + (error instanceof Error ? error.message : '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  const handleSaveAs = async () => {
    if (!saveAsFileName.trim()) {
      message.warning('请输入文件名')
      return
    }

    // 确保文件扩展名
    let finalFileName = saveAsFileName.trim()
    if (!finalFileName.endsWith('.yaml') && !finalFileName.endsWith('.yml')) {
      finalFileName += '.yaml'
    }

    try {
      setLoading(true)
      const config = exportWorkflow()
      
      if (currentFileName === finalFileName) {
        // 如果是同名文件，直接更新
        await fileApi.updateFile(finalFileName, config, true)
      } else {
        // 创建新文件
        await fileApi.createFile(finalFileName, config)
        setCurrentFileName(finalFileName)
      }
      
      message.success('文件保存成功')
      setSaveAsVisible(false)
      setSaveAsFileName('')
    } catch (error: any) {
      if (error.response?.status === 409) {
        Modal.confirm({
          title: '文件已存在',
          content: `文件 "${finalFileName}" 已存在，是否覆盖？`,
          onOk: async () => {
            try {
              const config = exportWorkflow()
              await fileApi.updateFile(finalFileName, config, true)
              setCurrentFileName(finalFileName)
              message.success('文件保存成功')
              setSaveAsVisible(false)
              setSaveAsFileName('')
            } catch (err) {
              message.error('保存失败: ' + (err instanceof Error ? err.message : '未知错误'))
            }
          },
        })
      } else {
        message.error('保存失败: ' + (error instanceof Error ? error.message : '未知错误'))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleOpenFile = (filename: string) => {
    setCurrentFileName(filename)
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
        setCurrentFileName(null) // 导入的文件未保存到服务器，清除文件名
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
          保存{currentFileName ? ` (${currentFileName})` : ''}
        </Button>
        <Button icon={<CopyOutlined />} onClick={() => {
          setSaveAsVisible(true)
          setSaveAsFileName(currentFileName || '')
        }}>
          另存为
        </Button>
        <Button icon={<FolderOpenOutlined />} onClick={() => setFileManagerVisible(true)}>
          打开
        </Button>
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
        <Select
          value={theme}
          onChange={setTheme}
          style={{ width: 100 }}
          suffixIcon={<BgColorsOutlined />}
          options={themeOptions}
        />
      </Space>
      <NodeCreatorModal
        visible={nodeCreatorVisible}
        onCancel={() => setNodeCreatorVisible(false)}
        onSuccess={handleNodeCreatorSuccess}
      />
      <FileManager
        visible={fileManagerVisible}
        onClose={() => setFileManagerVisible(false)}
        onFileSelect={handleOpenFile}
      />
      <Modal
        title="另存为"
        open={saveAsVisible}
        onOk={handleSaveAs}
        onCancel={() => {
          setSaveAsVisible(false)
          setSaveAsFileName('')
        }}
        confirmLoading={loading}
      >
        <Input
          placeholder="输入文件名（如：my_workflow.yaml）"
          value={saveAsFileName}
          onChange={(e) => setSaveAsFileName(e.target.value)}
          onPressEnter={handleSaveAs}
          autoFocus
        />
      </Modal>
    </div>
  )
}

export default Toolbar

