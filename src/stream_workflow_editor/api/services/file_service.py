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


def represent_multiline_str(dumper, data):
    """
    自定义字符串表示器，对于多行字符串使用块标量格式（|）
    
    对于包含换行符的字符串（如代码、多行文本），自动使用 YAML 的 | 模式保存。
    同时处理真正的换行符和转义的换行符字符串（\\n）。
    
    Args:
        dumper: YAML Dumper 实例
        data: 要序列化的数据
    
    Returns:
        YAML 节点对象，使用块标量格式（|）表示多行字符串
    """
    if isinstance(data, str):
        # 检查是否包含真正的换行符
        has_real_newline = '\n' in data or '\r' in data
        
        # 检查是否包含转义的换行符字符串（\\n，即反斜杠加n）
        # 这通常发生在从JSON或前端传来的字符串中包含字面的 \n 字符时
        has_escaped_newline = '\\n' in data
        
        # 如果包含换行符（真正的或转义的），使用块标量格式
        if has_real_newline or has_escaped_newline:
            # 如果只包含转义的换行符而没有真正的换行符，需要转换
            if has_escaped_newline and not has_real_newline:
                # 将字面的 \\n 转换为真正的换行符 \n
                # 注意：在Python字符串中，'\\n' 表示两个字符（反斜杠和n）
                # 我们需要将其替换为一个字符（换行符）
                processed_data = data.replace('\\n', '\n').replace('\\r', '\r').replace('\\t', '\t')
                # 处理双反斜杠的情况：\\\\ -> \\（保留字面的反斜杠）
                processed_data = processed_data.replace('\\\\', '\\')
            else:
                processed_data = data
            
            # 使用块标量格式（|），保留换行符和末尾换行
            return dumper.represent_scalar('tag:yaml.org,2002:str', processed_data, style='|')
    
    # 单行字符串使用默认格式
    return dumper.represent_scalar('tag:yaml.org,2002:str', data)


class MultilineStrDumper(yaml.SafeDumper):
    """
    自定义 Dumper 类，继承自 SafeDumper
    
    支持多行字符串自动使用 YAML 块标量格式（|）保存，
    确保代码和多行文本以可读的格式保存。
    """
    pass


# 注册自定义表示器到自定义 Dumper
# 这样在序列化字符串时会自动调用 represent_multiline_str 函数
MultilineStrDumper.add_representer(str, represent_multiline_str)


def validate_filename(filename: str) -> bool:
    """
    验证文件名是否有效
    - 只允许字母、数字、下划线、中文字符和连字符
    - 必须包含文件扩展名 .yaml 或 .yml
    - 不允许路径遍历字符
    - 支持子目录路径（使用正斜杠）
    """
    if not filename:
        return False
    
    # 检查路径遍历攻击
    if '..' in filename or '\\' in filename:
        return False
    
    # 检查文件扩展名
    if not (filename.endswith('.yaml') or filename.endswith('.yml')):
        return False
    
    # 分离路径和文件名
    parts = filename.split('/')
    
    # 验证每个路径部分
    for part in parts[:-1]:  # 检查目录名
        if not part:  # 不允许空目录名
            return False
        # 允许字母、数字、下划线、连字符、中文字符
        pattern = r'^[\w\-_\u4e00-\u9fa5]+$'
        if not re.match(pattern, part):
            return False
    
    # 验证文件名部分
    name_without_ext = parts[-1].rsplit('.', 1)[0]
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
    支持子目录路径（使用正斜杠）
    """
    # 统一使用正斜杠，移除路径遍历字符
    filename = filename.replace('\\', '/').replace('..', '')
    # 分割路径
    parts = filename.split('/')
    # 清理每个部分
    cleaned_parts = []
    for part in parts:
        # 移除非法字符，只保留字母、数字、下划线、连字符、中文和点
        cleaned = re.sub(r'[^\w\-_\.\u4e00-\u9fa5]', '', part)
        if cleaned:  # 忽略空部分
            cleaned_parts.append(cleaned)
    return '/'.join(cleaned_parts)


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
    列出所有YAML文件（包括子目录）
    返回文件信息列表，包含文件名（相对路径）、大小、修改时间等
    """
    yaml_dir = get_yaml_directory()
    files = []
    
    # 递归搜索所有 .yaml 文件
    for file_path in yaml_dir.rglob('*.yaml'):
        if file_path.is_file():
            stat = file_path.stat()
            # 获取相对路径，使用正斜杠作为分隔符
            relative_path = file_path.relative_to(yaml_dir)
            files.append({
                'filename': str(relative_path).replace('\\', '/'),
                'size': stat.st_size,
                'modified': stat.st_mtime,
            })
    
    # 递归搜索所有 .yml 文件
    for file_path in yaml_dir.rglob('*.yml'):
        if file_path.is_file():
            stat = file_path.stat()
            # 获取相对路径，使用正斜杠作为分隔符
            relative_path = file_path.relative_to(yaml_dir)
            files.append({
                'filename': str(relative_path).replace('\\', '/'),
                'size': stat.st_size,
                'modified': stat.st_mtime,
            })
    
    # 按文件名排序
    files.sort(key=lambda x: x['filename'])
    return files


def read_yaml_file(filename: str) -> Dict[str, Any]:
    """
    读取YAML文件内容
    支持子目录路径（如 'subdir/config.yaml'）
    """
    if not validate_filename(filename):
        raise ValueError(f'无效的文件名: {filename}')
    
    # 将路径中的正斜杠转换为系统路径分隔符
    file_path = get_yaml_directory() / filename.replace('/', os.sep)
    
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
    支持子目录路径（如 'subdir/config.yaml'），自动创建目录
    """
    if not validate_filename(filename):
        raise ValueError(f'无效的文件名: {filename}')
    
    # 将路径中的正斜杠转换为系统路径分隔符
    file_path = get_yaml_directory() / filename.replace('/', os.sep)
    
    # 检查文件是否存在
    if file_path.exists() and not overwrite:
        raise FileExistsError(f'文件已存在: {filename}')
    
    try:
        # 确保父目录存在
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            # 使用自定义 Dumper，自动将多行字符串转换为块标量格式（|）
            # 这样代码和多行文本会以可读的格式保存，而不是压缩成一行
            yaml.dump(
                content,
                f,
                Dumper=MultilineStrDumper,
                allow_unicode=True,
                default_flow_style=False,
                sort_keys=False,
                default_style=None,  # 不强制使用引号
                width=4096,  # 设置较大的宽度，避免自动换行
            )
        
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
    支持子目录路径（如 'subdir/config.yaml'）
    """
    if not validate_filename(filename):
        raise ValueError(f'无效的文件名: {filename}')
    
    # 将路径中的正斜杠转换为系统路径分隔符
    file_path = get_yaml_directory() / filename.replace('/', os.sep)
    
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
    支持子目录路径（如 'subdir/config.yaml'）
    """
    if not validate_filename(old_name):
        raise ValueError(f'无效的旧文件名: {old_name}')
    
    if not validate_filename(new_name):
        raise ValueError(f'无效的新文件名: {new_name}')
    
    # 将路径中的正斜杠转换为系统路径分隔符
    old_path = get_yaml_directory() / old_name.replace('/', os.sep)
    new_path = get_yaml_directory() / new_name.replace('/', os.sep)
    
    if not old_path.exists():
        raise FileNotFoundError(f'文件不存在: {old_name}')
    
    if new_path.exists():
        raise FileExistsError(f'目标文件已存在: {new_name}')
    
    try:
        # 确保目标目录存在
        new_path.parent.mkdir(parents=True, exist_ok=True)
        
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
    支持子目录路径（如 'subdir/config.yaml'）
    """
    if not validate_filename(filename):
        return False
    
    # 将路径中的正斜杠转换为系统路径分隔符
    file_path = get_yaml_directory() / filename.replace('/', os.sep)
    return file_path.exists()

