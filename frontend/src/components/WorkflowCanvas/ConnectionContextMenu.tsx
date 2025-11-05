import React from 'react'
import './ConnectionContextMenu.css'

interface ConnectionContextMenuProps {
  x: number
  y: number
  onSelect: () => void
  onClose: () => void
  disabled?: boolean // 是否禁用选项
}

const ConnectionContextMenu: React.FC<ConnectionContextMenuProps> = ({
  x,
  y,
  onSelect,
  onClose,
  disabled = false,
}) => {
  React.useEffect(() => {
    const handleClickOutside = () => {
      onClose()
    }
    
    // 延迟添加事件监听，避免立即触发
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 0)
    
    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [onClose])

  return (
    <div
      className="connection-context-menu"
      style={{
        position: 'fixed',
        left: `${x}px`,
        top: `${y}px`,
        zIndex: 1000,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={`connection-context-menu-item ${disabled ? 'disabled' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          if (!disabled) {
            onSelect()
            onClose()
          }
        }}
        style={{
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          color: disabled ? '#999' : undefined,
        }}
        title={disabled ? '内置节点的接口不能修改' : undefined}
      >
        创建输入参数并连接
      </div>
    </div>
  )
}

export default ConnectionContextMenu

