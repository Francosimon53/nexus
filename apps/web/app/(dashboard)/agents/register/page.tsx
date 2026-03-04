import { RegisterAgentForm } from './register-form';

export default function RegisterAgentPage() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Register Agent</h1>
      <p className="mb-8 text-text-secondary">Add a new agent to the NEXUS registry.</p>
      <RegisterAgentForm />
    </div>
  );
}
