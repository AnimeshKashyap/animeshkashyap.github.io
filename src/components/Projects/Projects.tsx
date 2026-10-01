import { Reveal } from '../Reveal/Reveal';
import { SectionHeading } from '../SectionHeading/SectionHeading';
import { projects } from '../../data/projects';
import styles from './Projects.module.css';

export function Projects() {
  return (
    <section id="projects" className="container">
      <Reveal>
        <SectionHeading
          eyebrow="Projects"
          title="Things I've built on the side"
          description="Personal projects spanning automation, game development, and web apps."
        />
      </Reveal>

      <div className={styles.grid}>
        {projects.map((project, index) => (
          <Reveal key={project.title} delay={index * 60} className={styles.cardWrap}>
            <article className={styles.card}>
              <header>
                <h3 className={styles.title}>{project.title}</h3>
                <p className={styles.period}>{project.period}</p>
              </header>

              <ul className={styles.highlights}>
                {project.highlights.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>

              <ul className={styles.stack}>
                {project.stack.map((tech) => (
                  <li key={tech}>{tech}</li>
                ))}
              </ul>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
