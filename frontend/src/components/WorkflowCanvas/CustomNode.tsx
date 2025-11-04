import React, { useEffect, useState } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { NodeType, ParameterSchema } from '@/types/node'
import { nodeApi } from '@/services/api'
import { useWorkflowStore } from '@/stores/workflowStore'
import { useHandleHover } from './index'
import './CustomNode.css'

interface CustomNodeData {
  label: string
  nodeType?: NodeType
  config?: Record<string, any>
  type?: string
  inputParams?: Record<string, ParameterSchema>
  outputParams?: Record<string, ParameterSchema>
  executionMode?: 'sequential' | 'streaming' | 'hybrid'
  color?: string
}

const CustomNode: React.FC<NodeProps<CustomNodeData>> = ({ data, selected, id }) => {
  const [inputParams, setInputParams] = useState<Record<string, ParameterSchema>>(data.inputParams || {})
  const [outputParams, setOutputParams] = useState<Record<string, ParameterSchema>>(data.outputParams || {})
  const { updateNodeData } = useWorkflowStore()
  const handleHover = useHandleHover()
  
  const nodeType = data.nodeType
  // 优先使用 nodeType 中的 executionMode，如果没有则尝试从 data 中获取，最后使用默认值
  const executionMode = nodeType?.executionMode || data.executionMode || 'sequential'
  
  // 同步外部更新的 data.inputParams 和 data.outputParams 到组件状态
  useEffect(() => {
    if (data.inputParams) {
      setInputParams(data.inputParams)
    }
    if (data.outputParams) {
      setOutputParams(data.outputParams)
    }
  }, [data.inputParams, data.outputParams])
  
  // 加载节点 schema
  useEffect(() => {
    // 使用 ref 标记，避免重复调用
    let cancelled = false

    const loadNodeSchema = async () => {
      // 如果已经有 inputParams 和 outputParams，不需要重新加载
      if (data.inputParams && Object.keys(data.inputParams).length > 0 && 
          data.outputParams && Object.keys(data.outputParams).length > 0) {
        return
      }
      
      if (data.type) {
        try {
          const schema = await nodeApi.getNodeSchema(data.type)
          if (cancelled) return

          const loadedInputParams = schema.INPUT_PARAMS || {}
          const loadedOutputParams = schema.OUTPUT_PARAMS || {}
          
          setInputParams(loadedInputParams)
          setOutputParams(loadedOutputParams)
          
          // 同步更新 store 中的节点数据，以便验证逻辑可以访问
          // 只在 schema 确实发生变化时才更新，避免循环
          const currentInputParams = data.inputParams || {}
          const currentOutputParams = data.outputParams || {}
          
          const inputParamsChanged = JSON.stringify(loadedInputParams) !== JSON.stringify(currentInputParams)
          const outputParamsChanged = JSON.stringify(loadedOutputParams) !== JSON.stringify(currentOutputParams)
          
          if (inputParamsChanged || outputParamsChanged) {
            updateNodeData(id, {
              inputParams: loadedInputParams,
              outputParams: loadedOutputParams,
            })
          }
        } catch (error) {
          if (!cancelled) {
            console.error(`加载节点 ${data.type} 的 schema 失败:`, error)
          }
        }
      }
    }
    
    loadNodeSchema()

    return () => {
      cancelled = true
    }
  }, [data.type, id]) // 只依赖 type 和 id，不依赖 inputParams/outputParams 以避免循环

  // 使用传入的 schema 或加载的 schema
  const finalInputParams = data.inputParams || inputParams
  const finalOutputParams = data.outputParams || outputParams

  const getModeColor = () => {
    switch (executionMode) {
      case 'streaming':
        return '#52c41a'
      case 'hybrid':
        return '#faad14'
      default:
        return '#1890ff'
    }
  }

  const getModeLabel = () => {
    switch (executionMode) {
      case 'streaming':
        return '流式'
      case 'hybrid':
        return '混合'
      default:
        return '顺序'
    }
  }

  // 优先使用 nodeType 中的 color，如果没有则根据 executionMode 计算
  const getNodeColor = () => {
    if (nodeType?.color) {
      return nodeType.color
    }
    if (data.color) {
      return data.color
    }
    // 如果没有设置颜色，根据 executionMode 返回默认颜色
    return getModeColor()
  }

  // 将参数对象转换为数组，处理ParameterSchema格式
  const inputParamsList = Object.entries(finalInputParams).map(([name, param]) => {
    // 参数格式：{ isStreaming: boolean, schema: Record<string, string> }
    if (param && typeof param === 'object') {
      return {
        name,
        isStreaming: param.isStreaming || false,
        schema: param.schema || {},
      }
    }
    return {
      name,
      isStreaming: false,
      schema: {},
    }
  })
  
  const outputParamsList = Object.entries(finalOutputParams).map(([name, param]) => {
    // 参数格式：{ isStreaming: boolean, schema: Record<string, string> }
    if (param && typeof param === 'object') {
      return {
        name,
        isStreaming: param.isStreaming || false,
        schema: param.schema || {},
      }
    }
    return {
      name,
      isStreaming: false,
      schema: {},
    }
  })

  // 计算节点高度（根据参数数量）
  const headerHeight = 40
  const paramHeight = 28
  const hasParams = inputParamsList.length > 0 || outputParamsList.length > 0
  const nodeHeight = hasParams
    ? Math.max(
        headerHeight + Math.max(inputParamsList.length, outputParamsList.length) * paramHeight + 16,
        80
      )
    : headerHeight + 16  // 没有参数时，只显示header和一些padding

  return (
    <div 
      className={`custom-node ${selected ? 'selected' : ''}`}
      style={{ minHeight: `${nodeHeight}px` }}
    >
      <div
        className="custom-node-header"
        style={{ borderTopColor: getNodeColor() }}
      >
        <span className="custom-node-title">{data.label}</span>
        <span className="custom-node-mode" style={{ color: getNodeColor() }}>
          {getModeLabel()}
        </span>
      </div>
      
      {(inputParamsList.length > 0 || outputParamsList.length > 0) && (
        <div className="custom-node-body">
          {/* 左侧：输入参数 */}
          {inputParamsList.length > 0 && (
            <div className="custom-node-inputs">
              {inputParamsList.map((param) => (
                <div 
                  key={`input-${param.name}`} 
                  className="custom-node-param"
                  onMouseEnter={() => handleHover?.onHandleMouseEnter(id, param.name, 'target')}
                  onMouseLeave={() => handleHover?.onHandleMouseLeave()}
                >
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={param.name}
                    className={param.isStreaming ? 'streaming-handle' : ''}
                  />
                  <div className="custom-node-param-label">
                    <span className="custom-node-param-name">{param.name}</span>
                    {param.isStreaming && (
                      <span className="custom-node-param-streaming">流</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 右侧：输出参数 */}
          {outputParamsList.length > 0 && (
            <div className="custom-node-outputs">
              {outputParamsList.map((param) => (
                <div 
                  key={`output-${param.name}`} 
                  className="custom-node-param"
                  onMouseEnter={() => handleHover?.onHandleMouseEnter(id, param.name, 'source')}
                  onMouseLeave={() => handleHover?.onHandleMouseLeave()}
                >
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={param.name}
                    className={param.isStreaming ? 'streaming-handle' : ''}
                  />
                  <div className="custom-node-param-label">
                    <span className="custom-node-param-name">{param.name}</span>
                    {param.isStreaming && (
                      <span className="custom-node-param-streaming">流</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default CustomNode

