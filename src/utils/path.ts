export function joinPath(basePath: string, ...paths: string[]): string {
  return paths.reduce((acc, path) => {
    return `${acc}\\${path}`
  }, basePath)
}
