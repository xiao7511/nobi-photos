import { hasAccess } from '../native/contracts'
import type { PhotoLibraryBridge, ScanRepository, ScanState } from '../native/contracts'
export class ScanEngine {
  private abort = false
  private active = false
  state: ScanState = { status: 'idle', processed: 0, total: 0, error: '' }
  constructor(
    private bridge: PhotoLibraryBridge,
    private repository: ScanRepository,
    private changed: (state: ScanState) => void = () => {},
  ) {}
  private update(patch: Partial<ScanState>) {
    this.state = { ...this.state, ...patch }
    this.changed(this.state)
  }
  cancel() {
    if (this.active) {
      this.abort = true
      this.update({ status: 'cancelling' })
    }
  }
  async scan(): Promise<void> {
    if (this.active) throw new Error('扫描正在进行')
    this.active = true
    this.abort = false
    this.update({ status: 'running', processed: 0, total: 0, error: '' })
    let sessionId: string | undefined
    let committed = false
    try {
      const initial = (await this.bridge.getAccess()).status
      if (!hasAccess(initial)) throw new Error('请先授权照片读取')
      const snapshot = await this.bridge.beginSnapshot()
      sessionId = snapshot.sessionId
      if (!sessionId || !Number.isSafeInteger(snapshot.total) || snapshot.total < 0)
        throw new Error('相册快照无效')
      await this.repository.beginScan(sessionId)
      this.update({ total: snapshot.total })
      let offset = 0
      while (!this.abort) {
        const page = await this.bridge.readPage({ sessionId, offset, limit: 100 })
        if (this.abort) break
        if (
          !Number.isSafeInteger(page.nextOffset) ||
          page.nextOffset < offset ||
          page.nextOffset > snapshot.total ||
          (!page.done && page.nextOffset <= offset) ||
          page.photos.length > 100 ||
          page.done !== (page.nextOffset === snapshot.total)
        )
          throw new Error('相册分页无效，索引未更新')
        await this.repository.stagePage(sessionId, page.photos)
        offset = page.nextOffset
        this.update({ processed: offset })
        if (page.done) break
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
      }
      if (this.abort) {
        this.update({ status: 'cancelled' })
        return
      }
      const finalAccess = (await this.bridge.getAccess()).status
      if (!hasAccess(finalAccess) || finalAccess !== initial)
        throw new Error('照片权限范围已变化，请重新扫描')
      if (this.abort) {
        this.update({ status: 'cancelled' })
        return
      }
      await this.repository.commitScan(sessionId)
      committed = true
      this.update({ status: 'completed' })
    } catch (error) {
      this.update({
        status: this.abort ? 'cancelled' : 'error',
        error: error instanceof Error ? error.message : '本地扫描失败，请重试',
      })
    } finally {
      if (sessionId) {
        try {
          if (!committed) await this.repository.discardScan(sessionId)
        } catch {
          this.update({ status: 'error', error: '扫描暂存清理失败，请重启应用后重试' })
        }
        try {
          await this.bridge.endSnapshot({ sessionId })
        } catch {
          this.update({ status: 'error', error: '相册会话关闭失败，请重启应用后重试' })
        }
      }
      this.active = false
    }
  }
}
