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
}
