import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ToastService } from './toast.service';
import { AuthResponse, AuthTokenResponse, createClient, SupabaseClient, UserResponse, User } from '@supabase/supabase-js';
import { BehaviorSubject } from 'rxjs';
import { LoginPayload, SignupPayload, RoadmapRole, RoadmapUserProfile } from '../auth/types/user.type';
import { environment } from '../environments/environment';
import { validateSignupEmail } from '../utils/email-validator';
import { DB_TABLES } from '../constants/db-tables';

const sessionStorageUserKey = 'roadmapUser'; // A changer si on change d'application (car j'avais repris un ancien nom)
@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private supabase: SupabaseClient;
  private _user = signal<User | null>(null);
  private _userProfile = signal<RoadmapUserProfile | null>(null);
  private _isProfileLoading = signal<boolean>(false);
  private _isPasswordRecovery = signal(false);
  private _isLocalLogout = false;
  private _accessToken: string | null = null;
  private readonly beforeSignOutCallbacks: Array<() => Promise<void>> = [];
  private initializationPromise: Promise<void>;

  /**
   * Synchronous getter for active session access token
   */
  get accessToken(): string | null {
    return this._accessToken;
  }

  /**
   * Register a hook to be executed before user session is cleared on sign out
   */
  registerBeforeSignOut(cb: () => Promise<void>) {
    this.beforeSignOutCallbacks.push(cb);
  }

  /**
   * Observable pour suivre l'état de l'authentification (compatibilité ascendante)
   */
  readonly authState$ = new BehaviorSubject<{ event: string; session: any } | null>(null);

  /**
   * Signal réactif pour l'utilisateur actuellement connecté
   */
  public user = this._user.asReadonly();

  /**
   * Signal réactif pour le profil Roadmap de l'utilisateur (issu de roadmap_user_profiles)
   */
  public userProfile = this._userProfile.asReadonly();

  /**
   * Signal indiquant si le profil utilisateur est en cours de chargement
   */
  public isProfileLoading = this._isProfileLoading.asReadonly();

  /**
   * Signal calculé pour le rôle Roadmap ('viewer' | 'editor' | 'admin' | null)
   */
  public userRole = computed<RoadmapRole | null>(() => this._userProfile()?.role ?? null);

  /**
   * Signal réactif indiquant si la session provient d'un lien de récupération de mot de passe
   */
  public isPasswordRecovery = this._isPasswordRecovery.asReadonly();

  /**
   * Indique si l'utilisateur vient de se déconnecter manuellement depuis cet onglet.
   */
  get isLocalLogout() {
    return this._isLocalLogout;
  }

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: false,
        // On utilise une version sûre du lock
        lock: (name, acquireTimeout, acquireFn) => this.safeLock(name, acquireFn),
      },
    });

    const supabaseClient = this.supabase;
    this.initializeAuthListener();

    // On conserve la promesse d'initialisation pour les guards et récupérations de session
    this.initializationPromise = (async () => {
      await this.handleRedirectCode(supabaseClient);
      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session?.user) {
          this._user.set(session.user);
          this._accessToken = session.access_token ?? null;
          await this.loadUserProfile(session.user.id);
        }
      } catch (err) {
        console.error('Error fetching initial session:', err);
      }
    })();
  }

  private async handleRedirectCode(client: SupabaseClient): Promise<void> {
    try {
      const url = new URL(window.location.href);

      // Vérification des erreurs de redirection OAuth (ex: rejet par le Trigger PostgreSQL Supabase)
      const hashParams = url.hash && url.hash.includes('=')
        ? new URLSearchParams(url.hash.replace(/^#/, ''))
        : null;
      const errorParam = url.searchParams.get('error') || hashParams?.get('error');
      const errorCode = url.searchParams.get('error_code') || hashParams?.get('error_code');

      if (errorParam === 'access_denied' || errorCode === 'access_denied' || errorCode === 'P0001') {
        url.searchParams.delete('error');
        url.searchParams.delete('error_code');
        url.searchParams.delete('error_description');
        url.hash = '';
        window.history.replaceState({}, document.title, url.toString());

        this.toastService.error(
          'Connexion refusée : veuillez utiliser votre adresse professionnelle autorisée.',
          8000
        );
        return;
      }

      let code = url.searchParams.get('code');

      // Si le code est dans le hash (ex: /#/login?code=xxx ou /#/?code=xxx)
      if (!code && url.hash.includes('code=')) {
        const hashQueryIndex = url.hash.indexOf('?');
        if (hashQueryIndex !== -1) {
          const hashParams = new URLSearchParams(url.hash.substring(hashQueryIndex));
          code = hashParams.get('code');
        }
      }

      if (code) {
        console.log('PKCE flow: code found in URL, exchanging for session...');
        const { error } = await client.auth.exchangeCodeForSession(code);
        if (error) {
          console.error('Error exchanging code for session:', error.message);
        } else {
          console.log('PKCE flow: session successfully established.');
        }

        const isRecoveryUrl =
          url.pathname.includes('reset-password') ||
          url.hash.includes('reset-password') ||
          url.pathname.includes('update-password') ||
          url.hash.includes('update-password');

        // Nettoyage de l'URL pour éviter de re-traiter le code au rafraîchissement
        if (url.searchParams.has('code')) {
          url.searchParams.delete('code');
        }
        
        let cleanHash = url.hash;
        if (cleanHash.includes('code=')) {
          const hashQueryIndex = cleanHash.indexOf('?');
          if (hashQueryIndex !== -1) {
            const hashParams = new URLSearchParams(cleanHash.substring(hashQueryIndex));
            hashParams.delete('code');
            const paramString = hashParams.toString();
            cleanHash = cleanHash.substring(0, hashQueryIndex) + (paramString ? '?' + paramString : '');
          }
        }

        const newUrl = url.pathname + url.search + cleanHash;
        window.history.replaceState({}, document.title, newUrl);

        if (isRecoveryUrl) {
          this._isPasswordRecovery.set(true);
          setTimeout(() => this.router.navigate(['/reset-password']), 50);
        }
      }
    } catch (err) {
      console.error('Error handling redirect code:', err);
    }
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
      await new Promise((res) => setTimeout(res, delayMs));
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
    const response = await this.supabase.auth.signInWithPassword({
      email: payload.email,
      password: payload.password,
    });

    if (response.data?.user && !response.data.user.email_confirmed_at) {
      await this.signOut();
      return {
        data: { user: null, session: null },
        error: {
          name: 'AuthApiError',
          message: 'Email not confirmed',
          status: 400,
        } as any,
      };
    }

    return response;
  }

  /**
   * Renvoyer l'e-mail de confirmation d'inscription
   */
  async resendConfirmationEmail(email: string) {
    return await this.supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: {
        emailRedirectTo: environment.authRedirectUrl,
      },
    });
  }

  /**
   * Vérifie le code OTP à 6 chiffres reçu par e-mail pour la confirmation d'inscription et établit la session
   */
  async verifySignupOtp(email: string, token: string): Promise<AuthResponse> {
    const response = await this.supabase.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type: 'signup',
    });

    if (response.error) {
      throw new Error(response.error.message || 'Code de confirmation invalide ou expiré.');
    }

    if (response.data?.session?.user) {
      this._user.set(response.data.session.user);
      sessionStorage.setItem(sessionStorageUserKey, JSON.stringify(response.data.session.user));
    }

    return response;
  }

  /**
   * Inscription d'un nouvel utilisateur
   */
  async signUpWithEmail(
    payload: SignupPayload,
    allowedDomains?: string[],
    allowedEmails?: string[]
  ) {
    const domains = allowedDomains ?? environment.allowedEmailDomains;
    const validation = validateSignupEmail(payload.email, domains, allowedEmails);

    // Si l'e-mail est syntaxiquement invalide (pas de format valide user@domain.ext), on bloque immédiatement.
    // En revanche, si l'adresse a un format valide mais que son domaine n'est pas dans la liste publique,
    // on laisse partir l'appel vers Supabase Auth : le Trigger PostgreSQL (SECURITY DEFINER) validera s'il s'agit
    // d'une exception VIP autorisée ou lèvera l'exception d'accès refusé.
    if (!validation.isValid && validation.errorMessage !== 'Veuillez utiliser votre adresse professionnelle autorisée.') {
      return {
        data: { user: null, session: null },
        error: {
          name: 'AuthApiError',
          message: validation.errorMessage || 'Veuillez saisir une adresse e-mail valide.',
          status: 400,
        } as any,
      };
    }

    const authRedirectUrl = environment.authRedirectUrl;
    console.log('2- signup authRedirectUrl = ' + authRedirectUrl);

    const response = await this.supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        emailRedirectTo: authRedirectUrl,
        data: {
          displayName: payload.name,
        },
      },
    });

    // Interception des erreurs de contrainte BDD (Trigger PostgreSQL levant P0001)
    // GoTrue masque l'exception sous le libellé "Database error saving new user"
    if (
      response.error &&
      (response.error.message?.includes('Database error saving new user') ||
        response.error.message?.includes('saving new user'))
    ) {
      return {
        data: { user: null, session: null },
        error: {
          ...response.error,
          message: 'Veuillez utiliser votre adresse professionnelle autorisée.',
        },
      };
    }

    return response;
  }

  /**
   * Charge le profil utilisateur depuis public.roadmap_user_profiles
   */
  async loadUserProfile(userId?: string): Promise<RoadmapUserProfile | null> {
    const id = userId || this._user()?.id;
    if (!id) {
      this._userProfile.set(null);
      return null;
    }

    this._isProfileLoading.set(true);
    try {
      const { data, error } = await this.supabase
        .from(DB_TABLES.USER_PROFILES)
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.warn('[SupabaseService] Erreur lors du chargement du profil utilisateur:', error);
        return null;
      }

      if (data) {
        const profile = data as RoadmapUserProfile;
        this._userProfile.set(profile);
        return profile;
      } else {
        this._userProfile.set(null);
        return null;
      }
    } catch (err) {
      console.error('[SupabaseService] Erreur inattendue chargement profil utilisateur:', err);
      return null;
    } finally {
      this._isProfileLoading.set(false);
    }
  }

  /**
   * Récupère l'utilisateur actuellement connecté.
   * Optimisé pour utiliser le cache local et éviter les appels réseau inutiles.
   */
  async getUser(): Promise<{ data: { user: User | null }; error: any }> {
    await this.initializationPromise;

    const cachedUser = this._user(); // signal -> rapide
    if (cachedUser) {
      if (!this._userProfile()) {
        this.loadUserProfile(cachedUser.id).catch((err) => {
          console.warn('[SupabaseService] Erreur chargement profil getUser cached:', err);
        });
      }
      return { data: { user: cachedUser }, error: null };
    }

    // Si pas de cache, on essaie getSession qui est rapide (Lit dans le stockage local (très rapide, pas d'appel réseau).)
    const {
      data: { session },
    } = await this.supabase.auth.getSession();
    if (session?.user) {
      this._user.set(session.user);
      this._accessToken = session.access_token ?? null;
      if (!this._userProfile()) {
        this.loadUserProfile(session.user.id).catch((err) => {
          console.warn('[SupabaseService] Erreur chargement profil getUser session:', err);
        });
      }
      return { data: { user: session.user }, error: null };
    }

    // En dernier recours, on appelle getUser() qui valide le JWT auprès du serveur
    const response = await this.supabase.auth.getUser();
    if (response.data.user) {
      this._user.set(response.data.user);
      if (!this._userProfile()) {
        this.loadUserProfile(response.data.user.id).catch((err) => {
          console.warn('[SupabaseService] Erreur chargement profil getUser response:', err);
        });
      }
    }
    return response;
  }

  /**
   * Déconnexion de l'utilisateur courant
   */
  async signOut() {
    // Exécuter les callbacks préalables (ex: flush des préférences)
    for (const cb of this.beforeSignOutCallbacks) {
      try {
        await cb();
      } catch (e) {
        console.warn('[SupabaseService] Error in beforeSignOutCallback:', e);
      }
    }

    // On marque la déconnexion comme locale
    this._isLocalLogout = true;

    // On vide immédiatement le cache local avant même l'appel réseau
    this._user.set(null);
    this._userProfile.set(null);
    this._isPasswordRecovery.set(false);
    this._accessToken = null;
    this.authState$.next(null);

    try {
      await this.supabase.auth.signOut();
    } finally {
      sessionStorage.removeItem(sessionStorageUserKey);
      // On réinitialise le flag après un court délai pour laisser l'effect réagir
      setTimeout(() => (this._isLocalLogout = false), 1000);
    }
  }

  /**
   * Envoie un email de réinitialisation de mot de passe contenant un code OTP
   */
  async resetPasswordForEmail(email: string): Promise<void> {
    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(email);

      if (error) throw error;
    } catch (err: any) {
      // on renvoie l'erreur pour que le composant l'affiche proprement
      throw new Error(err.message || 'Erreur lors de l’envoi du mail de réinitialisation.');
    }
  }

  /**
   * Vérifie le code OTP à 6 chiffres reçu par e-mail pour la récupération de mot de passe et établit la session
   */
  async verifyRecoveryOtp(email: string, token: string): Promise<AuthResponse> {
    const response = await this.supabase.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type: 'recovery',
    });

    if (response.error) {
      throw new Error('Code de confirmation invalide ou expiré.');
    }

    if (response.data?.session?.user) {
      this._user.set(response.data.session.user);
      this._isPasswordRecovery.set(true);
    }

    return response;
  }

  /**
   * Réinitialise le mot de passe utilisateur avec le code OTP à 6 chiffres
   */
  async resetPasswordWithOtp(email: string, token: string, newPassword: string): Promise<void> {
    try {
      // 1. Vérification du code OTP et établissement de la session
      await this.verifyRecoveryOtp(email, token);

      // 2. Mise à jour du mot de passe
      const { error: updateError } = await this.supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      this._isPasswordRecovery.set(false);
    } catch (err: any) {
      throw new Error(err.message || 'Erreur lors de la réinitialisation du mot de passe.');
    }
  }

  /**
   * Réinitialisation du mot de passe après lien reçu par email
   * (lorsque Supabase redirige sur /reset-password avec access_token)
   */
  async exchangeCodeForSession(hash: string): Promise<AuthTokenResponse> {
    if (!hash.includes('access_token')) throw new Error('Token manquant');
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
    this._isPasswordRecovery.set(false);
    return response;
  }

  async getSession() {
    await this.initializationPromise;
    return this.supabase.auth.getSession();
  }

  private initializeAuthListener() {
    this.supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        this._isPasswordRecovery.set(true);
        this.router.navigate(['/reset-password']);
      } else if (event === 'SIGNED_OUT') {
        this._isPasswordRecovery.set(false);
      }

      this.authState$.next({ event, session });
      this._user.set(session?.user ?? null);
      this._accessToken = session?.access_token ?? null;

      if (session?.user) {
        sessionStorage.setItem(sessionStorageUserKey, JSON.stringify(session.user));
        this.loadUserProfile(session.user.id).catch((err) => {
          console.warn('[SupabaseService] Erreur chargement profil authStateChange:', err);
        });
      } else {
        sessionStorage.removeItem(sessionStorageUserKey);
        this._userProfile.set(null);
      }
    });
  }

  /**
   * Connexion via Google (OAuth)
   */
  async signInWithGoogle() {
    return await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: environment.authRedirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
  }
}
