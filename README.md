# Mulata — Gestión de la cuenta de resultados

PWA mobile-first para que **Mere** gestione a diario la cuenta de resultados de la marca de moda **Mulata** (Panamá). Registra ventas y gastos de las distintas unidades de negocio, controla los gastos generales y visualiza la analítica del negocio.

![icono](client/public/icon-192.png)

## ✨ Qué hace

- **3 unidades de negocio diferenciadas**: Tienda Megapolis, Tienda Casco Antiguo y Distribución (boutiques cliente).
- **Gastos Generales/Comunes** aparte: compras a proveedores, contadora, tasas de la sociedad, etc.
- **Dashboard General** consolidado: suma las 3 unidades y resta los gastos generales.
- **Entrada de datos rápida** desde el móvil: facturación diaria por tienda, facturación de distribución por cliente, gastos fijos y extraordinarios, y conceptos de gasto personalizables.
- **Analítica con Recharts**: evolución de ventas, beneficio por unidad, margen %, comparativa entre unidades y desglose de gastos por categoría. KPIs con variación vs. periodo anterior.
- **Copias de seguridad**: exportar a JSON y CSV, e importar desde JSON. Script de backup automático.
- **App instalable (PWA)** con funcionamiento offline básico.
- **Login protegido** con usuario/contraseña y sesión JWT.
- Moneda en **USD** (`$1,234.56`) e interfaz en **español**.

## 🧱 Stack

- **Frontend**: React + Vite + TailwindCSS + Recharts, PWA con `vite-plugin-pwa`.
- **Backend**: Node.js + Express (API REST).
- **Base de datos**: PostgreSQL (paquete `pg`). Las tablas se crean solas al arrancar (migraciones idempotentes).
- **Monorepo**: `/client` (React) y `/server` (Express). En producción Express sirve el build de React: un único Web Service.

## 📁 Estructura

```
mulata-app/
├── server/        # API Express + PostgreSQL
│   ├── index.js   # arranque + sirve el build de React en producción
│   ├── db.js      # pool de pg (SSL en producción)
│   ├── migrate.js # CREATE TABLE IF NOT EXISTS + seed
│   ├── auth.js    # login + JWT
│   ├── backup.js  # backup automático a /backups
│   └── routes/    # sales, expenses, categories, clients, analytics, data
└── client/        # React + Vite + Tailwind
    └── src/
        ├── pages/        # Dashboard, StorePage, Distribution, GeneralExpenses, Analytics, Settings
        ├── components/   # Layout, KpiCard, EntryForm, RecordList, charts/...
        ├── auth/         # contexto de sesión + login
        └── lib/          # formato de moneda/fecha y rangos
```

## 🗄️ Modelo de datos

| Tabla | Para qué |
|---|---|
| `business_units` | Las 3 unidades fijas (megapolis, casco, distribucion). |
| `distribution_clients` | Boutiques cliente de distribución. |
| `expense_categories` | Conceptos de gasto (predefinidos + personalizados), por tienda o generales. |
| `sales` | Facturación (tiendas y distribución). |
| `expenses` | Gastos por tienda y gastos generales (unidad NULL). |
| `users` | Credenciales (sembrado desde variables de entorno). |

El beneficio global = ventas de las 3 unidades − gastos de las unidades − **gastos generales**.

## 🚀 Correr en local

Requisitos: **Node 18+** y **PostgreSQL** (local o en la nube).

1. Crea la base de datos local (si usas Postgres local):
   ```bash
   createdb mulata
   ```

2. Copia las variables de entorno y edítalas:
   ```bash
   cp .env.example .env
   # edita .env: DATABASE_URL, JWT_SECRET, AUTH_USERNAME, AUTH_PASSWORD
   ```

3. Instala dependencias (raíz + cliente):
   ```bash
   npm install
   npm run install:client
   ```

4. Arranca en modo desarrollo (API + cliente con recarga en caliente):
   ```bash
   npm run dev
   ```
   - Cliente: http://localhost:5173 (proxy de `/api` al backend)
   - API: http://localhost:3000

5. Entra con el `AUTH_USERNAME` / `AUTH_PASSWORD` que pusiste en `.env`.

### Probar como en producción (un solo servidor)

```bash
npm run build      # compila el cliente a client/dist
npm start          # Express sirve la API + el build de React en :3000
```
Abre http://localhost:3000.

### Otros comandos

```bash
npm run migrate    # crea/actualiza las tablas manualmente
npm run backup     # genera un backup JSON en ./backups
```

## 💾 Copias de seguridad

- Desde la app: **Ajustes → Exportar JSON / CSV** y **Importar desde JSON**.
- Por API (con token JWT):
  - `GET /api/data/export/json`
  - `GET /api/data/export/csv`
  - `POST /api/data/import` con `{ "data": { ... }, "mode": "replace" }`
- Script: `npm run backup` (escribe en `./backups`). Programable con cron (ver `DEPLOY.md`).

## ☁️ Despliegue

Ver **[DEPLOY.md](DEPLOY.md)** para el paso a paso exacto en Render.com (Web Service + PostgreSQL gestionado).

---

Hecho con cariño para Mulata 🌸
