"""
Stream Workflow 服务器 CLI 入口
支持在任意目录启动服务，自动检测或指定自定义节点目录
"""
import click
import sys
import os
from pathlib import Path

# 添加 backend 目录到路径以便导入 api 模块
backend_dir = Path(__file__).parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from api.config import config
import uvicorn


@click.command()
@click.option(
    '--work-dir', '-w',
    type=click.Path(exists=True, file_okay=False, dir_okay=True, path_type=str),
    help='工作目录，将在该目录下查找 custom_nodes'
)
@click.option(
    '--nodes-dir', '-n',
    type=click.Path(exists=True, file_okay=False, dir_okay=True, path_type=str),
    help='自定义节点目录的绝对或相对路径'
)
@click.option(
    '--config', '-c',
    type=click.Path(exists=True, file_okay=True, dir_okay=False, path_type=str),
    help='配置文件路径（YAML 格式）'
)
@click.option(
    '--host',
    default=None,
    help='服务监听地址（默认: 0.0.0.0）'
)
@click.option(
    '--port', '-p',
    type=int,
    default=None,
    help='服务监听端口（默认: 3010）'
)
@click.option(
    '--reload/--no-reload',
    default=False,
    help='是否启用自动重载（开发模式）'
)
def main(work_dir, nodes_dir, config_file, host, port, reload):
    """
    Stream Workflow 服务器
    
    启动 Stream Workflow API 服务，支持从任意目录启动。
    
    配置优先级：命令行参数 > 环境变量 > 配置文件 > 自动检测
    
    示例:
        \b
        # 在当前目录启动（自动检测 custom_nodes）
        stream-workflow-server
        
        \b
        # 指定工作目录
        stream-workflow-server --work-dir /path/to/project
        
        \b
        # 直接指定自定义节点目录
        stream-workflow-server --nodes-dir /path/to/custom/nodes
        
        \b
        # 使用配置文件
        stream-workflow-server --config /path/to/config.yaml
        
        \b
        # 使用环境变量
        export CUSTOM_NODES_DIR=/path/to/custom/nodes
        stream-workflow-server
    """
    try:
        # 初始化配置
        config.initialize(
            work_dir=work_dir,
            nodes_dir=nodes_dir,
            config_file=config_file,
            host=host,
            port=port
        )
        
        # 验证自定义节点目录
        nodes_dir_path = config.get_custom_nodes_dir()
        if not nodes_dir_path.exists():
            click.echo(f"提示: 自定义节点目录不存在，将自动创建: {nodes_dir_path}", err=True)
            nodes_dir_path.mkdir(parents=True, exist_ok=True)
        
        click.echo(f"启动服务在 {config.get_host()}:{config.get_port()}")
        click.echo(f"自定义节点目录: {nodes_dir_path}")
        
        # 启动 uvicorn 服务器
        uvicorn.run(
            "api.main:app",
            host=config.get_host(),
            port=config.get_port(),
            reload=reload,
            log_level="info"
        )
        
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()


