import { Injectable } from "@angular/core";
import { SupabaseService } from "./supabase.service";
import { Chiffre } from "../models/chiffres.type";
import { ServicesService } from "./services.service";
import { RolesService } from "./roles.service";
import { PersonnesService } from "./personnes.service";
import { ChargeService } from "./charge.service";
import { ProjetService } from "./projet.service";

@Injectable({
  providedIn: "root",
})
export class ChiffresService {
  private _chiffresCache: Chiffre[] | null = null;

  constructor(
    private supabase: SupabaseService,
    private servicesService: ServicesService,
    private rolesService: RolesService,
    private personnesService: PersonnesService,
    private chargeService: ChargeService,
    private projetService: ProjetService
  ) { }

  private clearCache() {
    this._chiffresCache = null;
  }

  async getAllChiffres(): Promise<Chiffre[]> {
    if (this._chiffresCache) {
      return this._chiffresCache;
    }

    const { data, error } = await this.supabase.client
      .from("chiffres")
      .select("*")
      .order("date_mise_a_jour", { ascending: false });

    if (error) throw error;
    this._chiffresCache = data || [];
    return this._chiffresCache;
  }

  async getChiffresByProject(idProjet: number): Promise<Chiffre[]> {
    if (this._chiffresCache) {
      return this._chiffresCache.filter((c) => c.id_projet === idProjet);
    }

    const { data, error } = await this.supabase.client
      .from("chiffres")
      .select("*")
      .eq("id_projet", idProjet)
      .order("id_service");

    if (error) throw error;
    return data || [];
  }

  async getChiffre(idProjet: number, idService: number): Promise<Chiffre | null> {
    const { data, error } = await this.supabase.client
      .from("chiffres")
      .select("*")
      .eq("id_projet", idProjet)
      .eq("id_service", idService)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async createChiffre(chiffre: Chiffre): Promise<Chiffre> {
    const { data, error } = await this.supabase.client
      .from("chiffres")
      .insert([
        {
          id_projet: chiffre.id_projet,
          id_service: chiffre.id_service,
          initial: chiffre.initial || 0,
          revise: chiffre.revise || 0,
          previsionnel: chiffre.previsionnel || 0,
          consomme: chiffre.consomme || 0,
          date_mise_a_jour: chiffre.date_mise_a_jour || new Date().toISOString(),
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
    if (chiffre.date_mise_a_jour !== undefined) updateData.date_mise_a_jour = chiffre.date_mise_a_jour;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await this.supabase.client
      .from("chiffres")
      .update(updateData)
      .eq("id_chiffres", idChiffres)
      .select()
      .single();

    if (error) throw error;
    this.clearCache();
    return data;
  }

  async deleteChiffre(idChiffres: number): Promise<void> {
    const { error } = await this.supabase.client.from("chiffres").delete().eq("id_chiffres", idChiffres);

    if (error) throw error;
    this.clearCache();
  }

  async getRAFByDate(idProjet: number, idService: number, fromDate: string): Promise<number> {

    const id = await this.projetService.getProjetIdUUID(idProjet);

    // RAF = sum of charges after the specified date
    // Note: charges table uses 'projet_id' and we need to match service via equipe_id
    // For now, we'll sum all charges from the project after the date
    const data = await this.chargeService.getChargesByProjectIdAndDate(id, fromDate);

    console.log(data);

    // dans data je veux filtrer à la fois sur les role_id ou les personne_id non nulls
    //maintenant je veux filtrer sur le service correspondant 
    const filteredData = [];

    for (const charge of data) {
      if (charge.role_id) {
        const serviceIds = await this.rolesService.getIdServiceListFromRoleId(charge.role_id);
        if (serviceIds.includes(idService)) {
          filteredData.push(charge);
        }
      }
      if (charge.personne_id) {
        const serviceIds = await this.personnesService.getServiceIdsByPersonneId(charge.personne_id);
        if (serviceIds.id_service === idService) {
          filteredData.push(charge);
        }
      }
    }

    console.log("filteredData : " + filteredData);
    //on ajoute les charges des roles et des personnes qui sont associées au service
    const total = filteredData.reduce((sum, charge) => sum + (charge.unite_ressource || 0), 0);
    return total;
  }

}


