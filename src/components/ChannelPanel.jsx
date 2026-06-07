import { useEffect, useRef } from 'react';
import { buildChannelPreview } from '../utils/channelUtils';
import styles from './ChannelPanel.module.css';

function ChannelThumb({ imageData, channelId, size = 56 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !imageData) return;

    const preview = buildChannelPreview(imageData, channelId);

    const offscreen = document.createElement('canvas');
    offscreen.width = preview.width;
    offscreen.height = preview.height;
    offscreen.getContext('2d').putImageData(preview, 0, 0);

    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';

    // Вписываем превью в квадрат с сохранением пропорций
    const ratio = Math.min(size / preview.width, size / preview.height);
    const dw = preview.width * ratio;
    const dh = preview.height * ratio;
    const dx = (size - dw) / 2;
    const dy = (size - dh) / 2;

    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(offscreen, dx, dy, dw, dh);
  }, [imageData, channelId, size]);

  return (
    <canvas
      ref={ref}
      className={styles.thumb}
      width={size}
      height={size}
    />
  );
}

export default function ChannelPanel({ imageData, descriptors, activeChannels, onToggle }) {
  if (!imageData || !descriptors) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>Каналы</span>
      </div>
      <div className={styles.channelList}>
        {descriptors.map((desc) => {
          const isActive = activeChannels.has(desc.id);
          return (
            <button
              key={desc.id}
              className={`${styles.channelItem} ${isActive ? styles.channelItemActive : ''}`}
              onClick={() => onToggle(desc.id)}
              title={`${isActive ? 'Выключить' : 'Включить'} канал ${desc.label}`}
            >
              <div className={styles.thumbWrap}>
                <ChannelThumb imageData={imageData} channelId={desc.id} size={56} />
              </div>
              <div className={styles.channelMeta}>
                <span
                  className={styles.channelLabel}
                  style={desc.color ? { color: desc.color } : undefined}
                >
                  {desc.label}
                </span>
                <span className={`${styles.channelStatus} ${isActive ? styles.statusOn : styles.statusOff}`}>
                  {isActive ? 'вкл' : 'выкл'}
                </span>
              </div>
              <div
                className={`${styles.activeBar} ${isActive ? styles.activeBarOn : ''}`}
                style={desc.color && isActive ? { background: desc.color } : undefined}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}