"""

"""
from workflow_engine.core import Node, ParameterSchema, register_node

@register_node('TestNode1')
class Testnode1Node(Node):
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
            schema={"field_1": "string", "field_2": "string", "field_3": "string"}
        ),

        "status": ParameterSchema(
            is_streaming=True,
            schema={"field_1": "string"}
        ),

        "helloworld": ParameterSchema(
            is_streaming=True,
            schema={}
        )

    }
    
    # 输出参数定义
    OUTPUT_PARAMS = {

    }
    
    # 配置Schema
    CONFIG_SCHEMA = {}
    
    async def run(self, context):
        """节点执行逻辑"""
        # 获取输入参数

        text_stream = context.get_input("text_stream")

        status = context.get_input("status")

        helloworld = context.get_input("helloworld")

        
        # 获取配置参数
        config = self.config or {}

        
        # TODO: 实现你的业务逻辑
        # 示例：
        # result = process_data(text_stream)
        
        # 返回输出
        return {

        }