"""
全局配置管理器
支持从命令行参数、环境变量、配置文件或自动检测获取配置
优先级：命令行参数 > 环境变量 > 配置文件 > 自动检测
"""
import os
import sys
from pathlib import Path
from typing import Optional
import yaml

class Config:
    """全局配置管理器"""
    
    _instance = None
    _custom_nodes_dir: Optional[Path] = None
    _host: str = "0.0.0.0"
    _port: int = 3010
    _initialized: bool = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Config, cls).__new__(cls)
        return cls._instance
    
    def initialize(
        self,
        work_dir: Optional[str] = None,
        nodes_dir: Optional[str] = None,
        config_file: Optional[str] = None,
        host: Optional[str] = None,
        port: Optional[int] = None
    ):
        """
        初始化配置
        
        优先级：命令行参数 > 环境变量 > 配置文件 > 自动检测
        
        Args:
            work_dir: 工作目录（命令行参数）
            nodes_dir: 自定义节点目录（命令行参数）
            config_file: 配置文件路径（命令行参数）
            host: 服务主机（命令行参数）
            port: 服务端口（命令行参数）
        """
        if self._initialized:
            return
        
        # 1. 命令行参数优先级最高
        cmd_nodes_dir = nodes_dir
        cmd_host = host
        cmd_port = port
        
        # 2. 环境变量
        env_nodes_dir = os.environ.get("CUSTOM_NODES_DIR")
        env_host = os.environ.get("SERVER_HOST")
        env_port = os.environ.get("SERVER_PORT")
        env_config_file = os.environ.get("CONFIG_FILE")
        
        # 3. 配置文件（如果没有通过命令行指定，使用环境变量或默认位置）
        config_file_path = config_file or env_config_file
        if config_file_path:
            config_file_path = Path(config_file_path).resolve()
        else:
            # 尝试在当前工作目录或工作目录中查找 config.yaml
            if work_dir:
                work_path = Path(work_dir).resolve()
            else:
                work_path = Path.cwd()
            config_file_path = work_path / "config.yaml"
        
        config_data = {}
        if config_file_path and config_file_path.exists():
            try:
                with open(config_file_path, 'r', encoding='utf-8') as f:
                    config_data = yaml.safe_load(f) or {}
            except Exception as e:
                print(f"警告: 加载配置文件失败: {e}")
        
        # 4. 确定自定义节点目录（优先级：命令行 > 环境变量 > 配置文件 > 自动检测）
        nodes_dir_path = None
        
        if cmd_nodes_dir:
            nodes_dir_path = Path(cmd_nodes_dir).resolve()
        elif env_nodes_dir:
            nodes_dir_path = Path(env_nodes_dir).resolve()
        elif config_data.get("custom_nodes_dir"):
            nodes_dir_from_config = config_data["custom_nodes_dir"]
            nodes_dir_path = Path(nodes_dir_from_config)
            if nodes_dir_path.is_absolute():
                nodes_dir_path = nodes_dir_path.resolve()
            else:
                # 如果是相对路径，相对于配置文件所在目录
                nodes_dir_path = config_file_path.parent / nodes_dir_path
                nodes_dir_path = nodes_dir_path.resolve()
        else:
            # 自动检测：在当前工作目录或指定工作目录下查找 custom_nodes
            if work_dir:
                work_path = Path(work_dir).resolve()
            else:
                work_path = Path.cwd()
            
            # 尝试查找 custom_nodes 目录
            potential_dirs = [
                work_path / "custom_nodes",
                work_path / "nodes",
                work_path / ".nodes",
            ]
            
            for potential_dir in potential_dirs:
                if potential_dir.exists() and potential_dir.is_dir():
                    nodes_dir_path = potential_dir.resolve()
                    break
            
            # 如果找不到，使用工作目录下的 custom_nodes（即使不存在也会创建）
            if nodes_dir_path is None:
                nodes_dir_path = work_path / "custom_nodes"
        
        self._custom_nodes_dir = nodes_dir_path
        
        # 确定主机和端口
        self._host = cmd_host or env_host or config_data.get("host", "0.0.0.0")
        self._port = cmd_port or (int(env_port) if env_port else None) or config_data.get("port", 3010)
        
        # 将自定义节点目录添加到 Python 路径
        self._add_to_python_path(nodes_dir_path)
        
        self._initialized = True
        
        print(f"配置已初始化:")
        print(f"  自定义节点目录: {self._custom_nodes_dir}")
        print(f"  服务地址: {self._host}:{self._port}")
    
    def _add_to_python_path(self, nodes_dir: Path):
        """将自定义节点目录添加到 Python 路径以便导入"""
        nodes_dir_str = str(nodes_dir)
        if nodes_dir_str not in sys.path:
            sys.path.insert(0, nodes_dir_str)
            print(f"  已添加 Python 路径: {nodes_dir_str}")
    
    def get_custom_nodes_dir(self) -> Path:
        """获取自定义节点目录路径"""
        if not self._initialized:
            raise RuntimeError("配置未初始化，请先调用 initialize()")
        return self._custom_nodes_dir
    
    def get_registry_file(self) -> Path:
        """获取注册表文件路径"""
        return self.get_custom_nodes_dir() / "registry.json"
    
    def get_templates_dir(self) -> Path:
        """获取模板目录路径"""
        return self.get_custom_nodes_dir() / "templates"
    
    def get_host(self) -> str:
        """获取服务主机"""
        return self._host
    
    def get_port(self) -> int:
        """获取服务端口"""
        return self._port
    
    def is_initialized(self) -> bool:
        """检查配置是否已初始化"""
        return self._initialized

# 全局单例
config = Config()

