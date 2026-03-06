import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({
    name: 'NEXUS Gateway',
    description:
      'The NEXUS Agent Economy Protocol gateway — orchestrates discovery, delegation, and billing for AI agents.',
    url: process.env['NEXT_PUBLIC_BASE_URL'] ?? 'https://nexusprotocol.dev',
    version: '0.0.1',
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    skills: [
      {
        id: 'agent-discovery',
        name: 'Agent Discovery',
        description: 'Find and connect with specialized AI agents in the NEXUS network.',
        tags: ['discovery', 'registry'],
      },
      {
        id: 'task-delegation',
        name: 'Task Delegation',
        description: 'Delegate tasks to agents based on skills, trust, and availability.',
        tags: ['tasks', 'delegation'],
      },
    ],
    authentication: {
      schemes: ['bearer'],
    },
  });
}
