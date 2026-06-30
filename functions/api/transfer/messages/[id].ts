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
  const messageId = params.id;

  if (!authenticate(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const body = await request.json();
  const data = await env.CLOUDNAV_KV.get('transfer_messages');
  const messages = data ? JSON.parse(data) : [];

  const messageIndex = messages.findIndex((m: any) => m.id === messageId);
  if (messageIndex === -1) {
    return new Response(JSON.stringify({ error: 'Message not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  messages[messageIndex] = {
    ...messages[messageIndex],
    ...body,
    updatedAt: Date.now(),
  };

  await env.CLOUDNAV_KV.put('transfer_messages', JSON.stringify(messages));

  return new Response(JSON.stringify(messages[messageIndex]), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

export async function onRequestDelete(context: { env: Env; request: Request; params: { id: string } }) {
  const { env, request, params } = context;
  const messageId = params.id;

  if (!authenticate(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const data = await env.CLOUDNAV_KV.get('transfer_messages');
  const messages = data ? JSON.parse(data) : [];

  const filteredMessages = messages.filter((m: any) => m.id !== messageId);
  await env.CLOUDNAV_KV.put('transfer_messages', JSON.stringify(filteredMessages));

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
