// Edit this file to update Education and Awards/Certifications.
export interface EducationEntry {
  school: string;
  degree: string;
  period: string;
  location: string;
  detail: string;
}

export const education: EducationEntry[] = [
  {
    school: 'KCC Institute of Technology and Management',
    degree: 'B.Tech, Computer Science & Engineering',
    period: '2013 — 2017',
    location: 'Greater Noida, India',
    detail: '65.1% Aggregate',
  },
  {
    school: 'D.A.V. Public School (CBSE)',
    degree: 'HSC (12th) + SSC (10th)',
    period: '2011 — 2013',
    location: 'Delhi, India',
    detail: '82.3% Aggregate (12th) + 80% Aggregate (10th)',
  },
];

export const awards: string[] = [
  'Solved 500+ coding problems across LeetCode, CodeChef, TechGIG, and HackerRank — Dynamic Programming, Trees, Tries, Linked Lists, and other advanced algorithms.',
  'Consistently qualified for Google Code Jam, achieving global ranks of 7,752, 12,025, and 16,833 across different editions.',
  'Actively competed in online coding contests, honing problem-solving and time-bound coding skills.',
  'Completed Computer Science training programs offered by Microsoft, Google, and Facebook.',
];

export const languages: { name: string; level: string }[] = [
  { name: 'English', level: 'Fluent' },
  { name: 'Hindi', level: 'Fluent, Native' },
];
