import { Button, ButtonProps, Tooltip } from '@heroui/react'
import classNames from 'classnames'
import { useState } from 'react'

import './index.scss'

export interface DoubleCheckButtonProps extends Omit<ButtonProps, 'onPress'> {
  onDoubleChecked: () => void
  temporaryDisableText?: string
  doubleCheckText?: string
  fullDoubleCheckText?: string
}

export function DoubleCheckButton(props: DoubleCheckButtonProps) {
  const {
    onDoubleChecked,
    children,
    doubleCheckText = '再按一次确认',
    temporaryDisableText,
    fullDoubleCheckText,
    onMouseLeave,
    color,
    disabled,
    style,
    className,
    ...rest
  } = props
  const [isInDoubleCheck, setIsInDoubleCheck] = useState(false)
  const [temporarilyDisabled, setTemporarilyDisabled] = useState(false)

  const shouldShowTooltips = Boolean(fullDoubleCheckText && isInDoubleCheck)

  function handlePress() {
    if (isInDoubleCheck) {
      onDoubleChecked()
      setIsInDoubleCheck(false)
      setTemporarilyDisabled(true)
      return
    }
    setIsInDoubleCheck(true)
  }

  function handleMouseLeave(e: React.MouseEvent<HTMLButtonElement>) {
    setIsInDoubleCheck(false)
    setTemporarilyDisabled(false)
    onMouseLeave?.(e)
  }

  return (
    <Tooltip content={fullDoubleCheckText} placement="top" color="foreground" isOpen={shouldShowTooltips}>
      <Button
        {...rest}
        color={isInDoubleCheck ? 'danger' : color}
        disabled={temporarilyDisabled || disabled}
        onMouseLeave={handleMouseLeave}
        onPress={handlePress}
        className={classNames('double-check-button', className)}
        style={{
          ...style,
          opacity: temporarilyDisabled ? 0.5 : 1,
          cursor: temporarilyDisabled ? 'not-allowed' : style?.cursor,
        }}
      >
        {temporarilyDisabled ? temporaryDisableText : isInDoubleCheck ? doubleCheckText : children}
      </Button>
    </Tooltip>
  )
}
