import React, { useEffect, useRef, useState } from 'react';

export default function IntroScreen({ onFinish, progress, setProgress, titleRef }) {
  const [fadeAway, setFadeAway] = useState(false);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const sparksRef = useRef([]);

  const onFinishRef = useRef(onFinish);
  const setProgressRef = useRef(setProgress);

  useEffect(() => {
    onFinishRef.current = onFinish;
    setProgressRef.current = setProgress;
  }, [onFinish, setProgress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Fit canvas to screen dimensions
    const resizeCanvas = () => {
      canvas.width = window.innerWidth * window.devicePixelRatio;
      canvas.height = window.innerHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const startTime = performance.now();
    const duration = 2800; // 2.8 seconds sweep

    const loop = (time) => {
      const elapsed = time - startTime;
      const t = Math.min(elapsed / duration, 1);
      setProgressRef.current(t);

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio);

      const titleEl = titleRef.current;
      if (!titleEl) {
        animationRef.current = requestAnimationFrame(loop);
        return;
      }

      const bgTextEl = titleEl.querySelector('.intro-title-bg');
      if (!bgTextEl) {
        animationRef.current = requestAnimationFrame(loop);
        return;
      }

      // Calculate coordinates of the laser tip relative to viewport
      const bgRect = bgTextEl.getBoundingClientRect();
      const parentRect = canvas.getBoundingClientRect();
      
      const textXStart = bgRect.left - parentRect.left;
      const textWidth = bgRect.width;
      const laserX = textXStart + t * textWidth;
      const textYStart = bgRect.top - parentRect.top;
      const textHeight = bgRect.height;

      // Spawn sparks if drawing is in progress
      if (t < 1) {
        const sparkCount = Math.floor(Math.random() * 4) + 3;
        for (let i = 0; i < sparkCount; i++) {
          sparksRef.current.push({
            x: laserX,
            y: textYStart + Math.random() * textHeight,
            vx: (Math.random() - 0.7) * 3, // bias sparks left
            vy: (Math.random() - 0.5) * 4,
            alpha: 1,
            size: Math.random() * 2 + 1.2,
            color: Math.random() > 0.3 ? '#8e8e93' : '#ffaa00', // grey or gold
            decay: Math.random() * 0.02 + 0.015
          });
        }
      }

      // Update and draw sparks
      const activeSparks = [];
      sparksRef.current.forEach((spark) => {
        spark.x += spark.vx;
        spark.y += spark.vy;
        spark.vy += 0.08; // gravity
        spark.alpha -= spark.decay;

        if (spark.alpha > 0) {
          activeSparks.push(spark);
          ctx.save();
          ctx.globalAlpha = spark.alpha;
          ctx.shadowBlur = 4;
          ctx.shadowColor = spark.color;
          ctx.fillStyle = spark.color;
          ctx.beginPath();
          ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
      sparksRef.current = activeSparks;

      // Draw vertical laser beam and glowing tip
      if (t < 1) {
        ctx.save();
        
        // Draw vertical laser line
        const grad = ctx.createLinearGradient(laserX, textYStart - 20, laserX, textYStart + textHeight + 20);
        grad.addColorStop(0, 'rgba(255, 170, 0, 0)');
        grad.addColorStop(0.3, 'rgba(255, 170, 0, 0.4)');
        grad.addColorStop(0.5, 'rgba(255, 130, 0, 1)');
        grad.addColorStop(0.7, 'rgba(255, 170, 0, 0.4)');
        grad.addColorStop(1, 'rgba(255, 170, 0, 0)');
        
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = grad;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffaa00';
        ctx.beginPath();
        ctx.moveTo(laserX, textYStart - 30);
        ctx.lineTo(laserX, textYStart + textHeight + 30);
        ctx.stroke();

        // Draw intense glowing laser center point
        ctx.beginPath();
        ctx.fillStyle = '#ff8800';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff8800';
        ctx.arc(laserX, textYStart + textHeight / 2, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
      }

      // Check if finished
      if (t >= 1 && sparksRef.current.length === 0) {
        cancelAnimationFrame(animationRef.current);
        setFadeAway(true);
        setTimeout(() => {
          onFinishRef.current();
        }, 1200); // matches transition
      } else {
        animationRef.current = requestAnimationFrame(loop);
      }
    };

    animationRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationRef.current);
    };
  }, [titleRef]);

  return (
    <div 
      className={`intro-overlay ${fadeAway ? 'fade-out' : ''}`}
      style={{ background: fadeAway ? 'transparent' : 'var(--bg-light)' }}
      role="presentation"
    >
      <canvas 
        ref={canvasRef} 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          pointerEvents: 'none',
          zIndex: 101 
        }} 
      />
    </div>
  );
}
