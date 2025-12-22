import { Injectable } from "@angular/core";
import { SupabaseService } from "./supabase.service";
import { Role, RoleAttachment } from "../models/types";

@Injectable({
    providedIn: "root"
})
export class RolesService {
    private _rolesCache: Role[] | null = null;
    private _attachmentsCache: RoleAttachment[] | null = null;

    constructor(private supabase: SupabaseService) { }

    private clearCache() {
        this._rolesCache = null;
        this._attachmentsCache = null;
    }

    /**
     * Récupère tous les rôles avec gestion de cache
     */
    async getAllRoles(): Promise<Role[]> {
        if (this._rolesCache) {
            return this._rolesCache;
        }

        const { data, error } = await this.supabase.client
            .from("roles")
            .select("*")
            .order("nom", { ascending: true });

        if (error) throw error;
        this._rolesCache = data || [];
        return this._rolesCache;
    }

    /**
     * Récupère tous les attachements de rôles avec gestion de cache
     */
    async getAllRoleAttachments(): Promise<RoleAttachment[]> {
        if (this._attachmentsCache) {
            return this._attachmentsCache;
        }

        const { data, error } = await this.supabase.client
            .from("role_attachments")
            .select("*");

        if (error) throw error;
        this._attachmentsCache = data || [];
        return this._attachmentsCache;
    }

    /**
     * Récupère un rôle spécifique par son ID
     */
    async getRole(id: string): Promise<Role | null> {
        const roles = await this.getAllRoles();
        return roles.find(r => r.id === id) || null;
    }

    /**
     * Récupère l'id_service à partir d'un role_id
     * Utilise le cache des attachements pour une performance optimale
     */
    async getIdServiceFromRoleId(roleId: string): Promise<number | null> {
        const attachments = await this.getAllRoleAttachments();
        const attachment = attachments.find(a => a.role_id === roleId);
        return attachment?.id_service || null;
    }

    //récupère le service_id (UUID) à partir d'un role_id
    async getServiceIdUUIDFromRoleId(roleId: string): Promise<string | null> {
        const attachments = await this.getAllRoleAttachments();
        const attachment = attachments.find(a => a.role_id === roleId);
        return attachment?.service_id || null;
    }

    /**
     * Récupère les attachements pour un rôle spécifique
     */
    async getAttachmentsByRoleId(roleId: string): Promise<RoleAttachment[]> {
        const attachments = await this.getAllRoleAttachments();
        return attachments.filter(a => a.role_id === roleId);
    }

    async createRole(role: Partial<Role>): Promise<Role> {
        const { data, error } = await this.supabase.client
            .from("roles")
            .insert([role])
            .select()
            .single();

        if (error) throw error;
        this.clearCache();
        return data;
    }

    async updateRole(id: string, role: Partial<Role>): Promise<Role> {
        const { data, error } = await this.supabase.client
            .from("roles")
            .update(role)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;
        this.clearCache();
        return data;
    }

    async deleteRole(id: string): Promise<void> {
        const { error } = await this.supabase.client
            .from("roles")
            .delete()
            .eq("id", id);

        if (error) throw error;
        this.clearCache();
    }

    async createRoleAttachment(attachment: Partial<RoleAttachment>): Promise<RoleAttachment> {
        const { data, error } = await this.supabase.client
            .from("role_attachments")
            .insert([attachment])
            .select()
            .single();

        if (error) throw error;
        this.clearCache();
        return data;
    }

    async deleteRoleAttachment(id: string): Promise<void> {
        const { error } = await this.supabase.client
            .from("role_attachments")
            .delete()
            .eq("id", id);

        if (error) throw error;
        this.clearCache();
    }
}
