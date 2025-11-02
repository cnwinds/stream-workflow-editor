import axios from 'axios'
import { WorkflowConfig, WorkflowValidationResult } from '@/types/workflow'
import { message } from 'antd'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器 - 添加错误处理
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      message.error('请求超时，请检查后端服务是否运行')
    } else if (error.response) {
      const status = error.response.status
      if (status === 404) {
        message.error('接口不存在')
      } else if (status === 500) {
        message.error('服务器错误')
      } else {
        message.error(`请求失败: ${error.response.data?.detail || error.message}`)
      }
    } else if (error.request) {
      message.error('无法连接到后端服务，请确保后端运行在 http://localhost:8000')
      console.error('后端连接失败:', error)
    } else {
      message.error(`请求错误: ${error.message}`)
    }
    return Promise.reject(error)
  }
)

// 工作流管理 API
export const workflowApi = {
  // 获取工作流列表
  getWorkflows: async () => {
    const response = await api.get('/workflows')
    return response.data
  },

  // 获取单个工作流
  getWorkflow: async (id: string) => {
    const response = await api.get(`/workflows/${id}`)
    return response.data
  },

  // 创建或更新工作流
  saveWorkflow: async (config: WorkflowConfig) => {
    const response = await api.post('/workflows', config)
    return response.data
  },

  // 删除工作流
  deleteWorkflow: async (id: string) => {
    const response = await api.delete(`/workflows/${id}`)
    return response.data
  },
}

// 配置验证 API
export const validationApi = {
  // 验证工作流配置
  validate: async (config: WorkflowConfig): Promise<WorkflowValidationResult> => {
    const response = await api.post('/validate', config)
    return response.data
  },
}

// 执行控制 API
export const executionApi = {
  // 执行工作流
  execute: async (config: WorkflowConfig, initialData?: Record<string, any>) => {
    const response = await api.post('/execute', { config, initialData })
    return response.data
  },

  // 获取执行状态
  getStatus: async (executionId: string) => {
    const response = await api.get(`/execute/${executionId}/status`)
    return response.data
  },

  // 停止执行
  stop: async (executionId: string) => {
    const response = await api.post(`/execute/${executionId}/stop`)
    return response.data
  },
}

// 节点信息 API
export const nodeApi = {
  // 获取所有节点类型
  getNodeTypes: async () => {
    const response = await api.get('/nodes/types')
    return response.data
  },

  // 获取节点 schema
  getNodeSchema: async (type: string) => {
    const response = await api.get(`/nodes/${type}/schema`)
    return response.data
  },

  // 自定义节点相关API
  // 创建自定义节点
  createCustomNode: async (request: {
    nodeId: string
    name: string
    description: string
    category: string
    executionMode: string
    color: string
    inputs: any[]
    outputs: any[]
    configSchema: Record<string, any>
    pythonCode?: string
  }) => {
    const response = await api.post('/nodes/custom', request)
    return response.data
  },

  // 获取所有自定义节点
  getCustomNodes: async () => {
    const response = await api.get('/nodes/custom')
    return response.data
  },

  // 获取自定义节点信息
  getCustomNode: async (nodeId: string) => {
    const response = await api.get(`/nodes/custom/${nodeId}`)
    return response.data
  },

  // 更新自定义节点代码
  updateCustomNode: async (nodeId: string, pythonCode: string) => {
    const response = await api.put(`/nodes/custom/${nodeId}`, { pythonCode })
    return response.data
  },

  // 删除自定义节点
  deleteCustomNode: async (nodeId: string) => {
    const response = await api.delete(`/nodes/custom/${nodeId}`)
    return response.data
  },

  // 获取节点Python代码
  getNodeCode: async (nodeId: string) => {
    const response = await api.get(`/nodes/custom/${nodeId}/code`)
    return response.data
  },
}

export default api
