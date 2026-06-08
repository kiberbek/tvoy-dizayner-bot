export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

async function send(chat_id, text, extra = {}) {
  try {
    await fetch(`${API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text, parse_mode: 'Markdown', ...extra })
    });
  } catch(e) { console.error('send error:', e.message); }
}

async function typing(chat_id) {
  try {
    await fetch(`${API}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, action: 'typing' })
    });
  } catch(e) {}
}

function generatePrompts(description, style = 'photo') {
  const styles = {
    photo:  { q: 'photorealistic, 8K, professional photography, sharp focus, cinematic lighting', mj: '--style raw --v 6.1 --ar 16:9 --q 2', sd: 'photorealistic, hyperdetailed, 8k uhd, high quality\nNegative prompt: cartoon, blurry, watermark, low quality' },
    art:    { q: 'digital art, concept art, artstation trending, highly detailed, vibrant colors', mj: '--style expressive --v 6.1 --ar 1:1 --q 2', sd: 'digital art, concept art, detailed, colorful\nNegative prompt: photo, blurry, watermark' },
    logo:   { q: 'minimalist logo design, vector style, clean, professional, white background', mj: '--style raw --v 6.1 --ar 1:1 --no texture', sd: 'logo, vector, minimalist, white background\nNegative prompt: photo, complex background, blurry' },
    banner: { q: 'banner design, wide format, professional marketing, eye-catching', mj: '--style raw --v 6.1 --ar 16:9 --q 2', sd: 'banner, wide format, professional design\nNegative prompt: portrait, blurry, low quality' },
    anime:  { q: 'anime style, manga art, vibrant colors, detailed illustration', mj: '--niji 6 --style scenic --ar 2:3', sd: 'anime, manga style, detailed, colorful\nNegative prompt: realistic, photo, 3d render' },
  };
  const s = styles[style] || styles.photo;
  return `✨ *ПРОМТЫ ГОТОВЫ*\n\n🤖 *DALL-E / ChatGPT*\n\`\`\`\n${description}, ${s.q}\n\`\`\`\n\n🎨 *Midjourney*\n\`\`\`\n${description} ${s.mj}\n\`\`\`\n\n🖼 *Stable Diffusion*\n\`\`\`\n${description}, ${s.sd}\n\`\`\`\n\n💡 *Советы:*\n• Освещение: _golden hour_, _studio lighting_, _neon glow_\n• Камера: _shot on Canon 5D_, _35mm lens_, _f/1.8_\n• Настроение: _dramatic_, _peaceful_, _mysterious_`;
}

function detectStyle(text) {
  const t = (text||'').toLowerCase();
  if (t.includes('лого') || t.includes('logo') || t.includes('иконк')) return 'logo';
  if (t.includes('баннер') || t.includes('banner') || t.includes('реклам')) return 'banner';
  if (t.includes('аниме') || t.includes('anime') || t.includes('манга')) return 'anime';
  if (t.includes('арт') || t.includes('art') || t.includes('рисун') || t.includes('иллюстр')) return 'art';
  return 'photo';
}

export default async function handler(req, res) {
  // Всегда отвечаем 200 сразу — Telegram не будет повторять
  res.status(200).send('OK');

  if (req.method !== 'POST') return;

  try {
    const body = req.body;
    console.log('Incoming body type:', typeof body, 'keys:', body ? Object.keys(body) : 'null');

    const message = body?.message;
    if (!message) {
      console.log('No message in body');
      return;
    }

    const chat_id = message.chat?.id;
    const text = message.text || '';
    const photo = message.photo;
    const caption = message.caption || '';

    console.log(`chat_id=${chat_id}, text="${text}", has_photo=${!!photo}`);

    if (!chat_id) return;

    // /start
    if (text === '/start') {
      await send(chat_id,
        `👋 Привет! Я *Твой Дизайнер*\n\n` +
        `Помогаю создавать промты для AI-генераторов изображений.\n\n` +
        `*Как использовать:*\n` +
        `📸 Отправь *фото* — получи промты\n` +
        `✍️ Напиши *описание* — создам промты\n\n` +
        `*Стили* (добавь в подпись к фото):\n` +
        `• _аниме_ — anime стиль\n` +
        `• _арт_ — digital art\n` +
        `• _лого_ — логотип\n` +
        `• _баннер_ — рекламный баннер\n\n` +
        `Скинь любое фото прямо сейчас! 👇`,
        {
          reply_markup: {
            keyboard: [[{ text: '✍️ Написать описание' }, { text: '🎨 Советы' }]],
            resize_keyboard: true,
            is_persistent: true
          }
        }
      );
      return;
    }

    // Советы
    if (text === '🎨 Советы' || text === '/help') {
      await send(chat_id,
        `🎨 *СОВЕТЫ ПО ПРОМТАМ*\n\n` +
        `*Ключевые слова для стиля:*\n` +
        `• _cinematic, dramatic lighting_ — кино\n` +
        `• _minimalist, clean_ — минимализм\n` +
        `• _vintage, retro_ — ретро\n` +
        `• _futuristic, cyberpunk_ — будущее\n` +
        `• _watercolor, oil painting_ — живопись\n\n` +
        `*Для фото:*\n` +
        `• _shot on iPhone 16 Pro_ — реализм\n` +
        `• _bokeh background_ — размытый фон\n` +
        `• _golden hour_ — закатный свет\n\n` +
        `*Для Midjourney добавляй:*\n` +
        `\`--ar 16:9\` широкий формат\n` +
        `\`--ar 1:1\` квадрат\n` +
        `\`--style raw\` реалистичнее`
      );
      return;
    }

    // Фото
    if (photo && photo.length > 0) {
      await typing(chat_id);
      console.log('Processing photo, caption:', caption);

      const style = detectStyle(caption);
      const desc = caption || 'beautiful detailed scene, professional quality';
      const result = `🔍 *Фото получено!*\nСтиль определён: *${style}*\n\n` + generatePrompts(desc, style);

      await send(chat_id, result);
      await send(chat_id, `💬 Добавь подпись к следующему фото чтобы уточнить стиль!\nПример: _"панда с телефоном, аниме"_`);
      return;
    }

    // Текст — генерим промты
    if (text && text.length > 2 && text !== '✍️ Написать описание') {
      await typing(chat_id);
      console.log('Processing text:', text);
      const style = detectStyle(text);
      const result = generatePrompts(text, style);
      await send(chat_id, result);
      return;
    }

    if (text === '✍️ Написать описание') {
      await send(chat_id, '✍️ Напиши что хочешь нарисовать — и я создам промты для всех генераторов:');
      return;
    }

  } catch (e) {
    console.error('Handler error:', e.message, e.stack);
  }
}
