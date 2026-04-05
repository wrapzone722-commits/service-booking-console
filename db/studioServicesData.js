/**
 * Каталог услуг студии «Другое место» — тексты и ориентиры по ценам как на маркетинговом сайте.
 * Картинки: /site-assets/*.png (лежат в public/site-assets).
 */
export const STUDIO_SERVICES = [
  {
    id: 'dm_protective_films',
    name: 'Защитные плёнки',
    description:
      'Оклейка антигравийной плёнкой PPF и винилом: зоны риска, фары, стойки, элементы кузова и полноценные проекты под защиту и внешний вид.',
    price: 75000,
    duration: 180,
    category: 'Услуги студии',
    image_url: '/site-assets/service-ppf.png',
  },
  {
    id: 'dm_ceramic',
    name: 'Керамика и гидрофоб',
    description:
      'Защитные составы для кузова, дисков и внешнего пластика. Добавляем глубину цвета, гидрофобный эффект и защиту от повседневной эксплуатации.',
    price: 45000,
    duration: 240,
    category: 'Услуги студии',
    image_url: '/site-assets/service-ceramic.png',
  },
  {
    id: 'dm_polish',
    name: 'Полировка кузова',
    description:
      'Восстановительная и финишная полировка для удаления потёртостей, голограмм и тусклости. Возвращаем лаку глубину и аккуратный блеск.',
    price: 25000,
    duration: 180,
    category: 'Услуги студии',
    image_url: '/site-assets/service-polish.png',
  },
  {
    id: 'dm_interior',
    name: 'Химчистка салона',
    description:
      'Глубокая очистка сидений, ковров, потолка, пластика и кожи. Удаляем загрязнения, запахи и возвращаем салону аккуратный свежий вид.',
    price: 12000,
    duration: 180,
    category: 'Услуги студии',
    image_url: '/site-assets/service-interior.png',
  },
  {
    id: 'dm_wash',
    name: 'Детейлинг мойка',
    description:
      'Безопасная мойка кузова, дисков, проёмов и деликатных зон с правильной химией и аккуратной сушкой без лишнего риска для ЛКП.',
    price: 3500,
    duration: 90,
    category: 'Мойка',
    image_url: '/site-assets/service-wash.png',
  },
  {
    id: 'dm_pdr',
    name: 'Правка вмятин без окраса',
    description:
      'Деликатное устранение небольших вмятин без перекраса, когда это позволяет характер повреждения. Сохраняем заводское покрытие и внешний вид элемента.',
    price: 6000,
    duration: 120,
    category: 'Услуги студии',
    image_url: '/site-assets/service-local-repair.png',
  },
  {
    id: 'dm_sale_prep',
    name: 'Подготовка к продаже',
    description:
      'Комплексное приведение автомобиля в порядок перед продажей: мойка, очистка, полировка, салон и визуальные доработки для сильной первой оценки.',
    price: 0,
    duration: 360,
    category: 'Услуги студии',
    image_url: '/site-assets/service-sale-prep.png',
  },
  {
    id: 'dm_branding',
    name: 'Брендирование транспорта и дизайн',
    description:
      'Разрабатываем визуальную концепцию и выполняем оклейку коммерческого транспорта, чтобы автомобиль работал как заметный и аккуратный носитель бренда.',
    price: 0,
    duration: 480,
    category: 'Услуги студии',
    image_url: '/site-assets/service-branding.png',
  },
  {
    id: 'dm_ppf_city',
    name: 'Городской комплекс PPF',
    description:
      'Оптика, капот, полоса на крышу, стойки лобового, передний бампер и крылья, зоны ручек дверей, зона выгрузки (задний бампер). Ориентир для городской эксплуатации.',
    price: 75000,
    duration: 300,
    category: 'PPF и винил',
    image_url: '/site-assets/service-ppf.png',
  },
  {
    id: 'dm_ppf_full',
    name: 'Полный комплекс PPF',
    description:
      'Оклейка всего кузова полиуретановой плёнкой под лак. Единая защита ЛКП от сколов, царапин, реагентов и выцветания по всему периметру.',
    price: 180000,
    duration: 720,
    category: 'PPF и винил',
    image_url: '/site-assets/service-ppf.png',
  },
  {
    id: 'dm_ppf_color',
    name: 'Смена цвета (винил)',
    description:
      'Полное изменение цвета и фактуры кузова винилом: мат, сатин, глянец и др. Заводской лак остаётся под плёнкой — при снятии возвращаем исходный вид.',
    price: 190000,
    duration: 960,
    category: 'PPF и винил',
    image_url: '/site-assets/service-ppf.png',
  },
  {
    id: 'dm_ppf_design',
    name: 'Дизайн и акцентная оклейка',
    description:
      'Акценты, контрастные зоны, графика и нестандартные раскладки. Прорабатываем эскиз и визуал до старта работ, чтобы результат совпал с вашей идеей.',
    price: 0,
    duration: 720,
    category: 'PPF и винил',
    image_url: '/site-assets/service-ppf.png',
  },
  {
    id: 'dm_windshield',
    name: 'Защита лобового стекла (плёнка)',
    description:
      'Прозрачная полиуретановая плёнка на лобовое стекло против сколов от камней и мелких повреждений. Снижает риск трещин и дорогостоящей замены.',
    price: 21000,
    duration: 120,
    category: 'PPF и винил',
    image_url: '/site-assets/service-ppf.png',
  },
  {
    id: 'dm_turnkey',
    name: 'Комплексный проект «под ключ»',
    description:
      'Полный цикл работ по согласованной смете: подбираем состав услуг под задачу и сроки. Точная стоимость после осмотра.',
    price: 0,
    duration: 1440,
    category: 'Комплексы',
    image_url: '/site-assets/service-concierge.png',
  },
];
