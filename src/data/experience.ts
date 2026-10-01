// Edit this file to update the Experience timeline. Newest role first.
export interface ExperienceEntry {
  role: string;
  company: string;
  client?: string;
  period: string;
  location: string;
  stack?: string[];
  highlights: string[];
}

export const experience: ExperienceEntry[] = [
  {
    role: 'Principal Consultant',
    company: 'StatusNeo Technology Consulting Pvt Ltd',
    client: 'McKinsey & Company',
    period: 'Oct 2024 — Oct 2025',
    location: 'Hybrid',
    stack: [
      'Python',
      'FastAPI',
      'Node.js',
      'React.js',
      'TypeScript',
      'AWS Lambda',
      'Amazon SQS',
      'Amazon ECS',
      'Docker',
      'PostgreSQL',
      'MS SQL',
    ],
    highlights: [
      'Led the analytics team at McKinsey, ensuring the survey portal stayed reliable while addressing long-standing technical and process challenges.',
      'Established coding standards and boosted test coverage from ~20% to ~75%, halving rollback incidents.',
      'Re-architected the entire ETL flow, reducing 1,200+ API calls with a webhook-driven model, improving performance and reducing runtimes by 70%+.',
      'Enabled the team to own multiple modules through structured cross-training, avoiding knowledge silos.',
      'Shaped architecture discussions for new features, ensuring scalable, maintainable designs across the board.',
    ],
  },
  {
    role: 'Senior Backend Engineer',
    company: 'Solv India',
    period: 'Aug 2023 — Apr 2024',
    location: 'Remote',
    stack: [
      'Python',
      'Nest.js',
      'Node.js',
      'React.js',
      'TypeScript',
      'AWS Lambda',
      'AWS EventBridge',
      'AWS Step Functions',
      'SQS',
      'DynamoDB',
      'AWS S3',
      'FastAPI',
    ],
    highlights: [
      'Developed and integrated a Credit Scoring-as-a-Service solution using AWS Lambda, Step Functions, and EventBridge.',
      'Configured Step Functions and EventBridge policies to trigger Lambda through SQS, reducing score calculation time by 20%.',
      'Implemented a dashboard UI for monitoring and aggregated report generation for score metrics with maps and charts.',
      'Integrated event-driven components with AWS Lambda for automated processing.',
    ],
  },
  {
    role: 'Senior Software Engineer',
    company: 'R Systems International',
    period: 'Jan 2023 — Aug 2023',
    location: 'Remote',
    stack: ['Node.js', 'React.js', 'TypeScript', 'AWS Lambda', 'AWS S3', 'Pulumi', 'Jest.js'],
    highlights: [
      'Developed Infrastructure as Code using Pulumi with Node.js and TypeScript for cloud resource automation.',
      'Implemented business logic to dynamically scale cloud resources, reducing deployment times by 30% on production.',
      'Built a scalable image distribution server compliant with DICOM standards for medical imagery.',
    ],
  },
  {
    role: 'Senior Software Engineer',
    company: 'OneAssist Consumer Solutions',
    period: 'May 2020 — Jan 2023',
    location: 'Gurugram',
    stack: [
      'Python',
      'React.js',
      'Ejabberd (Erlang)',
      'Node.js',
      'TypeScript',
      'Apache Kafka',
      'AWS Lambda',
      'MySQL',
      'GraphQL',
    ],
    highlights: [
      'Developed a DialogFlow-based chatbot using Python Django to automate claim processes and handle general inquiries.',
      'Configured and customized Ejabberd (XMPP chat server) for chat synchronization, scaling it to 20k+ chats per day.',
      'Optimised response and turnaround times from 20+ seconds to under 5 seconds, and built UI dashboards for monitoring.',
    ],
  },
  {
    role: 'Senior Software Engineer',
    company: 'Techfour Engineering Solutions',
    client: 'OneAssist Consumer Solutions',
    period: 'Aug 2019 — Apr 2020',
    location: 'Remote',
    highlights: [],
  },
  {
    role: 'Associate IT',
    company: 'Daffodil Software',
    client: 'OneAssist Consumer Solutions',
    period: 'Apr 2018 — Aug 2019',
    location: 'Gurugram',
    highlights: [],
  },
  {
    role: 'MEAN Stack Developer',
    company: 'Wish A Design',
    period: 'Apr 2017 — Apr 2018',
    location: 'North West Delhi',
    stack: ['Angular 4', 'Node.js', 'Jest.js', 'MongoDB', 'TypeScript'],
    highlights: [
      'Developed a SaaS-based coworking management system.',
      'Created a multi-level authentication system with custom assignable privileges.',
      'Built an ERP module for managing bookings, inventory, admins, reports, and invoices.',
    ],
  },
];
