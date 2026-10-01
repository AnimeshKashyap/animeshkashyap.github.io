// Edit this file to update your name, tagline, summary, and contact links.
export interface ProfileLink {
  label: string;
  url: string;
}

export interface Profile {
  name: string;
  title: string;
  location: string;
  summary: string;
  email: string;
  phones: string[];
  links: ProfileLink[];
  resumeFile: string;
  stats: { value: string; label: string }[];
}

export const profile: Profile = {
  name: 'Animesh Kashyap',
  title: 'Senior Software Engineer',
  location: 'Delhi, India',
  summary:
    'Senior Software Engineer with 8+ years of experience in Python, Node.js, React.js, AWS, and full-stack development. Expertise in backend systems, cloud computing, and automation — with proven success in scalable ETLs, Infrastructure as Code, and chatbot projects. Strong in system design and project leadership, delivering high-quality solutions in diverse and challenging environments.',
  email: 'animeshtheanime@gmail.com',
  phones: ['+91 8802525672', '+91 7982102342'],
  links: [
    { label: 'GitHub', url: 'http://github.com/Animeshkashyap/' },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/animesh-kashyap/' },
    { label: 'LeetCode', url: 'https://leetcode.com/u/AnimeshKashyap/' },
  ],
  resumeFile: `${import.meta.env.BASE_URL}resume.pdf`,
  stats: [
    { value: '8+', label: 'Years of experience' },
    { value: '7', label: 'Companies & client engagements' },
    { value: '500+', label: 'Coding problems solved' },
    { value: '70%+', label: 'Largest runtime improvement shipped' },
  ],
};
