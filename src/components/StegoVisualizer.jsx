import React, { useEffect, useRef, useState } from 'react';
import { parseWav } from '../utils/audioStego';

export default function StegoVisualizer({ file, mediaType, hasPayload }) {
  const canvasRef = useRef(null);
  const audioCtxRef = useRef(null);
  const [bitplaneMode, setBitplaneMode] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [audioSrc, setAudioSrc] = useState(null);
  const [videoSrc, setVideoSrc] = useState(null);
  const [textContent, setTextContent] = useState('');
  const [textStats, setTextStats] = useState({ total: 0, visible: 0, hidden: 0 });
  const [wavWaveform, setWavWaveform] = useState([]);
  
  // Ambient background animation for idle state
  useEffect(() => {
    if (file) return; // Disable ambient animation when file is loaded
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let animationId;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);
    
    const cols = Math.floor(width / 30) + 1;
    const ypos = Array(cols).fill(0);
    const chars = ['0', '1'];

    const draw = () => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(0, 0, width, height);
      
      ctx.fillStyle = '#a1a1a6';
      ctx.font = '10px monospace';
      
      ypos.forEach((y, ind) => {
        const text = chars[Math.floor(Math.random() * chars.length)];
        const x = ind * 30;
        ctx.fillText(text, x, y);
        
        if (y > 100 + Math.random() * 10000) {
          ypos[ind] = 0;
        } else {
          ypos[ind] = y + 12;
        }
      });
    };
    
    const tick = () => {
      draw();
      animationId = requestAnimationFrame(tick);
    };
    
    tick();
    
    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, [file]);

  // Load and prepare file content for visualizer based on mediaType
  useEffect(() => {
    if (!file) {
      setImageSrc(null);
      setAudioSrc(null);
      setVideoSrc(null);
      setTextContent('');
      setWavWaveform([]);
      return;
    }

    const loadFile = async () => {
      if (mediaType === 'image') {
        const url = URL.createObjectURL(file);
        setImageSrc(url);
        setBitplaneMode(false);
      } else if (mediaType === 'audio') {
        const url = URL.createObjectURL(file);
        setAudioSrc(url);
        
        // Try parsing WAV waveform
        try {
          const buffer = await file.arrayBuffer();
          const parsed = parseWav(buffer);
          const samples = new Int16Array(
            parsed.dataBytes.buffer,
            parsed.dataBytes.byteOffset,
            Math.floor(parsed.dataBytes.byteLength / 2)
          );
          
          // Downsample to 120 points
          const step = Math.floor(samples.length / 120) || 1;
          const points = [];
          for (let i = 0; i < samples.length; i += step) {
            points.push(Math.abs(samples[i]) / 32768);
          }
          setWavWaveform(points);
        } catch (e) {
          // If not WAV (e.g. MP3), generate pseudo-random waveform for display
          const points = [];
          for (let i = 0; i < 120; i++) {
            points.push(0.15 + Math.random() * 0.6);
          }
          setWavWaveform(points);
        }
      } else if (mediaType === 'video') {
        const url = URL.createObjectURL(file);
        setVideoSrc(url);
      } else if (mediaType === 'text') {
        const text = await file.text();
        setTextContent(text);
        
        // Calculate counts
        const total = text.length;
        let hidden = 0;
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          if (char === '\u200B' || char === '\u200C' || char === '\u200D') {
            hidden++;
          }
        }
        setTextStats({
          total,
          visible: total - hidden,
          hidden
        });
      }
    };

    loadFile();

    return () => {
      if (imageSrc) URL.revokeObjectURL(imageSrc);
      if (audioSrc) URL.revokeObjectURL(audioSrc);
      if (videoSrc) URL.revokeObjectURL(videoSrc);
    };
  }, [file, mediaType]);

  // Handle Bit-Plane analysis drawing on a canvas
  const canvasImageRef = useRef(null);
  useEffect(() => {
    if (mediaType !== 'image' || !imageSrc || !bitplaneMode) return;
    
    const canvas = canvasImageRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      
      // Keep only LSB of RGB channels
      for (let i = 0; i < data.length; i += 4) {
        data[i] = (data[i] & 1) ? 255 : 0;       // Red LSB
        data[i + 1] = (data[i + 1] & 1) ? 255 : 0; // Green LSB
        data[i + 2] = (data[i + 2] & 1) ? 255 : 0; // Blue LSB
        // Alpha stays 255
        data[i + 3] = 255;
      }
      
      ctx.putImageData(imgData, 0, 0);
    };
    img.src = imageSrc;
  }, [mediaType, imageSrc, bitplaneMode]);

  // Render the Zero-Width text payload visualization
  const renderTextBlocks = () => {
    const elements = [];
    let count = 0;
    
    for (let i = 0; i < textContent.length; i++) {
      const char = textContent[i];
      if (char === '\u200B') {
        elements.push(
          <span key={`zw-${i}`} className="char-box hidden-payload" title="Zero Width Space (bit 0)">
            ₀
          </span>
        );
        count++;
      } else if (char === '\u200C') {
        elements.push(
          <span key={`zw-${i}`} className="char-box hidden-payload" title="Zero Width Non-Joiner (bit 1)">
            ₁
          </span>
        );
        count++;
      } else if (char === '\u200D') {
        elements.push(
          <span key={`zw-${i}`} className="char-box hidden-payload" style={{ backgroundColor: '#002266', color: '#66aaff' }} title="Zero Width Joiner (Boundary)">
            |
          </span>
        );
        count++;
      } else {
        // Only render first 400 characters to prevent DOM freeze
        if (elements.length < 500) {
          elements.push(
            <span key={`normal-${i}`} className="char-box" style={{ background: '#1c1c1f', color: '#a1a1a6' }}>
              {char.trim() === '' ? '␣' : char}
            </span>
          );
        }
      }
      
      // Stop rendering characters if text is extremely long, just show summary
      if (elements.length >= 600) {
        elements.push(
          <span key="overflow" style={{ gridColumn: '1 / -1', padding: '8px', color: 'var(--text-muted)' }}>
            ... + {textContent.length - i} characters truncated
          </span>
        );
        break;
      }
    }
    
    return elements;
  };

  return (
    <div className="visualizer-card">
      <div className="visualizer-title">
        <span>Carrier Analyzer</span>
        {file && (
          <span className="file-meta-badge">
            {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </span>
        )}
      </div>

      <div className="visualizer-preview-container">
        {!file && (
          <>
            <canvas ref={canvasRef} className="ambient-dots-canvas" />
            <div style={{ zIndex: 1, textAlign: 'center', padding: '40px' }}>
              <p style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                Signal Space Monitor
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Upload a file to scan its physical binary payload channels.
              </p>
            </div>
          </>
        )}

        {file && mediaType === 'image' && (
          <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {bitplaneMode ? (
              <canvas ref={canvasImageRef} style={{ maxWidth: '100%', maxHeight: '320px', objectFit: 'contain', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
            ) : (
              <img src={imageSrc} alt="Carrier" style={{ maxWidth: '100%', maxHeight: '320px', objectFit: 'contain', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
            )}
          </div>
        )}

        {file && mediaType === 'audio' && (
          <div style={{ width: '100%', textAlign: 'center', padding: '0 20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '3px', height: '120px', marginBottom: '24px' }}>
              {wavWaveform.map((val, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    flex: 1, 
                    height: `${val * 100}%`, 
                    backgroundColor: hasPayload && idx < 32 ? '#22c55e' : '#a1a1a6', 
                    borderRadius: '1px',
                    transition: 'height 0.3s ease'
                  }}
                  title={hasPayload && idx < 32 ? "Stego bits embedded here" : "Audio Sample data"}
                />
              ))}
            </div>
            {audioSrc && (
              <audio src={audioSrc} controls style={{ width: '100%', maxWidth: '400px' }} />
            )}
          </div>
        )}

        {file && mediaType === 'video' && (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '16px' }}>
            {videoSrc && (
              <video src={videoSrc} controls style={{ maxWidth: '100%', maxHeight: '240px', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
            )}
            {hasPayload && (
              <div className="alert alert-success" style={{ width: '100%', maxWidth: '400px', fontSize: '0.85rem', padding: '10px 16px' }}>
                <span className="alert-title">Carrier Tagged</span>
                <span>Signature index identified at file end block: EOF - 9 bytes.</span>
              </div>
            )}
          </div>
        )}

        {file && mediaType === 'text' && (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>Unicode Character Bit-Matrix</p>
            <div className="character-grid">
              {renderTextBlocks()}
            </div>
          </div>
        )}
      </div>

      {file && (
        <div className="visualizer-controls">
          {mediaType === 'image' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 600 }}>Bit-Plane Analyzer</span>
                <span style={{ color: 'var(--text-muted)' }}>{bitplaneMode ? 'LSB 0th Plane' : 'Normal RGB view'}</span>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Normal</span>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  value={bitplaneMode ? 1 : 0} 
                  onChange={(e) => setBitplaneMode(e.target.value === '1')}
                  className="bitplane-slider"
                  aria-label="Toggle bit-plane analyzer mode"
                />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#10b981' }}>LSB Mode</span>
              </div>
            </div>
          )}

          {mediaType === 'text' && (
            <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Visible chars:</span>{' '}
                <strong style={{ fontFamily: 'var(--font-mono)' }}>{textStats.visible}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Hidden marker bytes:</span>{' '}
                <strong style={{ fontFamily: 'var(--font-mono)', color: textStats.hidden > 0 ? '#10b981' : 'inherit' }}>
                  {textStats.hidden > 0 ? Math.floor(textStats.hidden / 8) : 0}
                </strong>
              </div>
            </div>
          )}

          {mediaType === 'audio' && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              {hasPayload ? (
                <span style={{ color: '#10b981', fontWeight: 600 }}>✓ LSB structures detected in sample bitstream</span>
              ) : (
                <span>No active modification detected in sample waveform.</span>
              )}
            </div>
          )}

          {mediaType === 'video' && !hasPayload && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              <span>Clean frame sequence container. Ready for signature injection.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
