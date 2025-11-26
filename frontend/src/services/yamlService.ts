import yaml from 'js-yaml'
import { WorkflowConfig } from '@/types/workflow'

/**
 * YAML 服务：处理工作流配置的序列化和反序列化
 */
export class YamlService {
  /**
   * 将工作流配置转换为 YAML 字符串
   * 对于多行字符串，自动使用块标量格式（|）
   */
  static stringify(config: WorkflowConfig): string {
    try {
      // 使用 yaml.dump 序列化
      let yamlString = yaml.dump(config, {
        indent: 2,
        lineWidth: -1,
        forceQuotes: false,
        sortKeys: false,
        noRefs: true,
      })

      // 查找并替换所有多行字符串为块标量格式
      // 匹配模式：键名: "包含\n的字符串" 或 键名: '包含\n的字符串'
      const lines = yamlString.split('\n')
      const result: string[] = []
      let i = 0
      
      while (i < lines.length) {
        const line = lines[i]
        
        // 匹配键值对：key: "value" 或 key: 'value'
        // 使用非贪婪匹配，并处理转义字符
        const doubleQuoteMatch = line.match(/^(\s+)([^:]+):\s*"((?:[^"\\]|\\.)*)"\s*$/)
        const singleQuoteMatch = line.match(/^(\s+)([^:]+):\s*'((?:[^'\\]|\\.)*)'\s*$/)
        const quotedMatch = doubleQuoteMatch || singleQuoteMatch
        
        if (quotedMatch) {
          const [, indent, key, value] = quotedMatch
          const quote = doubleQuoteMatch ? '"' : "'"
          
          // 检查值是否包含转义的换行符
          const unescapedValue = value
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(quote === '"' ? /\\"/g : /\\'/g, quote)
            .replace(/\\\\/g, '\\')
          
          if (unescapedValue.includes('\n')) {
            // 转换为块标量格式
            const valueLines = unescapedValue.split('\n')
            const indentStr = ' '.repeat(indent.length + 2)
            result.push(`${indent}${key}: |`)
            valueLines.forEach((valLine) => {
              result.push(`${indentStr}${valLine}`)
            })
            i++
            continue
          }
        }
        
        result.push(line)
        i++
      }

      return result.join('\n')
    } catch (error) {
      throw new Error(`YAML 序列化失败: ${error}`)
    }
  }

  /**
   * 将 YAML 字符串解析为工作流配置
   */
  static parse(yamlString: string): WorkflowConfig {
    try {
      const parsed = yaml.load(yamlString) as WorkflowConfig
      if (!parsed || !parsed.workflow) {
        throw new Error('无效的工作流配置格式')
      }
      return parsed
    } catch (error) {
      throw new Error(`YAML 解析失败: ${error}`)
    }
  }

  /**
   * 验证 YAML 格式
   */
  static validate(yamlString: string): { valid: boolean; error?: string } {
    try {
      this.parse(yamlString)
      return { valid: true }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : '未知错误',
      }
    }
  }
}


