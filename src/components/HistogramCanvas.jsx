import styles from './LevelsDialog.module.css';

export default function HistogramCanvas({ histograms, targetId, linearMode }) {
  if (!histograms || !targetId) return null;
  const activeHistArray = histograms[targetId];

  let maxHit = 0;
  for (let i = 1; i < 255; i++) {
    if (activeHistArray[i] > maxHit) maxHit = activeHistArray[i];
  }
  
  if (maxHit === 0) {
      maxHit = Math.max(...activeHistArray);
  }
  if (maxHit === 0) maxHit = 1;

  let pathString = `M 0 100 `; 
  
  for (let i = 0; i < 256; i++) {
     const val = activeHistArray[i];
     let norm;
     if (linearMode) {
       norm = val / maxHit;
     } else {
       norm = Math.log(1 + val) / Math.log(1 + maxHit);
     }
     
     if (norm > 1) norm = 1; 
     const x = (i / 255) * 255; 
     const y = 100 - (norm * 100); 
     
     pathString += `L ${x} ${y} `;
  }
  
  pathString += `L 255 100 Z`;

  const getFillForChannel = () => {
    switch (targetId) {
       case 'r': return 'rgba(230, 80, 80, 0.85)';
       case 'g': return 'rgba(70, 190, 80, 0.85)';
       case 'b': return 'rgba(50, 130, 220, 0.85)';
       case 'alpha': return 'rgba(100, 100, 100, 0.5)';
       default: return '#5f6368';
    }
  };

  return (
    <div className={styles.histBox}>
      <svg className={styles.histSvg} viewBox="-0.5 -1 256 102" preserveAspectRatio="none">
         <path d={pathString} fill={getFillForChannel()} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}