import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Charge, Role, Personne } from '../models/types';
import { TeamService } from './team.service';
import { DB_TABLES } from '../constants/db-tables';

@Injectable({
    providedIn: 'root'
})
export class ChargeService {
    // Simple cache for charges
    private _chargesCache: Charge[] | null = null;

    constructor(private supabase: SupabaseService, private teamService: TeamService) { }

    private clearCache() {
        this._chargesCache = null;
    }

    async getAllCharges(): Promise<Charge[]> {
        if (this._chargesCache) return this._chargesCache;

        const { data, error } = await this.supabase.client
            .from(DB_TABLES.CHARGES)
            .select('*')
            .order('semaine_debut', { nullsFirst: true });

        if (error) throw error;
        this._chargesCache = data || [];
        return this._chargesCache;
    }

    async getChargesByProject(projectId: string): Promise<Charge[]> {
        // If we have full cache, filter locally to avoid extra query
        if (this._chargesCache) {
            return this._chargesCache.filter(c => c.projet_id === projectId);
        }

        const { data, error } = await this.supabase.client
            .from(DB_TABLES.CHARGES)
            .select('*')
            .eq('projet_id', projectId)
            .order('semaine_debut', { nullsFirst: true });

        if (error) throw error;
        return data || [];
    }

    async getChargesByTeam(teamId: string): Promise<Charge[]> {
        if (this._chargesCache) {
            return this._chargesCache.filter(c => c.equipe_id === teamId);
        }

        const { data, error } = await this.supabase.client
            .from(DB_TABLES.CHARGES)
            .select('*')
            .eq('equipe_id', teamId)
            .order('semaine_debut', { nullsFirst: true });

        if (error) throw error;
        return data || [];
    }

    async createChargeWithoutDates(
        projetId: string,
        equipeId: string,
        roleId?: string,
        personneId?: string,
        uniteRessource: number = 1
    ): Promise<Charge> {
        const chargeData: any = {
            projet_id: projetId,
            equipe_id: equipeId,
            unite_ressource: uniteRessource,
            semaine_debut: null,
            semaine_fin: null
        };

        if (roleId) {
            chargeData.role_id = roleId;
        }
        if (personneId) {
            chargeData.personne_id = personneId;
        }

        const { data, error } = await this.supabase.client
            .from(DB_TABLES.CHARGES)
            .insert([chargeData])
            .select()
            .maybeSingle(); // Renvoie null proprement si rien n'est trouvé

        if (error) throw error;
        // Invalidate cache
        this.clearCache();
        return data;
    }

    async createOrUpdateCharge(
        projetId: string,
        equipeId: string,
        semaineDebut: string,
        uniteRessource: number,
        roleId?: string,
        personneId?: string
    ): Promise<Charge> {
        // First, try to find an existing charge with the same parameters
        let query = this.supabase.client
            .from(DB_TABLES.CHARGES)
            .select('*')
            .eq('projet_id', projetId)
            .eq('equipe_id', equipeId)
            .eq('semaine_debut', semaineDebut);

        if (roleId) {
            query = query.eq('role_id', roleId);
        } else {
            query = query.is('role_id', null);
        }

        if (personneId) {
            query = query.eq('personne_id', personneId);
        } else {
            query = query.is('personne_id', null);
        }

        const { data: existingCharges, error: searchError } = await query;

        if (searchError) throw searchError;

        const chargeData: any = {
            projet_id: projetId,
            equipe_id: equipeId,
            semaine_debut: semaineDebut,
            semaine_fin: semaineDebut,
            unite_ressource: uniteRessource
        };

        if (roleId) {
            chargeData.role_id = roleId;
        }
        if (personneId) {
            chargeData.personne_id = personneId;
        }

        if (existingCharges && existingCharges.length > 0) {
            // Update existing charge
            const { data, error } = await this.supabase.client
                .from(DB_TABLES.CHARGES)
                .update({ unite_ressource: uniteRessource })
                .eq('id', existingCharges[0].id)
                .select()
                .maybeSingle(); // Renvoie null proprement si rien n'est trouvé

            if (error) throw error;
            this.clearCache();
            return data;
        } else {
            // Create new charge
            const { data, error } = await this.supabase.client
                .from(DB_TABLES.CHARGES)
                .insert([chargeData])
                .select()
                .maybeSingle(); // Renvoie null proprement si rien n'est trouvé

            if (error) throw error;
            this.clearCache();
            return data;
        }
    }

    /**
     * Bulk move: transfers charges from source weeks to target weeks in 3 queries.
     * All cells must belong to the same resource (same projet, equipe, role/personne).
     */
    async bulkMoveCharges(
        projetId: string,
        equipeId: string,
        moves: Array<{ fromWeek: string; toWeek: string; value: number }>,
        roleId?: string,
        personneId?: string
    ): Promise<void> {
        if (moves.length === 0) return;

        const allWeeks = [...new Set([...moves.map(m => m.fromWeek), ...moves.map(m => m.toWeek)])];
        const sourceWeeks = moves.map(m => m.fromWeek);

        // 1. SELECT existing records for all affected weeks (source + destination)
        let query: any = this.supabase.client
            .from(DB_TABLES.CHARGES)
            .select('id, semaine_debut')
            .eq('projet_id', projetId)
            .eq('equipe_id', equipeId)
            .in('semaine_debut', allWeeks);

        if (roleId)     query = query.eq('role_id', roleId);
        else            query = query.is('role_id', null);
        if (personneId) query = query.eq('personne_id', personneId);
        else            query = query.is('personne_id', null);

        const { data: existing, error: selectError } = await query;
        if (selectError) throw selectError;

        const existingByWeek = new Map<string, string>((existing || []).map((r: any) => [r.semaine_debut, r.id]));

        // 2. UPSERT destination weeks
        const upsertRows = moves.map(m => {
            const row: any = {
                projet_id: projetId,
                equipe_id: equipeId,
                semaine_debut: m.toWeek,
                semaine_fin: m.toWeek,
                unite_ressource: m.value,
            };
            if (roleId)     row.role_id = roleId;
            if (personneId) row.personne_id = personneId;
            const existingId = existingByWeek.get(m.toWeek);
            if (existingId) row.id = existingId;
            return row;
        });

        const toUpdate = upsertRows.filter(r => r.id);
        const toInsert = upsertRows.filter(r => !r.id);

        if (toUpdate.length > 0) {
            const { error: updateError } = await this.supabase.client
                .from(DB_TABLES.CHARGES)
                .upsert(toUpdate, { onConflict: 'id' });
            if (updateError) throw updateError;
        }

        if (toInsert.length > 0) {
            const { error: insertError } = await this.supabase.client
                .from(DB_TABLES.CHARGES)
                .insert(toInsert);
            if (insertError) throw insertError;
        }

        // 3. UPDATE source weeks to 0 — skip weeks also used as destination
        const destinationWeeks = new Set(moves.map(m => m.toWeek));
        const idsToZero = sourceWeeks
            .filter(w => !destinationWeeks.has(w))
            .map(w => existingByWeek.get(w))
            .filter(Boolean) as string[];

        if (idsToZero.length > 0) {
            const { error: zeroError } = await this.supabase.client
                .from(DB_TABLES.CHARGES)
                .update({ unite_ressource: 0 })
                .in('id', idsToZero);
            if (zeroError) throw zeroError;
        }

        this.clearCache();
    }

    /**
     * Get available roles for a project + team combination
     * (roles not already in a charge for this project+team)
     */
    async getAvailableRolesForProjectTeam(projetId: string, equipeId: string): Promise<Role[]> {
        // Get all roles
        const allRoles = await this.teamService.getAllRoles();

        // Get all charges for this project+team
        const chargesInCombination = await this.supabase.client
            .from(DB_TABLES.CHARGES)
            .select('role_id')
            .eq('projet_id', projetId)
            .eq('equipe_id', equipeId);

        if (chargesInCombination.error) throw chargesInCombination.error;

        // Extract role IDs already in charges for this project+team
        const usedRoleIds = new Set(
            (chargesInCombination.data || [])
                .filter(c => c.role_id)
                .map(c => c.role_id)
        );

        // Filter out roles that are already used in this project+team
        return allRoles.filter(role => !usedRoleIds.has(role.id!));
    }

    /**
     * Get available persons for a project + team combination
     * (persons not already in a charge for this project+team)
     */
    async getAvailablePersonnesForProjectTeam(projetId: string, equipeId: string): Promise<Personne[]> {
        // Get all persons
        const allPersonnes = await this.teamService.getAllPersonnes();

        // Get all charges for this project+team
        const chargesInCombination = await this.supabase.client
            .from(DB_TABLES.CHARGES)
            .select('personne_id')
            .eq('projet_id', projetId)
            .eq('equipe_id', equipeId);

        if (chargesInCombination.error) throw chargesInCombination.error;

        // Extract person IDs already in charges for this project+team
        const usedPersonneIds = new Set(
            (chargesInCombination.data || [])
                .filter(c => c.personne_id)
                .map(c => c.personne_id)
        );

        // Filter out persons that are already used in this project+team
        return allPersonnes.filter(personne => !usedPersonneIds.has(personne.id!));
    }

    async getChargesByProjectIdAndDate(id: any, fromDate: string): Promise<Charge[]> {
        // pour l'instant pas de gestion de cache

        const formattedFirstDay = this.getFirstDayOfWeek(fromDate);

        const { data, error } = await this.supabase.client
            .from(DB_TABLES.CHARGES)
            .select("*")
            .eq("projet_id", id)
            .gte("semaine_debut", formattedFirstDay);

        if (error) throw error;
        return data || [];
    }

    async deleteChargesForResource(
        projetId: string | undefined,
        equipeId: string,
        roleId?: string,
        personneId?: string
    ): Promise<void> {
        let query = this.supabase.client
            .from(DB_TABLES.CHARGES)
            .delete()
            .eq('equipe_id', equipeId);

        if (projetId) {
            query = query.eq('projet_id', projetId);
        }

        if (roleId) {
            query = query.eq('role_id', roleId);
        } else if (personneId) {
            query = query.eq('personne_id', personneId);
        } else {
            // If neither roleId nor personneId is provided, we don't want to delete everything
            return;
        }

        const { error } = await query;
        if (error) throw error;

        // Invalidate cache
        this.clearCache();
    }

    async deleteChargesForProjectTeam(
        projetId: string,
        equipeId: string
    ): Promise<void> {
        const { error } = await this.supabase.client
            .from(DB_TABLES.CHARGES)
            .delete()
            .eq('projet_id', projetId)
            .eq('equipe_id', equipeId);

        if (error) throw error;

        // Invalidate cache
        this.clearCache();
    }


    private getFirstDayOfWeek(fromDate: string) {
        // console.log("fromDate : " + fromDate);

        // 1. Convertir la string en objet Date
        const inputDate = new Date(fromDate);

        // 2. Calculer le premier jour de la semaine (lundi)
        const firstDayOfWeek = new Date(inputDate);
        firstDayOfWeek.setDate(
            inputDate.getDate() - inputDate.getDay() + (inputDate.getDay() === 0 ? -6 : 1)
        );

        // 3. Formater le résultat en YYYY-MM-DD
        const formattedFirstDay = firstDayOfWeek.toISOString().split('T')[0];

        // console.log("formattedFirstDay" + formattedFirstDay); 
        return formattedFirstDay;
    }
}
