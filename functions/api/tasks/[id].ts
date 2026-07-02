interface Env {
  CLOUDNAV_KV: any;
  PASSWORD: string;
}

const DEFAULT_PASSWORD = 'cloudnav';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-auth-password',
};

const authenticate = (request: Request, env: Env): boolean => {
  const providedPassword = request.headers.get('x-auth-password');
  const serverPassword = env.PASSWORD || DEFAULT_PASSWORD;
  return providedPassword === serverPassword;
};

export async function onRequestPut(context: { env: Env; request: Request; params: { id: string } }) {
  const { env, request, params } = context;
  const taskId = params.id;

  if (!authenticate(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const body = await request.json();
  const data = await env.CLOUDNAV_KV.get('tasks_data');
  const tasks = data ? JSON.parse(data) : [];

  const taskIndex = tasks.findIndex((t: any) => t.id === taskId);
  if (taskIndex === -1) {
    return new Response(JSON.stringify({ error: 'Task not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const oldTask = tasks[taskIndex];
  const newStatus = body.status || oldTask.status;
  const now = Date.now();

  let completedAt = oldTask.completedAt;
  if (newStatus === 'completed' && oldTask.status !== 'completed') {
    completedAt = now;
  } else if (newStatus !== 'completed') {
    completedAt = undefined;
  }

  tasks[taskIndex] = {
    ...oldTask,
    ...body,
    status: newStatus,
    completedAt,
    updatedAt: now,
  };

  await env.CLOUDNAV_KV.put('tasks_data', JSON.stringify(tasks));

  return new Response(JSON.stringify(tasks[taskIndex]), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

export async function onRequestDelete(context: { env: Env; request: Request; params: { id: string } }) {
  const { env, request, params } = context;
  const taskId = params.id;

  if (!authenticate(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const data = await env.CLOUDNAV_KV.get('tasks_data');
  const tasks = data ? JSON.parse(data) : [];

  const filteredTasks = tasks.filter((t: any) => t.id !== taskId);
  await env.CLOUDNAV_KV.put('tasks_data', JSON.stringify(filteredTasks));

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
