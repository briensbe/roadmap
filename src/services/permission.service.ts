import { Injectable, computed, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ToastService } from './toast.service';
import { RoadmapRole } from '../auth/types/user.type';

@Injectable({
  providedIn: 'root',
})
export class PermissionService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly toast = inject(ToastService);

  /**
   * Signal réactif du rôle courant de l'utilisateur ('viewer' | 'editor' | 'admin' | null)
   */
  readonly userRole = this.supabaseService.userRole;

  /**
   * Indique si l'utilisateur courant est en mode lecture seule (viewer)
   */
  readonly isViewer = computed<boolean>(() => this.userRole() === 'viewer');

  /**
   * Indique si l'utilisateur dispose des droits d'écriture ('editor' ou 'admin')
   */
  readonly canEdit = computed<boolean>(() => {
    const role = this.userRole();
    return role === 'editor' || role === 'admin';
  });

  /**
   * Vérifie si l'utilisateur courant a les droits d'écriture.
   * Si l'utilisateur est en mode viewer, déclenche un toast informatif et renvoie false.
   *
   * @param customMessage Message optionnel à afficher dans le toast info
   * @returns true si l'écriture est autorisée, false sinon
   */
  ensureCanEdit(customMessage?: string): boolean {
    if (this.isViewer()) {
      this.toast.info(
        customMessage || 'Vous êtes en mode consultation (viewer) : les modifications ne sont pas autorisées.',
      );
      return false;
    }
    return true;
  }
}
