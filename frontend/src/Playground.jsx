import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import { 
  AlertCircle, Loader2, Image as ImageIcon, 
  ZoomIn, ZoomOut, RotateCcw 
} from 'lucide-react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

const Playground = () => {
  // Default code example
  const [code, setCode] = useState(`def process_transaction(amount):
    print("Starting Transaction")
    if amount > 1000:
        print("Large Transaction")
        verify_funds()
    else:
        print("Standard Transaction")
    
    save_to_db()
    return True`);

  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Debounce: Only fetch after user stops typing for 1 second
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFlowchart();
    }, 1000);

    return () => clearTimeout(timer);
  }, [code]);

  const fetchFlowchart = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);

    try {
      // Using 127.0.0.1 to avoid DNS lag
      const response = await axios.post('http://127.0.0.1:8000/preview_flowchart', 
        { code: code }, 
        { responseType: 'blob' }
      );
      
      // Cleanup old URL to avoid memory leaks
      if (imageSrc) URL.revokeObjectURL(imageSrc);

      const url = URL.createObjectURL(response.data);
      setImageSrc(url);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data instanceof Blob) {
        const text = await err.response.data.text();
        try {
          const json = JSON.parse(text);
          setError(json.detail);
        } catch {
          setError("Syntax Error");
        }
      } else {
        setError("Backend not reachable");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="playground-container">
      {/* LEFT: CODE EDITOR */}
      <div className="editor-pane">
        <div className="pane-header">
          <span>Python Input</span>
        </div>
        <Editor
          height="calc(100% - 40px)"
          defaultLanguage="python"
          theme="light" // Will need adjustment if you want it to match Dark Mode exactly
          value={code}
          onChange={(value) => setCode(value || "")}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            scrollBeyondLastLine: false,
            wordWrap: "on",
            automaticLayout: true
          }}
        />
      </div>

      {/* RIGHT: INTERACTIVE PREVIEW */}
      <div className="preview-pane">
        <div className="pane-header">
          <span>Live Flowchart</span>
          {loading && <Loader2 className="spin" size={16} />}
        </div>
        
        <div className="preview-content">
          {error ? (
            <div className="preview-error">
              <AlertCircle size={32} />
              <p>{error}</p>
            </div>
          ) : imageSrc ? (
            // --- ZOOM & PAN WRAPPER ---
            <TransformWrapper
              initialScale={1}
              minScale={0.5}
              maxScale={4}
              centerOnInit={true}
              wheel={{ step: 0.1 }}
            >
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  {/* Floating Controls */}
                  <div className="zoom-controls">
                    <button onClick={() => zoomIn()} title="Zoom In"><ZoomIn size={16}/></button>
                    <button onClick={() => zoomOut()} title="Zoom Out"><ZoomOut size={16}/></button>
                    <button onClick={() => resetTransform()} title="Reset"><RotateCcw size={16}/></button>
                  </div>

                  {/* The Zoomable Canvas */}
                  <TransformComponent 
                    wrapperStyle={{ width: "100%", height: "100%" }}
                    contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <img src={imageSrc} alt="Live Flowchart" className="live-image" />
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
          ) : (
            <div className="preview-placeholder">
              <ImageIcon size={48} color="var(--text-gray)" opacity={0.5} />
              <p>Type code to visualize logic</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Playground;