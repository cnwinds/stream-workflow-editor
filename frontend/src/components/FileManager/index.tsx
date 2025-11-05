import React, { useState, useEffect } from 'react'
import { Modal, List, Button, Input, message, Popconfirm, Space, Typography } from 'antd'
import {
  FileOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { fileApi, FileInfo } from '@/services/api'
import { useWorkflowStore } from '@/stores/workflowStore'
import './FileManager.css'

const { Text } = Typography

interface FileManagerProps {
  visible: boolean
  onClose: () => void
  onFileSelect?: (filename: string) => void
}

const FileManager: React.FC<FileManagerProps> = ({ visible, onClose, onFileSelect }) => {
  const [files, setFiles] = useState<FileInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [renamingFile, setRenamingFile] = useState<string | null>(null)
  const [newFileName, setNewFileName] = useState('')
  const [creatingFile, setCreatingFile] = useState(false)
  const { exportWorkflow, loadWorkflow, setCurrentFileName } = useWorkflowStore()

  // 加载文件列表
  const loadFiles = async () => {
    try {
      setLoading(true)
      const fileList = await fileApi.listFiles()
      setFiles(fileList)
    } catch (error) {
      message.error('加载文件列表失败: ' + (error instanceof Error ? error.message : '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (visible) {
      loadFiles()
    }
  }, [visible])

  // 打开文件
  const handleOpenFile = async (filename: string) => {
    try {
      setLoading(true)
      const config = await fileApi.readFile(filename)
      await loadWorkflow(config)
      setCurrentFileName(filename)
      message.success(`已加载文件: ${filename}`)
      if (onFileSelect) {
        onFileSelect(filename)
      }
      onClose()
    } catch (error) {
      message.error('打开文件失败: ' + (error instanceof Error ? error.message : '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  // 删除文件
  const handleDeleteFile = async (filename: string) => {
    try {
      await fileApi.deleteFile(filename)
      // 如果删除的是当前打开的文件，清除当前文件名
      const { currentFileName } = useWorkflowStore.getState()
      if (currentFileName === filename) {
        setCurrentFileName(null)
      }
      message.success('文件删除成功')
      loadFiles()
    } catch (error) {
      message.error('删除文件失败: ' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  // 开始重命名
  const handleStartRename = (filename: string) => {
    setRenamingFile(filename)
    setNewFileName(filename.replace(/\.(yaml|yml)$/, ''))
  }

  // 确认重命名
  const handleConfirmRename = async () => {
    if (!renamingFile || !newFileName.trim()) {
      message.warning('请输入文件名')
      return
    }

    // 确保文件扩展名
    let finalFileName = newFileName.trim()
    if (!finalFileName.endsWith('.yaml') && !finalFileName.endsWith('.yml')) {
      finalFileName += '.yaml'
    }

    try {
      await fileApi.renameFile(renamingFile, finalFileName)
      // 如果重命名的是当前打开的文件，更新当前文件名
      const { currentFileName } = useWorkflowStore.getState()
      if (currentFileName === renamingFile) {
        setCurrentFileName(finalFileName)
      }
      message.success('文件重命名成功')
      setRenamingFile(null)
      setNewFileName('')
      loadFiles()
    } catch (error) {
      message.error('重命名文件失败: ' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  // 取消重命名
  const handleCancelRename = () => {
    setRenamingFile(null)
    setNewFileName('')
  }

  // 创建新文件
  const handleCreateFile = async () => {
    if (!newFileName.trim()) {
      message.warning('请输入文件名')
      return
    }

    // 确保文件扩展名
    let finalFileName = newFileName.trim()
    if (!finalFileName.endsWith('.yaml') && !finalFileName.endsWith('.yml')) {
      finalFileName += '.yaml'
    }

    try {
      const config = exportWorkflow()
      await fileApi.createFile(finalFileName, config)
      setCurrentFileName(finalFileName)
      message.success('文件创建成功')
      setCreatingFile(false)
      setNewFileName('')
      loadFiles()
      if (onFileSelect) {
        onFileSelect(finalFileName)
      }
    } catch (error: any) {
      if (error.response?.status === 409) {
        message.error('文件已存在，请使用其他名称')
      } else {
        message.error('创建文件失败: ' + (error instanceof Error ? error.message : '未知错误'))
      }
    }
  }

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  // 格式化修改时间
  const formatModifiedTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleString('zh-CN')
  }

  return (
    <Modal
      title="文件管理"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
      className="file-manager-modal"
    >
      <div className="file-manager">
        <div className="file-manager-header">
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setCreatingFile(true)
                setNewFileName('')
              }}
            >
              新建文件
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadFiles} loading={loading}>
              刷新
            </Button>
          </Space>
        </div>

        {creatingFile && (
          <div className="file-manager-create">
            <Space>
              <Input
                placeholder="输入文件名（如：my_workflow.yaml）"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onPressEnter={handleCreateFile}
                autoFocus
              />
              <Button type="primary" onClick={handleCreateFile}>
                创建
              </Button>
              <Button onClick={() => {
                setCreatingFile(false)
                setNewFileName('')
              }}>
                取消
              </Button>
            </Space>
          </div>
        )}

        <List
          className="file-manager-list"
          loading={loading}
          dataSource={files}
          locale={{ emptyText: '暂无文件' }}
          renderItem={(file) => (
            <List.Item
              className="file-manager-item"
              actions={[
                renamingFile === file.filename ? (
                  <Space key="rename-actions">
                    <Input
                      size="small"
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      onPressEnter={handleConfirmRename}
                      style={{ width: 150 }}
                    />
                    <Button size="small" type="primary" onClick={handleConfirmRename}>
                      确定
                    </Button>
                    <Button size="small" onClick={handleCancelRename}>
                      取消
                    </Button>
                  </Space>
                ) : (
                  <>
                    <Button
                      key="rename"
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => handleStartRename(file.filename)}
                    >
                      重命名
                    </Button>
                    <Popconfirm
                      key="delete"
                      title="确定要删除这个文件吗？"
                      onConfirm={() => handleDeleteFile(file.filename)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                      >
                        删除
                      </Button>
                    </Popconfirm>
                  </>
                ),
              ]}
            >
              <List.Item.Meta
                avatar={<FileOutlined />}
                title={
                  <Text
                    className="file-name"
                    onClick={() => handleOpenFile(file.filename)}
                    style={{ cursor: 'pointer' }}
                  >
                    {file.filename}
                  </Text>
                }
                description={
                  <Space>
                    <Text 
                      style={{ 
                        color: 'var(--theme-textSecondary, #595959)',
                        opacity: 1
                      }}
                    >
                      {formatFileSize(file.size)}
                    </Text>
                    <Text 
                      style={{ 
                        color: 'var(--theme-textSecondary, #595959)',
                        opacity: 1
                      }}
                    >
                      •
                    </Text>
                    <Text 
                      style={{ 
                        color: 'var(--theme-textSecondary, #595959)',
                        opacity: 1
                      }}
                    >
                      {formatModifiedTime(file.modified)}
                    </Text>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </div>
    </Modal>
  )
}

export default FileManager

