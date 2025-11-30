import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Equipe, Role, Personne, Capacite } from '../models/types';

export interface EquipeResource {
    type: 'role' | 'personne';
    id: string;
    nom: string;
    prenom?: string;
    jours_par_semaine: number;
}

@Injectable({
    providedIn: 'root'
})
export class TeamService {
    constructor(private supabase: SupabaseService) { }

    async getAllEquipes(): Promise<Equipe[]> {
        const { data, error } = await this.supabase.client
            .from('equipes')
            .select('*')
            .order('nom');

        if (error) throw error;
        return data || [];
    }

    async getEquipeResources(equipeId: string): Promise<EquipeResource[]> {
        const resources: EquipeResource[] = [];

        // Get roles attached to this team
        const { data: roleAttachments, error: roleError } = await this.supabase.client
            .from('role_attachments')
            .select('role_id, roles(*)')
            .eq('equipe_id', equipeId);

        if (!roleError && roleAttachments) {
            roleAttachments.forEach((attachment: any) => {
                if (attachment.roles) {
                    resources.push({
                        type: 'role',
                        id: attachment.roles.id,
                        nom: attachment.roles.nom,
                        jours_par_semaine: attachment.roles.jours_par_semaine
                    });
                }
            });
        }

        // Get persons attached to this team
        const { data: personnes, error: personneError } = await this.supabase.client
            .from('personnes')
            .select('*')
            .eq('equipe_id', equipeId);

        if (!personneError && personnes) {
            personnes.forEach((personne: any) => {
                resources.push({
                    type: 'personne',
                    id: personne.id,
                    nom: personne.nom,
                    prenom: personne.prenom,
                    jours_par_semaine: personne.jours_par_semaine
                });
            });
        }

        return resources;
    }

    async getAllRoles(): Promise<Role[]> {
        const { data, error } = await this.supabase.client
            .from('roles')
            .select('*')
            .order('nom');

        if (error) throw error;
        return data || [];
    }

    async getAllPersonnes(): Promise<Personne[]> {
        const { data, error } = await this.supabase.client
            .from('personnes')
            .select('*')
            .order('nom', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    async addRoleToEquipe(equipeId: string, roleId: string): Promise<void> {
        const { error } = await this.supabase.client
            .from('role_attachments')
            .insert({
                role_id: roleId,
                equipe_id: equipeId
            });

        if (error) throw error;
    }

    async addPersonneToEquipe(equipeId: string, personneId: string): Promise<void> {
        const { error } = await this.supabase.client
            .from('personnes')
            .update({ equipe_id: equipeId })
            .eq('id', personneId);

        if (error) throw error;
    }

    async removeRoleFromEquipe(roleId: string, equipeId: string): Promise<void> {
        const { error } = await this.supabase.client
            .from('role_attachments')
            .delete()
            .eq('role_id', roleId)
            .eq('equipe_id', equipeId);

        if (error) throw error;
    }

    async removePersonneFromEquipe(personneId: string): Promise<void> {
        const { error } = await this.supabase.client
            .from('personnes')
            .update({ equipe_id: null })
            .eq('id', personneId);

        if (error) throw error;
    }

    async getCapacites(resourceId: string, type: 'role' | 'personne', equipeId: string): Promise<Capacite[]> {
        const query = this.supabase.client
            .from('capacites')
            .select('*')
            .eq('equipe_id', equipeId);

        if (type === 'role') {
            query.eq('role_id', resourceId);
        } else {
            query.eq('personne_id', resourceId);
        }

        const { data, error } = await query.order('semaine_debut');

        if (error) throw error;
        return data || [];
    }

    async saveCapacite(
        resourceId: string,
        type: 'role' | 'personne',
        equipeId: string,
        semaineDebut: string,
        capacite: number
    ): Promise<void> {
        const capaciteData: any = {
            semaine_debut: semaineDebut,
            capacite: capacite,
            equipe_id: equipeId
        };

        if (type === 'role') {
            capaciteData.role_id = resourceId;
        } else {
            capaciteData.personne_id = resourceId;
        }

        // Check if capacity already exists for this week
        const query = this.supabase.client
            .from('capacites')
            .select('id')
            .eq('semaine_debut', semaineDebut)
            .eq('equipe_id', equipeId);

        if (type === 'role') {
            query.eq('role_id', resourceId);
        } else {
            query.eq('personne_id', resourceId);
        }

        const { data: existing } = await query.single();

        if (existing) {
            // Update existing
            const { error } = await this.supabase.client
                .from('capacites')
                .update({ capacite })
                .eq('id', existing.id);

            if (error) throw error;
        } else {
            // Insert new
            const { error } = await this.supabase.client
                .from('capacites')
                .insert(capaciteData);

            if (error) throw error;
        }
    }

    async deleteCapacite(
        resourceId: string,
        type: 'role' | 'personne',
        semaineDebut: string
    ): Promise<void> {
        const query = this.supabase.client
            .from('capacites')
            .delete()
            .eq('semaine_debut', semaineDebut);

        if (type === 'role') {
            query.eq('role_id', resourceId);
        } else {
            query.eq('personne_id', resourceId);
        }

        const { error } = await query;
        if (error) throw error;
    }
}
