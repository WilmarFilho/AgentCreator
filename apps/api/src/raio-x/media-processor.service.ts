import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SupabaseClient } from '@supabase/supabase-js';

// Set ffmpeg/ffprobe binary paths from the bundled installers
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ffprobePath = require('@ffprobe-installer/ffprobe').path;
  ffmpeg.setFfprobePath(ffprobePath);
} catch {
  // ffprobe installer not available, will use system ffprobe if present
}

const BUCKET_NAME = 'raio-x-media';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

@Injectable()
export class MediaProcessorService {
  private readonly logger = new Logger(MediaProcessorService.name);
  /**
   * Downloads media from Instagram, compresses if needed, and uploads to Supabase Storage.
   * Returns the public URL of the stored file, or null if the file is too large even after compression.
   */
  async downloadAndStoreMedia(
    mediaUrl: string,
    profileId: string,
    mediaType: 'IMAGE',
    fileName: string,
    sbClient: SupabaseClient,
  ): Promise<{ storagePath: string; publicUrl: string } | null> {
    const tmpDir = os.tmpdir();
    const ts = Date.now();

    try {
      // 1. Download the media
      this.logger.debug(`Downloading ${mediaType} for storage: ${mediaUrl.substring(0, 60)}...`);
      const response = await axios.get(mediaUrl, {
        responseType: 'arraybuffer',
        timeout: 120000,
        maxContentLength: 150 * 1024 * 1024,
      });

      let buffer = Buffer.from(response.data);
      let mimeType = mediaType === 'IMAGE' ? 'image/jpeg' : 'video/mp4';
      let ext = mediaType === 'IMAGE' ? 'jpg' : 'mp4';
      const originalSize = buffer.length;

      this.logger.debug(`Downloaded ${mediaType}: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);

      // 2. Compress if > 50MB
      if (buffer.length > MAX_FILE_SIZE) {
        this.logger.debug(`File exceeds 50MB, compressing ${mediaType}...`);

        if (mediaType === 'IMAGE') {
          buffer = await this.compressImage(buffer, tmpDir, ts);
        }

        this.logger.debug(`Compressed: ${(originalSize / 1024 / 1024).toFixed(2)} MB → ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

        // 3. If still > 50MB, skip
        if (buffer.length > MAX_FILE_SIZE) {
          this.logger.warn(`File still exceeds 50MB after compression (${(buffer.length / 1024 / 1024).toFixed(2)} MB). Skipping upload.`);
          return null;
        }
      }

      // 4. Upload to Supabase Storage
      const storagePath = `${profileId}/${fileName}.${ext}`;

      const { error } = await sbClient.storage
        .from(BUCKET_NAME)
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (error) {
        this.logger.error(`Failed to upload to Supabase Storage: ${error.message}`);
        return null;
      }

      // 5. Get public URL
      const { data: urlData } = sbClient.storage
        .from(BUCKET_NAME)
        .getPublicUrl(storagePath);

      this.logger.debug(`Uploaded to storage: ${storagePath}`);
      return { storagePath, publicUrl: urlData.publicUrl };
    } catch (error: any) {
      this.logger.error(`Failed to download/store media: ${error.message}`);
      return null;
    }
  }

  /**
   * Deletes all stored media for a profile from Supabase Storage.
   */
  async cleanupProfileMedia(profileId: string, sbClient: SupabaseClient): Promise<void> {
    try {
      const { data: files } = await sbClient.storage
        .from(BUCKET_NAME)
        .list(profileId);

      if (files && files.length > 0) {
        const filePaths = files.map(f => `${profileId}/${f.name}`);
        await sbClient.storage.from(BUCKET_NAME).remove(filePaths);
        this.logger.debug(`Cleaned up ${filePaths.length} files from storage for profile ${profileId}`);
      }
    } catch (error: any) {
      this.logger.warn(`Failed to cleanup storage for profile ${profileId}: ${error.message}`);
    }
  }

  /**
   * Compress image using ffmpeg (re-encode as JPEG with lower quality)
   */
  private async compressImage(buffer: Buffer, tmpDir: string, ts: number): Promise<Buffer> {
    const inputPath = path.join(tmpDir, `img_input_${ts}.jpg`);
    const outputPath = path.join(tmpDir, `img_output_${ts}.jpg`);

    try {
      fs.writeFileSync(inputPath, buffer);

      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions(['-q:v', '8']) // Lower quality (2=best, 31=worst)
          .on('error', (err: Error) => reject(err))
          .on('end', () => resolve())
          .save(outputPath);
      });

      return fs.readFileSync(outputPath);
    } finally {
      this.safeDelete(inputPath);
      this.safeDelete(outputPath);
    }
  }

  private safeDelete(filePath: string) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      this.logger.warn(`Could not delete temp file: ${filePath}`);
    }
  }
}
