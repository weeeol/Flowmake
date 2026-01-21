import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import JSZip from 'jszip';
import { 
  UploadCloud, Loader2, AlertCircle, Download, 
  Folder, FolderOpen, Image as ImageIcon, ChevronRight 
} from 'lucide-react';
import './App.css';

function App() {
  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [zipBlob, setZipBlob] = useState(null);
  
  // Data Structure: { "Global": [img1, img2], "AuthClass": [img3] }
  const [folders, setFolders] = useState({}); 
  const [selectedFolder, setSelectedFolder] = useState(null);

  // Cleanup memory
  useEffect(() => {
    return () => {
      Object.values(folders).flat().forEach(img => URL.revokeObjectURL(img.src));
    };
  }, [folders]);

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setFolders({});
    setZipBlob(null);
    setSelectedFolder(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://127.0.0.1:8000/upload_flowchart_zip', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob', 
      });

      setZipBlob(response.data);
      
      // Process ZIP and Group by Folder
      const zip = await JSZip.loadAsync(response.data);
      const newFolders = {};
      const promises = [];

      zip.forEach((relativePath, zipEntry) => {
        if (zipEntry.name.endsWith('.png')) {
          const promise = zipEntry.async('blob').then(blob => {
            // Determine folder name from path (e.g. "UserManager/login.png")
            const parts = zipEntry.name.split('/');
            let folderName = "Global Functions";
            let fileName = zipEntry.name;

            if (parts.length > 1) {
              folderName = parts[0]; // "UserManager"
              fileName = parts[parts.length - 1]; // "login.png"
            }

            if (!newFolders[folderName]) newFolders[folderName] = [];
            
            newFolders[folderName].push({
              name: fileName,
              src: URL.createObjectURL(blob)
            });
          });
          promises.push(promise);
        }
      });

      await Promise.all(promises);
      setFolders(newFolders);
      
      // Select the first folder automatically
      const firstKey = Object.keys(newFolders)[0];
      if (firstKey) setSelectedFolder(firstKey);

    } catch (err) {
      console.error(err);
      setError("Failed. Is Backend running?");
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
    onDrop, accept: {'text/x-python': ['.py']}, multiple: false 
  });

  return (
    <div className="dashboard">
      
      {/* --- LEFT SIDEBAR (Navigation) --- */}
      <div className="sidebar">
        <div className="brand">
          <h2>Flow<span className="accent">make</span></h2>
        </div>

        {/* Mini Upload Area */}
        <div {...getRootProps()} className={`mini-dropzone ${isDragActive ? 'active' : ''}`}>
          <input {...getInputProps()} />
          {loading ? <Loader2 className="spin" /> : <UploadCloud />}
          <span>{loading ? "Processing..." : "New Upload"}</span>
        </div>

        {/* Error Message */}
        {error && <div className="error-msg"><AlertCircle size={14}/> {error}</div>}

        {/* Folder List */}
        <div className="folder-list">
          <h3>Structure</h3>
          {Object.keys(folders).length === 0 && <p className="empty-state">No files loaded.</p>}
          
          {Object.keys(folders).map(folderName => (
            <button 
              key={folderName} 
              className={`folder-item ${selectedFolder === folderName ? 'active' : ''}`}
              onClick={() => setSelectedFolder(folderName)}
            >
              {selectedFolder === folderName ? <FolderOpen size={18} /> : <Folder size={18} />}
              <span>{folderName}</span>
              <span className="count">{folders[folderName].length}</span>
              {selectedFolder === folderName && <ChevronRight className="indicator" size={14} />}
            </button>
          ))}
        </div>

        {/* Download Button (Fixed at bottom) */}
        {zipBlob && (
          <button className="download-btn-sidebar" onClick={downloadZip}>
            <Download size={16} /> Download ZIP
          </button>
        )}
      </div>

      {/* --- RIGHT CONTENT (Canvas) --- */}
      <div className="main-canvas">
        {selectedFolder ? (
          <div className="canvas-content">
            <header className="canvas-header">
              <h1>{selectedFolder}</h1>
              <span className="badge">{folders[selectedFolder].length} Flowcharts</span>
            </header>
            
            <div className="masonry-grid">
              {folders[selectedFolder].map((img, idx) => (
                <div key={idx} className="chart-card">
                  <div className="card-top">
                    <ImageIcon size={14} /> {img.name}
                  </div>
                  <div className="card-image">
                    <img src={img.src} alt={img.name} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="welcome-screen">
            <div className="placeholder-art">
              <UploadCloud size={80} color="#e2e8f0" />
            </div>
            <h1>Ready to Visualize?</h1>
            <p>Upload a Python file on the left to fill this space.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;