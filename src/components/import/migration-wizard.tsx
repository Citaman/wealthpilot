'use client';

import { useState, useCallback } from 'react';
import { Upload, CheckCircle, AlertCircle, FileText, ArrowRight, RefreshCw, Download, Trash2 } from 'lucide-react';
import { 
  detectCSVFormat, 
  previewImport, 
  importCSV, 
  type DuplicateCheck,
  type ImportResult 
} from '@/lib/csv-importer';
import { Transaction } from '@/lib/db';
import { useAccounts } from '@/hooks/use-data';

interface MigrationWizardProps {
  onComplete?: () => void;
}

type WizardStep = 'upload' | 'preview' | 'importing' | 'complete';

export function MigrationWizard({ onComplete }: MigrationWizardProps) {
  const { accounts, createAccount } = useAccounts();
  
  const [step, setStep] = useState<WizardStep>('upload');
  const [csvContent, setCsvContent] = useState<string>('');
  const [csvFormat, setCsvFormat] = useState<'historical' | 'bank' | 'unknown'>('unknown');
  const [fileName, setFileName] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [newAccountName, setNewAccountName] = useState('');
  
  // Preview data
  const [previewData, setPreviewData] = useState<{
    totalRows: number;
    dateRange: { start: string; end: string } | null;
    transactions: Partial<Transaction>[];
    duplicateChecks: DuplicateCheck[];
    categorySummary: Record<string, number>;
  } | null>(null);
  
  // Import settings
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [duplicateThreshold, setDuplicateThreshold] = useState(0.7);
  
  // Import result
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Handle file upload
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setError(null);
    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);
      
      const format = detectCSVFormat(content);
      setCsvFormat(format);
      
      if (format === 'unknown') {
        setError('Could not detect CSV format. Please use historical or French bank export format.');
        return;
      }
      
      // Generate preview
      const preview = await previewImport(content, selectedAccountId || undefined);
      setPreviewData(preview);
      setStep('preview');
    };
    
    reader.onerror = () => {
      setError('Failed to read file');
    };
    
    reader.readAsText(file, 'ISO-8859-1'); // Support French encoding
  }, [selectedAccountId]);
  
  // Handle account selection change
  const handleAccountChange = useCallback(async (accountId: number | null) => {
    setSelectedAccountId(accountId);
    
    if (csvContent && accountId) {
      const preview = await previewImport(csvContent, accountId);
      setPreviewData(preview);
    }
  }, [csvContent]);
  
  // Create new account
  const handleCreateAccount = useCallback(async () => {
    if (!newAccountName.trim()) return;
    
    const id = await createAccount({
      name: newAccountName,
      type: 'checking',
      currency: 'EUR',
      balance: 0,
      institution: 'Unknown',
      color: '#3B82F6', // Default blue
      isActive: true,
      initialBalance: 0,
      initialBalanceDate: new Date().toISOString().split('T')[0],
    });
    
    setSelectedAccountId(id);
    setNewAccountName('');
    handleAccountChange(id);
  }, [newAccountName, createAccount, handleAccountChange]);
  
  // Start import
  const handleImport = useCallback(async () => {
    if (!csvContent || !selectedAccountId) return;
    
    setImporting(true);
    setError(null);
    setStep('importing');
    
    try {
      const result = await importCSV(csvContent, selectedAccountId, {
        skipDuplicates,
        duplicateThreshold,
      });
      
      setImportResult(result);
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('preview');
    } finally {
      setImporting(false);
    }
  }, [csvContent, selectedAccountId, skipDuplicates, duplicateThreshold]);
  
  // Reset wizard
  const handleReset = useCallback(() => {
    setStep('upload');
    setCsvContent('');
    setCsvFormat('unknown');
    setFileName('');
    setPreviewData(null);
    setImportResult(null);
    setError(null);
  }, []);
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {(['upload', 'preview', 'importing', 'complete'] as const).map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
              ${step === s ? 'bg-blue-600 text-white' : 
                ((['upload', 'preview', 'importing', 'complete'] as const).indexOf(step) > i 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500')
              }
            `}>
              {(['upload', 'preview', 'importing', 'complete'] as const).indexOf(step) > i 
                ? <CheckCircle className="w-4 h-4" /> 
                : i + 1}
            </div>
            <span className={`ml-2 text-sm ${step === s ? 'font-medium' : 'text-gray-500'}`}>
              {s === 'upload' ? 'Upload' : 
               s === 'preview' ? 'Preview' : 
               s === 'importing' ? 'Importing' : 'Complete'}
            </span>
            {i < 3 && <ArrowRight className="w-4 h-4 mx-4 text-gray-400" />}
          </div>
        ))}
      </div>
      
      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        </div>
      )}
      
      {/* Step: Upload */}
      {step === 'upload' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-2">Import Transactions</h3>
            <p className="text-gray-500 text-sm">
              Upload a CSV file to import transactions. Supports historical format (with categories) 
              or French bank export format.
            </p>
          </div>
          
          {/* Account Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Select Account</label>
            <div className="flex gap-2">
              <select
                value={selectedAccountId || ''}
                onChange={(e) => handleAccountChange(e.target.value ? Number(e.target.value) : null)}
                className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="">Select an account...</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>
            
            {/* Create new account */}
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                placeholder="Or create new account..."
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
              />
              <button
                onClick={handleCreateAccount}
                disabled={!newAccountName.trim()}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
          
          {/* File Upload */}
          <div 
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center"
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
              disabled={!selectedAccountId}
            />
            <label 
              htmlFor="csv-upload" 
              className={`cursor-pointer ${!selectedAccountId ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {selectedAccountId 
                  ? 'Click to upload or drag and drop a CSV file'
                  : 'Please select an account first'}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Supported formats: Historical CSV, SG Bank Export
              </p>
            </label>
          </div>
        </div>
      )}
      
      {/* Step: Preview */}
      {step === 'preview' && previewData && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-2">Import Preview</h3>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <FileText className="w-4 h-4" />
                {fileName}
              </span>
              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                {csvFormat === 'historical' ? 'Historical Format' : 'Bank Export Format'}
              </span>
            </div>
          </div>
          
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-2xl font-bold">{previewData.totalRows}</div>
              <div className="text-sm text-gray-500">Total Rows</div>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {previewData.duplicateChecks.filter(d => !d.isDuplicate || d.confidence < duplicateThreshold).length}
              </div>
              <div className="text-sm text-gray-500">To Import</div>
            </div>
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {previewData.duplicateChecks.filter(d => d.isDuplicate && d.confidence >= duplicateThreshold).length}
              </div>
              <div className="text-sm text-gray-500">Duplicates</div>
            </div>
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-xs font-medium text-blue-600">
                {previewData.dateRange?.start} → {previewData.dateRange?.end}
              </div>
              <div className="text-sm text-gray-500">Date Range</div>
            </div>
          </div>
          
          {/* Category Breakdown */}
          <div>
            <h4 className="font-medium mb-2">Category Breakdown</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(previewData.categorySummary)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, count]) => (
                  <span 
                    key={cat}
                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs"
                  >
                    {cat}: {count}
                  </span>
                ))}
            </div>
          </div>
          
          {/* Duplicate Settings */}
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h4 className="font-medium mb-3">Duplicate Handling</h4>
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Skip duplicate transactions</span>
              </label>
              
              <div>
                <label className="text-sm text-gray-500">Confidence Threshold: {Math.round(duplicateThreshold * 100)}%</label>
                <input
                  type="range"
                  min="0.5"
                  max="1"
                  step="0.05"
                  value={duplicateThreshold}
                  onChange={(e) => setDuplicateThreshold(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>
          
          {/* Sample Transactions */}
          <div>
            <h4 className="font-medium mb-2">Sample Transactions</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Merchant</th>
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.duplicateChecks.slice(0, 10).map((check, i) => (
                    <tr key={i} className="border-b dark:border-gray-700">
                      <td className="px-3 py-2">{check.transaction.date}</td>
                      <td className="px-3 py-2">{check.transaction.merchant}</td>
                      <td className="px-3 py-2 text-gray-500">
                        {check.transaction.category}/{check.transaction.subcategory}
                      </td>
                      <td className={`px-3 py-2 text-right ${check.transaction.direction === 'credit' ? 'text-green-500' : 'text-red-400'}`}>
                        {check.transaction.direction === 'credit' ? '+' : '-'}€{check.transaction.amount?.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {check.isDuplicate && check.confidence >= duplicateThreshold ? (
                          <span className="text-yellow-600 text-xs">
                            Duplicate ({Math.round(check.confidence * 100)}%)
                          </span>
                        ) : (
                          <span className="text-green-600 text-xs">New</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex justify-between">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Import {previewData.duplicateChecks.filter(d => !d.isDuplicate || d.confidence < duplicateThreshold).length} Transactions
            </button>
          </div>
        </div>
      )}
      
      {/* Step: Importing */}
      {step === 'importing' && (
        <div className="text-center py-12">
          <RefreshCw className="w-12 h-12 mx-auto mb-4 text-blue-600 animate-spin" />
          <p className="text-lg font-medium">Importing transactions...</p>
          <p className="text-sm text-gray-500 mt-2">This may take a moment</p>
        </div>
      )}
      
      {/* Step: Complete */}
      {step === 'complete' && importResult && (
        <div className="space-y-6">
          <div className="text-center py-6">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <h3 className="text-xl font-medium">Import Complete!</h3>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
              <div className="text-3xl font-bold text-green-600">{importResult.imported}</div>
              <div className="text-sm text-gray-500">Imported</div>
            </div>
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center">
              <div className="text-3xl font-bold text-yellow-600">{importResult.duplicates}</div>
              <div className="text-sm text-gray-500">Skipped (Duplicates)</div>
            </div>
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
              <div className="text-3xl font-bold text-red-600">{importResult.errors}</div>
              <div className="text-sm text-gray-500">Errors</div>
            </div>
          </div>
          
          {importResult.errorDetails.length > 0 && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <h4 className="font-medium text-red-600 mb-2">Errors:</h4>
              <ul className="text-sm text-red-600 space-y-1">
                {importResult.errorDetails.slice(0, 5).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="flex justify-between">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Import More
            </button>
            <button
              onClick={onComplete}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
