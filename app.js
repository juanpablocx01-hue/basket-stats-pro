// 1. Credenciales
const SUPABASE_URL = 'https://xacelkzoukuhobvwifhf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_VfRnmtJnuZ7lbddZ0MqW9w_9wytv0Vg';
const clienteSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variables Globales
let partidoActualId = null;
let equipoLocalGlobalId = null;
let equipoVisitanteGlobalId = null;
let mapaNombresGlobal = {}; 
let tiroActual = { x: 0, y: 0 };
let jugadorSeleccionadoEnCancha = null;
let jugadorBancaListoParaCambio = null; 
let tiempoRestante = 0; 
let intervaloReloj = null;
let minutosPorCuarto = 12; 
let origenDashboard = 'captura'; 

async function iniciarApp() {
    document.getElementById('estado-conexion').textContent = "Conectado. Registro en Vivo.";
    document.getElementById('estado-conexion').style.color = "green";
    if (document.getElementById('config-fecha')) document.getElementById('config-fecha').valueAsDate = new Date();

    configurarNavegacion(); 
    await cargarEquipos(); 
    configurarBotonIniciar();
    configurarReloj(); 
    configurarCancha();
    configurarBotonesTiroFlotante(); 
    configurarAccionesRapidas(); 
    configurarDashboard();
}

// --- LÓGICA DEL RELOJ CENTRALIZADA ---
function actualizarPantallaReloj() {
    const pantalla = document.getElementById('pantalla-reloj');
    if (!pantalla) return;
    let min = Math.floor(tiempoRestante / 60);
    let seg = tiempoRestante % 60;
    pantalla.textContent = `${min.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}`;
}

function ajustarReloj(segundos) {
    tiempoRestante += segundos;
    if (tiempoRestante < 0) tiempoRestante = 0;
    actualizarPantallaReloj();
}

function ajusteManualReloj() {
    let input = prompt("Ajuste manual (ej: 5:00 o segundos totales):");
    if (!input) return;
    if (input.includes(":")) {
        let partes = input.split(":");
        tiempoRestante = (parseInt(partes[0]) * 60) + parseInt(partes[1]);
    } else {
        tiempoRestante = parseInt(input);
    }
    actualizarPantallaReloj();
}

function configurarReloj() {
    const btnToggle = document.getElementById('btn-toggle-reloj');
    const pantalla = document.getElementById('pantalla-reloj');

    btnToggle.addEventListener('click', () => {
        if (tiempoRestante <= 0) return; 
        if (intervaloReloj) {
            clearInterval(intervaloReloj); intervaloReloj = null;
            pantalla.classList.add('reloj-pausado'); btnToggle.innerHTML = '▶ Play'; btnToggle.style.backgroundColor = '#28a745';
        } else {
            pantalla.classList.remove('reloj-pausado'); btnToggle.innerHTML = '⏸ Pausa'; btnToggle.style.backgroundColor = '#dc3545'; 
            intervaloReloj = setInterval(() => {
                tiempoRestante--; 
                actualizarPantallaReloj();
                if (tiempoRestante <= 0) {
                    clearInterval(intervaloReloj); intervaloReloj = null;
                    alert("¡FIN DEL PERIODO!");
                }
            }, 1000);
        }
    });

    document.getElementById('select-periodo').addEventListener('change', () => {
        if (intervaloReloj) { clearInterval(intervaloReloj); intervaloReloj = null; }
        tiempoRestante = minutosPorCuarto * 60; 
        actualizarPantallaReloj();
        pantalla.classList.add('reloj-pausado'); btnToggle.innerHTML = '▶ Play';
    });
}

// --- FUNCIONES DE BASE DE DATOS Y ROSTER ---
async function cargarEquipos() {
    const { data } = await clienteSupabase.from('equipos').select('*');
    const selectLocal = document.getElementById('select-local');
    const selectVisitante = document.getElementById('select-visitante');
    if(data) {
        data.forEach(e => {
            selectLocal.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
            selectVisitante.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
        });
    }
}

function configurarBotonIniciar() {
    document.getElementById('btn-iniciar-partido').addEventListener('click', async () => {
        const idL = document.getElementById('select-local').value;
        const idV = document.getElementById('select-visitante').value;
        if (!idL || !idV || idL === idV) return alert("Selecciona equipos válidos.");

        equipoLocalGlobalId = parseInt(idL);
        equipoVisitanteGlobalId = parseInt(idV);
        minutosPorCuarto = parseInt(document.getElementById('config-minutos').value);
        tiempoRestante = minutosPorCuarto * 60;
        actualizarPantallaReloj();

        const { data, error } = await clienteSupabase.from('partidos').insert([{
            equipo_local_id: idL, equipo_visitante_id: idV, 
            fecha: document.getElementById('config-fecha').value,
            torneo: document.getElementById('config-torneo').value,
            cancha: document.getElementById('config-cancha').value
        }]).select();

        if (data) {
            partidoActualId = data[0].id;
            document.getElementById('panel-configuracion').classList.add('oculto');
            document.getElementById('panel-captura').classList.remove('oculto');
            await poblarNombresGlobales();
            cargarJugadoresDelPartido(idL, idV);
        }
    });
}

async function poblarNombresGlobales() {
    const { data } = await clienteSupabase.from('jugadores').select('*');
    data.forEach(j => { mapaNombresGlobal[j.id] = { nombre: `${j.nombre} (#${j.numero})`, equipo: j.equipo_id }; });
}

function crearBotonJugadorDOM(jugador, esCancha) {
    const btn = document.createElement('button');
    btn.className = 'btn-jugador';
    btn.textContent = `${jugador.nombre} (#${jugador.numero})`;
    btn.dataset.id = jugador.id;
    btn.dataset.estado = esCancha ? 'cancha' : 'banca';
    btn.addEventListener('click', () => {
        if (btn.dataset.estado === 'banca') {
            document.querySelectorAll('.btn-jugador').forEach(b => b.classList.remove('listo-cambio'));
            btn.classList.add('listo-cambio'); jugadorBancaListoParaCambio = btn;
        } else if (jugadorBancaListoParaCambio) {
            const banca = jugadorBancaListoParaCambio.parentElement;
            const cancha = btn.parentElement;
            btn.dataset.estado = 'banca'; jugadorBancaListoParaCambio.dataset.estado = 'cancha';
            banca.appendChild(btn); cancha.appendChild(jugadorBancaListoParaCambio);
            jugadorBancaListoParaCambio.classList.remove('listo-cambio');
            jugadorBancaListoParaCambio = null;
        } else {
            document.querySelectorAll('.btn-jugador').forEach(b => b.classList.remove('activo'));
            btn.classList.add('activo'); jugadorSeleccionadoEnCancha = jugador.id;
        }
    });
    return btn;
}

async function cargarJugadoresDelPartido(idL, idV) {
    const { data } = await clienteSupabase.from('jugadores').select('*').in('equipo_id', [idL, idV]);
    data.forEach((j, i) => {
        const esCancha = (i % 10) < 5;
        const btn = crearBotonJugadorDOM(j, esCancha);
        const grid = j.equipo_id == idL ? (esCancha ? 'grid-local-cancha' : 'grid-local-banca') : (esCancha ? 'grid-visitante-cancha' : 'grid-visitante-banca');
        document.getElementById(grid).appendChild(btn);
    });
}

// --- REGISTRO DE EVENTOS ---
function obtenerEstadoCancha() {
    const locales = Array.from(document.querySelectorAll('#grid-local-cancha .btn-jugador')).map(b => parseInt(b.dataset.id));
    const visitas = Array.from(document.querySelectorAll('#grid-visitante-cancha .btn-jugador')).map(b => parseInt(b.dataset.id));
    return { local: locales, visita: visitas, tiempo: document.getElementById('pantalla-reloj').textContent };
}

function configurarCancha() {
    const cancha = document.getElementById('cancha');
    cancha.addEventListener('click', (e) => {
        if (!jugadorSeleccionadoEnCancha) return alert("Selecciona jugador.");
        const rect = cancha.getBoundingClientRect();
        tiroActual.x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
        tiroActual.y = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);
        
        cancha.querySelectorAll('.marcador-tiro').forEach(m => m.remove());
        const marcador = document.createElement('div');
        marcador.className = 'marcador-tiro'; marcador.style.left = tiroActual.x + '%'; marcador.style.top = tiroActual.y + '%';
        cancha.appendChild(marcador);
        
        const menu = document.getElementById('acciones-tiro');
        menu.classList.remove('oculto');
        menu.style.left = (e.clientX - rect.left) + 'px'; menu.style.top = (e.clientY - rect.top) + 'px';
    });
}

function configurarBotonesTiroFlotante() {
    const registrar = async (esAcierto) => {
        const ev = {
            partido_id: partidoActualId, jugador_id: jugadorSeleccionadoEnCancha,
            tipo_evento: 'Tiro', resultado: esAcierto ? 'Acierto' : 'Fallo',
            coord_x: tiroActual.x, coord_y: tiroActual.y,
            puntos: parseInt(document.getElementById('select-puntos').value),
            periodo: document.getElementById('select-periodo').value,
            cancha_estado: obtenerEstadoCancha()
        };
        await clienteSupabase.from('eventos').insert([ev]);
        document.getElementById('acciones-tiro').classList.add('oculto');
        actualizarPlayByPlay();
        if (esAcierto) mostrarMenuAsistencia(jugadorSeleccionadoEnCancha);
    };
    document.getElementById('btn-acierto').onclick = () => registrar(true);
    document.getElementById('btn-fallo').onclick = () => registrar(false);
}

function configurarAccionesRapidas() {
    document.querySelectorAll('.btn-accion').forEach(btn => {
        btn.onclick = async () => {
            if (!jugadorSeleccionadoEnCancha) return alert("Selecciona jugador.");
            const ev = {
                partido_id: partidoActualId, jugador_id: jugadorSeleccionadoEnCancha,
                tipo_evento: btn.dataset.tipo, resultado: btn.dataset.res,
                puntos: btn.dataset.tipo === 'TL' && btn.dataset.res === 'Acierto' ? 1 : 0,
                periodo: document.getElementById('select-periodo').value,
                cancha_estado: obtenerEstadoCancha()
            };
            await clienteSupabase.from('eventos').insert([ev]);
            actualizarPlayByPlay();
        };
    });
}

async function actualizarPlayByPlay() {
    const { data } = await clienteSupabase.from('eventos').select('*').eq('partido_id', partidoActualId).order('id', {ascending: false}).limit(10);
    const lista = document.getElementById('lista-pbp');
    lista.innerHTML = data.map(ev => `<div>${ev.periodo} | ${ev.cancha_estado.tiempo} - ${mapaNombresGlobal[ev.jugador_id].nombre}: ${ev.tipo_evento}</div>`).join('');
}

// (Otras funciones de navegación y dashboard se mantienen igual)
function configurarNavegacion() {}
function configurarDashboard() {}

iniciarApp();
