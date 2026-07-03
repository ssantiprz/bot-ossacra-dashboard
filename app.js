const SUPABASE_URL = "PEGAR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "PEGAR_SUPABASE_ANON_KEY";
// Usar siempre la anon public key de Supabase. Nunca pegar la service_role key ni claves privadas en este archivo.

const clienteSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const formatoNumero = new Intl.NumberFormat("es-AR");
const formatoFecha = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit" });

const elementos = {
  formFiltros: document.querySelector("#formFiltros"),
  fechaDesde: document.querySelector("#fechaDesde"),
  fechaHasta: document.querySelector("#fechaHasta"),
  mensajeEstado: document.querySelector("#mensajeEstado"),
  estadoConexion: document.querySelector("#estadoConexion"),
  rangoSeleccionado: document.querySelector("#rangoSeleccionado"),
  logoInstitucional: document.querySelector("#logoInstitucional"),
  botonesRapidos: document.querySelectorAll("[data-rango]"),
  tablaProvincia: document.querySelector("#tablaProvincia"),
  tablaPlan: document.querySelector("#tablaPlan"),
  tablaTareasUsuario: document.querySelector("#tablaTareasUsuario"),
  tablaTareasTipo: document.querySelector("#tablaTareasTipo"),
};

const kpis = {
  total_mensajes_entrantes: document.querySelector("#kpiMensajesEntrantes"),
  total_interacciones_diarias: document.querySelector("#kpiInteraccionesDiarias"),
  total_contactos_unicos: document.querySelector("#kpiContactosUnicos"),
  total_recontactos: document.querySelector("#kpiRecontactos"),
  porcentaje_recontacto: document.querySelector("#kpiPorcentajeRecontacto"),
  total_mensajes_fuera_horario: document.querySelector("#kpiFueraHorario"),
  porcentaje_fuera_de_horario: document.querySelector("#kpiPorcentajeFueraHorario"),
  total_tareas_generadas: document.querySelector("#kpiTareasGeneradas"),
  total_tareas_completadas: document.querySelector("#kpiTareasCompletadas"),
  porcentaje_tareas_completadas: document.querySelector("#kpiPorcentajeTareasCompletadas"),
};

let graficoDiario;
let graficoFueraHorario;
const detallesUsuariosAbiertos = new Map();

function aISOFecha(fecha) {
  return fecha.toISOString().slice(0, 10);
}

function sumarDias(fecha, dias) {
  const nuevaFecha = new Date(fecha);
  nuevaFecha.setDate(nuevaFecha.getDate() + dias);
  return nuevaFecha;
}

function valorNumerico(valor) {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) ? numero : 0;
}

function formatearNumero(valor) {
  return formatoNumero.format(valorNumerico(valor));
}

function formatearPorcentaje(valor) {
  return `${valorNumerico(valor).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function formatearFechaCorta(valor) {
  const fecha = new Date(`${valor}T00:00:00`);
  return Number.isNaN(fecha.getTime()) ? valor : formatoFecha.format(fecha);
}

function actualizarRangoSeleccionado() {
  elementos.rangoSeleccionado.textContent = `${formatearFechaCorta(elementos.fechaDesde.value)} - ${formatearFechaCorta(elementos.fechaHasta.value)}`;
}

function definirRangoPorDefecto() {
  const hoy = new Date();
  elementos.fechaHasta.value = aISOFecha(hoy);
  elementos.fechaDesde.value = aISOFecha(sumarDias(hoy, -29));
}

function obtenerRangoRapido(tipo) {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth();

  const rangos = {
    hoy: [hoy, hoy],
    ultimos7: [sumarDias(hoy, -6), hoy],
    mesActual: [new Date(anio, mes, 1), hoy],
    mesAnterior: [new Date(anio, mes - 1, 1), new Date(anio, mes, 0)],
    anioActual: [new Date(anio, 0, 1), hoy],
  };

  return rangos[tipo] || rangos.ultimos7;
}

function mostrarMensaje(texto, tipo = "info") {
  elementos.mensajeEstado.textContent = texto;
  elementos.mensajeEstado.className = `mensaje mensaje--${tipo}`;
}

function ocultarMensaje() {
  elementos.mensajeEstado.className = "mensaje mensaje--oculto";
  elementos.mensajeEstado.textContent = "";
}

function definirCargando(cargando) {
  document.querySelectorAll("button").forEach((boton) => { boton.disabled = cargando; });
  if (cargando) {
    elementos.estadoConexion.textContent = "Consultando Supabase";
    mostrarMensaje("Cargando datos...", "info");
  }
}

async function llamarRpc(nombre, parametros) {
  const { data, error } = await clienteSupabase.rpc(nombre, parametros);
  if (error) throw new Error(`${nombre}: ${error.message}`);
  return Array.isArray(data) ? data : data ? [data] : [];
}

async function cargarDashboard() {
  const parametros = {
    p_fecha_desde: elementos.fechaDesde.value,
    p_fecha_hasta: elementos.fechaHasta.value,
  };

  definirCargando(true);

  try {
    actualizarRangoSeleccionado();
    detallesUsuariosAbiertos.clear();

    const resultados = await Promise.allSettled([
      llamarRpc("get_dashboard_kpis", parametros),
      llamarRpc("get_dashboard_resumen_diario", parametros),
      llamarRpc("get_dashboard_resumen_provincia", parametros),
      llamarRpc("get_dashboard_resumen_plan", parametros),
      llamarRpc("get_dashboard_tareas_por_usuario", parametros),
      llamarRpc("get_dashboard_tareas_por_tipo", parametros),
    ]);

    const [datosKpis, resumenDiario, resumenProvincia, resumenPlan, tareasUsuario, tareasTipo] = resultados.map((resultado) => (resultado.status === "fulfilled" ? resultado.value : []));
    const errores = resultados.filter((resultado) => resultado.status === "rejected").map((resultado) => resultado.reason.message);

    actualizarKpis(datosKpis[0] || {});
    actualizarGraficoDiario(resumenDiario);
    actualizarGraficoFueraHorario(resumenDiario);
    renderizarTablaProvincia(resumenProvincia);
    renderizarTablaPlan(resumenPlan);
    renderizarTablaTareasUsuario(tareasUsuario);
    renderizarTablaTareasTipo(tareasTipo);

    const sinDatos = !datosKpis.length && !resumenDiario.length && !resumenProvincia.length && !resumenPlan.length && !tareasUsuario.length && !tareasTipo.length;
    elementos.estadoConexion.textContent = errores.length ? "Datos parciales" : "Datos actualizados";
    if (errores.length) mostrarMensaje(`Algunas consultas fallaron: ${errores.join(" | ")}`, "error");
    else if (sinDatos) mostrarMensaje("Sin datos para el rango seleccionado", "vacio");
    else ocultarMensaje();
  } catch (error) {
    console.error(error);
    mostrarMensaje(`Error al consultar Supabase: ${error.message}`, "error");
    elementos.estadoConexion.textContent = "Error de consulta";
  } finally {
    definirCargando(false);
  }
}

function actualizarKpis(datos) {
  Object.entries(kpis).forEach(([clave, elemento]) => {
    const esPorcentaje = clave.startsWith("porcentaje");
    elemento.textContent = esPorcentaje ? formatearPorcentaje(datos[clave]) : formatearNumero(datos[clave]);
  });
}

function crearOActualizarGrafico(instancia, canvasId, configuracion) {
  if (instancia) instancia.destroy();
  return new Chart(document.querySelector(canvasId), configuracion);
}

function actualizarGraficoDiario(datos) {
  const etiquetas = datos.map((fila) => formatearFechaCorta(fila.fecha_mensaje));
  graficoDiario = crearOActualizarGrafico(graficoDiario, "#graficoDiario", {
    type: "line",
    data: {
      labels: etiquetas,
      datasets: [
        { label: "Mensajes entrantes", data: datos.map((fila) => valorNumerico(fila.mensajes_entrantes)), borderColor: "#1f4f3d", backgroundColor: "rgba(31,79,61,.12)", tension: .35, fill: true },
        { label: "Interacciones diarias", data: datos.map((fila) => valorNumerico(fila.interacciones_diarias)), borderColor: "#40a85f", backgroundColor: "rgba(64,168,95,.10)", tension: .35 },
        { label: "Recontactos", data: datos.map((fila) => valorNumerico(fila.recontactos)), borderColor: "#6f7f39", backgroundColor: "rgba(111,127,57,.10)", tension: .35 },
      ],
    },
    options: opcionesGrafico(),
  });
}

function actualizarGraficoFueraHorario(datos) {
  const etiquetas = datos.map((fila) => formatearFechaCorta(fila.fecha_mensaje));
  graficoFueraHorario = crearOActualizarGrafico(graficoFueraHorario, "#graficoFueraHorario", {
    data: {
      labels: etiquetas,
      datasets: [
        { type: "bar", label: "Mensajes fuera de horario", data: datos.map((fila) => valorNumerico(fila.mensajes_fuera_de_horario)), backgroundColor: "rgba(47,107,79,.72)", yAxisID: "y" },
        { type: "line", label: "% Fuera de horario", data: datos.map((fila) => valorNumerico(fila.porcentaje_fuera_de_horario)), borderColor: "#6f7f39", backgroundColor: "rgba(111,127,57,.12)", tension: .35, yAxisID: "y1" },
      ],
    },
    options: opcionesGrafico({ dobleEje: true }),
  });
}

function opcionesGrafico({ dobleEje = false } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "bottom" } },
    scales: {
      y: { beginAtZero: true, ticks: { precision: 0 } },
      ...(dobleEje ? { y1: { beginAtZero: true, position: "right", grid: { drawOnChartArea: false }, ticks: { callback: (valor) => `${valor}%` } } } : {}),
    },
  };
}

function crearFila(celdas) {
  const fila = document.createElement("tr");
  celdas.forEach((celda) => {
    const td = document.createElement("td");
    td.textContent = celda;
    fila.appendChild(td);
  });
  return fila;
}

function agregarFilaVacia(tbody, cantidadColumnas, mensaje = "Sin datos para el rango seleccionado") {
  const fila = document.createElement("tr");
  fila.className = "fila-vacia";
  const celda = document.createElement("td");
  celda.colSpan = cantidadColumnas;
  celda.textContent = mensaje;
  fila.appendChild(celda);
  tbody.appendChild(fila);
}

function renderizarTabla(tbody, datos, columnas, mensajeVacio = "Sin datos para el rango seleccionado") {
  tbody.innerHTML = "";
  if (!datos.length) {
    agregarFilaVacia(tbody, columnas.length, mensajeVacio);
    return;
  }
  datos.forEach((fila) => tbody.appendChild(crearFila(columnas.map((columna) => columna.formato(fila[columna.clave])))));
}

function renderizarTablaProvincia(datos) {
  renderizarTabla(elementos.tablaProvincia, datos, [
    { clave: "provincia", formato: (v) => v || "—" },
    { clave: "delegacion", formato: (v) => v || "—" },
    { clave: "interacciones_diarias", formato: formatearNumero },
    { clave: "mensajes_entrantes", formato: formatearNumero },
    { clave: "contactos_unicos", formato: formatearNumero },
    { clave: "recontactos", formato: formatearNumero },
    { clave: "porcentaje_recontacto", formato: formatearPorcentaje },
    { clave: "interacciones_fuera_de_horario", formato: formatearNumero },
    { clave: "porcentaje_fuera_de_horario", formato: formatearPorcentaje },
  ]);
}

function renderizarTablaPlan(datos) {
  renderizarTabla(elementos.tablaPlan, datos, [
    { clave: "plan", formato: (v) => v || "—" },
    { clave: "interacciones_diarias", formato: formatearNumero },
    { clave: "mensajes_entrantes", formato: formatearNumero },
    { clave: "contactos_unicos", formato: formatearNumero },
    { clave: "recontactos", formato: formatearNumero },
    { clave: "porcentaje_recontacto", formato: formatearPorcentaje },
    { clave: "interacciones_fuera_de_horario", formato: formatearNumero },
    { clave: "porcentaje_fuera_de_horario", formato: formatearPorcentaje },
  ]);
}


function renderizarTablaTareasTipo(datos) {
  renderizarTabla(elementos.tablaTareasTipo, datos, [
    { clave: "tipo_gestion", formato: (v) => v || "—" },
    { clave: "task_type_name", formato: (v) => v || "—" },
    { clave: "tareas_generadas", formato: formatearNumero },
    { clave: "tareas_completadas", formato: formatearNumero },
    { clave: "tareas_pendientes", formato: formatearNumero },
    { clave: "porcentaje_completadas", formato: formatearPorcentaje },
  ], "Sin tareas para el rango seleccionado");
}

function obtenerClaveUsuario(fila, indice) {
  return fila.responsible_user_id == null ? `sin-id-${indice}` : String(fila.responsible_user_id);
}

function renderizarTablaTareasUsuario(datos) {
  elementos.tablaTareasUsuario.innerHTML = "";
  if (!datos.length) {
    agregarFilaVacia(elementos.tablaTareasUsuario, 6, "Sin tareas para el rango seleccionado");
    return;
  }

  datos.forEach((fila, indice) => {
    const claveUsuario = obtenerClaveUsuario(fila, indice);
    const filaUsuario = document.createElement("tr");
    const usuario = fila.responsible_user_name || (fila.responsible_user_id == null ? "Sin responsable" : `Usuario ${fila.responsible_user_id}`);
    [
      usuario,
      formatearNumero(fila.tareas_generadas),
      formatearNumero(fila.tareas_completadas),
      formatearNumero(fila.tareas_pendientes),
      formatearPorcentaje(fila.porcentaje_completadas),
    ].forEach((valor) => {
      const td = document.createElement("td");
      td.textContent = valor;
      filaUsuario.appendChild(td);
    });

    const celdaDetalle = document.createElement("td");
    const botonDetalle = document.createElement("button");
    botonDetalle.type = "button";
    botonDetalle.className = "boton boton--detalle";
    const sinIdUsuario = fila.responsible_user_id == null;
    botonDetalle.textContent = sinIdUsuario ? "Sin ID" : detallesUsuariosAbiertos.has(claveUsuario) ? "Cerrar" : "Ver detalle";
    botonDetalle.disabled = sinIdUsuario;
    if (!sinIdUsuario) botonDetalle.addEventListener("click", () => alternarDetalleUsuario(fila, claveUsuario));
    celdaDetalle.appendChild(botonDetalle);
    filaUsuario.appendChild(celdaDetalle);
    elementos.tablaTareasUsuario.appendChild(filaUsuario);

    if (detallesUsuariosAbiertos.has(claveUsuario)) {
      elementos.tablaTareasUsuario.appendChild(crearFilaDetalle(detallesUsuariosAbiertos.get(claveUsuario), claveUsuario));
    }
  });
}

async function alternarDetalleUsuario(filaUsuario, claveUsuario) {
  if (detallesUsuariosAbiertos.has(claveUsuario)) {
    detallesUsuariosAbiertos.delete(claveUsuario);
    cargarDashboard();
    return;
  }

  if (filaUsuario.responsible_user_id == null) {
    mostrarMensaje("No se puede consultar el detalle porque el usuario no tiene responsible_user_id.", "error");
    return;
  }

  try {
    mostrarMensaje("Cargando detalle de tareas...", "info");
    const detalle = await llamarRpc("get_dashboard_tareas_usuario_detalle", {
      p_fecha_desde: elementos.fechaDesde.value,
      p_fecha_hasta: elementos.fechaHasta.value,
      p_responsible_user_id: filaUsuario.responsible_user_id,
    });
    detallesUsuariosAbiertos.set(claveUsuario, detalle);
    const tareasUsuario = await llamarRpc("get_dashboard_tareas_por_usuario", {
      p_fecha_desde: elementos.fechaDesde.value,
      p_fecha_hasta: elementos.fechaHasta.value,
    });
    renderizarTablaTareasUsuario(tareasUsuario);
    ocultarMensaje();
  } catch (error) {
    console.error(error);
    mostrarMensaje(`Error al consultar detalle de tareas: ${error.message}`, "error");
  }
}

function crearFilaDetalle(datos, claveUsuario) {
  const fila = document.createElement("tr");
  fila.className = "fila-detalle";
  const celda = document.createElement("td");
  celda.colSpan = 6;
  const contenedor = document.createElement("div");
  contenedor.className = "detalle-tareas";
  const tabla = document.createElement("table");
  tabla.setAttribute("aria-label", `Detalle de tareas del usuario ${claveUsuario}`);
  tabla.innerHTML = "<thead><tr><th>Tipo de gestión</th><th>Tipo de tarea</th><th>Tareas generadas</th><th>Completadas</th><th>Pendientes</th><th>% cumplimiento</th></tr></thead>";
  const tbody = document.createElement("tbody");
  renderizarTabla(tbody, datos, [
    { clave: "tipo_gestion", formato: (v) => v || "—" },
    { clave: "task_type_name", formato: (v) => v || "—" },
    { clave: "tareas_generadas", formato: formatearNumero },
    { clave: "tareas_completadas", formato: formatearNumero },
    { clave: "tareas_pendientes", formato: formatearNumero },
    { clave: "porcentaje_completadas", formato: formatearPorcentaje },
  ], "Sin tareas para el rango seleccionado");
  tabla.appendChild(tbody);
  contenedor.appendChild(tabla);
  celda.appendChild(contenedor);
  fila.appendChild(celda);
  return fila;
}

elementos.formFiltros.addEventListener("submit", (evento) => {
  evento.preventDefault();
  cargarDashboard();
});

if (elementos.logoInstitucional) {
  elementos.logoInstitucional.addEventListener("error", () => {
    elementos.logoInstitucional.classList.add("logo-oculto");
    elementos.logoInstitucional.removeAttribute("src");
  });
}

elementos.botonesRapidos.forEach((boton) => {
  boton.addEventListener("click", () => {
    const [desde, hasta] = obtenerRangoRapido(boton.dataset.rango);
    elementos.fechaDesde.value = aISOFecha(desde);
    elementos.fechaHasta.value = aISOFecha(hasta);
    cargarDashboard();
  });
});

definirRangoPorDefecto();
actualizarRangoSeleccionado();
cargarDashboard();
