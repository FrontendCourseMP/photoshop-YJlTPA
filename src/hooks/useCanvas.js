import { useRef, useCallback } from 'react';
import { applyChannelMask } from '../utils/channelUtils';

export function useCanvas() {
  const canvasRef = useRef(null);
  const originalDataRef = useRef(null);

  const drawImage = useCallback((imageData) => {
    const canvas = canvasRef.current;
    if (!canvas || !imageData) return;
    originalDataRef.current = imageData;
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
  }, []);

  const redrawWithChannels = useCallback((activeChannels, channelCount) => {
    const canvas = canvasRef.current;
    const original = originalDataRef.current;
    if (!canvas || !original) return;

    const ctx = canvas.getContext('2d');

    const allIds = channelCount <= 2
      ? (channelCount === 1 ? ['gray'] : ['gray', 'alpha'])
      : (channelCount === 3 ? ['r', 'g', 'b'] : ['r', 'g', 'b', 'alpha']);

    const allActive = allIds.every(id => activeChannels.has(id));
    if (allActive) {
      ctx.putImageData(original, 0, 0);
      return;
    }

    const masked = applyChannelMask(original, activeChannels, channelCount);
    ctx.putImageData(masked, 0, 0);
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = 1;
    canvas.height = 1;
    originalDataRef.current = null;
  }, []);

  const getOriginalData = useCallback(() => originalDataRef.current, []);

  return { canvasRef, drawImage, clearCanvas, redrawWithChannels, getOriginalData };
}