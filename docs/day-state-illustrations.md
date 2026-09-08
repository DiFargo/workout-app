# Иллюстрации состояния дня — 3.0.687

## Сердце из стрелок восстановления — 3.0.691

- [x] По выбранному пользователем референсу обычное сердце заменено на три стрелки, образующие контур сердца. Кодовый SVG `RecoveryHeartIcon.jsx`: 28 px, синий `currentColor`, скруглённые линии 1,5 px, без тени и яркой заливки.
- [x] Размещение в карточке, состояния дня и все действия сохранены; декоративный знак скрыт от скринридера. Иконки шапок не возвращаются.
- [x] Production build, целевой ESLint, проверка production-артефакта и размера сборки пройдены. Успешны 2 мобильных E2E-теста: действия сводки и шесть состояний дня; снимок экрана восстановления на 375 px просмотрен. Зависшее завершение тестового сервера Windows остановлено после успешных результатов.
- [x] После подтверждения пользователя 7 сентября 2026 опубликована [версия 3.0.691](https://tren-85720.web.app/?release=3.0.691), только Firebase Hosting `tren-85720`. Публичный HTML — HTTP 200; SHA-256 entry и JS/CSS интерфейса, заголовков и питания совпадают с проверенной сборкой. Новый SVG встроен в `appTheme`, отдельной загрузки нет. Серверная часть, правила и пользовательские данные не менялись.

## Выбранное маленькое сердечко — 3.0.689

- [x] После сравнения двух макетов пользователь выбрал сердечко. Для отдыха, свободного дня и восстановления после тренировки используется Heart из существующей Lucide; тренировочные состояния сохраняют гантель.
- [x] Размер обоих значков 28 × 28 px в месте 36 × 32 px. Синий контур 1,5 px и лёгкая голубая заливка повторяют выбранный макет. Следуя UI/UX, значки принадлежат одной семье, не требуют отдельной загрузки и не увеличивают карточку.
- [x] Тексты, основные действия, обработчики и доступность сохранены; декоративные значки скрыты от скринридера. Исторические файлы иллюстраций не удалялись.
- [x] Сборка, целевой ESLint и 4 E2E-теста пройдены: пять вкладок на 320/375 px, действия сводки и шесть состояний дня. Сердечко визуально проверено на 375 px; это эмуляция, не физический iPhone. Остановлено зависшее завершение Windows-сервера после успешных результатов тестов.
- [x] 7 сентября 2026 опубликована [версия 3.0.689](https://tren-85720.web.app/?release=3.0.689), только Firebase Hosting `tren-85720`. Публичный HTML — HTTP 200; SHA-256 entry и JS/CSS интерфейса и питания совпадают с проверенной сборкой. Сердечко встроено в JS интерфейса, дополнительный файл не загружается. Серверная часть и пользовательские данные не менялись.

## Плоская графика — 3.0.688

По замечанию пользователя объёмные картинки заменены на небольшие векторные иллюстрации: спокойный синий контур, лёгкая голубая заливка, без теней, блеска и движения. Рекомендации UI/UX и Emil применены к единству визуального языка и сдержанности декоративного акцента.

- [x] [Батарея](../public/illustrations/day-state/recovery-battery-line-v1.svg) и [гантель](../public/illustrations/day-state/training-line-v1.svg) используют единый размер и толщину линий. SVG созданы как кодовые UI-элементы, без новой генерации растровых изображений.
- [x] Распределение по состояниям дня, текст, действия, доступность и геометрия карточки сохранены. Прежние файлы сохранены, но больше не используются карточкой.
- [x] Production build, SVG/JSX и целевые мобильные проверки пройдены. Все 6 E2E-тестов успешны: ширины 320/375/421/768 px, действия сводки и шесть состояний дня. Оба снимка на 375 px просмотрены. Зависшее завершение Windows-сервера остановлено после результатов.
- [x] 7 сентября 2026 опубликована [версия 3.0.688](https://tren-85720.web.app/?release=3.0.688), Hosting-only `tren-85720`. Публичная страница отвечает HTTP 200; SHA-256 entry, JS/CSS интерфейса и питания и двух новых SVG совпадают с проверенной сборкой. Функции, правила и данные не менялись.

Ниже сохранена история предыдущего варианта.

## Приёмка

- [x] Утверждённые гантель и батарея заменяют эмодзи в главной карточке.
- [x] Батарея используется для отдыха, свободного дня и восстановления после завершения; гантель — для тренировочных состояний.
- [x] Текст статуса, кнопки и обработчики не изменены. Картинки декоративные и скрыты от скринридера.
- [x] Фиксированное место для иллюстрации не увеличивает высоту карточки. WebP сохраняет прозрачность.
- [x] Production build и scoped ESLint проходят.
- [x] Шесть состояний, основные переходы и мобильная геометрия проверены.

Проверены шесть целевых E2E-тестов: все пять вкладок на 320, 375, 421 и 768 px, действия сводки и шесть состояний дня с загрузкой настоящих файлов иллюстраций. Снимки тренировки и восстановления на 375 px просмотрены. Это браузерная эмуляция, не физический iPhone. После успешных результатов остановлено зависшее завершение тестового Windows-сервера.

## Публикация

7 сентября 2026 по отдельному подтверждению пользователя опубликована [версия 3.0.687](https://tren-85720.web.app/?release=3.0.687), только Firebase Hosting проекта `tren-85720`. Серверные функции, правила доступа и пользовательские данные не изменялись.

- [x] Production artifact проверен на соответствие проекту; начальная загрузка 62,02 KiB gzip при лимите 100 KiB.
- [x] Firebase CLI подтвердил успешный выпуск.
- [x] Публичная страница отвечает HTTP 200 и ссылается на новый entry bundle. SHA-256 опубликованных JS/CSS интерфейса, питания и обеих иллюстраций совпадает с проверенной локальной сборкой.

Мобильные сценарии проверены перед публикацией на изолированном стенде, без изменения записей пользователя.

## Изображения

Созданы встроенным ImageGen. CLI/API для генерации не использовались. Sharp использован только для уменьшения и WebP-кодирования готовых изображений без изменения дизайна.

- [Батарея — исходный PNG](../output/imagegen/day-illustrations-v1/recovery-day-battery-v3.png)
- [Гантель — исходный PNG](../output/imagegen/day-illustrations-v1/training-day.png)
- [Батарея — runtime WebP](../public/illustrations/day-state/recovery-battery-v1.webp)
- [Гантель — runtime WebP](../public/illustrations/day-state/training-v1.webp)
- [Первоначальный набор промптов](../output/imagegen/day-illustrations-v1/prompts.md)

## Промпт батареи

Use case: stylized-concept.
Asset type: original miniature illustration for a REST AND RECOVERY day card in a calm iOS-inspired fitness app.
Primary request: visualize recharging energy as a beautifully designed three-dimensional charging battery.
Subject: one compact horizontal rounded-rectangle battery with a small terminal on its right. A thick porcelain-white soft rounded casing frames a recessed front face, about two-thirds filled with muted slate-blue energy. A single simple porcelain-white lightning bolt is centered on the blue face, clearly indicating charging. The battery should be a bespoke sculptural illustration, not a screenshot of a system battery indicator and not an AA cylinder.
Style: premium restrained matte 3D product illustration, smooth tactile porcelain and soft-touch rubber, gently beveled edges, refined industrial design. Match a companion matte blue dumbbell with a porcelain-white grip. Not a standard emoji or childish toy.
Palette: low-saturation blue #3F73B8 / #3C6FAA, pale blue #DFE7F2, porcelain off-white #F2F2F7. No green, yellow, neon, oversaturation or luminous glow.
Composition: square, centered single subject at a subtle three-quarter orthographic angle, filling 78% of the frame with all edges comfortably inside. Strong simple silhouette and few large details, readable at 48–64 pixels.
Lighting: soft upper-left studio light, gentle local shading, no heavy cast shadow.
Background: genuinely transparent alpha, no backdrop, no floor, no baked-in checkerboard.
Avoid: text, percentages, numerals, letters, cables, plug, faces, stars, sparkles, extra objects, logos, watermark, surrounding app UI or card.

## Уточнение края

Use case: precise-object-edit.
Edit target: the supplied blue-and-white charging battery illustration.
Change ONLY the transparency edge cleanup. Remove every isolated white speck, ragged fringe and stray opaque artifact outside the battery silhouette, especially above the top rim, below the bottom rim and along the left edge.
Preserve the exact battery design, shape, perspective, blue charge fill, white lightning bolt, matte material, lighting, composition and scale. Do not redesign or add any objects.
Keep a genuinely transparent alpha background. The cutout must have a smooth clean antialiased silhouette suitable for compositing on a pale blue mobile app card. No backdrop, no checkerboard, no glow, no floor or cast shadow.

## Финальное удаление технического фона

Use case: background-extraction. Edit target: this exact approved matte blue and porcelain-white charging battery. Remove ONLY the gray and white checkerboard backdrop. Deliver an RGBA PNG with REAL TRANSPARENT ALPHA outside the battery silhouette, not a picture of checkerboard squares and not a white rectangle. Preserve the exact battery shape, blue color, white lightning bolt, scale, materials and perspective. Clean smooth antialiased outer edges, no fringe, no stray white specks. No added objects, text, shadows, floor or backdrop.
