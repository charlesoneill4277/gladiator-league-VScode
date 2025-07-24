import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import PDFViewer from './PDFViewer';
import { 
  Download, 
  ExternalLink, 
  FileText, 
  Maximize2, 
  Minimize2, 
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';

interface DocumentViewerProps {
  fileUrl: string;
  fileName: string;
  uploadedAt: string;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ 
  fileUrl, 
  fileName, 
  uploadedAt 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showViewer, setShowViewer] = useState(true);
  const [viewerError, setViewerError] = useState<string | null>(null);

  // Get file extension
  const getFileExtension = (filename: string): string => {
    return filename.split('.').pop()?.toLowerCase() || '';
  };

  // Get file type for display
  const getFileType = (filename: string): string => {
    const ext = getFileExtension(filename);
    switch (ext) {
      case 'pdf':
        return 'PDF Document';
      case 'doc':
      case 'docx':
        return 'Word Document';
      case 'txt':
        return 'Text Document';
      default:
        return 'Document';
    }
  };

  // Get appropriate viewer component
  const renderDocumentViewer = () => {
    const extension = getFileExtension(fileName);
    
    if (!showViewer) {
      return (
        <div className="text-center py-8">
          <EyeOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Document viewer hidden</p>
          <Button 
            variant="outline" 
            onClick={() => setShowViewer(true)}
            className="mt-2"
          >
            <Eye className="h-4 w-4 mr-2" />
            Show Document
          </Button>
        </div>
      );
    }

    switch (extension) {
      case 'pdf':
        return renderPDFViewer();
      case 'doc':
      case 'docx':
        return renderWordDocumentViewer();
      case 'txt':
        return renderTextViewer();
      default:
        return renderUnsupportedViewer();
    }
  };

  // PDF Viewer using enhanced PDF component
  const renderPDFViewer = () => (
    <PDFViewer
      fileUrl={fileUrl}
      fileName={fileName}
    />
  );

  // Word Document Viewer using Google Docs Viewer
  const renderWordDocumentViewer = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="secondary">Document Viewer</Badge>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowViewer(false)}
          >
            <EyeOff className="h-4 w-4 mr-1" />
            Hide
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <Minimize2 className="h-4 w-4 mr-1" />
            ) : (
              <Maximize2 className="h-4 w-4 mr-1" />
            )}
            {isExpanded ? 'Minimize' : 'Expand'}
          </Button>
        </div>
      </div>
      
      <div className={`border rounded-lg overflow-hidden ${isExpanded ? 'h-screen' : 'h-96'}`}>
        <iframe
          src={`https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`}
          width="100%"
          height="100%"
          title={fileName}
          className="border-0"
          onError={() => setViewerError('Failed to load document. Please try downloading the file.')}
        />
      </div>
      
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Word documents are displayed using Google Docs Viewer. For best experience, consider uploading as PDF.
        </AlertDescription>
      </Alert>
    </div>
  );

  // Text File Viewer
  const renderTextViewer = () => {
    const [textContent, setTextContent] = useState<string>('');
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
      fetch(fileUrl)
        .then(response => response.text())
        .then(text => {
          setTextContent(text);
          setLoading(false);
        })
        .catch(error => {
          console.error('Error loading text file:', error);
          setViewerError('Failed to load text file content.');
          setLoading(false);
        });
    }, [fileUrl]);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">Text Viewer</Badge>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowViewer(false)}
            >
              <EyeOff className="h-4 w-4 mr-1" />
              Hide
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4 mr-1" />
              ) : (
                <Maximize2 className="h-4 w-4 mr-1" />
              )}
              {isExpanded ? 'Minimize' : 'Expand'}
            </Button>
          </div>
        </div>
        
        <div className={`border rounded-lg p-4 bg-gray-50 dark:bg-gray-900 overflow-auto ${isExpanded ? 'h-screen' : 'h-96'}`}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap text-sm font-mono">
              {textContent}
            </pre>
          )}
        </div>
      </div>
    );
  };

  // Unsupported File Type
  const renderUnsupportedViewer = () => (
    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Preview Not Available</AlertTitle>
      <AlertDescription>
        This file type cannot be previewed in the browser. Please download the file to view its contents.
      </AlertDescription>
    </Alert>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FileText className="h-6 w-6 text-primary" />
            <div>
              <CardTitle className="text-lg">{fileName}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {getFileType(fileName)} • Last updated: {new Date(uploadedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(fileUrl, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Open in New Tab
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const link = document.createElement('a');
                link.href = fileUrl;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
            >
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {viewerError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Viewer Error</AlertTitle>
            <AlertDescription>{viewerError}</AlertDescription>
          </Alert>
        ) : (
          renderDocumentViewer()
        )}
      </CardContent>
    </Card>
  );
};

export default DocumentViewer;