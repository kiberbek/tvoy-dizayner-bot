export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

const TOKEN = process.env.TELEGRAM_TOKEN;

async function tg(method, params) {
  const url = `https://api.telegram.org/bot${TOKEN}/${method}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const text = await r.text();
  console.log(`tg.${method} status=${r.status} body=${text.slice(0,200)}`);
  return JSON.parse(text);
}

function prompts(desc, style) {
  const S = {
    photo:  ['photorealistic, 8K, cinematic lighting, professional photography', '--style raw --v 6.1 --ar 16:9', 'photorealistic, 8k, sharp\nNegative prompt: cartoon, blurry, watermark'],
    art:    ['digital art, concept art, artstation, vibrant colors, highly detailed', '--style expressive --v 6.1 --ar 1:1', 'digital art, concept art, detailed\nNegative prompt: photo, blurry'],
    logo:   ['minimalist logo, vector style, clean, white background', '--style raw --v 6.1 --ar 1:1', 'logo, vector, minimalist\nNegative prompt: photo, complex background'],
    banner: ['banner design, wide format, professional, eye-catching', '--style raw --v 6.1 --ar 16:9', 'banner, wide format, professional\nNegative prompt: portrait, blurry'],
    anime:  ['anime style, manga art, vibrant, detailed illustration', '--niji 6 --style scenic --ar 2:3', 'anime, manga style, detailed\nNegative prompt: realistic, photo'],
  };
  const s = S[style] || S.photo;
  return `✨ *ПРОМТЫ ГОТОВЫ*\n\n` +
    `🤖 *DALL-E*\n\`${desc}, ${s[0]}\`\n\n` +
    `🎨 *Midjourney*\n\`${desc} ${s[1]}\`\n\n` +
    `🖼 *Stable Diffusion*\n\`${desc}, ${s[2]}\`\n\n` +
    `💡 Добавляй: _golden hour_, _bokeh_, _dramatic_, _f/1.8_`;
}

function style(t) {
  t = (t||'').toLowerCase();
  if (t.includes('лого')||t.includes('logo')||t.includes('иконк')) return 'logo';
  if (t.includes('баннер')||t.includes('banner')||t.includes('реклам')) return 'banner';
  if (t.includes('аниме')||t.includes('anime')||t.includes('манга')) return 'anime';
  if (t.includes('арт')||t.includes('art')||t.includes('рисун')||t.includes('иллюстр')) return 'art';
  return 'photo';
}

export default async function handler(req, res) {
  res.status(200).send('OK');
  if (req.method !== 'POST') return;

  try {
    const msg = req.body?.message;
    if (!msg) { console.log('no message, body:', JSON.stringify(req.body).slice(0,200)); return; }

    const cid = msg.chat?.id;
    const txt = msg.text || '';
    const photo = msg.photo;
    const cap = msg.caption || '';

    console.log(`MSG cid=${cid} txt="${txt}" photo=${!!photo} cap="${cap}"`);

    if (!cid) return;

    if (txt === '/start') {
      await tg('sendMessage', {
        chat_id: cid,
        text: '👋 Привет! Я *Твой Дизайнер*\n\n📸 Отправь фото → получи промты\n✍️ Напиши описание → создам промты\n\n*Стили* (добавь в подпись):\n_аниме, арт, лого, баннер_',
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [[{text:'✍️ Описание'},{text:'🎨 Советы'}]],
          resize_keyboard: true, is_persistent: true
        }
      });
      return;
    }

    if (txt === '🎨 Советы' || txt === '/help') {
      await tg('sendMessage', {
        chat_id: cid,
        parse_mode: 'Markdown',
        text: '🎨 *Советы*\n\n• _cinematic_ — кино\n• _minimalist_ — минимализм\n• _golden hour_ — закат\n• _bokeh_ — размытый фон\n• _shot on iPhone_ — реализм\n\n*Midjourney:*\n`--ar 16:9` широкий\n`--ar 1:1` квадрат\n`--style raw` реалистично'
      });
      return;
    }

    if (photo?.length > 0) {
      await tg('sendChatAction', {chat_id: cid, action: 'typing'});
      const desc = cap || 'beautiful scene, professional quality';
      const st = style(cap);
      const text = `🔍 Стиль: *${st}*\n\n` + prompts(desc, st) + '\n\n💬 Добавь подпись к фото для точного результата!';
      await tg('sendMessage', { chat_id: cid, text, parse_mode: 'Markdown' });
      return;
    }

    if (txt && txt.length > 2 && txt !== '✍️ Описание') {
      await tg('sendChatAction', {chat_id: cid, action: 'typing'});
      const st = style(txt);
      await tg('sendMessage', { chat_id: cid, text: prompts(txt, st), parse_mode: 'Markdown' });
      return;
    }

    if (txt === '✍️ Описание') {
      await tg('sendMessage', { chat_id: cid, text: '✍️ Напиши что хочешь нарисовать:' });
      return;
    }

  } catch(e) {
    console.error('ERR:', e.message, e.stack);
  }
}
