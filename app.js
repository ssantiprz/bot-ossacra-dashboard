const SUPABASE_URL = "https://uiyptwgsmpjrwgmwwhoj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Tf0fqiJEfZaS-yawoQM9Fg_yhrAWQBV";
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
  botonesRapidos: document.querySelectorAll("[data-rango]"),
  tablaProvincia: document.querySelector("#tablaProvincia"),
  tablaPlan: document.querySelector("#tablaPlan"),
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
    const [datosKpis, resumenDiario, resumenProvincia, resumenPlan] = await Promise.all([
      llamarRpc("get_dashboard_kpis", parametros),
      llamarRpc("get_dashboard_resumen_diario", parametros),
      llamarRpc("get_dashboard_resumen_provincia", parametros),
      llamarRpc("get_dashboard_resumen_plan", parametros),
    ]);

    actualizarKpis(datosKpis[0] || {});
    actualizarGraficoDiario(resumenDiario);
    actualizarGraficoFueraHorario(resumenDiario);
    renderizarTablaProvincia(resumenProvincia);
    renderizarTablaPlan(resumenPlan);

    const sinDatos = !datosKpis.length && !resumenDiario.length && !resumenProvincia.length && !resumenPlan.length;
    elementos.estadoConexion.textContent = "Datos actualizados";
    if (sinDatos) mostrarMensaje("Sin datos para el rango seleccionado", "vacio");
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
        { label: "Mensajes entrantes", data: datos.map((fila) => valorNumerico(fila.mensajes_entrantes)), borderColor: "#174b7a", backgroundColor: "rgba(23,75,122,.12)", tension: .35, fill: true },
        { label: "Interacciones diarias", data: datos.map((fila) => valorNumerico(fila.interacciones_diarias)), borderColor: "#16845b", backgroundColor: "rgba(22,132,91,.10)", tension: .35 },
        { label: "Recontactos", data: datos.map((fila) => valorNumerico(fila.recontactos)), borderColor: "#b54708", backgroundColor: "rgba(181,71,8,.10)", tension: .35 },
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
        { type: "bar", label: "Mensajes fuera de horario", data: datos.map((fila) => valorNumerico(fila.mensajes_fuera_de_horario)), backgroundColor: "rgba(23,75,122,.72)", yAxisID: "y" },
        { type: "line", label: "% Fuera de horario", data: datos.map((fila) => valorNumerico(fila.porcentaje_fuera_de_horario)), borderColor: "#b42318", backgroundColor: "rgba(180,35,24,.12)", tension: .35, yAxisID: "y1" },
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

function renderizarTabla(tbody, datos, columnas) {
  tbody.innerHTML = "";
  if (!datos.length) {
    const fila = document.createElement("tr");
    fila.className = "fila-vacia";
    fila.innerHTML = `<td colspan="${columnas.length}">Sin datos para el rango seleccionado</td>`;
    tbody.appendChild(fila);
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

elementos.formFiltros.addEventListener("submit", (evento) => {
  evento.preventDefault();
  cargarDashboard();
});

elementos.botonesRapidos.forEach((boton) => {
  boton.addEventListener("click", () => {
    const [desde, hasta] = obtenerRangoRapido(boton.dataset.rango);
    elementos.fechaDesde.value = aISOFecha(desde);
    elementos.fechaHasta.value = aISOFecha(hasta);
    cargarDashboard();
  });
});

definirRangoPorDefecto();
cargarDashboard();
