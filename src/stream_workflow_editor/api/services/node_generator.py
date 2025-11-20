"""
节点代码生成器
根据节点定义生成Python代码
"""
import json
from typing import Dict, Any, List
from jinja2 import Template, Environment
from pathlib import Path

from ..config import config

def _convert_js_json_booleans_to_python(src: str) -> str:
    """
    将源代码中非字符串字面量里的 json/js 布尔 true/false 转为 Python True/False。
    算法：逐字符扫描，跟踪是否在字符串（支持单引号/双引号，处理转义）。
    仅在不在字符串中并且前后是非标识符边界时替换单词 true/false。

    这是一个防卫性转换：如果源码已经是 Python 风格（True/False）或者
    包含字符串 "true"/"false"，则不会误替换字符串内容。
    """
    if not src or ('true' not in src and 'false' not in src):
        return src

    def is_ident_char(c: str) -> bool:
        return (c.isalnum() or c == '_')

    i = 0
    n = len(src)
    out_chars = []
    in_string = False
    string_char = ''
    escaped = False

    while i < n:
        ch = src[i]

        # 处理字符串状态与转义
        if in_string:
            out_chars.append(ch)
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == string_char:
                in_string = False
                string_char = ''
            i += 1
            continue
        else:
            # 可能进入字符串
            if ch == '"' or ch == "'":
                in_string = True
                string_char = ch
                out_chars.append(ch)
                i += 1
                continue

            # 尝试匹配 true 或 false（完整单词）
            # 先处理 "true"
            if src.startswith('true', i):
                prev_char = src[i-1] if i-1 >= 0 else ''
                next_char = src[i+4] if i+4 < n else ''
                if (not prev_char or not is_ident_char(prev_char)) and (not next_char or not is_ident_char(next_char)):
                    out_chars.append('True')
                    i += 4
                    continue

            # 处理 "false"
            if src.startswith('false', i):
                prev_char = src[i-1] if i-1 >= 0 else ''
                next_char = src[i+5] if i+5 < n else ''
                if (not prev_char or not is_ident_char(prev_char)) and (not next_char or not is_ident_char(next_char)):
                    out_chars.append('False')
                    i += 5
                    continue

            # 默认逐字符复制
            out_chars.append(ch)
            i += 1

    return ''.join(out_chars)

def to_python_literal(value: Any) -> str:
    """
    接收一个可能是 JSON 风格字符串的 value，
    自动把 true/false/null 转成 Python 风格 True/False/None，
    并安全返回 Python 字面量字符串。
    """
    # 如果 value 本来就是 Python 对象，直接 repr
    if not isinstance(value, str):
        return repr(value)

    try:
        # 尝试把 JSON 字符串解析为 Python 对象
        py = json.loads(value)
        return repr(py)
    except Exception:
        # 解析失败说明不是纯 JSON，直接返回原字符串
        return value

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
            schema={{param.schema|to_python if param.schema else '{}'}},
            description={{param.description|to_python if param.description else '""'}}
        ){% if not loop.last %},{% endif %}
{% endfor %}
    }
    
    # 输出参数定义
    OUTPUT_PARAMS = {
{% for param in outputs %}
        "{{param.name}}": ParameterSchema(
            is_streaming={% if param.is_streaming %}True{% else %}False{% endif %},
            schema={{param.schema|to_python if param.schema else '{}'}},
            description={{param.description|to_python if param.description else '""'}}
        ){% if not loop.last %},{% endif %}
{% endfor %}
    }
    
    # 配置参数定义（使用 FieldSchema 格式）
{% if config_params %}
    CONFIG_PARAMS = {
{% for param in config_params %}
        "{{param.name}}": {% if param.format == 'simple' %}{{param.field_def|to_python}}{% else %}{{param.field_def|to_python}}{% endif %}{% if not loop.last %},{% endif %}
{% endfor %}
    }
{% else %}
    CONFIG_PARAMS = {}
{% endif %}
    
    async def run(self, context):
        """节点执行逻辑"""
        # 获取输入参数
{% for param in inputs %}
        {{param.name}} = context.get_input("{{param.name}}")
{% endfor %}
        
        # 获取配置参数
        config = self.config or {}
{% if config_params %}
{% for param in config_params %}
        {{param.name}} = config.get("{{param.name}}", None)
{% endfor %}
{% endif %}
        
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
    class_name = ''.join(word.capitalize() for word in parts)
    
    # 如果节点ID已经以 _node 结尾，类名应该以 Node 结尾，不需要再加 Node
    if node_id.endswith('_node'):
        # 如果类名已经以 Node 结尾，就不再加
        if not class_name.endswith('Node'):
            class_name += 'Node'
    else:
        # 如果节点ID不以 _node 结尾，添加 Node 后缀
        class_name += 'Node'
    
    return class_name


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
    # 创建 Jinja2 环境并添加自定义过滤器
    env = Environment()
    env.filters['to_python'] = to_python_literal
    template = env.from_string(template_str)
    
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
            'schema': schema,
            'description': param.get('description', '')
        })
    
    processed_outputs = []
    for param in outputs:
        processed_outputs.append({
            'name': param.get('name', ''),
            'is_streaming': param.get('isStreaming', False),
            'schema': param.get('schema', {}),
            'description': param.get('description', '')
        })
    
    # 处理配置参数（使用 FieldSchema 格式）
    processed_config_params = None
    if isinstance(config_schema, dict) and config_schema:
        # FieldSchema 格式：可以是字符串（简单格式）或字典（详细格式）
        processed_config_params = []
        for param_name, field_def in config_schema.items():
            if isinstance(field_def, str):
                # 简单格式: "string"
                processed_config_params.append({
                    'name': param_name,
                    'field_def': field_def,  # 直接是字符串
                    'format': 'simple'
                })
            elif isinstance(field_def, dict):
                # 详细格式: {"type": "string", "required": True, "description": "...", "default": "..."}
                processed_config_params.append({
                    'name': param_name,
                    'field_def': field_def,  # 是字典
                    'format': 'detailed'
                })
            else:
                # 默认简单格式
                processed_config_params.append({
                    'name': param_name,
                    'field_def': 'any',
                    'format': 'simple'
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
        'config_params': processed_config_params
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

