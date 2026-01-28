import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import JSZip from 'jszip';
import { 
  UploadCloud, Loader2, AlertCircle, Download, 
  Folder, FolderOpen, Image as ImageIcon, ChevronRight,
  Layout, Code 
} from 'lucide-react';
import Playground from './Playground'; // Ensure this file exists
import './App.css';

function App() {
  // --- STATE MANAGEMENT ---
  const [viewMode, setViewMode] = useState('dashboard'); // 'dashboard' | 'playground'
  
  // Dashboard States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [zipBlob, setZipBlob] = useState(null);
  const [folders, setFolders] = useState({}); 
  const [selectedFolder, setSelectedFolder] = useState(null);

  // Cleanup object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      Object.values(folders).flat().forEach(img => URL.revokeObjectURL(img.src));
    };
  }, [folders]);

  // --- FILE UPLOAD HANDLER ---
  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Switch to dashboard view if a file is dropped
    setViewMode('dashboard');
    setLoading(true);
    setError(null);
    setFolders({});
    setZipBlob(null);
    setSelectedFolder(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Use 127.0.0.1 to avoid localhost DNS lag
      const response = await axios.post('http://127.0.0.1:8000/upload_flowchart_zip', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob', 
      });

      setZipBlob(response.data);
      
      // Parse ZIP
      const zip = await JSZip.loadAsync(response.data);
      const newFolders = {};
      const promises = [];

      zip.forEach((relativePath, zipEntry) => {
        if (zipEntry.name.endsWith('.png')) {
          const promise = zipEntry.async('blob').then(blob => {
            // Path logic: "UserManager/login.png" vs "login.png"
            const parts = zipEntry.name.split('/');
            let folderName = "Global Functions";
            let fileName = zipEntry.name;

            if (parts.length > 1) {
              folderName = parts[0]; 
              fileName = parts[parts.length - 1]; 
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
      
      // Select first folder automatically
      const firstKey = Object.keys(newFolders)[0];
      if (firstKey) setSelectedFolder(firstKey);

    } catch (err) {
      console.error(err);
      setError("Failed to process file. Is the Backend running?");
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
      
      {/* --- SIDEBAR --- */}
      <div className="sidebar">
        <div className="brand">
          <h2>Flow<span className="accent">Gen</span></h2>
        </div>

        {/* 1. Navigation Switches */}
        <div className="nav-buttons">
          <button 
            className={`nav-btn ${viewMode === 'dashboard' ? 'active' : ''}`}
            onClick={() => setViewMode('dashboard')}
          >
            <Layout size={18} /> Dashboard
          </button>
          <button 
            className={`nav-btn ${viewMode === 'playground' ? 'active' : ''}`}
            onClick={() => setViewMode('playground')}
          >
            <Code size={18} /> Live Playground
          </button>
        </div>

        {/* 2. Dashboard Specific Controls (Only show if in Dashboard mode) */}
        {viewMode === 'dashboard' && (
          <>
            <div {...getRootProps()} className={`mini-dropzone ${isDragActive ? 'active' : ''}`}>
              <input {...getInputProps()} />
              {loading ? <Loader2 className="spin" /> : <UploadCloud />}
              <span>{loading ? "Processing..." : "New Upload"}</span>
            </div>

            {error && <div className="error-msg"><AlertCircle size={14}/> {error}</div>}

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

            {zipBlob && (
              <button className="download-btn-sidebar" onClick={downloadZip}>
                <Download size={16} /> Download ZIP
              </button>
            )}
          </>
        )}
      </div>

      {/* --- MAIN CANVAS --- */}
      <div className="main-canvas">
        {viewMode === 'playground' ? (
          // MODE A: Live Playground
          <Playground />
        ) : (
          // MODE B: Dashboard Gallery
          selectedFolder ? (
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
              <p>Upload a .py file on the left, or switch to "Live Playground" mode.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default App;