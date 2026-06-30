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
  const noteId = params.id;
  
  if (!authenticate(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  
  const body = await request.json();
  const data = await env.CLOUDNAV_KV.get('notes_data');
  const notes = data ? JSON.parse(data) : [];
  
  const noteIndex = notes.findIndex((note: any) => note.id === noteId);
  if (noteIndex === -1) {
    return new Response(JSON.stringify({ error: 'Note not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  
  notes[noteIndex] = {
    ...notes[noteIndex],
    ...body,
    updatedAt: Date.now(),
  };
  
  await env.CLOUDNAV_KV.put('notes_data', JSON.stringify(notes));
  
  return new Response(JSON.stringify(notes[noteIndex]), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

export async function onRequestDelete(context: { env: Env; request: Request; params: { id: string } }) {
  const { env, request, params } = context;
  const noteId = params.id;
  
  if (!authenticate(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  
  const data = await env.CLOUDNAV_KV.get('notes_data');
  const notes = data ? JSON.parse(data) : [];
  
  const filteredNotes = notes.filter((note: any) => note.id !== noteId);
  await env.CLOUDNAV_KV.put('notes_data', JSON.stringify(filteredNotes));
  
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
