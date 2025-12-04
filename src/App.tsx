import { Button } from '@heroui/react'
import { invoke } from '@tauri-apps/api/core'
import { useEffect, useState } from 'react'

function App() {
  const [larkPath, setLarkPath] = useState<string | null>(null)

  function handleClick() {
    invoke<string>('get_lark_path').then(setLarkPath)
  }

  useEffect(() => {
    invoke('wait_until_lark_ended').then(() => {
      console.log('xx', 'finally')
    })
  }, [])

  return (
    <main className="container">
      <p>Lark path: {larkPath}</p>
      <Button onPress={handleClick}>Get Lark Path</Button>
    </main>
  )
}

export default App
