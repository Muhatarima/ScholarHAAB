export type Product = 'abroad' | 'qbank'
export type PromptMode = 'direct' | 'tutor'

export function isProduct(value: unknown): value is Product {
  return value === 'abroad' || value === 'qbank'
}

export function isPromptMode(value: unknown): value is PromptMode {
  return value === 'direct' || value === 'tutor'
}

export function normalizeMode(product: Product, mode: PromptMode = 'direct'): PromptMode {
  if (product === 'abroad') {
    return 'direct'
  }

  return mode
}
