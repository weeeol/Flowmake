import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import JSZip from 'jszip'; // Import the unzipper
import { UploadCloud, CheckCircle, AlertCircle, Loader2, Download, Image as ImageIcon } from 'lucide-react';
import './App.css';

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [images, setImages] = useState([]); // Store the extracted images
  const [zipBlob, setZipBlob] = useState(null); // Store the raw zip file for downloading later

  // Cleanup URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      images.forEach(img => URL.revokeObjectURL(img.src));
    };
  }, [images]);

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setImages([]);
    setZipBlob(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // 1. Get the ZIP file from backend
      const response = await axios.post('http://127.0.0.1:8000/upload_flowchart_zip', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob', 
      });

      // 2. Save ZIP blob for later download
      setZipBlob(response.data);

      // 3. Unzip content for preview
      const zip = await JSZip.loadAsync(response.data);
      const imagePromises = [];

      zip.forEach((relativePath, zipEntry) => {
        if (zipEntry.name.endsWith('.png')) {
          const promise = zipEntry.async('blob').then(blob => ({
            name: zipEntry.name,
            src: URL.createObjectURL(blob)
          }));
          imagePromises.push(promise);
        }
      });

      const extractedImages = await Promise.all(imagePromises);
      setImages(extractedImages);

    } catch (err) {
      console.error(err);
      setError("Failed to process file.");
    } finally {
      setLoading(false);
    }
  }, []);

  const downloadZip = () => {
    if (!zipBlob) return;
    const url = window.URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'flowcharts.zip');
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {'text/x-python': ['.py']},
    multiple: false
  });

  return (
    <div className="app-container">
      <div className="card">
        <div className="header">
          <h1>FlowChart<span className="gradient-text">Gen</span></h1>
          <p>Drag & drop Python code to view logic instantly.</p>
        </div>

        {/* DROPZONE */}
        <div 
          {...getRootProps()} 
          className={`dropzone ${isDragActive ? 'active' : ''} ${error ? 'error-border' : ''}`}
        >
          <input {...getInputProps()} />
          <div className="icon-wrapper">
            {loading ? <Loader2 className="icon-spin" size={48} color="#6366f1" /> : 
             error ? <AlertCircle size={48} color="#ef4444" /> : 
             <UploadCloud size={48} color="#6366f1" />}
          </div>
          <div className="text-content">
             {loading ? <h3>Processing...</h3> : <h3>Click or Drag .py file</h3>}
          </div>
        </div>

        {/* ERROR MESSAGE */}
        {error && (
          <div className="status-badge error">
            <AlertCircle size={16} /> <span>{error}</span>
          </div>
        )}

        {/* DOWNLOAD BUTTON (Only shows if we have results) */}
        {images.length > 0 && (
          <button className="download-btn" onClick={downloadZip}>
            <Download size={18} /> Download All as ZIP
          </button>
        )}
      </div>

      {/* GALLERY SECTION */}
      {images.length > 0 && (
        <div className="gallery-section">
          <h2>Generated Flowcharts ({images.length})</h2>
          <div className="gallery-grid">
            {images.map((img, index) => (
              <div key={index} className="image-card">
                <div className="image-header">
                  <ImageIcon size={16} />
                  <span>{img.name}</span>
                </div>
                <div className="image-preview">
                  <img src={img.src} alt={img.name} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;