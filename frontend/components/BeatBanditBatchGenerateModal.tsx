import { AlertCircle, CheckCircle2, Clapperboard, Loader2, RefreshCw, X } from 'lucide-react'
import { Button } from './ui/button'

export type BeatBanditBatchScope = 'timeline' | 'project'

interface BatchFailure {
  jobKey: string
  label: string
  error: string
}

interface BeatBanditBatchGenerateModalProps {
  open: boolean
  onClose: () => void
  scope: BeatBanditBatchScope
  onScopeChange: (scope: BeatBanditBatchScope) => void
  eligibleCounts: Record<BeatBanditBatchScope, number>
  status: 'idle' | 'running' | 'done' | 'cancelled'
  total: number
  completed: number
  failures: BatchFailure[]
  currentLabel: string | null
  progress: number
  statusMessage: string
  onStart: () => void
  onCancel: () => void
  onRetryFailed: () => void
}

function scopeLabel(scope: BeatBanditBatchScope): string {
  return scope === 'timeline' ? 'Active Timeline' : 'Entire Project'
}

export function BeatBanditBatchGenerateModal({
  open,
  onClose,
  scope,
  onScopeChange,
  eligibleCounts,
  status,
  total,
  completed,
  failures,
  currentLabel,
  progress,
  statusMessage,
  onStart,
  onCancel,
  onRetryFailed,
}: BeatBanditBatchGenerateModalProps) {
  if (!open) return null

  const eligible = eligibleCounts[scope]
  const processed = completed + failures.length
  const hasFailures = failures.length > 0
  const canStart = status !== 'running' && eligible > 0

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={() => {
        if (status !== 'running') onClose()
      }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-white">Generate Missing BeatBandit Shots</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Queue imported BeatBandit stills and placeholders for video generation.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={status === 'running'}
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {(['timeline', 'project'] as BeatBanditBatchScope[]).map((option) => {
              const selected = scope === option
              return (
                <button
                  key={option}
                  type="button"
                  disabled={status === 'running'}
                  onClick={() => onScopeChange(option)}
                  className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                    selected
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-zinc-700 bg-zinc-800/60 hover:border-zinc-600 hover:bg-zinc-800'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{scopeLabel(option)}</div>
                      <div className="mt-1 text-xs text-zinc-400">
                        {option === 'timeline'
                          ? 'Only the shots visible in the current timeline'
                          : 'All imported BeatBandit shots across every timeline'}
                      </div>
                    </div>
                    <div className="rounded-full border border-zinc-600 px-2 py-1 text-xs font-semibold text-zinc-300">
                      {eligibleCounts[option]}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <Clapperboard className="h-4 w-4 text-blue-400" />
                  {scopeLabel(scope)}
                </div>
                <p className="mt-1 text-sm text-zinc-400">
                  {eligible > 0
                    ? `${eligible} missing BeatBandit shot${eligible === 1 ? '' : 's'} ready for generation.`
                    : 'No missing BeatBandit shots are available in this scope.'}
                </p>
              </div>
              <div className="text-right text-xs text-zinc-500">
                <div>Completed: {completed}</div>
                <div>Failed: {failures.length}</div>
              </div>
            </div>

            {(status === 'running' || status === 'done' || status === 'cancelled') && total > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>
                    {status === 'running'
                      ? 'Queue running'
                      : status === 'cancelled'
                        ? 'Queue cancelled'
                        : 'Queue finished'}
                  </span>
                  <span>{processed}/{total}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${total > 0 ? Math.max((processed / total) * 100, processed > 0 ? 4 : 0) : 0}%` }}
                  />
                </div>
              </div>
            )}

            {status === 'running' && (
              <div className="mt-4 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                <div className="flex items-center gap-2 text-sm text-blue-200">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{statusMessage || 'Generating...'}</span>
                  {progress > 0 && <span className="text-blue-300">{progress}%</span>}
                </div>
                {currentLabel && (
                  <div className="mt-1 text-xs text-zinc-300">
                    Current shot: <span className="text-white">{currentLabel}</span>
                  </div>
                )}
              </div>
            )}

            {status === 'done' && !hasFailures && total > 0 && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-200">
                <CheckCircle2 className="h-4 w-4" />
                All queued BeatBandit shots finished successfully.
              </div>
            )}

            {status === 'cancelled' && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-200">
                <AlertCircle className="h-4 w-4" />
                Batch generation was cancelled. Completed items were kept.
              </div>
            )}
          </div>

          {hasFailures && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-200">
                <AlertCircle className="h-4 w-4" />
                Failed shots
              </div>
              <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                {failures.map((failure) => (
                  <div key={failure.jobKey} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
                    <div className="text-sm text-white">{failure.label}</div>
                    <div className="mt-1 text-xs text-red-200 whitespace-pre-wrap break-words">{failure.error}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-zinc-800 px-6 py-4">
          <div className="text-xs text-zinc-500">
            Imported BeatBandit image shots are processed one at a time with their saved generation settings.
          </div>
          <div className="flex items-center gap-2">
            {status === 'running' ? (
              <Button variant="outline" className="border-red-500/40 text-red-300 hover:bg-red-500/10" onClick={onCancel}>
                Cancel Remaining
              </Button>
            ) : (
              <>
                {hasFailures && (
                  <Button variant="outline" className="border-zinc-700" onClick={onRetryFailed}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry Failed
                  </Button>
                )}
                <Button variant="outline" className="border-zinc-700" onClick={onClose}>
                  Close
                </Button>
                <Button onClick={onStart} disabled={!canStart}>
                  {status === 'done' || status === 'cancelled' ? 'Run Again' : 'Start Queue'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
