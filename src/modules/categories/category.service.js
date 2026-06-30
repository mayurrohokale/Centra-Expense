import { Category } from './category.model.js';

export function listCategories(userId) {
  return Category.find({ userId }).sort({ order: 1 }).lean();
}
