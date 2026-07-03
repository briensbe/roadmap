import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { environment } from '../environments/environment';

export const AuthGuard: CanActivateFn = async (route, state) => {
  // --- désactivé en dev ---
  if (!environment.enableAuth) {
    return true;
  }

  const supabaseService = inject(SupabaseService);
  const router = inject(Router);

  // 1. On vérifie d'abord le Signal (instantané, pas de réseau)
  const user = supabaseService.user();
  if (user) return true;

  // 2. Si le signal est null (ex: premier chargement),
  // on utilise la méthode robuste qui va chercher plus loin
  const { data } = await supabaseService.getUser();

  if (!data?.user) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }
  return true;
};
