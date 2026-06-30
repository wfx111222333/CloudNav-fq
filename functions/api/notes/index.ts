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
  
  const data = await env.CLOUDNAV_KV.get('notes_data');
  const notes = data ? JSON.parse(data) : [];
  return new Response(JSON.stringify(notes), {
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
  const data = await env.CLOUDNAV_KV.get('notes_data');
  const notes = data ? JSON.parse(data) : [];
  
  const newNote = {
    id: Date.now().toString(),
    content: body.content || '',
    color: body.color || '#fef3c7',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pinned: body.pinned || false,
  };
  
  notes.push(newNote);
  await env.CLOUDNAV_KV.put('notes_data', JSON.stringify(notes));
  
  return new Response(JSON.stringify(newNote), {
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
