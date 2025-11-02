import yaml from 'js-yaml'
import { WorkflowConfig } from '@/types/workflow'

/**
 * YAML 服务：处理工作流配置的序列化和反序列化
 */
export class YamlService {
  /**
   * 将工作流配置转换为 YAML 字符串
   */
  static stringify(config: WorkflowConfig): string {
    try {
      return yaml.dump(config, {
        indent: 2,
        lineWidth: -1,
        quotingType: '"',
        sortKeys: false,
      })
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


