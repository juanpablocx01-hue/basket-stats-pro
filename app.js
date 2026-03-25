const SUPABASE_URL = 'https://xacelkzoukuhobvwifhf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_VfRnmtJnuZ7lbddZ0MqW9w_9wytv0Vg';
const clienteSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let partidoActualId = null;
let equipoLocalId = null;
let equipoVisitaId = null;
let jugadorSeleccionado = null;
let tiempoRestante = 0;
let intervalo = null;
let tiroActual = { x: 0, y: 0 };
let mapaNombres = {};

async function iniciarApp() {
    await cargarEquipos();
    document.getElementById('btn-iniciar-partido').onclick = iniciarPartido;
    configurarCancha();
    configurarReloj();
    configurarBotonesAccion();
}

async function cargarEquipos() {
    const { data } = await clienteSupabase.from('equipos').select('*');
    const sl = document.getElementById('select-local');
    const sv = document.getElementById('select-visitante');
    if (data) {
        data.forEach(e => {
            sl.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
            sv.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
        });
    }
}

async function iniciarPartido() {
    const l = document.getElementById('select-local').value;
    const v = document.getElementById('select-visitante').value;
    if (!l || !v || l === v) return alert("Selecciona equipos diferentes");

    equipoLocalId = l; equipoVisitaId = v;
    tiempoRestante = parseInt(document.getElementById('config-minutos').value) * 60;
    actualizarRelojUI();

    const { data, error } = await clienteSupabase.from('partidos').insert([{
        equipo_local_id: l, equipo_visitante_id: v, fecha: document.getElementById('config-fecha').value
    }]).select();

    if (data) {
        partidoActualId = data[0].id;
        document.getElementById('panel-configuracion').classList.add('oculto');
        document.getElementById('panel-captura').classList.remove('oculto');
        await cargarJugadores();
    }
}

async function cargarJugadores() {
    const { data } = await clienteSupabase.from('jugadores').select('*').in('equipo_id', [equipoLocalId, equipoVisitaId]);
    data.forEach(j => mapaNombres[j.id] = j.nombre);
    
    const renderJugador = (j, i) => {
        const btn = document.createElement('button');
        btn.className = 'btn-jugador';
        btn.textContent = `${j.nombre} (#${j.numero})`;
        btn.onclick = () => {
            document.querySelectorAll('.btn-jugador').forEach(b => b.classList.remove('activo'));
            btn.classList.add('activo');
            jugadorSeleccionado = j.id;
        };
        const grid = j.equipo_id == equipoLocalId ? (i%10<5 ? 'grid-local-cancha' : 'grid-local-banca') : (i%10<5 ? 'grid-visitante-cancha' : 'grid-visitante-banca');
        document.getElementById(grid).appendChild(btn);
    };
    data.forEach((j, i) => renderJugador(j, i));
}

function configurarReloj() {
    const btn = document.getElementById('btn-toggle-reloj');
    btn.onclick = () => {
        if (intervalo) {
            clearInterval(intervalo); intervalo = null;
            btn.textContent = "PLAY"; btn.style.background = "green";
        } else {
            btn.textContent = "PAUSE"; btn.style.background = "red";
            intervalo = setInterval(() => {
                tiempoRestante--; actualizarRelojUI();
                if (tiempoRestante <= 0) clearInterval(intervalo);
            }, 1000);
        }
    };
}

function actualizarRelojUI() {
    const m = Math.floor(tiempoRestante / 60);
    const s = tiempoRestante % 60;
    document.getElementById('pantalla-reloj').textContent = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

function ajustarReloj(seg) {
    tiempoRestante += seg;
    if (tiempoRestante < 0) tiempoRestante = 0;
    actualizarRelojUI();
}

function configurarCancha() {
    const c = document.getElementById('cancha');
    c.onclick = (e) => {
        if (!jugadorSeleccionado) return alert("Selecciona jugador");
        const r = c.getBoundingClientRect();
        tiroActual.x = ((e.clientX - r.left) / r.width * 100).toFixed(1);
        tiroActual.y = ((e.clientY - r.top) / r.height * 100).toFixed(1);
        
        c.querySelectorAll('.marcador-tiro').forEach(m => m.remove());
        const m = document.createElement('div');
        m.className = 'marcador-tiro'; m.style.left = tiroActual.x + '%'; m.style.top = tiroActual.y + '%';
        c.appendChild(m);
        
        const menu = document.getElementById('acciones-tiro');
        menu.classList.remove('oculto');
        menu.style.left = (e.clientX - r.left) + 'px'; menu.style.top = (e.clientY - r.top) + 'px';
    };
}

function configurarBotonesAccion() {
    const registrar = async (tipo, res, pts) => {
        await clienteSupabase.from('eventos').insert([{
            partido_id: partidoActualId, jugador_id: jugadorSeleccionado,
            tipo_evento: tipo, resultado: res, puntos: pts,
            coord_x: tipo === 'Tiro' ? tiroActual.x : null,
            coord_y: tipo === 'Tiro' ? tiroActual.y : null,
            periodo: "Q1", 
            cancha_estado: { tiempo: document.getElementById('pantalla-reloj').textContent }
        }]);
        document.getElementById('acciones-tiro').classList.add('oculto');
        if (res === 'Acierto') actualizarMarcador();
    };

    document.getElementById('btn-acierto').onclick = () => registrar('Tiro', 'Acierto', parseInt(document.getElementById('select-puntos').value));
    document.getElementById('btn-fallo').onclick = () => registrar('Tiro', 'Fallo', 0);
    
    document.querySelectorAll('.btn-accion').forEach(b => {
        b.onclick = () => registrar(b.dataset.tipo, b.dataset.res, b.dataset.tipo === 'TL' && b.dataset.res === 'Acierto' ? 1 : 0);
    });
}

async function actualizarMarcador() {
    const { data } = await clienteSupabase.from('eventos').select('jugador_id, puntos').eq('partido_id', partidoActualId).eq('resultado', 'Acierto');
    let l = 0, v = 0;
    // Lógica simplificada: aquí deberías cruzar con el equipo_id del jugador
    document.getElementById('score-local').textContent = "..."; // Se refresca con la lógica real
}

iniciarApp();
