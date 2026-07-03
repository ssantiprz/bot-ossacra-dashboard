# Tablero de Control - Delegación Virtual

Dashboard web ejecutivo para visualizar indicadores de atención y gestión operativa de la Delegación Virtual, con datos generados desde Kommo CRM / WhatsApp y almacenados en Supabase.

El proyecto es una aplicación estática, simple y publicable en GitHub Pages. No usa frameworks ni backend propio.

## Stack

- HTML
- CSS
- JavaScript vanilla
- Supabase JS v2 desde CDN
- Chart.js desde CDN

## Configuración

Editá `app.js` y reemplazá las constantes iniciales:

```js
const SUPABASE_URL = "PEGAR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "PEGAR_SUPABASE_ANON_KEY";
```

Usá únicamente la **anon public key** de Supabase. No pegues claves privadas, `service_role` keys ni tokens de Kommo en este repositorio.

## Logo institucional

El tablero busca el logo en:

```text
assets/logo.png
```

Para personalizarlo, agregá o reemplazá ese archivo. Se recomienda usar un PNG horizontal o cuadrado, preferentemente con fondo transparente; el CSS limita el tamaño para que el logo no supere el espacio disponible. Si `assets/logo.png` no existe, la interfaz muestra un fallback visual con las letras `DV` y el diseño no se rompe.

## Secciones incluidas

- Resumen ejecutivo con KPIs principales.
- Gráficos de interacciones diarias y mensajes fuera de horario.
- Tareas por usuario, con detalle desplegable por tipo de gestión y tipo de tarea.
- Tareas por tipo de gestión.
- Resumen por provincia/delegación.
- Resumen por plan.

## Consultas a Supabase

Todas las consultas se hacen mediante `supabase.rpc()` contra funciones RPC ya existentes:

- `get_dashboard_kpis(p_fecha_desde, p_fecha_hasta)`
- `get_dashboard_resumen_diario(p_fecha_desde, p_fecha_hasta)`
- `get_dashboard_resumen_provincia(p_fecha_desde, p_fecha_hasta)`
- `get_dashboard_resumen_plan(p_fecha_desde, p_fecha_hasta)`
- `get_dashboard_tareas_por_usuario(p_fecha_desde, p_fecha_hasta)`
- `get_dashboard_tareas_usuario_detalle(p_fecha_desde, p_fecha_hasta, p_responsible_user_id)`
- `get_dashboard_tareas_por_tipo(p_fecha_desde, p_fecha_hasta)`

El dashboard no consulta tablas crudas directamente y no modifica la base de datos.

## Probar localmente

Como es una aplicación estática, podés abrir `index.html` directamente en el navegador.

También podés servir la carpeta con un servidor local simple:

```bash
python3 -m http.server 8000
```

Luego abrí:

```text
http://localhost:8000
```

## Publicar en GitHub Pages

1. Subí los archivos `index.html`, `styles.css`, `app.js`, `README.md` y la carpeta `assets/` al repositorio.
2. En GitHub, entrá a **Settings** → **Pages**.
3. En **Build and deployment**, seleccioná **Deploy from a branch**.
4. Elegí la rama principal y la carpeta raíz (`/`).
5. Guardá la configuración y esperá a que GitHub publique el sitio.

## Seguridad

- No subir claves privadas.
- No subir `service_role` keys de Supabase.
- No subir tokens de Kommo.
- La clave esperada para el frontend es solo la anon public key de Supabase.
- Las políticas/RPC de Supabase deben controlar qué datos puede leer el frontend.
