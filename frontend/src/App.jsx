import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import JSZip from 'jszip';
import { 
  UploadCloud, Loader2, AlertCircle, Download, 
  Folder, FolderOpen, Image as ImageIcon, ChevronRight,
  Layout, Code, Moon, Sun, X, ZoomIn, ZoomOut, RotateCcw 
} from 'lucide-react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import Playground from './components/Playground';
import { apiUrl } from './services/api';
import './App.css';

function App() {
  const [viewMode, setViewMode] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [zipBlob, setZipBlob] = useState(null);
  const [folders, setFolders] = useState({}); 
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [expandedImage, setExpandedImage] = useState(null);

  useEffect(() => {
    if (darkMode) {
      document.body.setAttribute('data-theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
    }
  }, [darkMode]);

  useEffect(() => {
    return () => {
      Object.values(folders).flat().forEach(img => URL.revokeObjectURL(img.src));
    };
  }, [folders]);

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
      setError("Failed to process file. Check backend connection.");
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
      
      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="brand">
          <h2>Flow<span className="accent">Make</span></h2>
        </div>

        <div className="nav-buttons">
          <button 
            className={`nav-btn ${viewMode === 'dashboard' ? 'active' : ''}`}
            onClick={() => setViewMode('dashboard')}
          >
            <Layout size={16} /> Dashboard
          </button>
          <button 
            className={`nav-btn ${viewMode === 'playground' ? 'active' : ''}`}
            onClick={() => setViewMode('playground')}
          >
            <Code size={16} /> Playground
          </button>
        </div>

        {viewMode === 'dashboard' && (
          <>
            <div {...getRootProps()} className={`mini-dropzone ${isDragActive ? 'active' : ''}`}>
              <input {...getInputProps()} />
              {loading ? <Loader2 className="spin" size={20} /> : <UploadCloud size={20} />}
              <span>{loading ? "Processing..." : "Drop .py file"}</span>
            </div>

            {error && <div className="error-msg" style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', gap: '8px', alignItems: 'center' }}><AlertCircle size={14}/> {error}</div>}

            <div className="folder-list">
              <h3>Structure</h3>
              {Object.keys(folders).length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingLeft: '14px' }}>No modules loaded.</p>}
              
              {Object.keys(folders).map(folderName => (
                <button 
                  key={folderName} 
                  className={`folder-item ${selectedFolder === folderName ? 'active' : ''}`}
                  onClick={() => setSelectedFolder(folderName)}
                >
                  {selectedFolder === folderName ? <FolderOpen size={16} /> : <Folder size={16} />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folderName}</span>
                  <span className="count">{folders[folderName].length}</span>
                  {selectedFolder === folderName && <ChevronRight className="indicator" size={14} />}
                </button>
              ))}
            </div>

            {zipBlob && (
              <button className="download-btn-sidebar" onClick={downloadZip}>
                <Download size={14} /> Export ZIP
              </button>
            )}
          </>
        )}

        <button 
          className="theme-btn" 
          onClick={() => setDarkMode(!darkMode)}
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          <span>{darkMode ? "Light" : "Dark"}</span>
        </button>
      </div>

      {/* MAIN CANVAS */}
      <div className="main-canvas">
        {viewMode === 'playground' ? (
          <Playground darkMode={darkMode} />
        ) : (
          <div className="canvas-shell">
            <section className="dashboard-hero">
              <div className="hero-copy">
                <p className="eyebrow">Studio</p>
                <h1>Visualize Python logic.</h1>
                <p>
                  Analyze entire files and instantly generate flowcharts for every function and class method.
                </p>
              </div>

              <div className="hero-stats">
                <div className="stat-card">
                  <span>Modules</span>
                  <strong>{totalFolders}</strong>
                </div>
                <div className="stat-card">
                  <span>Diagrams</span>
                  <strong>{totalCharts}</strong>
                </div>
              </div>
            </section>

            {selectedFolder ? (
              <div className="canvas-content">
                <header className="canvas-header">
                  <div>
                    <p className="section-label">Module</p>
                    <h2>{selectedFolder}</h2>
                  </div>
                  <span className="badge">{folders[selectedFolder].length} Flowcharts</span>
                </header>

                <div className="masonry-grid">
                  {folders[selectedFolder].map((img, idx) => (
                    <div key={idx} className="chart-card" onClick={() => setExpandedImage(img)}>
                      <div className="card-top">
                        <ImageIcon size={14} color="var(--text-muted)" /> {img.name}
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
                    <UploadCloud size={48} strokeWidth={1} />
                  </div>
                  <p>Drop a Python file to begin.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* EXPANDED IMAGE MODAL */}
      {expandedImage && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setExpandedImage(null)}>
          <div className="modal-content">
            <button className="modal-close" onClick={() => setExpandedImage(null)}>
              <X size={16} />
            </button>
            <TransformWrapper initialScale={1} minScale={0.5} maxScale={4} centerOnInit={true} wheel={{ step: 0.1 }}>
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  <div className="canvas-controls" style={{ bottom: '24px', right: '24px' }}>
                    <button className="control-btn" onClick={() => zoomIn()} title="Zoom In"><ZoomIn size={16}/></button>
                    <button className="control-btn" onClick={() => zoomOut()} title="Zoom Out"><ZoomOut size={16}/></button>
                    <button className="control-btn" onClick={() => resetTransform()} title="Reset"><RotateCcw size={16}/></button>
                    <div style={{width: '1px', height: '16px', backgroundColor: 'var(--border-color)', margin: '0 4px'}}></div>
                    <button className="control-btn" onClick={() => window.open(expandedImage.src, '_blank')} title="Open PNG">PNG</button>
                  </div>
                  <TransformComponent 
                    wrapperStyle={{ width: "100%", height: "100%" }}
                    contentStyle={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center", padding: '40px' }}
                  >
                    <img 
                      src={expandedImage.src} 
                      alt={expandedImage.name} 
                      style={{ 
                        maxWidth: "100%", 
                        maxHeight: "100%", 
                        objectFit: "contain", 
                        filter: darkMode ? "invert(0.9) hue-rotate(180deg)" : "none" 
                      }} 
                    />
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;