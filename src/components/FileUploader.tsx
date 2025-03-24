"use client";

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';

type FileData = {
  id: string;
  fileName: string;
  headers: string[];
  data: (string | number | boolean | null)[][];
  sheets?: string[];
  selectedSheet?: string;
};

type ColumnInfo = {
  name: string;
  prompt: string;
  insertAfter?: string;
  isProcessing: boolean;
  previewData: string[];
  isPreviewApproved: boolean;
};

export default function FileUploader() {
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [newColumn, setNewColumn] = useState<ColumnInfo>({
    name: '',
    prompt: '',
    insertAfter: undefined,
    isProcessing: false,
    previewData: [],
    isPreviewApproved: false,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 优化后的辅助函数：智能截断文本，保持合理显示
  const intelligentTruncate = (text: string, maxLength = 20) => {
    if (!text) return '';
    const str = String(text);
    
    // 如果文本长度小于最大长度，直接返回
    if (str.length <= maxLength) return str;
    
    // 对于较长的数字，保持完整显示
    if (!isNaN(Number(str)) && str.length < 30) return str;
    
    // 对于较短的文本，显示更多内容
    if (str.length < 30) return str;
    
    // 对于中等长度的文本，适当截断
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
          });
          
          setSuccess('CSV file uploaded successfully!');
        } else {
          setError('The CSV file is empty or invalid.');
        }
      },
      header: false,
      skipEmptyLines: true,
      error: (error) => {
        setError(`Error parsing CSV file: ${error.message}`);
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
            const headers = jsonData[0] as string[];
            const rows = jsonData.slice(1) as (string | number | boolean | null)[][];
            
            setFileData({
              id: uuidv4(),
              fileName: file.name,
              headers,
              data: rows,
              sheets,
              selectedSheet: sheets[0],
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
          });
        }
      } catch (error) {
        setError(`Error parsing Excel file: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    
    reader.onerror = () => {
      setError('Error reading the file. Please try again.');
    };
    
    reader.readAsArrayBuffer(file);
  };

  const handleSheetSelect = (sheetName: string) => {
    if (!fileData || !fileData.sheets) return;
    
    try {
      const file = fileInputRef.current?.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length > 0) {
            const headers = jsonData[0] as string[];
            const rows = jsonData.slice(1) as (string | number | boolean | null)[][];
            
            setFileData({
              ...fileData,
              headers,
              data: rows,
              selectedSheet: sheetName,
            });
            
            setSuccess(`Sheet "${sheetName}" selected successfully!`);
          } else {
            setError(`Selected sheet "${sheetName}" is empty or invalid.`);
          }
        } catch (error) {
          setError(`Error parsing sheet "${sheetName}": ${error instanceof Error ? error.message : String(error)}`);
        }
      };
      
      reader.readAsArrayBuffer(file);
    } catch (error) {
      setError(`Error selecting sheet: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const generatePreviewData = async () => {
    if (!fileData || !newColumn.name || !newColumn.prompt) {
      setError('Please provide a column name and prompt before generating preview.');
      return;
    }
    
    setNewColumn({ ...newColumn, isProcessing: true });
    setError(null);
    
    try {
      // Get first 5 rows of data to use for preview generation
      const previewRowData = fileData.data.slice(0, 5).map((row) => {
        // Create an object with column names as keys
        const rowObj: Record<string, string | number | boolean | null> = {};
        fileData.headers.forEach((header, colIndex) => {
          rowObj[header] = row[colIndex];
        });
        return rowObj;
      });
      
      // Call the AI API endpoint for each row
      const previewPromises = previewRowData.map(async (rowData, index) => {
        try {
          const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prompt: newColumn.prompt,
              rowData,
            }),
          });
          
          if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
          }
          
          const result = await response.json();
          return result.generatedContent;
        } catch (error) {
          console.error(`Error generating content for row ${index + 1}:`, error);
          return `Error generating content for row ${index + 1}`;
        }
      });
      
      // Wait for all API calls to complete
      const samplePreviewData = await Promise.all(previewPromises);
      
      setNewColumn({
        ...newColumn,
        isProcessing: false,
        previewData: samplePreviewData,
      });
      
      setSuccess('Preview data generated! Please review before generating for all rows.');
    } catch (error) {
      setNewColumn({ ...newColumn, isProcessing: false });
      setError(`Error generating preview: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const generateFullData = async () => {
    if (!fileData || !newColumn.name || newColumn.previewData.length === 0) {
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Get column headers to determine index for insertion
      const updatedHeaders = [...fileData.headers];
      
      // Convert rows to objects with named properties (for the API)
      const rowObjects = fileData.data.map(row => {
        const rowObj: Record<string, string | number | boolean | null> = {};
        fileData.headers.forEach((header, colIndex) => {
          rowObj[header] = row[colIndex];
        });
        return rowObj;
      });
      
      // Use the preview data for the first 5 rows, then generate the rest
      const fullGeneratedData = [...newColumn.previewData];
      
      // Only call API for rows beyond what we already have in preview
      if (rowObjects.length > newColumn.previewData.length) {
        const remainingRows = rowObjects.slice(newColumn.previewData.length);
        const batchSize = 5; // Process in small batches to avoid overwhelming the API
        
        for (let i = 0; i < remainingRows.length; i += batchSize) {
          const batch = remainingRows.slice(i, i + batchSize);
          
          // Show progress
          setSuccess(`Generating data for rows ${newColumn.previewData.length + i + 1} to ${Math.min(newColumn.previewData.length + i + batch.length, fileData.data.length)}...`);
          
          // Generate content for this batch in parallel
          const batchPromises = batch.map(async (rowData) => {
            try {
              const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  prompt: newColumn.prompt,
                  rowData,
                }),
              });
              
              if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
              }
              
              const result = await response.json();
              return result.generatedContent;
            } catch (error) {
              console.error('Error generating content:', error);
              return `Error generating content: ${error instanceof Error ? error.message : String(error)}`;
            }
          });
          
          // Wait for current batch to complete and add to results
          const batchResults = await Promise.all(batchPromises);
          fullGeneratedData.push(...batchResults);
        }
      }
      
      // Add the new column to the data
      const insertIndex = newColumn.insertAfter 
        ? updatedHeaders.findIndex(h => h === newColumn.insertAfter) + 1
        : updatedHeaders.length;
      
      updatedHeaders.splice(insertIndex, 0, newColumn.name);
      
      const updatedData = fileData.data.map((row, rowIndex) => {
        const newRow = [...row];
        newRow.splice(insertIndex, 0, fullGeneratedData[rowIndex]);
        return newRow;
      });
      
      setFileData({
        ...fileData,
        headers: updatedHeaders,
        data: updatedData,
      });
      
      // Reset new column state
      setNewColumn({
        name: '',
        prompt: '',
        insertAfter: undefined,
        isProcessing: false,
        previewData: [],
        isPreviewApproved: false,
      });
      
      setSuccess('New column added successfully!');
    } catch (error) {
      setError(`Error generating data: ${error instanceof Error ? error.message : String(error)}`);
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
      
      const fileExtension = fileData.fileName.split('.').pop()?.toLowerCase();
      const outputFileName = fileData.fileName.replace(`.${fileExtension}`, `-enhanced.xlsx`);
      
      XLSX.writeFile(workbook, outputFileName);
      setSuccess(`File downloaded as ${outputFileName}`);
    } catch (error) {
      setError(`Error downloading file: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
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
          <div className="p-6 mb-6 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#420039]">File Preview</h2>
              <span className="px-3 py-1 text-xs text-[#420039] bg-[#f5e6ff] rounded-full">
                {fileData.fileName}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    {fileData.headers.map((header, index) => (
                      <th 
                        key={index} 
                        className="px-4 py-3 whitespace-normal font-semibold" 
                        style={{ minWidth: "100px" }}
                        title={header}
                      >
                        {intelligentTruncate(header, 20)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {fileData.data.slice(0, 5).map((row, rowIndex) => (
                    <tr key={rowIndex} className="bg-white hover:bg-gray-50">
                      {row.map((cell, cellIndex) => (
                        <td 
                          key={cellIndex} 
                          className="px-4 py-3 font-medium text-gray-900 whitespace-normal break-words group relative"
                          style={{ minWidth: "100px" }}
                          title=""
                        >
                          {(!isNaN(Number(String(cell))) || String(cell).length < 12) ? 
                            String(cell) : 
                            <span>{intelligentTruncate(String(cell), 30)}</span>
                          }
                          {String(cell).length > 12 && (
                            <div className="absolute z-20 invisible opacity-0 group-hover:visible group-hover:opacity-100 bg-gray-800 text-white text-sm rounded-md p-3 transform -translate-x-1/2 translate-y-2 bottom-full left-1/2 w-auto min-w-[200px] max-w-sm shadow-lg whitespace-pre-wrap break-words transition-all duration-200 ease-in-out overflow-auto max-h-[200px]">
                              {String(cell)}
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-sm text-gray-500">
              Showing {Math.min(5, fileData.data.length)} of {fileData.data.length} rows
            </div>
          </div>

          <div className="p-6 mb-6 bg-white rounded-lg shadow-sm border border-gray-200">
            <h2 className="mb-4 text-xl font-bold text-[#420039]">Add New Column</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Column Name
                </label>
                <input
                  type="text"
                  placeholder="Enter column name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#420039] focus:border-[#420039] text-gray-900 placeholder-gray-500"
                  value={newColumn.name}
                  onChange={(e) => setNewColumn({ ...newColumn, name: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Insert After (Optional)
                </label>
                <select
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#420039] focus:border-[#420039] text-gray-900"
                  value={newColumn.insertAfter || ''}
                  onChange={(e) => setNewColumn({ ...newColumn, insertAfter: e.target.value || undefined })}
                >
                  <option value="">Add to the end</option>
                  {fileData.headers.map((header) => (
                    <option key={header} value={header}>
                      After: {intelligentTruncate(header, 30)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="mt-4">
              <label className="block mb-2 text-sm font-medium text-gray-700">
                AI Prompt
              </label>
              <textarea
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#420039] focus:border-[#420039] min-h-[120px] text-gray-900 placeholder-gray-500"
                placeholder="Describe what you want the AI to generate based on other columns"
                value={newColumn.prompt}
                onChange={(e) => setNewColumn({ ...newColumn, prompt: e.target.value })}
              />
              <p className="mt-1 text-sm text-gray-500">
                Example: &quot;Generate a summary based on the &apos;Description&apos; column&quot; or &quot;Analyze sentiment in the &apos;Comments&apos; column&quot;
              </p>
            </div>
            
            <div className="mt-6">
              <button
                className={`px-6 py-2 text-white bg-[#420039] hover:bg-[#5a0050] rounded-md focus:outline-none focus:ring-2 focus:ring-[#420039] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${newColumn.isProcessing ? 'opacity-75 cursor-wait' : ''}`}
                onClick={generatePreviewData}
                disabled={!newColumn.name || !newColumn.prompt || newColumn.isProcessing}
              >
                {newColumn.isProcessing ? (
                  <span className="flex items-center">
                    <svg className="w-5 h-5 mr-2 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </span>
                ) : "Generate Preview"}
              </button>
            </div>
          </div>

          {newColumn.previewData.length > 0 && (
            <div className="p-6 mb-6 bg-white rounded-lg shadow-sm border border-gray-200">
              <h2 className="mb-4 text-xl font-bold text-[#420039]">Preview Generated Data</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 w-16">Row</th>
                      <th className="px-4 py-3 w-2/3">Generated Content</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {newColumn.previewData.map((content, index) => (
                      <tr key={index} className="bg-white hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {index + 1}
                        </td>
                        <td 
                          className="px-4 py-3 text-gray-900 whitespace-normal break-words group relative"
                          style={{ maxWidth: "400px" }}
                          title=""
                        >
                          {content.length < 50 ? 
                            content : 
                            <span>{intelligentTruncate(content, 50)}</span>
                          }
                          {content.length > 50 && (
                            <div className="absolute z-20 invisible opacity-0 group-hover:visible group-hover:opacity-100 bg-gray-800 text-white text-sm rounded-md p-3 transform -translate-x-1/2 translate-y-2 bottom-full left-1/2 w-auto min-w-[200px] max-w-md shadow-lg whitespace-pre-wrap break-words transition-all duration-200 ease-in-out overflow-auto max-h-[200px]">
                              {content}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="flex justify-end gap-4 mt-6">
                <button
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#420039] focus:ring-offset-2"
                  onClick={() => setNewColumn({ ...newColumn, previewData: [] })}
                >
                  Cancel
                </button>
                <button
                  className={`px-6 py-2 text-white bg-[#420039] hover:bg-[#5a0050] rounded-md focus:outline-none focus:ring-2 focus:ring-[#420039] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${isProcessing ? 'opacity-75 cursor-wait' : ''}`}
                  onClick={generateFullData}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <span className="flex items-center">
                      <svg className="w-5 h-5 mr-2 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : "Approve & Generate All"}
                </button>
              </div>
            </div>
          )}

          {fileData.headers.length > 0 && fileData.data.length > 0 && (
            <div className="text-center">
              <button 
                className="px-8 py-3 text-[#420039] bg-[#ffbc00] hover:bg-[#ffa700] rounded-md focus:outline-none focus:ring-2 focus:ring-[#ffbc00] focus:ring-offset-2 shadow-sm font-bold"
                onClick={downloadFile}
              >
                <span className="flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Download Enhanced File
                </span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
} 