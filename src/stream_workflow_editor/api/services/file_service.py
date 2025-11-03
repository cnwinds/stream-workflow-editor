"""
文件管理服务
管理工作流YAML配置文件
文件存储在服务器启动时的当前工作目录中
"""
import os
import re
from pathlib import Path
from typing import List, Dict, Any
import yaml


def validate_filename(filename: str) -> bool:
    """
    验证文件名是否有效
    - 只允许字母、数字、下划线、中文字符和连字符
    - 必须包含文件扩展名 .yaml 或 .yml
    - 不允许路径遍历字符
    """
    if not filename:
        return False
    
    # 检查路径遍历攻击
    if '..' in filename or '/' in filename or '\\' in filename:
        return False
    
    # 检查文件扩展名
    if not (filename.endswith('.yaml') or filename.endswith('.yml')):
        return False
    
    # 检查文件名格式（允许字母、数字、下划线、连字符、中文）
    name_without_ext = filename.rsplit('.', 1)[0]
    if not name_without_ext:
        return False
    
    # 允许字母、数字、下划线、连字符、中文字符
    pattern = r'^[\w\-_\u4e00-\u9fa5]+$'
    if not re.match(pattern, name_without_ext):
        return False
    
    return True


def sanitize_filename(filename: str) -> str:
    """
    清理文件名，移除非法字符
    """
    # 移除路径分隔符
    filename = filename.replace('/', '').replace('\\', '').replace('..', '')
    # 移除其他非法字符，只保留字母、数字、下划线、连字符、中文和点
    filename = re.sub(r'[^\w\-_\.\u4e00-\u9fa5]', '', filename)
    return filename


def get_yaml_directory() -> Path:
    """
    获取YAML文件存储目录
    
    使用服务器启动时的当前工作目录作为配置文件保存路径。
    这样可以确保文件保存在用户启动服务器时所在的目录中。
    """
    # 直接使用当前工作目录（服务器启动时的目录）
    directory = Path.cwd()
    
    # 确保目录存在
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def list_yaml_files() -> List[Dict[str, Any]]:
    """
    列出所有YAML文件
    返回文件信息列表，包含文件名、大小、修改时间等
    """
    yaml_dir = get_yaml_directory()
    files = []
    
    for file_path in yaml_dir.glob('*.yaml'):
        if file_path.is_file():
            stat = file_path.stat()
            files.append({
                'filename': file_path.name,
                'size': stat.st_size,
                'modified': stat.st_mtime,
            })
    
    for file_path in yaml_dir.glob('*.yml'):
        if file_path.is_file():
            stat = file_path.stat()
            files.append({
                'filename': file_path.name,
                'size': stat.st_size,
                'modified': stat.st_mtime,
            })
    
    # 按文件名排序
    files.sort(key=lambda x: x['filename'])
    return files


def read_yaml_file(filename: str) -> Dict[str, Any]:
    """
    读取YAML文件内容
    """
    if not validate_filename(filename):
        raise ValueError(f'无效的文件名: {filename}')
    
    file_path = get_yaml_directory() / filename
    
    if not file_path.exists():
        raise FileNotFoundError(f'文件不存在: {filename}')
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = yaml.safe_load(f)
            if content is None:
                content = {}
            return content
    except yaml.YAMLError as e:
        raise ValueError(f'YAML解析错误: {str(e)}')
    except Exception as e:
        raise IOError(f'读取文件失败: {str(e)}')


def save_yaml_file(filename: str, content: Dict[str, Any], overwrite: bool = False) -> Dict[str, Any]:
    """
    保存YAML文件
    """
    if not validate_filename(filename):
        raise ValueError(f'无效的文件名: {filename}')
    
    file_path = get_yaml_directory() / filename
    
    # 检查文件是否存在
    if file_path.exists() and not overwrite:
        raise FileExistsError(f'文件已存在: {filename}')
    
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            yaml.dump(content, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
        
        stat = file_path.stat()
        return {
            'filename': filename,
            'size': stat.st_size,
            'modified': stat.st_mtime,
        }
    except Exception as e:
        raise IOError(f'保存文件失败: {str(e)}')


def delete_yaml_file(filename: str) -> bool:
    """
    删除YAML文件
    """
    if not validate_filename(filename):
        raise ValueError(f'无效的文件名: {filename}')
    
    file_path = get_yaml_directory() / filename
    
    if not file_path.exists():
        raise FileNotFoundError(f'文件不存在: {filename}')
    
    try:
        file_path.unlink()
        return True
    except Exception as e:
        raise IOError(f'删除文件失败: {str(e)}')


def rename_yaml_file(old_name: str, new_name: str) -> Dict[str, Any]:
    """
    重命名YAML文件
    """
    if not validate_filename(old_name):
        raise ValueError(f'无效的旧文件名: {old_name}')
    
    if not validate_filename(new_name):
        raise ValueError(f'无效的新文件名: {new_name}')
    
    old_path = get_yaml_directory() / old_name
    new_path = get_yaml_directory() / new_name
    
    if not old_path.exists():
        raise FileNotFoundError(f'文件不存在: {old_name}')
    
    if new_path.exists():
        raise FileExistsError(f'目标文件已存在: {new_name}')
    
    try:
        old_path.rename(new_path)
        stat = new_path.stat()
        return {
            'filename': new_name,
            'size': stat.st_size,
            'modified': stat.st_mtime,
        }
    except Exception as e:
        raise IOError(f'重命名文件失败: {str(e)}')


def file_exists(filename: str) -> bool:
    """
    检查文件是否存在
    """
    if not validate_filename(filename):
        return False
    
    file_path = get_yaml_directory() / filename
    return file_path.exists()

