import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LarkSession, NativeBridge } from './bridge'

describe('NativeBridge.withLarkSession', () => {
  const bridge = new NativeBridge()
  const close = vi.fn<() => Promise<void>>()
  const session = new LarkSession('test-session', bridge)

  beforeEach(() => {
    vi.restoreAllMocks()
    close.mockReset().mockResolvedValue(undefined)
    vi.spyOn(bridge, 'createLarkSession').mockResolvedValue(session)
    vi.spyOn(session, 'close').mockImplementation(close)
  })

  it('returns the result and closes the session after success', async () => {
    await expect(bridge.withLarkSession(async () => 'finished')).resolves.toBe('finished')
    expect(close).toHaveBeenCalledOnce()
  })

  it('propagates an operation failure and still closes the session', async () => {
    const error = new Error('restore failed')
    await expect(
      bridge.withLarkSession(async () => {
        throw error
      })
    ).rejects.toBe(error)
    expect(close).toHaveBeenCalledOnce()
  })

  it('propagates session creation failures without running the operation', async () => {
    const error = new Error('session creation failed')
    vi.mocked(bridge.createLarkSession).mockRejectedValueOnce(error)
    const callback = vi.fn()

    await expect(bridge.withLarkSession(callback)).rejects.toBe(error)
    expect(callback).not.toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
  })

  it('propagates cleanup failures after a successful operation', async () => {
    close.mockRejectedValueOnce(new Error('close failed'))
    await expect(bridge.withLarkSession(async () => undefined)).rejects.toThrow('close failed')
  })
})
