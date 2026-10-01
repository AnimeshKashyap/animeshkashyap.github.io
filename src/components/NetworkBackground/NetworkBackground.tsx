import { useEffect, useRef } from 'react';
import type { ParticleNetwork } from '../../three/ParticleNetwork';
import styles from './NetworkBackground.module.css';

/**
 * A fixed, full-page backdrop that sits behind every section (mounted once
 * in App.tsx, not per-section). three.js is loaded via a dynamic import so
 * it lands in its own chunk instead of bloating the main bundle. Pauses
 * rendering when the tab isn't visible so it doesn't burn battery/CPU in a
 * background tab.
 *
 * A translucent "scrim" div sits on top of the canvas so the network reads
 * as a subtle, ambient presence behind text/cards rather than competing
 * with them for contrast.
 */
export function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let network: ParticleNetwork | undefined;
    let cancelled = false;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const handleVisibility = () => {
      if (!network) return;
      if (document.hidden) {
        network.stop();
      } else if (!prefersReducedMotion) {
        network.start();
      }
    };

    import('../../three/ParticleNetwork').then(({ ParticleNetwork: ParticleNetworkClass }) => {
      if (cancelled) return;
      network = new ParticleNetworkClass(canvas, {
        particleCount: window.innerWidth < 720 ? 90 : 180,
      });
      if (!prefersReducedMotion) {
        network.start();
      }
      document.addEventListener('visibilitychange', handleVisibility);
    });

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      network?.dispose();
    };
  }, []);

  return (
    <div className={styles.wrapper} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.scrim} />
    </div>
  );
}
