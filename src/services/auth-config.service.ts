import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { environment } from '../environments/environment';
import { DB_TABLES } from '../constants/db-tables';
import {
  isEmailAllowed,
  validateSignupEmail,
  getEmailPlaceholder,
  normalizeDomain,
} from '../utils/email-validator';

export interface AllowedRule {
  id?: string;
  rule_type: 'domain' | 'email';
  value: string;
  description?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthConfigService {
  private readonly supabaseService = inject(SupabaseService);

  private readonly _rules = signal<AllowedRule[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _isLoaded = signal<boolean>(false);

  /**
   * Domaines d'e-mails autorisés (issus de la BDD ou fallback sur environment)
   */
  readonly allowedDomains = computed<string[]>(() => {
    const dbDomains = this._rules()
      .filter((r) => r.rule_type === 'domain' && r.is_active)
      .map((r) => normalizeDomain(r.value))
      .filter((d) => d.length > 0);

    if (dbDomains.length > 0) {
      return dbDomains;
    }

    // Si aucune règle BDD n'a été chargée, utilisation des règles de l'environnement
    const envDomains = environment.allowedEmailDomains || [];
    return envDomains.map((d) => normalizeDomain(d)).filter((d) => d.length > 0);
  });

  /**
   * Adresses e-mails individuelles d'exception (VIP, Google OAuth autorisés)
   */
  readonly allowedEmails = computed<string[]>(() => {
    return this._rules()
      .filter((r) => r.rule_type === 'email' && r.is_active)
      .map((r) => r.value.trim().toLowerCase())
      .filter((e) => e.length > 0);
  });

  /**
   * Indique si des restrictions actives sont définies (faux en mode permissif)
   */
  readonly hasRestrictions = computed<boolean>(() => {
    return this.allowedDomains().length > 0 || this.allowedEmails().length > 0;
  });

  /**
   * Placeholder dynamique d'e-mail pour les formulaires d'authentification
   */
  readonly emailPlaceholder = computed<string>(() => {
    return getEmailPlaceholder(this.allowedDomains());
  });

  /**
   * Indicateurs d'état de chargement
   */
  readonly isLoading = this._isLoading.asReadonly();
  readonly isLoaded = this._isLoaded.asReadonly();

  constructor() {
    this.loadAllowedRules();
  }

  /**
   * Charge les règles actives depuis Supabase avec repli robuste en cas d'erreur
   */
  async loadAllowedRules(): Promise<void> {
    this._isLoading.set(true);
    try {
      const client = this.supabaseService.client;
      if (!client) {
        this._isLoading.set(false);
        return;
      }

      // La vue allowed_rules est partagée et exposée dans le schéma 'public'
      const query = client.schema ? client.schema('public') : client;

      const { data, error } = await query
        .from(DB_TABLES.ALLOWED_RULES)
        .select('id, rule_type, value, description, is_active')
        .eq('is_active', true)
        .order('id', { ascending: true });

      if (error) {
        // En cas d'erreur (ex: vue ou table non encore migrée en dev local), repli silencieux
        console.warn('AuthConfigService: impossible de charger allowed_rules depuis Supabase, utilisation du repli environment.', error.message);
      } else if (data) {
        this._rules.set(data as AllowedRule[]);
      }
    } catch (err) {
      console.warn('AuthConfigService: erreur inattendue lors du chargement des règles.', err);
    } finally {
      this._isLoading.set(false);
      this._isLoaded.set(true);
    }
  }

  /**
   * Vérifie si une adresse e-mail est autorisée
   */
  isEmailAllowed(email: string): boolean {
    return isEmailAllowed(email, this.allowedDomains(), this.allowedEmails());
  }

  /**
   * Valide une adresse e-mail pour l'inscription avec message d'erreur contextualisé
   */
  validateEmail(email: string): { isValid: boolean; errorMessage?: string } {
    return validateSignupEmail(email, this.allowedDomains(), this.allowedEmails());
  }

  /**
   * Méthode utilitaire de test pour écraser les règles chargées
   */
  setRulesForTesting(rules: AllowedRule[]): void {
    this._rules.set(rules);
    this._isLoaded.set(true);
  }
}
