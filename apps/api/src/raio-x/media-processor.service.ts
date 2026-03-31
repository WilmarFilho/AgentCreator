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
   * Downloads a video from URL and extracts audio as MP3 buffer.
   * Throws if the video has no audio stream (e.g., silent GIF-like loops).
   */
  async extractAudioFromVideo(videoUrl: string): Promise<Buffer> {
    this.logger.debug(`Downloading and extracting audio from video: ${videoUrl.substring(0, 80)}...`);

    const tmpDir = os.tmpdir();
    const videoPath = path.join(tmpDir, `video_${Date.now()}.mp4`);
    const audioPath = path.join(tmpDir, `audio_${Date.now()}.mp3`);

    try {
      this.logger.debug('Downloading video to temp file...');
      const response = await axios.get(videoUrl, {
        responseType: 'arraybuffer',
        timeout: 120000,
        maxContentLength: 100 * 1024 * 1024,
      });

      fs.writeFileSync(videoPath, Buffer.from(response.data));
      this.logger.debug(`Video downloaded: ${(response.data.byteLength / 1024 / 1024).toFixed(2)} MB`);

      // Check if video has an audio stream before trying to extract
      const hasAudio = await this.hasAudioStream(videoPath);
      if (!hasAudio) {
        this.logger.warn('Video has no audio stream, skipping transcription');
        throw new Error('Video has no audio stream — likely a silent GIF/loop');
      }

      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoPath)
          .toFormat('mp3')
          .audioBitrate('64k')
          .audioChannels(1)
          .audioFrequency(16000)
          .on('start', (cmd: string) => {
            this.logger.debug(`FFmpeg started: ${cmd}`);
          })
          .on('error', (err: Error) => {
            this.logger.error(`FFmpeg error: ${err.message}`);
            reject(err);
          })
          .on('end', () => {
            this.logger.debug('FFmpeg audio extraction complete');
            resolve();
          })
          .save(audioPath);
      });

      const audioBuffer = fs.readFileSync(audioPath);
      this.logger.debug(`Audio extracted: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`);
      return audioBuffer;
    } catch (error: any) {
      this.logger.error(`Failed to extract audio: ${error.message}`);
      throw error;
    } finally {
      this.safeDelete(videoPath);
      this.safeDelete(audioPath);
    }
  }

  /**
   * Probes a video file to check if it contains an audio stream.
   */
  private hasAudioStream(filePath: string): Promise<boolean> {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          this.logger.warn(`ffprobe failed, assuming audio exists: ${err.message}`);
          resolve(true); // Assume audio exists if probe fails — let FFmpeg handle it
          return;
        }
        const audioStream = metadata.streams?.find(s => s.codec_type === 'audio');
        if (!audioStream) {
          this.logger.debug('ffprobe: No audio stream found in video');
        }
        resolve(!!audioStream);
      });
    });
  }

  /**
   * Downloads media from Instagram, compresses if needed, and uploads to Supabase Storage.
   * Returns the public URL of the stored file, or null if the file is too large even after compression.
   */
  async downloadAndStoreMedia(
    mediaUrl: string,
    profileId: string,
    mediaType: 'IMAGE' | 'VIDEO',
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
        } else {
          buffer = await this.compressVideo(buffer, tmpDir, ts);
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

  /**
   * Compress video using ffmpeg (re-encode with CRF and lower resolution)
   */
  private async compressVideo(buffer: Buffer, tmpDir: string, ts: number): Promise<Buffer> {
    const inputPath = path.join(tmpDir, `vid_input_${ts}.mp4`);
    const outputPath = path.join(tmpDir, `vid_output_${ts}.mp4`);

    try {
      fs.writeFileSync(inputPath, buffer);

      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .videoCodec('libx264')
          .outputOptions(['-crf', '28', '-preset', 'fast'])
          .size('720x?') // Scale to 720p width, auto height
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
