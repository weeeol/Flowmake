import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import { AlertCircle, Loader2, Image as ImageIcon, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { apiUrl } from '../services/api';

const Playground = ({ darkMode }) => {
  const editorRef = useRef(null);
  const [code, setCode] = useState(`def process_transaction(amount):\n    print("Starting Transaction")\n    if amount > 1000:\n        print("Large Transaction")\n        verify_funds()\n    else:\n        print("Standard Transaction")\n    \n    save_to_db()\n    return True`);
  const [svgContent, setSvgContent] = useState(null);
  const [error, setError] = useState(null);
  const [isRendering, setIsRendering] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [shareId, setShareId] = useState(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (id) {
      setShareId(id);
      axios.get(apiUrl(`/snippets/${id}`))
        .then(res => {
          if (res.data && res.data.code) {
            setCode(res.data.code);
          }
        })
        .catch(err => {
          console.error("Failed to load snippet", err);
          setError("Failed to load shared snippet");
        });
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFlowchart();
    }, 1000);
    return () => clearTimeout(timer);
  }, [code]);

  const fetchFlowchart = async () => {
    if (!code.trim()) return;
    setIsRendering(true);
    setError(null);

    try {
      const response = await axios.post(apiUrl('/preview_flowchart'), 
        { code: code, format: 'svg' }, 
        { responseType: 'text' }
      );
      setSvgContent(response.data);
    } catch (err) {
      if (err.response && err.response.data instanceof Blob) {
        const text = await err.response.data.text();
        try {
          const json = JSON.parse(text);
          setError(json.detail || "Error generating flowchart");
        } catch {
          setError("Error generating flowchart");
        }
      } else {
        setError("Network error connecting to backend");
      }
      setSvgContent(null);
    } finally {
      setIsRendering(false);
    }
  };

  const handleSaveSnippet = async () => {
    setIsSaving(true);
    try {
      const response = await axios.post(apiUrl('/snippets'), { code: code });
      const newId = response.data.id;
      setShareId(newId);
      const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + "?id=" + newId;
      window.history.pushState({path:newUrl},'',newUrl);
    } catch (err) {
      console.error(err);
      setError("Failed to save snippet");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSvgClick = (e) => {
    let target = e.target;
    while (target && target.tagName !== 'svg') {
      if (target.id && target.id.startsWith('line-')) {
        const line = parseInt(target.id.split('-')[1]);
        if (!isNaN(line) && editorRef.current) {
          editorRef.current.revealLineInCenter(line);
          editorRef.current.setPosition({ lineNumber: line, column: 1 });
          editorRef.current.focus();
        }
        break;
      }
      target = target.parentNode;
    }
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
  };

  return (
    <div className="playground-container">
      {/* LEFT: CODE EDITOR */}
      <div className="pg-sidebar">
        <div className="pg-header">
          <h3>Python Input</h3>
          {isRendering && <Loader2 className="spin" size={14} color="var(--text-muted)" />}
        </div>
        <div className="editor-wrapper">
          <Editor
            height="100%"
            defaultLanguage="python"
            theme={darkMode ? 'vs-dark' : 'light'}
            value={code}
            onChange={(value) => setCode(value || "")}
            onMount={handleEditorDidMount}
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
        ) : svgContent ? (
          <TransformWrapper initialScale={1} minScale={0.5} maxScale={4} centerOnInit={true} wheel={{ step: 0.1 }}>
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                <div className="canvas-controls">
                  <button className="control-btn" onClick={() => zoomIn()} title="Zoom In"><ZoomIn size={16}/></button>
                  <button className="control-btn" onClick={() => zoomOut()} title="Zoom Out"><ZoomOut size={16}/></button>
                  <button className="control-btn" onClick={() => resetTransform()} title="Reset"><RotateCcw size={16}/></button>
                  <div style={{width: '1px', height: '16px', backgroundColor: 'var(--border-color)', margin: '0 4px'}}></div>
                  <button className="control-btn" onClick={handleSaveSnippet} title="Save & Share" disabled={isSaving}>
                    {isSaving ? "Saving..." : (shareId ? "Saved" : "Share")}
                  </button>
                  <div style={{width: '1px', height: '16px', backgroundColor: 'var(--border-color)', margin: '0 4px'}}></div>
                  <button className="control-btn" onClick={() => {
                    const blob = new Blob([svgContent], {type: "image/svg+xml"});
                    const url = URL.createObjectURL(blob);
                    window.open(url, '_blank');
                  }} title="Open SVG">SVG</button>
                </div>
                <TransformComponent 
                  wrapperStyle={{ width: "100%", height: "100%" }}
                  contentStyle={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}
                >
                  {svgContent ? (
                    <div 
                      className="flowchart-svg-container"
                      dangerouslySetInnerHTML={{ __html: svgContent }}
                      onClick={handleSvgClick}
                      style={{ maxWidth: '100%', maxHeight: '100%', cursor: 'pointer' }}
                    />
                  ) : (
                    <div className="empty-state">
                      <ImageIcon size={48} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '16px' }} />
                      <p>Flowchart will appear here</p>
                    </div>
                  )}
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