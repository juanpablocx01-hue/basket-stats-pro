const SUPABASE_URL = 'https://xacelkzoukuhobvwifhf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_VfRnmtJnuZ7lbddZ0MqW9w_9wytv0Vg';
const clienteSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let partidoActualId = null;
let equipoLocalGlobalId = null;
let equipoVisitanteGlobalId = null;
let jugadorSeleccionadoId = null;
let jugadorBancaCambio = null;
let tiempoRestante = 0;
let intervaloReloj = null;
let mapaNombresGlobal = {};
let tiroActual = { x: 0, y: 0 };
let origenDashboard = 'captura';

async function iniciarApp() {
    configurarNavegacion();
    await cargarEquipos();
    document.getElementById('btn-iniciar-partido').onclick = iniciarPartido;
    configurarCancha();
    configurarAccionesRapidas();
    configurarDashboard();
}

// --- NAVEGACIÓN ---
function configurarNavegacion() {
    document.getElementById('nav-partido').onclick = () => {
        document.getElementById('seccion-partido').classList.remove('oculto');
        document.getElementById('seccion-historial').classList.add('oculto');
    };
    document.getElementById('nav-historial').onclick = () => {
        document.getElementById('seccion-partido').classList.add('oculto');
        document.getElementById('seccion-historial').classList.remove('oculto');
        cargarHistorial();
    };
}

async function cargarEquipos() {
    const { data } = await clienteSupabase.from('equipos').select('*');
    const l = document.getElementById('select-local');
    const v = document.getElementById('select-visitante');
    l.innerHTML = v.innerHTML = '<option value="">Selecciona Equipo...</option>';
    data.forEach(e => {
        l.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
        v.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
    });
}

// --- LOGICA PARTIDO ---
async function iniciarPartido() {
    const l = document.getElementById('select-local').value;
    const v = document.getElementById('select-visitante').value;
    if (!l || !v || l === v) return alert("Selección inválida");

    equipoLocalGlobalId = parseInt(l);
    equipoVisitanteGlobalId = parseInt(v);
    tiempoRestante = parseInt(document.getElementById('config-minutos').value) * 60;
    actualizarRelojUI();

    const { data, error } = await clienteSupabase.from('partidos').insert([{
        equipo_local_id: l, equipo_visitante_id: v, fecha: document.getElementById('config-fecha').value
    }]).select();

    if (data) {
        partidoActualId = data[0].id;
        document.getElementById('panel-configuracion').classList.add('oculto');
        document.getElementById('panel-captura').classList.remove('oculto');
        await poblarNombres();
        await cargarRosters();
    }
}

async function poblarNombres() {
    const { data } = await clienteSupabase.from('jugadores').select('*');
    data.forEach(j => mapaNombresGlobal[j.id] = { nombre: `${j.nombre} (#${j.numero})`, equipo: j.equipo_id });
}

async function cargarRosters() {
    const { data } = await clienteSupabase.from('jugadores').select('*').in('equipo_id', [equipoLocalGlobalId, equipoVisitanteGlobalId]);
    const render = (j, i) => {
        const btn = document.createElement('button');
        btn.className = 'btn-jugador';
        btn.textContent = `${j.nombre} (#${j.numero})`;
        btn.dataset.id = j.id;
        btn.dataset.estado = i%10 < 5 ? 'cancha' : 'banca';
        btn.onclick = () => manejarClickJugador(btn);
        const grid = j.equipo_id == equipoLocalGlobalId ? (i%10<5?'grid-local-cancha':'grid-local-banca') : (i%10<5?'grid-visitante-cancha':'grid-visitante-banca');
        document.getElementById(grid).appendChild(btn);
    };
    data.forEach((j, i) => render(j, i));
}

function manejarClickJugador(btn) {
    if (btn.dataset.estado === 'banca') {
        document.querySelectorAll('.btn-jugador').forEach(b => b.classList.remove('listo-cambio'));
        btn.classList.add('listo-cambio'); jugadorBancaCambio = btn;
    } else if (jugadorBancaCambio) {
        const banca = jugadorBancaCambio.parentElement; const cancha = btn.parentElement;
        btn.dataset.estado = 'banca'; jugadorBancaCambio.dataset.estado = 'cancha';
        banca.appendChild(btn); cancha.appendChild(jugadorBancaCambio);
        jugadorBancaCambio.classList.remove('listo-cambio'); jugadorBancaCambio = null;
    } else {
        document.querySelectorAll('.btn-jugador').forEach(b => b.classList.remove('activo'));
        btn.classList.add('activo'); jugadorSeleccionadoId = parseInt(btn.dataset.id);
    }
}

// --- RELOJ ---
function actualizarRelojUI() {
    const m = Math.floor(tiempoRestante/60); const s = tiempoRestante%60;
    document.getElementById('pantalla-reloj').textContent = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

function ajustarReloj(s) { tiempoRestante += s; if(tiempoRestante<0) tiempoRestante=0; actualizarRelojUI(); }

function ajusteManualReloj() {
    let inp = prompt("Tiempo manual (min:seg):");
    if (inp && inp.includes(":")) {
        let p = inp.split(":"); tiempoRestante = (parseInt(p[0])*60) + parseInt(p[1]);
        actualizarRelojUI();
    }
}

function configurarReloj() {
    const btn = document.getElementById('btn-toggle-reloj');
    btn.onclick = () => {
        if (intervaloReloj) {
            clearInterval(intervaloReloj); intervaloReloj = null;
            btn.textContent = "PLAY"; btn.style.background = "green";
        } else {
            btn.textContent = "PAUSE"; btn.style.background = "red";
            intervaloReloj = setInterval(() => {
                tiempoRestante--; actualizarRelojUI();
                if (tiempoRestante<=0) { clearInterval(intervaloReloj); alert("FIN!"); }
            }, 1000);
        }
    };
}

// --- CAPTURA ---
function configurarCancha() {
    const c = document.getElementById('cancha');
    c.onclick = (e) => {
        if (!jugadorSeleccionadoId) return alert("Selecciona jugador");
        const r = c.getBoundingClientRect();
        tiroActual.x = ((e.clientX - r.left) / r.width * 100).toFixed(1);
        tiroActual.y = ((e.clientY - r.top) / r.height * 100).toFixed(1);
        c.querySelectorAll('.marcador-tiro').forEach(m => m.remove());
        const m = document.createElement('div');
        m.className = 'marcador-tiro'; m.style.left = tiroActual.x+'%'; m.style.top = tiroActual.y+'%';
        c.appendChild(m);
        document.getElementById('acciones-tiro').classList.remove('oculto');
    };
    document.getElementById('btn-acierto').onclick = () => registrarEvento('Tiro', 'Acierto', parseInt(document.getElementById('select-puntos').value));
    document.getElementById('btn-fallo').onclick = () => registrarEvento('Tiro', 'Fallo', 0);
}

function configurarAccionesRapidas() {
    document.querySelectorAll('.btn-accion').forEach(b => {
        b.onclick = () => registrarEvento(b.dataset.tipo, b.dataset.res, b.dataset.tipo==='TL'&&b.dataset.res==='Acierto'?1:0);
    });
}

async function registrarEvento(tipo, res, pts) {
    if (!jugadorSeleccionadoId) return alert("Selecciona jugador");
    const estado = { 
        local: Array.from(document.querySelectorAll('#grid-local-cancha .btn-jugador')).map(b => parseInt(b.dataset.id)),
        visita: Array.from(document.querySelectorAll('#grid-visitante-cancha .btn-jugador')).map(b => parseInt(b.dataset.id)),
        tiempo: document.getElementById('pantalla-reloj').textContent
    };
    const ev = {
        partido_id: partidoActualId, jugador_id: jugadorSeleccionadoId,
        tipo_evento: tipo, resultado: res, puntos: pts,
        coord_x: tipo==='Tiro'?tiroActual.x : null, coord_y: tipo==='Tiro'?tiroActual.y : null,
        periodo: document.getElementById('select-periodo').value, cancha_estado: estado
    };
    await clienteSupabase.from('eventos').insert([ev]);
    document.getElementById('acciones-tiro').classList.add('oculto');
    if (res==='Acierto') await actualizarScoreReal();
    actualizarPlayByPlay();
}

async function actualizarScoreReal() {
    const { data } = await clienteSupabase.from('eventos').select('jugador_id, puntos').eq('partido_id', partidoActualId).eq('resultado', 'Acierto');
    let l = 0, v = 0;
    data.forEach(ev => {
        if (mapaNombresGlobal[ev.jugador_id].equipo == equipoLocalGlobalId) l += ev.puntos;
        else v += ev.puntos;
    });
    document.getElementById('score-local').textContent = l;
    document.getElementById('score-visitante').textContent = v;
}

async function actualizarPlayByPlay() {
    const { data } = await clienteSupabase.from('eventos').select('*').eq('partido_id', partidoActualId).order('id', {ascending: false}).limit(5);
    const lista = document.getElementById('lista-pbp');
    lista.innerHTML = data.map(ev => `<div>${ev.cancha_estado.tiempo} - ${mapaNombresGlobal[ev.jugador_id].nombre}: ${ev.tipo_evento}</div>`).join('');
}

// --- DASHBOARD Y STATS ---
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
    const stats = procesarStats(evs);
    const cuerpo = document.getElementById('tabla-estadisticas-cuerpo');
    cuerpo.innerHTML = Object.values(stats).map(s => `
        <tr><td>${mapaNombresGlobal[s.id].nombre}</td><td>${s.pts}</td><td>${s.pm}</td><td>${s.tl}</td><td>${s.p2}</td><td>${s.p3}</td><td>${s.reb}</td><td>${s.ast}</td><td>${s.per}</td></tr>
    `).join('');
}

function procesarStats(evs) {
    const res = {};
    evs.forEach(ev => {
        const id = ev.jugador_id;
        if (!res[id]) res[id] = { id, pts: 0, pm: 0, tl: 0, p2: 0, p3: 0, reb: 0, ast: 0, per: 0 };
        const s = res[id];
        if (ev.resultado === 'Acierto') {
            s.pts += ev.puntos;
            if (ev.tipo_evento === 'TL') s.tl++; else if (ev.puntos === 2) s.p2++; else if (ev.puntos === 3) s.p3++;
        }
        if (ev.tipo_evento === 'Rebote') s.reb++;
        if (ev.tipo_evento === 'Asistencia') s.ast++;
        if (ev.tipo_evento === 'Perdida') s.per++;

        // PLUS MINUS
        if (ev.resultado === 'Acierto' && (ev.tipo_evento === 'Tiro' || ev.tipo_evento === 'TL')) {
            const eq = mapaNombresGlobal[id].equipo;
            ev.cancha_estado.local.forEach(lid => { if(!res[lid]) res[lid] = { id: lid, pts: 0, pm: 0, tl: 0, p2: 0, p3: 0, reb: 0, ast: 0, per: 0 }; res[lid].pm += (eq == equipoLocalGlobalId ? ev.puntos : -ev.puntos); });
            ev.cancha_estado.visita.forEach(vid => { if(!res[vid]) res[vid] = { id: vid, pts: 0, pm: 0, tl: 0, p2: 0, p3: 0, reb: 0, ast: 0, per: 0 }; res[vid].pm += (eq == equipoVisitanteGlobalId ? ev.puntos : -ev.puntos); });
        }
    });
    return res;
}

async function cargarHistorial() {
    const { data } = await clienteSupabase.from('partidos').select('*').order('id', {ascending:false});
    document.getElementById('tabla-historial').innerHTML = data.map(p => `<tr><td>${p.id}</td><td>${p.fecha}</td><td>L vs V</td><td><button onclick="cargarPartidoHistorico(${p.id})">VER</button></td></tr>`).join('');
}

iniciarApp();
