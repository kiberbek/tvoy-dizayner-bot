const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.TELEGRAM_TOKEN;
if (!TOKEN) { console.error('TELEGRAM_TOKEN not set!'); process.exit(1); }

const bot = new TelegramBot(TOKEN, { polling: true });
console.log('Bot started with polling...');

function prompts(desc, style) {
  const S = {
    photo:  ['photorealistic, 8K, cinematic lighting, professional photography', '--style raw --v 6.1 --ar 16:9 --q 2', 'photorealistic, 8k, sharp\nNegative prompt: cartoon, blurry, watermark'],
    art:    ['digital art, concept art, artstation, vibrant colors, highly detailed', '--style expressive --v 6.1 --ar 1:1 --q 2', 'digital art, concept art, detailed\nNegative prompt: photo, blurry'],
    logo:   ['minimalist logo, vector style, clean, white background', '--style raw --v 6.1 --ar 1:1', 'logo, vector, minimalist\nNegative prompt: photo, complex background'],
    banner: ['banner design, wide format, professional, eye-catching', '--style raw --v 6.1 --ar 16:9', 'banner, wide format, professional\nNegative prompt: portrait, blurry'],
    anime:  ['anime style, manga art, vibrant, detailed illustration', '--niji 6 --style scenic --ar 2:3', 'anime, manga style, detailed\nNegative prompt: realistic, photo'],
  };
  const s = S[style] || S.photo;
  return `✨ *ПРОМТЫ ГОТОВЫ*\n\n` +
    `🤖 *DALL\\-E / ChatGPT*\n\`\`\`\n${desc}, ${s[0]}\n\`\`\`\n\n` +
    `🎨 *Midjourney*\n\`\`\`\n${desc} ${s[1]}\n\`\`\`\n\n` +
    `🖼 *Stable Diffusion*\n\`\`\`\n${desc}, ${s[2]}\n\`\`\`\n\n` +
    `💡 _Добавляй: golden hour, bokeh, dramatic, f/1\\.8_`;
}

function detectStyle(t) {
  t = (t||'').toLowerCase();
  if (t.includes('лого')||t.includes('logo')||t.includes('иконк')) return 'logo';
  if (t.includes('баннер')||t.includes('banner')||t.includes('реклам')) return 'banner';
  if (t.includes('аниме')||t.includes('anime')||t.includes('манга')) return 'anime';
  if (t.includes('арт')||t.includes('art')||t.includes('рисун')||t.includes('иллюстр')) return 'art';
  return 'photo';
}

const KB = {
  reply_markup: {
    keyboard: [[{text:'✍️ Описание'},{text:'🎨 Советы'}]],
    resize_keyboard: true,
    is_persistent: true
  }
};

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
    '👋 Привет\\! Я *Твой Дизайнер*\n\n' +
    '📸 Отправь *фото* → получи промты для DALL\\-E, Midjourney, Stable Diffusion\n' +
    '✍️ Напиши *описание* → создам промты\n\n' +
    '*Стили* \\(добавь в подпись к фото\\):\n' +
    '_аниме, арт, лого, баннер_\n\n' +
    'Скинь любое фото прямо сейчас\\! 👇',
    { parse_mode: 'MarkdownV2', ...KB }
  );
});

bot.onText(/🎨 Советы|\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    '🎨 *Советы по промтам*\n\n' +
    '• _cinematic_ — кинематографично\n' +
    '• _minimalist_ — минимализм\n' +
    '• _golden hour_ — закатный свет\n' +
    '• _bokeh_ — размытый фон\n' +
    '• _shot on iPhone_ — реализм\n\n' +
    '*Midjourney параметры:*\n' +
    '`\\-\\-ar 16:9` широкий формат\n' +
    '`\\-\\-ar 1:1` квадрат\n' +
    '`\\-\\-style raw` реалистичнее',
    { parse_mode: 'MarkdownV2' }
  );
});

bot.onText(/✍️ Описание/, (msg) => {
  bot.sendMessage(msg.chat.id, '✍️ Напиши что хочешь нарисовать:');
});

// Фото
bot.on('photo', (msg) => {
  const cap = msg.caption || '';
  const st = detectStyle(cap);
  const desc = cap || 'beautiful scene, professional quality';
  bot.sendChatAction(msg.chat.id, 'typing');
  const text = `🔍 Стиль определён: *${st}*\n\n` + prompts(desc, st) + '\n\n💬 _Добавь подпись к фото для точного результата\\!_';
  bot.sendMessage(msg.chat.id, text, { parse_mode: 'MarkdownV2' });
});

// Текст
bot.on('text', (msg) => {
  const txt = msg.text || '';
  if (txt.startsWith('/') || txt === '✍️ Описание' || txt === '🎨 Советы') return;
  if (txt.length < 3) return;
  bot.sendChatAction(msg.chat.id, 'typing');
  const st = detectStyle(txt);
  bot.sendMessage(msg.chat.id, prompts(txt, st), { parse_mode: 'MarkdownV2' });
});

bot.on('polling_error', (err) => console.error('Polling error:', err.message));
console.log('Bot is ready!');
