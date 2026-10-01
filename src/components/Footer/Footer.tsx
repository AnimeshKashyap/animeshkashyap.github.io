import { profile } from '../../data/profile';
import styles from './Footer.module.css';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <p>© {year} {profile.name}. Built with React, TypeScript & Three.js.</p>
        <div className={styles.links}>
          {profile.links.map((link) => (
            <a key={link.label} href={link.url} target="_blank" rel="noreferrer noopener">
              {link.label}
            </a>
          ))}
          <a href="#top">Back to top ↑</a>
        </div>
      </div>
    </footer>
  );
}
