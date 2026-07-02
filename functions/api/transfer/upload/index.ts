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

export async function onRequestPost(context: { env: Env; request: Request }) {
  const { env, request } = context;
  
  if (!authenticate(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  
  if (!request.body) {
    return new Response(JSON.stringify({ error: 'No body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  
  if (!env.CLOUDNAV_R2) {
    return new Response(JSON.stringify({ error: 'R2 bucket not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const thumbnail = formData.get('thumbnail') as File | null;
    const folder = (formData.get('folder') as string) || '';

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const fileName = file.name;
    const fileBytes = await file.arrayBuffer();

    await env.CLOUDNAV_R2.put(fileName, fileBytes, {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream',
      },
    });

    const isImage = file.type.startsWith('image/');
    const fileUrl = `/api/transfer/file/${fileName}`;

    // 存储缩略图（若提供），用于图片显示；原图保留用于下载
    let thumbnailUrl: string | undefined;
    if (isImage && thumbnail) {
      const thumbName = `${fileName}_thumb.jpg`;
      const thumbBytes = await thumbnail.arrayBuffer();
      await env.CLOUDNAV_R2.put(thumbName, thumbBytes, {
        httpMetadata: {
          contentType: 'image/jpeg',
        },
      });
      thumbnailUrl = `/api/transfer/file/${thumbName}`;
    }

    const data = await env.CLOUDNAV_KV.get('transfer_messages');
    const messages = data ? JSON.parse(data) : [];

    const newMessage = {
      id: Date.now().toString(),
      type: isImage ? 'image' : 'file',
      // 显示用缩略图（若有），否则用原图
      content: thumbnailUrl || fileUrl,
      fileName: file.name,
      fileSize: file.size,
      createdAt: Date.now(),
      sender: 'user',
      folder: folder,
      // 保存原图URL用于下载
      originalUrl: thumbnailUrl ? fileUrl : undefined,
    };

    messages.push(newMessage);
    await env.CLOUDNAV_KV.put('transfer_messages', JSON.stringify(messages));

    return new Response(JSON.stringify({
      success: true,
      fileName: file.name,
      fileUrl,
      thumbnailUrl,
      isImage,
      message: newMessage,
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Upload failed: ${(err as Error).message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
