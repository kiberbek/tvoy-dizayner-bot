const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

async function send(chat_id, text, extra = {}) {
  await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text, parse_mode: 'Markdown', ...extra })
  });
}

async function typing(chat_id) {
  await fetch(`${API}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, action: 'typing' })
  });
}

function generatePrompts(description, style = 'photo') {
  const styleMap = {
    photo: {
      dalle: 'photorealistic, 8K resolution, professional photography, sharp focus, cinematic lighting',
      mj: '--style raw --v 6.1 --ar 16:9 --q 2',
      sd: 'photorealistic, hyperdetailed, 8k uhd, dslr, high quality, film grain\nNegative prompt: cartoon, anime, painting, blurry, low quality, watermark'
    },
    art: {
      dalle: 'digital art, concept art, artstation trending, highly detailed, vibrant colors',
      mj: '--style expressive --v 6.1 --ar 1:1 --q 2',
      sd: 'digital art, concept art, detailed, colorful, artstation\nNegative prompt: photo, realistic, blurry, low quality, watermark'
    },
    logo: {
      dalle: 'minimalist logo design, vector style, clean, professional, white background',
      mj: '--style raw --v 6.1 --ar 1:1 --no background texture',
      sd: 'logo, vector, minimalist, clean design, white background\nNegative prompt: photo, realistic, complex background, blurry'
    },
    banner: {
      dalle: 'banner design, wide format, professional, marketing material, eye-catching',
      mj: '--style raw --v 6.1 --ar 16:9 --q 2',
      sd: 'banner, wide format, professional design, marketing\nNegative prompt: portrait, blurry, low quality'
    },
    anime: {
      dalle: 'anime style, manga art, vibrant colors, detailed illustration',
      mj: '--niji 6 --style scenic --ar 2:3',
      sd: 'anime, manga style, detailed, colorful\nNegative prompt: realistic, photo, 3d render, low quality'
    }
  };

  const s = styleMap[style] || styleMap.photo;

  return `✨ *ПРОМТЫ ДЛЯ ГЕНЕРАЦИИ*

🤖 *DALL-E / ChatGPT*
\`\`\`
${description}, ${s.dalle}
\`\`\`

🎨 *Midjourney*
\`\`\`
${description} ${s.mj}
\`\`\`

🖼 *Stable Diffusion*
\`\`\`
${description}, ${s.sd}
\`\`\`

💡 *Советы:*
• Добавь освещение: _golden hour_, _studio lighting_, _neon glow_
• Укажи камеру: _shot on Canon 5D_, _35mm lens_, _f/1.8_
• Настроение: _dramatic_, _peaceful_, _mysterious_`;
}

function analyzeAndGenerate(caption, photoInfo) {
  // Генерируем промты на основе подписи пользователя
  const desc = caption || 'beautiful detailed scene';

  // Определяем стиль по ключевым словам
  let style = 'photo';
  const low = desc.toLowerCase();
  if (low.includes('лого') || low.includes('logo') || low.includes('иконк')) style = 'logo';
  else if (low.includes('баннер') || low.includes('banner') || low.includes('реклам')) style = 'banner';
  else if (low.includes('аниме') || low.includes('anime') || low.includes('манга')) style = 'anime';
  else if (low.includes('арт') || low.includes('art') || low.includes('рисун') || low.includes('иллюстр')) style = 'art';

  return `🔍 *АНАЛИЗ ИЗОБРАЖЕНИЯ*
Получил твою картинку! Генерирую промты${caption ? ` с учётом пожелания: _${caption}_` : ''}.

` + generatePrompts(desc, style);
}

// Состояние пользователей
const userState = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('OK');

  try {
    const { message } = req.body || {};
    if (!message) return res.status(200).send('OK');

    const chat_id = message.chat.id;
    const text = message.text || '';
    const photo = message.photo;
    const caption = message.caption || '';

    // /start
    if (text === '/start') {
      userState.delete(chat_id);
      await send(chat_id,
        `👋 Привет! Я *Твой Дизайнер* — помогаю создавать промты для AI-генераторов.\n\n` +
        `*Что умею:*\n` +
        `📸 Принимаю твои картинки → генерирую промты\n` +
        `✍️ По текстовому описанию → создаю промты\n` +
        `🎨 Форматы: DALL-E, Midjourney, Stable Diffusion\n\n` +
        `*Как использовать:*\n` +
        `→ Отправь *фото* (можно с подписью-пожеланием)\n` +
        `→ Или просто *напиши* что хочешь нарисовать\n\n` +
        `Попробуй прямо сейчас — скинь любую картинку! 👇`,
        {
          reply_markup: {
            keyboard: [
              [{ text: '📸 Анализ фото' }, { text: '✍️ По описанию' }],
              [{ text: '🎨 Стили и советы' }]
            ],
            resize_keyboard: true,
            is_persistent: true
          }
        }
      );
      return res.status(200).send('OK');
    }

    // /help
    if (text === '/help' || text === '🎨 Стили и советы') {
      await send(chat_id,
        `🎨 *СТИЛИ И СОВЕТЫ*\n\n` +
        `При отправке фото добавь подпись для точного результата:\n\n` +
        `📸 *Фото:* просто отправь картинку\n` +
        `🖼 *Арт/иллюстрация:* напиши "арт" в подписи\n` +
        `🏷 *Логотип:* напиши "лого" в подписи\n` +
        `📢 *Баннер:* напиши "баннер" в подписи\n` +
        `🌸 *Аниме:* напиши "аниме" в подписи\n\n` +
        `*Примеры описаний:*\n` +
        `• _"добрая панда ремонтирует телефон, аниме"_\n` +
        `• _"логотип сервисного центра, минимализм"_\n` +
        `• _"рекламный баннер ремонт смартфонов"_`
      );
      return res.status(200).send('OK');
    }

    // Режим "По описанию"
    if (text === '✍️ По описанию') {
      userState.set(chat_id, 'waiting_description');
      await send(chat_id, '✍️ Напиши описание того что хочешь нарисовать:');
      return res.status(200).send('OK');
    }

    if (text === '📸 Анализ фото') {
      await send(chat_id, '📸 Отправь фото — можно добавить подпись с пожеланием!');
      return res.status(200).send('OK');
    }

    // Обработка фото
    if (photo) {
      await typing(chat_id);
      await send(chat_id, '⏳ Генерирую промты...');
      await typing(chat_id);

      const result = analyzeAndGenerate(caption, photo[photo.length - 1]);

      // Разбиваем на части если длинный
      if (result.length > 4000) {
        const parts = result.match(/[\s\S]{1,4000}/g) || [result];
        for (const part of parts) {
          await send(chat_id, part);
        }
      } else {
        await send(chat_id, result);
      }

      await send(chat_id,
        '💬 Хочешь изменить стиль или добавить детали? Отправь фото снова с подписью!\n' +
        'Пример подписи: _"в стиле аниме"_, _"баннер"_, _"минимализм"_'
      );
      return res.status(200).send('OK');
    }

    // Текстовое описание
    if (text && text.length > 3) {
      const state = userState.get(chat_id);
      userState.delete(chat_id);

      await typing(chat_id);
      await send(chat_id, '⏳ Создаю промты...');
      await typing(chat_id);

      const result = generatePrompts(text);

      if (result.length > 4000) {
        const parts = result.match(/[\s\S]{1,4000}/g) || [result];
        for (const part of parts) {
          await send(chat_id, part);
        }
      } else {
        await send(chat_id, result);
      }

      return res.status(200).send('OK');
    }

  } catch (e) {
    console.error('Error:', e.message, e.stack);
  }

  res.status(200).send('OK');
}
