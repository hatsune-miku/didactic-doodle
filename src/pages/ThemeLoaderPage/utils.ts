export function isColorLike(value: string): boolean {
  const v = value.trim()
  if (/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) {
    return true
  }
  if (/^(rgb|rgba|hsl|hsla)\(/i.test(v)) {
    return true
  }
  const named = [
    'red',
    'green',
    'blue',
    'black',
    'white',
    'pink',
    'gray',
    'grey',
    'orange',
    'yellow',
    'purple',
    'cyan',
    'magenta',
    'transparent',
  ]
  if (named.includes(v.toLowerCase())) {
    return true
  }
  return false
}
