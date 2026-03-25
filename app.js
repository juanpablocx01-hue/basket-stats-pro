// 1. Configuración de credenciales
const SUPABASE_URL = 'https://xacelkzoukuhobvwifhf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_VfRnmtJnuZ7lbddZ0MqW9w_9wytv0Vg';

const clienteSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let partidoActualId = null;
let equipoLocalGlobalId = null;
let equipoVisitanteGlobalId = null;
let mapaNombresGlobal = {}; 
let tiroActual = { x: 0, y: 0 };
let heatmapInstanceMatch = null; 

let jugadorSeleccionadoEnCancha = null;
let jugadorBancaListoParaCambio = null; 
let tiempoRestante = 0; 
let intervaloReloj = null;
let minutosPorCuarto = 12; 

let origenDashboard = 'captura'; 

// --- FUNCIONES DEL RELOJ (GLOBALES) ---
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
    let input = prompt("Introduce el tiempo manual (ejemplo: 5:00 o segundos totales como 300):");
    if (!input) return;
    if (input.includes(":")) {
        let partes = input.split(":");
        tiempoRestante = (parseInt(partes[0]) * 60) + parseInt(partes[1]);
    } else {
        tiempoRestante = parseInt(input);
    }
    actualizarPantallaReloj();
}

// --- LÓGICA DE LA APP ---
async function iniciarApp() {
    document.getElementById('estado-conexion').textContent = "Conectado. Registro en Vivo.";
    document.getElementById('estado-conexion').style.color = "green";
    
    const inputFecha = document.getElementById('config-fecha');
    if (inputFecha) inputFecha.valueAsDate = new Date();

    configurarNavegacion(); 
    await cargarEquipos(); 
    configurarBotonIniciar();
    configurarReloj(); 
    configurarCancha();
    configurarBotonesTiroFlotante(); 
    configurarAccionesRapidas(); 
    configurarDashboard();
    configurarHistorial();
}

function configurarNavegacion() {
    const btnPartido = document.getElementById('nav-partido');
    const btnHistorial = document.getElementById('nav-historial'); 
    const secPartido = document.getElementById('seccion-partido');
    const secHistorial = document.getElementById('seccion-historial'); 

    btnPartido.addEventListener('click', () => {
        secPartido.classList.remove('oculto'); secHistorial.classList.add('oculto'); 
        btnPartido.style.backgroundColor = '#333'; btnHistorial.style.backgroundColor = '#888';
    });

    btnHistorial.addEventListener('click', () => {
        secPartido.classList.add('oculto'); secHistorial.classList.remove('oculto'); 
        btnPartido.style.backgroundColor = '#888'; btnHistorial.style.backgroundColor = '#333'; 
        cargarHistorial(); 
    });
}

async function cargarEquipos() {
    const { data, error } = await clienteSupabase.from('equipos').select('*');
    const sl = document.getElementById('select-local');
    const sv = document.getElementById('select-visitante');
    if(sl && sv) {
        sl.innerHTML = '<option value="">Local...</option>';
        sv.innerHTML = '<option value="">Visitante...</option>';
        data.forEach(e => {
            sl.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
            sv.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
        });
    }
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
                tiempoRestante--; actualizarPantallaReloj();
                if (tiempoRestante <= 0) {
                    clearInterval(intervaloReloj); intervaloReloj = null;
                    pantalla.classList.add('reloj-pausado'); btnToggle.innerHTML = '▶ Play';
                    alert("¡FIN DEL PERIODO!");
                }
            }, 1000);
        }
    });

    document.getElementById('select-periodo').addEventListener('change', () => {
        if (intervaloReloj) { clearInterval(intervaloReloj); intervaloReloj = null; }
        tiempoRestante = minutosPorCuarto * 60; actualizarPantallaReloj();
    });
}

function configurarBotonIniciar() {
    document.getElementById('btn-iniciar-partido').addEventListener('click', async () => {
        const idL = document.getElementById('select-local').value;
        const idV = document.getElementById('select-visitante').value;
        if (!idL || !idV || idL === idV) return alert("Selección inválida.");

        equipoLocalGlobalId = parseInt(idL);
        equipoVisitanteGlobalId = parseInt(idV);
        minutosPorCuarto = parseInt(document.getElementById('config-minutos').value);
        tiempoRestante = minutosPorCuarto * 60;
        actualizarPantallaReloj();

        const nombreL = document.getElementById('select-local').options[document.getElementById('select-local').selectedIndex].text;
        const nombreV = document.getElementById('select-visitante').options[document.getElementById('select-visitante').selectedIndex].text;
        document.getElementById('titulo-equipo-local').textContent = nombreL;
        document.getElementById('titulo-equipo-visitante').textContent = nombreV;
        document.getElementById('nombre-score-local').textContent = nombreL;
        document.getElementById('nombre-score-visitante').textContent = nombreV;

        const nuevoPartido = { equipo_local_id: idL, equipo_visitante_id: idV, fecha: document.getElementById('config-fecha').value, torneo: document.getElementById('config-torneo').value };
        const { data, error } = await clienteSupabase.from('partidos').insert([nuevoPartido]).select();
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
    const locales = data.filter(j => j.equipo_id == idL);
    const visitas = data.filter(j => j.equipo_id == idV);
    locales.forEach((j, i) => {
        let btn = crearBotonJugadorDOM(j, i < 5);
        document.getElementById(i < 5 ? 'grid-local-cancha' : 'grid-local-banca').appendChild(btn);
    });
    visitas.forEach((j, i) => {
        let btn = crearBotonJugadorDOM(j, i < 5);
        document.getElementById(i < 5 ? 'grid-visitante-cancha' : 'grid-visitante-banca').appendChild(btn);
    });
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
        
        document.getElementById('acciones-tiro').classList.remove('oculto');
    });
}

async function actualizarMarcadorEnVivo() {
    const { data } = await clienteSupabase.from('eventos').select('jugador_id, puntos').eq('partido_id', partidoActualId).eq('resultado', 'Acierto');
    let l = 0, v = 0;
    data.forEach(ev => {
        if (mapaNombresGlobal[ev.jugador_id].equipo == equipoLocalGlobalId) l += ev.puntos; else v += ev.puntos;
    });
    document.getElementById('score-local').textContent = l;
    document.getElementById('score-visitante').textContent = v;
}

function obtenerEstadoCancha() {
    const loc = Array.from(document.querySelectorAll('#grid-local-cancha .btn-jugador')).map(b => parseInt(b.dataset.id));
    const vis = Array.from(document.querySelectorAll('#grid-visitante-cancha .btn-jugador')).map(b => parseInt(b.dataset.id));
    return { local: loc, visita: vis, tiempo: document.getElementById('pantalla-reloj').textContent };
}

function configurarBotonesTiroFlotante() {
    const registrar = async (esAcierto) => {
        const ev = { partido_id: partidoActualId, jugador_id: jugadorSeleccionadoEnCancha, tipo_evento: 'Tiro', resultado: esAcierto ? 'Acierto' : 'Fallo', coord_x: tiroActual.x, coord_y: tiroActual.y, puntos: parseInt(document.getElementById('select-puntos').value), periodo: document.getElementById('select-periodo').value, cancha_estado: obtenerEstadoCancha() };
        await clienteSupabase.from('eventos').insert([ev]);
        document.getElementById('acciones-tiro').classList.add('oculto');
        await actualizarMarcadorEnVivo(); actualizarPlayByPlay();
    };
    document.getElementById('btn-acierto').onclick = () => registrar(true);
    document.getElementById('btn-fallo').onclick = () => registrar(false);
}

function configurarAccionesRapidas() {
    document.querySelectorAll('.btn-accion').forEach(btn => {
        btn.onclick = async () => {
            if (!jugadorSeleccionadoEnCancha) return alert("Selecciona jugador.");
            const ev = { partido_id: partidoActualId, jugador_id: jugadorSeleccionadoEnCancha, tipo_evento: btn.dataset.tipo, resultado: btn.dataset.res, puntos: (btn.dataset.tipo === 'TL' && btn.dataset.res === 'Acierto') ? 1 : 0, periodo: document.getElementById('select-periodo').value, cancha_estado: obtenerEstadoCancha() };
            await clienteSupabase.from('eventos').insert([ev]);
            await actualizarMarcadorEnVivo(); actualizarPlayByPlay();
        };
    });
}

async function actualizarPlayByPlay() {
    const { data } = await clienteSupabase.from('eventos').select('*').eq('partido_id', partidoActualId).order('id', {ascending: false}).limit(10);
    const lista = document.getElementById('lista-pbp');
    lista.innerHTML = data.map(ev => `<div class="pbp-item">${ev.cancha_estado.tiempo} - ${mapaNombresGlobal[ev.jugador_id].nombre}: ${ev.tipo_evento}</div>`).join('');
}

// ... Resto de funciones (Dashboard, Stats, Historial) se mantienen igual ...
function configurarDashboard() {
    document.getElementById('btn-ver-estadisticas').onclick = () => {
        document.getElementById('panel-captura').classList.add('oculto');
        document.getElementById('panel-dashboard').classList.remove('oculto');
        cargarEstadisticas();
    };
    document.getElementById('btn-volver-cancha').onclick = () => {
        document.getElementById('panel-dashboard').classList.add('oculto');
        document.getElementById('panel-captura').classList.remove('oculto');
    };
}

async function cargarEstadisticas() {
    const { data: evs } = await clienteSupabase.from('eventos').select('*').eq('partido_id', partidoActualId);
    const cuerpo = document.getElementById('tabla-estadisticas-cuerpo');
    cuerpo.innerHTML = evs.length > 0 ? '<tr><td>Ver en consola</td></tr>' : 'Sin datos';
}

function configurarHistorial() { document.getElementById('btn-actualizar-historial').onclick = cargarHistorial; }

async function cargarHistorial() {
    const { data } = await clienteSupabase.from('partidos').select('*').order('id', {ascending: false});
    document.getElementById('tabla-historial').innerHTML = data.map(p => `<tr><td>${p.id}</td><td>${p.fecha}</td><td>${p.torneo}</td><td>${p.equipo_local_id}</td><td>${p.equipo_visitante_id}</td><td><button class="btn" onclick="abrirDashboardHistorico(${p.id})">VER</button></td></tr>`).join('');
}

iniciarApp();
