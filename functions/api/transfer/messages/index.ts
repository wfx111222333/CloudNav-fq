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

  const url = new URL(request.url);
  const params = url.searchParams;
  const type = params.get('type');
  const days = params.get('days');
  const before = params.get('before');
  const limit = parseInt(params.get('limit') || '50');

  const data = await env.CLOUDNAV_KV.get('transfer_messages');
  const allMessages = data ? JSON.parse(data) : [];

  // 模式1: ?type=file — 返回所有非文本消息（用于文件管理标签）
  if (type === 'file') {
    const fileMsgs = allMessages
      .filter((m: any) => m.type !== 'text')
      .sort((a: any, b: any) => a.createdAt - b.createdAt);
    return new Response(JSON.stringify({ messages: fileMsgs, total: fileMsgs.length, hasMore: false }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // 模式2: ?before=<timestamp>&limit=N — 加载更早的历史消息
  if (before) {
    const beforeTs = parseInt(before);
    const older = allMessages
      .filter((m: any) => m.createdAt < beforeTs)
      .sort((a: any, b: any) => b.createdAt - a.createdAt)
      .slice(0, limit)
      .reverse();
    const totalCount = allMessages.filter((m: any) => m.createdAt < beforeTs).length;
    const hasMore = totalCount > limit;
    return new Response(JSON.stringify({ messages: older, total: allMessages.length, hasMore }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // 模式3: ?days=N (默认7天) — 返回最近N天的消息
  const dayCount = parseInt(days || '7');
  const cutoff = Date.now() - dayCount * 86400000;
  const recent = allMessages
    .filter((m: any) => m.createdAt >= cutoff)
    .sort((a: any, b: any) => a.createdAt - b.createdAt);
  const hasMore = allMessages.some((m: any) => m.createdAt < cutoff);
  return new Response(JSON.stringify({ messages: recent, total: allMessages.length, hasMore }), {
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
