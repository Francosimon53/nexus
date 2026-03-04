import Link from 'next/link';
import { WorkflowBuilder } from './workflow-builder';

export default function NewWorkflowPage() {
  return (
    <div>
      <Link href="/workflows" className="mb-4 inline-block text-sm text-nexus-400 hover:text-nexus-300">
        &larr; Back to Workflows
      </Link>
      <h1 className="mb-6 text-2xl font-bold">New Workflow</h1>
      <WorkflowBuilder />
    </div>
  );
}
