"""
构建前端并复制到包目录
"""
import subprocess
import shutil
from pathlib import Path


def build_frontend():
    """构建前端并复制到包目录"""
    project_root = Path(__file__).parent
    frontend_dir = project_root / "frontend"
    static_dir = project_root / "src" / "stream_workflow_editor" / "static"
    
    if not frontend_dir.exists():
        print(f"错误: 找不到前端目录: {frontend_dir}")
        return False
    
    print(f"前端目录: {frontend_dir}")
    print(f"静态文件目录: {static_dir}")
    
    # 运行 npm build
    print("正在构建前端...")
    try:
        import os
        original_dir = os.getcwd()
        os.chdir(frontend_dir)
        
        # 检查 node_modules 是否存在
        if not (frontend_dir / "node_modules").exists():
            print("未找到 node_modules，正在安装依赖...")
            subprocess.run(["npm", "install"], check=True)
        
        # 构建前端
        subprocess.run(["npm", "run", "build"], check=True)
        
        os.chdir(original_dir)
        
    except subprocess.CalledProcessError as e:
        print(f"错误: 构建前端失败: {e}")
        return False
    except FileNotFoundError:
        print("错误: 未找到 npm 命令。请确保已安装 Node.js。")
        return False
    
    # 复制构建产物到包目录
    dist_dir = frontend_dir / "dist"
    if not dist_dir.exists():
        print(f"错误: 构建产物目录不存在: {dist_dir}")
        return False
    
    print(f"复制构建产物从 {dist_dir} 到 {static_dir}...")
    
    # 删除旧的静态文件
    if static_dir.exists():
        shutil.rmtree(static_dir)
    
    # 复制新的静态文件
    shutil.copytree(dist_dir, static_dir)
    
    print("前端构建完成！")
    return True


if __name__ == "__main__":
    success = build_frontend()
    exit(0 if success else 1)


