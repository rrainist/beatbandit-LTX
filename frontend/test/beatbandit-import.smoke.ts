import assert from 'node:assert/strict'
import { buildBeatBanditImportProject } from '../lib/beatbandit-import'

function createCheckFilesExist(existingPaths: string[]) {
  const existing = new Set(existingPaths)
  return async (filePaths: string[]) => Object.fromEntries(filePaths.map(filePath => [filePath, existing.has(filePath)]))
}

async function testCompleteImport(): Promise<void> {
  const basePath = 'C:\\Imports\\BeatBandit Demo'
  const existingPaths = [
    `${basePath}\\assets\\thumbnail.png`,
    `${basePath}\\assets\\shots\\stills\\shot_001.png`,
    `${basePath}\\assets\\shots\\stills\\shot_002.png`,
    `${basePath}\\assets\\shots\\videos\\shot_002.mp4`,
    `${basePath}\\assets\\references\\characters\\maya.png`,
  ]

  ;(globalThis as any).window = {
    electronAPI: {
      checkFilesExist: createCheckFilesExist(existingPaths),
    },
  }

  const result = await buildBeatBanditImportProject({
    schema_version: '1.0.0',
    project: {
      id: 'bb-project-1',
      name: 'Cafe Story',
      default_fps: 24,
      default_resolution: '1920x1080',
      thumbnail_path: 'assets/thumbnail.png',
    },
    scenes: [
      { id: 'scene_001', name: 'INT. CAFE - DAY', position: 1000, scene_number: 1 },
    ],
    shots: [
      {
        id: 'shot_001',
        scene_id: 'scene_001',
        position: 1000,
        duration_seconds: 4,
        dialogue: 'MAYA: Is this seat taken?',
        movement: 'Slow dolly in',
        t2v_prompt: 'Cinematic cafe interior with Maya entering frame.',
        selected_still_asset_id: 'asset_still_001',
        primary_reference_asset_id: 'ref_maya_001',
      },
      {
        id: 'shot_002',
        scene_id: 'scene_001',
        position: 2000,
        duration_seconds: 6,
        t2v_prompt: 'Medium shot of Maya sitting down.',
        selected_still_asset_id: 'asset_still_002',
        selected_video_asset_id: 'asset_video_002',
        primary_reference_asset_id: 'ref_maya_001',
      },
    ],
    assets: [
      {
        id: 'asset_still_001',
        kind: 'shot_still',
        path: 'assets/shots/stills/shot_001.png',
        width: 1920,
        height: 1080,
        source_shot_id: 'shot_001',
        prompt: 'Cinematic cafe interior with Maya entering frame.',
      },
      {
        id: 'asset_still_002',
        kind: 'shot_still',
        path: 'assets/shots/stills/shot_002.png',
        width: 1920,
        height: 1080,
        source_shot_id: 'shot_002',
        prompt: 'Medium shot of Maya sitting down.',
      },
      {
        id: 'asset_video_002',
        kind: 'shot_video',
        path: 'assets/shots/videos/shot_002.mp4',
        width: 1920,
        height: 1080,
        duration_seconds: 6,
        source_shot_id: 'shot_002',
        prompt: 'Medium shot of Maya sitting down.',
      },
    ],
    references: [
      {
        id: 'ref_maya_001',
        kind: 'character',
        label: 'Maya',
        path: 'assets/references/characters/maya.png',
        width: 1024,
        height: 1024,
        description: 'Maya character reference',
      },
    ],
  }, basePath)

  assert.equal(result.project.timelines.length, 2)
  assert.equal(result.project.assets.length, 4)
  assert.equal(result.project.thumbnail, 'file:///C:/Imports/BeatBandit Demo/assets/thumbnail.png')
  assert.equal(result.project.activeTimelineId, result.project.timelines[0].id)
  assert.equal(result.project.timelines[0].clips.length, 2)
  assert.equal(result.project.timelines[0].clips[1].assetId, 'asset_video_002')
  assert.equal(result.project.timelines[0].subtitles?.length, 1)
  assert.equal(result.project.timelines[0].tracks[0].type, 'subtitle')
  assert.equal(result.project.timelines[0].clips[0].trackIndex, 1)

  const firstStill = result.project.assets.find(asset => asset.id === 'asset_still_001')
  assert.ok(firstStill?.generationParams)
  assert.equal(firstStill?.generationParams?.mode, 'image-to-video')
  assert.equal(firstStill?.generationParams?.inputImageUrl, 'file:///C:/Imports/BeatBandit Demo/assets/shots/stills/shot_001.png')
  assert.equal(firstStill?.generationParams?.cameraMotion, 'dolly_in')
  assert.equal(result.warnings.length, 0)
}

async function testDegradedImport(): Promise<void> {
  const basePath = 'C:\\Imports\\BeatBandit Missing Media'
  const existingPaths = [
    `${basePath}\\assets\\shots\\stills\\shot_003.png`,
  ]

  ;(globalThis as any).window = {
    electronAPI: {
      checkFilesExist: createCheckFilesExist(existingPaths),
    },
  }

  const result = await buildBeatBanditImportProject({
    schema_version: '1.0.0',
    project: {
      id: 'bb-project-2',
      name: 'Missing Media Story',
    },
    scenes: [
      { id: 'scene_010', name: 'EXT. STREET - NIGHT', position: 1000, scene_number: 10 },
    ],
    shots: [
      {
        id: 'shot_003',
        scene_id: 'scene_010',
        position: 1000,
        duration_seconds: 0,
        t2v_prompt: 'Wide street scene at night.',
        selected_still_asset_id: 'asset_still_003',
        selected_video_asset_id: 'asset_video_003',
      },
    ],
    assets: [
      {
        id: 'asset_still_003',
        kind: 'shot_still',
        path: 'assets/shots/stills/shot_003.png',
        width: 1920,
        height: 1080,
        source_shot_id: 'shot_003',
        prompt: 'Wide street scene at night.',
      },
      {
        id: 'asset_video_003',
        kind: 'shot_video',
        path: 'assets/shots/videos/shot_003.mp4',
        width: 1920,
        height: 1080,
        duration_seconds: 0,
        source_shot_id: 'shot_003',
        prompt: 'Wide street scene at night.',
      },
    ],
    references: [],
  }, basePath)

  assert.equal(result.project.timelines[0].clips.length, 1)
  assert.equal(result.project.timelines[0].clips[0].assetId, 'asset_still_003')
  assert.equal(result.project.timelines[0].clips[0].duration, 5)
  assert.ok(result.warnings.some(warning => warning.includes('Missing shot video file')))
  assert.ok(result.warnings.some(warning => warning.includes('zero or missing duration')))
}

async function testReferenceOnlyShotFallback(): Promise<void> {
  const basePath = 'C:\\Imports\\BeatBandit Reference Fallback'
  const existingPaths = [
    `${basePath}\\assets\\references\\characters\\maya.png`,
  ]

  ;(globalThis as any).window = {
    electronAPI: {
      checkFilesExist: createCheckFilesExist(existingPaths),
    },
  }

  const result = await buildBeatBanditImportProject({
    schema_version: '1.0.0',
    project: {
      id: 'bb-project-3',
      name: 'Reference Fallback Story',
      default_fps: 24,
      default_resolution: '1920x1080',
    },
    scenes: [
      { id: 'scene_020', name: 'INT. LAB - NIGHT', position: 1000, scene_number: 20 },
    ],
    shots: [
      {
        id: 'shot_010',
        scene_id: 'scene_020',
        position: 1000,
        duration_seconds: 7,
        movement: 'Slow push in',
        t2v_prompt: 'A tense lab close-up with Maya preparing the device.',
        primary_reference_asset_id: 'ref_maya_010',
        reference_asset_ids: ['ref_maya_010'],
      },
    ],
    assets: [],
    references: [
      {
        id: 'ref_maya_010',
        kind: 'character',
        label: 'Maya',
        path: 'assets/references/characters/maya.png',
        width: 1024,
        height: 1024,
        description: 'Maya character reference',
      },
    ],
  }, basePath)

  assert.equal(result.project.timelines[0].clips.length, 1)
  const fallbackClip = result.project.timelines[0].clips[0]
  assert.equal(fallbackClip.type, 'image')
  assert.equal(fallbackClip.assetId, 'bb-shot-placeholder-shot_010')

  const placeholderAsset = result.project.assets.find(asset => asset.id === 'bb-shot-placeholder-shot_010')
  assert.ok(placeholderAsset)
  assert.equal(placeholderAsset?.prompt, 'A tense lab close-up with Maya preparing the device.')
  assert.equal(placeholderAsset?.generationParams?.mode, 'image-to-video')
  assert.equal(placeholderAsset?.generationParams?.inputImageUrl, 'file:///C:/Imports/BeatBandit Reference Fallback/assets/references/characters/maya.png')
  assert.equal(placeholderAsset?.bin, 'Scene 20: INT. LAB - NIGHT')
  assert.equal(result.warnings.length, 0)
}

async function testLaneDuplicationImport(): Promise<void> {
  const basePath = 'C:\\Imports\\BeatBandit Multi Lane'
  const existingPaths = [
    `${basePath}\\assets\\shots\\stills\\shot_020.png`,
  ]

  ;(globalThis as any).window = {
    electronAPI: {
      checkFilesExist: createCheckFilesExist(existingPaths),
    },
  }

  const result = await buildBeatBanditImportProject({
    schema_version: '1.0.0',
    project: {
      id: 'bb-project-4',
      name: 'Multi Lane Story',
      default_fps: 24,
      default_resolution: '1920x1080',
    },
    scenes: [
      { id: 'scene_030', name: 'INT. HALLWAY - NIGHT', position: 1000, scene_number: 30 },
    ],
    shots: [
      {
        id: 'shot_020',
        scene_id: 'scene_030',
        position: 1000,
        duration_seconds: 5,
        t2v_prompt: 'A slow hallway push toward a closed door.',
        selected_still_asset_id: 'asset_still_020',
      },
    ],
    assets: [
      {
        id: 'asset_still_020',
        kind: 'shot_still',
        path: 'assets/shots/stills/shot_020.png',
        width: 1920,
        height: 1080,
        source_shot_id: 'shot_020',
        prompt: 'A slow hallway push toward a closed door.',
      },
    ],
    references: [],
  }, basePath, { laneCount: 5 })

  const masterTimeline = result.project.timelines[0]
  assert.equal(masterTimeline.clips.length, 5)
  assert.deepEqual(masterTimeline.clips.map(clip => clip.trackIndex), [0, 1, 2, 3, 4])
  assert.deepEqual(masterTimeline.clips.map(clip => clip.beatbanditLaneIndex), [1, 2, 3, 4, 5])
  assert.deepEqual(masterTimeline.clips.map(clip => clip.beatbanditVariantKey), [
    'shot_020:lane:1',
    'shot_020:lane:2',
    'shot_020:lane:3',
    'shot_020:lane:4',
    'shot_020:lane:5',
  ])
  assert.ok(masterTimeline.tracks.some(track => track.name === 'V5'))
}

async function main(): Promise<void> {
  await testCompleteImport()
  await testDegradedImport()
  await testReferenceOnlyShotFallback()
  await testLaneDuplicationImport()
  console.log('BeatBandit import smoke tests passed')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
