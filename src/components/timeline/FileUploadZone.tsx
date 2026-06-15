import { useState, useRef, type DragEvent } from 'react';
import { Upload, File, X, Image, FileText, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Copied from parcel-story `src/components/timeline/FileUploadZone.tsx` (1:1, imports verified).

interface FileUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  accept?: string;
  compact?: boolean;
}

interface PreviewFile {
  file: File;
  preview?: string;
  id: string;
}

export function FileUploadZone({
  onFilesSelected,
  maxFiles = 5,
  maxSizeMB = 10,
  accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx',
  compact = false,
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<PreviewFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files));
    }
  };

  const processFiles = (files: File[]) => {
    setError(null);

    if (selectedFiles.length + files.length > maxFiles) {
      setError(`ניתן להעלות עד ${maxFiles} קבצים בלבד`);
      return;
    }

    const oversizedFiles = files.filter((file) => file.size > maxSizeMB * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      setError(`קבצים חייבים להיות קטנים מ-${maxSizeMB}MB`);
      return;
    }

    const newPreviewFiles: PreviewFile[] = files.map((file) => ({
      file,
      id: `${Date.now()}-${Math.random()}`,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));

    setSelectedFiles((prev) => [...prev, ...newPreviewFiles]);
    onFilesSelected(files);
  };

  const removeFile = (id: string) => {
    setSelectedFiles((prev) => {
      const fileToRemove = prev.find((f) => f.id === id);
      if (fileToRemove?.preview) URL.revokeObjectURL(fileToRemove.preview);
      return prev.filter((f) => f.id !== id);
    });
  };

  const clearAll = () => {
    selectedFiles.forEach((f) => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setSelectedFiles([]);
    setError(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (file.type.includes('pdf')) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  if (compact && selectedFiles.length === 0) {
    return (
      <div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={accept}
          onChange={handleFileInput}
          className="hidden"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="gap-2"
        >
          <Paperclip className="h-4 w-4" />
          צרף קבצים
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 transition-all cursor-pointer',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={accept}
          onChange={handleFileInput}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <div className={cn('rounded-full p-3 transition-colors', isDragging ? 'bg-primary/10' : 'bg-muted')}>
            <Upload
              className={cn('h-6 w-6 transition-colors', isDragging ? 'text-primary' : 'text-muted-foreground')}
            />
          </div>
          <div>
            <p className="text-sm font-medium">
              {isDragging ? 'שחרר כאן...' : 'גרור קבצים או לחץ לבחירה'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              עד {maxFiles} קבצים, מקסימום {maxSizeMB}MB כל אחד
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">קבצים שנבחרו ({selectedFiles.length})</span>
            <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 text-xs">
              נקה הכל
            </Button>
          </div>

          <div className="space-y-2">
            {selectedFiles.map((previewFile) => (
              <div
                key={previewFile.id}
                className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg group hover:bg-muted transition-colors"
              >
                {previewFile.preview ? (
                  <img
                    src={previewFile.preview}
                    alt={previewFile.file.name}
                    className="h-10 w-10 object-cover rounded border"
                  />
                ) : (
                  <div className="h-10 w-10 bg-background border rounded flex items-center justify-center">
                    {getFileIcon(previewFile.file)}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{previewFile.file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(previewFile.file.size)}</p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(previewFile.id)}
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
