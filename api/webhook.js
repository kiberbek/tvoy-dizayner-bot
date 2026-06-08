const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const OWNER_ID = 499297541; // @keryakrsk

const API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

async function sendMessage(chat_id, text, extra = {}) {
  await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text, parse_mode: 'Markdown', ...extra })
  });
}

async function sendTyping(chat_id) {
  await fetch(`${API}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, action: 'typing' })
  });
}

async function getFileUrl(file_id) {
  const res = await fetch(`${API}/getFile?file_id=${file_id}`).then(r => r.json());
  return `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${res.result.file_path}`;
}

async function analyzeImage(imageUrl, userPrompt = '') {
  // Скачиваем изображение
  const imgRes = await fetch(imageUrl);
  const imgBuffer = await imgRes.arrayBuffer();
  const base64 = Buffer.from(imgBuffer).toString('base64');
  const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';

  const systemPrompt = `Ты — профессиональный дизайнер и эксперт по AI-генерации изображений.
Твоя задача — анализировать изображения и создавать точные, детальные промты для генерации похожих или улучшенных изображений.

Всегда отвечай в следующем формате:

🔍 *АНАЛИЗ ИЗОБРАЖЕНИЯ*
[Краткое описание что на картинке: стиль, объекты, цвета, настроение]

✨ *ПРОМТ ДЛЯ DALL-E / ChatGPT*
\`\`\`
[Детальный промт на английском языке]
\`\`\`

🎨 *ПРОМТ ДЛЯ MIDJOURNEY*
\`\`\`
[Промт с параметрами Midjourney --ar --style --v]
\`\`\`

🖼 *ПРОМТ ДЛЯ STABLE DIFFUSION*
\`\`\`
[Промт с негативными словами: Negative prompt: ...]
\`\`\`

💡 *СОВЕТЫ ПО УЛУЧШЕНИЮ*
[2-3 конкретных совета как сделать картинку лучше]

Если пользователь написал пожелание — учти его в промтах.`;

  const userContent = [
    {
      type: 'image',
      source: { type: 'base64', media_type: mimeType, data: base64 }
    },
    {
      type: 'text',
      text: userPrompt
        ? `Проанализируй это изображение и создай промты. Пожелание пользователя: ${userPrompt}`
        : 'Проанализируй это изображение и создай промты для генерации похожего или улучшенного изображения.'
    }
  ];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }]
    })
  });

  const data = await res.json();
  return data.content?.[0]?.text || 'Не удалось проанализировать изображение.';
}

async function generatePrompt(text) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 1500,
      system: `Ты — профессиональный дизайнер и эксперт по AI-генерации изображений.
По текстовому описанию создавай готовые промты для разных AI-генераторов.
Отвечай в формате с промтами для DALL-E, Midjourney и Stable Diffusion.
Всегда добавляй советы по стилю.`,
      messages: [{
        role: 'user',
        content: `Создай промты для генерации изображения: ${text}`
      }]
    })
  });

  const data = await res.json();
  return data.content?.[0]?.text || 'Не удалось создать промт.';
}

// Хранилище ожидающих пользователей (ждут пожелание после фото)
const waitingForCaption = new Map();

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
      await sendMessage(chat_id,
        `👋 Привет! Я *Твой Дизайнер* — AI-агент для работы с изображениями.\n\n` +
        `*Что я умею:*\n` +
        `📸 Анализирую твои картинки и генерирую промты\n` +
        `✍️ Создаю промты по текстовому описанию\n` +
        `🎨 Даю советы по улучшению дизайна\n\n` +
        `*Как использовать:*\n` +
        `→ Отправь мне *фото* — получишь промты для DALL-E, Midjourney и Stable Diffusion\n` +
        `→ Напиши *описание* — создам готовый промт\n\n` +
        `Попробуй — просто скинь любую картинку! 👇`,
        {
          reply_markup: {
            keyboard: [[{ text: '📸 Отправить фото' }], [{ text: '✍️ Написать описание' }]],
            resize_keyboard: true,
            is_persistent: true
          }
        }
      );
      return res.status(200).send('OK');
    }

    // Обработка фото
    if (photo) {
      await sendTyping(chat_id);

      // Берём фото максимального размера
      const bestPhoto = photo[photo.length - 1];
      const fileUrl = await getFileUrl(bestPhoto.file_id);

      await sendMessage(chat_id, '🔍 Анализирую изображение... Это займёт 10-20 секунд.');
      await sendTyping(chat_id);

      const result = await analyzeImage(fileUrl, caption);

      // Telegram ограничивает 4096 символов — разбиваем если нужно
      if (result.length > 4000) {
        const parts = result.match(/.{1,4000}/gs) || [result];
        for (const part of parts) {
          await sendMessage(chat_id, part);
        }
      } else {
        await sendMessage(chat_id, result);
      }

      await sendMessage(chat_id,
        '💬 Хочешь изменить промт? Напиши пожелание и отправь картинку снова с подписью.'
      );

      return res.status(200).send('OK');
    }

    // Текстовый запрос на генерацию промта
    if (text && text !== '📸 Отправить фото' && text !== '✍️ Написать описание') {
      await sendTyping(chat_id);
      await sendMessage(chat_id, '✨ Создаю промты по твоему описанию...');
      await sendTyping(chat_id);

      const result = await generatePrompt(text);

      if (result.length > 4000) {
        const parts = result.match(/.{1,4000}/gs) || [result];
        for (const part of parts) {
          await sendMessage(chat_id, part);
        }
      } else {
        await sendMessage(chat_id, result);
      }

      return res.status(200).send('OK');
    }

    // Подсказка
    if (text === '✍️ Написать описание') {
      await sendMessage(chat_id, '✍️ Напиши что хочешь нарисовать — и я создам промты для всех генераторов.');
    } else if (text === '📸 Отправить фото') {
      await sendMessage(chat_id, '📸 Отправь фото прямо в этот чат — я его проанализирую!');
    }

  } catch (e) {
    console.error('Error:', e.message);
  }

  res.status(200).send('OK');
}
