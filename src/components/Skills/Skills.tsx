import { Reveal } from '../Reveal/Reveal';
import { SectionHeading } from '../SectionHeading/SectionHeading';
import { skillGroups } from '../../data/skills';
import styles from './Skills.module.css';

export function Skills() {
  return (
    <section id="skills" className="container">
      <Reveal>
        <SectionHeading
          eyebrow="Skills"
          title="The toolbox"
          description="Grouped the way I actually reach for it — languages first, then the layers built on top."
        />
      </Reveal>

      <div className={styles.grid}>
        {skillGroups.map((group, index) => (
          <Reveal key={group.category} delay={index * 60} className={styles.card}>
            <h3 className={styles.cardTitle}>{group.category}</h3>
            <ul className={styles.chipList}>
              {group.items.map((item) => (
                <li key={item} className={styles.chip}>
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
