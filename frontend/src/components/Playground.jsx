import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import { AlertCircle, Loader2, Image as ImageIcon, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { apiUrl } from '../services/api';

const Playground = ({ darkMode }) => {
  const [code, setCode] = useState(`def process_transaction(amount):\n    print("Starting Transaction")\n    if amount > 1000:\n        print("Large Transaction")\n        verify_funds()\n    else:\n        print("Standard Transaction")\n    \n    save_to_db()\n    return True`);
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
      const response = await axios.post(apiUrl('/preview_flowchart'), 
        { code: code }, 
        { responseType: 'blob' }
      );
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
      <div className="pg-sidebar">
        <div className="pg-header">
          <h3>Python Input</h3>
          {loading && <Loader2 className="spin" size={14} color="var(--text-muted)" />}
        </div>
        <div className="editor-wrapper">
          <Editor
            height="100%"
            defaultLanguage="python"
            theme={darkMode ? 'vs-dark' : 'light'}
            value={code}
            onChange={(value) => setCode(value || "")}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: 'JetBrains Mono',
              scrollBeyondLastLine: false,
              wordWrap: "on",
              padding: { top: 16 },
              automaticLayout: true
            }}
          />
        </div>
      </div>

      {/* RIGHT: INTERACTIVE PREVIEW */}
      <div className="pg-canvas">
        {error ? (
          <div className="empty-canvas">
            <AlertCircle size={32} color="var(--text-secondary)" />
            <p>{error}</p>
          </div>
        ) : imageSrc ? (
          <TransformWrapper initialScale={1} minScale={0.5} maxScale={4} centerOnInit={true} wheel={{ step: 0.1 }}>
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                <div className="canvas-controls">
                  <button className="control-btn" onClick={() => zoomIn()} title="Zoom In"><ZoomIn size={16}/></button>
                  <button className="control-btn" onClick={() => zoomOut()} title="Zoom Out"><ZoomOut size={16}/></button>
                  <button className="control-btn" onClick={() => resetTransform()} title="Reset"><RotateCcw size={16}/></button>
                </div>
                <TransformComponent 
                  wrapperStyle={{ width: "100%", height: "100%" }}
                  contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <img src={imageSrc} alt="Live Flowchart" style={{ maxWidth: '100%', height: 'auto', padding: '40px' }} />
                </TransformComponent>
              </>
            )}
          </TransformWrapper>
        ) : (
          <div className="empty-canvas">
            <ImageIcon size={32} color="var(--border-color)" />
            <p>Type code to visualize logic</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Playground;