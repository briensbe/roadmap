/**
 * @file hover-tooltip.controller.ts
 * @description Contrôleur injectable pour la gestion temporisée et le positionnement des infobulles de grille.
 */

import { Injectable, OnDestroy, signal } from '@angular/core';

export function updateTooltipDomPosition(event: MouseEvent, tooltipEl?: HTMLElement | null): void {
  if (!tooltipEl) return;
  const offsetX = 15;
  const offsetY = 15;
  const tooltipWidth = 200;
  const tooltipHeight = 40;
  const x = event.clientX + offsetX + tooltipWidth > window.innerWidth ? event.clientX - tooltipWidth - offsetX : event.clientX + offsetX;
  const y = event.clientY + offsetY + tooltipHeight > window.innerHeight ? event.clientY - tooltipHeight - offsetY : event.clientY + offsetY;
  tooltipEl.style.left = `${x}px`;
  tooltipEl.style.top = `${y}px`;
}

@Injectable()
export class HoverTooltipController implements OnDestroy {
  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  /** Délai d'apparition anti-scintillement en ms */
  private readonly showDelay = 350;
  /** Délai de disparition en ms */
  private readonly hideDelay = 80;

  readonly activeTooltip = signal<string | null>(null);

  /**
   * Demande l'affichage différé d'une infobulle pour l'élément survolé.
   * @param event Événement souris d'origine
   * @param text Texte de l'infobulle
   * @param isBlocked Prédicat optionnel indiquant si l'affichage doit être bloqué (ex: drag en cours)
   * @param tooltipEl Référence DOM de l'infobulle pour mettre à jour les coordonnées
   */
  showTooltip(
    event: MouseEvent,
    text: string,
    isBlocked?: () => boolean,
    tooltipEl?: HTMLElement | null,
  ): void {
    this.clearTimers();
    if (!text || (isBlocked && isBlocked())) {
      if (this.activeTooltip() !== null) {
        this.activeTooltip.set(null);
      }
      return;
    }

    if (this.activeTooltip() === text) {
      updateTooltipDomPosition(event, tooltipEl);
      return;
    }

    this.showTimer = setTimeout(() => {
      if (isBlocked && isBlocked()) return;
      this.activeTooltip.set(text);
      updateTooltipDomPosition(event, tooltipEl);
    }, this.showDelay);
  }

  /**
   * Demande la disparition différée de l'infobulle.
   */
  hideTooltip(): void {
    this.clearTimers();
    this.hideTimer = setTimeout(() => {
      this.activeTooltip.set(null);
    }, this.hideDelay);
  }

  /**
   * Met à jour la position courante de l'infobulle lors d'un déplacement souris.
   */
  updatePosition(event: MouseEvent, tooltipEl?: HTMLElement | null): void {
    if (this.activeTooltip() !== null) {
      updateTooltipDomPosition(event, tooltipEl);
    }
  }

  clear(): void {
    this.clearTimers();
    this.activeTooltip.set(null);
  }

  private clearTimers(): void {
    if (this.showTimer) clearTimeout(this.showTimer);
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.showTimer = null;
    this.hideTimer = null;
  }

  ngOnDestroy(): void {
    this.clear();
  }
}
