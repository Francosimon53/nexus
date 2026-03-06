import { createClient } from '@supabase/supabase-js';
import type { AgentCard } from '@nexus-protocol/shared';

const SUPABASE_URL = process.env['SUPABASE_URL'];
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function generateAgentCard(agent: {
  name: string;
  description: string;
  endpoint: string;
  skills: { id: string; name: string; description: string; tags: string[] }[];
}): AgentCard {
  return {
    name: agent.name,
    description: agent.description,
    url: agent.endpoint,
    version: '1.0.0',
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    skills: agent.skills.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      tags: s.tags,
      examples: [],
    })),
    authentication: { schemes: ['bearer'] },
  };
}

const demoAgents = [
  {
    name: 'Echo Agent',
    description: 'A simple agent that echoes back any input it receives. Useful for testing.',
    endpoint: 'http://localhost:4100',
    status: 'online' as const,
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
    price_per_task: 0,
    metadata: { version: '1.0.0', runtime: 'node' },
  },
  {
    name: 'NEXUS Summarizer',
    description: 'Summarizes any text or document into concise key points using Claude.',
    endpoint: process.env['SUMMARIZER_ENDPOINT'] ?? 'http://localhost:4002',
    status: 'online' as const,
    skills: [
      {
        id: 'summarize',
        name: 'Summarize',
        description: 'Summarize any text or document into concise key points',
        tags: ['nlp', 'summarization', 'productivity'],
      },
    ],
    tags: ['nlp', 'summarization', 'productivity'],
    trust_score: 85,
    price_per_task: 10,
    metadata: { version: '1.0.0', model: 'claude-sonnet-4-5-20250929', runtime: 'node' },
  },
  {
    name: 'HIPAA Classifier',
    description: 'Classifies documents for HIPAA-sensitive content and flags PHI.',
    endpoint: 'http://localhost:4102',
    status: 'offline' as const,
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
    price_per_task: 0,
    metadata: { version: '1.2.0', certified: true },
  },
];

async function seed() {
  console.log('Seeding NEXUS database...');

  // Create demo user via auth.admin (handle "already exists" gracefully)
  const DEMO_EMAIL = 'demo@nexus-protocol.dev';
  let demoUserId: string;

  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find((u) => u.email === DEMO_EMAIL);

  if (existing) {
    demoUserId = existing.id;
    console.log(`Demo user already exists: ${demoUserId}`);
  } else {
    const { data: newUser, error: userError } = await supabase.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: 'nexus-demo-2024',
      email_confirm: true,
    });

    if (userError) {
      console.error('Failed to create demo user:', userError.message);
      process.exit(1);
    }

    demoUserId = newUser.user.id;
    console.log(`Created demo user: ${demoUserId}`);
  }

  // Delete existing agents for this user before re-seeding
  await supabase.from('agents').delete().eq('owner_user_id', demoUserId);

  // Insert demo agents with agent_card and last_heartbeat
  const rows = demoAgents.map((agent) => ({
    ...agent,
    owner_user_id: demoUserId,
    agent_card: generateAgentCard(agent),
    last_heartbeat: agent.status === 'online' ? new Date().toISOString() : null,
  }));

  const { data, error } = await supabase.from('agents').insert(rows).select('*');

  if (error) {
    console.error('Seed error:', error.message);
    process.exit(1);
  }

  console.log(`Seeded ${data.length} demo agents for user ${demoUserId}`);
  for (const agent of data) {
    console.log(`  - ${agent.name} (${agent.id}) [${agent.status}]`);
  }
}

seed();
