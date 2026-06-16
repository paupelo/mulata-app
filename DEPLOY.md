# 🚀 Despliegue en Render.com — paso a paso

Esta guía despliega Mulata como **un único Web Service** (Express sirviendo el build de React) conectado a una **base de datos PostgreSQL gestionada de Render**. Sigue los pasos en orden.

> **Importante (estructura del repo):** estos pasos asumen que la carpeta `mulata-app/` es la **raíz del repositorio** de GitHub. Si la subes dentro de otro repo, tendrás que indicar el *Root Directory* `mulata-app` al crear el servicio en Render (paso 3).

---

## 1) Crear el repositorio en GitHub y subir el código

1. Crea un repo vacío en GitHub (por ejemplo `mulata-app`), **sin** README ni .gitignore.
2. En tu terminal, desde la carpeta `mulata-app/`:
   ```bash
   cd mulata-app
   git init
   git add .
   git commit -m "Mulata: app de gestión lista para producción"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/mulata-app.git
   git push -u origin main
   ```
3. Verifica en GitHub que **NO** se ha subido el archivo `.env` (está en `.gitignore`). Solo debe verse `.env.example`.

---

## 2) Crear la base de datos PostgreSQL en Render

1. Entra en https://dashboard.render.com → **New +** → **PostgreSQL**.
2. Configura:
   - **Name**: `mulata-db`
   - **Database**: `mulata`
   - **User**: `mulata`
   - **Region**: elige la más cercana (ej. *Oregon*). **Anota la región**: el Web Service debe ir en la misma.
   - **Plan**: *Free* (o de pago para producción seria — ver aviso al final).
3. Pulsa **Create Database** y espera a que el estado sea *Available*.
4. En la página de la base de datos, copia la **Internal Database URL** (empieza por `postgresql://…`). La usarás en el paso 4.

---

## 3) Crear el Web Service conectado al repo

1. **New +** → **Web Service** → conecta tu cuenta de GitHub y elige el repo `mulata-app`.
2. Configura:
   - **Name**: `mulata-app`
   - **Region**: **la misma** que la base de datos.
   - **Branch**: `main`
   - **Root Directory**: déjalo vacío si el repo es la app; pon `mulata-app` si la app está en una subcarpeta.
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: *Free* (o de pago).
3. **Advanced → Health Check Path**: `/api/health`.
4. No pulses *Create* todavía: primero añade las variables de entorno (paso 4).

> **Alternativa con Blueprint:** el repo incluye `render.yaml`. Puedes usar **New + → Blueprint** y Render creará la base de datos y el servicio automáticamente; solo tendrás que rellenar `AUTH_USERNAME` y `AUTH_PASSWORD`.

---

## 4) Configurar TODAS las variables de entorno

En el Web Service → pestaña **Environment** → **Add Environment Variable**, añade:

| Key | Value | Notas |
|---|---|---|
| `DATABASE_URL` | *(la Internal Database URL del paso 2.4)* | Pégala tal cual. Alternativamente, en Render puedes enlazarla con "Add from Database". |
| `JWT_SECRET` | *(una cadena larga y aleatoria)* | Genérala con: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `AUTH_USERNAME` | `mere` | El usuario con el que entrará Mere. |
| `AUTH_PASSWORD` | *(una contraseña segura)* | La contraseña de acceso. |
| `NODE_ENV` | `production` | Activa SSL en la conexión a PostgreSQL. |

> No hace falta definir `PORT`: Render lo inyecta automáticamente y el servidor lo respeta.

Pulsa **Create Web Service**. Render hará el primer build y deploy. En el primer arranque, el servidor ejecuta las migraciones (`CREATE TABLE IF NOT EXISTS`) y siembra las 3 unidades de negocio, los conceptos por defecto y el usuario de login.

Cuando el deploy termine, abre la URL pública (`https://mulata-app.onrender.com`) y entra con `AUTH_USERNAME` / `AUTH_PASSWORD`.

---

## 5) Verificar persistencia y avisos del plan gratuito

### Comprobar que los datos persisten
1. Inicia sesión y crea un par de registros (una venta y un gasto).
2. En Render, fuerza un redeploy (**Manual Deploy → Deploy latest commit**) o espera a un reinicio.
3. Vuelve a entrar: **los datos deben seguir ahí**. Persisten porque viven en la base de datos PostgreSQL, no en el contenedor del Web Service (que es efímero).
4. Extra: ve a **Ajustes → Exportar JSON** y guarda una copia de seguridad.

### ⚠️ Avisos importantes del plan gratuito de Render
- **La base de datos free de Render caduca.** Render elimina las bases PostgreSQL del plan gratuito al cabo de un tiempo (aproximadamente **30–90 días**) y te avisa por email antes. **Si caduca, pierdes los datos.** Para un negocio real:
  - **Recomendado:** sube la base de datos a un **plan de pago** (es barato y evita sustos), **o**
  - Haz **backups periódicos** (Ajustes → Exportar JSON) y guárdalos fuera de Render.
- **El Web Service free se "duerme"** tras 15 minutos de inactividad: la primera visita tras el parón puede tardar ~30–60 s en responder. No afecta a los datos.
- Tras recrear una base de datos nueva, podrás **restaurar** desde tu último backup con **Ajustes → Importar desde JSON**.

---

## 6) (Opcional) Backup automático programado

Para automatizar copias de seguridad puedes crear un **Cron Job** en Render:

1. **New +** → **Cron Job**, mismo repo.
2. **Build Command**: `npm install`
3. **Command**: `npm run backup`
4. **Schedule**: por ejemplo `0 5 * * *` (cada día a las 05:00 UTC).
5. Variables de entorno: añade `DATABASE_URL` (la misma que el servicio) y `NODE_ENV=production`.

> Nota: el script `npm run backup` escribe el JSON en el sistema de archivos del job, que es efímero. Para conservar los backups fuera de Render, lo más sencillo y fiable sigue siendo **Ajustes → Exportar JSON** de forma periódica, o ampliar el script para subir el archivo a un almacenamiento externo (S3, Google Drive, etc.). La copia manual desde Ajustes es suficiente para el uso diario de Mere.

---

## Resumen de comandos de Render

| Campo | Valor |
|---|---|
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Health Check | `/api/health` |
| Variables | `DATABASE_URL`, `JWT_SECRET`, `AUTH_USERNAME`, `AUTH_PASSWORD`, `NODE_ENV=production` |

¡Listo! La app queda accesible solo con login, con los datos a salvo en PostgreSQL. 🌸
