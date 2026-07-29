import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-crewdayz-secret',
};

serve(async (req: Request) => {
  console.log(`\n=================== [CREWDAYZ-WEBHOOK REQUEST] ===================`);
  console.log(`Method: ${req.method} | URL: ${req.url}`);

  // Affichage de l'ensemble des en-têtes HTTP reçus
  const headersObject: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headersObject[key] = value;
  });
  console.log('HTTP Headers reçus:', JSON.stringify(headersObject, null, 2));

  if (req.method === 'OPTIONS') {
    console.log('Traitement requête OPTIONS (CORS preflight)');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Récupération et affichage des jetons et en-têtes d'authentification
    const authHeader = req.headers.get('Authorization') || '';
    const customSecretHeader = req.headers.get('X-Crewdayz-Secret') || '';

    // Supporte indifféremment ROADMAP_WEBHOOK_SECRET ou CREWDAYZ_WEBHOOK_BEARER_TOKEN
    const expectedToken = Deno.env.get('ROADMAP_WEBHOOK_SECRET') || Deno.env.get('CREWDAYZ_WEBHOOK_BEARER_TOKEN');
console.log('Expected token:', expectedToken);
    const tokenFromAuth = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
    const isTokenValid = Boolean(
      expectedToken && ((tokenFromAuth && tokenFromAuth === expectedToken) || (customSecretHeader && customSecretHeader === expectedToken))
    );

    console.log(`[AUTH CHECK]`);
    console.log(`  - Header Authorization (brut) : "${authHeader}"`);
    console.log(`  - Token extrait d'Authorization : "${tokenFromAuth}"`);
    console.log(`  - Header X-Crewdayz-Secret       : "${customSecretHeader}"`);
    console.log(`  - Jeton attendu (Deno env)       : "${expectedToken}"`);
    console.log(`  - Jeton Valide ?                : ${isTokenValid ? '✅ OUI' : '❌ NON'}`);

    if (!expectedToken || !isTokenValid) {
      console.warn('❌ [AUTH FAILED] Accès refusé - Jeton secret absent ou non valide');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or missing secret token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = await req.json();
    console.log('Payload JSON reçu:', JSON.stringify(payload, null, 2));

    const source = payload.source || 'crewdayz';
    const eventType = payload.event_type || 'data_updated';
    const eventPayload = payload.payload || {};

    // 2. Initialisation du client Supabase Service Role
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Protection Anti-Rafales (Throttling secondaire < 2s)
    const { data: lastEvent } = await supabase
      .from('roadmap_integration_events')
      .select('created_at')
      .eq('source', source)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastEvent?.created_at) {
      const lastTime = new Date(lastEvent.created_at).getTime();
      const nowTime = new Date().getTime();
      if (nowTime - lastTime < 2000) {
        console.log('ℹ️ [THROTTLED] Événement ignoré (moins de 2s depuis le dernier événement enregistré)');
        return new Response(
          JSON.stringify({ status: 'ignored', reason: 'Throttled (event received < 2s ago)' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 4. Insertion dans la table roadmap_integration_events
    const { data, error } = await supabase
      .from('roadmap_integration_events')
      .insert([
        {
          source,
          event_type: eventType,
          payload: eventPayload,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur lors de l insertion en BDD:', error);
      throw error;
    }

    console.log(`✅ Événement enregistré avec succès dans roadmap_integration_events (ID: ${data.id})`);
    return new Response(
      JSON.stringify({ status: 'success', event_id: data.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('❌ Erreur interne Edge Function:', err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
