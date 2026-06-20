import React, { useState, useEffect, useRef } from 'react';

export default function Typewriter({ text, delay = 2000, trigger }) {
  const [displayText, setDisplayText] = useState('');
  const textRef = useRef(text);
  const animationFrameRef = useRef(null);

  // Sync ref to always have latest text
  useEffect(() => {
    textRef.current = text;
  }, [text]);

  useEffect(() => {
    // Reset text if slide becomes inactive
    if (!trigger) {
      setDisplayText('');
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    let startTime = null;
    const len = textRef.current.length;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / delay, 1);
      
      const charCount = Math.floor(progress * len);
      setDisplayText(textRef.current.slice(0, charCount));

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [trigger, delay]);

  return <span>{displayText}</span>;
}
