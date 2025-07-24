import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { CharterService } from '@/services/charterService';
import { useCharter } from '@/hooks/useCharter';
import { useApp } from '@/contexts/AppContext';
import { Upload, FileText, Trash2, Download, AlertCircle, CheckCircle } from 'lucide-react';

const CharterUpload: React.FC = () => {
  const { selectedSeason } = useApp();
  const { charterInfo, loading, refetch, hasCharter } = useCharter();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadError(null);
      setUploadSuccess(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedSeason) {
      setUploadError('Please select a file and ensure a season is selected');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      // Get season ID
      const { DatabaseService } = await import('@/services/databaseService');
      const { data: seasons } = await DatabaseService.getSeasons({
        filters: [{ column: 'season_year', operator: 'eq', value: selectedSeason }]
      });

      if (!seasons || seasons.length === 0) {
        throw new Error('Season not found');
      }

      const seasonId = seasons[0].id;

      // Simulate progress for better UX
      setUploadProgress(25);

      // Upload charter
      const result = await CharterService.uploadCharter(
        seasonId,
        selectedFile,
        'admin-user' // TODO: Replace with actual user ID from auth context
      );

      setUploadProgress(75);

      if (result.success) {
        setUploadProgress(100);
        setUploadSuccess(`Charter "${result.fileName}" uploaded successfully!`);
        setSelectedFile(null);
        
        // Reset file input
        const fileInput = document.getElementById('charter-file') as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
        }

        // Refresh charter info
        setTimeout(() => {
          refetch();
          setUploadProgress(0);
        }, 1000);
      } else {
        throw new Error(result.error || 'Upload failed');
      }

    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedSeason || !hasCharter) return;

    if (!confirm('Are you sure you want to delete the current charter? This action cannot be undone.')) {
      return;
    }

    try {
      const { DatabaseService } = await import('@/services/databaseService');
      const { data: seasons } = await DatabaseService.getSeasons({
        filters: [{ column: 'season_year', operator: 'eq', value: selectedSeason }]
      });

      if (!seasons || seasons.length === 0) {
        throw new Error('Season not found');
      }

      const result = await CharterService.deleteCharter(seasons[0].id);

      if (result.success) {
        setUploadSuccess('Charter deleted successfully');
        refetch();
      } else {
        setUploadError(result.error || 'Failed to delete charter');
      }

    } catch (error) {
      console.error('Delete error:', error);
      setUploadError(error instanceof Error ? error.message : 'Delete failed');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading charter information...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>League Charter Management</span>
          </CardTitle>
          <CardDescription>
            Upload and manage the official league charter document for {selectedSeason} season
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Charter Status */}
          {hasCharter && charterInfo ? (
            <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-900/20">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">
                    {CharterService.getFileIcon(charterInfo.fileName)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-800 dark:text-green-200">
                      Current Charter
                    </h4>
                    <p className="text-sm text-green-600 dark:text-green-300">
                      {charterInfo.fileName}
                    </p>
                    <p className="text-xs text-green-500 dark:text-green-400">
                      Uploaded {formatDate(charterInfo.uploadedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(charterInfo.fileUrl, '_blank')}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No Charter Uploaded</AlertTitle>
              <AlertDescription>
                No charter document has been uploaded for the {selectedSeason} season yet.
              </AlertDescription>
            </Alert>
          )}

          {/* Upload Section */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="charter-file">
                {hasCharter ? 'Replace Charter Document' : 'Upload Charter Document'}
              </Label>
              <div className="mt-2">
                <Input
                  id="charter-file"
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={handleFileSelect}
                  disabled={uploading}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Supported formats: PDF, Word documents, Text files (Max 10MB)
              </p>
            </div>

            {selectedFile && (
              <div className="p-3 border rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">
                      {CharterService.getFileIcon(selectedFile.name)}
                    </span>
                    <div>
                      <p className="font-medium text-blue-800 dark:text-blue-200">
                        {selectedFile.name}
                      </p>
                      <p className="text-sm text-blue-600 dark:text-blue-300">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="ml-4"
                  >
                    {uploading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Upload Progress */}
            {uploading && uploadProgress > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            )}

            {/* Success Message */}
            {uploadSuccess && (
              <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800 dark:text-green-200">Success</AlertTitle>
                <AlertDescription className="text-green-700 dark:text-green-300">
                  {uploadSuccess}
                </AlertDescription>
              </Alert>
            )}

            {/* Error Message */}
            {uploadError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Upload Error</AlertTitle>
                <AlertDescription>{uploadError}</AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Charter Upload Guidelines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none">
            <ul className="space-y-2">
              <li>Only administrators can upload or modify charter documents</li>
              <li>Supported file formats: PDF, Word documents (.doc, .docx), and text files</li>
              <li>Maximum file size: 10MB</li>
              <li>The charter will be publicly viewable on the League Rules page</li>
              <li>Uploading a new charter will replace the existing one</li>
              <li>All charter changes are logged with timestamp and admin information</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CharterUpload;