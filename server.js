require('dotenv').config();

// Отключаем проверку SSL для self-signed сертификатов Sberbank
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const cors = require('cors');
const path = require('path');

// GigaChat API config (Sberbank)
const GIGACHAT_CLIENT_ID = process.env.GIGACHAT_CLIENT_ID;
const GIGACHAT_CLIENT_SECRET = process.env.GIGACHAT_CLIENT_SECRET;
const GIGACHAT_API_URL = 'https://gigachat.devices.sberbank.ru/api/v2/chat/completions';
const GIGACHAT_AUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';

// Кэш для токена авторизации GigaChat
let gigachatAccessToken = null;
let gigachatTokenExpiry = null;

// Функция получения токена авторизации GigaChat
async function getGigachatToken() {
  // Если токен есть и не истёк, возвращаем его
  if (gigachatAccessToken && gigachatTokenExpiry && new Date() < gigachatTokenExpiry) {
    return gigachatAccessToken;
  }

  try {
    const authString = Buffer.from(`${GIGACHAT_CLIENT_ID}:${GIGACHAT_CLIENT_SECRET}`).toString('base64');
    
    const response = await fetch(GIGACHAT_AUTH_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'RqUID': require('crypto').randomUUID()
      },
      body: 'scope=GIGACHAT_API_PERS'
    });

    const data = await response.json();
    
    if (data.access_token) {
      gigachatAccessToken = data.access_token;
      // Токен действителен 30 минут, устанавливаем expiry на 25 минут для запаса
      gigachatTokenExpiry = new Date(Date.now() + 25 * 60 * 1000);
      console.log('GigaChat: получен новый токен авторизации');
      return gigachatAccessToken;
    } else {
      throw new Error('GigaChat: не удалось получить токен');
    }
  } catch (error) {
    console.error('GigaChat auth error:', error);
    throw error;
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Раздаём статические файлы (index.html, CSS, JS)
app.use(express.static(path.join(__dirname)));

// Telegram config
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Функция для экранирования HTML
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Health check endpoint (должен быть ДО wildcard маршрута)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Endpoint для отправки заявок (должен быть ДО wildcard маршрута)
app.post('/api/send-lead', async (req, res) => {
  try {
    const { name, phone, email, company, message } = req.body;

    // Валидация
    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Имя и телефон обязательны'
      });
    }

    // Экранируем пользовательские данные
    const safeName = escapeHtml(name);
    const safePhone = escapeHtml(phone);
    const safeEmail = escapeHtml(email);
    const safeCompany = escapeHtml(company);
    const safeMessage = escapeHtml(message);

    // Формируем сообщение
    const text = `🔔 <b>Новая заявка с сайта Vector AI</b>

👤 <b>Имя:</b> ${safeName}
📱 <b>Телефон:</b> ${safePhone}
📧 <b>Email:</b> ${safeEmail || 'Не указан'}
🏢 <b>Компания:</b> ${safeCompany || 'Не указана'}

💬 <b>Задача:</b>
${safeMessage || 'Не указано'}

#заявка #vector_ai`;

    // Отправляем в Telegram
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: text,
          parse_mode: 'HTML'
        })
      }
    );

    const data = await response.json();

    if (data.ok) {
      res.json({ success: true, message: 'Заявка отправлена' });
    } else {
      console.error('Telegram error:', data);
      res.status(500).json({
        success: false,
        error: data.description || 'Ошибка отправки в Telegram'
      });
    }
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

// Endpoint для отправки отзывов
app.post('/api/review', async (req, res) => {
  try {
    const { name, company, text, rating, hasPhoto } = req.body;

    if (!name || !text || !rating) {
      return res.status(400).json({
        success: false,
        error: 'Имя, текст и оценка обязательны'
      });
    }

    const safeName = escapeHtml(name);
    const safeCompany = escapeHtml(company);
    const safeText = escapeHtml(text);
    const safeRating = parseInt(rating);

    const stars = '⭐'.repeat(safeRating) + '☆'.repeat(5 - safeRating);
    const message = `📝 <b>Новый отзыв!</b>

👤 <b>Имя:</b> ${safeName}
🏢 <b>Компания:</b> ${safeCompany}
⭐ <b>Оценка:</b> ${safeRating}/5 ${stars}

💬 <b>Текст отзыва:</b>
${safeText}

${hasPhoto ? '📎 Фото прикреплено (проверьте Telegram)' : ''}

#отзыв #vector_ai`;

    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'HTML'
        })
      }
    );

    const data = await response.json();

    if (data.ok) {
      res.json({ success: true, message: 'Отзыв отправлен' });
    } else {
      console.error('Telegram error:', data);
      res.status(500).json({
        success: false,
        error: data.description || 'Ошибка отправки в Telegram'
      });
    }
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

// Endpoint для чата с ИИ-агентом (GigaChat)
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Сообщение обязательно'
      });
    }

    // Формируем сообщения для GigaChat
    const systemPrompt = `Ты — ИИ-агент компании Vector AI, эксперт по автоматизации бизнеса с помощью AI-агентов и Telegram-ботов.
Твоя задача:
- Консультировать потенциальных клиентов по возможностям автоматизации
- Помогать определить, какие процессы можно автоматизировать
- Отвечать на вопросы о технологиях, сроках и стоимости
- Быть дружелюбным, профессиональным и полезным

Отвечай кратко (2-4 предложения), по делу, на языке пользователя.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10), // Последние 10 сообщений истории
      { role: 'user', content: message }
    ];

    // Получаем токен авторизации
    const accessToken = await getGigachatToken();

    const response = await fetch(GIGACHAT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        model: 'GigaChat',
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (data.choices && data.choices[0] && data.choices[0].message) {
      res.json({
        success: true,
        message: data.choices[0].message.content
      });
    } else {
      console.error('GigaChat error:', data);
      res.status(500).json({
        success: false,
        error: data.description || data.error?.message || 'Ошибка получения ответа от ИИ'
      });
    }
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Внутренняя ошибка сервера'
    });
  }
});

// Отдаём index.html для всех остальных запросов (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📬 Lead endpoint: POST http://localhost:${PORT}/api/send-lead`);
  console.log(`🌐 Website: http://localhost:${PORT}`);
});
