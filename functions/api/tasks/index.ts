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

export async function onRequestGet(context: { env: Env; request: Request }) {
  const { env, request } = context;

  if (!authenticate(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const data = await env.CLOUDNAV_KV.get('tasks_data');
  const tasks = data ? JSON.parse(data) : [];
  return new Response(JSON.stringify(tasks), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

export async function onRequestPost(context: { env: Env; request: Request }) {
  const { env, request } = context;

  if (!authenticate(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const body = await request.json();
  const data = await env.CLOUDNAV_KV.get('tasks_data');
  const tasks = data ? JSON.parse(data) : [];

  if (!body.title || !body.title.trim()) {
    return new Response(JSON.stringify({ error: '任务名称不能为空' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  if (!body.project || !body.project.trim()) {
    return new Response(JSON.stringify({ error: '项目名称不能为空' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const hasDuplicate = tasks.some(
    (t: any) => t.project === body.project && t.title === body.title.trim() && t.status !== 'closed'
  );
  if (hasDuplicate) {
    return new Response(JSON.stringify({ error: '该项目下已存在相同名称的未关闭任务' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const now = Date.now();
  const newTask = {
    id: now.toString(),
    project: body.project.trim(),
    title: body.title.trim(),
    status: body.status || 'in-progress',
    createdAt: now,
    completedAt: body.status === 'completed' ? now : undefined,
    updatedAt: now,
  };

  tasks.push(newTask);
  await env.CLOUDNAV_KV.put('tasks_data', JSON.stringify(tasks));

  return new Response(JSON.stringify(newTask), {
    status: 201,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
