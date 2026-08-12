/// <reference lib="webworker" />
import { solve, type SolveInput, type SolveOutput } from './solver'

export type WorkerRequest = { type: 'solve'; payload: SolveInput }
export type WorkerResponse =
  | { type: 'progress'; pct: number; cost: number }
  | { type: 'done'; result: SolveOutput }
  | { type: 'error'; message: string }

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  if (e.data?.type !== 'solve') return
  try {
    let lastPost = 0
    const result = solve(e.data.payload, (pct, cost) => {
      const now = Date.now()
      if (now - lastPost > 120 || pct >= 1) {
        lastPost = now
        ;(self as unknown as Worker).postMessage({ type: 'progress', pct, cost } as WorkerResponse)
      }
    })
    ;(self as unknown as Worker).postMessage({ type: 'done', result } as WorkerResponse)
  } catch (err) {
    ;(self as unknown as Worker).postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    } as WorkerResponse)
  }
}
