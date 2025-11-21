/**
 * 节点代码生成器（前端）
 */
import { ParameterSchema, FieldSchemaDef } from '@/types/node'

export const nodeGenerator = {
  generateNodeCode(request: {
    nodeId: string
    name: string
    description: string
    category: string
    executionMode: string
    color: string
    inputs: Record<string, ParameterSchema>
    outputs: Record<string, ParameterSchema>
    configParams?: Record<string, FieldSchemaDef>
  }): string {
    const { nodeId, name, description, category, executionMode, color, inputs, outputs, configParams } = request

    // 转换为Python类名
    const className = nodeId
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('') + 'Node'

    // 生成输入参数代码
    const inputParamsCode = Object.entries(inputs)
      .map(([paramName, param], index, arr) => {
        const isStreaming = param.isStreaming ? 'True' : 'False'
        const description = param.description ? JSON.stringify(param.description) : '""'
        const schema = JSON.stringify(param.schema || {})
        const comma = index < arr.length - 1 ? ',' : ''
        return `        "${paramName}": ParameterSchema(
            is_streaming=${isStreaming},
            schema=${schema},
            description=${description}
        )${comma}`
      })
      .join('\n')

    // 生成输出参数代码
    const outputParamsCode = Object.entries(outputs)
      .map(([paramName, param], index, arr) => {
        const isStreaming = param.isStreaming ? 'True' : 'False'
        const description = param.description ? JSON.stringify(param.description) : '""'
        const schema = JSON.stringify(param.schema || {})
        const comma = index < arr.length - 1 ? ',' : ''
        return `        "${paramName}": ParameterSchema(
            is_streaming=${isStreaming},
            schema=${schema},
            description=${description}
        )${comma}`
      })
      .join('\n')

    // 生成配置参数代码（使用 FieldSchema 格式）
    const formatFieldValue = (value: any): string => {
      if (typeof value === 'string') {
        return JSON.stringify(value).replace(/"/g, "'")
      }
      return JSON.stringify(value)
    }

    const configParamsCode = configParams && Object.keys(configParams).length > 0
      ? Object.entries(configParams)
          .map(([paramName, fieldDef], index, arr) => {
            const comma = index < arr.length - 1 ? ',' : ''
            
            if (typeof fieldDef === 'string') {
              // 简单格式: "string" -> FieldSchema({'type': 'string'})
              return `        "${paramName}": FieldSchema({\n            'type': ${formatFieldValue(fieldDef)}\n        })${comma}`
            } else if (typeof fieldDef === 'object' && fieldDef !== null) {
              // 详细格式: {"type": "string", "required": True, "description": "...", "default": "..."}
              const fieldDictLines: string[] = []
              
              if (fieldDef.type !== undefined) {
                fieldDictLines.push(`            'type': ${formatFieldValue(fieldDef.type)}`)
              }
              if (fieldDef.required === true) {
                fieldDictLines.push(`            'required': True`)
              }
              if (fieldDef.description !== undefined) {
                fieldDictLines.push(`            'description': ${formatFieldValue(fieldDef.description)}`)
              }
              if (fieldDef.default !== undefined) {
                fieldDictLines.push(`            'default': ${formatFieldValue(fieldDef.default)}`)
              }
              
              const fieldDictStr = fieldDictLines.join(',\n')
              return `        "${paramName}": FieldSchema({\n${fieldDictStr}\n        })${comma}`
            } else {
              // 默认格式
              return `        "${paramName}": FieldSchema({\n            'type': 'any'\n        })${comma}`
            }
          })
          .join('\n')
      : null

    // 生成配置获取代码
    const configKeys = configParams ? Object.keys(configParams) : []
    const configGettersCode = configKeys
      .map((key) => {
        if (configParams && configParams[key]) {
          // FieldSchema 格式：如果是详细格式，可能包含默认值
          const fieldDef = configParams[key]
          if (typeof fieldDef === 'object' && fieldDef !== null && 'default' in fieldDef) {
            const defaultValue = JSON.stringify(fieldDef.default)
            return `        ${key} = config.get("${key}", ${defaultValue})`
          } else {
            return `        ${key} = config.get("${key}", None)`
          }
        } else {
          return `        ${key} = config.get("${key}", None)`
        }
      })
      .join('\n')

    // 生成输入获取代码
    const inputGettersCode = Object.keys(inputs)
      .map((paramName) => `        ${paramName} = context.get_input("${paramName}")`)
      .join('\n')

    // 生成返回值代码
    const returnValuesCode = Object.keys(outputs)
      .map((paramName, index, arr) => {
        const comma = index < arr.length - 1 ? ',' : ''
        return `            "${paramName}": None,  # 替换为实际值${comma}`
      })
      .join('\n')

    const code = `"""
${description}
"""
from stream_workflow.core import Node, ParameterSchema, register_node
from stream_workflow.core.parameter import FieldSchema

@register_node('${nodeId}')
class ${className}(Node):
    """${description}"""
    
    # 节点元信息
    NAME = "${name}"
    CATEGORY = "${category}"
    EXECUTION_MODE = '${executionMode}'
    COLOR = '${color}'
    
    # 输入参数定义
    INPUT_PARAMS = {
${inputParamsCode}
    }
    
    # 输出参数定义
    OUTPUT_PARAMS = {
${outputParamsCode}
    }
    
    # 配置参数定义
${configParamsCode ? `    CONFIG_PARAMS = {\n${configParamsCode}\n    }` : '    CONFIG_PARAMS = {}'}
    
    async def run(self, context):
        """节点执行逻辑"""
        # 获取输入参数
${inputGettersCode}
        
        # 获取配置参数
        config = self.config or {}
${configGettersCode}
        
        # TODO: 实现你的业务逻辑
        # 示例：
        # result = process_data(${Object.keys(inputs)[0] || 'None'})
        
        # 返回输出
        return {
${returnValuesCode}
        }
`

    return code
  },
}


