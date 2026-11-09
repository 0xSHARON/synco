import fs from 'node:fs';
import path from 'node:path';
import { TargetType, type ILyrics } from './types.js';
import { identifyLyricsType, syncedToPlaintext } from './utils.js';

export class Lyrics implements ILyrics {
  public synced?: string | null = null;
  public unsynced?: string | null = null;

  constructor(synced?: string | null, unsynced?: string | null) {
    this.synced = synced ?? null;
    this.unsynced = unsynced ?? null;
  }

  public addUnknown(unknown?: string | null): void {
    if (!unknown || typeof unknown !== 'string') return;
    const trimmed = unknown.trim();
    if (!trimmed) return;

    const type = identifyLyricsType(trimmed);
    if (type === 'synced') {
      this.synced = trimmed;
    } else if (type === 'plaintext') {
      this.unsynced = trimmed;
    }
  }

  public update(other?: ILyrics | null): void {
    if (!other) return;
    if (other.synced) {
      this.synced = other.synced;
    }
    if (other.unsynced) {
      this.unsynced = other.unsynced;
    }
  }

  public isPreferred(targetType: TargetType): boolean {
    return Boolean(
      this.synced || (targetType === TargetType.PLAINTEXT && this.unsynced)
    );
  }

  public isAcceptable(targetType: TargetType): boolean {
    return Boolean(
      this.synced || (targetType !== TargetType.SYNCED_ONLY && this.unsynced)
    );
  }

  public toStr(targetType: TargetType): string | null {
    if (targetType === TargetType.PLAINTEXT) {
      if (this.unsynced) return this.unsynced;
      if (this.synced) return syncedToPlaintext(this.synced);
      return null;
    }
    if (targetType === TargetType.PREFER_SYNCED) {
      return this.synced || this.unsynced || null;
    }
    return this.synced || null;
  }

  public async saveLrcFile(filePath: string, targetType: TargetType): Promise<void> {
    const text = this.toStr(targetType);
    if (!text) return;
    const resolvedPath = path.resolve(filePath);
    await fs.promises.mkdir(path.dirname(resolvedPath), { recursive: true });
    await fs.promises.writeFile(resolvedPath, text, 'utf-8');
  }
}

