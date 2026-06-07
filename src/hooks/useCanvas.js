import { useRef, useCallback } from 'react';

export function useCanvas() {
  const canvasRef = useRef(null);

  const drawImage = useCallback((imageData) => {
    const canvas = canvasRef.current;
    if (!canvas || !imageData) return;
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = 1;
    canvas.height = 1;
  }, []);

  return { canvasRef, drawImage, clearCanvas };
}