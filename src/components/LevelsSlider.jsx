import { useRef, useEffect, useCallback } from 'react';
import styles from './LevelsDialog.module.css';

export default function LevelsSlider({ config, onChange }) {
  const containerRef = useRef();

  const isDragging = useRef(false);
  const dragType = useRef(null);
  
  const setNormalizedValue = useCallback((key, logicalPosNorm) => {
    const bounds = { ...config };
    if (key === 'black') {
        bounds.black = Math.max(0, Math.min(bounds.white - 2, logicalPosNorm * 255));
    }
    if (key === 'white') {
        bounds.white = Math.max(bounds.black + 2, Math.min(255, logicalPosNorm * 255));
    }
    if (key === 'gamma') {
      const clampX = Math.max(bounds.black, Math.min(bounds.white, logicalPosNorm * 255));
      const factor = (clampX - bounds.black) / (bounds.white - bounds.black || 1);
      const gammaVal = Math.pow(10, 2 * (0.5 - factor));
      bounds.gamma = Math.min(9.99, Math.max(0.1, gammaVal));
    }
    
    onChange({
        black: Math.round(bounds.black),
        white: Math.round(bounds.white),
        gamma: parseFloat(bounds.gamma.toFixed(2))
    });
  }, [config, onChange]);

  const pointerHandleMove = useCallback((e) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setNormalizedValue(dragType.current, nx);
  }, [setNormalizedValue]);

  const pointerHandleUp = useCallback(() => {
    if (isDragging.current) {
        isDragging.current = false;
        dragType.current = null;
        window.removeEventListener('pointermove', pointerHandleMove);
        window.removeEventListener('pointerup', pointerHandleUp);
    }
  }, [pointerHandleMove]);

  const handlePointerDown = (type) => (e) => {
    e.preventDefault(); 
    isDragging.current = true;
    dragType.current = type;
    window.addEventListener('pointermove', pointerHandleMove);
    window.addEventListener('pointerup', pointerHandleUp);
  };

  useEffect(() => { 
      return () => {
         window.removeEventListener('pointermove', pointerHandleMove);
         window.removeEventListener('pointerup', pointerHandleUp);
      };
  }, [pointerHandleMove, pointerHandleUp]);

  const leftPx = (config.black / 255) * 100;
  const rightPx = (config.white / 255) * 100;
  
  let gFact = 0.5 - Math.log10(config.gamma) / 2;
  gFact = Math.max(0, Math.min(1, gFact)); 
  const gammaAbsPcs = leftPx + (gFact * (rightPx - leftPx));

  return (
    <div className={styles.sliderHolder} ref={containerRef}>
        <div className={styles.sliderTrackLine} />

        <div className={styles.thumbArea} style={{ left: `${gammaAbsPcs}%`, zIndex: 1 }} onPointerDown={handlePointerDown('gamma')}>
            <div className={`${styles.polyTri} ${styles.midColor}`} />
        </div>

        <div className={styles.thumbArea} style={{ left: `${leftPx}%`, zIndex: 2 }} onPointerDown={handlePointerDown('black')}>
            <div className={`${styles.polyTri} ${styles.darkColor}`} />
        </div>

        <div className={styles.thumbArea} style={{ left: `${rightPx}%`, zIndex: 3 }} onPointerDown={handlePointerDown('white')}>
            <div className={`${styles.polyTri} ${styles.lightColor}`} />
        </div>
    </div>
  );
}