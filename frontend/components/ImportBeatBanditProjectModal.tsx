import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from './ui/button'
import type { BeatBanditImportSummary } from '../lib/beatbandit-import'

interface ImportBeatBanditProjectModalProps {
  isOpen: boolean
  state: 'configure' | 'importing' | 'error' | 'success'
  error?: string
  summary?: BeatBanditImportSummary | null
  warnings?: string[]
  packageName?: string
  laneCount?: number
  onLaneCountChange?: (laneCount: number) => void
  onConfirmImport?: () => void
  onClose: () => void
  onOpenProject?: () => void
}

export function ImportBeatBanditProjectModal({
  isOpen,
  state,
  error,
  summary,
  warnings = [],
  packageName,
  laneCount = 1,
  onLaneCountChange,
  onConfirmImport,
  onClose,
  onOpenProject,
}: ImportBeatBanditProjectModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-xl p-6 w-full max-w-lg border border-zinc-800 shadow-2xl">
        {state === 'configure' && (
          <div>
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-white">Import BeatBandit ZIP Package</h2>
              <p className="text-sm text-zinc-400 mt-1">
                Choose how many stacked shot lanes to create before importing.
              </p>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 mb-5">
              <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Package</div>
              <div className="text-sm text-white break-all">{packageName || 'Selected BeatBandit ZIP Package'}</div>
            </div>

            <div className="mb-3">
              <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-2">
                Shot Lanes
              </label>
              <select
                value={laneCount}
                onChange={(event) => onLaneCountChange?.(Number(event.target.value))}
                className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-white focus:outline-none focus:border-blue-500"
              >
                {[1, 2, 3, 4, 5].map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <p className="text-xs text-zinc-400 mt-2">
                Each shot is repeated {laneCount} time{laneCount === 1 ? '' : 's'} in sequence on V1 so batch generation can create alternatives to compare side by side.
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={onClose} className="border-zinc-700">
                Cancel
              </Button>
              <Button onClick={onConfirmImport} className="bg-blue-600 hover:bg-blue-500">
                Start Import
              </Button>
            </div>
          </div>
        )}

        {state === 'importing' && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Loader2 className="h-10 w-10 text-blue-400 animate-spin mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Importing BeatBandit ZIP Package</h2>
            <p className="text-sm text-zinc-400">
              Extracting the ZIP package, validating assets, and building timelines with {laneCount} shot lane{laneCount === 1 ? '' : 's'}.
            </p>
          </div>
        )}

        {state === 'error' && (
          <div>
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="text-xl font-semibold text-white">Import Failed</h2>
                <p className="text-sm text-zinc-400 mt-1">
                  The BeatBandit ZIP package could not be imported.
                </p>
              </div>
            </div>
            <div className="bg-red-950/40 border border-red-900/50 rounded-lg p-4 text-sm text-red-200 whitespace-pre-wrap">
              {error || 'Unknown import error'}
            </div>
            <div className="flex justify-end mt-6">
              <Button onClick={onClose} className="bg-blue-600 hover:bg-blue-500">
                Close
              </Button>
            </div>
          </div>
        )}

        {state === 'success' && summary && (
          <div>
            <div className="flex items-start gap-3 mb-5">
              <CheckCircle2 className="h-6 w-6 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="text-xl font-semibold text-white">BeatBandit Project Ready</h2>
                <p className="text-sm text-zinc-400 mt-1">
                  `{summary.projectName}` is ready to open in the Video Editor.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-zinc-800 rounded-lg p-3">
                <div className="text-xs text-zinc-500 uppercase tracking-wide">Scenes</div>
                <div className="text-lg font-semibold text-white">{summary.sceneCount}</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-3">
                <div className="text-xs text-zinc-500 uppercase tracking-wide">Shots</div>
                <div className="text-lg font-semibold text-white">{summary.shotCount}</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-3">
                <div className="text-xs text-zinc-500 uppercase tracking-wide">Stills</div>
                <div className="text-lg font-semibold text-white">{summary.stillCount}</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-3">
                <div className="text-xs text-zinc-500 uppercase tracking-wide">Videos</div>
                <div className="text-lg font-semibold text-white">{summary.videoCount}</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-3">
                <div className="text-xs text-zinc-500 uppercase tracking-wide">References</div>
                <div className="text-lg font-semibold text-white">{summary.referenceCount}</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-3">
                <div className="text-xs text-zinc-500 uppercase tracking-wide">Subtitles</div>
                <div className="text-lg font-semibold text-white">{summary.subtitleCount}</div>
              </div>
            </div>

            {warnings.length > 0 && (
              <div className="mb-5">
                <h3 className="text-sm font-medium text-zinc-200 mb-2">
                  Warnings ({warnings.length})
                </h3>
                <div className="max-h-44 overflow-auto bg-zinc-950/60 border border-zinc-800 rounded-lg p-3 space-y-2">
                  {warnings.map((warning, index) => (
                    <p key={`${warning}-${index}`} className="text-sm text-amber-200">
                      {warning}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={onClose} className="border-zinc-700">
                Stay On Home
              </Button>
              <Button onClick={onOpenProject} className="bg-blue-600 hover:bg-blue-500">
                Open In Video Editor
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
