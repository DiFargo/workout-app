# Источники каталога продуктов

Каталог намеренно разделён на две базы. Это не административная форма для
ручного пополнения: данные собираются один раз из документированных источников,
проверяются сборщиком и поставляются вместе с приложением.

В текущей проверенной сборке — 7 500 справочных продуктов USDA и 21 057
товарных SKU из Open Food Facts: всего 28 557 записей. В слой SKU входят
прежние 1 570 записей и 19 487 новых товарных позиций из очищенной выгрузки.
Из 19 508 кандидатов не включена 21 запись с физически невозможным КБЖУ на
100 г — это ошибка исходных данных, а не округление до целевого числа.

## Русский поиск

Русский язык является основным языком интерфейса и поиска. Виден
русскоязычный вариант названия; исходное название из источника остаётся
алиасом, поэтому поиск по английскому названию продолжает работать. При
отсутствии готового русского заголовка локализуется только отображаемое имя —
исходник, бренд, код товара и КБЖУ сохраняются отдельно без изменений.

## Обычные продукты

Слой `reference` строится из официального набора USDA FoodData Central SR Legacy.
Это справочные продукты без штрихкода: фрукты, овощи, крупы, мясо и другие
нейтральные позиции. USDA публикует эти данные как CC0. В каждой записи хранится
FDC ID и ссылка на её исходную страницу. Этот слой нужен, чтобы поиск находил
бананы, яблоки и другие обычные продукты, которые не обязаны быть белорусским
брендированным SKU.

Исходный набор и команда:

```text
https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip
node scripts/import-usda-sr-legacy-reference.mjs --input <sr-legacy.json> --output data/nutrition-catalog-sources/usda-sr-legacy-reference-expanded.json --limit 7500 --min-records 7500
node scripts/build-nutrition-catalog.mjs --input data/nutrition-catalog-sources/usda-sr-legacy-reference-expanded.json --out data/nutrition-catalog-build/reference-expanded --min-records 7500
```

## Товарные позиции Беларуси и СНГ

Слой `sku` строится из открытого экспорта Open Food Facts (ODbL-1.0). В него
принимаются только записи, у которых есть:

- GTIN либо числовой товарный код источника длиной 8–14 цифр;
- отображаемое русскоязычное имя или русское описание;
- КБЖУ на 100 г: энергия, белки, жиры и углеводы;
- URL исходной карточки и дата выгрузки.

Фильтр использует `countries_tags`: сначала `en:belarus`, затем `en:russia`.
Тег России означает только то, что это поле так отмечено источником; он не
доказывает наличие товара в белорусской продаже. Фото этикетки сохраняется как
дополнительное доказательство, когда оно есть, но не требуется.

```text
https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz
node scripts/import-openfoodfacts-catalog.mjs --input <products.csv.gz> --output data/nutrition-catalog-sources/openfoodfacts-cis-skus.json --format tsv --limit 1570 --min-records 1570 --markets belarus,russia
node scripts/build-nutrition-catalog.mjs --input data/nutrition-catalog-sources/openfoodfacts-cis-skus.json --out data/nutrition-catalog-build/sku --min-records 1570
node scripts/build-localized-nutrition-catalog.mjs
```

При распространении слоя SKU необходимо сохранять атрибуцию Open Food Facts и
соблюдать условия ODbL. Полные данные и доказательства для каждой позиции
лежат в `foods.full.json` и `provenance.json`; runtime-поиск получает только
компактную копию и индексы.

## Защита от выдуманных позиций

`scripts/build-nutrition-catalog.mjs` останавливает сборку при неполном КБЖУ,
оценках, повторяющемся источнике или отсутствии URL/даты проверки. Строгая
проверка GTIN остаётся обязательной по умолчанию; числовые коды допускаются
только для документированного слоя Open Food Facts и явно отмечаются в его
метаданных. Небольшой compatibility-набор `src/data/nutritionFoods.js` тоже
состоит из записей USDA без синтетических штрихкодов; он не считается частью
основного каталога и не добавляется в новые runtime-файлы.
