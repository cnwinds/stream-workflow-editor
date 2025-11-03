"""
Stream Workflow 统一 CLI 入口
支持启动服务器、客户端或同时启动
"""
import click
import sys
import os
from pathlib import Path
import threading
import time

from stream_workflow_editor.server import start_server
from stream_workflow_editor.client import start_client_dev


# 共享的服务器选项
server_options = [
    click.option(
        '--work-dir', '-w',
        type=click.Path(exists=True, file_okay=False, dir_okay=True, path_type=str),
        help='工作目录，将在该目录下查找 custom_nodes'
    ),
    click.option(
        '--nodes-dir', '-n',
        type=click.Path(exists=True, file_okay=False, dir_okay=True, path_type=str),
        help='自定义节点目录的绝对或相对路径'
    ),
    click.option(
        '--config', '-c',
        'config_file',
        type=click.Path(exists=True, file_okay=True, dir_okay=False, path_type=str),
        help='配置文件路径（YAML 格式）'
    ),
    click.option(
        '--project-root', '-r',
        type=click.Path(exists=True, file_okay=False, dir_okay=True, path_type=str),
        help='项目根目录，用于导入项目模块'
    ),
    click.option(
        '--host',
        default=None,
        help='服务监听地址（默认: 0.0.0.0）'
    ),
    click.option(
        '--port', '-p',
        type=int,
        default=None,
        help='服务监听端口（默认: 3010）'
    ),
    click.option(
        '--reload/--no-reload',
        default=False,
        help='是否启用自动重载（开发模式）'
    ),
]


def add_options(options):
    """装饰器：添加选项到命令"""
    def _add_options(func):
        for option in reversed(options):
            func = option(func)
        return func
    return _add_options


@click.group()
def cli():
    """Stream Workflow 编辑器命令行工具"""
    pass


@cli.command()
@add_options(server_options)
def server(work_dir, nodes_dir, config_file, project_root, host, port, reload):
    """
    启动后端服务器
    
    启动 Stream Workflow API 服务，支持从任意目录启动。
    
    配置优先级：命令行参数 > 环境变量 > 配置文件 > 自动检测
    
    示例:
        \b
        # 在当前目录启动（自动检测 custom_nodes）
        stream-workflow server
        
        \b
        # 指定工作目录
        stream-workflow server --work-dir /path/to/project
        
        \b
        # 直接指定自定义节点目录
        stream-workflow server --nodes-dir /path/to/custom/nodes
    """
    start_server(work_dir, nodes_dir, config_file, project_root, host, port, reload)


@cli.command()
@click.option(
    '--port', '-p',
    type=int,
    default=3000,
    help='前端开发服务器端口（默认: 3000）'
)
def client(port):
    """
    启动前端开发服务器
    
    启动 Vite 开发服务器（仅在开发模式下可用）。
    
    示例:
        \b
        # 启动前端开发服务器
        stream-workflow client
        
        \b
        # 指定端口
        stream-workflow client --port 3000
    """
    start_client_dev(port)


@cli.command()
@add_options(server_options)
@click.option(
    '--client-port',
    type=int,
    default=3000,
    help='前端开发服务器端口（默认: 3000）'
)
@click.option(
    '--no-client',
    is_flag=True,
    help='不启动前端开发服务器，仅启动后端'
)
def start(work_dir, nodes_dir, config_file, project_root, host, port, reload, client_port, no_client):
    """
    同时启动服务器和客户端（开发模式）
    
    启动后端 API 服务和前端开发服务器。
    
    示例:
        \b
        # 同时启动前后端
        stream-workflow start
        
        \b
        # 仅启动后端
        stream-workflow start --no-client
    """
    if no_client:
        # 仅启动服务器
        start_server(work_dir, nodes_dir, config_file, project_root, host, port, reload)
    else:
        # 在后台线程启动客户端
        def run_client():
            time.sleep(2)  # 等待服务器启动
            try:
                start_client_dev(client_port)
            except SystemExit:
                pass
        
        client_thread = threading.Thread(target=run_client, daemon=True)
        client_thread.start()
        
        # 启动服务器（主线程）
        start_server(work_dir, nodes_dir, config_file, project_root, host, port, reload)


# 为了向后兼容，保留 server 作为默认命令
def main():
    """主入口函数"""
    cli()


if __name__ == "__main__":
    main()

