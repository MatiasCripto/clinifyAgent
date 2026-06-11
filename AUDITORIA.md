# Auditoría Completa — OdontoCare / Clinify SaaS

**Fecha:** 2026-06-11
**Proyecto:** `odonto-saas` (Next.js 16 + Supabase + n8n + Evolution API)
**Versión:** 0.1.0
**Repo:** `kit-automatizaciones-n8n\odonto-saas`

---

## Índice

1. [Árbol de estructura completo](#1-árbol-de-estructura-completo)
2. [Arquitectura general](#2-arquitectura-general)
3. [Flujos principales](#3-flujos-principales)
4. [Base de datos](#4-base-de-datos)
5. [APIs y endpoints](#5-apis-y-endpoints)
6. [Servicios externos integrados](#6-servicios-externos-integrados)
7. [Autenticación y seguridad](#7-autenticación-y-seguridad)
8. [Variables de entorno](#8-variables-de-entorno)
9. [Problemas detectados](#9-problemas-detectados)
10. [Estado general de la app](#10-estado-general-de-la-app)

---

## 1. Árbol de estructura completo

```
odonto-saas/
├── .env                          # Docker Compose — servicios autogestionados
├── .env.example                  # Template de variables de entorno (SaaS)
├── .env.local                    # ⚠️ LIVE: contiene credenciales Supabase reales
├── .env.local.example            # Template local más limpio
├── .gitignore                    # Oculta .env*, node_modules, .next, etc.
├── AGENTS.md                     # Instrucciones para Claude Code
├── CLAUDE.md                     # Enlace a AGENTS.md
├── AUDITORIA.md                  # Este archivo
├── README.md                     # README genérico de Next.js (sin personalizar)
├── TUTORIAL.html                 # Tutorial HTML embebido
├── docker-compose.yml            # Infraestructura: PostgreSQL, Redis, n8n, Evolution API
├── next.config.ts                # Next.js config (vacío, sin personalización)
├── tsconfig.json                 # TypeScript strict, path alias @/ -> src/
├── vercel.json                   # Deploy en Vercel región gru1 (São Paulo)
├── vitest.config.ts              # Tests unitarios con vitest + happy-dom
├── playwright.config.ts          # Tests E2E con Playwright (chromium only)
├── postcss.config.mjs            # Tailwind CSS v4
├── eslint.config.mjs             # ESLint 9 con Next.js configs
├── package.json                  # 22 dependencias, 16 devDependencies
├── package-lock.json
├── memory-session.md             # Notas de sesión anterior (artefactos HTML)
├── qr_concierge_wpp.png          # QR de WhatsApp
│
├── src/                          # ★ CÓDIGO FUENTE DE LA APP ★
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx            # Root layout con Providers + Service Worker
│   │   ├── globals.css           # Estilos globales + Tailwind
│   │   ├── favicon.ico
│   │   │
│   │   ├── (auth)/               # Grupo de rutas de autenticación
│   │   │   ├── login/page.tsx    # Login de usuario
│   │   │   └── register/page.tsx # Registro de usuario
│   │   │
│   │   ├── (dashboard)/          # Grupo de rutas del dashboard (logueado)
│   │   │   ├── layout.tsx        # Layout con sidebar + topbar + AuthGuard
│   │   │   ├── overview/page.tsx # Panel principal con KPIs y métricas
│   │   │   ├── appointments/     # Gestión de turnos
│   │   │   ├── patients/         # CRUD de pacientes + historias clínicas
│   │   │   ├── professionals/    # Gestión de profesionales
│   │   │   ├── calendar/         # Calendario visual de turnos
│   │   │   ├── messages/         # Bandeja de mensajes WhatsApp
│   │   │   ├── analytics/        # Analíticas y reportes
│   │   │   ├── automations/      # Configuración de automatizaciones
│   │   │   ├── billing/          # Facturación
│   │   │   └── settings/         # Configuración general + AI + Evolution
│   │   │
│   │   ├── superadmin/           # Panel de superadmin (multi-tenant)
│   │   │   ├── layout.tsx        # Layout de superadmin
│   │   │   ├── login/page.tsx    # Login de superadmin
│   │   │   ├── dashboard/        # Dashboard global
│   │   │   ├── clients/          # Gestión de organizaciones
│   │   │   ├── users/            # Gestión de usuarios
│   │   │   ├── subscriptions/    # Suscripciones y planes
│   │   │   ├── billing/          # Facturación global
│   │   │   ├── analytics/        # Analytics global
│   │   │   ├── config/           # Feature flags + API keys + config
│   │   │   ├── security/         # Seguridad y sesiones
│   │   │   ├── logs/             # Logs de actividad
│   │   │   └── support/          # Tickets de soporte
│   │   │
│   │   └── api/                  # ★ API ROUTES (backend) ★
│   │       ├── health/route.ts       # Health check
│   │       ├── auth/log-session/     # Log de inicio de sesión
│   │       ├── webhooks/whatsapp/    # ★ Webhook principal de WhatsApp (AI bot)
│   │       ├── bot/send/             # Enviar mensaje WhatsApp manualmente
│   │       ├── evolution/{status,connect,disconnect}/  # Gestión instancia Evolution
│   │       ├── jobs/{reminder-24h,reminder-1h,post-appointment-nps,churn-recovery,automation-log}/
│   │       ├── appointments/     # CRUD turnos
│   │       ├── patients/         # CRUD pacientes
│   │       ├── invoices/         # Facturación
│   │       ├── analytics/        # Analytics
│   │       ├── settings/{clinic,organization,professionals,specialties,availability,service-areas,ai-config}/
│   │       ├── support/tickets/  # Tickets de soporte
│   │       └── superadmin/{organizations,users,subscriptions,billing,analytics,dashboard,config,security,logs,support}/
│   │
│   ├── components/               # ★ COMPONENTES REUTILIZABLES ★
│   │   ├── ui/                   # Shadcn-style primitives (Button, Input, Modal, etc.)
│   │   ├── layout/               # Sidebar, Topbar, Providers, AuthGuard, ClinicSelector
│   │   ├── auth/                 # LoginForm
│   │   ├── dashboard/            # StatsCard, AppointmentRow, MetricCard
│   │   ├── patients/             # PatientCard, PatientDetail, ArtifactViewer (iframe)
│   │   ├── professionals/        # ProfessionalCard, ProfessionalDetail
│   │   ├── calendar/             # Componentes de calendario
│   │   ├── messages/             # ConversationList, MessageBubble
│   │   ├── analytics/            # ChurnTable
│   │   ├── settings/             # Settings forms
│   │   └── whatsapp/             # Componentes WhatsApp
│   │
│   ├── lib/                      # ★ LÓGICA DE NEGOCIO Y UTILIDADES ★
│   │   ├── supabase/             # Clientes Supabase
│   │   │   ├── client.ts         #   Browser client (anon key)
│   │   │   ├── server.ts         #   Server component client
│   │   │   ├── server-admin.ts   #   Service role client (admin)
│   │   │   ├── service.ts        #   Service client (similar a server-admin)
│   │   │   └── middleware.ts     #   Session update helper (NUNCA se ejecuta solo)
│   │   ├── bot/                  # ★ MOTOR DEL BOT DE WHATSAPP ★
│   │   │   ├── ai-chat.ts        #   Multi-provider AI (OpenAI, Anthropic, DeepSeek, Groq, Gemini)
│   │   │   ├── conversation-engine.ts  # State machine del bot
│   │   │   ├── intent-classifier.ts    # Clasificador de intenciones
│   │   │   ├── evolution-client.ts     # Cliente HTTP para Evolution API
│   │   │   └── responses.ts     #   Template de respuestas
│   │   ├── hooks/                # Custom hooks
│   │   │   ├── auth-context.tsx  #   AuthProvider + useAuthContext (cliente)
│   │   │   └── use-auth.ts      #   Auth helper
│   │   ├── stores/               # Zustand stores
│   │   │   └── clinic.store.ts   #   Clinic store (incluye middleware)
│   │   ├── types/                # TypeScript types
│   │   │   ├── index.ts          #   Tipos principales
│   │   │   ├── database.types.ts #   Tipos generados de Supabase
│   │   │   ├── whatsapp.types.ts #   Tipos de WhatsApp/Evolution
│   │   │   └── n8n.types.ts      #   Tipos de n8n
│   │   ├── plans/                # Sistema de planes y límites
│   │   │   ├── index.ts          #   Plan definitions
│   │   │   ├── limits.ts         #   Plan limits
│   │   │   └── use-plan.ts       #   React hook para límites
│   │   ├── analytics/            # Motor de analytics
│   │   │   └── engine.ts         #   Cálculos de métricas
│   │   ├── data/                 # Datos semilla para desarrollo
│   │   │   ├── seed.ts           #   Seed data principal
│   │   │   ├── messages-seed.ts  #   Seed de mensajes
│   │   │   └── conversations-seed.ts # Seed de conversaciones
│   │   ├── constants/            # Constantes
│   │   └── utils/                # Utilidades
│   │       ├── cn.ts             #   className utility (clsx + tailwind-merge)
│   │       ├── formatters.ts     #   Formateo de fechas/monedas
│   │       ├── rate-limit.ts     #   Rate limiting
│   │       ├── patient-scores.ts #   Cálculo de scores
│   │       └── index.ts          #   Barrel export
│   │
│   ├── __tests__/                # ★ TESTS ★
│   │   ├── setup.ts              # Configuración de tests
│   │   ├── unit/                 # Tests unitarios
│   │   │   ├── bot/
│   │   │   │   ├── conversation-engine.test.ts
│   │   │   │   └── ai-parser.test.ts
│   │   │   ├── jobs/
│   │   │   │   └── reminders.test.ts
│   │   │   ├── analytics/
│   │   │   │   └── engine.test.ts
│   │   │   └── plans/
│   │   │       └── limits.test.ts
│   │   └── e2e/                  # Tests E2E (playwright) — VACÍO
│   │
│   └── proxy.ts                  # Proxy de desarrollo (sin uso claro)
│
├── public/                       # ★ ARCHIVOS ESTÁTICOS ★
│   ├── artifacts/                # ★ Artefactos clínicos HTML ★
│   │   ├── odontograma.html      #   Odontograma (dental chart)
│   │   ├── dermatologia.html     #   Mapa corporal (piel)
│   │   ├── kinesiologia.html     #   Mapa muscular
│   │   ├── oftalmologia.html     #   Diagrama ocular
│   │   ├── traumatologia.html    #   Mapa óseo
│   │   ├── ginecologia.html      #   Seguimiento gestacional
│   │   ├── psicologia.html       #   PHQ-9 / GAD-7
│   │   ├── nutricion.html        #   Evaluación nutricional
│   │   ├── pediatria.html        #   Curvas de crecimiento OMS
│   │   └── endocrinologia.html   #   Laboratorio endocrinología
│   ├── manifest.json             # PWA manifest
│   ├── sw.js                     # Service Worker (network-first, offline fallback)
│   ├── favicon.ico
│   └── *.svg                     # Iconos de Next.js
│
├── infrastructure/               # ★ INFRAESTRUCTURA ★
│   ├── supabase/migrations/      # 18 migrations SQL
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_clinical_billing_superadmin.sql
│   │   ├── 003_afip_credentials.sql
│   │   ├── 004_whatsapp_bot.sql
│   │   ├── 005_weekly_schedules.sql
│   │   ├── 006_professional_profiles.sql
│   │   ├── 007_clinic_whatsapp_instance.sql
│   │   ├── 008_service_areas.sql
│   │   ├── 009_superadmin_null_org.sql
│   │   ├── 010_patient_documents_bucket.sql
│   │   ├── 011_patient_documents_table.sql
│   │   ├── 012_trial_system.sql
│   │   ├── 013_storage_security.sql
│   │   ├── 014_double_booking_protection.sql
│   │   ├── 015_automation_logs_extend.sql
│   │   ├── 016_human_handoff.sql
│   │   ├── 016_specialties_catalog.sql  # ⚠️ CONFLICTO: mismo número que human_handoff
│   │   └── 017_artifact_data.sql
│   └── n8n/workflows/            # VACÍO (los workflows están en n8n-workflows/)
│
├── n8n-workflows/                # ★ WORKFLOWS DE n8n (15 archivos JSON) ★
│   ├── 01-incoming-message-router.json
│   ├── 02-new-patient-registration.json
│   ├── 03-appointment-booking.json
│   ├── 04-reminder-24h.json
│   ├── 05-reminder-1h.json
│   ├── 06-post-appointment-nps.json
│   ├── 07-nps-response-handler.json
│   ├── 08-churn-detection.json
│   ├── 09-churn-recovery-campaign.json
│   ├── 10-google-calendar-sync.json
│   ├── 11-human-handoff-notification.json
│   ├── 12-appointment-cancellation.json
│   ├── 13-missed-appointment-followup.json
│   ├── 14-daily-analytics-snapshot.json
│   └── 15-weekly-report.json
│
├── scripts/                      # ★ SCRIPTS DE UTILIDAD ★
│   ├── check-db.mjs              #   Diagnóstico DB (org UUID difiere del .ts)
│   ├── check-db.ts               #   Diagnóstico DB (otro org UUID)
│   ├── check-pepe.mts            #   Buscar usuario pepepompin@gmail.com
│   ├── check-schedules.mts       #   Ver horarios de profesionales
│   ├── clean-dupes.mts           #   Eliminar weekly_schedules duplicados
│   ├── cleanup.mts               #   Limpiar settings + desactivar profesionales
│   ├── dev-cron.ts               #   Cron local para dev (cada 15 min)
│   ├── fix-clinic.mts            #   Fix evolution_instance en clínicas
│   ├── fix-superadmin.mts        #   Crear/asegurar superadmin
│   ├── setup-storage-policies.mjs # ⚠️ CREDENCIALES HARDCODEADAS
│   └── wipe-schedules.mts        #   ELIMINA todos los horarios de una org
│
├── ventas/                       # VACÍO (carpeta sin archivos)
└── .github/                      # VACÍO
```

---

## 2. Arquitectura general

```
                          ┌──────────────────────────────────────┐
                          │          EVOLUTION API                │
                          │    (WhatsApp Gateway - atendai)       │
                          │         localhost:8080                │
                          └──────────┬───────────────────────────┘
                                     │ Webhook (messages.upsert)
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      n8n (WORKFLOW AUTOMATION)                      │
│                      localhost:5678                                  │
│                                                                     │
│  01-incoming-message-router ──► POST /api/webhooks/whatsapp        │
│  02-new-patient-registration   (Supabase + Evolution)              │
│  03-appointment-booking        (Supabase + Evolution)              │
│  04-reminder-24h / 05-reminder-1h (Schedule → Supabase → Evol.)   │
│  06-post-appointment-nps       (Schedule → Supabase → Evol.)      │
│  07-nps-response-handler       (Webhook → Supabase + SMTP)        │
│  08-churn-detection / 09-recovery (Schedule → Supabase → Evol.)   │
│  10-google-calendar-sync        (Webhook → Google Calendar)        │
│  11-human-handoff              (Webhook → SMTP + Slack)           │
│  12-cancellation                (Webhook → Supabase + Evol.)       │
│  13-missed-followup            (Schedule → Supabase → Evol.)       │
│  14-daily-analytics / 15-weekly-report (Schedule → Supabase)      │
│                                                                     │
│  Cola: Redis (Bull) ─── n8n_worker                                 │
└─────────────────────────────────────────────────────────────────────┘
        │                          │
        │ Supabase (DB + Auth)     │ HTTP (bot AI engine)
        ▼                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SUPABASE (PostgreSQL + Auth)                      │
│                                                                     │
│  ● 34 tablas públicas + 3 ENUMs                                    │
│  ● RLS multi-tenant por organización                                │
│  ● 19 triggers + 2 funciones                                        │
│  ● Storage: patient-documents bucket                                │
└──────────────────────────────────────────┬──────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    NEXT.JS APP (Clinify)                            │
│                                                                     │
│  FRONTEND (React 19):                                               │
│  ● Dashboard con KPIs y métricas                                    │
│  ● CRUD: pacientes, profesionales, turnos                           │
│  ● Historia clínica con artefactos visuales (iframe + postMessage)  │
│  ● Panel de mensajes WhatsApp                                       │
│  ● Facturación con soporte AFIP                                     │
│  ● Superadmin multi-tenant                                          │
│  ● PWA (Service Worker + Manifest)                                  │
│                                                                     │
│  BACKEND (Next.js API Routes):                                      │
│  ● Webhook de WhatsApp (bot AI + state machine)                     │
│  ● CRUD REST endpoints                                              │
│  ● Jobs programados (cron-style)                                    │
│  ● Integración Evolution API                                        │
│  ● Superadmin API                                                   │
│                                                                     │
│  AI BOT:                                                            │
│  ● Multi-provider: OpenAI, Anthropic, DeepSeek, Groq, Google Gemini │
│  ● State machine: 12 estados (conversation-engine.ts)               │
│  ● System prompt en español como secretaria virtual                 │
│  ● API key almacenada en organizations.settings.ai                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Capas:

| Capa | Tecnología | Ubicación |
|------|-----------|-----------|
| Frontend | Next.js 16 + React 19 + Tailwind v4 | `src/app/(dashboard)/`, `src/app/superadmin/` |
| UI Components | Radix UI primitives + Lucide icons | `src/components/` |
| Estado cliente | Zustand + React Context | `src/lib/stores/`, `src/lib/hooks/` |
| API Routes | Next.js App Router Route Handlers | `src/app/api/` |
| Base de datos | Supabase (PostgreSQL) + RLS | `infrastructure/supabase/migrations/` |
| Auth | Supabase Auth (built-in) | `src/lib/supabase/` |
| Automatización | n8n + Redis Bull queue | `n8n-workflows/`, `docker-compose.yml` |
| WhatsApp | Evolution API (atendai) | `src/lib/bot/evolution-client.ts` |
| AI Bot | State machine + Multi-provider AI | `src/lib/bot/` |
| Infraestructura | Docker Compose + Vercel | `docker-compose.yml`, `vercel.json` |

---

## 3. Flujos principales

### 3.1 Flujo de Registro (Onboarding)

```
Usuario visita /register
  → Supabase Auth: signUp(email, password)
  → Trigger `handle_new_user()` crea profile con role='staff'
  → Superadmin debe asignarlo a una organización (no hay auto-creación de org)
  → Redirige a /overview
  → AuthContext: carga user → profile → organization → clinics
  → Guarda currentClinic en localStorage('oc-current-clinic')
```

**Problema:** No hay flujo de onboarding completo. El usuario se registra pero no tiene organización ni clínica. El superadmin debe crearlas manualmente desde el panel superadmin.

### 3.2 Flujo de Autenticación

```
Request a ruta protegida
  → NO HAY MIDDLEWARE (no existe src/middleware.ts)
  → El layout del dashboard tiene AuthGuard client-side:
      AuthContext: si no hay user y loading=false → redirect a /login
  → updateSession() en middleware.ts existe pero NO SE USA:
      No hay archivo middleware.ts en src/raíz que lo invoque
```

**Problema CRÍTICO:** No hay middleware de servidor. La protección de rutas es solo client-side, lo que significa que un usuario no autenticado puede acceder a las API routes y ver el HTML de las páginas antes del redirect.

### 3.3 Flujo de Webhook de WhatsApp (entrante)

```
Evolution API detecta mensaje entrante
  → POST webhook a n8n (/webhook/whatsapp-inbound)
  → n8n verifica: ¿es messages.upsert? → ¿es outbound? (skip si propio)
  → Extrae: phone, text, pushName, messageId
  → POST a NEXT_APP_URL/api/webhooks/whatsapp
  → RespondToWebhook: { ok: true }

Server (Next.js API Route):
  → Opcional: verifica WEBHOOK_SECRET header
  → Busca wa_conversation por phone (o crea)
  → Recupera/crea paciente en DB
  → Conversation Engine procesa el mensaje:
      1. Intent Classifier clasifica intención
      2. State machine evalúa estado actual + input
      3. AI Chat (si aplica) genera respuesta natural
      4. Ejecuta acción si es necesario (booking, cancel, etc.)
  → Guarda wa_message
  → Envía respuesta via Evolution API

Intentos detectados:
  "saludar" → saluda y pide nombre
  "identificar" → busca paciente por nombre
  "consultar_turno" → lista próximos turnos
  "reservar" → inicia flujo de booking
  "cancelar" → pide detalles y cancela
  "nps" → registra respuesta NPS
  "humano" → human handoff
  "horarios" → consulta disponibilidad
  "datos" → actualiza datos del paciente
  "default" → AI chat general
```

### 3.4 Flujo de Configuración del Agente AI

```
Settings → AI Config (UI)
  → Usuario selecciona proveedor: OpenAI | Anthropic | DeepSeek | Groq | Google
  → Ingresa API Key
  → POST /api/settings/ai-config
  → Guarda en organizations.settings.ai = { provider, apiKey, model }
  → El bot usa esta config para generar respuestas

En cada mensaje entrante:
  → Carga organization.settings.ai
  → Si no hay apiKey configurada → usa respuestas predefinidas (responses.ts)
  → Si hay apiKey → construye system prompt + contexto DB → llama API
  → Devuelve JSON estructurado con respuesta + acción opcional
```

### 3.5 Flujo de Historia Clínica (Artefactos)

```
Patient Detail → ArtifactViewer (componente iframe)
  → Carga el HTML del artifact correspondiente (public/artifacts/*.html)
  → Envía tema via postMessage('artifact:theme')
  → Llama getState() en el artifact para leer estado
  → Envía vía postMessage('artifact:loadState', savedData)
  → Usuario interactúa (hace clic, completa formularios)
  → Al guardar: artifact.getState() → save to clinical_records.artifact_data
  → Al recargar: load artifact_data → postMessage('artifact:loadState')

Artefactos disponibles por especialidad:
  odontograma → Odontología
  dermatologia → Dermatología
  kinesiologia → Kinesiología
  oftalmologia → Oftalmología
  traumatologia → Traumatología
  ginecologia → Ginecología
  psicologia → Psicología
  nutricion → Nutrición
  pediatria → Pediatría
  endocrinologia → Endocrinología
  null → Cardiología, Neurología, Fonoaudiología (sin artefacto)
```

### 3.6 Flujo de Especialidades

```
Dos definiciones conflictivas de la tabla specialties:

Migración 001: specialties(id, organization_id NOT NULL, name, color, created_at)
Migración 016b: specialties(id, organization_id NULLABLE, name, artifact_type, is_default, created_at)

La 016b usa CREATE TABLE IF NOT EXISTS:
  → Si 001 ya creó la tabla → 016b es NO-OP
  → El schema REAL es el de 001 (sin artifact_type, sin is_default)
  → Los seed data de 016b no se insertan (ON CONFLICT DO NOTHING)

Especialidades sin artefacto clínico:
  - Cardiología
  - Neurología
  - Fonoaudiología
```

**Problema CONFIRMADO:** El seed de `016_specialties_catalog.sql` línea 56 tiene `('Endocrinología', null, true)` cuando debería ser `'endocrinologia'`. Y como la tabla ya existe por la migración 001, TODO el seed de 016b es inefectivo en una base nueva.

### 3.7 Flujo de Turnos (Booking vía WhatsApp)

```
Paciente escribe "TURNO" o "RESERVAR" por WhatsApp
  → Intent Classifier → "reservar"
  → Bot pregunta especialidad
  → Bot pregunta profesional
  → Bot consulta disponibilidad (availability_templates)
  → Bot ofrece horarios disponibles
  → Paciente elige horario
  → Bot confirma y ejecuta POST a n8n /book-appointment
  → n8n crea appointment en Supabase
  → n8n envía confirmación WhatsApp
  → n8n POST a /calendar-sync → Google Calendar
```

### 3.8 Flujo de Recordatorios

```
24h antes:
  n8n (cada 1h) → busca appointments con starts_at en ventana 23.5-24.5h
    → si reminder_sent=false y patient.phone existe
    → envía WhatsApp recordatorio
    → marca reminder_sent=true

1h antes:
  n8n (cada 15min) → busca appointments con starts_at en ventana 55-75min
    → envía WhatsApp (NO checkea reminder_sent)
    → ⚠️ NO marca nada como enviado
    → ⚠️ NO checkea si patient.phone existe
```

### 3.9 Flujo de NPS (Post-Consulta)

```
2h después del turno:
  n8n (cada 30min) → busca appointments completados hace 1.5-2.5h
    → si nps_sent=false
    → envía encuesta NPS (0-10) por WhatsApp
    → marca nps_sent=true

Respuesta del paciente:
  n8n webhook /nps-response → clasifica score (promotor/neutral/detractor)
    → guarda en nps_responses
    → envía thank-you message (personalizado por segmento)
    → si es detractor (0-6) → alerta por email al gerente
```

### 3.10 Flujo de Churn Detection & Recovery

```
Diario 8am:
  n8n → fetch pacientes activos
    → por cada uno: busca último turno
    → calcula días desde última visita
    → >365: churned (95%), >180: high (75%), >90: medium (45%), else: low (10%)
    → guarda en patient_scores (solo si no es low)

Semanal (lunes 10am):
  n8n → fetch patients_scores con high/churned
    → churned: envía WhatsApp con oferta de chequeo gratis
    → high: envía recordatorio para agendar turno
    → marca recovery_sent_at
```

---

## 4. Base de datos

### 4.1 Resumen de tablas (34 públicas + 3 ENUMs)

| # | Tabla | Migración | Propósito | RLS |
|---|-------|-----------|-----------|-----|
| 1 | `organizations` | 001 | Tenant principal (grupo clínica) | ✅ SELECT own |
| 2 | `clinics` | 001 | Sucursales | ✅ ALL org |
| 3 | `profiles` | 001 | Extensión de auth.users | ✅ ALL self/org |
| 4 | `profile_clinics` | 001 | M2M profile↔clinic | ✅ Inferred |
| 5 | `specialties` | 001/016b ⚠️ | Especialidades | ✅ Org members |
| 6 | `professionals` | 001 | Profesionales de salud | ✅ ALL org |
| 7 | `professional_clinics` | 001 | M2M professional↔clinic | ✅ Inferred |
| 8 | `availability_templates` | 001 | Disponibilidad semanal recurrente | — |
| 9 | `availability_blocks` | 001 | Períodos bloqueados | — |
| 10 | `patients` | 001 | Pacientes | ✅ ALL org |
| 11 | `appointments` | 001 | Turnos | ✅ ALL org |
| 12 | `conversations` | 001 | Conversaciones WhatsApp | ✅ ALL org |
| 13 | `messages` | 001 | Mensajes WhatsApp | ✅ ALL org |
| 14 | `nps_responses` | 001 | Respuestas NPS | ✅ ALL org |
| 15 | `patient_scores` | 001 | Scores comportamentales | ✅ ALL org |
| 16 | `analytics_daily` | 001 | Snapshots diarios | ✅ ALL org |
| 17 | `automation_logs` | 001 | Logs de n8n | ✅ ALL org |
| 18 | `tooth_records` | 002 | Registro odontograma por diente | ✅ ALL org |
| 19 | `clinical_records` | 002 | Sesiones de historia clínica | ✅ ALL org |
| 20 | `clinical_treatments` | 002 | Tratamientos por sesión | ✅ ALL org |
| 21 | `invoices` | 002 | Facturas (con soporte AFIP) | ✅ ALL org |
| 22 | `invoice_items` | 002 | Items de factura | ✅ ALL org |
| 23 | `subscriptions` | 002 | Suscripciones de organización | ❌ Sin RLS |
| 24 | `billing_records` | 002 | Historial de facturación global | ❌ Sin RLS |
| 25 | `support_tickets` | 002 | Tickets de soporte | ❌ Sin RLS |
| 26 | `feature_flags` | 002 | Feature flags plataforma | ❌ Sin RLS |
| 27 | `api_keys` | 002 | API keys de servicios externos | ❌ Sin RLS |
| 28 | `platform_config` | 002 | Configuración clave/valor | ❌ Sin RLS |
| 29 | `afip_credentials` | 003 | Credenciales AFIP por clínica | ✅ Owner/Admin |
| 30 | `wa_conversations` | 004 | Estado del bot de WhatsApp | ❌ Sin RLS |
| 31 | `wa_messages` | 004 | Historial del bot | ❌ Sin RLS |
| 32 | `weekly_schedules` | 005 | Override semanal de horarios | ❌ Sin RLS ⚠️ |
| 33 | `service_areas` | 008 | Áreas de servicio por profesional | ❌ Sin RLS ⚠️ |
| 34 | `patient_documents` | 011 | Metadatos de documentos | ✅ Org members |

**ENUMs:** `appointment_status` (pending|confirmed|cancelled|absent|completed), `message_direction` (inbound|outbound), `message_type` (text|image|audio|video|document|template)

### 4.2 Relaciones clave

```
organizations (tenant root)
  ├── clinics (sucursales)
  │   ├── appointments
  │   ├── invoices
  │   ├── clinical_records
  │   ├── tooth_records
  │   ├── conversations
  │   ├── nps_responses
  │   ├── analytics_daily
  │   ├── afip_credentials (1:1)
  │   └── availability_templates / blocks
  ├── profiles (usuarios)
  │   └── profile_clinics (M2M)
  ├── professionals
  │   ├── professional_clinics (M2M)
  │   ├── availability_templates / blocks
  │   ├── service_areas
  │   ├── weekly_schedules
  │   └── profile_id (nullable, added 006)
  ├── patients
  │   ├── appointments
  │   ├── clinical_records → clinical_treatments
  │   ├── tooth_records
  │   ├── invoices → invoice_items
  │   ├── patient_scores
  │   ├── patient_documents
  │   └── nps_responses
  ├── subscriptions (1:1)
  └── billing_records
```

### 4.3 RLS Policies — Resumen

**Bien diseñado:** Multi-tenant isolation por organización. Las tablas core (patients, appointments, professionals, clinical_records, invoices) tienen policies que encadenan `profile → organization → clinic`.

**Problemas:**
- `weekly_schedules` y `service_areas` tienen RLS enabled pero **0 policies definidas** → inaccesibles via authenticated user
- `wa_conversations` y `wa_messages` no tienen RLS enabled → cualquier usuario con anon key puede leer todas las conversaciones del bot
- `afip_credentials` bien restringido a owner/admin (no staff/viewer)

### 4.4 Índices importantes

- `appointments(professional_id, starts_at)` WHERE status != 'cancelled' — **UNIQUE partial index** (evita doble reserva)
- `automation_logs(entity_id, workflow)` WHERE status='success' — **UNIQUE partial** (dedup)
- `patient_documents(is_deleted)` WHERE is_deleted=false — partial index

---

## 5. APIs y endpoints

### 5.1 API Routes completas

| Método | Ruta | Propósito | Auth |
|--------|------|-----------|------|
| GET | `/api/health` | Health check | No |
| **Webhooks** | | | |
| POST | `/api/webhooks/whatsapp` | Webhook principal WhatsApp (bot) | WEBHOOK_SECRET (opt) |
| **Bot** | | | |
| POST | `/api/bot/send` | Enviar mensaje WhatsApp manualmente | Session |
| **Evolution** | | | |
| GET | `/api/evolution/status` | Estado instancia Evolution | Session |
| POST | `/api/evolution/connect` | Conectar instancia Evolution | Session |
| POST | `/api/evolution/disconnect` | Desconectar instancia Evolution | Session |
| **Auth** | | | |
| POST | `/api/auth/log-session` | Log de inicio de sesión | Session |
| **Jobs (Cron)** | | | |
| POST | `/api/jobs/reminder-24h` | Recordatorio 24h | JOB_SECRET |
| POST | `/api/jobs/reminder-1h` | Recordatorio 1h | JOB_SECRET |
| POST | `/api/jobs/post-appointment-nps` | Encuesta NPS post-turno | JOB_SECRET |
| POST | `/api/jobs/churn-recovery` | Campaña recuperación churn | JOB_SECRET |
| POST | `/api/jobs/automation-log` | Log de ejecución de workflow | JOB_SECRET |
| **Settings** | | | |
| GET/PATCH | `/api/settings/clinic` | Configurar clínica actual | Session |
| GET/PATCH | `/api/settings/organization` | Configurar organización | Session |
| GET/POST/PATCH/DELETE | `/api/settings/professionals` | CRUD profesionales + crear usuario | Session |
| GET/POST/PATCH/DELETE | `/api/settings/specialties` | CRUD especialidades | Session |
| GET/POST/PATCH/DELETE | `/api/settings/availability` | CRUD disponibilidad | Session |
| GET/POST/PATCH/DELETE | `/api/settings/service-areas` | CRUD áreas de servicio | Session |
| GET/PATCH | `/api/settings/ai-config` | Configuración AI del bot | Session |
| **Appointments** | | | |
| GET/POST/PATCH/DELETE | `/api/appointments` | CRUD turnos | Session |
| GET | `/api/appointments?slots` | Obtener slots disponibles | Session |
| **Patients** | | | |
| GET/POST/PATCH | `/api/patients` | CRUD pacientes | Session |
| GET | `/api/patients/[id]/history` | Historia clínica del paciente | Session |
| **Invoices** | | | |
| GET/POST | `/api/invoices` | CRUD facturas | Session |
| **Analytics** | | | |
| GET | `/api/analytics` | KPIs y métricas del dashboard | Session |
| **Support** | | | |
| GET/POST | `/api/support/tickets` | CRUD tickets de soporte | Session |
| **Superadmin** | | | |
| GET/POST | `/api/superadmin/organizations` | CRUD organizaciones | Service Role |
| GET/POST/PATCH | `/api/superadmin/users` | CRUD usuarios global | Service Role |
| GET/PATCH | `/api/superadmin/subscriptions` | Suscripciones | Service Role |
| GET/POST | `/api/superadmin/billing` | Facturación global | Service Role |
| GET | `/api/superadmin/analytics` | Analytics global | Service Role |
| GET | `/api/superadmin/dashboard` | Dashboard superadmin | Service Role |
| GET/POST/PATCH/DELETE | `/api/superadmin/config` | Config global + feature flags + API keys | Service Role |
| GET/POST | `/api/superadmin/security` | Seguridad y sesiones | Service Role |
| GET | `/api/superadmin/logs` | Logs de actividad | Service Role |
| GET/POST/PATCH | `/api/superadmin/support` | Tickets de soporte global | Service Role |

**Nota:** Muchas API routes crean cliente Supabase inline (con `process.env.NEXT_PUBLIC_SUPABASE_URL!` y `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!`) en lugar de usar las abstracciones compartidas de `src/lib/supabase/`. Esto es código duplicado frágil.

---

## 6. Servicios externos integrados

| Servicio | Propósito | Configuración | Cómo se conecta |
|----------|-----------|---------------|-----------------|
| **Supabase** | DB + Auth + Storage | `.env.local`: URL + anon key + service role key | `@supabase/supabase-js` + `@supabase/ssr` |
| **Evolution API** | WhatsApp Gateway | `.env.local`: URL + API Key + Instance | HTTP requests con header `apikey` |
| **OpenAI** | AI Bot (modelo gpt-4o) | `organizations.settings.ai.apiKey` | `POST https://api.openai.com/` con Bearer token |
| **Anthropic** | AI Bot (modelo claude-sonnet-4) | `organizations.settings.ai.apiKey` | `POST https://api.anthropic.com/` con `x-api-key` |
| **DeepSeek** | AI Bot (modelo deepseek-chat) | `organizations.settings.ai.apiKey` | `POST https://api.deepseek.com/` con Bearer token |
| **Groq** | AI Bot (modelo llama-3.3-70b) | `organizations.settings.ai.apiKey` | `POST https://api.groq.com/` con Bearer token |
| **Google Gemini** | AI Bot (modelo gemini-2.0-flash) | `organizations.settings.ai.apiKey` | `POST https://generativelanguage.googleapis.com/` con query param |
| **SMTP (Gmail)** | Notificaciones por email | `.env.example`: SMTP_HOST/PORT/USER/PASS | n8n SMTP node (workflows 07, 11, 15) |
| **Google Calendar** | Sincronización de turnos | `GOOGLE_CALENDAR_ID` | n8n Google Calendar OAuth2 node (workflow 10) |
| **Slack** | Notificaciones opcionales | `SLACK_WEBHOOK_URL` | n8n HTTP Request (workflow 11, `neverError: true`) |

---

## 7. Autenticación y seguridad

### 7.1 Sistema de Auth

```
Supabase Auth (built-in, email/password)
  ├── Client:  createBrowserClient()  →  anon key (RLS-restricted)
  ├── Server:  createServerClient()   →  anon key + cookies (RLS)
  ├── Admin:   createClient + service_role_key  →  bypass RLS
  └── Service: createClient + service_role_key  →  bypass RLS
```

### 7.2 Manejo de sesiones

- **Client-side:** `AuthProvider` (React Context) detecta sesión via `supabase.auth.getSession()` y `onAuthStateChange`
- **Server-side:** `updateSession()` en `middleware.ts` — pero **NUNCA SE EJECUTA** porque no hay `src/middleware.ts`
- **Logout:** Invalida sesión en Supabase + limpia localStorage + redirect a /login

### 7.3 Middleware de protección de rutas

**NO EXISTE.** El archivo `src/lib/supabase/middleware.ts` define la función `updateSession()` pero no está siendo llamado desde `src/middleware.ts`. Next.js solo ejecuta middleware desde la raíz con el nombre exacto `middleware.ts`.

**Impacto:**
- Usuarios no autenticados pueden acceder a páginas del dashboard (el HTML se renderiza, el AuthGuard client-side puede tardar en redirect)
- Las API routes no tienen verificación de sesión consistente
- La protección real depende de RLS en Supabase, no del middleware

### 7.4 Seguridad — Hallazgos críticos

#### ⚠️ CRÍTICO: Credenciales Supabase en .env.local commiteadas

El archivo `.env.local` contiene **credenciales Supabase reales y funcionales** (URL, anon key, y **service role key**) y está commiteado al repositorio. El `.gitignore` tiene `env*` pero parece que se forzó el commit.

**Riesgo:** Cualquier persona con acceso al repo tiene control total sobre la base de datos Supabase (lectura, escritura, auth, todo).

#### ⚠️ CRÍTICO: Service Role Key hardcodeada en script

`scripts/setup-storage-policies.mjs` contiene la URL de Supabase y el service role JWT completos como strings literales en el código fuente.

#### ⚠️ ALTO: Contraseña hardcodeada en script

`scripts/fix-superadmin.mts` contiene la contraseña `Admin123!` como string literal.

#### ⚠️ ALTO: API keys almacenadas en JSONB sin encriptar

Las API keys de AI (OpenAI, Anthropic, etc.) se guardan en `organizations.settings.ai.apiKey` como texto plano en JSONB. No hay encriptación en reposo.

#### ⚠️ MEDIO: RLS faltante en tablas críticas

- `wa_conversations`: cualquier usuario autenticado podría leer todas las conversaciones del bot
- `wa_messages`: igual
- `weekly_schedules`: RLS habilitado pero sin policies → nadie puede leer
- `service_areas`: RLS habilitado pero sin policies → nadie puede leer

#### ⚠️ MEDIO: Tokens de Supabase expuestos al cliente

`SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` están hardcodeados en varios archivos como valores por defecto (`src/lib/supabase/client.ts:4-5`).

---

## 8. Variables de entorno

### 8.1 Obligatorias (producción)

| Variable | Dónde se usa | Propósito |
|----------|-------------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Todo el front + back | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Todo el front + back | Anon key (RLS-restricted) |
| `SUPABASE_SERVICE_ROLE_KEY` | server-admin.ts, service.ts | Service role key (bypass RLS) |
| `EVOLUTION_API_URL` | evolution-client.ts, n8n | URL de Evolution API |
| `EVOLUTION_API_KEY` | evolution-client.ts, n8n | API Key de Evolution |
| `EVOLUTION_INSTANCE` | n8n workflows | Nombre de instancia Evolution |
| `N8N_WEBHOOK_BASE_URL` | n8n workflow 12 | URL base de webhooks de n8n |
| `JOB_SECRET` | jobs/_helpers.ts | Token para jobs programados |

### 8.2 Opcionales

| Variable | Default | Propósito |
|----------|---------|-----------|
| `NEXT_PUBLIC_APP_URL` | http://localhost:3000 | URL pública de la app |
| `NEXT_PUBLIC_APP_NAME` | OdontoCare | Nombre de la app |
| `WEBHOOK_SECRET` | (ninguno) | Valida autenticidad de webhooks |
| `GOOGLE_CALENDAR_ID` | primary | ID de calendario Google |
| `GOOGLE_CLIENT_ID` | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth client secret |
| `SMTP_HOST` | smtp.gmail.com | Servidor SMTP |
| `SMTP_PORT` | 587 | Puerto SMTP |
| `SMTP_USER` | — | Usuario SMTP |
| `SMTP_PASS` | — | Password SMTP |
| `ALERT_FROM_EMAIL` | — | Email remitente alertas |
| `CLINIC_MANAGER_EMAIL` | — | Email gerente clínica |
| `CLINIC_STAFF_EMAIL` | — | Email recepción |
| `SLACK_WEBHOOK_URL` | — | Webhook Slack (notificaciones) |
| `NEXTAUTH_SECRET` | — | NextAuth secret (sin usar? ⚠️) |
| `NEXTAUTH_URL` | — | NextAuth URL (sin usar? ⚠️) |

**Nota:** `.env.example` y `.env.local.example` tienen estructuras diferentes. `.env.example` tiene campos que `.env.local.example` no tiene (SMTP, Slack, Google Calendar ID) y viceversa (GOOGLE_CLIENT_ID/SECRET, N8N_BASE_URL). **No hay un source of truth único.**

**Nota 2:** `NEXTAUTH_SECRET` y `NEXTAUTH_URL` están en `.env.example` pero la app usa **Supabase Auth**, no NextAuth.js. Estas variables sobran.

---

## 9. Problemas detectados

### 🔴 CRÍTICOS

| # | Problema | Archivo | Impacto |
|---|----------|---------|---------|
| C1 | **Credenciales Supabase en git** | `.env.local` | Cualquiera con acceso al repo puede leer/modificar TODA la base de datos |
| C2 | **Service Role JWT hardcodeado** | `scripts/setup-storage-policies.mjs` | Idem, expuesto en código fuente |
| C3 | **No hay middleware.ts** | `src/` (falta archivo) | Sin protección server-side de rutas. Solo AuthGuard client-side |

### 🟠 ALTOS

| # | Problema | Archivo | Impacto |
|---|----------|---------|---------|
| A1 | **Contraseña hardcodeada** | `scripts/fix-superadmin.mts` | `Admin123!` en texto plano |
| A2 | **API keys de AI en JSONB plano** | `organizations.settings.ai` | Sin encriptación en reposo |
| A3 | **RLS faltante en wa_conversations** | Migration 004 | Cualquier usuario auth lee TODAS las conversaciones del bot |
| A4 | **RLS faltante en wa_messages** | Migration 004 | Idem para mensajes |
| A5 | **weekly_schedules con RLS pero sin policies** | Migration 005 | Tabla invisible para usuarios normales |
| A6 | **service_areas con RLS pero sin policies** | Migration 008 | Idem |
| A7 | **NEXTAUTH_SECRET y NEXTAUTH_URL sin uso** | `.env.example` | Variables muertas que confunden |
| A8 | **Workflow 05 no checkea reminder_sent** | `n8n-workflows/05-reminder-1h.json` | Paciente recibe múltiples recordatorios |
| A9 | **Workflow 05 y 13 no validan teléfono** | `n8n-workflows/05,13` | Envían WhatsApp a números vacíos |

### 🟡 MEDIOS

| # | Problema | Archivo | Impacto |
|---|----------|---------|---------|
| M1 | **Dos migrations con número 016** | `infrastructure/supabase/migrations/` | Conflicto de naming, orden indeterminado |
| M2 | **Seed de specialties inefectivo** | `016_specialties_catalog.sql` | 001 ya creó la tabla, 016b es NO-OP |
| M3 | **Endocrinología seed con artifact_type=null** | `016_specialties_catalog.sql:56` | Debería ser 'endocrinologia' |
| M4 | **Org UUID inconsistente** | `scripts/check-db.mjs` vs `check-db.ts` | Dos UUIDs diferentes para "Clinica Ursula" |
| M5 | **Código duplicado de cliente Supabase** | Múltiples API routes | Cada endpoint crea su propio cliente manualmente |
| M6 | **Onboarding incompleto** | `register/page.tsx` | Usuario se registra pero no tiene org/clinic |
| M7 | **Scripts sin dry-run mode** | `scripts/clean-dupes, cleanup, fix-clinic, fix-superadmin, wipe-schedules` | Operaciones destructivas sin confirmación |
| M8 | **Chart.js desde CDN** | `public/artifacts/*.html` | Dependencia externa sin SRI (Subresource Integrity) |
| M9 | **README sin personalizar** | `README.md` | Es el boilerplate de Next.js |
| M10 | **next.config.ts vacío** | `next.config.ts` | Sin configuraciones de seguridad, imágenes, etc. |
| M11 | **ventas/ vacío** | `ventas/` | Carpeta sin contenido |
| M12 | **infrastructure/n8n/workflows/ vacío** | `infrastructure/n8n/workflows/` | Los workflows están en `n8n-workflows/` no en `infrastructure/` |
| M13 | **.env.example inconsistente** | `.env.example` vs `.env.local.example` | Dos versiones diferentes de vars |

### 🟢 BAJOS

| # | Problema | Archivo | Impacto |
|---|----------|---------|---------|
| L1 | `console.log` en producción | Varios archivos src/ | 49 ocurrencias en 5 archivos |
| L2 | `dangerouslySetInnerHTML` | `src/app/layout.tsx` | Para cargar service worker (justificado pero warning) |
| L3 | Tests E2E sin implementar | `src/__tests__/e2e/` | Carpeta vacía |
| L4 | Coverage thresholds no alcanzables | `vitest.config.ts` | Excluye太多 código del coverage |
| L5 | `check-pepe.mts` sin await | `scripts/check-pepe.mts:25` | `main()` sin `await` ni `.catch()` |
| L6 | `next-env.d.ts` en gitignore | `.gitignore` | No debería estar (es necesario para el build) |
| L7 | Faltan artefactos para cardio/neuro/fono | `public/artifacts/` | 3 especialidades sin artifact |

---

## 10. Estado general de la app

### ✅ Listo para producción

- **Sistema multi-tenant**: organizations → clinics → professionals → patients con RLS
- **Autenticación**: Supabase Auth con sesión persistente
- **Gestión de turnos**: CRUD completo con validación de disponibilidad
- **CRUD de pacientes y profesionales**: Completo
- **Panel superadmin**: Dashboard, organizaciones, usuarios, suscripciones, billing
- **Base de datos**: 18 migrations, schema completo con relaciones, índices, RLS
- **WhatsApp Bot (core)**: State machine con 12 estados, multi-provider AI
- **n8n workflows**: 15 workflows que cubren todo el ciclo del paciente
- **Infraestructura Docker**: PostgreSQL, Redis, n8n, Evolution API
- **Service Worker**: Estrategia network-first con fallback offline
- **PWA**: Manifest con soporte standalone
- **Artefactos clínicos**: 10 HTMLs interactivos con getState/loadState

### 🔶 A medias / Mejorable

- **Middleware de autenticación**: Existe la función pero no el archivo middleware.ts
- **Test coverage**: Solo 4 archivos de test unitarios, E2E vacío
- **Integración AFIP**: Schema completo pero probablemente sin usar (feature flag `electronic_invoice=false`)
- **Onboarding**: Usuario se registra pero queda huérfano sin org
- **Patient Portal**: Feature flag deshabilitado
- **Analytics v2**: Feature flag deshabilitado
- **Especialidades**: Sistema con conflictos entre migrations 001 y 016b
- **Endocrinología**: Seed incorrecto (artifact_type=null)
- **Documentación técnica**: README sin personalizar, sin docs de API

### ❌ Falta / No implementado

- **Tests E2E**: Carpeta vacía
- **Portal del paciente**: Feature flagged off
- **Facturación electrónica AFIP**: Schema listo pero flag off
- **Middlewares de seguridad CSRF**: No implementado
- **Rate limiting real**: `src/lib/utils/rate-limit.ts` existe pero no está integrado
- **Logging estructurado**: Solo console.log
- **Manejo de errores global**: No hay error boundary global
- **Módulo de ventas**: Carpeta vacía
- **Integración continua**: `.github/` vacío (sin CI/CD pipelines)
- **Traducciones**: Todo en español duro (sin i18n)

### Resumen

| Aspecto | Estado |
|---------|--------|
| **Seguridad** | ⚠️ **Problemas críticos** (credenciales en git, sin middleware, RLS faltante) |
| **Backend (API)** | ✅ **Funcional** pero con código duplicado |
| **Frontend** | ✅ **Completo** con diseño consistente |
| **Base de datos** | ✅ **Bien diseñada** multi-tenant con RLS |
| **Automatización (n8n)** | ✅ **Muy completo** (15 workflows) |
| **WhatsApp Bot** | ✅ **Funcional** con AI multi-provider |
| **Tests** | ❌ **Mínimos** (4 unit, 0 E2E) |
| **DevOps** | 🟡 **Parcial** (Docker listo, CI/CD no) |
| **Documentación** | ❌ **Mínima** (README genérico) |
| **PWA** | ✅ **Configurado** (SW + manifest) |

---

*Auditoría generada el 2026-06-11 — 6 agentes de exploración paralelos + análisis de 70+ archivos fuente.*
