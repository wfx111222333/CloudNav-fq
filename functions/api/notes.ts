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

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};

const authenticate = (request: Request, env: Env): boolean => {
  const providedPassword = request.headers.get('x-auth-password');
  const serverPassword = env.PASSWORD || DEFAULT_PASSWORD;
  return providedPassword === serverPassword;
};

export const onRequestGet = async (context: { env: Env; request: Request }) => {
  const { env, request } = context;
  
  if (!authenticate(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  
  try {
    const data = await env.CLOUDNAV_KV.get('notes_data');
    const notes = data ? JSON.parse(data) : [];
    return new Response(JSON.stringify(notes), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch notes' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

export const onRequestPost = async (context: { env: Env; request: Request }) => {
  const { env, request } = context;
  
  if (!authenticate(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  
  try {
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
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to create note' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

export const onRequestPut = async (context: { env: Env; request: Request }) => {
  const { env, request } = context;
  
  if (!authenticate(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  
  try {
    const url = new URL(request.url);
    const noteId = url.pathname.split('/').pop();
    
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
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to update note' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

export const onRequestDelete = async (context: { env: Env; request: Request }) => {
  const { env, request } = context;
  
  if (!authenticate(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  
  try {
    const url = new URL(request.url);
    const noteId = url.pathname.split('/').pop();
    
    const data = await env.CLOUDNAV_KV.get('notes_data');
    const notes = data ? JSON.parse(data) : [];
    
    const filteredNotes = notes.filter((note: any) => note.id !== noteId);
    await env.CLOUDNAV_KV.put('notes_data', JSON.stringify(filteredNotes));
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to delete note' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};
