import { TimeUnit } from '@app/types/time-unit.enum'

const DEFAULT_CACHE_SIZE = 100 * 1024 * 1024 // 100 MB
const DEFAULT_MAX_ITEMS = 50
const DEFAULT_TTL = 5 * TimeUnit.Minute
const DEFAULT_EXPIRE_CHECK_INTERVAL = TimeUnit.Minute

interface LruCacheOptions {
  maxSize?: number
  maxItems?: number
  ttl?: number
}

export class LruCache {
  private cache = new Map<string, { value: any, exp: number }>()

  private readonly maxSize: number = DEFAULT_CACHE_SIZE
  private readonly maxItems: number = DEFAULT_MAX_ITEMS
  private readonly ttl: number = DEFAULT_TTL

  private expireInterval: NodeJS.Timeout | null

  constructor(options?: LruCacheOptions) {
    if (options?.maxSize) this.maxSize = options.maxSize
    if (options?.maxItems) this.maxItems = options.maxItems
    if (options?.ttl) this.ttl = options.ttl
  }

  get<T>(key: string): T | undefined {
    const item = this.cache.get(key)

    if (item && item.exp > Date.now()) {
      this.cache.delete(key)
      this.cache.set(key, item)
    }

    return item?.value
  }

  set<T = Buffer>(key: string, value: T): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }

    const currentSize = this.getCurrentSize()
    if (currentSize + this.getSizeOf(value) > this.maxItems) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }

    this.cache.set(key, { value, exp: Date.now() + this.ttl })

    if (!this.expireInterval) this.setExpireInterval()
  }

  has(key: string): boolean {
    const item = this.cache.get(key)
    return !!item && item.exp > Date.now()
  }

  getCurrentSize(): number {
    return [ ...this.cache.values() ].reduce((acc, item) => {
      return acc + this.getSizeOf(item)
    }, 0)
  }

  getSizeOf(item: any): number {
    if (Buffer.isBuffer(item)) return item.length

    return Buffer.byteLength(JSON.stringify(item))
  }

  private setExpireInterval() {
    this.expireInterval = setInterval(() => {
      if (!this.cache.size) {
        if (this.expireInterval) clearInterval(this.expireInterval)
        this.expireInterval = null
        return
      }

      const now = Date.now()

      for (const [ key, item ] of this.cache.entries()) {
        if (item.exp < now)
          this.cache.delete(key)
      }
    }, DEFAULT_EXPIRE_CHECK_INTERVAL)
  }
}
