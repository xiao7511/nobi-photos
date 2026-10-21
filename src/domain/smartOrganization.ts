import type { Photo } from './models'
import type { UserAlbum } from './organization'

export interface ImageLabel {
  label: string
  confidence: number
}
export interface SmartSuggestion {
  key: string
  name: string
  photoIds: string[]
  confidence: number
}
export interface SmartAlbumPlan {
  albums: UserAlbum[]
  added: number
}
// General visual topics only. No face identity, demographics, health or location inference.
const topics = [
  {
    key: 'animals',
    name: '宠物与动物',
    words: [
      'animal',
      'pet',
      'dog',
      'cat',
      'bird',
      'fish',
      'retriever',
      'terrier',
      'hound',
      'poodle',
      'spaniel',
      'shepherd',
      'collie',
      'husky',
      'wolf',
      'fox',
      'tiger',
      'lion',
      'bear',
      'rabbit',
      'hare',
      'panda',
      'penguin',
      'parrot',
      'macaw',
      'butterfly',
      'horse',
      'zebra',
      'elephant',
      'giraffe',
      'turtle',
      'tortoise',
      'insect',
      'beetle',
      'goldfish',
      'tench',
      'shark',
      'whale',
      'dolphin',
      'monkey',
      'ape',
      'deer',
      'antelope',
      'leopard',
      'cheetah',
      'bison',
      'cow',
      'ox',
      'sheep',
      'goat',
      'hen',
      'rooster',
      'duck',
      'goose',
      'swan',
      'flamingo',
      'lynx',
      'macaque',
    ],
  },
  {
    key: 'food',
    name: '美食与饮品',
    words: [
      'food',
      'fruit',
      'vegetable',
      'meal',
      'dish',
      'pizza',
      'burger',
      'cheeseburger',
      'sandwich',
      'bread',
      'cake',
      'ice_cream',
      'chocolate',
      'coffee',
      'espresso',
      'tea',
      'soup',
      'salad',
      'sushi',
      'pasta',
      'noodle',
      'orange',
      'lemon',
      'banana',
      'apple',
      'strawberry',
      'pineapple',
      'fig',
      'grape',
      'pomegranate',
      'broccoli',
      'cucumber',
      'artichoke',
      'mushroom',
      'bagel',
      'pretzel',
      'burrito',
      'hotdog',
      'hot_dog',
      'potpie',
      'guacamole',
      'trifle',
      'dough',
      'carbonara',
    ],
  },
  {
    key: 'nature',
    name: '自然与风景',
    words: [
      'nature',
      'landscape',
      'scenery',
      'mountain',
      'mountain_peak',
      'forest',
      'tree',
      'plant',
      'flower',
      'daisy',
      'rose',
      'tulip',
      'sunflower',
      'ocean',
      'sea',
      'seashore',
      'beach',
      'coast',
      'lake',
      'river',
      'waterfall',
      'cliff',
      'valley',
      'volcano',
      'desert',
      'sandbar',
      'coral_reef',
      'lakeside',
      'promontory',
      'geyser',
      'alp',
      'sky',
      'sunset',
      'snow',
      'garden',
      'grass',
    ],
  },
  {
    key: 'city',
    name: '城市与建筑',
    words: [
      'architecture',
      'building',
      'city',
      'street',
      'skyscraper',
      'bridge',
      'castle',
      'palace',
      'church',
      'monastery',
      'temple',
      'mosque',
      'tower',
      'lighthouse',
      'library',
      'cinema',
      'restaurant',
      'bakery',
      'bookshop',
      'boathouse',
      'barn',
      'greenhouse',
      'patio',
      'fountain',
      'pier',
      'dam',
      'viaduct',
      'triumphal_arch',
      'dome',
      'home',
      'house',
    ],
  },
  {
    key: 'travel',
    name: '交通与出行',
    words: [
      'vehicle',
      'car',
      'truck',
      'bus',
      'train',
      'locomotive',
      'airplane',
      'aircraft',
      'airliner',
      'bicycle',
      'bike',
      'motorcycle',
      'motorbike',
      'boat',
      'ship',
      'yacht',
      'sailboat',
      'canoe',
      'kayak',
      'taxi',
      'cab',
      'minivan',
      'minibus',
      'limousine',
      'convertible',
      'jeep',
      'moped',
      'ambulance',
      'fire_engine',
      'tractor',
      'bullet_train',
      'trolleybus',
      'school_bus',
    ],
  },
  {
    key: 'documents',
    name: '文档与屏幕',
    words: [
      'document',
      'text',
      'screenshot',
      'screen',
      'web_site',
      'website',
      'book',
      'book_jacket',
      'menu',
      'notebook',
      'envelope',
      'comic_book',
      'crossword',
      'monitor',
      'laptop',
      'computer',
      'desktop_computer',
      'keyboard',
    ],
  },
] as const

export function classifyTopic(
  labels: ImageLabel[],
): { key: string; name: string; confidence: number } | undefined {
  if (!Array.isArray(labels)) return
  for (const result of [...labels].sort((a, b) => b.confidence - a.confidence)) {
    if (
      !Number.isFinite(result.confidence) ||
      result.confidence < 0.55 ||
      result.confidence > 1 ||
      typeof result.label !== 'string'
    )
      continue
    const label = result.label.toLowerCase().replace(/[\s-]+/g, '_')
    for (const topic of topics) {
      if (topic.words.some((word) => new RegExp(`(^|[^a-z])${word}([^a-z]|$)`).test(label)))
        return { key: topic.key, name: topic.name, confidence: result.confidence }
    }
  }
}

export function smartSuggestions(
  results: { photoId: string; labels: ImageLabel[] }[],
): SmartSuggestion[] {
  const groups = new Map<string, SmartSuggestion>()
  for (const result of results) {
    const topic = classifyTopic(result.labels)
    if (!topic) continue
    const group = groups.get(topic.key) ?? { ...topic, photoIds: [] }
    if (!group.photoIds.includes(result.photoId)) group.photoIds.push(result.photoId)
    group.confidence = Math.min(group.confidence, topic.confidence)
    groups.set(topic.key, group)
  }
  return [...groups.values()].sort((a, b) => b.photoIds.length - a.photoIds.length)
}

export function planSmartAlbums(
  suggestions: SmartSuggestion[],
  photos: Photo[],
  existing: UserAlbum[],
): SmartAlbumPlan {
  if (!suggestions.length || suggestions.length > topics.length)
    throw new Error('请选择至少一个有效建议相册')
  const available = new Set(photos.map((p) => p.id))
  const albums: UserAlbum[] = []
  const used = new Set<string>()
  let added = 0
  for (const suggestion of suggestions) {
    const topic = topics.find((t) => t.key === suggestion.key)
    if (
      !topic ||
      used.has(topic.key) ||
      !suggestion.photoIds.length ||
      suggestion.photoIds.length > 500
    )
      throw new Error('建议相册无效，请重新分析')
    used.add(topic.key)
    if (suggestion.photoIds.some((id) => !available.has(id)))
      throw new Error('部分照片已不可访问，请重新分析')
    const id = `user:smart:${topic.key}`
    const prior = existing.find((a) => a.id === id)
    const photoIds = [...new Set([...(prior?.photoIds ?? []), ...suggestion.photoIds])]
    if (photoIds.length > 10000) throw new Error('单个相册最多 10,000 张照片')
    albums.push({ id, name: prior?.name ?? `智能 · ${topic.name}`, photoIds })
    if (!prior) added++
  }
  if (existing.length + added > 200) throw new Error('最多创建 200 个相册，请先移除不需要的相册')
  return { albums, added }
}
