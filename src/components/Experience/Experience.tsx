import { Reveal } from '../Reveal/Reveal';
import { SectionHeading } from '../SectionHeading/SectionHeading';
import { experience } from '../../data/experience';
import styles from './Experience.module.css';

export function Experience() {
  return (
    <section id="experience" className="container">
      <Reveal>
        <SectionHeading
          eyebrow="Experience"
          title="Where I've worked"
          description="Eight years across consulting, fintech, and product teams."
        />
      </Reveal>

      <ol className={styles.timeline}>
        {experience.map((entry, index) => (
          <Reveal key={`${entry.company}-${entry.period}`} delay={index * 50}>
            <li className={styles.item}>
              <div className={styles.marker} />
              <div className={styles.card}>
                <div className={styles.headRow}>
                  <div>
                    <h3 className={styles.role}>{entry.role}</h3>
                    <p className={styles.company}>
                      {entry.company}
                      {entry.client && <span className={styles.client}> · Client: {entry.client}</span>}
                    </p>
                  </div>
                  <div className={styles.meta}>
                    <span>{entry.period}</span>
                    <span>{entry.location}</span>
                  </div>
                </div>

                {entry.stack && entry.stack.length > 0 && (
                  <ul className={styles.stackList}>
                    {entry.stack.map((tech) => (
                      <li key={tech} className={styles.stackChip}>
                        {tech}
                      </li>
                    ))}
                  </ul>
                )}

                {entry.highlights.length > 0 && (
                  <ul className={styles.highlights}>
                    {entry.highlights.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
