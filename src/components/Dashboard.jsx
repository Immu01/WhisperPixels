import React, { useState, useEffect, useRef } from 'react';
import StegoVisualizer from './StegoVisualizer';
import { hashKey, encryptDecryptMessage, serializePayload, deserializePayload, bytesToString, stringToBytes } from '../utils/cryptoHelpers';
import { encodeImage, decodeImage } from '../utils/imageStego';
import { encodeAudio, decodeAudio } from '../utils/audioStego';
import { encodeVideo, decodeVideo } from '../utils/videoStego';
import { encodeText, decodeText } from '../utils/textStego';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('encrypt'); // 'encrypt' or 'decrypt'
  const [mediaType, setMediaType] = useState('image'); // 'image', 'audio', 'video', 'text'
  const [file, setFile] = useState(null);
  
  // Encrypt Form Inputs
  const [secretMessage, setSecretMessage] = useState('');
  const [encryptKey, setEncryptKey] = useState('');
  const [hint, setHint] = useState('');
  
  // Decrypt Form Inputs/State
  const [scanStatus, setScanStatus] = useState('idle'); // 'idle', 'scanning', 'found', 'not_found', 'error'
  const [extractedHint, setExtractedHint] = useState('');
  const [decryptKey, setDecryptKey] = useState('');
  const [storedPayload, setStoredPayload] = useState(null); // { keyHash, hint, encryptedMessage }
  const [decryptedMessage, setDecryptedMessage] = useState('');
  
  // Shared UI Feedback
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Drag and Drop Overlay State
  const [dragActive, setDragActive] = useState(false);
  const dragCounter = useRef(0);
  
  const fileInputRef = useRef(null);
  const decryptKeyRef = useRef(null);

  // Determine media type from file extension/type
  const getMediaType = (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    const type = file.type;
    
    if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'bmp', 'webp'].includes(ext)) {
      return 'image';
    }
    if (type.startsWith('audio/') || ['wav', 'mp3', 'ogg', 'm4a', 'flac'].includes(ext)) {
      return 'audio';
    }
    if (type.startsWith('video/') || ['mp4', 'mkv', 'avi', 'webm', 'mov'].includes(ext)) {
      return 'video';
    }
    if (type.startsWith('text/') || ['txt', 'md', 'html', 'css', 'js', 'json'].includes(ext)) {
      return 'text';
    }
    return null;
  };

  // Process and validate uploaded file
  const handleFileChange = (uploadedFile) => {
    if (!uploadedFile) return;
    
    setErrorMsg('');
    setSuccessMsg('');
    setDecryptedMessage('');
    setDecryptKey('');
    
    const detectedType = getMediaType(uploadedFile);
    if (!detectedType) {
      setErrorMsg('Unsupported file type. Please upload an Image, Audio, Video, or Text file.');
      return;
    }
    
    setFile(uploadedFile);
    setMediaType(detectedType);
    
    // If in decrypt tab, scan automatically
    if (activeTab === 'decrypt') {
      triggerScan(uploadedFile, detectedType);
    }
  };

  // Perform automatic stego scan
  const triggerScan = async (uploadedFile, type) => {
    setScanStatus('scanning');
    setStoredPayload(null);
    setExtractedHint('');
    
    try {
      let rawPayload = null;
      if (type === 'image') {
        rawPayload = await decodeImage(uploadedFile);
      } else if (type === 'audio') {
        rawPayload = await decodeAudio(uploadedFile);
      } else if (type === 'video') {
        rawPayload = await decodeVideo(uploadedFile);
      } else if (type === 'text') {
        rawPayload = await decodeText(uploadedFile);
      }
      
      if (!rawPayload) {
        setScanStatus('not_found');
        return;
      }
      
      const deserialized = deserializePayload(rawPayload);
      setStoredPayload(deserialized);
      setExtractedHint(deserialized.hint);
      setScanStatus('found');
      
      // Auto-focus decrypt key input
      setTimeout(() => {
        if (decryptKeyRef.current) {
          decryptKeyRef.current.focus();
        }
      }, 100);
      
    } catch (err) {
      console.error(err);
      // If magic parsing fails or format errors, it simply means no payload is present
      setScanStatus('not_found');
    }
  };

  // Perform encryption and download
  const handleEncryptSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!file || !secretMessage || !encryptKey) {
      setErrorMsg('Please upload a file, enter a secret message, and provide a security key.');
      return;
    }
    
    setErrorMsg('');
    setSuccessMsg('');
    setProcessing(true);
    
    try {
      // 1. Prepare payload
      const keyHash = await hashKey(encryptKey);
      const encryptedMsgBytes = await encryptDecryptMessage(stringToBytes(secretMessage), encryptKey);
      const payload = serializePayload(keyHash, hint, encryptedMsgBytes);
      
      // 2. Hide in file
      let outputBlob = null;
      if (mediaType === 'image') {
        outputBlob = await encodeImage(file, payload);
      } else if (mediaType === 'audio') {
        outputBlob = await encodeAudio(file, payload);
      } else if (mediaType === 'video') {
        outputBlob = await encodeVideo(file, payload);
      } else if (mediaType === 'text') {
        outputBlob = await encodeText(file, payload);
      }
      
      if (!outputBlob) {
        throw new Error('Encryption failed. No output generated.');
      }
      
      // 3. Trigger download maintaining original name and structure
      const url = URL.createObjectURL(outputBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setSuccessMsg('Secret message successfully embedded! Your download has started.');
      
      // Reset form
      setSecretMessage('');
      setEncryptKey('');
      setHint('');
      setFile(null);
    } catch (err) {
      setErrorMsg(err.message || 'An error occurred during steganographic encoding.');
    } finally {
      setProcessing(false);
    }
  };

  // Perform key validation and decryption
  const handleDecryptSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!decryptKey || !storedPayload) return;
    
    setErrorMsg('');
    setDecryptedMessage('');
    setProcessing(true);
    
    try {
      const userHash = await hashKey(decryptKey);
      
      // Compare hashes safely
      let match = userHash.length === storedPayload.keyHash.length;
      for (let i = 0; i < userHash.length; i++) {
        if (userHash[i] !== storedPayload.keyHash[i]) {
          match = false;
        }
      }
      
      if (!match) {
        setErrorMsg('Incorrect key. Key validation failed.');
        setProcessing(false);
        return;
      }
      
      const decryptedBytes = await encryptDecryptMessage(storedPayload.encryptedMessage, decryptKey);
      const message = bytesToString(decryptedBytes);
      setDecryptedMessage(message);
      setSuccessMsg('Key validated! Hidden message unlocked.');
    } catch (err) {
      setErrorMsg('Failed to decrypt message. Make sure key is correct.');
    } finally {
      setProcessing(false);
    }
  };

  // Reset current state/file
  const handleReset = () => {
    setFile(null);
    setSecretMessage('');
    setEncryptKey('');
    setHint('');
    setScanStatus('idle');
    setStoredPayload(null);
    setExtractedHint('');
    setDecryptKey('');
    setDecryptedMessage('');
    setErrorMsg('');
    setSuccessMsg('');
  };

  // Global Keyboard listener (Escape & Enter triggers)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        // Escape closes/cancels in-progress action or clears file
        if (file) {
          handleReset();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [file]);

  // Global drag-and-drop event handlers
  useEffect(() => {
    const handleDragEnter = (e) => {
      e.preventDefault();
      dragCounter.current++;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setDragActive(true);
      }
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      dragCounter.current--;
      if (dragCounter.current === 0) {
        setDragActive(false);
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
    };

    const handleDrop = (e) => {
      e.preventDefault();
      setDragActive(false);
      dragCounter.current = 0;
      
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileChange(e.dataTransfer.files[0]);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    
    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [activeTab]);

  // When switching tabs, automatically run auto-scan if file is already loaded
  useEffect(() => {
    if (file && activeTab === 'decrypt') {
      triggerScan(file, mediaType);
    } else if (activeTab === 'encrypt') {
      setScanStatus('idle');
      setStoredPayload(null);
      setExtractedHint('');
      setDecryptKey('');
      setDecryptedMessage('');
    }
  }, [activeTab]);

  return (
    <div className="dashboard-container">
      {/* Global Drag Overlay */}
      <div className={`global-drag-overlay ${dragActive ? 'active' : ''}`}>
        <div className="global-drag-box">
          <svg className="dropzone-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <h2>Drop your file anywhere to upload</h2>
          <p style={{ color: 'var(--text-muted)' }}>WhisperPixels will automatically configure the stego carrier space.</p>
        </div>
      </div>

      {/* Left workspace Card */}
      <div className="panel-card">
        {/* Toggle Mode */}
        <div className="tab-group" role="tablist">
          <button 
            role="tab"
            aria-selected={activeTab === 'encrypt'}
            className={`tab-btn ${activeTab === 'encrypt' ? 'active' : ''}`}
            onClick={() => setActiveTab('encrypt')}
          >
            Encrypt & Hide
          </button>
          <button 
            role="tab"
            aria-selected={activeTab === 'decrypt'}
            className={`tab-btn ${activeTab === 'decrypt' ? 'active' : ''}`}
            onClick={() => setActiveTab('decrypt')}
          >
            Decrypt & Reveal
          </button>
        </div>

        {/* Info alerts */}
        {errorMsg && (
          <div className="alert alert-error" role="alert">
            <span className="alert-title">Operation Error</span>
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="alert alert-success" role="alert">
            <span className="alert-title">Success</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* File Selection / Carrier Configuration */}
        {!file ? (
          <div className="form-group">
            <span className="form-label">Configure Carrier Carrier</span>
            
            <div 
              className="dropzone"
              onClick={() => fileInputRef.current.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current.click(); }}
              tabIndex={0}
              role="button"
              aria-label="Upload carrier file. Select to browse or drag and drop files anywhere on the page."
            >
              <input 
                ref={fileInputRef}
                type="file" 
                style={{ display: 'none' }} 
                onChange={(e) => handleFileChange(e.target.files[0])}
              />
              <svg className="dropzone-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <div>
                <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>Select file or drag here</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Supports Image, Audio, Video, and Text
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* File Loaded State Card */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-subtle)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ padding: '8px', background: 'var(--color-primary)', color: 'white', borderRadius: '8px', display: 'flex' }}>
                  {mediaType === 'image' && (
                    <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                  {mediaType === 'audio' && (
                    <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  )}
                  {mediaType === 'video' && (
                    <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                  {mediaType === 'text' && (
                    <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                </div>
                <div>
                  <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{file.name}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Carrier Format: {mediaType.toUpperCase()}
                  </p>
                </div>
              </div>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                onClick={handleReset}
                title="Cancel file and reload"
              >
                Reset
              </button>
            </div>
            
            {/* Decrypt flow header alerts */}
            {activeTab === 'decrypt' && (
              <div>
                {scanStatus === 'scanning' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-muted)', padding: '12px 0' }}>
                    <div className="spinner" />
                    <span>Analyzing carrier bit structures...</span>
                  </div>
                )}
                {scanStatus === 'not_found' && (
                  <div className="alert alert-warning" role="status">
                    <span className="alert-title">No Payload Found</span>
                    <span>WhisperPixels could not identify any steganographic container signatures in this file.</span>
                  </div>
                )}
                {scanStatus === 'found' && (
                  <div className="alert alert-success" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }} role="status">
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', animation: 'bit-pulse 1.5s infinite' }} />
                    <div style={{ flex: 1 }}>
                      <span className="alert-title" style={{ fontSize: '0.9rem', display: 'block' }}>Stego Payload Detected</span>
                      <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>This container matches WhisperPixels signature formats.</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 1: ENCRYPT CONTROLS */}
        {activeTab === 'encrypt' && file && (
          <form className="form-group" onSubmit={handleEncryptSubmit} style={{ gap: '20px' }}>
            <div className="form-group">
              <label htmlFor="secret-message" className="form-label">Secret Message</label>
              <textarea 
                id="secret-message"
                className="text-input" 
                placeholder="Enter the private message to hide..."
                value={secretMessage}
                onChange={(e) => setSecretMessage(e.target.value)}
                required
                disabled={processing}
              />
            </div>

            <div className="form-group">
              <label htmlFor="encrypt-key" className="form-label">Security Key (Passphrase)</label>
              <input 
                id="encrypt-key"
                type="password" 
                className="text-input code-font" 
                placeholder="Required to decrypt later"
                value={encryptKey}
                onChange={(e) => setEncryptKey(e.target.value)}
                required
                disabled={processing}
              />
            </div>

            <div className="form-group">
              <label htmlFor="hint" className="form-label">Hint (Optional)</label>
              <input 
                id="hint"
                type="text" 
                className="text-input" 
                placeholder="Clue shown before key entry"
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                disabled={processing}
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={processing || !secretMessage || !encryptKey}
              style={{ marginTop: '8px' }}
            >
              {processing ? (
                <>
                  <div className="spinner" style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#fff', width: '16px', height: '16px' }} />
                  <span>Embedding...</span>
                </>
              ) : 'Encrypt & Download'}
            </button>
          </form>
        )}

        {/* Tab 2: DECRYPT CONTROLS */}
        {activeTab === 'decrypt' && file && scanStatus === 'found' && storedPayload && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Display hint if there is one */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', background: 'var(--bg-subtle)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
                Clue / Hint
              </span>
              <p style={{ fontWeight: 500, fontStyle: extractedHint ? 'normal' : 'italic', color: extractedHint ? 'var(--text-main)' : 'var(--text-muted)' }}>
                {extractedHint || 'No hint was provided for this payload.'}
              </p>
            </div>

            {!decryptedMessage ? (
              <form className="form-group" onSubmit={handleDecryptSubmit} style={{ gap: '16px' }}>
                <div className="form-group">
                  <label htmlFor="decrypt-key" className="form-label">Unlock Passphrase</label>
                  <input 
                    ref={decryptKeyRef}
                    id="decrypt-key"
                    type="password" 
                    className="text-input code-font" 
                    placeholder="Enter security key to decrypt"
                    value={decryptKey}
                    onChange={(e) => setDecryptKey(e.target.value)}
                    required
                    disabled={processing}
                  />
                </div>
                
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={processing || !decryptKey}
                >
                  {processing ? (
                    <>
                      <div className="spinner" style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#fff', width: '16px', height: '16px' }} />
                      <span>Validating Key...</span>
                    </>
                  ) : 'Unlock Secret'}
                </button>
              </form>
            ) : (
              /* Decrypted result */
              <div className="form-group" style={{ gap: '12px' }}>
                <span className="form-label" style={{ color: '#10b981' }}>✓ Decrypted Hidden Message</span>
                <div style={{ padding: '20px', background: '#fafafa', border: '1px solid #10b981', borderRadius: '12px', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', minHeight: '100px', fontSize: '1.05rem', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.05)' }}>
                  {decryptedMessage}
                </div>
                <button 
                  className="btn btn-secondary" 
                  style={{ marginTop: '8px' }}
                  onClick={() => {
                    setDecryptedMessage('');
                    setDecryptKey('');
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                >
                  Lock Again
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right analyzer pane */}
      <StegoVisualizer 
        file={file} 
        mediaType={mediaType} 
        hasPayload={scanStatus === 'found'} 
      />
    </div>
  );
}
