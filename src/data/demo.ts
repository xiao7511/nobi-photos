import type { Category, Photo } from '../domain/models'
const scenes: [string, string, Category, string, string[]][] = [
  ['山野之间', 'mountains', '自然', '川西', ['山', '绿色', '远足', '风景']],
  ['海风来信', 'coast', '旅行', '大理', ['海', '蓝色', '夏天', '风景']],
  ['午后的光', 'room', '生活', '杭州', ['家', '阳光', '窗', '安静']],
  ['绿意漫步', 'forest', '自然', '莫干山', ['森林', '绿色', '树', '远足']],
  ['城市留白', 'building', '建筑', '上海', ['城市', '建筑', '白色', '旅行']],
  ['日落收藏家', 'sunset', '旅行', '洱海', ['日落', '海', '橙色', '风景']],
  ['一杯慢时光', 'coffee', '生活', '杭州', ['咖啡', '日常', '安静']],
  ['风吹过的夏天', 'meadow', '自然', '川西', ['草地', '山', '绿色', '夏天']],
  ['沿海公路', 'road', '旅行', '青岛', ['海', '公路', '蓝色', '夏天']],
  ['山野之间 · 另一刻', 'mountains', '自然', '川西', ['山', '绿色', '远足', '风景']],
  ['街角花事', 'flowers', '生活', '杭州', ['花', '粉色', '日常']],
  ['向着山的方向', 'lake', '自然', '新疆', ['湖', '山', '蓝色', '风景']],
]
export function createDemoPhotos(): Photo[] {
  return scenes.map(([title, scene, category, location, tags], i) => ({
    id: `demo-${i + 1}`,
    title,
    thumbnail: `/art/${scene}.svg`,
    takenAt: `2026-10-${i < 6 ? '18' : '12'}T0${i % 9}:30:00+08:00`,
    location,
    category,
    tags: [...tags],
    favorite: [0, 4, 7].includes(i),
    width: 900,
    height: [1100, 700, 900, 1050, 740, 1020][i % 6]!,
    bytes: (i + 2) * 420000,
    source: 'demo',
    ...([0, 9].includes(i) ? { duplicateGroup: 'demo-mountain-pair' } : {}),
  }))
}
