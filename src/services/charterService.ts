import { supabase } from '@/lib/supabase';
import { DatabaseService } from './databaseService';

export interface CharterUploadResult {
  success: boolean;
  fileUrl?: string;
  fileName?: string;
  error?: string;
}

export interface CharterInfo {
  fileUrl: string;
  fileName: string;
  uploadedAt: string;
  uploadedBy: string;
}

export class CharterService {
  private static readonly BUCKET_NAME = 'league-documents';
  private static readonly ALLOWED_FILE_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  /**
   * Initialize the storage bucket if it doesn't exist
   */
  static async initializeBucket(): Promise<void> {
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some(bucket => bucket.name === this.BUCKET_NAME);

      if (!bucketExists) {
        const { error } = await supabase.storage.createBucket(this.BUCKET_NAME, {
          public: true,
          allowedMimeTypes: this.ALLOWED_FILE_TYPES,
          fileSizeLimit: this.MAX_FILE_SIZE
        });

        if (error) {
          console.error('Error creating charter bucket:', error);
          throw error;
        }
      }
    } catch (error) {
      console.error('Error initializing charter bucket:', error);
      throw error;
    }
  }

  /**
   * Upload charter document for a specific season
   */
  static async uploadCharter(
    seasonId: number,
    file: File,
    uploadedBy: string
  ): Promise<CharterUploadResult> {
    try {
      // Validate file
      const validation = this.validateFile(file);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Initialize bucket
      await this.initializeBucket();

      // Generate unique filename
      const fileExtension = file.name.split('.').pop();
      const fileName = `charter-season-${seasonId}-${Date.now()}.${fileExtension}`;
      const filePath = `charters/${fileName}`;

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Error uploading charter:', uploadError);
        return { success: false, error: 'Failed to upload file' };
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(filePath);

      if (!urlData.publicUrl) {
        return { success: false, error: 'Failed to get file URL' };
      }

      // Update season record with charter information
      const { error: updateError } = await DatabaseService.updateSeason(seasonId, {
        charter_file_url: urlData.publicUrl,
        charter_file_name: file.name,
        charter_uploaded_at: new Date().toISOString(),
        charter_uploaded_by: uploadedBy
      });

      if (updateError) {
        console.error('Error updating season with charter info:', updateError);
        // Try to clean up uploaded file
        await this.deleteCharterFile(filePath);
        return { success: false, error: 'Failed to save charter information' };
      }

      return {
        success: true,
        fileUrl: urlData.publicUrl,
        fileName: file.name
      };

    } catch (error) {
      console.error('Error in uploadCharter:', error);
      return { success: false, error: 'Unexpected error during upload' };
    }
  }

  /**
   * Get charter information for a season
   */
  static async getCharterInfo(seasonId: number): Promise<CharterInfo | null> {
    try {
      const { data: seasons } = await DatabaseService.getSeasons({
        filters: [{ column: 'id', operator: 'eq', value: seasonId }]
      });

      if (!seasons || seasons.length === 0) {
        return null;
      }

      const season = seasons[0];
      
      if (!season.charter_file_url || !season.charter_file_name) {
        return null;
      }

      return {
        fileUrl: season.charter_file_url,
        fileName: season.charter_file_name,
        uploadedAt: season.charter_uploaded_at || '',
        uploadedBy: season.charter_uploaded_by || ''
      };

    } catch (error) {
      console.error('Error getting charter info:', error);
      return null;
    }
  }

  /**
   * Delete charter for a season
   */
  static async deleteCharter(seasonId: number): Promise<{ success: boolean; error?: string }> {
    try {
      // Get current charter info
      const charterInfo = await this.getCharterInfo(seasonId);
      if (!charterInfo) {
        return { success: false, error: 'No charter found for this season' };
      }

      // Extract file path from URL
      const url = new URL(charterInfo.fileUrl);
      const filePath = url.pathname.split('/').slice(-2).join('/'); // Get last two parts of path

      // Delete file from storage
      const { error: deleteError } = await supabase.storage
        .from(this.BUCKET_NAME)
        .remove([filePath]);

      if (deleteError) {
        console.error('Error deleting charter file:', deleteError);
      }

      // Update season record to remove charter information
      const { error: updateError } = await DatabaseService.updateSeason(seasonId, {
        charter_file_url: null,
        charter_file_name: null,
        charter_uploaded_at: null,
        charter_uploaded_by: null
      });

      if (updateError) {
        console.error('Error updating season after charter deletion:', updateError);
        return { success: false, error: 'Failed to update season record' };
      }

      return { success: true };

    } catch (error) {
      console.error('Error in deleteCharter:', error);
      return { success: false, error: 'Unexpected error during deletion' };
    }
  }

  /**
   * Validate uploaded file
   */
  private static validateFile(file: File): { valid: boolean; error?: string } {
    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      return { valid: false, error: 'File size must be less than 10MB' };
    }

    // Check file type
    if (!this.ALLOWED_FILE_TYPES.includes(file.type)) {
      return { valid: false, error: 'File must be PDF, Word document, or text file' };
    }

    return { valid: true };
  }

  /**
   * Delete a file from storage (internal helper)
   */
  private static async deleteCharterFile(filePath: string): Promise<void> {
    try {
      await supabase.storage.from(this.BUCKET_NAME).remove([filePath]);
    } catch (error) {
      console.error('Error deleting charter file:', error);
    }
  }

  /**
   * Get file extension icon for display
   */
  static getFileIcon(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return '📄';
      case 'doc':
      case 'docx':
        return '📝';
      case 'txt':
        return '📃';
      default:
        return '📄';
    }
  }
}