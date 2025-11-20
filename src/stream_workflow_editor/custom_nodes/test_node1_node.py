"""

"""
from stream_workflow.core import Node, ParameterSchema, register_node

@register_node('TestNode1')
class TestNode1Node(Node):
    """"""
    
    # 节点元信息
    NAME = "测试节点1"
    CATEGORY = "测试"
    EXECUTION_MODE = 'streaming'
    COLOR = '#8c00ff'
    
    # 输入参数定义
    INPUT_PARAMS = {
        "text_stream": ParameterSchema(
            is_streaming=True,
            schema={"field_1":"string","field_2":"string","field_3":"string"},
            description=""
        ),
        "status": ParameterSchema(
            is_streaming=True,
            schema={"field_1":"string"},
            description=""
        ),
        "helloworld": ParameterSchema(
            is_streaming=True,
            schema={},
            description=""
        )
    }
    
    # 输出参数定义
    OUTPUT_PARAMS = {
        "o1": ParameterSchema(
            is_streaming=True,
            schema={},
            description=""
        )
    }
    
    # 配置参数定义
    CONFIG_PARAMS = {
        "field_1": {"type":"string","required":True,"description":"test"}
    }
    
    async def run(self, context):
        """节点执行逻辑"""
        # 获取输入参数
        text_stream = context.get_input("text_stream")
        status = context.get_input("status")
        helloworld = context.get_input("helloworld")
        
        # 获取配置参数
        config = self.config or {}
        field_1 = config.get("field_1", None)
        
        # TODO: 实现你的业务逻辑
        # 示例：
        # result = process_data(text_stream)
        
        # 返回输出
        return {
            "o1": None,  # 替换为实际值
        }
