import type { AgentCard, RegisterAgentInput } from '@nexus-protocol/shared';

export function generateAgentCard(input: RegisterAgentInput): AgentCard {
  return {
    name: input.name,
    description: input.description ?? '',
    url: input.endpoint,
    version: '1.0.0',
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    skills: input.skills.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      tags: s.tags ?? [],
      examples: [],
    })),
    authentication: { schemes: ['bearer'] },
  };
}
