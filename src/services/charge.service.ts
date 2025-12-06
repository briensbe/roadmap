import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Charge } from '../models/types';

@Injectable({
    providedIn: 'root'
})
export class ChargeService {
    constructor(private supabase: SupabaseService) { }

    async getAllCharges(): Promise<Charge[]> {
        const { data, error } = await this.supabase.client
            .from('charges')
            .select('*')
            .order('semaine_debut');

        if (error) throw error;
        return data || [];
    }

    async getChargesByProject(projectId: string): Promise<Charge[]> {
        const { data, error } = await this.supabase.client
            .from('charges')
            .select('*')
            .eq('projet_id', projectId)
            .order('semaine_debut');

        if (error) throw error;
        return data || [];
    }

    async getChargesByTeam(teamId: string): Promise<Charge[]> {
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
            return data;
        } else {
            // Create new charge
            const { data, error } = await this.supabase.client
                .from('charges')
                .insert([chargeData])
                .select()
                .single();

            if (error) throw error;
            return data;
        }
    }
}
