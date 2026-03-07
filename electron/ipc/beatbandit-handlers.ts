import { app, ipcMain } from 'electron'
import extractZip from 'extract-zip'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { getAllowedRoots } from '../config'
import { approvePath, validatePath } from '../path-validation'

interface BeatBanditImportPayload {
  manifest: unknown
  basePath: string
  zipPath: string
}

function createImportId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function sanitizeFolderName(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')

  return cleaned || 'Imported Project'
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function getUniqueImportDirectory(rootDir: string, projectName: string): Promise<string> {
  const baseName = sanitizeFolderName(projectName)
  const firstCandidate = path.join(rootDir, baseName)
  if (!(await pathExists(firstCandidate))) {
    return firstCandidate
  }

  const importedCandidate = path.join(rootDir, `${baseName} (imported)`)
  if (!(await pathExists(importedCandidate))) {
    return importedCandidate
  }

  let index = 2
  while (await pathExists(path.join(rootDir, `${baseName} (imported ${index})`))) {
    index += 1
  }

  return path.join(rootDir, `${baseName} (imported ${index})`)
}

async function readManifestFromDirectory(baseDir: string): Promise<unknown> {
  const manifestPath = path.join(baseDir, 'beatbandit-project.json')
  const rawManifest = await fs.readFile(manifestPath, 'utf-8')
  return JSON.parse(rawManifest)
}

function getManifestProjectName(manifest: unknown, zipPath: string): string {
  if (
    manifest &&
    typeof manifest === 'object' &&
    'project' in manifest &&
    manifest.project &&
    typeof manifest.project === 'object' &&
    'name' in manifest.project &&
    typeof manifest.project.name === 'string' &&
    manifest.project.name.trim()
  ) {
    return manifest.project.name.trim()
  }

  return path.basename(zipPath, path.extname(zipPath))
}

export function registerBeatBanditHandlers(): void {
  ipcMain.handle('extract-beatbandit-package', async (_event, zipPath: string): Promise<BeatBanditImportPayload> => {
    const validatedZipPath = validatePath(zipPath, getAllowedRoots())
    const stageDir = path.join(os.tmpdir(), `ltx-beatbandit-import-${createImportId()}`)

    try {
      if (path.extname(validatedZipPath).toLowerCase() !== '.zip') {
        throw new Error('BeatBandit imports must use a .zip package')
      }

      await fs.mkdir(stageDir, { recursive: true })
      await extractZip(validatedZipPath, { dir: stageDir })

      const manifest = await readManifestFromDirectory(stageDir)
      const downloadsRoot = path.join(app.getPath('downloads'), 'Ltx Desktop Assets')
      await fs.mkdir(downloadsRoot, { recursive: true })

      const finalBasePath = await getUniqueImportDirectory(downloadsRoot, getManifestProjectName(manifest, validatedZipPath))
      await fs.cp(stageDir, finalBasePath, { recursive: true, force: true })
      approvePath(finalBasePath)

      return {
        manifest,
        basePath: finalBasePath,
        zipPath: validatedZipPath,
      }
    } finally {
      await fs.rm(stageDir, { recursive: true, force: true }).catch(() => undefined)
    }
  })
}
