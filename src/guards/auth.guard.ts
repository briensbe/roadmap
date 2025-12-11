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

  const { data } = await supabaseService.getUser();
  if (!data.user) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }
  return true;
};
