"""
Python节点代码模板
用于生成自定义节点代码
"""
NODE_TEMPLATE = '''"""
{{description}}
"""
from stream_workflow.core import Node, ParameterSchema, register_node
from stream_workflow.core.parameter import FieldSchema

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
        "{{param.name}}": FieldSchema(
{% if param.format == 'simple' %}
            {"type": {{param.field_def|to_python}}}
{% else %}
            {{param.field_def|format_field_schema}}
{% endif %}
        ){% if not loop.last %},{% endif %}
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

