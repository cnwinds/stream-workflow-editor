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
      // 使用 left/top 替代 x/y 避免 YAML 歧义问题
      // YAML 1.1 规范中，'y' 是布尔值 true 的别名，js-yaml 会对其添加引号
      // 使用 left/top 更语义化且无歧义
      return yaml.dump(config, {
        indent: 2,
        lineWidth: -1,
        forceQuotes: false,
        sortKeys: false,
        noRefs: true,
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


