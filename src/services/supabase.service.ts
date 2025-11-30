import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey, {
      auth: {
        // On utilise une version sûre du lock
        lock: (name, acquireTimeout, acquireFn) => this.safeLock(name, acquireFn),
      },
    });
  }

  private async safeLock<T>(name: string, acquireFn: () => Promise<T>, retries = 5, delayMs = 50): Promise<T> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Essayez d'acquérir le lock si disponible
        const result = await navigator.locks.request(name, { ifAvailable: true }, acquireFn);
        if (result !== undefined) return result;
      } catch {
        // ignore l'erreur et réessaie
      }
      // Attendre un petit délai avant de réessayer
      await new Promise(res => setTimeout(res, delayMs));
    }
    // Dernière tentative bloquante pour garantir le lock
    return navigator.locks.request(name, acquireFn);
  }

  get client() {
    return this.supabase;
  }
}
