require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

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

// Отдаём index.html для всех остальных запросов (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📬 Lead endpoint: POST http://localhost:${PORT}/api/send-lead`);
  console.log(`🌐 Website: http://localhost:${PORT}`);
});
