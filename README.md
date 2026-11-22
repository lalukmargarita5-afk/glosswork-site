# GLOSSWORK — сайт детейлинг-студии

Одностраничный сайт на чистом HTML, CSS и JavaScript, без сборки и фреймворков.

- `index.html` — разметка страницы
- `styles.css` — стили
- `main.js` — анимации (туннель, фары, параллакс, карточки услуг) и отправка заявок
- `assets/` — фото, шрифты, графика
- `google-script-zayavki.gs` — код Google Apps Script: заявки с сайта попадают в Google Таблицу и приходят письмом
- `PRODUCT.md` — о студии: услуги, цены, аудитория, принципы
- `DESIGN.md`, `.impeccable/design.json` — дизайн-система: цвета, шрифты, компоненты, правила
- `.impeccable/surfaces/index-html.md` — бриф главной страницы
- `.claude/launch.json` — запуск локального сервера для предпросмотра

## Как открыть

Откройте `index.html` через любой локальный сервер, например:

```
python -m http.server 5173
```

и зайдите на http://localhost:5173

## Как выложить

Перетащите папку с этими файлами на https://app.netlify.com/drop
