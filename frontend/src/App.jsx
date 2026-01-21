import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { UploadCloud, FileCode, CheckCircle, AlertCircle, Loader2, Download } from 'lucide-react';
import './App.css';

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [fileName, setFileName] = useState("");

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Reset States
    setLoading(true);
    setError(null);
    setSuccess(false);
    setFileName(file.name);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Artificial delay so the user sees the "Loading" animation (optional UX touch)
      await new Promise(resolve => setTimeout(resolve, 800));

      const response = await axios.post('http://127.0.0.1:8000/upload_flowchart_zip', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob', 
      });

      // Handle Download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'flowcharts_organized.zip');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      
      setSuccess(true);
      setLoading(false);

    } catch (err) {
      console.error(err);
      setError("Server error. Is the backend running?");
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {'text/x-python': ['.py']},
    multiple: false
  });

  return (
    <div className="app-container">
      <div className="card">
        {/* Header Section */}
        <div className="header">
          <h1>FlowChart<span className="gradient-text">Gen</span></h1>
          <p>Turn your Python code into visual logic instantly.</p>
        </div>

        {/* Dropzone Area */}
        <div 
          {...getRootProps()} 
          className={`dropzone ${isDragActive ? 'active' : ''} ${error ? 'error-border' : ''}`}
        >
          <input {...getInputProps()} />
          
          <div className="icon-wrapper">
            {loading ? (
              <Loader2 className="icon-spin" size={48} color="#6366f1" />
            ) : success ? (
              <CheckCircle size={48} color="#10b981" />
            ) : error ? (
              <AlertCircle size={48} color="#ef4444" />
            ) : (
              <UploadCloud size={48} color="#6366f1" />
            )}
          </div>

          <div className="text-content">
            {loading ? (
              <h3>Analyzing logic...</h3>
            ) : success ? (
              <h3>Done! Download started.</h3>
            ) : isDragActive ? (
              <h3 className="highlight">Drop it here!</h3>
            ) : (
              <h3>Click or Drag a .py file</h3>
            )}
            
            <p className="sub-text">
              {fileName ? `File: ${fileName}` : "Supports Python 3.9+ scripts"}
            </p>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="status-badge error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
        
        {success && (
          <div className="status-badge success">
            <Download size={16} />
            <span>Check your downloads folder</span>
          </div>
        )}
      </div>
      
      <p className="footer">Powered by Python AST & Graphviz</p>
    </div>
  );
}

export default App;