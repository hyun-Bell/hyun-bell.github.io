/**
 * 캐싱 시스템
 * 빌드 시간 단축 및 API 호출 최소화
 */

import { promises as fs } from 'fs';
import path from 'path';
import md5 from 'md5';
import { logError } from './errors';

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  cacheDir?: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hash: string;
}

export class CacheManager {
  private cacheDir: string;
  private defaultTTL: number;

  constructor(options: CacheOptions = {}) {
    this.cacheDir = options.cacheDir || '.astro/cache';
    this.defaultTTL = options.ttl || 60 * 60 * 1000; // 1 hour default
  }

  /**
   * 캐시 키 생성
   */
  private getCacheKey(namespace: string, key: string): string {
    return `${namespace}-${md5(key)}.json`;
  }

  /**
   * 캐시 파일 경로
   */
  private getCachePath(cacheKey: string): string {
    return path.join(this.cacheDir, cacheKey);
  }

  /**
   * 캐시 디렉토리 확인 및 생성
   */
  private async ensureCacheDir(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      logError(error, 'ensureCacheDir');
    }
  }

  /**
   * 캐시 읽기
   */
  async get<T>(namespace: string, key: string, ttl?: number): Promise<T | null> {
    try {
      const cacheKey = this.getCacheKey(namespace, key);
      const cachePath = this.getCachePath(cacheKey);

      const fileContent = await fs.readFile(cachePath, 'utf-8');
      const entry: CacheEntry<T> = JSON.parse(fileContent);

      // TTL 확인
      const maxAge = ttl || this.defaultTTL;
      const age = Date.now() - entry.timestamp;

      if (age > maxAge) {
        // 캐시 만료
        await this.delete(namespace, key);
        return null;
      }

      return entry.data;
    } catch (error) {
      // 캐시 미스
      return null;
    }
  }

  /**
   * 캐시 쓰기
   */
  async set<T>(namespace: string, key: string, data: T): Promise<void> {
    try {
      await this.ensureCacheDir();

      const cacheKey = this.getCacheKey(namespace, key);
      const cachePath = this.getCachePath(cacheKey);

      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        hash: md5(JSON.stringify(data)),
      };

      await fs.writeFile(cachePath, JSON.stringify(entry, null, 2), 'utf-8');
    } catch (error) {
      logError(error, 'cache.set');
    }
  }

  /**
   * 캐시 삭제
   */
  async delete(namespace: string, key: string): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(namespace, key);
      const cachePath = this.getCachePath(cacheKey);

      await fs.unlink(cachePath);
    } catch (error) {
      // 파일이 없어도 에러로 처리하지 않음
    }
  }

  /**
   * 네임스페이스별 캐시 클리어
   */
  async clearNamespace(namespace: string): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      const namespaceFiles = files.filter((file) => file.startsWith(`${namespace}-`));

      await Promise.all(namespaceFiles.map((file) => fs.unlink(path.join(this.cacheDir, file))));
    } catch (error) {
      logError(error, 'clearNamespace');
    }
  }

  /**
   * 전체 캐시 클리어
   */
  async clearAll(): Promise<void> {
    try {
      await fs.rm(this.cacheDir, { recursive: true, force: true });
    } catch (error) {
      logError(error, 'clearAll');
    }
  }

  /**
   * 캐시 통계
   */
  async getStats(): Promise<{
    totalSize: number;
    fileCount: number;
    namespaces: Record<string, number>;
  }> {
    try {
      const files = await fs.readdir(this.cacheDir);
      let totalSize = 0;
      const namespaces: Record<string, number> = {};

      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        const stat = await fs.stat(filePath);
        totalSize += stat.size;

        const namespace: string = file.split('-')[0] ?? '';
        namespaces[namespace] = (namespaces[namespace] ?? 0) + 1;
      }

      return {
        totalSize,
        fileCount: files.length,
        namespaces,
      };
    } catch (error) {
      return {
        totalSize: 0,
        fileCount: 0,
        namespaces: {},
      };
    }
  }
}

// 기본 캐시 매니저 인스턴스
export const cache = new CacheManager();
