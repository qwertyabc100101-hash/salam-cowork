export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ===== USERS =====
    if (path === '/api/users' && request.method === 'POST') {
      try {
        const user = await request.json();
        await env.GT_KV.put('user:' + user.id, JSON.stringify(user));
        let list = await env.GT_KV.get('users:list');
        list = list ? JSON.parse(list) : [];
        const idx = list.findIndex(u => u.id === user.id);
        const entry = {id: user.id, nick: user.nick, status: user.status, created: user.created, tgId: user.tgId, tgUsername: user.tgUsername};
        if (idx >= 0) list[idx] = entry; else list.push(entry);
        await env.GT_KV.put('users:list', JSON.stringify(list));
        return json({ok: true}, corsHeaders);
      } catch(e) {
        return json({error: e.message}, corsHeaders, 500);
      }
    }

    if (path === '/api/users' && request.method === 'GET') {
      try {
        const list = await env.GT_KV.get('users:list');
        return json({users: list ? JSON.parse(list) : []}, corsHeaders);
      } catch(e) {
        return json({error: e.message}, corsHeaders, 500);
      }
    }

    if (path === '/api/users/status' && request.method === 'POST') {
      try {
        const {userId, status} = await request.json();
        const userData = await env.GT_KV.get('user:' + userId);
        if (!userData) return json({error: 'User not found'}, corsHeaders, 404);
        const user = JSON.parse(userData);
        user.status = status;
        await env.GT_KV.put('user:' + userId, JSON.stringify(user));
        let list = await env.GT_KV.get('users:list');
        list = list ? JSON.parse(list) : [];
        const idx = list.findIndex(u => u.id === userId);
        if (idx >= 0) list[idx].status = status;
        await env.GT_KV.put('users:list', JSON.stringify(list));
        return json({ok: true}, corsHeaders);
      } catch(e) {
        return json({error: e.message}, corsHeaders, 500);
      }
    }

    if (path === '/api/users/me' && request.method === 'GET') {
      try {
        const userId = url.searchParams.get('id');
        const data = await env.GT_KV.get('user:' + userId);
        return json({user: data ? JSON.parse(data) : null}, corsHeaders);
      } catch(e) {
        return json({error: e.message}, corsHeaders, 500);
      }
    }

    // ===== CHAT HISTORY =====
    if (path === '/api/chat' && request.method === 'POST') {
      try {
        const {userId, role, text} = await request.json();
        let history = await env.GT_KV.get('chat:' + userId);
        history = history ? JSON.parse(history) : [];
        history.push({role, text, time: new Date().toISOString()});
        await env.GT_KV.put('chat:' + userId, JSON.stringify(history));
        return json({ok: true}, corsHeaders);
      } catch(e) {
        return json({error: e.message}, corsHeaders, 500);
      }
    }

    if (path === '/api/chat' && request.method === 'GET') {
      try {
        const userId = url.searchParams.get('userId');
        const data = await env.GT_KV.get('chat:' + userId);
        return json({history: data ? JSON.parse(data) : []}, corsHeaders);
      } catch(e) {
        return json({error: e.message}, corsHeaders, 500);
      }
    }

    // ===== OPENAI PROXY =====
    if (path === '/api/ai' && request.method === 'POST') {
      try {
        if (!env.OPENAI_API_KEY) {
          return json({error: 'OPENAI_API_KEY not set'}, corsHeaders, 500);
        }
        const body = await request.json();
        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.OPENAI_API_KEY},
          body: JSON.stringify(body),
        });
        const data = await openaiRes.json();
        return json(data, corsHeaders, openaiRes.status);
      } catch(e) {
        return json({error: e.message}, corsHeaders, 500);
      }
    }

    return new Response('Not found', {status: 404, headers: corsHeaders});
  }
};

function json(obj, corsHeaders, status=200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {...corsHeaders, 'Content-Type': 'application/json'},
  });
}