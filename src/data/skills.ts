// Edit this file to update the Skills section. Each group renders as its own card.
export interface SkillGroup {
  category: string;
  items: string[];
}

export const skillGroups: SkillGroup[] = [
  {
    category: 'Programming',
    items: ['Python', 'JavaScript', 'TypeScript', 'C++', 'C', 'HTML', 'SQL'],
  },
  {
    category: 'Web',
    items: [
      'Node.js',
      'React.js',
      'RESTful API',
      'GraphQL',
      'HTML5',
      'CSS3',
      'Jest.js',
    ],
  },
  {
    category: 'Database',
    items: ['MySQL', 'PostgreSQL', 'MSSQL', 'MongoDB', 'DynamoDB'],
  },
  {
    category: 'Cloud & SDK',
    items: [
      'AWS SDK',
      'EC2',
      'SQS',
      'EventBridge',
      'Lambda',
      'S3',
      'Athena',
      'GCP Cloud SDK',
      'YouTube Data API v3',
      'Cloud Vision API',
      'Maps API',
    ],
  },
  {
    category: 'Tools & Practices',
    items: [
      'Git',
      'GitLab',
      'JIRA',
      'Apache Kafka',
      'Docker',
      'CI/CD',
      'Data Structures',
      'Unit Testing',
      'Performance Testing',
      'Shell',
      'Design Patterns',
      'System Design',
      'Team Management',
    ],
  },
  {
    category: 'Creative Tools',
    items: ['Adobe Photoshop', 'Adobe After Effects'],
  },
];
