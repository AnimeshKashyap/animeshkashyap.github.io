import { profile } from '../../data/profile';
import styles from './Hero.module.css';

export function Hero() {
  return (
    <section id="top" className={styles.hero}>
      <div className={`container ${styles.content}`}>
        <p className={`eyebrow ${styles.eyebrow}`}>{profile.title} · {profile.location}</p>
        <h1 className={styles.headline}>
          Hi, I'm <span className="gradient-text">{profile.name}</span>.
          <br />
          I build systems that scale quietly.
        </h1>
        <p className={styles.lede}>{profile.summary}</p>

        <div className={styles.ctaRow}>
          <a href="#projects" className={styles.primaryCta}>
            View my work
          </a>
          <a href="#contact" className={styles.secondaryCta}>
            Get in touch
          </a>
          <a href={profile.resumeFile} className={styles.secondaryCta} download>
            Download résumé
          </a>
        </div>

        <dl className={styles.stats}>
          {profile.stats.map((stat) => (
            <div key={stat.label} className={styles.stat}>
              <dt className={styles.statValue}>{stat.value}</dt>
              <dd className={styles.statLabel}>{stat.label}</dd>
            </div>
          ))}
        </dl>
      </div>

      <a href="#about" className={styles.scrollCue} aria-label="Scroll to About section">
        <span />
      </a>
    </section>
  );
}
