import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Download, FileText, Table, Code, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Player {
  id: string;
  name: string;
  position: string;
  nflTeam: string;
  points: number;
  avgPoints: number;
  projectedPoints: number;
  status: string;
  rosteredBy: string | null;
  rosteredByOwner: string | null;
  injuryStatus: string | null;
  gamesPlayed: number;
  age?: number;
  draftPosition?: number;
  experience?: number;
  conference?: string;
}

interface ExportOptions {
  format: 'csv' | 'json' | 'xlsx';
  includeHeaders: boolean;
  selectedFields: string[];
  filename: string;
}

interface PlayerExportProps {
  players: Player[];
  totalCount: number;
  filterDescription: string;
  className?: string;
}

const PlayerExport: React.FC<PlayerExportProps> = ({
  players,
  totalCount,
  filterDescription,
  className = ''
}) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'csv',
    includeHeaders: true,
    selectedFields: ['name', 'position', 'nflTeam', 'points', 'avgPoints', 'status', 'rosteredBy'],
    filename: 'players_export'
  });

  // Available fields for export
  const availableFields = [
  { id: 'name', label: 'Player Name', required: true },
  { id: 'position', label: 'Position', required: false },
  { id: 'nflTeam', label: 'NFL Team', required: false },
  { id: 'points', label: 'Total Points', required: false },
  { id: 'avgPoints', label: 'Average Points', required: false },
  { id: 'projectedPoints', label: 'Projected Points', required: false },
  { id: 'status', label: 'Status', required: false },
  { id: 'rosteredBy', label: 'Rostered By', required: false },
  { id: 'rosteredByOwner', label: 'Owner', required: false },
  { id: 'injuryStatus', label: 'Injury Status', required: false },
  { id: 'gamesPlayed', label: 'Games Played', required: false },
  { id: 'age', label: 'Age', required: false },
  { id: 'draftPosition', label: 'Draft Position', required: false },
  { id: 'experience', label: 'Experience', required: false },
  { id: 'conference', label: 'Conference', required: false }];


  // Handle field selection
  const handleFieldToggle = (fieldId: string, checked: boolean) => {
    const field = availableFields.find((f) => f.id === fieldId);
    if (field?.required && !checked) return; // Can't uncheck required fields

    setExportOptions((prev) => ({
      ...prev,
      selectedFields: checked ?
      [...prev.selectedFields, fieldId] :
      prev.selectedFields.filter((id) => id !== fieldId)
    }));
  };

  // Generate CSV content
  const generateCSV = (data: Player[]): string => {
    const headers = exportOptions.selectedFields.map((fieldId) => {
      const field = availableFields.find((f) => f.id === fieldId);
      return field?.label || fieldId;
    });

    const rows = data.map((player) => {
      return exportOptions.selectedFields.map((fieldId) => {
        const value = player[fieldId as keyof Player];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      });
    });

    const csvContent = [
    ...(exportOptions.includeHeaders ? [headers] : []),
    ...rows].
    map((row) => row.join(',')).join('\n');

    return csvContent;
  };

  // Generate JSON content
  const generateJSON = (data: Player[]): string => {
    const filteredData = data.map((player) => {
      const filtered: any = {};
      exportOptions.selectedFields.forEach((fieldId) => {
        const field = availableFields.find((f) => f.id === fieldId);
        filtered[field?.label || fieldId] = player[fieldId as keyof Player];
      });
      return filtered;
    });

    return JSON.stringify({
      exportInfo: {
        timestamp: new Date().toISOString(),
        totalRecords: data.length,
        totalAvailable: totalCount,
        filter: filterDescription,
        format: exportOptions.format
      },
      data: filteredData
    }, null, 2);
  };

  // Download file
  const downloadFile = (content: string, filename: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle export
  const handleExport = async () => {
    if (exportOptions.selectedFields.length === 0) {
      toast({
        title: "No fields selected",
        description: "Please select at least one field to export.",
        variant: "destructive"
      });
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setExportProgress((prev) => Math.min(prev + 10, 90));
      }, 100);

      let content: string;
      let contentType: string;
      let fileExtension: string;

      switch (exportOptions.format) {
        case 'csv':
          content = generateCSV(players);
          contentType = 'text/csv';
          fileExtension = '.csv';
          break;
        case 'json':
          content = generateJSON(players);
          contentType = 'application/json';
          fileExtension = '.json';
          break;
        case 'xlsx':
          // For XLSX, we'd need a library like SheetJS
          // For now, fallback to CSV
          content = generateCSV(players);
          contentType = 'text/csv';
          fileExtension = '.csv';
          break;
        default:
          throw new Error('Unsupported format');
      }

      clearInterval(progressInterval);
      setExportProgress(100);

      // Add timestamp to filename
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `${exportOptions.filename}_${timestamp}${fileExtension}`;

      downloadFile(content, filename, contentType);

      toast({
        title: "Export successful",
        description: `${players.length} players exported as ${exportOptions.format.toUpperCase()}`
      });

      setIsOpen(false);
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export failed",
        description: "There was an error exporting the data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={className}>
          <Download className="h-4 w-4 mr-2" />
          Export ({players.length})
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export Player Data</DialogTitle>
          <DialogDescription>
            Export {players.length} of {totalCount} players matching your current filters
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Export Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Export Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Records to export:</span>
                  <Badge variant="secondary">{players.length}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total available:</span>
                  <Badge variant="outline">{totalCount}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Filter: {filterDescription}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Export Format */}
          <div className="space-y-3">
            <Label>Export Format</Label>
            <Select
              value={exportOptions.format}
              onValueChange={(value: 'csv' | 'json' | 'xlsx') =>
              setExportOptions((prev) => ({ ...prev, format: value }))
              }>

              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">
                  <div className="flex items-center">
                    <Table className="h-4 w-4 mr-2" />
                    CSV - Comma Separated Values
                  </div>
                </SelectItem>
                <SelectItem value="json">
                  <div className="flex items-center">
                    <Code className="h-4 w-4 mr-2" />
                    JSON - JavaScript Object Notation
                  </div>
                </SelectItem>
                <SelectItem value="xlsx" disabled>
                  <div className="flex items-center">
                    <FileText className="h-4 w-4 mr-2" />
                    XLSX - Excel Spreadsheet (Coming Soon)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Export Options */}
          <div className="space-y-3">
            <Label>Export Options</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-headers"
                  checked={exportOptions.includeHeaders}
                  onCheckedChange={(checked) =>
                  setExportOptions((prev) => ({ ...prev, includeHeaders: !!checked }))
                  } />

                <Label htmlFor="include-headers">Include column headers</Label>
              </div>
            </div>
          </div>

          {/* Field Selection */}
          <div className="space-y-3">
            <Label>Select Fields to Export</Label>
            <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto">
              {availableFields.map((field) =>
              <div key={field.id} className="flex items-center space-x-2">
                  <Checkbox
                  id={field.id}
                  checked={exportOptions.selectedFields.includes(field.id)}
                  onCheckedChange={(checked) => handleFieldToggle(field.id, !!checked)}
                  disabled={field.required} />

                  <Label htmlFor={field.id} className="text-sm">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                </div>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {exportOptions.selectedFields.length} of {availableFields.length} fields selected
            </div>
          </div>

          {/* Export Progress */}
          {isExporting &&
          <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Exporting...</span>
                <span>{exportProgress}%</span>
              </div>
              <Progress value={exportProgress} className="w-full" />
            </div>
          }

          {/* Actions */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isExporting}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={isExporting}>
              {isExporting ? 'Exporting...' : 'Export Data'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>);

};

export default PlayerExport;