// 1. Credenciales y Supabase
const SUPABASE_URL = 'https://xacelkzoukuhobvwifhf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_VfRnmtJnuZ7lbddZ0MqW9w_9wytv0Vg';
const clienteSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variables Globales
let partidoActualId = null;
let equipoLocalGlobalId = null;
let equipoVisitanteGlobalId = null;
let jugadorSeleccionadoEnCancha = null;
let jugadorBancaListoParaCambio = null; 
let tiempoRestante = 0; 
let intervaloReloj = null;
let minutosPorCuarto = 12; 
let scorePuntosLocal = 0;
let scorePuntosVisitante = 0;
let mapaNombresGlobal = {};
let tiroActual = { x: 0, y: 0 };

async function iniciarApp() {
    document.getElementById('estado-conexion').textContent = "Conectado. Configura el partido.";
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
    configurarAdmin(); 
    configurarHistorial();
}

// --- NUEVAS FUNCIONES DE RELOJ ACCESIBLES ---
function actualizarPantallaRelojUI() {
    const pantalla = document.getElementById('pantalla-reloj');
    if (!pantalla) return;
    let min = Math.floor(tiempoRestante / 60);
    let seg = tiempoRestante % 60;
    pantalla.textContent = `${min.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}`;
}

function ajustarReloj(segundos) {
    tiempoRestante += segundos;
    if (tiempoRestante < 0) tiempoRestante = 0;
    actualizarPantallaRelojUI();
}

function ajusteManualReloj() {
    let input = prompt("Tiempo manual (ejemplo 5:00 o segundos totales):");
    if (!input) return;
    if (input.includes(":")) {
        let partes = input.split(":");
        tiempoRestante = (parseInt(partes[0]) * 60) + parseInt(partes[1]);
    } else {
        tiempoRestante = parseInt(input);
    }
    actualizarPantallaRelojUI();
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
                actualizarPantallaRelojUI();
                if (tiempoRestante <= 0) {
                    clearInterval(intervaloReloj); intervaloReloj = null;
                    pantalla.classList.add('reloj-pausado'); btnToggle.innerHTML = '▶ Play'; btnToggle.style.backgroundColor = '#28a745';
                    alert("¡FIN DEL PERIODO!");
                }
            }, 1000);
        }
    });

    document.getElementById('select-periodo').addEventListener('change', () => {
        if (intervaloReloj) { clearInterval(intervaloReloj); intervaloReloj = null; }
        tiempoRestante = minutosPorCuarto * 60;
        actualizarPantallaRelojUI();
    });
}

// --- LOGICA DE BD Y JUGADORES (MANTENIDA DE FUENTE 1) ---
async function cargarEquipos() {
    const { data } = await clienteSupabase.from('equipos').select('*');
    const sl = document.getElementById('select-local');
    const sv = document.getElementById('select-visitante');
    if(sl && sv) {
        sl.innerHTML = '<option value="">Local...</option>';
        sv.innerHTML = '<option value="">Visita...</option>';
        data.forEach(e => {
            sl.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
            sv.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
        });
    }
}

function configurarBotonIniciar() {
    const btn = document.getElementById('btn-iniciar-partido');
    btn.addEventListener('click', async () => {
        const idL = document.getElementById('select-local').value;
        const idV = document.getElementById('select-visitante').value;
        if (!idL || !idV || idL === idV) return alert("Selección inválida.");

        equipoLocalGlobalId = parseInt(idL);
        equipoVisitanteGlobalId = parseInt(idV);
        minutosPorCuarto = parseInt(document.getElementById('config-minutos').value);
        tiempoRestante = minutosPorCuarto * 60;
        actualizarPantallaRelojUI();

        const nuevoPartido = { 
            equipo_local_id: idL, equipo_visitante_id: idV, 
            fecha: document.getElementById('config-fecha').value,
            torneo: document.getElementById('config-torneo').value
        };

        const { data, error } = await clienteSupabase.from('partidos').insert([nuevoPartido]).select();
        if (error) return alert("Error: " + error.message);

        partidoActualId = data[0].id;
        document.getElementById('panel-configuracion').classList.add('oculto');
        document.getElementById('panel-captura').classList.remove('oculto');
        await poblarNombresGlobales();
        cargarJugadoresDelPartido(idL, idV);
    });
}

async function poblarNombresGlobales() {
    const { data } = await clienteSupabase.from('jugadores').select('*');
    data.forEach(j => mapaNombresGlobal[j.id] = { nombre: j.nombre, equipo: j.equipo_id });
}

// (Siguen funciones de crearBotonJugadorDOM, cargarJugadoresDelPartido, configurarCancha, etc.)
// Se mantienen idénticas a Fuente 1 para no romper la captura de Plus/Minus y snapshot de cancha.

function obtenerEstadoCancha() {
    const locales = Array.from(document.querySelectorAll('#grid-local-cancha .btn-jugador')).map(b => parseInt(b.dataset.id));
    const visitantes = Array.from(document.querySelectorAll('#grid-visitante-cancha .btn-jugador')).map(b => parseInt(b.dataset.id));
    const tiempoReloj = document.getElementById('pantalla-reloj').textContent;
    return { local: locales, visita: visitantes, tiempo: tiempoReloj };
}

// ... Resto de la lógica (Stats, Heatmap, Admin) respetando Fuente 1 ...

iniciarApp();
