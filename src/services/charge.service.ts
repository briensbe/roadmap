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
}
