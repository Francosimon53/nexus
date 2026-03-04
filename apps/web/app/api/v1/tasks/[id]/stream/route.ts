import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { checkTimeout } from '@/lib/task-timeout';
import { isTerminal } from '@/lib/task-status';
import type { TaskStatus } from '@nexus-protocol/shared';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POLL_INTERVAL_MS = 2000;
const MAX_STREAM_MS = 5 * 60 * 1000; // 5 minutes

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return new Response('Invalid task ID', { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const startTime = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`event: status\ndata: ${JSON.stringify(data)}\n\n`));
      };

      let lastStatus = '';

      while (Date.now() - startTime < MAX_STREAM_MS) {
        const { data: task } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', id)
          .single();

        if (!task) {
          controller.enqueue(encoder.encode(`event: error\ndata: {"error":"Task not found"}\n\n`));
          break;
        }

        await checkTimeout(supabase, task);

        // Send update if status changed or first poll
        if (task.status !== lastStatus) {
          send(task);
          lastStatus = task.status as string;
        }

        if (isTerminal(task.status as TaskStatus)) break;

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
