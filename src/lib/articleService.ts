import { api, uploadFile } from './api';
import { onDataChanged, onReconnect } from './socket';
import { ArticleItem } from '../types';

// Articles API. Function signatures are kept from the Firestore version so the
// article components only swapped their import source.

type ArticleInput = Partial<Omit<ArticleItem, 'id'>>;

/** Covers chosen in the editor are compressed data URLs; upload them as files first. */
async function resolveCover(coverImage?: string): Promise<string | undefined> {
  if (!coverImage || !coverImage.startsWith('data:')) return coverImage;
  const blob = await (await fetch(coverImage)).blob();
  return uploadFile({ blob, name: `cover.${blob.type.split('/')[1] || 'jpg'}` });
}

function toBody(data: ArticleInput, coverImage: string | undefined) {
  return {
    title: data.title,
    description: data.description,
    coverImage,
    category: data.category,
    tags: data.tags,
    content: data.content,
    readTimeMinutes: data.readTimeMinutes,
  };
}

export const subscribeToArticles = (
  callback: (articles: ArticleItem[]) => void,
  onError?: (err: Error) => void
) => {
  let cancelled = false;
  const load = () =>
    api
      .get<ArticleItem[]>('/articles')
      .then((list) => !cancelled && callback(list))
      .catch((err) => onError?.(err));
  load();
  const offChanged = onDataChanged(['articles'], load);
  const offReconnect = onReconnect(load);
  return () => {
    cancelled = true;
    offChanged();
    offReconnect();
  };
};

export const createArticle = async (articleData: Omit<ArticleItem, 'id'> | ArticleInput): Promise<string> => {
  const cover = await resolveCover(articleData.coverImage);
  const created = await api.post<ArticleItem>('/articles', toBody(articleData, cover));
  return created.id;
};

export const updateArticle = async (articleId: string, articleData: ArticleInput): Promise<void> => {
  const cover = await resolveCover(articleData.coverImage);
  await api.patch(`/articles/${articleId}`, toBody(articleData, cover));
};

export const deleteArticle = async (articleId: string): Promise<void> => {
  await api.del(`/articles/${articleId}`);
};

export const toggleLikeArticle = async (articleId: string, _userId: string, hasLiked: boolean): Promise<void> => {
  try {
    await api.post(`/articles/${articleId}/like`, { liked: !hasLiked });
  } catch (error) {
    console.warn('Like toggle failed:', error);
  }
};

export const incrementArticleViews = async (articleId: string): Promise<void> => {
  try {
    await api.post(`/articles/${articleId}/view`);
  } catch (error) {
    console.warn('Increment views failed:', error);
  }
};

export const toggleSaveArticle = async (
  articleId: string,
  userId: string,
  isCurrentlySaved: boolean,
  _articleTitle?: string
): Promise<void> => {
  if (!userId) return;
  try {
    if (isCurrentlySaved) await api.del(`/saved-articles/${articleId}`);
    else await api.put(`/saved-articles/${articleId}`);
  } catch (error) {
    console.warn('Toggle save article error:', error);
  }
};

export const subscribeToSavedArticleIds = (userId: string, callback: (savedIds: string[]) => void) => {
  if (!userId) {
    callback([]);
    return () => {};
  }
  let cancelled = false;
  const load = () =>
    api
      .get<string[]>('/saved-articles')
      .then((ids) => !cancelled && callback(ids))
      .catch(() => {});
  load();
  const offChanged = onDataChanged(['saved-articles'], load);
  const offReconnect = onReconnect(load);
  return () => {
    cancelled = true;
    offChanged();
    offReconnect();
  };
};
