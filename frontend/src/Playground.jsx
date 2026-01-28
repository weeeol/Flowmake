import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import { AlertCircle, Loader2, Image as ImageIcon } from 'lucide-react';

const Playground = () => {
  const [code, setCode] = useState("def calculate_total(price, tax):\n    total = price + (price * tax)\n    if total > 100:\n        print('Expensive!')\n    else:\n        print('Good deal')\n    return total");
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
      const response = await axios.post('http://127.0.0.1:8000/preview_flowchart', 
        { code: code }, 
        { responseType: 'blob' }
      );
      
      const url = URL.createObjectURL(response.data);
      setImageSrc(url);
    } catch (err) {
      console.error(err);
      // Try to read the error message from the blob
      if (err.response && err.response.data instanceof Blob) {
        const text = await err.response.data.text();
        try {
          const json = JSON.parse(text);
          setError(json.detail);
        } catch {
          setError("Syntax Error");
        }
      } else {
        setError("Failed to connect to backend");
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
          theme="light"
          value={code}
          onChange={(value) => setCode(value)}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            scrollBeyondLastLine: false,
            wordWrap: "on"
          }}
        />
      </div>

      {/* RIGHT: PREVIEW */}
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
            <img src={imageSrc} alt="Live Flowchart" className="live-image" />
          ) : (
            <div className="preview-placeholder">
              <ImageIcon size={48} color="#cbd5e1" />
              <p>Type code to see magic</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Playground;