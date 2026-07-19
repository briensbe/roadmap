import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { BudgetUnifieEntry, Chiffre } from '../models/chiffres.type';
import { ServicesService } from './services.service';
import { RolesService } from './roles.service';
import { PersonnesService } from './personnes.service';
import { ChargeService } from './charge.service';
import { ProjetService } from './projet.service';
import { DB_TABLES, DB_VIEWS } from '../constants/db-tables';
import { paginateQuery } from '../utils/supabase-pagination';

@Injectable({
  providedIn: 'root',
})
export class ChiffresService {
  private _chiffresCache: Chiffre[] | null = null;

  constructor(
    private supabase: SupabaseService,
    private servicesService: ServicesService,
    private rolesService: RolesService,
    private personnesService: PersonnesService,
    private chargeService: ChargeService,
    private projetService: ProjetService,
  ) {}

  public clearCache() {
    this._chiffresCache = null;
  }

  async getAllChiffres(): Promise<BudgetUnifieEntry[]> {
    if (this._chiffresCache) {
      return this._chiffresCache as unknown as BudgetUnifieEntry[];
    }

    // Récupération de tous les chiffres depuis la vue unifiée avec gestion de la limite de 1000 lignes de PostgREST
    const data = await paginateQuery<BudgetUnifieEntry>(
      () => this.supabase.client.from(DB_VIEWS.VIEW_BUDGET_UNIFIE).select('*').order('id_projet', { ascending: true }).order('id_service', { ascending: true })
    );

    this._chiffresCache = data as any || [];
    return this._chiffresCache as unknown as BudgetUnifieEntry[];
  }

  async getChiffresByProject(idProjet: string): Promise<Chiffre[]> {
    if (this._chiffresCache) {
      return this._chiffresCache.filter((c) => c.id_projet === idProjet);
    }

    const data = await paginateQuery<Chiffre>(
      () => this.supabase.client.from(DB_TABLES.CHIFFRES).select('*').eq('id_projet', idProjet).order('id_service', { ascending: true }).order('id_chiffres', { ascending: true })
    );

    return data || [];
  }

  /**
   * Lecture via la vue unifiée v_roadmap_projet_budget_unifie.
   * Retourne uniquement les lignes existantes (LOCAL ou TRISKELL).
   * Les lignes VIERGE (tous les services sans données) sont gérées
   * côté composant pour conserver l'affichage complet.
   *
   * ⚠️ Pagination obligatoire : PostgREST plafonne silencieusement à 1000 lignes.
   */
  async getChiffresByProjectFromView(idProjet: string): Promise<BudgetUnifieEntry[]> {
    return paginateQuery<BudgetUnifieEntry>(
      () => this.supabase.client
        .from(DB_VIEWS.VIEW_BUDGET_UNIFIE)
        .select('*')
        .eq('id_projet', idProjet)
        .order('id_service', { ascending: true })
    );
  }

  /**
   * Récupère les chiffres d'un projet/service via la vue unifiée.
   * L'arbitrage Triskell > Local est géré par la vue.
   * Le filtre projet + service garantit au plus 1 ligne : pas de risque pagination.
   */
  async getChiffre(idProjet: string, idService: string): Promise<BudgetUnifieEntry | null> {
    const { data, error } = await this.supabase.client
      .from(DB_VIEWS.VIEW_BUDGET_UNIFIE)
      .select('*')
      .eq('id_projet', idProjet)
      .eq('id_service', idService)
      .maybeSingle();

    if (error) throw error;
    return data as BudgetUnifieEntry | null;
  }

  async createChiffre(chiffre: Chiffre): Promise<Chiffre> {
    const { data, error } = await this.supabase.client
      .from(DB_TABLES.CHIFFRES)
      .insert([
        {
          id_projet: chiffre.id_projet,
          id_service: chiffre.id_service,
          initial: chiffre.initial || 0,
          revise: chiffre.revise || 0,
          previsionnel: chiffre.previsionnel || 0,
          consomme: chiffre.consomme || 0,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    this.clearCache();
    return data;
  }

  async updateChiffre(idChiffres: number, chiffre: Partial<Chiffre>): Promise<Chiffre> {
    const updateData: any = {};

    if (chiffre.initial !== undefined) updateData.initial = chiffre.initial;
    if (chiffre.revise !== undefined) updateData.revise = chiffre.revise;
    if (chiffre.previsionnel !== undefined) updateData.previsionnel = chiffre.previsionnel;
    if (chiffre.consomme !== undefined) updateData.consomme = chiffre.consomme;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await this.supabase.client
      .from(DB_TABLES.CHIFFRES)
      .update(updateData)
      .eq('id_chiffres', idChiffres)
      .select()
      .single();

    if (error) throw error;
    this.clearCache();
    return data;
  }

  async deleteChiffre(idChiffres: number): Promise<void> {
    const { error } = await this.supabase.client.from(DB_TABLES.CHIFFRES).delete().eq('id_chiffres', idChiffres);

    if (error) throw error;
    this.clearCache();
  }

  async getRAFByDate(idProjet: string, idService: string, fromDate: string): Promise<number> {
    // RAF = sum of charges after the specified date
    // Note: charges table uses 'projet_id' and we need to match service via equipe_id
    // For now, we'll sum all charges from the project after the date
    const data = await this.chargeService.getChargesByProjectIdAndDate(idProjet, fromDate);

    // dans data je veux filtrer à la fois sur les role_id ou les personne_id non nulls
    //maintenant je veux filtrer sur le service correspondant
    const filteredData = [];

    for (const charge of data) {
      if (charge.role_id) {
        const serviceIds = await this.rolesService.getServiceIdUUIDListFromRoleId(charge.role_id);
        if (serviceIds.includes(idService)) {
          filteredData.push(charge);
          const role = await this.rolesService.getRole(charge.role_id);
          if (role) {
            charge.jours_par_semaine = role.jours_par_semaine;
          }
        }
      }
      if (charge.personne_id) {
        const serviceIds = await this.personnesService.getServiceIdsByPersonneId(charge.personne_id);
        if (serviceIds.service_id === idService) {
          filteredData.push(charge);
          const personne = await this.personnesService.getPersonne(charge.personne_id);
          if (personne) {
            charge.jours_par_semaine = personne.jours_par_semaine;
          }
        }
      }
    }

    //on ajoute les charges des roles et des personnes qui sont associées au service
    const total = filteredData.reduce(
      (sum, charge) => sum + (charge.unite_ressource || 0) * (charge.jours_par_semaine || 0),
      0,
    );
    return total;
  }
}
