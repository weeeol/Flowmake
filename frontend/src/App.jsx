import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import JSZip from 'jszip';
import { 
  UploadCloud, Loader2, AlertCircle, Download, 
  Folder, FolderOpen, Image as ImageIcon, ChevronRight,
  Layout, Code, Moon, Sun 
} from 'lucide-react';
import Playground from './Playground';
import { apiUrl } from './api';
import './App.css';

function App() {
  // --- STATE MANAGEMENT ---
  const [viewMode, setViewMode] = useState('dashboard'); // 'dashboard' | 'playground'
  const [darkMode, setDarkMode] = useState(false); // Theme State

  // Dashboard States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [zipBlob, setZipBlob] = useState(null);
  const [folders, setFolders] = useState({}); 
  const [selectedFolder, setSelectedFolder] = useState(null);

  // --- EFFECTS ---

  // 1. Theme Effect: Syncs React state with CSS attributes
  useEffect(() => {
    if (darkMode) {
      document.body.setAttribute('data-theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
    }
  }, [darkMode]);

  // 2. Cleanup Effect: Revoke URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      Object.values(folders).flat().forEach(img => URL.revokeObjectURL(img.src));
    };
  }, [folders]);

  // --- HANDLERS ---

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setViewMode('dashboard');
    setLoading(true);
    setError(null);
    setFolders({});
    setZipBlob(null);
    setSelectedFolder(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(apiUrl('/upload_flowchart_zip'), formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob', 
      });

      setZipBlob(response.data);
      
      const zip = await JSZip.loadAsync(response.data);
      const newFolders = {};
      const promises = [];

      zip.forEach((relativePath, zipEntry) => {
        if (zipEntry.name.endsWith('.png')) {
          const promise = zipEntry.async('blob').then(blob => {
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

  const totalFolders = Object.keys(folders).length;
  const totalCharts = Object.values(folders).reduce((count, items) => count + items.length, 0);

  return (
    <div className="dashboard">
      
      {/* --- SIDEBAR --- */}
      <div className="sidebar">
        <div className="brand">
          <h2>Flow<span className="accent">Make</span></h2>
        </div>

        {/* Navigation */}
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

        {/* Theme Toggle */}
        <button 
          className="theme-btn" 
          onClick={() => setDarkMode(!darkMode)}
          title="Switch Theme"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          <span>{darkMode ? "Light Mode" : "Dark Mode"}</span>
        </button>

        {/* Dashboard Controls */}
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
          <Playground darkMode={darkMode} />
        ) : (
          <div className="canvas-shell">
            <section className="dashboard-hero">
              <div className="hero-copy">
                <p className="eyebrow">Flowchart Studio</p>
                <h1>Turn Python into a map you can scan in seconds.</h1>
                <p>
                  Drop a .py file, review class and function flowcharts, or move into the playground for instant iteration.
                </p>
              </div>

              <div className="hero-stats">
                <div className="stat-card">
                  <span>Folders</span>
                  <strong>{totalFolders}</strong>
                </div>
                <div className="stat-card">
                  <span>Diagrams</span>
                  <strong>{totalCharts}</strong>
                </div>
                <div className="stat-card stat-card-accent">
                  <span>Mode</span>
                  <strong>{darkMode ? 'Night' : 'Day'}</strong>
                </div>
              </div>
            </section>

            {selectedFolder ? (
              <div className="canvas-content">
                <header className="canvas-header">
                  <div>
                    <p className="section-label">Selected folder</p>
                    <h2>{selectedFolder}</h2>
                  </div>
                  <span className="badge">{folders[selectedFolder].length} flowcharts</span>
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
                <div className="welcome-card">
                  <div className="placeholder-art">
                    <UploadCloud size={72} color="var(--border)" />
                  </div>
                  <h2>Ready to visualize?</h2>
                  <p>Upload a .py file on the left, or switch to Live Playground mode to try code instantly.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;