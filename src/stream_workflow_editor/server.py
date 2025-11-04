"""
服务器启动模块
"""
import click
import sys
from pathlib import Path
from stream_workflow_editor.api.config import config
import uvicorn


def start_server(work_dir=None, nodes_dir=None, config_file=None, project_root=None, host=None, port=None, reload=False):
    """启动服务器"""
    try:
        # 检测是否为生产模式（是否有已编译的静态文件）
        package_dir = Path(__file__).parent
        static_dir = package_dir / "static"
        has_static_files = static_dir.exists() and (static_dir / "index.html").exists()
        
        # 如果用户没有明确指定端口，根据模式自动设置
        # 生产模式：3000，开发模式：3010
        if port is None:
            if has_static_files:
                # 生产模式：前后端共用 3000 端口
                port = 3000
            else:
                # 开发模式：后端使用 3010 端口
                port = 3010
        
        # 初始化配置
        config.initialize(
            work_dir=work_dir,
            nodes_dir=nodes_dir,
            config_file=config_file,
            project_root=project_root,
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
            "stream_workflow_editor.api.main:app",
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
    '--project-root', '-r',
    type=click.Path(exists=True, file_okay=False, dir_okay=True, path_type=str),
    help='项目根目录，用于导入项目模块'
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
def cli(work_dir, nodes_dir, config_file, project_root, host, port, reload):
    """Stream Workflow 服务器命令行入口"""
    start_server(work_dir, nodes_dir, config_file, project_root, host, port, reload)


if __name__ == "__main__":
    cli()

