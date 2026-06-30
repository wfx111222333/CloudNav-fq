interface Env {
  CLOUDNAV_KV: any;
  PASSWORD: string;
  TRANSFER_R2_BUCKET: any;
}

const DEFAULT_PASSWORD = 'cloudnav';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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

const isImage = (filename: string): boolean => {
  const ext = filename.toLowerCase().split('.').pop();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext || '');
};

const getFileExtension = (filename: string): string => {
  return filename.toLowerCase().split('.').pop() || '';
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
    const url = new URL(request.url);
    const path = url.pathname;
    
    if (path.includes('/messages')) {
      const data = await env.CLOUDNAV_KV.get('transfer_messages');
      const messages = data ? JSON.parse(data) : [];
      return new Response(JSON.stringify(messages), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    
    return new Response(JSON.stringify({ error: 'Invalid path' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch messages' }), {
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
    const url = new URL(request.url);
    const path = url.pathname;
    
    if (path.includes('/upload')) {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return new Response(JSON.stringify({ error: 'No file provided' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
      
      const timestamp = Date.now();
      const extension = getFileExtension(file.name);
      const filename = `${timestamp}-${Math.random().toString(36).substring(2, 15)}.${extension}`;
      
      const fileBytes = await file.arrayBuffer();
      const fileType = file.type || 'application/octet-stream';
      
      await env.TRANSFER_R2_BUCKET.put(filename, fileBytes, {
        httpMetadata: {
          contentType: fileType,
        },
      });
      
      const url = new URL(request.url);
      const fileUrl = `${url.origin}/api/transfer/file/${filename}`;
      const imageFlag = isImage(file.name);
      
      return new Response(JSON.stringify({
        success: true,
        url: fileUrl,
        filename: file.name,
        fileSize: file.size,
        isImage: imageFlag,
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    
    if (path.includes('/messages')) {
      const body = await request.json();
      const data = await env.CLOUDNAV_KV.get('transfer_messages');
      const messages = data ? JSON.parse(data) : [];
      
      const newMessage = {
        id: Date.now().toString(),
        type: body.type || 'text',
        content: body.content || '',
        fileName: body.fileName || undefined,
        fileSize: body.fileSize || undefined,
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
    
    return new Response(JSON.stringify({ error: 'Invalid path' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to process request' }), {
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
    const path = url.pathname;
    
    if (path.includes('/messages')) {
      const messageId = path.split('/').pop();
      
      const data = await env.CLOUDNAV_KV.get('transfer_messages');
      const messages = data ? JSON.parse(data) : [];
      
      const filteredMessages = messages.filter((msg: any) => msg.id !== messageId);
      await env.CLOUDNAV_KV.put('transfer_messages', JSON.stringify(filteredMessages));
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    
    if (path.includes('/file')) {
      const filename = path.split('/').pop();
      
      if (filename) {
        await env.TRANSFER_R2_BUCKET.delete(filename);
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    
    return new Response(JSON.stringify({ error: 'Invalid path' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to delete' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

export const onRequest = async (context: { env: Env; request: Request }) => {
  const { env, request } = context;
  const url = new URL(request.url);
  
  if (request.method === 'GET' && url.pathname.startsWith('/api/transfer/file/')) {
    const filename = url.pathname.replace('/api/transfer/file/', '');
    
    try {
      const object = await env.TRANSFER_R2_BUCKET.get(filename);
      
      if (!object) {
        return new Response('File not found', { status: 404 });
      }
      
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('Access-Control-Allow-Origin', '*');
      
      return new Response(object.body, { headers });
    } catch (err) {
      return new Response('Failed to fetch file', { status: 500 });
    }
  }
  
  return new Response('Not found', { status: 404 });
};
