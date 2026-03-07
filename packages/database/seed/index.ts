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
    name: 'VLayer HIPAA Scanner',
    description:
      'Scans code and GitHub repos for HIPAA compliance violations. Detects PHI exposure, missing encryption, insecure endpoints, and 163+ rules.',
    endpoint: process.env['VLAYER_AGENT_ENDPOINT'] ?? 'http://localhost:4003',
    status: 'online' as const,
    skills: [
      {
        id: 'hipaa-scan',
        name: 'HIPAA Scan',
        description: 'Full HIPAA compliance scan of a codebase',
        tags: ['hipaa', 'compliance', 'healthcare', 'security'],
      },
      {
        id: 'phi-detection',
        name: 'PHI Detection',
        description: 'Detect exposed Protected Health Information',
        tags: ['hipaa', 'phi', 'healthcare'],
      },
      {
        id: 'compliance-audit',
        name: 'Compliance Audit',
        description: 'Generate HIPAA compliance audit report',
        tags: ['hipaa', 'compliance', 'audit'],
      },
    ],
    tags: ['hipaa', 'compliance', 'healthcare', 'security'],
    trust_score: 90,
    price_per_task: 50,
    metadata: { version: '1.0.0', provider: 'vlayer', runtime: 'node' },
  },
  {
    name: 'SecureAgent',
    description:
      'Multi-capability AI agent by secureagent.app — multi-channel chat, task scheduling, code generation, and browser automation.',
    endpoint: process.env['SECUREAGENT_ENDPOINT'] ?? 'http://localhost:4200',
    status: 'online' as const,
    skills: [
      {
        id: 'multi-channel-chat',
        name: 'Multi-Channel AI Chat',
        description:
          'Conversational AI across web, Slack, Discord, and API with context-aware memory',
        tags: ['chat', 'ai', 'conversational', 'multi-channel'],
      },
      {
        id: 'task-scheduling',
        name: 'Task Scheduling',
        description:
          'Schedule and automate recurring tasks with cron-like precision, dependencies, and conditional triggers',
        tags: ['scheduling', 'automation', 'tasks', 'cron'],
      },
      {
        id: 'code-generation',
        name: 'Code Generation',
        description:
          'Generate, refactor, and review code across multiple languages with full-file and targeted edit support',
        tags: ['code', 'generation', 'development', 'refactoring'],
      },
      {
        id: 'browser-automation',
        name: 'Browser Automation',
        description:
          'Automate browser interactions — navigate, fill forms, extract data, and take screenshots via headless browsers',
        tags: ['browser', 'automation', 'scraping', 'testing'],
      },
    ],
    tags: ['chat', 'automation', 'code', 'browser', 'ai'],
    trust_score: 88,
    price_per_task: 25,
    metadata: { version: '1.0.0', provider: 'secureagent.app', runtime: 'node' },
  },
  {
    name: 'Simon Assistant',
    description:
      'A production OpenClaw personal agent with 26+ skills including web search, browser automation, image generation, audio transcription, video processing, marketing strategy, weather, health checks, and proactive monitoring. Runs 24/7 with uptime monitoring, Reddit alerts, and morning briefings.',
    endpoint: process.env['SIMON_ASSISTANT_ENDPOINT'] ?? 'http://localhost:4400',
    status: 'online' as const,
    skills: [
      {
        id: 'web-search',
        name: 'Web Search',
        description: 'Search the web via Brave API and return structured results',
        tags: ['search', 'web', 'brave'],
      },
      {
        id: 'browser-automation',
        name: 'Browser Automation',
        description: 'Navigate websites, take screenshots, click elements, fill forms',
        tags: ['browser', 'automation', 'scraping'],
      },
      {
        id: 'image-generation',
        name: 'Image Generation',
        description: 'Generate images with DALL-E (prompt to image)',
        tags: ['image', 'generation', 'dall-e', 'media'],
      },
      {
        id: 'audio-transcription',
        name: 'Audio Transcription',
        description: 'Transcribe audio files via OpenAI Whisper',
        tags: ['audio', 'transcription', 'whisper', 'media'],
      },
      {
        id: 'video-processing',
        name: 'Video Processing',
        description: 'Extract frames from videos at specific timestamps',
        tags: ['video', 'frames', 'media', 'processing'],
      },
      {
        id: 'marketing-strategy',
        name: 'Marketing Strategy',
        description: '23 marketing strategies: SEO, copywriting, ads, conversion optimization',
        tags: ['marketing', 'seo', 'copywriting', 'ads', 'strategy'],
      },
      {
        id: 'text-humanizer',
        name: 'Text Humanizer',
        description: 'Detect and rewrite AI-generated text to sound human',
        tags: ['text', 'humanizer', 'rewriting', 'ai-detection'],
      },
      {
        id: 'weather-lookup',
        name: 'Weather Lookup',
        description: 'Current weather and forecast for any location',
        tags: ['weather', 'forecast', 'location'],
      },
      {
        id: 'security-audit',
        name: 'Security Audit',
        description: 'Run security health checks on hosts and infrastructure',
        tags: ['security', 'audit', 'health-check', 'infrastructure'],
      },
      {
        id: 'avatar-video',
        name: 'Avatar Video',
        description: 'Create AI avatar videos with HeyGen',
        tags: ['avatar', 'video', 'heygen', 'media'],
      },
    ],
    tags: ['productivity', 'automation', 'marketing', 'monitoring', 'media'],
    trust_score: 85,
    price_per_task: 15,
    metadata: {
      version: '1.0.0',
      provider: 'openclaw',
      runtime: 'node',
      telegram: '@Simon_Assistant_bot',
      verified: true,
    },
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
