let context: CanvasRenderingContext2D | null | undefined

export function isColor(value: string): boolean {
  return Boolean(value.trim()) && typeof CSS !== 'undefined' && CSS.supports('color', value)
}

/** 原生取色器只接受 #rrggbb；无法换算（如含透明度或变量）时返回 null。 */
export function toHex(value: string): string | null {
  if (!isColor(value)) return null
  if (context === undefined) context = document.createElement('canvas').getContext('2d')
  if (!context) return null
  context.fillStyle = '#000000'
  context.fillStyle = value
  const result = String(context.fillStyle)
  return /^#[0-9a-f]{6}$/i.test(result) ? result : null
}
