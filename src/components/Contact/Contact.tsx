import { useState, type FormEvent } from 'react';
import { Reveal } from '../Reveal/Reveal';
import { SectionHeading } from '../SectionHeading/SectionHeading';
import { profile } from '../../data/profile';
import styles from './Contact.module.css';

/**
 * There's no backend here, so "submitting" this form just builds a
 * mailto: link from the fields and hands off to the visitor's own mail
 * client — nothing is sent from this site or stored anywhere.
 */
export function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const mailSubject = subject.trim() || `Portfolio inquiry from ${name || 'a visitor'}`;
    const mailBody = [
      message.trim(),
      '',
      '—',
      name ? `From: ${name}` : null,
      email ? `Reply to: ${email}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const mailtoUrl = `mailto:${profile.email}?subject=${encodeURIComponent(
      mailSubject,
    )}&body=${encodeURIComponent(mailBody)}`;

    window.location.href = mailtoUrl;
  };

  return (
    <section id="contact" className="container">
      <Reveal>
        <SectionHeading
          eyebrow="Contact"
          title="Let's talk"
          description="This is a static site, so the form below just opens your email client with everything pre-filled — nothing is sent or stored here."
        />
      </Reveal>

      <div className={styles.grid}>
        <Reveal className={styles.formCard}>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="contact-name">Your name</label>
              <input
                id="contact-name"
                type="text"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Jane Doe"
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="contact-email">Your email</label>
              <input
                id="contact-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="jane@example.com"
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="contact-subject">Subject</label>
              <input
                id="contact-subject"
                type="text"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Let's build something"
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="contact-message">Message</label>
              <textarea
                id="contact-message"
                required
                rows={5}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Tell me a bit about what you have in mind..."
              />
            </div>

            <button type="submit" className={styles.submit}>
              Open in email client
            </button>
          </form>
        </Reveal>

        <Reveal delay={100} className={styles.sideCard}>
          <h3 className={styles.sideTitle}>Direct lines</h3>
          <a className={styles.sideEmail} href={`mailto:${profile.email}`}>
            {profile.email}
          </a>
          {profile.phones.map((phone) => (
            <p key={phone} className={styles.sidePhone}>
              {phone}
            </p>
          ))}

          <hr className={styles.divider} />

          <h3 className={styles.sideTitle}>Elsewhere</h3>
          <ul className={styles.linkList}>
            {profile.links.map((link) => (
              <li key={link.label}>
                <a href={link.url} target="_blank" rel="noreferrer noopener">
                  {link.label} ↗
                </a>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
