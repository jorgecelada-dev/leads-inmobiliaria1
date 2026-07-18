// Edge Function: send-marketing-email
//
// Se llama directamente desde el panel privado (marketing.html) cuando un
// trabajador envía una campaña manual a una selección de leads.
// Requiere { leadIds: string[], subject: string, body: string } en el body.
//
// Los leads se vuelven a consultar aquí (no se confía en lo que mande el
// cliente) usando el propio token del trabajador que llama, respetando RLS.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_ADDRESS = "Invest Spain Properties <onboarding@resend.dev>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

Deno.serve(async (req) => {
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY no configurada" }), { status: 500 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Falta autorización" }), { status: 401 });
  }

  const { leadIds, subject, body } = await req.json();
  if (!Array.isArray(leadIds) || leadIds.length === 0 || !subject || !body) {
    return new Response(JSON.stringify({ error: "Faltan datos: leadIds, subject o body" }), { status: 400 });
  }

  // Solo leads que existan Y estén suscritos a marketing (aunque el filtro ya
  // se aplicó en el cliente, se vuelve a comprobar aquí por seguridad).
  const respuestaLeads = await fetch(
    `${SUPABASE_URL}/rest/v1/leads?select=id,full_name,email&marketing_opt_in=eq.true&id=in.(${leadIds.join(",")})`,
    { headers: { "Authorization": authHeader, "apikey": SUPABASE_ANON_KEY ?? "" } },
  );
  if (!respuestaLeads.ok) {
    return new Response(JSON.stringify({ error: "No se pudieron recuperar los leads" }), { status: 500 });
  }
  const leads = await respuestaLeads.json();

  const htmlBody = String(body).replace(/\n/g, "<br>");

  const resultados = await Promise.all(leads.map(async (lead: { id: string; full_name: string; email: string }) => {
    try {
      const respuesta = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({ from: FROM_ADDRESS, to: lead.email, subject, html: htmlBody }),
      });
      const ok = respuesta.ok;
      if (ok) {
        await fetch(`${SUPABASE_URL}/rest/v1/email_log`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": authHeader,
            "apikey": SUPABASE_ANON_KEY ?? "",
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({ lead_id: lead.id, subject }),
        });
      }
      return { lead_id: lead.id, email: lead.email, ok, status: respuesta.status };
    } catch (error) {
      return { lead_id: lead.id, email: lead.email, ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }));

  return new Response(
    JSON.stringify({ enviados: resultados.filter((r) => r.ok).length, total: resultados.length, resultados }),
    { headers: { "Content-Type": "application/json" }, status: 200 },
  );
});
