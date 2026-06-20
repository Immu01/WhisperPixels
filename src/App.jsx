import React, { useState, useEffect, useRef } from 'react';
import IntroScreen from './components/IntroScreen';
import Dashboard from './components/Dashboard';
import Typewriter from './components/Typewriter';

// Import stego illustrations
import imageStegoImg from './assets/image_stego_graphic.jpg';
import audioStegoImg from './assets/audio_stego_graphic.jpg';
import videoStegoImg from './assets/video_stego_graphic.jpg';
import textStegoImg from './assets/text_stego_graphic.jpg';

export default function App() {
  const [progress, setProgress] = useState(0);
  const [introActive, setIntroActive] = useState(true);
  const [introDone, setIntroDone] = useState(false);
  const [showVault, setShowVault] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  
  const titleRef = useRef(null);
  const slidesContainerRef = useRef(null);

  const handleIntroFinish = () => {
    setIntroDone(true);
    setTimeout(() => {
      setIntroActive(false);
    }, 1500);
  };

  // Observe scrolling to determine active slide
  useEffect(() => {
    if (!introDone || showVault) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute('data-slide-index'), 10);
            setActiveSlide(index);
          }
        });
      },
      { threshold: 0.6 } // Slide is active if 60% is visible
    );

    const slides = document.querySelectorAll('.slide-section');
    slides.forEach((slide) => observer.observe(slide));

    return () => {
      slides.forEach((slide) => observer.unobserve(slide));
    };
  }, [introDone, showVault]);

  // Determine classes for title transition
  const getTitleClass = () => {
    if (showVault) return 'dashboard'; // Top-left header
    if (activeSlide === 0) {
      return `intro ${introDone ? 'slide-up' : ''}`;
    }
    return 'hidden-logo'; // Faded out
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-light)', position: 'relative' }}>
      {/* Intro laser and spark canvas */}
      {introActive && (
        <IntroScreen 
          onFinish={handleIntroFinish} 
          progress={progress} 
          setProgress={setProgress} 
          titleRef={titleRef} 
        />
      )}

      {/* Shared Smart Metallic Title Container */}
      <div 
        ref={titleRef} 
        className={`header-title-container ${getTitleClass()}`}
        style={{
          opacity: activeSlide > 0 && !showVault ? 0 : 1,
          pointerEvents: activeSlide === 0 || showVault ? 'auto' : 'none',
          // If hidden-logo, apply extra scale fade
          transform: activeSlide > 0 && !showVault 
            ? 'translate(-50%, -50%) scale(0.8)' 
            : showVault 
              ? 'translate(0, -50%) scale(0.65)' 
              : 'translate(-50%, -50%) scale(1.3)',
          transition: showVault 
            ? 'none' 
            : 'transform 1.2s cubic-bezier(0.25, 1, 0.5, 1), top 1.2s cubic-bezier(0.25, 1, 0.5, 1), left 1.2s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.5s ease'
        }}
      >
        <div className="intro-title-wrapper" style={{ padding: 0 }}>
          <div className="intro-title-bg" style={{ fontSize: showVault ? '3.8rem' : '4.5rem', transition: 'font-size 1.2s' }}>
            WhisperPixels
          </div>
          <div 
            className="intro-title-fg" 
            style={{ 
              position: 'absolute',
              top: 0,
              left: 0,
              overflow: showVault || activeSlide > 0 ? 'visible' : (progress >= 1 ? 'visible' : 'hidden'),
              whiteSpace: 'nowrap',
              width: showVault || activeSlide > 0 ? '110%' : `${progress * 100}%`,
              fontSize: showVault ? '3.8rem' : '4.5rem',
              transition: 'font-size 1.2s'
            }}
          >
            <span className="metallic-title">WhisperPixels</span>
          </div>
        </div>
      </div>

      {/* Slide Scrolling Viewport */}
      {!showVault && introDone && (
        <div ref={slidesContainerRef} className="slides-container">
          {/* Slide 1: Welcome & Vault Entrance */}
          <section className="slide-section" data-slide-index="0">
            <div className="hero-slide-content">
              {/* Spacer matching title block size */}
              <div style={{ height: '180px' }} />
              
              <p className="slide-desc" style={{ minHeight: '60px', maxWidth: '600px', fontSize: '1.35rem' }}>
                <Typewriter 
                  text="WhisperPixels is a secure, client-side steganographic vault. Conceal private text messages, access keys, and clues directly inside carrier files without altering their visual appearance or integrity." 
                  trigger={activeSlide === 0} 
                />
              </p>
              
              <button 
                className="btn btn-primary" 
                style={{ 
                  padding: '16px 36px', 
                  fontSize: '1.1rem', 
                  borderRadius: '12px',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
                  letterSpacing: '0.05em'
                }}
                onClick={() => setShowVault(true)}
              >
                STEGANOGRAPHY VAULT
              </button>
            </div>
            
            <div className="scroll-indicator">
              <span>Scroll to explore</span>
              <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </section>

          {/* Slide 2: Image Steganography */}
          <section className="slide-section" data-slide-index="1">
            <div className="slide-content-grid">
              <div className="slide-text-pane">
                <h2 className="slide-heading">
                  <Typewriter text="Image Steganography" delay={800} trigger={activeSlide === 1} />
                </h2>
                <p className="slide-desc">
                  <Typewriter 
                    text="It's the practice of hiding secret data inside a digital image without visibly changing it. It's used for covert communication, digital watermarking, and copyright protection. Common techniques include Least Significant Bit (LSB) substitution, masking/filtering, and transform-domain methods (DCT/DWT). It works by altering pixel values in ways too small for the human eye to detect. The hidden data is embedded in color channel bits (R, G, B) of pixels. To extract it, the same algorithm reads those specific bits back in order. It's widely used in secure messaging, forensic watermarking, and anti-piracy tracking." 
                    trigger={activeSlide === 1} 
                  />
                </p>
              </div>
              <div className="slide-image-pane">
                <img src={imageStegoImg} alt="Image Steganography Model" className="slide-img-frame" />
              </div>
            </div>
            
            <div className="scroll-indicator">
              <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </section>

          {/* Slide 3: Audio Steganography */}
          <section className="slide-section" data-slide-index="2">
            <div className="slide-content-grid">
              <div className="slide-text-pane">
                <h2 className="slide-heading">
                  <Typewriter text="Audio Steganography" delay={800} trigger={activeSlide === 2} />
                </h2>
                <p className="slide-desc">
                  <Typewriter 
                    text="It's the technique of embedding hidden information within an audio file without altering how it sounds. It's used for secure communication, ownership verification, and covert data transfer. Key techniques include LSB encoding, echo hiding, phase coding, and spread spectrum. It works by modifying audio samples or frequencies in ways inaudible to the human ear. Data is often hidden in the least significant bits of each audio sample. Decoding involves extracting those exact bits using the matching algorithm and key. It's commonly applied in copyright protection, military communication, and secure voice messaging" 
                    trigger={activeSlide === 2} 
                  />
                </p>
              </div>
              <div className="slide-image-pane">
                <img src={audioStegoImg} alt="Audio Steganography Model" className="slide-img-frame" />
              </div>
            </div>
            
            <div className="scroll-indicator">
              <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </section>

          {/* Slide 4: Video Steganography */}
          <section className="slide-section" data-slide-index="3">
            <div className="slide-content-grid">
              <div className="slide-text-pane">
                <h2 className="slide-heading">
                  <Typewriter text="Video Steganography" delay={800} trigger={activeSlide === 3} />
                </h2>
                <p className="slide-desc">
                  <Typewriter 
                    text="It's the process of concealing data within a video file without affecting its visual or audio playback. It's used for secure data transmission, copyright protection, and large-volume covert storage (videos hold more data than images). Techniques include LSB encoding on frames, DCT-based embedding, and motion vector manipulation. It works by hiding data across individual video frames or within an embedded audio track. Because videos have many frames, they offer much higher data-hiding capacity. Extraction involves analyzing specific frames or vectors with the matching decoding key. It's used in surveillance, secure file transfer, and digital watermarking for media protection." 
                    trigger={activeSlide === 3} 
                  />
                </p>
              </div>
              <div className="slide-image-pane">
                <img src={videoStegoImg} alt="Video Steganography Model" className="slide-img-frame" />
              </div>
            </div>
            
            <div className="scroll-indicator">
              <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </section>

          {/* Slide 5: Text Steganography */}
          <section className="slide-section" data-slide-index="4">
            <div className="slide-content-grid">
              <div className="slide-text-pane">
                <h2 className="slide-heading">
                  <Typewriter text="Text Steganography" delay={800} trigger={activeSlide === 4} />
                </h2>
                <p className="slide-desc">
                  <Typewriter 
                    text="It's a method of hiding information within plain text without changing its visible meaning or appearance. It's used for covert messaging, document authentication, and tamper detection. Techniques include whitespace manipulation, zero-width character insertion, synonym substitution, and font/formatting tricks. It works by embedding data in invisible characters or subtle structural patterns within the text. The hidden message remains undetectable to a casual reader. Extraction requires scanning the exact character positions or patterns used to embed it. It's used in digital rights management, secure document sharing, and anti-leak tracking." 
                    trigger={activeSlide === 4} 
                  />
                </p>
              </div>
              <div className="slide-image-pane">
                <img src={textStegoImg} alt="Text Steganography Model" className="slide-img-frame" />
              </div>
            </div>
            
            <div className="scroll-indicator" style={{ animation: 'none' }}>
              <span style={{ cursor: 'pointer', pointerEvents: 'auto' }} onClick={() => {
                if (slidesContainerRef.current) {
                  slidesContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}>
                Back to Top ↑
              </span>
            </div>
          </section>
        </div>
      )}

      {/* Steganography Vault Full-Screen Overlay Modal */}
      <div className={`vault-overlay ${showVault ? 'active' : ''}`}>
        {showVault && (
          <>
            <header className="app-header">
              <div className="app-header-content">
                {/* Empty block for the smart logo title placement */}
                <div style={{ width: '220px', height: '1px' }} />
                <div className="header-nav">
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setShowVault(false)}
                    style={{ fontSize: '0.85rem', padding: '8px 16px', borderRadius: '8px' }}
                  >
                    Back to Home
                  </button>
                </div>
              </div>
            </header>
            <main style={{ flex: 1 }}>
              <Dashboard />
            </main>
          </>
        )}
      </div>
    </div>
  );
}
