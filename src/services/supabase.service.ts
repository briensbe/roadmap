import { Injectable, signal } from "@angular/core";
import { AuthTokenResponse, createClient, SupabaseClient, UserResponse, User } from "@supabase/supabase-js";
import { BehaviorSubject } from "rxjs";
import { LoginPayload, SignupPayload } from "../auth/types/user.type";
import { environment } from "../environments/environment";

const sessionStorageUserKey = "roadmapUser"; // A changer si on change d'application (car j'avais repris un ancien nom)
@Injectable({
  providedIn: "root"
})
export class SupabaseService {
  private supabase: SupabaseClient;
  private _user = signal<User | null>(null);
  private _isLocalLogout = false;

  /**
   * Observable pour suivre l'état de l'authentification (compatibilité ascendante)
   */
  readonly authState$ = new BehaviorSubject<{ event: string, session: any } | null>(null);

  /**
   * Signal réactif pour l'utilisateur actuellement connecté
   */
  public user = this._user.asReadonly();

  /**
   * Indique si l'utilisateur vient de se déconnecter manuellement depuis cet onglet.
   */
  get isLocalLogout() {
    return this._isLocalLogout;
  }

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey, {
      auth: {
        // On utilise une version sûre du lock
        lock: (name, acquireTimeout, acquireFn) => this.safeLock(name, acquireFn),
      },
    });

    this.initializeAuthListener();
    // Chargement initial de la session pour peupler le signal immédiatement
    this.supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        this._user.set(session.user);
      }
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
    // const baseUrl = document.querySelector("base")?.href || window.location.origin;
    // console.log("1- signup baseUrl = " + baseUrl);

    const authRedirectUrl = environment.authRedirectUrl;
    console.log("2- signup authRedirectUrl = " + authRedirectUrl);

    return await this.supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        emailRedirectTo: authRedirectUrl,
        data: {
          displayName: payload.name,
        },
      },
    });
  }

  /**
   * Récupère l'utilisateur actuellement connecté.
   * Optimisé pour utiliser le cache local et éviter les appels réseau inutiles.
   */
  async getUser(): Promise<{ data: { user: User | null }, error: any }> {
    const cachedUser = this._user(); // signal -> rapide 
    if (cachedUser) {
      return { data: { user: cachedUser }, error: null };
    }

    // Si pas de cache, on essaie getSession qui est rapide (Lit dans le stockage local (très rapide, pas d'appel réseau).)
    const { data: { session }, error: sessionError } = await this.supabase.auth.getSession();
    if (session?.user) {
      this._user.set(session.user);
      return { data: { user: session.user }, error: null };
    }

    // En dernier recours, on appelle getUser() qui valide le JWT auprès du serveur
    const response = await this.supabase.auth.getUser();
    if (response.data.user) {
      this._user.set(response.data.user);
    }
    return response;
  }

  /**
   * Déconnexion de l'utilisateur courant
   */
  async signOut() {
    // On marque la déconnexion comme locale
    this._isLocalLogout = true;
    
    // On vide immédiatement le cache local avant même l'appel réseau
    this._user.set(null);
    this.authState$.next(null);

    try {
      await this.supabase.auth.signOut();
    } finally {
      sessionStorage.removeItem(sessionStorageUserKey);
      // On réinitialise le flag après un court délai pour laisser l'effect réagir
      setTimeout(() => this._isLocalLogout = false, 1000);
    }
  }

  /**
   * Envoie un email de réinitialisation de mot de passe
   * @param email Adresse email de l'utilisateur
   * @returns Promise<void> (rejette avec une erreur en cas d'échec)
   */
  async resetPasswordForEmail(email: string): Promise<void> {
    try {
      // Récupère l'URL de base de l'app (inclut le repo path)
      // const baseUrl = document.querySelector("base")?.href || window.location.origin;

      // console.log("baseUrl = " + baseUrl);
      // console.log("$baseUrl ... = " + `${baseUrl}update-password`);
      // console.log("baseUrl ... = )" + baseUrl + "update-password");

      const authRedirectUrl = environment.authRedirectUrl;
      console.log("authRedirectUrl = " + authRedirectUrl);

      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        // redirectTo: `${baseUrl}update-password`,
        redirectTo: authRedirectUrl + "/update-password",
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


  private initializeAuthListener() {
    this.supabase.auth.onAuthStateChange((event, session) => {
      this.authState$.next({ event, session });
      this._user.set(session?.user ?? null);

      if (session?.user) {
        sessionStorage.setItem(sessionStorageUserKey, JSON.stringify(session.user));
      } else {
        sessionStorage.removeItem(sessionStorageUserKey);
      }
    });
  }

  /**
   * Connexion via Google (OAuth)
   */
  async signInWithGoogle() {
    return await this.supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: environment.authRedirectUrl,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
  }
}
