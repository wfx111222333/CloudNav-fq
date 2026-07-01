interface Env {
  CLOUDNAV_KV: any;
  CLOUDNAV_R2: any;
  PASSWORD: string;
}

const DEFAULT_PASSWORD = 'cloudnav';
const BG_KEY = 'background_image';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-auth-password',
};

const authenticate = (request: Request, env: Env): boolean => {
  const providedPassword = request.headers.get('x-auth-password');
  const serverPassword = env.PASSWORD || DEFAULT_PASSWORD;
  return providedPassword === serverPassword;
};

export async function onRequestGet(context: { env: Env; request: Request }) {
  const { env } = context;
  if (!env.CLOUDNAV_R2) {
    return new Response(JSON.stringify({ error: 'R2 not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  const object = await env.CLOUDNAV_R2.get(BG_KEY);
  if (!object) {
    return new Response(JSON.stringify({ error: 'No background set' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Cache-Control', 'public, max-age=3600');
  return new Response(object.body, { headers });
}

export async function onRequestPost(context: { env: Env; request: Request }) {
  const { env, request } = context;
  if (!authenticate(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  if (!env.CLOUDNAV_R2) {
    return new Response(JSON.stringify({ error: 'R2 not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  const formData = await request.formData();
  const file = formData.get('file') as File;
  if (!file) {
    return new Response(JSON.stringify({ error: 'No file' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  const fileBytes = await file.arrayBuffer();
  await env.CLOUDNAV_R2.put(BG_KEY, fileBytes, {
    httpMetadata: { contentType: file.type || 'image/jpeg' },
  });
  return new Response(JSON.stringify({ success: true, url: '/api/settings/background?t=' + Date.now() }), {
    status: 201,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

export async function onRequestDelete(context: { env: Env; request: Request }) {
  const { env, request } = context;
  if (!authenticate(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  if (env.CLOUDNAV_R2) {
    await env.CLOUDNAV_R2.delete(BG_KEY);
  }
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
