interface Env {
  CLOUDNAV_KV: any;
  CLOUDNAV_R2: any;
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
  
  const data = await env.CLOUDNAV_KV.get('transfer_messages');
  const messages = data ? JSON.parse(data) : [];
  return new Response(JSON.stringify(messages), {
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
  const data = await env.CLOUDNAV_KV.get('transfer_messages');
  const messages = data ? JSON.parse(data) : [];
  
  const newMessage = {
    id: Date.now().toString(),
    type: body.type || 'text',
    content: body.content || '',
    fileName: body.fileName || '',
    fileSize: body.fileSize || 0,
    createdAt: Date.now(),
    sender: body.sender || 'user',
  };
  
  messages.push(newMessage);
  await env.CLOUDNAV_KV.put('transfer_messages', JSON.stringify(messages));
  
  return new Response(JSON.stringify(newMessage), {
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
