// Edit this file to update the Personal Projects grid.
export interface Project {
  title: string;
  period: string;
  stack: string[];
  highlights: string[];
}

export const projects: Project[] = [
  {
    title: 'YouTube Automation for Game Tournament Highlights',
    period: 'Mar 2024 — Present',
    stack: ['Python', 'FastAPI', 'Moviepy', 'PyAutoGUI', 'PyWinAuto', 'Amazon SQS', 'Amazon S3'],
    highlights: [
      'Automated extraction and mapping of in-game combat events — damage, kills, item usage.',
      'Custom scoring formula ranks teamfights from best to worst.',
      'Automation scripts record and edit highlights using OBS and Moviepy.',
      'Pipeline merges clips, generates thumbnails, and uploads to YouTube with metadata.',
    ],
  },
  {
    title: 'Choice-based User Flow Implementation',
    period: 'Jan 2021 — May 2022',
    stack: ['React.js', 'Next.js', 'Node.js', 'TypeScript', 'MySQL', 'Jest.js'],
    highlights: [
      'Designed business logic for managing dynamic, branching user journeys.',
      'Built reusable, layout-based UI components.',
      'Developed Node.js REST APIs for user journey data.',
    ],
  },
  {
    title: 'DOTA 2 Custom Bot',
    period: 'Jun 2021 — Ongoing',
    stack: ['Lua', 'Python'],
    highlights: [
      'Custom bot for DOTA 2 supporting 1v1 and 5v5 game modes.',
      'Decision-making logic for passive, defensive, and offensive strategies.',
      'Situational spell casting and itemization features.',
    ],
  },
  {
    title: 'Real-Time Chat Application',
    period: 'Mar 2015 — Apr 2015',
    stack: ['Angular 4', 'Firebase', 'JavaScript', 'jQuery', 'HTML5', 'CSS3'],
    highlights: [
      'Group chat, typing indicators, and emoticons.',
      'REST APIs for login/register and user journey flows.',
      'Email verification with custom encryption.',
    ],
  },
  {
    title: 'Android Game Development',
    period: 'Aug 2014 — Dec 2014',
    stack: ['C#', 'Unity3D', 'After Effects', 'Photoshop', 'Cinema 4D'],
    highlights: [
      'Collision detection, power-ups, and UVW mapping.',
      'Gameplay features like God Mode and Magnet.',
    ],
  },
  {
    title: 'C++ Game Development (Win32)',
    period: 'Feb 2014 — Mar 2014',
    stack: ['C++', 'C++ Graphics Library'],
    highlights: [
      'Multiple difficulty levels with dynamic problem generation.',
      'High score storage with encryption for secure data handling.',
    ],
  },
];
