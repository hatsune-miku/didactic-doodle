// Browser-only fixture. It never connects to Tauri or writes to an installed app.
import ReactDOM from 'react-dom/client'

import '@a1knla/cakeui/style.css'
import { mockIPC, mockWindows } from '@tauri-apps/api/mocks'

import App from '../../src/App'
import { useLogsStore } from '../../src/store/logs'

import '../../shared/ui.scss'

const scenario = new URLSearchParams(location.search).get('scenario') || 'ready'
const entries = [
  { id: 'sakura', fileName: 'sakura.yaml', enabled: true },
  { id: 'type', fileName: 'type.yaml', enabled: true },
  { id: 'quiet', fileName: 'quiet.yaml', enabled: false },
]
const names = ['浅樱', '清晰文字', '安静模式']
const descriptions = ['柔和的消息背景与粉色强调', '调整消息文字与段落间距', '收起不常用的视觉元素']
const themes = Object.fromEntries(
  entries.map((entry, index) => [
    entry.fileName,
    JSON.stringify({
      id: entry.id,
      name: names[index],
      description: descriptions[index],
      author: 'Miku',
      asarPatches: {
        'webcontent/messenger.asar': [
          {
            kind: 'main-script',
            subject: 'messenger',
            styleOverridesBySelector: { '.message': { color: '#744958', 'line-height': '1.7' } },
            colorOverrides: {},
            enableDevTools: false,
          },
        ],
      },
    }),
  ])
)
let manifest = JSON.stringify({ themes: scenario === 'empty' ? [] : entries })
let allowed = scenario !== 'permission'
let failed = false
let running = scenario === 'running'
mockWindows('main')
mockIPC(
  async (command, payload) => {
    const args = payload as Record<string, unknown>
    switch (command) {
      case 'plugin:app|version':
        return '0.1.7'
      case 'plugin:window|set_title':
        return
      case 'get_lark_base_path':
        return '/Applications/Lark.app'
      case 'is_lark_running':
        return running
      case 'launch_lark':
        running = true
        return
      case 'kill_lark':
        running = false
        return
      case 'read_theme_manifest':
        if (scenario === 'missing') throw new Error('读取主题清单失败: Permission denied')
        return manifest
      case 'write_theme_manifest':
        manifest = String(args.content)
        return
      case 'read_theme':
        return themes[String(args.fileName)]
      case 'pick_theme_file':
        return { suggestedId: 'sakura', content: themes['sakura.yaml'] }
      case 'save_theme':
        return 'sakura.yaml'
      case 'delete_theme':
        return
      case 'check_lark_write_access':
        if (!allowed) throw 'APP_MANAGEMENT_REQUIRED: 系统阻止修改飞书'
        return
      case 'open_app_management_settings':
        allowed = true
        return
      case 'create_lark_session':
        return 'preview'
      case 'close_lark_session':
        return
      case 'invoke_lark_session':
        if (args.command === 'apply_patches') {
          if (scenario === 'working') await new Promise((resolve) => setTimeout(resolve, 5000))
          if (scenario === 'error' && !failed) {
            failed = true
            throw new Error('写入飞书资源失败: No space left on device')
          }
        }
        return ''
      case 'plugin:opener|open_url':
        useLogsStore.getState().add('预览模式：主题编辑器链接已打开')
        return
      default:
        throw new Error(`未模拟的命令: ${command}`)
    }
  },
  { shouldMockEvents: true }
)
ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
