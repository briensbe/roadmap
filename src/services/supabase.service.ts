import { Injectable } from '@angular/core';
import { AuthTokenResponse, createClient, SupabaseClient, UserResponse } from "@supabase/supabase-js";
import { LoginPayload, SignupPayload } from "../auth/types/user.type";
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

  get client(): SupabaseClient {
    return this.supabase;
  }
  // je laisse cette deuxième méthode pour faciliter l'intégration de auth 
  getClient(): SupabaseClient {
    return this.supabase;
  }

  //récupération de supabase-auth
  /**
   * Connexion d'un utilisateur existant
   */
  async signInWithEmail(payload: LoginPayload) {
    return await this.supabase.auth.signInWithPassword({
      email: payload.email,
      password: payload.password,
    });
  }

  /**
   * Inscription d'un nouvel utilisateur
   */
  async signUpWithEmail(payload: SignupPayload) {
    // Récupère l'URL de base de l'app (inclut le repo path)
    const baseUrl = document.querySelector("base")?.href || window.location.origin;
    console.log("1- signup baseUrl = " + baseUrl);

    return await this.supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        emailRedirectTo: baseUrl,
        data: {
          displayName: payload.name,
        },
      },
    });
  }

  /**
   * Récupère l'utilisateur actuellement connecté
   */
  async getUser() {
    return await this.supabase.auth.getUser();
    // pb sur l'ajout en sessionStorage -> les pages sont accessibles sans connexion 
    /*
    const user = sessionStorage.getItem('releaseflowUser');
    if (user) {
      return JSON.parse(user);
    } else {
      const { data: { user: currentUser } } = await this.supabase.auth.getUser();
      sessionStorage.setItem('releaseflowUser', JSON.stringify(currentUser));
      return currentUser;
    }
      */
  }

  /**
   * Déconnexion de l'utilisateur courant
   */
  async signOut() {
    await this.supabase.auth.signOut();
    sessionStorage.removeItem('releaseflowUser');
  }

  /**
   * Envoie un email de réinitialisation de mot de passe
   * @param email Adresse email de l'utilisateur
   * @returns Promise<void> (rejette avec une erreur en cas d'échec)
   */
  async resetPasswordForEmail(email: string): Promise<void> {
    try {
      // Récupère l'URL de base de l'app (inclut le repo path)
      const baseUrl = document.querySelector("base")?.href || window.location.origin;

      // console.log("baseUrl = " + baseUrl);
      // console.log("$baseUrl ... = " + `${baseUrl}update-password`);
      // console.log("baseUrl ... = )" +  baseUrl + "update-password");

      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        // redirectTo: `${baseUrl}update-password`,
        redirectTo: baseUrl + "update-password",
      });

      // const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
      //   redirectTo: `${window.location.origin}/update-password`,
      // });

      if (error) throw error;
    } catch (err: any) {
      // on renvoie l'erreur pour que le composant l'affiche proprement
      throw new Error(err.message || "Erreur lors de l’envoi du mail de réinitialisation.");
    }
  }

  /**
   * Réinitialisation du mot de passe après lien reçu par email
   * (lorsque Supabase redirige sur /reset-password avec access_token)
   */
  async exchangeCodeForSession(hash: string): Promise<AuthTokenResponse> {
    if (!hash.includes("access_token")) throw new Error("Token manquant");
    const response = await this.supabase.auth.exchangeCodeForSession(hash);
    if (response.error) throw new Error(response.error.message);
    return response;
  }

  /**
   * Mise à jour du mot de passe de l'utilisateur connecté
   */
  async updatePassword(newPassword: string): Promise<UserResponse> {
    const response = await this.supabase.auth.updateUser({
      password: newPassword,
    });
    if (response.error) throw new Error(response.error.message);
    return response;
  }

  async getSession() {
    return this.supabase.auth.getSession();
  }
}
