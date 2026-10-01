import { Reveal } from '../Reveal/Reveal';
import { SectionHeading } from '../SectionHeading/SectionHeading';
import { profile } from '../../data/profile';
import styles from './About.module.css';

export function About() {
  return (
    <section id="about" className="container">
      <Reveal>
        <SectionHeading eyebrow="About" title="Backend-minded, full-stack capable." />
      </Reveal>

      <div className={styles.grid}>
        <Reveal className={styles.copy}>
          <p>{profile.summary}</p>
          <p>
            Over the last 8 years I've moved between startups and enterprise consulting —
            re-architecting ETL pipelines, standing up event-driven AWS systems, and leading
            teams through the less glamorous work of raising test coverage and cutting rollback
            rates. I care about systems that stay boring in production.
          </p>
        </Reveal>

        <Reveal delay={120} className={styles.infoCard}>
          <h3 className={styles.infoTitle}>Currently</h3>
          <p className={styles.infoRole}>{profile.title}</p>
          <p className={styles.infoLocation}>{profile.location}</p>
          <hr className={styles.divider} />
          <h3 className={styles.infoTitle}>Reach me</h3>
          <a className={styles.infoLink} href={`mailto:${profile.email}`}>
            {profile.email}
          </a>
          {profile.phones.map((phone) => (
            <p key={phone} className={styles.infoPhone}>
              {phone}
            </p>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
