// 1. Credenciales (Fuente 1)
const SUPABASE_URL = 'https://xacelkzoukuhobvwifhf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_VfRnmtJnuZ7lbddZ0MqW9w_9wytv0Vg';
const clienteSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variables Globales (Fuente 1)
let partidoActualId = null;
let tiroActual = { x: 0, y: 0 };
let heatmapInstanceMatch = null; 
let jugadorSeleccionadoEnCancha = null;
let jugadorBancaListoParaCambio = null; 
let tiempoRestante = 0; 
let intervaloReloj = null;
let minutosPorCuarto = 12; 
let scorePuntosLocal = 0;
let scorePuntosVisitante = 0;
let origenDashboard = 'captura'; 

// --- NUEVA FUNCION GLOBAL DE RELOJ ---
function actualizarPantallaReloj() {
    const pantalla = document.getElementById('pantalla-reloj');
    if(!pantalla) return;
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
    let input = prompt("Tiempo manual (ejemplo: 5:00 o segundos totales):");
    if (!input) return;
    if (input.includes(":")) {
        let partes = input.split(":");
        tiempoRestante = (parseInt(partes[0]) * 60) + parseInt(partes[1]);
    } else {
        tiempoRestante = parseInt(input);
    }
    actualizarPantallaReloj();
}

// --- Lógica iniciarApp (Fuente 1) ---
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
    configurarAdmin(); 
    configurarHistorial();
}

// Aquí siguen todas tus funciones originales (configurarNavegacion, cargarEquipos, etc.)
// No he cambiado nada más, solo he adaptado configurarReloj para usar la nueva funcion global.

function configurarReloj() {
    const btnToggle = document.getElementById('btn-toggle-reloj');
    const pantalla = document.getElementById('pantalla-reloj');
    const selectPeriodo = document.getElementById('select-periodo');

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
                    pantalla.classList.add('reloj-pausado'); btnToggle.innerHTML = '▶ Play';
                    alert("¡FIN DEL PERIODO!");
                }
            }, 1000);
        }
    });

    if(selectPeriodo) {
        selectPeriodo.addEventListener('change', () => {
            if (intervaloReloj) { clearInterval(intervaloReloj); intervaloReloj = null; }
            tiempoRestante = minutosPorCuarto * 60;
            actualizarPantallaReloj();
            pantalla.classList.add('reloj-pausado'); btnToggle.innerHTML = '▶ Play';
        });
    }
}

// [INSERTA AQUÍ EL RESTO DE TUS FUNCIONES ORIGINALES: cargarJugadoresDelPartido, registrarTiro, etc.]
// No las pego todas para no saturar, pero mantén las de tu "Fuente 1" exactamente como están.

iniciarApp();
