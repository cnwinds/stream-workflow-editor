"""
节点代码生成器
根据节点定义生成Python代码
"""
import json
from typing import Dict, Any, List
from jinja2 import Template
from pathlib import Path

from ..config import config


def get_template_file() -> Path:
    """获取模板文件路径"""
    templates_dir = config.get_templates_dir()
    return templates_dir / "node_template.py"


def load_template() -> str:
    """加载节点代码模板"""
    template_file = get_template_file()
    
    # 尝试从文件系统加载模板
    try:
        if template_file.exists():
            with open(template_file, 'r', encoding='utf-8') as f:
                content = f.read()
                # 模板文件中存储的是字符串变量，提取实际模板内容
                # 从 NODE_TEMPLATE = ''' 开始到 ''' 结束
                start_marker = "NODE_TEMPLATE = '''"
                end_marker = "'''"
                
                start_idx = content.find(start_marker)
                if start_idx != -1:
                    start_idx += len(start_marker)
                    end_idx = content.rfind(end_marker)
                    if end_idx > start_idx:
                        return content[start_idx:end_idx]
                
                # 如果没有找到标记，返回整个文件内容（可能是直接的模板文件）
                return content
    except (FileNotFoundError, IOError, OSError):
        # 如果文件不存在或读取失败，使用内置模板
        pass
    
    # 回退到使用内置模板
    try:
        from stream_workflow_editor.custom_nodes.templates.node_template import NODE_TEMPLATE
        return NODE_TEMPLATE
    except ImportError:
        # 如果导入失败，使用硬编码的默认模板
        return _get_default_template()


def _get_default_template() -> str:
    """获取默认的节点代码模板（作为最后的回退选项）"""
    return '''"""
{{description}}
"""
from stream_workflow.core import Node, ParameterSchema, register_node

@register_node('{{node_id}}')
class {{class_name}}(Node):
    """{{description}}"""
    
    # 节点元信息
    NAME = "{{name}}"
    CATEGORY = "{{category}}"
    EXECUTION_MODE = '{{execution_mode}}'
    COLOR = '{{color}}'
    
    # 输入参数定义
    INPUT_PARAMS = {
{% for param in inputs %}
        "{{param.name}}": ParameterSchema(
            is_streaming={% if param.is_streaming %}True{% else %}False{% endif %},
            schema={{param.schema|tojson if param.schema else '{}'}}
        ){% if not loop.last %},{% endif %}
{% endfor %}
    }
    
    # 输出参数定义
    OUTPUT_PARAMS = {
{% for param in outputs %}
        "{{param.name}}": ParameterSchema(
            is_streaming={% if param.is_streaming %}True{% else %}False{% endif %},
            schema={{param.schema|tojson if param.schema else '{}'}}
        ){% if not loop.last %},{% endif %}
{% endfor %}
    }
    
    # 配置Schema
    CONFIG_SCHEMA = {{config_schema|tojson}}
    
    async def run(self, context):
        """节点执行逻辑"""
        # 获取输入参数
{% for param in inputs %}
        {{param.name}} = context.get_input("{{param.name}}")
{% endfor %}
        
        # 获取配置参数
        config = self.config or {}
{% for key in config_schema.keys() %}
        {{key}} = config.get("{{key}}", {{config_schema[key].get('default', 'None')|tojson}})
{% endfor %}
        
        # TODO: 实现你的业务逻辑
        # 示例：
        # result = process_data({{inputs[0].name if inputs else 'None'}})
        
        # 返回输出
        return {
{% for param in outputs %}
            "{{param.name}}": None,  # 替换为实际值
{% endfor %}
        }
'''


def to_python_class_name(node_id: str) -> str:
    """将节点ID转换为Python类名"""
    # 将下划线分隔的单词转换为驼峰命名
    parts = node_id.split('_')
    return ''.join(word.capitalize() for word in parts) + 'Node'


def generate_node_code(
    node_id: str,
    name: str,
    description: str,
    category: str,
    execution_mode: str,
    color: str,
    inputs: List[Dict[str, Any]],
    outputs: List[Dict[str, Any]],
    config_schema: Dict[str, Any]
) -> str:
    """
    生成节点Python代码
    
    Args:
        node_id: 节点ID
        name: 节点名称
        description: 节点描述
        category: 节点分类（支持点分隔符）
        execution_mode: 执行模式（sequential/streaming/hybrid）
        color: 节点颜色
        inputs: 输入参数列表
        outputs: 输出参数列表
        config_schema: 配置Schema
    """
    template_str = load_template()
    template = Template(template_str)
    
    class_name = to_python_class_name(node_id)
    
    # 准备模板数据，确保参数格式正确
    # schema 应该是字段名到类型的映射，例如 {"field_name": "string"}
    processed_inputs = []
    for param in inputs:
        # schema 保持为字段名到类型的映射，不包含 required 和 description
        schema = param.get('schema', {})
        # 如果 schema 不是字典或者是空字典，保持为空
        if not isinstance(schema, dict):
            schema = {}
        
        processed_inputs.append({
            'name': param.get('name', ''),
            'is_streaming': param.get('isStreaming', False),
            'schema': schema
        })
    
    processed_outputs = []
    for param in outputs:
        processed_outputs.append({
            'name': param.get('name', ''),
            'is_streaming': param.get('isStreaming', False),
            'schema': param.get('schema', {})
        })
    
    template_data = {
        'node_id': node_id,
        'class_name': class_name,
        'name': name,
        'description': description,
        'category': category,
        'execution_mode': execution_mode,
        'color': color,
        'inputs': processed_inputs,
        'outputs': processed_outputs,
        'config_schema': config_schema or {}
    }
    
    # 渲染模板
    code = template.render(**template_data)
    
    return code


def validate_node_definition(
    node_id: str,
    inputs: Dict[str, Any],
    outputs: Dict[str, Any]
) -> tuple[bool, str]:
    """
    验证节点定义
    
    Args:
        node_id: 节点ID
        inputs: 输入参数字典，key是输入名称，value包含isStreaming和schema
        outputs: 输出参数字典，key是输出名称，value包含isStreaming和schema
    
    Returns:
        (is_valid, error_message)
    """
    if not node_id:
        return False, "节点ID不能为空"
    
    if not node_id.replace('_', '').isalnum():
        return False, "节点ID只能包含字母、数字和下划线"
    
    # 验证输入参数
    if not isinstance(inputs, dict):
        return False, "输入参数必须是字典格式"
    
    for input_name in inputs.keys():
        if not input_name:
            return False, "输入参数名称不能为空"
        if not isinstance(input_name, str):
            return False, f"输入参数名称必须是字符串: {input_name}"
    
    # 验证输出参数
    if not isinstance(outputs, dict):
        return False, "输出参数必须是字典格式"
    
    for output_name in outputs.keys():
        if not output_name:
            return False, "输出参数名称不能为空"
        if not isinstance(output_name, str):
            return False, f"输出参数名称必须是字符串: {output_name}"
    
    return True, ""

