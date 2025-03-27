"use client";

import { useState, useRef, useEffect, ReactNode } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import toast, { Toaster } from 'react-hot-toast';

type FileData = {
  id: string;
  fileName: string;
  headers: string[];
  data: (string | number | boolean | null)[][];
  sheets?: string[];
  selectedSheet?: string;
  rawData?: Uint8Array;
  originalHeaders?: string[];
};

type ColumnInfo = {
  id: string;
  name: string;
  prompt: string;
  insertAfter?: string;
  isProcessing: boolean;
  previewData: string[];
  isPreviewApproved: boolean;
  promptRecommendations?: string[];
};

// Add an interface to define API response type
interface ApiResponse {
  success: boolean;
  generatedContent: string;
  provider: string;
  model?: string;
  error?: string;
  details?: string;
  batchResults?: string[];
}

export default function FileUploader() {
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [newColumns, setNewColumns] = useState<ColumnInfo[]>([
    {
      id: uuidv4(),
      name: '',
      prompt: '',
      insertAfter: undefined,
      isProcessing: false,
      previewData: [],
      isPreviewApproved: false,
      promptRecommendations: [],
    }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<ReactNode | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Add column width state management
  const [columnWidths, setColumnWidths] = useState<Record<number, number>>({});
  const [isResizing, setIsResizing] = useState(false);
  const [currentResizingColumn, setCurrentResizingColumn] = useState<number | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  // Add highlighted row functionality
  const [highlightedRow, setHighlightedRow] = useState<number | null>(null);

  // Add tooltip tracking states
  const [activeTooltip, setActiveTooltip] = useState<{
    type: 'preview' | 'filecell';
    columnId?: string;
    rowIndex: number;
    columnIndex?: number;
  } | null>(null);

  // Add progress tracking state
  const [generationProgress, setGenerationProgress] = useState<{
    currentColumn: string;
    processedRows: number;
    totalRows: number;
    percentage: number;
    waitingTime: number;
    modelInfo: string;
  }>({
    currentColumn: '',
    processedRows: 0,
    totalRows: 0,
    percentage: 0,
    waitingTime: 0,
    modelInfo: 'Anthropic Claude'
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  // Add delay utility function to ensure API call intervals
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Track API call frequency to avoid exceeding API limits
  const [lastApiCallTime, setLastApiCallTime] = useState<number>(0);

  // Monitor and control API call rate
  const rateControlledApiCall = async <T,>(apiCallFn: () => Promise<T>): Promise<T> => {
    // Check time since last API call
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCallTime;
    const minTimeBetweenCalls = 500; // Minimum interval 500ms

    // If needed, add delay to ensure API call spacing
    if (timeSinceLastCall < minTimeBetweenCalls) {
      await delay(minTimeBetweenCalls - timeSinceLastCall);
    }

    // Update last call time and execute API call
    setLastApiCallTime(Date.now());
    return apiCallFn();
  };

  // Enhanced API call with retry mechanism for handling timeouts
  const rateControlledApiCallWithRetry = async <T,>(
    apiCallFn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> => {
    let retryCount = 0;
    let lastError: unknown = null;

    // Try the API call with retries
    while (retryCount <= maxRetries) {
      try {
        // If this is a retry, add a progressively longer delay
        if (retryCount > 0) {
          const retryDelay = 1000 * retryCount; // Increase delay with each retry
          toast.custom(
            <div className="bg-blue-600 px-4 py-3 text-white rounded-md">
              Retrying API call ({retryCount}/{maxRetries}) after timeout... Please wait.
            </div>
          );
          console.log(`Retry ${retryCount}/${maxRetries} after delay of ${retryDelay}ms`);
          await delay(retryDelay);
        }

        // Make the rate-controlled API call
        const result = await rateControlledApiCall(apiCallFn);
        return result;
      } catch (error: unknown) {
        lastError = error;

        // Check if error is a timeout or other retriable error
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isTimeout =
          errorMessage.includes('timeout') ||
          errorMessage.includes('504') ||
          errorMessage.includes('Gateway') ||
          errorMessage.includes('Failed to fetch');

        // If it's a timeout and we haven't exceeded max retries, continue to retry
        if (isTimeout && retryCount < maxRetries) {
          console.log(`API timeout detected. Will retry (${retryCount + 1}/${maxRetries})`);
          retryCount++;
          // Update UI to show retry status
          setGenerationProgress(prev => ({
            ...prev,
            modelInfo: `Retry ${retryCount}/${maxRetries} after Gateway Timeout...`
          }));
          continue;
        }

        // If it's not a timeout or we've exceeded retries, rethrow
        throw error;
      }
    }

    // This should not be reached but is here for safety
    throw lastError;
  };

  // Modify the intelligentTruncate function to better handle empty or unnamed headers
  const intelligentTruncate = (text: string, maxLength = 20) => {
    if (!text) return '';
    const str = String(text);
    // Check if it's an auto-generated column name
    if (str.startsWith('Column_')) {
      return str;
    }
    // If text length is less than max length, return directly
    if (str.length <= maxLength) return str;
    // For longer numbers, display in full
    if (!isNaN(Number(str)) && str.length < 30) return str;
    // For shorter text, show more content
    if (str.length < 30) return str;
    // For medium-length text, truncate appropriately
    return `${str.substring(0, maxLength)}...`;
  };

  // Handle file drop
  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setError(null);
    setSuccess(null);
    setFileData(null);

    // Check file size - prevent files larger than 2MB
    const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      setError(<>File size ({(file.size / (1024 * 1024)).toFixed(2)}MB) exceeds the maximum limit of 2MB. Please use&nbsp;<a href="https://powerdrill.ai" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">powerdrill.ai</a>&nbsp;for larger files.</>);
      toast.error(`File size exceeds 2MB limit`);
      return;
    }

    const fileName = file.name;
    const fileExtension = fileName.split('.').pop()?.toLowerCase();

    if (fileExtension === 'csv') {
      handleCSVFile(file);
    } else if (['xlsx', 'xls'].includes(fileExtension || '')) {
      handleExcelFile(file);
    } else {
      setError('Unsupported file format. Please upload a CSV or Excel file.');
    }
  };

  const handleCSVFile = (file: File) => {
    Papa.parse(file, {
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          const headers = results.data[0] as string[];
          const data = results.data.slice(1) as (string | number | boolean | null)[][];

          setFileData({
            id: uuidv4(),
            fileName: file.name,
            headers,
            data,
            originalHeaders: headers,
          });

          setSuccess('CSV file uploaded successfully!');
        } else {
          setError('The CSV file is empty or invalid.');
        }
      },
      header: false,
      skipEmptyLines: true,
      error: (error) => {
        setError(`Unable to parse CSV file: ${error.message}`);
      },
    });
  };

  const handleExcelFile = (file: File) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const sheets = workbook.SheetNames;

        if (sheets.length === 1) {
          // If there's only one sheet, use it directly
          const worksheet = workbook.Sheets[sheets[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (jsonData.length > 0) {
            // Process headers to handle empty values
            const rawHeaders = jsonData[0] as (string | number | boolean | null | undefined)[];
            const headers = rawHeaders.map((header, index) => header ? String(header) : `Column_${index + 1}`);
            const rows = jsonData.slice(1) as (string | number | boolean | null)[][];

            setFileData({
              id: uuidv4(),
              fileName: file.name,
              headers,
              data: rows,
              sheets,
              selectedSheet: sheets[0],
              originalHeaders: headers,
            });

            setSuccess('Excel file uploaded successfully!');
          } else {
            setError('The Excel file is empty or invalid.');
          }
        } else {
          // If there are multiple sheets, let the user select one
          setFileData({
            id: uuidv4(),
            fileName: file.name,
            headers: [],
            data: [],
            sheets,
            rawData: data, // Store the raw file data to use when selecting sheets
            originalHeaders: [],
          });
        }
      } catch (error) {
        setError(`Excel file parsing error: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    reader.onerror = () => {
      setError('Error reading file. Please try again.');
    };

    reader.readAsArrayBuffer(file);
  };

  const handleSheetSelect = (sheetName: string) => {
    if (!fileData || !fileData.sheets) return;

    try {
      // Use the stored raw data instead of reading the file again
      if (!fileData.rawData) {
        setError('File data unavailable. Please upload the file again.');
        return;
      }

      try {
        const workbook = XLSX.read(fileData.rawData, { type: 'array' });
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length > 0) {
          // Process headers to handle empty values
          const rawHeaders = jsonData[0] as (string | number | boolean | null | undefined)[];
          const headers = rawHeaders.map((header, index) => header ? String(header) : `Column_${index + 1}`);
          const rows = jsonData.slice(1) as (string | number | boolean | null)[][];

          setFileData({
            ...fileData,
            headers,
            data: rows,
            selectedSheet: sheetName,
            originalHeaders: headers,
          });

          setSuccess(`Sheet "${sheetName}" selected successfully!`);
        } else {
          setError(`Selected sheet "${sheetName}" is empty or invalid.`);
        }
      } catch (error) {
        setError(`Error parsing sheet "${sheetName}": ${error instanceof Error ? error.message : String(error)}`);
      }
    } catch (error) {
      setError(`Sheet selection error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Updated function, supporting multi-column or single-column preview generation - batch processing version
  const generatePreviewData = async (columnId?: string) => {
    if (!fileData) {
      setError('Please upload a file first.');
      return;
    }

    // Determine which columns to process
    const columnsToProcess = columnId
      ? newColumns.filter(col => col.id === columnId)
      : newColumns.filter(col => col.name && col.prompt);

    if (columnsToProcess.length === 0) {
      setError('Please provide column name and prompt before generating preview.');
      return;
    }

    // Update all columns to be processed
    const updatedColumns = [...newColumns];
    columnsToProcess.forEach(column => {
      const idx = newColumns.findIndex(col => col.id === column.id);
      if (idx !== -1) {
        updatedColumns[idx] = { ...column, isProcessing: true };
      }
    });
    setNewColumns(updatedColumns);
    setError(null);

    try {
      // Get first 5 rows of data for preview generation
      const previewRowData = fileData.data.slice(0, 5).map((row) => {
        // Create an object with column names as keys
        const rowObj: Record<string, string | number | boolean | null> = {};
        fileData.headers.forEach((header, colIndex) => {
          rowObj[header] = row[colIndex];
        });
        return rowObj;
      });

      // Generate preview for each column - batch process all preview rows for each column at once
      const previewResults = await Promise.all(
        columnsToProcess.map(async (column) => {
          try {
            // [Optimization] Batch process all preview rows, send request once with retry capability
            const response = await rateControlledApiCallWithRetry<ApiResponse>(async () => {
              const result = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  prompt: column.prompt,
                  // Send the entire preview data batch
                  batchData: previewRowData,
                  model: 'claude-3-haiku-20240307', // Using Claude 3 Haiku model for preview
                  isBatch: true // Flag as batch request
                }),
              });

              if (!result.ok) {
                if (result.status === 504) {
                  throw new Error('Gateway Timeout (504): Server response took too long');
                }
                throw new Error(`API Error: ${result.status} ${result.statusText}`);
              }

              return await result.json();
            });

            // Update model info display
            if (response.model) {
              setGenerationProgress(prev => ({
                ...prev,
                modelInfo: `Anthropic Claude`
              }));
            }

            // Parse the batch results
            const previewData = Array.isArray(response.batchResults)
              ? response.batchResults
              : Array(5).fill('Error: Unable to generate preview data');

            return {
              id: column.id,
              previewData
            };
          } catch (error) {
            console.error(`Error generating preview for column ${column.name}:`, error);
            // Add more detailed error information based on the error type
            const errorMessage = error instanceof Error
              ? error.message
              : String(error);

            const isTimeout = errorMessage.includes('timeout') ||
                               errorMessage.includes('504') ||
                               errorMessage.includes('Gateway');

            // Create a user-friendly error message
            const userErrorMessage = isTimeout
              ? 'Server timeout. Failed to generate content after multiple retries.'
              : `Content generation error: ${errorMessage}`;

            return {
              id: column.id,
              previewData: Array(5).fill(userErrorMessage)
            };
          }
        })
      );

      // Update all columns' preview data
      const finalColumns = [...newColumns];
      previewResults.forEach(result => {
        const idx = finalColumns.findIndex(col => col.id === result.id);
        if (idx !== -1) {
          finalColumns[idx] = {
            ...finalColumns[idx],
            isProcessing: false,
            previewData: result.previewData,
          };
        }
      });
      setNewColumns(finalColumns);

      const processedCount = previewResults.length;
      setSuccess(`Preview data generated for ${processedCount} column(s)! Please review before generating for all rows.`);

      // Add toast on successful completion
      toast.success(`Preview data generated for ${processedCount} column(s)!`);
    } catch (error) {
      // Reset all columns' processing state
      const restoredColumns = [...newColumns];
      columnsToProcess.forEach(column => {
        const idx = restoredColumns.findIndex(col => col.id === column.id);
        if (idx !== -1) {
          restoredColumns[idx] = { ...restoredColumns[idx], isProcessing: false };
        }
      });
      setNewColumns(restoredColumns);

      // Use toast to display error with more context
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Error generating preview: ${errorMessage}`);
      setError(`Failed to generate preview: ${errorMessage}. Please try again later.`);
    }
  };

  const generateFullData = async () => {
    // Check if there are more than 5 active columns to generate
    const activeColumns = newColumns.filter(col => col.name && col.prompt);
    if (activeColumns.length > 5) {
      toast.error(
        <div className="flex flex-col">
          <span>Cannot generate more than 5 columns.</span>
          <span className="text-sm mt-1">
            For generating more columns, please use{" "}
            <a href="https://powerdrill.ai" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
              powerdrill.ai
            </a>
          </span>
        </div>,
        { duration: 5000 }
      );
      return;
    }

    if (!fileData || !newColumns.length || isProcessing) {
      return;
    }

    try {
      setIsProcessing(true);
      // Reset progress state
      setGenerationProgress({
        currentColumn: '',
        processedRows: 0,
        totalRows: 0,
        percentage: 0,
        waitingTime: 0,
        modelInfo: 'Anthropic Claude'
      });

      // Save original headers before adding new columns
      const originalHeaders = [...fileData.headers];

      // Initialize new headers and data
      const updatedHeaders = [...fileData.headers];
      let updatedData = [...fileData.data];

      // Calculate total rows for progress tracking
      const totalRows = fileData.data.length * newColumns.length;
      setGenerationProgress(prev => ({
        ...prev,
        totalRows: totalRows
      }));

      // Generate complete data for each column
      for (let colIndex = 0; colIndex < newColumns.length; colIndex++) {
        const column = newColumns[colIndex];

        // Update current column information
        setGenerationProgress(prev => ({
          ...prev,
          currentColumn: column.name,
          processedRows: colIndex * fileData.data.length + column.previewData.length,
          percentage: Math.round(((colIndex * fileData.data.length + column.previewData.length) / totalRows) * 100)
        }));

        setSuccess(`Generating data for column "${column.name}" (${colIndex + 1}/${newColumns.length})...`);

        // Convert row objects to API format
        const rowObjects = fileData.data.map(row => {
          const rowObj: Record<string, string | number | boolean | null> = {};
          fileData.headers.forEach((header, colIndex) => {
            rowObj[header] = row[colIndex];
          });
          return rowObj;
        });

        // Use preview data as first 5 rows, then generate the rest
        const fullGeneratedData = [...column.previewData];

        // Only call API for rows outside preview
        if (rowObjects.length > column.previewData.length) {
          const remainingRows = rowObjects.slice(column.previewData.length);
          // [Optimization] Increase batch size to 100
          const batchSize = 100; // Increase from 5 to 100

          for (let i = 0; i < remainingRows.length; i += batchSize) {
            const batch = remainingRows.slice(i, i + batchSize);

            // Display progress - more detailed progress information
            const currentProgress = colIndex * fileData.data.length + column.previewData.length + i;
            const percentage = Math.round((currentProgress / totalRows) * 100);

            setGenerationProgress({
              currentColumn: column.name,
              processedRows: currentProgress,
              totalRows: totalRows,
              percentage: percentage,
              waitingTime: 0,
              modelInfo: 'Anthropic Claude'
            });

            // Display more detailed progress information
            setSuccess(`Generating: Column "${column.name}" (${colIndex + 1}/${newColumns.length}) | Processed ${currentProgress}/${fileData.data.length} rows | Overall progress: ${percentage}% | Batch size: ${batch.length} items`);

            try {
              // [Optimization] Send entire batch at once instead of processing row by row, with retry capability
              const response = await rateControlledApiCallWithRetry<ApiResponse>(async () => {
                const result = await fetch('/api/generate', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    prompt: column.prompt,
                    batchData: batch,
                    model: 'claude-3-haiku-20240307', // Use Claude 3 Haiku model for final generation
                    isBatch: true // Flag as batch request
                  }),
                });

                if (!result.ok) {
                  if (result.status === 504) {
                    throw new Error('Gateway Timeout (504): Server response took too long');
                  }
                  throw new Error(`API Error: ${result.status} ${result.statusText}`);
                }

                return await result.json();
              });

              // Update model info display
              if (response.model) {
                setGenerationProgress(prev => ({
                  ...prev,
                  modelInfo: `Anthropic Claude`
                }));
              }

              // Process batch return results with better error handling
              if (Array.isArray(response.batchResults) && response.batchResults.length === batch.length) {
                fullGeneratedData.push(...response.batchResults);
              } else if (Array.isArray(response.batchResults)) {
                // If we have results but count doesn't match, fill in the missing ones
                console.warn(`Batch processing result length mismatch: Expected ${batch.length}, received ${response.batchResults.length}`);
                const validResults = response.batchResults;
                const fillerResults = Array(batch.length - validResults.length).fill('Error: Incomplete batch results');
                fullGeneratedData.push(...validResults, ...fillerResults);
              } else {
                // If return is not an array or is invalid, add error information
                console.error('Invalid batch results:', response);
                fullGeneratedData.push(...Array(batch.length).fill('Error: Unable to generate batch content'));
              }

              // Update progress information
              setGenerationProgress(prev => ({
                ...prev,
                processedRows: prev.processedRows + batch.length,
                percentage: Math.round(((prev.processedRows + batch.length) / prev.totalRows) * 100)
              }));
            } catch (error) {
              console.error('Error generating content:', error);
              // Add error information as generated content with more detailed error messages
              const errorMessage = error instanceof Error ? error.message : String(error);
              const isTimeout = errorMessage.includes('timeout') ||
                                errorMessage.includes('504') ||
                                errorMessage.includes('Gateway');

              // Create user-friendly error message based on error type
              const userErrorMessage = isTimeout
                ? 'Server timeout. Failed to generate content after multiple retries.'
                : `Content generation error: ${errorMessage}`;

              // Show a toast with the error but continue processing
              toast.error(`Error in batch: ${userErrorMessage}. Continuing with remaining data.`);

              // Add placeholders for the failed batch
              fullGeneratedData.push(...Array(batch.length).fill(userErrorMessage));
            }

            // Adding a short delay between batches
            if (i + batchSize < remainingRows.length) {
              setSuccess(`Generating: Column "${column.name}" | Completed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(remainingRows.length/batchSize)} | Preparing next batch...`);
              await delay(100); // Wait 0.1 seconds between batches
            }
          }
        }

        // Determine insert position
        const insertIndex = column.insertAfter
          ? updatedHeaders.findIndex(h => h === column.insertAfter) + 1
          : updatedHeaders.length;

        // Add new column to headers
        updatedHeaders.splice(insertIndex, 0, column.name);

        // Add new column data to each row
        updatedData = updatedData.map((row, rowIndex) => {
          const newRow = [...row];
          newRow.splice(insertIndex, 0, fullGeneratedData[rowIndex] || '');
          return newRow;
        });
      }

      // Update file data
      setFileData({
        ...fileData,
        headers: updatedHeaders,
        data: updatedData,
        originalHeaders: originalHeaders,
      });

      // Reset column state
      setNewColumns([{
        id: uuidv4(),
        name: '',
        prompt: '',
        insertAfter: undefined,
        isProcessing: false,
        previewData: [],
        isPreviewApproved: false,
        promptRecommendations: [],
      }]);

      // Calculate output filename to display in success message
      const fileExtension = fileData.fileName.split('.').pop()?.toLowerCase() || 'xlsx';
      const outputFileName = fileData.fileName.replace(`.${fileExtension}`, `-enhanced.${fileExtension}`);

      // Final message with correct filename
      setSuccess(`${newColumns.length} new columns successfully added! Your file is ready to download as "${outputFileName}" (maintains original ${fileExtension.toUpperCase()} format)`);

      // Reset progress indicator
      setGenerationProgress({
        currentColumn: '',
        processedRows: 0,
        totalRows: 0,
        percentage: 100,
        waitingTime: 0,
        modelInfo: 'Anthropic Claude'
      });

      // Add success notification when complete
      toast.success(`${newColumns.length} new columns successfully added!`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(`Error generating data: ${errorMessage}`);

      // Use toast to display error
      toast.error(`Error generating data: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadFile = () => {
    if (!fileData) return;

    try {
      const worksheet = XLSX.utils.aoa_to_sheet([fileData.headers, ...fileData.data]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

      const originalExtension = fileData.fileName.split('.').pop()?.toLowerCase() || 'xlsx';
      // 保持与上传文件相同的扩展名
      const outputFileName = fileData.fileName.replace(
        `.${originalExtension}`,
        `-enhanced.${originalExtension}`
      );

      console.log(`Exporting file with original extension: ${originalExtension}, output filename: ${outputFileName}`);

      // 根据文件类型使用不同的导出方法
      if (originalExtension === 'csv') {
        // 对于CSV文件，使用sheet_to_csv转换并创建下载链接
        console.log('Exporting as CSV format');
        // 增强CSV导出，更好地处理特殊字符和逗号
        const csvContent = XLSX.utils.sheet_to_csv(worksheet, {
          blankrows: false,
          forceQuotes: true
        });

        // 检查CSV内容是否正确生成
        console.log(`CSV content generated, size: ${csvContent.length} bytes`);

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = outputFileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // 对于Excel文件，使用writeFile
        console.log('Exporting as Excel format');
        XLSX.writeFile(workbook, outputFileName);
      }

      setSuccess(`File downloaded as ${outputFileName} (maintains original ${originalExtension.toUpperCase()} format)`);
    } catch (error) {
      console.error('Error in downloadFile:', error);
      setError(`Error downloading file: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Add column width drag handling function
  const handleColumnResizeStart = (e: React.MouseEvent, columnIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (!tableRef.current) return;

    const headerCells = tableRef.current.querySelectorAll('thead th');
    const columnElement = headerCells[columnIndex + 1]; // +1 for the # column

    if (columnElement) {
      setIsResizing(true);
      setCurrentResizingColumn(columnIndex);
      setStartX(e.clientX);

      // Get current column width
      const currentWidth = columnElement.getBoundingClientRect().width;
      setStartWidth(currentWidth);

      // Add global mouse move and up event listeners
      document.addEventListener('mousemove', handleColumnResizeMove);
      document.addEventListener('mouseup', handleColumnResizeEnd);
    }
  };

  const handleColumnResizeMove = (e: MouseEvent) => {
    if (!isResizing || currentResizingColumn === null) return;

    const deltaX = e.clientX - startX;
    const newWidth = Math.max(100, startWidth + deltaX);

    setColumnWidths(prevWidths => ({
      ...prevWidths,
      [currentResizingColumn]: newWidth
    }));
  };

  const handleColumnResizeEnd = () => {
    setIsResizing(false);
    setCurrentResizingColumn(null);

    // Remove global event listeners
    document.removeEventListener('mousemove', handleColumnResizeMove);
    document.removeEventListener('mouseup', handleColumnResizeEnd);
  };

  // Cleanup function
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleColumnResizeMove);
      document.removeEventListener('mouseup', handleColumnResizeEnd);
    };
  }, []);

  // Add a new empty column definition
  const addNewColumnDefinition = () => {
    // Check if the existing columns count is already 5 or more
    if (newColumns.length >= 5) {
      toast.error(
        <div className="flex flex-col">
          <span>Maximum limit of 5 columns reached.</span>
          <span className="text-sm mt-1">
            For generating more columns, please use{" "}
            <a href="https://powerdrill.ai" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
              powerdrill.ai
            </a>
          </span>
        </div>,
        { duration: 5000 }
      );
      return;
    }

    setNewColumns([
      ...newColumns,
      {
        id: uuidv4(),
        name: '',
        prompt: '',
        insertAfter: fileData?.headers[fileData.headers.length - 1],
        isProcessing: false,
        previewData: [],
        isPreviewApproved: false,
        promptRecommendations: [],
      }
    ]);
  };

  // Remove a column definition
  const removeColumnDefinition = (id: string) => {
    // Ensure at least one column definition is retained
    if (newColumns.length <= 1) return;

    setNewColumns(newColumns.filter(col => col.id !== id));
  };

  // Update specific column's properties
  const updateColumnProperty = (id: string, property: keyof ColumnInfo, value: string | boolean | undefined | string[]) => {
    setNewColumns(newColumns.map(col =>
      col.id === id ? { ...col, [property]: value } : col
    ));
  };

  // Reset the entire state to start a new task
  const resetState = () => {
    // Only allow reset if not processing
    if (isProcessing) return;

    // Reset all state variables
    setFileData(null);
    setNewColumns([{
      id: uuidv4(),
      name: '',
      prompt: '',
      insertAfter: undefined,
      isProcessing: false,
      previewData: [],
      isPreviewApproved: false,
      promptRecommendations: [],
    }]);
    setError(null);
    setSuccess(null);
    setDragActive(false);
    setColumnWidths({});
    setHighlightedRow(null);
    setGenerationProgress({
      currentColumn: '',
      processedRows: 0,
      totalRows: 0,
      percentage: 0,
      waitingTime: 0,
      modelInfo: 'Anthropic Claude'
    });

    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    toast.success('Application reset successfully');
  };

  // Add a function to handle closing tooltips when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is outside tooltip and tooltip trigger areas
      const targetElement = event.target as HTMLElement;
      if (!targetElement.closest('.tooltip-content') && !targetElement.closest('.tooltip-trigger')) {
        setActiveTooltip(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle tooltip toggle for preview data
  const togglePreviewTooltip = (columnId: string, rowIndex: number, event: React.MouseEvent) => {
    event.stopPropagation();

    if (activeTooltip && activeTooltip.type === 'preview' && activeTooltip.columnId === columnId && activeTooltip.rowIndex === rowIndex) {
      // If clicking the same cell, close the tooltip
      setActiveTooltip(null);
    } else {
      // Otherwise, open the tooltip for this cell
      setActiveTooltip({
        type: 'preview',
        columnId,
        rowIndex,
        columnIndex: undefined
      });
    }
  };

  // Handle tooltip toggle for file preview cells
  const toggleCellTooltip = (rowIndex: number, columnIndex: number, event: React.MouseEvent) => {
    event.stopPropagation();

    if (activeTooltip && activeTooltip.type === 'filecell' && activeTooltip.rowIndex === rowIndex && activeTooltip.columnIndex === columnIndex) {
      // If clicking the same cell, close the tooltip
      setActiveTooltip(null);
    } else {
      // Otherwise, open the tooltip for this cell
      setActiveTooltip({
        type: 'filecell',
        rowIndex,
        columnIndex
      });
    }
  };

  // Add a function to fetch prompt recommendations
  const fetchPromptRecommendations = async (columnId: string, columnName: string) => {
    if (!fileData || !columnName.trim() || !fileData.headers.length) {
      return;
    }

    // Set loading state for this specific column
    setIsLoadingRecommendations(prev => ({ ...prev, [columnId]: true }));

    try {
      const response = await rateControlledApiCallWithRetry<{
        success: boolean;
        recommendations: string[];
        error?: string;
      }>(async () => {
        const result = await fetch('/api/generate/recommendations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            existingColumns: fileData.headers,
            newColumnName: columnName,
            model: 'claude-3-haiku-20240307',
          }),
        });

        if (!result.ok) {
          throw new Error(`API Error: ${result.status} ${result.statusText}`);
        }

        return await result.json();
      });

      if (response.success && response.recommendations.length > 0) {
        // Update the column with recommendations
        setNewColumns(columns => columns.map(col =>
          col.id === columnId
            ? { ...col, promptRecommendations: response.recommendations }
            : col
        ));
      }
    } catch (error) {
      console.error('Error fetching prompt recommendations:', error);
      toast.error(`Failed to fetch recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Clear loading state
      setIsLoadingRecommendations(prev => {
        const updated = { ...prev };
        delete updated[columnId];
        return updated;
      });
    }
  };

  // Debounced function to fetch recommendations after a delay
  const debouncedFetchRecommendations = useRef<Record<string, NodeJS.Timeout>>({});

  const handleColumnNameChange = (columnId: string, name: string) => {
    // Update the column name immediately
    updateColumnProperty(columnId, 'name', name);

    // Clear any existing timeout for this column
    if (debouncedFetchRecommendations.current[columnId]) {
      clearTimeout(debouncedFetchRecommendations.current[columnId]);
    }

    // If name is empty, don't fetch recommendations
    if (!name.trim()) {
      return;
    }

    // Set a timeout to fetch recommendations after 1500ms of inactivity
    debouncedFetchRecommendations.current[columnId] = setTimeout(() => {
      fetchPromptRecommendations(columnId, name);
    }, 1500);
  };

  // Function to select a recommendation and set it as the prompt
  const selectRecommendation = (columnId: string, recommendation: string) => {
    // Update the prompt with the selected recommendation
    updateColumnProperty(columnId, 'prompt', recommendation);

    // Clear recommendations and preview data after selection
    setNewColumns(columns => columns.map(col =>
      col.id === columnId
        ? { ...col, promptRecommendations: [], previewData: [] }
        : col
    ));

    // Show toast notification that prompt was selected and preview needs to be regenerated
    toast.success('Prompt selected. Generate preview to see results.', { duration: 3000 });
  };

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            style: {
              background: '#16a34a',
            },
          },
          error: {
            duration: 4000,
            style: {
              background: '#dc2626',
            },
          }
        }}
      />
      <div className="w-full">
        {!fileData && (
          <div
            className={`border-2 border-dashed rounded-lg p-8 transition-all ease-in-out duration-300 text-center
              ${dragActive ? 'border-[#420039] bg-[#f5e6ff]' : 'border-gray-300 hover:border-[#420039] bg-white'}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center justify-center">
              <div className="w-16 h-16 mb-4 text-[#420039]">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-medium text-gray-900">
                {dragActive ? 'Drop file to upload' : 'Drag file here or click to upload'}
              </h3>
              <p className="mb-4 text-sm text-gray-500">
                Supports Excel (.xlsx, .xls) and CSV files
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2 text-white bg-[#420039] hover:bg-[#5a0050] rounded-md focus:outline-none focus:ring-2 focus:ring-[#420039] focus:ring-offset-2"
              >
                Choose File
              </button>
              <input
                ref={fileInputRef}
                onChange={handleFileSelect}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
              />
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 mb-6 text-sm text-red-700 bg-red-100 rounded-lg">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Error:</span> {error}
            </div>
          </div>
        )}

        {success && (
          <div className="p-4 mb-6 text-sm text-green-700 bg-green-100 rounded-lg">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Success:</span> {success}
            </div>
          </div>
        )}

        {/* Warning message when processing - only display during processing */}
        {isProcessing && (
          <div className="p-4 mb-6 text-sm bg-amber-100 text-amber-800 rounded-lg">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Warning:</span>
              <span className="ml-1">Do not close or refresh this page while processing! Your task will be terminated and all progress will be lost.</span>
            </div>
          </div>
        )}

        {fileData && fileData.sheets && !fileData.selectedSheet && (
          <div className="p-6 mb-6 bg-white rounded-lg shadow-sm border border-gray-200">
            <h2 className="mb-4 text-xl font-bold text-[#420039]">Select Worksheet</h2>
            <p className="mb-4 text-gray-600">Your Excel file contains multiple worksheets. Please select one to process:</p>
            <div className="flex flex-wrap gap-2">
              {fileData.sheets.map((sheet) => (
                <button
                  key={sheet}
                  onClick={() => handleSheetSelect(sheet)}
                  className="px-4 py-2 text-white bg-[#420039] hover:bg-[#5a0050] rounded-md focus:outline-none focus:ring-2 focus:ring-[#420039] focus:ring-offset-2"
                >
                  {sheet}
                </button>
              ))}
            </div>
          </div>
        )}

        {fileData && fileData.headers.length > 0 && (
          <>
            {/* New compact file information and operation panel */}
            <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-blue-100 rounded-md">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{fileData.fileName}</div>
                    <div className="text-xs text-gray-500">{fileData.data.length} rows, {fileData.headers.length} columns</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    className={`px-4 py-2 text-white bg-gray-600 hover:bg-gray-700 rounded-md flex items-center transition-all duration-300 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={resetState}
                    disabled={isProcessing}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reset
                  </button>
                  <button
                    className={`px-4 py-2 text-white rounded-md flex items-center transition-all duration-300 ${success && success.includes('ready to download')
                      ? 'bg-green-600 hover:bg-green-700 shadow-md animate-pulse'
                      : 'bg-blue-600 hover:bg-blue-700'}`}
                    onClick={downloadFile}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {success && success.includes('ready to download')
                      ? `Download Now (as ${fileData.fileName.split('.').pop()?.toUpperCase()})`
                      : 'Download'}
                  </button>
                </div>
              </div>

              {/* Add new column - multi-column support */}
              <div className="px-4 py-3">

                <div className="mb-2 text-sm font-medium text-gray-700 flex items-center justify-between">
                  <span>Add New Columns</span>
                  <button
                    className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded-md"
                    onClick={addNewColumnDefinition}
                  >
                    + Add Another Column
                  </button>
                </div>

                {/* Add prompt guidance */}
                <div className="mb-4 p-3 border border-blue-200 rounded-md bg-blue-50">
                  <div className="text-sm text-blue-800 font-medium mb-2 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    Prompt Writing Tips
                  </div>
                  <div className="text-xs text-blue-700 space-y-1.5">
                    <p>For clean table data, specify data type clearly in your prompts:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li><span className="font-medium">Numbers:</span> &ldquo;Generate only a number between 1-5 representing product rating&rdquo;</li>
                      <li><span className="font-medium">Dates/Times:</span> &ldquo;Generate only a date in YYYY-MM-DD format for expected delivery&rdquo;</li>
                      <li><span className="font-medium">Text:</span> &ldquo;Generate a concise 2-4 word product category based on the description&rdquo;</li>
                    </ul>
                  </div>
                </div>

                {/* List all column definitions */}
                {newColumns.map((column, index) => (
                  <div key={column.id} className="mb-4 p-3 border border-gray-200 rounded-md bg-white">
                    <div className="flex items-center justify-between mb-3">
                      <div className="bg-blue-100 px-3 py-1.5 rounded-md text-sm font-medium text-blue-700 w-full">
                        Column #{index + 1}
                      </div>
                      {newColumns.length > 1 && (
                        <button
                          className="text-red-500 hover:text-red-700 ml-2"
                          onClick={() => removeColumnDefinition(column.id)}
                          aria-label="Remove column"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Column Name:</label>
                        <input
                          type="text"
                          placeholder="Enter name"
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#420039] focus:border-[#420039] text-gray-900"
                          value={column.name}
                          onChange={(e) => handleColumnNameChange(column.id, e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Insert After:</label>
                        <select
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#420039] focus:border-[#420039] text-gray-900"
                          value={column.insertAfter || ''}
                          onChange={(e) => updateColumnProperty(column.id, 'insertAfter', e.target.value || undefined)}
                        >
                          <option value="">Add to the end</option>
                          {fileData.headers.map((header) => (
                            <option key={header} value={header}>
                              After: {intelligentTruncate(header, 20)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-end">
                        {column.isProcessing && (
                          <div className="bg-gray-100 rounded-md px-2 py-1 w-full text-xs text-gray-500 flex items-center justify-center">
                            <svg className="w-3 h-3 mr-1 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing...
                          </div>
                        )}
                        {!column.isProcessing && column.previewData.length > 0 && (
                          <div className="bg-green-100 rounded-md px-2 py-1 w-full text-xs text-green-700 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Preview Ready
                          </div>
                        )}
                        {!column.isProcessing && column.previewData.length === 0 && (
                          <div className="bg-gray-100 rounded-md px-2 py-1 w-full text-xs text-gray-500 flex items-center justify-center">
                            No Preview
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="relative">
                      {/* Recommendations display - show right after input, before textarea */}
                      {column.promptRecommendations && column.promptRecommendations.length > 0 && (
                        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md shadow-sm">
                          <div className="text-sm text-blue-800 font-medium mb-2">
                            Recommended prompts:
                            {isLoadingRecommendations[column.id] && (
                              <span className="ml-2 inline-flex items-center">
                                <svg className="w-3 h-3 mr-1 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Loading...
                              </span>
                            )}
                          </div>
                          <div className="space-y-2">
                            {column.promptRecommendations.map((recommendation, idx) => (
                              <div
                                key={idx}
                                className="text-sm p-2.5 bg-white border border-blue-200 rounded-md cursor-pointer hover:bg-blue-100 transition-colors shadow-sm hover:shadow"
                                onClick={() => selectRecommendation(column.id, recommendation)}
                              >
                                <span className="font-medium text-blue-800 mr-1">{idx + 1}.</span> <span className="text-gray-900 font-medium">{recommendation}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Show loading indicator when fetching recommendations but none available yet */}
                      {isLoadingRecommendations[column.id] && (!column.promptRecommendations || column.promptRecommendations.length === 0) && (
                        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md shadow-sm">
                          <div className="text-sm text-blue-800 font-medium flex items-center">
                            <svg className="w-4 h-4 mr-2 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generating prompt recommendations...
                          </div>
                        </div>
                      )}

                      <textarea
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#420039] focus:border-[#420039] min-h-[60px] text-gray-900 placeholder-gray-600"
                        placeholder="Describe what you want the AI to generate based on other columns... (Specify output type: numbers only, date format, or concise text)"
                        value={column.prompt}
                        onChange={(e) => updateColumnProperty(column.id, 'prompt', e.target.value)}
                      />
                    </div>

                    {/* Preview data (only display columns with preview data) */}
                    {column.previewData.length > 0 && (
                      <div className="mt-2">
                        <div className="border border-gray-200 rounded p-2 bg-white w-full">
                          {column.previewData.map((content, idx) => (
                            <div key={idx} className={`text-xs py-1 px-2 ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'} relative`}>
                              <div className="flex items-center w-full tooltip-trigger cursor-pointer" onClick={(e) => togglePreviewTooltip(column.id, idx, e)}>
                                <span className="font-medium text-gray-700 mr-1 flex-shrink-0 w-14">Row {idx + 1}:</span>
                                <span className={`inline-block text-left w-full overflow-hidden overflow-ellipsis whitespace-nowrap ${content.includes('Generation failed') || content.includes('Server timeout') || content.includes('Error') ? 'text-red-500 font-medium' : 'text-gray-900'}`}>
                                  {content}
                                </span>
                                {content.includes('Generation failed') && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      generatePreviewData(column.id);
                                    }}
                                    className="ml-2 p-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md flex-shrink-0"
                                    title="Retry generating this row"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                              {/* Tooltip for preview data - now controlled by click rather than hover */}
                              <div className={`tooltip-content absolute z-50 ${activeTooltip && activeTooltip.type === 'preview' && activeTooltip.columnId === column.id && activeTooltip.rowIndex === idx ? 'visible opacity-100' : 'invisible opacity-0'} bg-gray-800 text-white text-xs rounded-md p-2 shadow-lg whitespace-pre-wrap break-words transition-all duration-200 ease-in-out overflow-auto max-h-[200px] max-w-[300px] left-16`} style={{top: 'auto', bottom: 'auto', transform: 'translateY(-100%)', marginTop: '-8px'}}>
                                <div className="font-semibold text-blue-300 mb-1 border-b border-gray-600 pb-1">
                                  <span className="mr-1 px-1.5 py-0.5 rounded bg-purple-700 text-white text-xs">AI Generated</span>
                                  Row: {idx + 1} | Preview
                                </div>
                                <div className="pt-1">
                                  {content !== null && content !== undefined && String(content).trim() !== '' ? (
                                    content.includes('Generation failed') ? (
                                      <div>
                                        <span className="text-red-400 font-medium">Generation failed possibly due to:</span>
                                        <ul className="list-disc pl-4 mt-1 text-red-300">
                                          <li>Temporary server timeout</li>
                                          <li>AI model could not understand the instructions</li>
                                          <li>Complex data format or content</li>
                                        </ul>
                                        <div className="mt-2 text-blue-300">
                                          Suggestion: Try clicking the retry button or make your prompt more specific
                                        </div>
                                      </div>
                                    ) : (
                                      String(content)
                                    )
                                  ) : (
                                    <span className="italic text-gray-400">Empty content</span>
                                  )}
                                </div>
                                <div className="absolute bottom-0 left-4 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-800"></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add unified preview button and generate all columns button */}
                <div className="mt-4 flex flex-col space-y-3">
                  {/* Progress bar - only show when processing */}
                  {isProcessing && (
                    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-green-600 h-4 text-xs font-medium text-white text-center p-0.5 leading-none rounded-full"
                        style={{ width: `${generationProgress.percentage}%` }}
                      >
                        {generationProgress.percentage}%
                      </div>
                    </div>
                  )}

                  {/* More detailed progress information */}
                  {isProcessing && generationProgress.currentColumn && (
                    <div className="text-xs text-gray-700 bg-gray-100 p-2 rounded-md">
                      <div className="font-medium">Generating column: {generationProgress.currentColumn}</div>
                      <div className="mt-1 flex justify-between">
                        <span>Processed: {generationProgress.processedRows}/{generationProgress.totalRows} rows</span>
                        <span>Completed: {generationProgress.percentage}%</span>
                      </div>
                      {/* Add model info display */}
                      <div className="mt-1 flex items-center">
                        <span className="mr-2">AI model:</span>
                        <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-medium">
                          {generationProgress.modelInfo}
                        </span>
                      </div>
                      {generationProgress.waitingTime > 0 && (
                        <div className="mt-1">
                          Waiting {generationProgress.waitingTime} seconds for next API call...
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end space-x-3">
                    <button
                      className={`px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${newColumns.some(col => col.isProcessing) ? 'opacity-75 cursor-wait' : ''}`}
                      onClick={() => generatePreviewData()}
                      disabled={isProcessing || newColumns.some(col => col.isProcessing) || !newColumns.some(col => col.name && col.prompt)}
                    >
                      {newColumns.some(col => col.isProcessing) ? (
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-2 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Generating Previews...
                        </span>
                      ) : "Generate Previews"}
                    </button>
                    <button
                      className={`px-4 py-2 text-white bg-[#420039] hover:bg-[#5a0050] rounded-md focus:outline-none focus:ring-2 focus:ring-[#420039] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${isProcessing ? 'opacity-75 cursor-wait' : ''}`}
                      onClick={generateFullData}
                      disabled={isProcessing || !newColumns.some(col => col.name && col.previewData.length > 0)}
                    >
                      {isProcessing ? (
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-2 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </span>
                      ) : "Generate All"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 mb-6 bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-[#420039]">File Preview</h2>
                <span className="px-3 py-1 text-xs text-[#420039] bg-[#f5e6ff] rounded-full">
                  {fileData.fileName}
                </span>
              </div>
              <div className="overflow-x-auto overflow-y-auto max-h-[480px] border border-gray-200 rounded shadow-inner">
                <table ref={tableRef} className="w-full text-sm text-left border-collapse border-spacing-0 border border-gray-200">
                  <thead className="sticky top-0 z-20">
                    <tr className="bg-gray-100 border-b-2 border-gray-300">
                      <th className="px-2 py-1.5 font-semibold text-gray-700 border border-gray-200 w-10 text-center bg-gray-100">
                        <div className="flex items-center justify-center">
                          #
                          <span className="ml-1 text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4" />
                            </svg>
                          </span>
                        </div>
                      </th>
                      {fileData.headers.map((header, index) => {
                        const isNewColumn = fileData.originalHeaders && !fileData.originalHeaders.includes(header);
                        return (
                          <th
                            key={index}
                            className={`px-3 py-1.5 font-semibold border border-gray-200 relative bg-gray-100 ${isNewColumn ? 'from-purple-100 to-purple-50 border-t-2 border-t-purple-400 border-b-0 shadow-sm' : 'text-gray-700'}`}
                            style={{
                              minWidth: "100px",
                              width: columnWidths[index] ? `${columnWidths[index]}px` : undefined,
                              ...(isNewColumn ? { background: 'linear-gradient(to bottom, #f3e8ff, #faf5ff)' } : {})
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                {isNewColumn && (
                                  <span className="mr-1.5 flex items-center justify-center h-4 w-4 rounded-full bg-purple-500 text-white text-[8px] font-bold">AI</span>
                                )}
                                <span className={`${header.startsWith('Column_') ? 'italic text-gray-500' : ''} ${isNewColumn ? 'text-purple-800 font-semibold' : 'text-gray-700'}`}>
                                  {intelligentTruncate(header, 20)}
                                </span>
                                <span className="ml-1 text-gray-400">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4" />
                                  </svg>
                                </span>
                              </div>
                              {/* Drag handle */}
                              <div
                                className="absolute top-0 right-0 h-full w-5 cursor-col-resize z-10"
                                onMouseDown={(e) => handleColumnResizeStart(e, index)}
                              >
                                <div className="h-full w-0 mx-auto"></div>
                              </div>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {fileData.data.slice(0, 100).map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className={`
                          ${highlightedRow === rowIndex ? 'bg-yellow-100' : rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'} 
                          hover:bg-blue-50
                        `}
                        onClick={() => setHighlightedRow(rowIndex === highlightedRow ? null : rowIndex)}
                      >
                        <td className="px-2 py-1.5 text-center text-gray-500 text-xs border border-gray-200">
                          {rowIndex + 1}
                        </td>
                        {row.map((cell, cellIndex) => {
                          const header = fileData.headers[cellIndex];
                          // Determine if this cell is in a new column
                          const isNewColumn = fileData.originalHeaders && !fileData.originalHeaders.includes(header);

                          // Improved cell value handling with better empty value display
                          let displayValue = '';
                          let cellClassName = `font-normal whitespace-normal break-words ${
                            isNewColumn ? 'text-purple-900 bg-purple-50/50' : 'text-gray-900'
                          }`;

                          if (cell === null || cell === undefined || cell === '') {
                            // Empty cell display
                            displayValue = '-';
                            cellClassName = `font-normal italic whitespace-normal break-words ${
                              isNewColumn ? 'text-purple-400 bg-purple-50/50' : 'text-gray-400'
                            }`;
                          } else if (typeof cell === 'string') {
                            if (cell.trim() === '') {
                              // Empty string display
                              displayValue = '-';
                              cellClassName = `font-normal italic whitespace-normal break-words ${
                                isNewColumn ? 'text-purple-400 bg-purple-50/50' : 'text-gray-400'
                              }`;
                            } else {
                              // Regular string display
                              displayValue = cell;
                            }
                          } else if (typeof cell === 'number') {
                            // Check if it's essentially zero (very small number)
                            if (Math.abs(cell) < 0.000001) {
                              displayValue = '0';
                            } else {
                              displayValue = String(cell);
                              cellClassName += ' text-right';
                            }
                          } else {
                            // Convert any other type to string
                            displayValue = String(cell);
                          }

                          return (
                            <td
                              key={cellIndex}
                              className={`px-3 py-1.5 border border-gray-200 relative ${isNewColumn ? 'border-l border-r border-purple-200' : ''}`}
                              style={isNewColumn ? { background: 'rgba(243, 232, 255, 0.2)' } : {}}
                            >
                              <div className={`${cellClassName} tooltip-trigger cursor-pointer`} onClick={(e) => toggleCellTooltip(rowIndex, cellIndex, e)}>
                                {(!isNaN(Number(displayValue)) && displayValue.length < 12) || displayValue === '-' ?
                                  displayValue :
                                  <span>{intelligentTruncate(displayValue, 30)}</span>
                                }
                              </div>
                              {/* Improved tooltip for file preview cells - now controlled by click rather than hover */}
                              <div className={`tooltip-content absolute z-50 ${activeTooltip && activeTooltip.type === 'filecell' && activeTooltip.rowIndex === rowIndex && activeTooltip.columnIndex === cellIndex ? 'visible opacity-100' : 'invisible opacity-0'} bg-gray-800 text-white text-xs rounded-md p-2 shadow-lg whitespace-pre-wrap break-words transition-all duration-200 ease-in-out overflow-auto max-h-[200px] max-w-[300px]`} style={{left: '0', right: '0', margin: '0 auto', top: 'auto', bottom: 'auto', transform: 'translateY(-100%)', marginTop: '-8px'}}>
                                <div className="font-semibold text-blue-300 mb-1 border-b border-gray-600 pb-1">
                                  {isNewColumn && (
                                    <span className="mr-1 px-1.5 py-0.5 rounded bg-purple-700 text-white text-xs">AI Generated</span>
                                  )}
                                  Row: {rowIndex + 1} | Column: {header}
                                </div>
                                <div className="pt-1">
                                  {cell !== null && cell !== undefined && String(cell).trim() !== ''
                                    ? String(cell)
                                    : <span className="italic text-gray-400">Empty cell</span>
                                  }
                                </div>
                                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-800"></div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 text-sm text-gray-500 flex justify-between items-center">
                <span>Showing {Math.min(100, fileData.data.length)} of {fileData.data.length} rows</span>
                {fileData.data.length > 20 && (
                  <span className="text-blue-600 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    Scroll to view more rows
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}