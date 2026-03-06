// Breed images — real Unsplash photos of actual dogs and cats
// Dimensions: 200×200 cropped via Unsplash CDN

export const BREED_IMAGES = {
  golden_retriever: 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=200&h=200&fit=crop&q=80',
  sheltie:          'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=200&h=200&fit=crop&q=80',
  french_bulldog:   'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=200&h=200&fit=crop&q=80',
  dachshund:        'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=200&h=200&fit=crop&q=80',
  domestic_sh:      'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=200&h=200&fit=crop&q=80',
  persian:          'https://images.unsplash.com/photo-1561948955-570b270e7c36?w=200&h=200&fit=crop&q=80',
  siamese:          'https://images.unsplash.com/photo-1596854407944-bf87f6fdd049?w=200&h=200&fit=crop&q=80',
};

export function getBreedImage(breedId) {
  return BREED_IMAGES[breedId] || null;
}
