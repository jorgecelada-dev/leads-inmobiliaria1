// Edge Function: send-lead-emails
//
// Se dispara desde un Database Webhook en cada INSERT sobre la tabla "leads".
// Envía dos emails vía Resend: confirmación al lead + notificación interna.
//
// Nota: mientras no haya un dominio verificado en Resend, el envío al lead
// fallará (sandbox solo permite enviar a la propia cuenta de Resend). Es un
// fallo esperado, no un bug — se resolverá al verificar un dominio.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const NOTIFY_EMAIL = Deno.env.get("NOTIFY_EMAIL") ?? "jorgeceladaa2@gmail.com";
const FROM_ADDRESS = "Invest Spain Properties <onboarding@resend.dev>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const TEXTOS = {
  es: {
    asunto: "Gracias por tu interés — Invest Spain Properties",
    cuerpo: (nombre: string) => `
      <p>Hola ${nombre},</p>
      <p>Gracias por contactar con Invest Spain Properties. Hemos recibido tu solicitud
      y nos pondremos en contacto contigo en breve con oportunidades que encajen con tu perfil.</p>
      <p>Un saludo,<br>Invest Spain Properties</p>
    `,
  },
  en: {
    asunto: "Thank you for your interest — Invest Spain Properties",
    cuerpo: (nombre: string) => `
      <p>Hi ${nombre},</p>
      <p>Thank you for contacting Invest Spain Properties. We've received your request
      and will be in touch shortly with opportunities matching your profile.</p>
      <p>Best regards,<br>Invest Spain Properties</p>
    `,
  },
};

function cuerpoNotificacionInterna(lead: Record<string, unknown>): string {
  return `
    <h2>Nuevo lead recibido</h2>
    <ul>
      <li><b>Nombre:</b> ${lead.full_name}</li>
      <li><b>Email:</b> ${lead.email}</li>
      <li><b>Teléfono:</b> ${lead.phone ?? "—"}</li>
      <li><b>País:</b> ${lead.country}</li>
      <li><b>¿Posee propiedad en España?:</b> ${lead.owns_property_spain ? "Sí" : "No"}</li>
      <li><b>Nº de propiedades:</b> ${lead.properties_count ?? "—"}</li>
      <li><b>Presupuesto:</b> ${lead.budget_range}</li>
      <li><b>Zona de interés:</b> ${lead.region_interest}</li>
      <li><b>Plazo:</b> ${lead.timeframe}</li>
      <li><b>Idioma del formulario:</b> ${lead.form_language ?? "—"}</li>
    </ul>
  `;
}

async function enviarEmail(destinatario: string, asunto: string, html: string) {
  try {
    const respuesta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to: destinatario, subject: asunto, html }),
    });
    const resultado = await respuesta.json();
    return { destinatario, ok: respuesta.ok, status: respuesta.status, resultado };
  } catch (error) {
    return { destinatario, ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

async function registrarEnvio(authHeader: string, leadId: string, asunto: string) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/email_log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
        "apikey": SUPABASE_ANON_KEY ?? "",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({ lead_id: leadId, subject: asunto }),
    });
  } catch (error) {
    console.error("No se pudo registrar el envío en email_log:", error);
  }
}

Deno.serve(async (req) => {
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY no configurada" }), { status: 500 });
  }

  const payload = await req.json();
  console.log("Payload recibido:", JSON.stringify(payload));
  const lead = payload.record;

  if (!lead) {
    return new Response(JSON.stringify({ error: "Sin registro de lead en el payload" }), { status: 400 });
  }

  const idioma = lead.form_language === "en" ? "en" : "es";
  const textoLead = TEXTOS[idioma];

  const [resultadoLead, resultadoInterno] = await Promise.all([
    enviarEmail(lead.email, textoLead.asunto, textoLead.cuerpo(lead.full_name)),
    enviarEmail(NOTIFY_EMAIL, `Nuevo lead: ${lead.full_name}`, cuerpoNotificacionInterna(lead)),
  ]);

  console.log("Resultado email lead:", JSON.stringify(resultadoLead));
  console.log("Resultado email interno:", JSON.stringify(resultadoInterno));

  if (resultadoLead.ok) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      await registrarEnvio(authHeader, lead.id, textoLead.asunto);
    }
  }

  return new Response(
    JSON.stringify({ resultadoLead, resultadoInterno }),
    { headers: { "Content-Type": "application/json" }, status: 200 },
  );
});
