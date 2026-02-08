/**
 * Query Keys Factory for TanStack Query
 * Centralized query key management for type-safety and consistency
 */

export const projetQueryKeys = {
    all: ['projets'] as const,
    lists: () => [...projetQueryKeys.all, 'list'] as const,
    list: () => [...projetQueryKeys.lists()] as const,
    details: () => [...projetQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...projetQueryKeys.details(), id] as const,
    byIdProjet: (idProjet: number) => [...projetQueryKeys.all, 'by-id-projet', idProjet] as const,
    equipeLinks: () => ['equipe-projet-links'] as const,
};
