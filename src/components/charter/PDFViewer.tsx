import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  ExternalLink, 
  Maximize2, 
  Minimize2, 
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw
} from 'lucide-react';

interface PDFViewerProps {
  fileUrl: string;
  fileName: string;
  className?: string;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ fileUrl, fileName, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showViewer, setShowViewer] = useState(true);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [viewerMethod, setViewerMethod] = useState<'iframe' | 'embed' | 'object'>('iframe');
  const [isLoading, setIsLoading] = useState(true);

  // Check if browser supports PDF viewing
  const supportsPDFViewing = () => {
    // Check if browser has PDF plugin or native support
    const hasPDFPlugin = navigator.mimeTypes && navigator.mimeTypes['application/pdf'];
    const isChrome = /Chrome/.test(navigator.userAgent);
    const isFirefox = /Firefox/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    
    return hasPDFPlugin || isChrome || isFirefox || isSafari;
  };

  // Handle iframe load
  const handleIframeLoad = () => {
    setIsLoading(false);
    setViewerError(null);
  };

  // Handle iframe error
  const handleIframeError = () => {
    setIsLoading(false);
    setViewerError('Failed to load PDF in iframe. Trying alternative method...');
    
    // Try different viewer method
    if (viewerMethod === 'iframe') {
      setViewerMethod('embed');
    } else if (viewerMethod === 'embed') {
      setViewerMethod('object');
    }
  };

  // Reset viewer
  const resetViewer = () => {
    setViewerError(null);
    setIsLoading(true);
    setViewerMethod('iframe');
  };

  // Render PDF viewer based on method
  const renderPDFViewer = () => {
    const commonProps = {
      width: '100%',
      height: '100%',
      title: fileName,
      onLoad: handleIframeLoad,
      onError: handleIframeError,
    };

    const pdfUrl = `${fileUrl}#toolbar=1&navpanes=1&scrollbar=1&view=FitH`;

    switch (viewerMethod) {
      case 'iframe':
        return (
          <iframe
            src={pdfUrl}
            className="border-0 w-full h-full"
            {...commonProps}
          />
        );
      
      case 'embed':
        return (
          <embed
            src={pdfUrl}
            type="application/pdf"
            className="w-full h-full"
            {...commonProps}
          />
        );
      
      case 'object':
        return (
          <object
            data={pdfUrl}
            type="application/pdf"
            className="w-full h-full"
            {...commonProps}
          >
            <p>
              Your browser doesn't support PDF viewing. 
              <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline ml-1">
                Click here to download the PDF
              </a>
            </p>
          </object>
        );
      
      default:
        return null;
    }
  };

  if (!showViewer) {
    return (
      <div className="text-center py-8">
        <EyeOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">PDF viewer hidden</p>
        <Button 
          variant="outline" 
          onClick={() => setShowViewer(true)}
          className="mt-2"
        >
          <Eye className="h-4 w-4 mr-2" />
          Show PDF
        </Button>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Badge variant="secondary">PDF Viewer</Badge>
          {!supportsPDFViewing() && (
            <Badge variant="destructive">Limited Browser Support</Badge>
          )}
        </div>
        
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={resetViewer}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Reload
          </Button>
          
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
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(fileUrl, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            New Tab
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

      {/* PDF Viewer Container */}
      <div className={`border rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 relative ${
        isExpanded ? 'fixed inset-4 z-50 bg-white dark:bg-gray-900' : 'h-96 md:h-[600px]'
      }`}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900 z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">Loading PDF...</p>
            </div>
          </div>
        )}
        
        {viewerError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900 z-10">
            <Alert variant="destructive" className="max-w-md">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {viewerError}
                <div className="mt-2 space-x-2">
                  <Button size="sm" variant="outline" onClick={resetViewer}>
                    Try Again
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => window.open(fileUrl, '_blank')}>
                    Open in New Tab
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          renderPDFViewer()
        )}
      </div>

      {/* Browser Compatibility Notice */}
      {!supportsPDFViewing() && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your browser may have limited PDF viewing support. For the best experience, 
            try opening the PDF in a new tab or downloading it.
          </AlertDescription>
        </Alert>
      )}

      {/* Usage Tips */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Tips:</strong> Use the expand button for full-screen viewing. 
          If the PDF doesn't load properly, try the "New Tab" or "Download" options.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default PDFViewer;