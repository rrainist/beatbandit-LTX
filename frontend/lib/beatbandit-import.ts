import {
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_TRACKS,
  createDefaultTimeline,
} from '../types/project'
import type {
  Asset,
  AssetImportMeta,
  GenerationParams,
  Project,
  SubtitleClip,
  Timeline,
  TimelineClip,
  Track,
} from '../types/project'

const COLOR_ROTATION = ['violet', 'blue', 'cyan', 'teal', 'green', 'yellow', 'orange', 'red', 'rose', 'pink'] as const
const DEFAULT_FPS = 24
const DEFAULT_RESOLUTION = '1920x1080'
const DEFAULT_DURATION_SECONDS = 5
const VALID_CAMERA_MOTIONS = new Set([
  'none',
  'static',
  'focus_shift',
  'dolly_in',
  'dolly_out',
  'dolly_left',
  'dolly_right',
  'jib_up',
  'jib_down',
])

type BeatBanditReferenceKind = 'character' | 'environment' | 'object'
type BeatBanditAssetKind = 'shot_still' | 'shot_video'

interface BeatBanditProjectInfo {
  id?: string
  name?: string
  default_fps?: number
  default_resolution?: string
  thumbnail_path?: string | null
}

interface BeatBanditScene {
  id: string
  code?: string
  name?: string
  position?: number
  scene_number?: number
}

interface BeatBanditShot {
  id: string
  shot_number?: number
  scene_id?: string
  scene_code?: string
  position?: number
  duration_seconds?: number
  title?: string
  dialogue?: string
  movement?: string
  t2v_prompt?: string
  compact_video_prompt?: string
  selected_still_asset_id?: string
  selected_video_asset_id?: string
  primary_reference_asset_id?: string
  reference_asset_ids?: string[]
}

interface BeatBanditAssetRecord {
  id: string
  kind: BeatBanditAssetKind
  label?: string
  path: string
  mime_type?: string
  width?: number
  height?: number
  duration_seconds?: number
  source_shot_id?: string
  prompt?: string
  provider_model?: string
  source_reference_asset_id?: string
}

interface BeatBanditReferenceRecord {
  id: string
  kind: BeatBanditReferenceKind
  label?: string
  path: string
  mime_type?: string
  width?: number
  height?: number
  linked_shot_ids?: string[]
  description?: string
}

interface BeatBanditManifest {
  schema_version: string
  project: BeatBanditProjectInfo
  scenes: BeatBanditScene[]
  shots: BeatBanditShot[]
  assets: BeatBanditAssetRecord[]
  references: BeatBanditReferenceRecord[]
}

interface ResolvedFileRecord {
  exists: boolean
  filePath: string
  fileUrl: string
}

interface ImportedShotAssets {
  still?: Asset
  video?: Asset
}

interface PreparedShotImport {
  durationSeconds: number
  selectedAsset?: Asset
  colorLabel: string
  dialogue?: string
}

interface BuildBeatBanditImportOptions {
  laneCount?: number
}

export interface BeatBanditImportSummary {
  projectName: string
  sceneCount: number
  shotCount: number
  stillCount: number
  videoCount: number
  referenceCount: number
  subtitleCount: number
  warningCount: number
}

export interface BeatBanditImportResult {
  project: Project
  summary: BeatBanditImportSummary
  warnings: string[]
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function ensureManifest(manifest: unknown): BeatBanditManifest {
  if (!isRecord(manifest)) {
    throw new Error('BeatBandit package manifest is not a valid object')
  }

  if (typeof manifest.schema_version !== 'string' || !manifest.schema_version.trim()) {
    throw new Error('BeatBandit package is missing schema_version')
  }

  if (!manifest.schema_version.startsWith('1.')) {
    throw new Error(`Unsupported BeatBandit schema version: ${manifest.schema_version}`)
  }

  if (!isRecord(manifest.project) || typeof manifest.project.name !== 'string' || !manifest.project.name.trim()) {
    throw new Error('BeatBandit package is missing project.name')
  }

  if (!Array.isArray(manifest.shots) || manifest.shots.length === 0) {
    throw new Error('BeatBandit package has no shots to import')
  }

  return {
    schema_version: manifest.schema_version,
    project: manifest.project as BeatBanditProjectInfo,
    scenes: Array.isArray(manifest.scenes) ? (manifest.scenes as BeatBanditScene[]) : [],
    shots: manifest.shots as BeatBanditShot[],
    assets: Array.isArray(manifest.assets) ? (manifest.assets as BeatBanditAssetRecord[]) : [],
    references: Array.isArray(manifest.references) ? (manifest.references as BeatBanditReferenceRecord[]) : [],
  }
}

function normalizeRelativePath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/').trim()

  if (!normalized) {
    throw new Error('BeatBandit package contains an empty asset path')
  }

  if (normalized.startsWith('/') || normalized.startsWith('\\') || /^[A-Za-z]:/.test(normalized)) {
    throw new Error(`BeatBandit package contains an absolute asset path: ${relativePath}`)
  }

  if (normalized.split('/').includes('..')) {
    throw new Error(`BeatBandit package contains an invalid relative asset path: ${relativePath}`)
  }

  return normalized
}

function joinBasePath(basePath: string, relativePath: string): string {
  const normalizedBase = basePath.replace(/[\\/]+$/, '')
  const normalizedRelative = normalizeRelativePath(relativePath)
  const separator = normalizedBase.includes('\\') ? '\\' : '/'
  return `${normalizedBase}${separator}${normalizedRelative.replace(/\//g, separator)}`
}

function pathToFileUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`
}

export function pixelResolutionToLabel(resolution?: string | null): string {
  const match = typeof resolution === 'string' ? resolution.match(/^(\d+)x(\d+)$/i) : null
  if (!match) return '720p'
  const maxDim = Math.max(Number(match[1]), Number(match[2]))
  if (maxDim >= 1920) return '1080p'
  if (maxDim >= 1280) return '720p'
  return '540p'
}

function parseResolution(resolution?: string | null): { width?: number; height?: number } {
  const match = typeof resolution === 'string' ? resolution.match(/^(\d+)x(\d+)$/i) : null
  if (!match) {
    return {}
  }

  return {
    width: Number(match[1]),
    height: Number(match[2]),
  }
}

function getResolutionString(width?: number, height?: number, fallback: string = DEFAULT_RESOLUTION): string {
  if (width && height) {
    return `${width}x${height}`
  }
  return fallback
}

function getDurationSeconds(duration?: number): number {
  return typeof duration === 'number' && Number.isFinite(duration) && duration > 0
    ? duration
    : DEFAULT_DURATION_SECONDS
}

function getBeatBanditFullPrompt(shot?: BeatBanditShot, assetPrompt?: string): string {
  return shot?.t2v_prompt?.trim() || assetPrompt?.trim() || ''
}

function getBeatBanditCompactPrompt(shot?: BeatBanditShot): string {
  return shot?.compact_video_prompt?.trim() || ''
}

function getPreferredBeatBanditPrompt(shot?: BeatBanditShot, assetPrompt?: string): string {
  return getBeatBanditCompactPrompt(shot) || assetPrompt?.trim() || shot?.t2v_prompt?.trim() || ''
}

function getCameraMotionValue(movement?: string): string {
  const raw = movement?.trim()
  if (!raw) {
    return 'none'
  }

  const normalized = raw.toLowerCase().replace(/[\s-]+/g, '_')
  if (VALID_CAMERA_MOTIONS.has(normalized)) {
    return normalized
  }

  const plain = raw.toLowerCase()
  if (plain.includes('focus shift')) return 'focus_shift'
  if (plain.includes('dolly in') || plain.includes('push in') || plain.includes('push-in')) return 'dolly_in'
  if (plain.includes('dolly out') || plain.includes('pull back') || plain.includes('pull-back')) return 'dolly_out'
  if (plain.includes('dolly left')) return 'dolly_left'
  if (plain.includes('dolly right')) return 'dolly_right'
  if (plain.includes('jib up') || plain.includes('crane up')) return 'jib_up'
  if (plain.includes('jib down') || plain.includes('crane down')) return 'jib_down'
  if (plain.includes('static') || plain.includes('locked off') || plain.includes('lock-off')) return 'static'

  return 'none'
}

function getSceneDisplayName(scene: BeatBanditScene | undefined, index: number): string {
  const baseName = scene?.name?.trim() || scene?.code?.trim() || `Scene ${index + 1}`
  const displayNumber = scene?.scene_number ?? index + 1
  return `Scene ${String(displayNumber).padStart(2, '0')}: ${baseName}`
}

function createSubtitleTrack(): Track {
  return {
    id: createId('track-sub'),
    name: 'Subtitles',
    muted: false,
    locked: false,
    type: 'subtitle',
  }
}

function normalizeLaneCount(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1
  return Math.max(1, Math.min(5, Math.round(value)))
}

function createMediaTracks(videoTrackCount: number = 1, audioTrackCount: number = videoTrackCount): Track[] {
  const normalizedVideoTrackCount = Math.max(3, Math.round(videoTrackCount))
  const normalizedAudioTrackCount = Math.max(2, Math.round(audioTrackCount))
  const defaultVideoTracks = DEFAULT_TRACKS.filter(track => track.kind === 'video')
  const defaultAudioTracks = DEFAULT_TRACKS.filter(track => track.kind === 'audio')

  const videoTracks = Array.from({ length: normalizedVideoTrackCount }, (_, index) => {
    const baseTrack = defaultVideoTracks[index]
    if (baseTrack) {
      return { ...baseTrack }
    }
    return {
      id: `track-v${index + 1}`,
      name: `V${index + 1}`,
      muted: false,
      locked: false,
      sourcePatched: false,
      kind: 'video' as const,
    }
  })

  const audioTracks = Array.from({ length: normalizedAudioTrackCount }, (_, index) => {
    const baseTrack = defaultAudioTracks[index]
    if (baseTrack) {
      return { ...baseTrack }
    }
    return {
      id: `track-a${index + 1}`,
      name: `A${index + 1}`,
      muted: false,
      locked: false,
      sourcePatched: false,
      kind: 'audio' as const,
    }
  })

  return [...videoTracks, ...audioTracks]
}

function withSubtitleTrackIfNeeded(
  clips: TimelineClip[],
  subtitles: SubtitleClip[],
  videoTrackCount: number,
  audioTrackCount: number,
): { tracks: Track[]; clips: TimelineClip[]; subtitles: SubtitleClip[] } {
  if (subtitles.length === 0) {
    return {
      tracks: createMediaTracks(videoTrackCount, audioTrackCount),
      clips,
      subtitles,
    }
  }

  return {
    tracks: [createSubtitleTrack(), ...createMediaTracks(videoTrackCount, audioTrackCount)],
    clips: clips.map(clip => ({ ...clip, trackIndex: clip.trackIndex + 1 })),
    subtitles: subtitles.map(subtitle => ({ ...subtitle, trackIndex: 0 })),
  }
}

function getGenerationParams({
  prompt,
  durationSeconds,
  resolution,
  fps,
  movement,
  still,
  primaryReference,
  inputImageUrl,
}: {
  prompt: string
  durationSeconds: number
  resolution: string
  fps: number
  movement?: string
  still?: Asset
  primaryReference?: Asset
  inputImageUrl?: string | null
}): GenerationParams {
  const resolvedInputImageUrl = inputImageUrl !== undefined
    ? (inputImageUrl || undefined)
    : (still?.url || primaryReference?.url)

  return {
    mode: resolvedInputImageUrl ? 'image-to-video' : 'text-to-video',
    prompt,
    model: '',
    duration: durationSeconds,
    resolution,
    fps,
    audio: false,
    cameraMotion: getCameraMotionValue(movement),
    ...(resolvedInputImageUrl ? { inputImageUrl: resolvedInputImageUrl } : {}),
  }
}

function createTimelineClip(
  asset: Asset,
  startTime: number,
  duration: number,
  colorLabel: string,
  trackIndex: number,
  beatbanditVariantKey: string,
  beatbanditLaneIndex: number,
): TimelineClip {
  return {
    id: createId('clip'),
    assetId: asset.id,
    type: asset.type === 'video' ? 'video' : asset.type === 'audio' ? 'audio' : 'image',
    startTime,
    duration,
    trimStart: 0,
    trimEnd: 0,
    speed: 1,
    reversed: false,
    muted: false,
    volume: 1,
    trackIndex,
    asset,
    flipH: false,
    flipV: false,
    transitionIn: { type: 'none', duration: 0 },
    transitionOut: { type: 'none', duration: 0 },
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    opacity: 100,
    colorLabel,
    beatbanditVariantKey,
    beatbanditLaneIndex,
  }
}

function createAudioTimelineClip(
  id: string,
  asset: Asset,
  startTime: number,
  duration: number,
  trackIndex: number,
  linkedVideoClipId: string,
  colorLabel: string,
  beatbanditVariantKey: string,
  beatbanditLaneIndex: number,
): TimelineClip {
  return {
    id,
    assetId: asset.id,
    type: 'audio',
    startTime,
    duration,
    trimStart: 0,
    trimEnd: 0,
    speed: 1,
    reversed: false,
    muted: false,
    volume: 1,
    trackIndex,
    asset,
    flipH: false,
    flipV: false,
    transitionIn: { type: 'none', duration: 0 },
    transitionOut: { type: 'none', duration: 0 },
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    opacity: 100,
    colorLabel,
    linkedClipIds: [linkedVideoClipId],
    beatbanditVariantKey,
    beatbanditLaneIndex,
  }
}

function createSubtitle(dialogue: string, startTime: number, endTime: number): SubtitleClip {
  return {
    id: createId('sub'),
    text: dialogue,
    startTime,
    endTime,
    trackIndex: 0,
  }
}

async function resolveFiles(basePath: string, relativePaths: string[]): Promise<Map<string, ResolvedFileRecord>> {
  const uniquePaths = [...new Set(relativePaths.map(pathValue => normalizeRelativePath(pathValue)))]
  const filePaths = uniquePaths.map(relativePath => joinBasePath(basePath, relativePath))
  const existenceMap = window.electronAPI?.checkFilesExist
    ? await window.electronAPI.checkFilesExist(filePaths)
    : Object.fromEntries(filePaths.map(filePath => [filePath, true]))

  return new Map(
    uniquePaths.map((relativePath, index) => {
      const filePath = filePaths[index]
      return [
        relativePath,
        {
          exists: Boolean(existenceMap[filePath]),
          filePath,
          fileUrl: pathToFileUrl(filePath),
        },
      ]
    }),
  )
}

function createImportMeta(
  projectId: string | undefined,
  shotId: string | undefined,
  assetId: string,
  options?: {
    beatbanditUseAsInputImage?: boolean
    beatbanditOriginalPrompt?: string
    beatbanditCompactPrompt?: string
  },
): AssetImportMeta {
  return {
    source: 'beatbandit',
    ...(projectId ? { beatbanditProjectId: projectId } : {}),
    ...(shotId ? { beatbanditShotId: shotId } : {}),
    beatbanditAssetId: assetId,
    ...(options?.beatbanditUseAsInputImage !== undefined ? { beatbanditUseAsInputImage: options.beatbanditUseAsInputImage } : {}),
    ...(options?.beatbanditOriginalPrompt ? { beatbanditOriginalPrompt: options.beatbanditOriginalPrompt } : {}),
    ...(options?.beatbanditCompactPrompt ? { beatbanditCompactPrompt: options.beatbanditCompactPrompt } : {}),
  }
}

export async function buildBeatBanditImportProject(
  manifestInput: unknown,
  basePath: string,
  options: BuildBeatBanditImportOptions = {},
): Promise<BeatBanditImportResult> {
  const manifest = ensureManifest(manifestInput)
  const warnings: string[] = []
  const laneCount = normalizeLaneCount(options.laneCount)
  const fps = typeof manifest.project.default_fps === 'number' && manifest.project.default_fps > 0
    ? manifest.project.default_fps
    : DEFAULT_FPS
  const fallbackResolution = manifest.project.default_resolution || DEFAULT_RESOLUTION
  const fallbackDimensions = parseResolution(fallbackResolution)
  const projectId = manifest.project.id
  const normalizedProjectThumbnailPath = manifest.project.thumbnail_path
    ? normalizeRelativePath(manifest.project.thumbnail_path)
    : null

  const allIdValues = new Set<string>()
  const registerId = (id: string, kind: string) => {
    if (!id || typeof id !== 'string') {
      throw new Error(`BeatBandit package contains a ${kind} with an invalid id`)
    }
    if (allIdValues.has(id)) {
      throw new Error(`BeatBandit package contains duplicate asset/reference id: ${id}`)
    }
    allIdValues.add(id)
  }

  for (const asset of manifest.assets) registerId(asset.id, 'asset')
  for (const reference of manifest.references) registerId(reference.id, 'reference')

  const shotStillPathUseCount = new Map<string, number>()
  for (const assetRecord of manifest.assets) {
    if (assetRecord.kind !== 'shot_still') continue
    const normalizedPath = normalizeRelativePath(assetRecord.path)
    shotStillPathUseCount.set(normalizedPath, (shotStillPathUseCount.get(normalizedPath) || 0) + 1)
  }

  const fileResolutionMap = await resolveFiles(basePath, [
    ...manifest.assets.map(asset => asset.path),
    ...manifest.references.map(reference => reference.path),
    ...(manifest.project.thumbnail_path ? [manifest.project.thumbnail_path] : []),
  ])

  const sceneMap = new Map(manifest.scenes.map(scene => [scene.id, scene]))
  const sceneNameMap = new Map<string, string>()
  manifest.scenes
    .slice()
    .sort((left, right) => (left.position ?? 0) - (right.position ?? 0))
    .forEach((scene, index) => {
      sceneNameMap.set(scene.id, getSceneDisplayName(scene, index))
    })

  const referenceAssets = new Map<string, Asset>()
  for (const reference of manifest.references) {
    const resolved = fileResolutionMap.get(normalizeRelativePath(reference.path))
    if (!resolved?.exists) {
      warnings.push(`Missing reference image: ${reference.label || reference.id}`)
      continue
    }

    const referenceResolution = getResolutionString(reference.width, reference.height, fallbackResolution)
    const bin = reference.kind === 'character'
      ? 'Ref: Characters'
      : reference.kind === 'environment'
        ? 'Ref: Environments'
        : 'Ref: Objects'

    referenceAssets.set(reference.id, {
      id: reference.id,
      type: 'image',
      path: resolved.filePath,
      url: resolved.fileUrl,
      prompt: reference.description || reference.label || '',
      resolution: referenceResolution,
      createdAt: Date.now(),
      thumbnail: resolved.fileUrl,
      bin,
      importMeta: createImportMeta(projectId, undefined, reference.id),
    })
  }

  const shotAssetRecordsByShotId = new Map<string, ImportedShotAssets>()
  const importedAssets: Asset[] = []

  const shouldUseShotStillAsInputImage = (assetRecord: BeatBanditAssetRecord, shot: BeatBanditShot | undefined): boolean => {
    if (assetRecord.kind !== 'shot_still') return false
    if (assetRecord.source_reference_asset_id) return true
    if (shot?.primary_reference_asset_id || shot?.reference_asset_ids?.length) return true

    const normalizedPath = normalizeRelativePath(assetRecord.path)
    const lowerPath = normalizedPath.toLowerCase()
    const isProjectThumbnail = normalizedProjectThumbnailPath === normalizedPath
    const looksLikePlaceholder = lowerPath.includes('placeholder') || lowerPath.includes('default') || lowerPath.includes('thumbnail')
    const sharedAcrossShots = (shotStillPathUseCount.get(normalizedPath) || 0) > 1

    if (isProjectThumbnail || looksLikePlaceholder || sharedAcrossShots) {
      return false
    }

    return true
  }

  for (const assetRecord of manifest.assets) {
    const resolved = fileResolutionMap.get(normalizeRelativePath(assetRecord.path))
    const shotId = assetRecord.source_shot_id
    const shot = shotId ? manifest.shots.find(candidate => candidate.id === shotId) : undefined

    if (!resolved?.exists) {
      const label = assetRecord.label || assetRecord.id
      if (assetRecord.kind === 'shot_video') {
        warnings.push(`Missing shot video file: ${label}`)
      } else {
        warnings.push(`Missing shot still file: ${label}`)
      }
      continue
    }

    const sceneDisplayName = shot?.scene_id
      ? sceneNameMap.get(shot.scene_id) || `Scene Assets`
      : 'Scene Assets'
    const durationSeconds = getDurationSeconds(assetRecord.duration_seconds ?? shot?.duration_seconds)
    const assetResolution = getResolutionString(
      assetRecord.width ?? fallbackDimensions.width,
      assetRecord.height ?? fallbackDimensions.height,
      fallbackResolution,
    )
    const useAsInputImage = shouldUseShotStillAsInputImage(assetRecord, shot)
    const originalPrompt = getBeatBanditFullPrompt(shot, assetRecord.prompt)
    const compactPrompt = getBeatBanditCompactPrompt(shot)
    const preferredPrompt = getPreferredBeatBanditPrompt(shot, assetRecord.prompt)
    const generationParams = getGenerationParams({
      prompt: preferredPrompt,
      durationSeconds,
      resolution: assetResolution,
      fps,
      movement: shot?.movement,
      inputImageUrl: useAsInputImage ? resolved?.fileUrl || null : null,
    })

    const importedAsset: Asset = {
      id: assetRecord.id,
      type: assetRecord.kind === 'shot_video' ? 'video' : 'image',
      path: resolved.filePath,
      url: resolved.fileUrl,
      prompt: preferredPrompt,
      resolution: assetResolution,
      duration: assetRecord.kind === 'shot_video' ? durationSeconds : undefined,
      createdAt: Date.now(),
      thumbnail: resolved.fileUrl,
      bin: sceneDisplayName,
      generationParams,
      importMeta: createImportMeta(projectId, shotId, assetRecord.id, {
        beatbanditUseAsInputImage: assetRecord.kind === 'shot_still' ? useAsInputImage : undefined,
        beatbanditOriginalPrompt: originalPrompt,
        beatbanditCompactPrompt: compactPrompt,
      }),
    }

    importedAssets.push(importedAsset)

    if (shotId) {
      const existing = shotAssetRecordsByShotId.get(shotId) || {}
      if (assetRecord.kind === 'shot_video') {
        existing.video = importedAsset
      } else {
        existing.still = importedAsset
      }
      shotAssetRecordsByShotId.set(shotId, existing)
    }
  }

  importedAssets.push(...referenceAssets.values())

  const sceneShotMap = new Map<string, BeatBanditShot[]>()
  for (const shot of manifest.shots) {
    const sceneId = shot.scene_id || '__unassigned__'
    const shots = sceneShotMap.get(sceneId) || []
    shots.push(shot)
    sceneShotMap.set(sceneId, shots)
  }

  const sortedShots = manifest.shots
    .slice()
    .sort((left, right) => {
      const leftScenePosition = sceneMap.get(left.scene_id || '')?.position ?? Number.MAX_SAFE_INTEGER
      const rightScenePosition = sceneMap.get(right.scene_id || '')?.position ?? Number.MAX_SAFE_INTEGER
      if (leftScenePosition !== rightScenePosition) {
        return leftScenePosition - rightScenePosition
      }
      return (left.position ?? 0) - (right.position ?? 0)
    })

  const preparedShots = new Map<string, PreparedShotImport>()

  for (const shot of sortedShots) {
    const sceneIndex = shot.scene_id ? manifest.scenes.findIndex(scene => scene.id === shot.scene_id) : -1
    const colorLabel = COLOR_ROTATION[(sceneIndex >= 0 ? sceneIndex : 0) % COLOR_ROTATION.length]
    const durationSeconds = getDurationSeconds(shot.duration_seconds)
    const shotAssets = shotAssetRecordsByShotId.get(shot.id)
    const primaryReference = shot.primary_reference_asset_id
      ? referenceAssets.get(shot.primary_reference_asset_id)
      : shot.reference_asset_ids?.map(referenceId => referenceAssets.get(referenceId)).find(Boolean)
    const sceneDisplayName = shot.scene_id
      ? sceneNameMap.get(shot.scene_id) || 'Scene Assets'
      : 'Scene Assets'
    let stillAsset = shotAssets?.still
    const videoAsset = shotAssets?.video
    let selectedAsset = videoAsset || stillAsset

    if (!(typeof shot.duration_seconds === 'number' && shot.duration_seconds > 0)) {
      warnings.push(`Shot ${shot.id} had zero or missing duration; used ${DEFAULT_DURATION_SECONDS}s fallback`)
    }

    if (!selectedAsset && primaryReference) {
      const placeholderAssetId = `bb-shot-placeholder-${shot.id}`
      const originalPrompt = getBeatBanditFullPrompt(shot, primaryReference.prompt)
      const compactPrompt = getBeatBanditCompactPrompt(shot)
      const preferredPrompt = compactPrompt || shot.t2v_prompt?.trim() || primaryReference.prompt || ''
      const placeholderAsset: Asset = {
        id: placeholderAssetId,
        type: 'image',
        path: primaryReference.path,
        url: primaryReference.url,
        prompt: preferredPrompt,
        resolution: primaryReference.resolution || fallbackResolution,
        createdAt: Date.now(),
        thumbnail: primaryReference.thumbnail || primaryReference.url,
        bin: sceneDisplayName,
        generationParams: getGenerationParams({
          prompt: preferredPrompt,
          durationSeconds,
          resolution: primaryReference.resolution || fallbackResolution,
          fps,
          movement: shot.movement,
          primaryReference,
        }),
        importMeta: createImportMeta(projectId, shot.id, placeholderAssetId, {
          beatbanditUseAsInputImage: true,
          beatbanditOriginalPrompt: originalPrompt,
          beatbanditCompactPrompt: compactPrompt,
        }),
      }

      importedAssets.push(placeholderAsset)
      stillAsset = placeholderAsset
      selectedAsset = placeholderAsset
      shotAssetRecordsByShotId.set(shot.id, {
        ...(shotAssets || {}),
        still: placeholderAsset,
      })
    }

    if (stillAsset?.generationParams) {
      const stillInputImageUrl = stillAsset.importMeta?.beatbanditUseAsInputImage === false
        ? (primaryReference?.url || null)
        : undefined
      stillAsset.generationParams = getGenerationParams({
        prompt: getPreferredBeatBanditPrompt(shot, stillAsset.prompt),
        durationSeconds,
        resolution: stillAsset.resolution || fallbackResolution,
        fps,
        movement: shot.movement,
        still: stillAsset,
        primaryReference,
        inputImageUrl: stillInputImageUrl,
      })
    }

    if (videoAsset?.generationParams) {
      const stillInputImageUrl = stillAsset?.importMeta?.beatbanditUseAsInputImage === false
        ? (primaryReference?.url || null)
        : undefined
      videoAsset.generationParams = getGenerationParams({
        prompt: getPreferredBeatBanditPrompt(shot, videoAsset.prompt),
        durationSeconds,
        resolution: videoAsset.resolution || fallbackResolution,
        fps,
        movement: shot.movement,
        still: stillAsset,
        primaryReference,
        inputImageUrl: stillInputImageUrl,
      })
    }

    if (!selectedAsset) {
      warnings.push(`Shot ${shot.id} has no importable still or video asset; skipped timeline clip`)
    }

    preparedShots.set(shot.id, {
      durationSeconds,
      selectedAsset,
      colorLabel,
      dialogue: shot.dialogue?.trim() || undefined,
    })
  }

  const importedStillCount = importedAssets.filter(asset => asset.importMeta?.beatbanditAssetId && asset.type === 'image' && asset.bin?.startsWith('Scene ')).length
  const importedVideoCount = importedAssets.filter(asset => asset.type === 'video').length
  const importedReferenceCount = importedAssets.filter(asset => asset.bin?.startsWith('Ref:')).length

  function buildTimelineForShots(name: string, shots: BeatBanditShot[]): Timeline {
    const baseTimeline = createDefaultTimeline(name)
    let currentTime = 0
    const clips: TimelineClip[] = []
    const subtitles: SubtitleClip[] = []

    for (const shot of shots) {
      const preparedShot = preparedShots.get(shot.id)
      if (!preparedShot) {
        continue
      }

      if (!preparedShot.selectedAsset) {
        currentTime += preparedShot.durationSeconds
        continue
      }

      for (let laneIndex = 0; laneIndex < laneCount; laneIndex += 1) {
        const beatbanditVariantKey = `${shot.id}:lane:${laneIndex + 1}`
        const videoClipId = createId('clip')
        const timelineClip = createTimelineClip(
          preparedShot.selectedAsset,
          currentTime,
          preparedShot.durationSeconds,
          preparedShot.colorLabel,
          laneIndex,
          beatbanditVariantKey,
          laneIndex + 1,
        )
        timelineClip.id = videoClipId

        if (preparedShot.selectedAsset.type === 'video') {
          const audioClipId = createId('clip')
          timelineClip.linkedClipIds = [audioClipId]
          clips.push(timelineClip)
          clips.push(createAudioTimelineClip(
            audioClipId,
            preparedShot.selectedAsset,
            currentTime,
            preparedShot.durationSeconds,
            laneCount + laneIndex,
            videoClipId,
            preparedShot.colorLabel,
            beatbanditVariantKey,
            laneIndex + 1,
          ))
        } else {
          clips.push(timelineClip)
        }
      }

      if (preparedShot.dialogue) {
        subtitles.push(createSubtitle(preparedShot.dialogue, currentTime, currentTime + preparedShot.durationSeconds))
      }

      currentTime += preparedShot.durationSeconds
    }

    const normalized = withSubtitleTrackIfNeeded(clips, subtitles, laneCount, laneCount)
    return {
      ...baseTimeline,
      tracks: normalized.tracks,
      clips: normalized.clips,
      subtitles: normalized.subtitles,
    }
  }

  const masterTimeline = buildTimelineForShots('Master Timeline', sortedShots)
  const sceneTimelines = manifest.scenes
    .slice()
    .sort((left, right) => (left.position ?? 0) - (right.position ?? 0))
    .map((scene, index) => buildTimelineForShots(getSceneDisplayName(scene, index), sceneShotMap.get(scene.id) || []))

  const thumbnailRelativePath = manifest.project.thumbnail_path ? normalizeRelativePath(manifest.project.thumbnail_path) : null
  const thumbnailFile = thumbnailRelativePath ? fileResolutionMap.get(thumbnailRelativePath) : undefined
  const projectThumbnail = thumbnailFile?.exists
    ? thumbnailFile.fileUrl
    : importedAssets.find(asset => asset.type === 'image' && asset.bin?.startsWith('Scene '))?.url

  const project: Project = {
    id: createId('project'),
    name: manifest.project.name?.trim() || 'Imported BeatBandit Project',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    assets: importedAssets,
    thumbnail: projectThumbnail,
    timelines: [masterTimeline, ...sceneTimelines],
    activeTimelineId: masterTimeline.id,
    assetSavePath: basePath,
  }

  const subtitleCount = project.timelines.reduce((total, timeline) => total + (timeline.subtitles?.length || 0), 0)

  return {
    project,
    summary: {
      projectName: project.name,
      sceneCount: manifest.scenes.length,
      shotCount: manifest.shots.length,
      stillCount: importedStillCount,
      videoCount: importedVideoCount,
      referenceCount: importedReferenceCount,
      subtitleCount,
      warningCount: warnings.length,
    },
    warnings,
  }
}
