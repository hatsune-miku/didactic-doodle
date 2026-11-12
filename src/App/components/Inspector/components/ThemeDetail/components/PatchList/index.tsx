import PatchItem from './components/PatchItem'

import { WalTheme } from '../../../../../../../theme/types'

import './index.scss'

export default function PatchList({ theme }: { theme: WalTheme }) {
  const archives = Object.entries(theme.asarPatches).filter(([, patches]) => patches.length > 0)
  if (archives.length === 0) {
    return <p className="patch-list-empty">此主题没有修改任何文件。</p>
  }

  return (
    <div className="patch-list wal-copyable">
      {archives.map(([archive, patches]) => (
        <section key={archive} className="patch-list-archive" aria-label={archive}>
          <h3 className="patch-list-archive-path">{archive}</h3>
          {patches.map((patch, index) => (
            <PatchItem key={index} patch={patch} />
          ))}
        </section>
      ))}
    </div>
  )
}
