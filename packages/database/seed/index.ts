import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env['SUPABASE_URL'];
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const demoAgents = [
  {
    name: 'Echo Agent',
    description: 'A simple agent that echoes back any input it receives. Useful for testing.',
    endpoint: 'http://localhost:4100',
    status: 'online',
    skills: [
      {
        id: 'echo',
        name: 'Echo',
        description: 'Echoes back the input message',
        tags: ['utility', 'testing'],
      },
    ],
    tags: ['testing', 'utility'],
    trust_score: 80,
    metadata: { version: '1.0.0', runtime: 'node' },
  },
  {
    name: 'Summarizer Agent',
    description: 'Summarizes long documents into concise bullet points using LLM.',
    endpoint: 'http://localhost:4101',
    status: 'offline',
    skills: [
      {
        id: 'summarize',
        name: 'Summarize Text',
        description: 'Condenses long text into key bullet points',
        tags: ['nlp', 'summarization'],
      },
    ],
    tags: ['nlp', 'summarization', 'productivity'],
    trust_score: 72,
    metadata: { version: '0.9.0', model: 'gpt-4o-mini' },
  },
  {
    name: 'HIPAA Classifier',
    description: 'Classifies documents for HIPAA-sensitive content and flags PHI.',
    endpoint: 'http://localhost:4102',
    status: 'offline',
    skills: [
      {
        id: 'classify-hipaa',
        name: 'HIPAA Classification',
        description: 'Scans text for PHI and HIPAA compliance issues',
        tags: ['compliance', 'healthcare', 'classification'],
      },
    ],
    tags: ['compliance', 'healthcare', 'hipaa'],
    trust_score: 90,
    metadata: { version: '1.2.0', certified: true },
  },
];

async function seed() {
  console.log('Seeding NEXUS database...');

  // We need a user to own the agents — use service role to bypass RLS
  const { data, error } = await supabase.from('agents').upsert(
    demoAgents.map((agent) => ({
      ...agent,
      // In a real scenario, owner_user_id would come from auth
      // For seeding, this will be set after creating a demo user
      owner_user_id: '00000000-0000-0000-0000-000000000000',
    })),
    { onConflict: 'name' },
  );

  if (error) {
    console.error('Seed error:', error.message);
    process.exit(1);
  }

  console.log(`Seeded ${demoAgents.length} demo agents`);
  console.log(data);
}

seed();
