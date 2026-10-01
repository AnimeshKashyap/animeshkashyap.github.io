import { Reveal } from '../Reveal/Reveal';
import { SectionHeading } from '../SectionHeading/SectionHeading';
import { awards, education, languages } from '../../data/education';
import styles from './Education.module.css';

export function Education() {
  return (
    <section id="education" className="container">
      <Reveal>
        <SectionHeading eyebrow="Background" title="Education, awards & languages" />
      </Reveal>

      <div className={styles.grid}>
        <Reveal className={styles.column}>
          <h3 className={styles.columnTitle}>Education</h3>
          <ul className={styles.list}>
            {education.map((entry) => (
              <li key={entry.school} className={styles.entry}>
                <p className={styles.entryTitle}>{entry.school}</p>
                <p className={styles.entrySub}>{entry.degree}</p>
                <p className={styles.entryMeta}>
                  {entry.period} · {entry.location}
                </p>
                <p className={styles.entryMeta}>{entry.detail}</p>
              </li>
            ))}
          </ul>

          <h3 className={styles.columnTitle} style={{ marginTop: '2rem' }}>
            Languages
          </h3>
          <ul className={styles.languageList}>
            {languages.map((lang) => (
              <li key={lang.name}>
                <span className={styles.entryTitle}>{lang.name}</span>
                <span className={styles.entryMeta}>{lang.level}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={100} className={styles.column}>
          <h3 className={styles.columnTitle}>Awards & Certifications</h3>
          <ul className={styles.awardList}>
            {awards.map((award) => (
              <li key={award}>{award}</li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
