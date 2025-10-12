import React, { useState } from 'react';
import { uploadProof } from '../api/api';
import { toast } from 'react-toastify';
import { Upload, FileText, CheckCircle } from 'lucide-react';

const ProofUpload = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setResult(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('proofFile', file);

    try {
      const response = await uploadProof(formData);
      setResult(response.data);
      toast.success('Proof uploaded and analyzed successfully!');
      setFile(null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-white/10 backdrop-blur-md rounded-lg p-8 border border-white/20">
        <div className="flex items-center space-x-3 mb-8">
          <FileText className="h-10 w-10 text-white" />
          <div>
            <h1 className="text-3xl font-bold text-white">Upload Proof of Expenditure</h1>
            <p className="text-white/70">Submit receipts, invoices, and bills for AI verification</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-white text-sm font-medium mb-2">Upload Document (PDF/Image)</label>
            <div className="flex items-center space-x-4">
              <label className="flex-1 cursor-pointer">
                <div className="flex items-center justify-center px-6 py-12 bg-white/10 border-2 border-dashed border-white/30 rounded-md hover:bg-white/20 transition">
                  <div className="text-center">
                    <Upload className="h-12 w-12 text-white/70 mx-auto mb-3" />
                    <p className="text-white/70">{file ? file.name : 'Click to choose file or drag here'}</p>
                    <p className="text-white/50 text-xs mt-2">PDF, JPG, JPEG, PNG (Max 10MB)</p>
                  </div>
                </div>
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !file}
            className="w-full bg-white text-purple-700 py-3 rounded-md font-semibold hover:bg-white/90 transition disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-purple-700"></div>
                <span>Analyzing with AI...</span>
              </>
            ) : (
              <>
                <Upload className="h-5 w-5" />
                <span>Upload & Analyze</span>
              </>
            )}
          </button>
        </form>

        {result && (
          <div className="mt-8 p-6 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div className="flex items-center space-x-2 mb-4">
              <CheckCircle className="h-6 w-6 text-green-400" />
              <h3 className="text-xl font-bold text-white">Analysis Complete</h3>
            </div>
            
            <div className="space-y-3 text-white/80">
              <div>
                <p className="text-white/60 text-sm">Summary:</p>
                <p className="text-white">{result.analysis?.summary || 'Document processed'}</p>
              </div>
              
              {result.analysis?.extractedData && (
                <div>
                  <p className="text-white/60 text-sm">Extracted Data:</p>
                  <pre className="text-xs bg-black/20 p-3 rounded mt-2 overflow-auto">
                    {JSON.stringify(result.analysis.extractedData, null, 2)}
                  </pre>
                </div>
              )}
              
              {result.priceCheckResult && (
                <div>
                  <p className="text-white/60 text-sm">Price Verification:</p>
                  <p className="text-white">{result.priceCheckResult.summary || 'Verified'}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProofUpload;
