export type SettingType = 'string' | 'number' | 'boolean' | 'json';

export interface Setting {
    id?: string;
    key: string;
    value: string;
    type: SettingType;
    scope: string;
    description?: string;
    created_at?: string;
    updated_at?: string;
}
