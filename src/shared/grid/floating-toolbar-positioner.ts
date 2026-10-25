/**
 * @file floating-toolbar-positioner.ts
 * @description Calculateur de positionnement DOM et de visibilité dans le viewport pour la SelectionToolbar flottante.
 */

import { calculateBestToolbarPosition, ToolbarPosition } from '../../utils/selection-positioning';

export interface FloatingToolbarDomContext {
  targetRect: DOMRect;
  wrapperEl: HTMLElement | null;
  headerEl?: HTMLElement | null;
  labelEl?: HTMLElement | null;
  dragStartWeekIndex: number;
  dragEndWeekIndex: number;
}

export interface FloatingToolbarPositionResult {
  visible: boolean;
  position: ToolbarPosition;
}

/**
 * Détermine si une cellule de référence est masquée ou sortie du viewport du wrapper calendrier.
 */
export function isCellScrolledOutOfView(
  cellRect: DOMRect,
  wrapperEl: HTMLElement | null,
  headerEl?: HTMLElement | null,
  labelEl?: HTMLElement | null,
): boolean {
  if (!wrapperEl) return false;
  const wrapperRect = wrapperEl.getBoundingClientRect();
  const visibleTop = headerEl ? headerEl.getBoundingClientRect().bottom : wrapperRect.top;
  const visibleBottom = wrapperRect.bottom;
  const visibleLeft = labelEl ? labelEl.getBoundingClientRect().right : wrapperRect.left;
  const visibleRight = wrapperRect.right;

  return (
    cellRect.bottom <= visibleTop || // Défilement sous l'en-tête
    cellRect.top >= visibleBottom || // Défilement en-dessous du bas du conteneur
    cellRect.right <= visibleLeft || // Défilement à gauche sous la colonne des libellés
    cellRect.left >= visibleRight // Défilement à droite hors de la zone visible
  );
}

/**
 * Calcule la position relative de la barre d'outils flottante au sein du `.calendar-wrapper`.
 */
export function computeFloatingToolbarPosition(
  context: FloatingToolbarDomContext,
): FloatingToolbarPositionResult {
  const { targetRect, wrapperEl, headerEl, labelEl, dragStartWeekIndex, dragEndWeekIndex } = context;

  const isHidden = isCellScrolledOutOfView(targetRect, wrapperEl, headerEl, labelEl);
  if (isHidden) {
    return {
      visible: false,
      position: { top: 0, left: 0, transform: 'translate(0, 0)' },
    };
  }

  const bestViewportPos = calculateBestToolbarPosition({
    rect: targetRect,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    dragStartWeekIndex,
    dragEndWeekIndex,
    bottomSafetyMargin: 150,
    rightSafetyMargin: 320,
  });

  if (wrapperEl) {
    const wrapperRect = wrapperEl.getBoundingClientRect();
    return {
      visible: true,
      position: {
        top: bestViewportPos.top - wrapperRect.top + wrapperEl.scrollTop,
        left: bestViewportPos.left - wrapperRect.left + wrapperEl.scrollLeft,
        transform: bestViewportPos.transform,
      },
    };
  }

  return {
    visible: true,
    position: bestViewportPos,
  };
}
