"""
客户端启动模块（开发模式）
"""
import click
import subprocess
import sys
import shutil
import os
from pathlib import Path


def start_client_dev(port=3000):
    """启动前端开发服务器"""
    try:
        # 查找前端目录
        # 策略：1. 从当前工作目录查找 2. 从包目录向上查找
        frontend_dir = None
        
        # 1. 尝试从当前工作目录查找
        cwd = Path.cwd()
        potential_frontend = cwd / "frontend"
        if potential_frontend.exists() and (potential_frontend / "package.json").exists():
            frontend_dir = potential_frontend
        
        # 2. 如果没找到，尝试从包安装位置向上查找（开发模式）
        if frontend_dir is None:
            package_file = Path(__file__)
            # 从 client.py -> stream_workflow_editor -> src -> 项目根目录
            # 但在安装后，路径可能是 site-packages/stream_workflow_editor
            # 所以需要更智能的查找
            current = package_file.parent.parent  # stream_workflow_editor 目录
            # 如果是在 src/ 目录下（开发模式）
            if current.parent.name == "src":
                project_root = current.parent.parent
                potential_frontend = project_root / "frontend"
                if potential_frontend.exists() and (potential_frontend / "package.json").exists():
                    frontend_dir = potential_frontend
        
        if frontend_dir is None:
            click.echo("错误: 找不到前端目录。", err=True)
            click.echo("提示: 请在项目根目录运行此命令，或确保 frontend/ 目录存在。", err=True)
            click.echo(f"当前工作目录: {Path.cwd()}", err=True)
            sys.exit(1)
        
        click.echo(f"启动前端开发服务器在 http://localhost:{port}")
        click.echo(f"前端目录: {frontend_dir}")
        
        # 查找 npm 命令
        npm_cmd = shutil.which("npm")
        if not npm_cmd:
            # Windows 上可能需要在 PATH 中查找 npm.cmd
            if sys.platform == "win32":
                npm_cmd = shutil.which("npm.cmd")
            if not npm_cmd:
                click.echo("错误: 未找到 npm 命令。请确保已安装 Node.js 并将其添加到 PATH 环境变量中。", err=True)
                click.echo(f"提示: 当前 PATH 环境变量: {os.environ.get('PATH', '未设置')}", err=True)
                sys.exit(1)
        
        click.echo(f"使用 npm: {npm_cmd}")
        
        # 运行 npm dev
        original_cwd = os.getcwd()
        os.chdir(frontend_dir)
        try:
            # 在 Windows 上，确保使用正确的 npm 命令
            if sys.platform == "win32" and not npm_cmd.endswith('.cmd'):
                # 如果找到的是 npm（不带 .cmd），尝试使用 npm.cmd
                npm_exec = ["npm.cmd"] if shutil.which("npm.cmd") else ["npm"]
            else:
                npm_exec = [npm_cmd] if npm_cmd else ["npm"]
            
            # 使用 shell=True 在 Windows 上可能更可靠
            use_shell = sys.platform == "win32"
            
            subprocess.run(
                npm_exec + ["run", "dev"],
                check=True,
                shell=use_shell
            )
        finally:
            os.chdir(original_cwd)
        
    except subprocess.CalledProcessError as e:
        click.echo(f"错误: 启动前端开发服务器失败: {e}", err=True)
        sys.exit(1)
    except FileNotFoundError:
        click.echo("错误: 未找到 npm 命令。请确保已安装 Node.js 并将其添加到 PATH 环境变量中。", err=True)
        click.echo(f"提示: 当前 PATH: {os.environ.get('PATH', '未设置')}", err=True)
        sys.exit(1)
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)


