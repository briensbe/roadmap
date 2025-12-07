import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Charge, Role, Personne } from '../models/types';
import { TeamService } from './team.service';

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
            .from('charges')
            .select('*')
            .order('semaine_debut');

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
            .from('charges')
            .select('*')
            .eq('projet_id', projectId)
            .order('semaine_debut');

        if (error) throw error;
        return data || [];
    }

    async getChargesByTeam(teamId: string): Promise<Charge[]> {
        if (this._chargesCache) {
            return this._chargesCache.filter(c => c.equipe_id === teamId);
        }

        const { data, error } = await this.supabase.client
            .from('charges')
            .select('*')
            .eq('equipe_id', teamId)
            .order('semaine_debut');

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
            .from('charges')
            .insert([chargeData])
            .select()
            .single();

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
            .from('charges')
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
                .from('charges')
                .update({ unite_ressource: uniteRessource })
                .eq('id', existingCharges[0].id)
                .select()
                .single();

            if (error) throw error;
            this.clearCache();
            return data;
        } else {
            // Create new charge
            const { data, error } = await this.supabase.client
                .from('charges')
                .insert([chargeData])
                .select()
                .single();

            if (error) throw error;
            this.clearCache();
            return data;
        }
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
            .from('charges')
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
            .from('charges')
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
}
