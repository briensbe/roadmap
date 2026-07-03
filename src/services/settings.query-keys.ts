export const settingsQueryKeys = {
  all: ['settings'] as const,
  list: () => [...settingsQueryKeys.all, 'list'] as const,
  detail: (id: string) => [...settingsQueryKeys.all, 'detail', id] as const,
  byKey: (key: string, scope: string) => [...settingsQueryKeys.all, 'byKey', key, scope] as const,
};
