# История изменений проекта Vector AI Landing

## 2026-03-04 — Рефакторинг: вынесение CSS в отдельный файл

### Что сделано:
- Вынесены все стили из `index.html` в отдельный файл `style.css`
- `index.html`: 2497 строк → **681 строка**
- `style.css`: **1814 строк** (новый файл)

### Структура проекта:
```
landings/
├── index.html      (HTML структура, 681 строка)
├── style.css       (все стили, 1814 строк)
├── server.js       (сервер для Telegram форм)
├── package.json
├── .env            (переменные окружения, не коммитить!)
└── render.yaml     (конфигурация Render)
```

### Команда для деплоя:
```bash
git add .
git commit -m "Описание изменений"
git push origin main
```

### Переменные окружения на Render:
| Ключ | Значение |
|------|----------|
| `TELEGRAM_BOT_TOKEN` | (токен бота) |
| `TELEGRAM_CHAT_ID` | (ваш chat ID) |
| `NODE_ENV` | production |
| `PORT` | 3000 |

---

## Полезные команды

### Локальный запуск:
```bash
cd /Users/loveyou/Desktop/landings
npm install
npm start
# или
node server.js
```

### Проверка количества строк:
```bash
wc -l index.html style.css
```

### Git команды:
```bash
git status          # показать изменения
git log --oneline   # история коммитов
git diff            # показать изменения в файлах
```

---

## Контакты
- Telegram: @VectorDev001
- GitHub: IgrayMoyaIgrushka
