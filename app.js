// 1. Configura tus credenciales (Reemplaza con los tuyos)
const SUPABASE_URL = 'https://xacelkzoukuhobvwifhf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_VfRnmtJnuZ7lbddZ0MqW9w_9wytv0Vg';

// Inicializamos el cliente
const clienteSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let partidoActualId = null;
let tiroActual = { x: 0, y: 0 };
let heatmapInstanceMatch = null; 
let heatmapInstanceSeason = null; 

let jugadorSeleccionadoEnCancha = null;
let jugadorBancaListoParaCambio = null; 
let tiempoRestante = 0; 
let intervaloReloj = null;
let minutosPorCuarto = 12; 

let scorePuntosLocal = 0;
let scorePuntosVisitante = 0;

let origenDashboard = 'captura'; 

async function iniciarApp() {
    document.getElementById('estado-conexion').textContent = "Conectado. Configura el partido Master.";
    document.getElementById('estado-conexion').style.color = "green";
    
    // Autocompletar la fecha con hoy, pero el usuario puede cambiarla
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
    
    cargarJugadoresGlobales(); 
}

function configurarNavegacion() {
    const btnPartido = document.getElementById('nav-partido');
    const btnHistorial = document.getElementById('nav-historial'); 
    const btnTemporada = document.getElementById('nav-temporada');
    const btnAdmin = document.getElementById('nav-admin'); 
    
    const secPartido = document.getElementById('seccion-partido');
    const secHistorial = document.getElementById('seccion-historial'); 
    const secTemporada = document.getElementById('seccion-temporada');
    const secAdmin = document.getElementById('seccion-admin'); 

    if(!btnPartido || !secPartido) return;

    btnPartido.addEventListener('click', () => {
        secPartido.classList.remove('oculto'); secHistorial.classList.add('oculto'); secTemporada.classList.add('oculto'); secAdmin.classList.add('oculto');
        btnPartido.style.backgroundColor = '#333'; btnHistorial.style.backgroundColor = '#888'; btnTemporada.style.backgroundColor = '#888'; btnAdmin.style.backgroundColor = '#888';
    });

    btnHistorial.addEventListener('click', () => {
        secPartido.classList.add('oculto'); secHistorial.classList.remove('oculto'); secTemporada.classList.add('oculto'); secAdmin.classList.add('oculto');
        btnPartido.style.backgroundColor = '#888'; btnHistorial.style.backgroundColor = '#333'; btnTemporada.style.backgroundColor = '#888'; btnAdmin.style.backgroundColor = '#888';
        cargarHistorial(); 
    });

    btnTemporada.addEventListener('click', () => {
        secPartido.classList.add('oculto'); secHistorial.classList.add('oculto'); secTemporada.classList.remove('oculto'); secAdmin.classList.add('oculto');
        btnPartido.style.backgroundColor = '#888'; btnHistorial.style.backgroundColor = '#888'; btnTemporada.style.backgroundColor = '#333'; btnAdmin.style.backgroundColor = '#888';
    });

    btnAdmin.addEventListener('click', () => {
        secPartido.classList.add('oculto'); secHistorial.classList.add('oculto'); secTemporada.classList.add('oculto'); secAdmin.classList.remove('oculto');
        btnPartido.style.backgroundColor = '#888'; btnHistorial.style.backgroundColor = '#888'; btnTemporada.style.backgroundColor = '#888'; btnAdmin.style.backgroundColor = '#333';
    });
}

function configurarAdmin() {
    const btnGuardarEquipo = document.getElementById('btn-team');
    const btnGuardarJugador = document.getElementById('btn-player');

    if(btnGuardarEquipo) {
        btnGuardarEquipo.addEventListener('click', async () => {
            const nombreEquipo = document.getElementById('admin-nombre-equipo').value.trim();
            if (!nombreEquipo) { alert("Escribe el nombre del equipo."); return; }
            btnGuardarEquipo.textContent = "Guardando...";
            const { error } = await clienteSupabase.from('equipos').insert([{ nombre: nombreEquipo }]);
            btnGuardarEquipo.textContent = "Guardar Equipo";
            if (error) alert("Error: " + error.message);
            else { alert("¡Guardado!"); document.getElementById('admin-nombre-equipo').value = ''; await cargarEquipos(); }
        });
    }

    if(btnGuardarJugador) {
        btnGuardarJugador.addEventListener('click', async () => {
            const equipoId = document.getElementById('admin-select-equipo').value;
            const nombreJugador = document.getElementById('admin-nombre-jugador').value.trim();
            const numeroJugador = document.getElementById('admin-numero-jugador').value.trim();

            if (!equipoId || !nombreJugador || !numeroJugador) { alert("Llena todos los campos."); return; }
            btnGuardarJugador.textContent = "Guardando...";
            const nuevoJugador = { equipo_id: parseInt(equipoId), nombre: nombreJugador, numero: parseInt(numeroJugador) };
            const { error } = await clienteSupabase.from('jugadores').insert([nuevoJugador]);
            btnGuardarJugador.textContent = "Registrar Jugador";

            if (error) alert("Error: " + error.message);
            else {
                alert("¡Registrado!");
                document.getElementById('admin-nombre-jugador').value = '';
                document.getElementById('admin-numero-jugador').value = '';
                cargarJugadoresGlobales(); 
            }
        });
    }
}

async function cargarEquipos() {
    const { data, error } = await clienteSupabase.from('equipos').select('*');
    if (error) return;

    const selectLocal = document.getElementById('select-local');
    const selectVisitante = document.getElementById('select-visitante');
    const selectAdmin = document.getElementById('admin-select-equipo'); 
    
    if(selectLocal && selectVisitante) {
        selectLocal.innerHTML = '<option value="">Selecciona Local...</option>';
        selectVisitante.innerHTML = '<option value="">Selecciona Visitante...</option>';
        data.forEach(e => {
            selectLocal.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
            selectVisitante.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
        });
    }

    if(selectAdmin) {
        selectAdmin.innerHTML = '<option value="">Selecciona equipo...</option>';
        data.forEach(e => selectAdmin.innerHTML += `<option value="${e.id}">${e.nombre}</option>`);
    }
}

function actualizarFiltroEquipos(idLocal, nombreLocal, idVisitante, nombreVisitante) {
    const selectEquipo = document.getElementById('filtro-equipo');
    if(selectEquipo) {
        selectEquipo.innerHTML = '<option value="todos">Ambos Equipos</option>';
        selectEquipo.innerHTML += `<option value="${idLocal}">${nombreLocal} (Local)</option>`;
        selectEquipo.innerHTML += `<option value="${idVisitante}">${nombreVisitante} (Visitante)</option>`;
    }
}

function configurarHistorial() {
    const btnAct = document.getElementById('btn-actualizar-historial');
    if (btnAct) btnAct.addEventListener('click', cargarHistorial);
}

async function cargarHistorial() {
    const tbody = document.getElementById('tabla-historial');
    if(!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" style="padding:15px;">Buscando partidos...</td></tr>';

    const { data: equipos, error: errEq } = await clienteSupabase.from('equipos').select('id, nombre');
    const { data: partidos, error: errPart } = await clienteSupabase.from('partidos').select('*').order('id', { ascending: false });

    if (errPart || errEq) {
        tbody.innerHTML = `<tr><td colspan="7" style="color:red;">Error al cargar.</td></tr>`;
        return;
    }
    if (partidos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="padding:15px;">Aún no se han registrado partidos.</td></tr>';
        return;
    }

    const mapEquipos = Object.fromEntries(equipos.map(e => [e.id, e.nombre]));
    tbody.innerHTML = '';

    partidos.forEach(p => {
        const nombreLocal = mapEquipos[p.equipo_local_id] || `Equipo ${p.equipo_local_id}`;
        const nombreVisitante = mapEquipos[p.equipo_visitante_id] || `Equipo ${p.equipo_visitante_id}`;
        
        // Limpiando la fecha para que no se vea el timestamp largo de la base de datos
        const fechaCruda = p.fecha ? p.fecha : '-';
        const fechaLimpia = fechaCruda !== '-' ? fechaCruda.split('T')[0] : '-';

        const torneoMostrar = p.torneo ? p.torneo : '-';
        const canchaMostrar = p.cancha ? p.cancha : '-';

        tbody.innerHTML += `
            <tr>
                <td style="padding: 12px; font-weight: bold;"># ${p.id}</td>
                <td>${fechaLimpia}</td>
                <td>${torneoMostrar}</td>
                <td>${canchaMostrar}</td>
                <td>${nombreLocal}</td>
                <td>${nombreVisitante}</td>
                <td>
                    <button class="btn btn-ver-historico" data-id="${p.id}" style="background-color: #17a2b8; padding: 6px 12px; font-size: 0.9em; margin: 0;">
                        📊 Ver Box Score
                    </button>
                </td>
            </tr>
        `;
    });

    document.querySelectorAll('.btn-ver-historico').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idSeleccionado = e.target.getAttribute('data-id');
            abrirDashboardHistorico(idSeleccionado);
        });
    });
}

async function abrirDashboardHistorico(id) {
    partidoActualId = parseInt(id);
    document.getElementById('lbl-partido-id').textContent = partidoActualId;
    origenDashboard = 'historial'; 

    const { data: partido } = await clienteSupabase.from('partidos').select('equipo_local_id, equipo_visitante_id').eq('id', partidoActualId).single();
    if (partido) {
        const { data: equipos } = await clienteSupabase.from('equipos').select('id, nombre').in('id', [partido.equipo_local_id, partido.equipo_visitante_id]);
        if (equipos) {
            const eqLocal = equipos.find(e => e.id == partido.equipo_local_id);
            const eqVis = equipos.find(e => e.id == partido.equipo_visitante_id);
            if(eqLocal && eqVis) actualizarFiltroEquipos(eqLocal.id, eqLocal.nombre, eqVis.id, eqVis.nombre);
        }
    }

    document.getElementById('seccion-historial').classList.add('oculto');
    document.getElementById('seccion-partido').classList.remove('oculto');
    document.getElementById('panel-configuracion').classList.add('oculto');
    document.getElementById('panel-captura').classList.add('oculto');
    document.getElementById('panel-dashboard').classList.remove('oculto');
    
    if(document.getElementById('filtro-jugador')) document.getElementById('filtro-jugador').value = 'todos';
    if(document.getElementById('filtro-periodo-dash')) document.getElementById('filtro-periodo-dash').value = 'todos';
    if(document.getElementById('filtro-equipo')) document.getElementById('filtro-equipo').value = 'todos'; 
    
    cargarEstadisticas();
}

function configurarReloj() {
    const btnToggle = document.getElementById('btn-toggle-reloj');
    const pantalla = document.getElementById('pantalla-reloj');
    const selectPeriodo = document.getElementById('select-periodo');

    if(!btnToggle || !pantalla) return;

    function actualizarPantalla() {
        let min = Math.floor(tiempoRestante / 60);
        let seg = tiempoRestante % 60;
        pantalla.textContent = `${min.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}`;
    }

    btnToggle.addEventListener('click', () => {
        if (tiempoRestante <= 0) return; 

        if (intervaloReloj) {
            clearInterval(intervaloReloj);
            intervaloReloj = null;
            pantalla.classList.add('reloj-pausado');
            btnToggle.innerHTML = '▶ Play';
            btnToggle.style.backgroundColor = '#28a745';
        } else {
            pantalla.classList.remove('reloj-pausado');
            btnToggle.innerHTML = '⏸ Pausa';
            btnToggle.style.backgroundColor = '#dc3545'; 
            
            intervaloReloj = setInterval(() => {
                tiempoRestante--;
                actualizarPantalla();
                if (tiempoRestante <= 0) {
                    clearInterval(intervaloReloj);
                    intervaloReloj = null;
                    pantalla.classList.add('reloj-pausado');
                    btnToggle.innerHTML = '▶ Play';
                    btnToggle.style.backgroundColor = '#28a745';
                    alert("¡FIN DEL PERIODO!");
                }
            }, 1000);
        }
    });

    if(selectPeriodo) {
        selectPeriodo.addEventListener('change', () => {
            if (intervaloReloj) { clearInterval(intervaloReloj); intervaloReloj = null; }
            tiempoRestante = minutosPorCuarto * 60;
            actualizarPantalla();
            pantalla.classList.add('reloj-pausado');
            btnToggle.innerHTML = '▶ Play';
            btnToggle.style.backgroundColor = '#28a745';
        });
    }
}

function configurarBotonIniciar() {
    const btnIniciar = document.getElementById('btn-iniciar-partido');
    if(!btnIniciar) return;

    btnIniciar.addEventListener('click', async () => {
        const idLocal = document.getElementById('select-local').value;
        const idVisitante = document.getElementById('select-visitante').value;
        const configMinutos = document.getElementById('config-minutos') ? document.getElementById('config-minutos').value : "12"; 
        
        const inFecha = document.getElementById('config-fecha') ? document.getElementById('config-fecha').value : null;
        const inTorneo = document.getElementById('config-torneo') ? document.getElementById('config-torneo').value.trim() : "";
        const inCancha = document.getElementById('config-cancha') ? document.getElementById('config-cancha').value.trim() : "";

        if (!idLocal || !idVisitante || idLocal === idVisitante) {
            alert("Por favor selecciona dos equipos diferentes."); return;
        }

        minutosPorCuarto = parseInt(configMinutos);
        tiempoRestante = minutosPorCuarto * 60;
        let minStr = configMinutos.padStart(2, '0');
        
        const pantallaReloj = document.getElementById('pantalla-reloj');
        if(pantallaReloj) pantallaReloj.textContent = `${minStr}:00`;

        const nombreLocal = document.getElementById('select-local').options[document.getElementById('select-local').selectedIndex].text;
        const nombreVisitante = document.getElementById('select-visitante').options[document.getElementById('select-visitante').selectedIndex].text;
        
        const tituloLocal = document.getElementById('titulo-equipo-local');
        if(tituloLocal) tituloLocal.textContent = nombreLocal;
        const tituloVisitante = document.getElementById('titulo-equipo-visitante');
        if(tituloVisitante) tituloVisitante.textContent = nombreVisitante;
        
        const lblNombreLocal = document.getElementById('nombre-score-local');
        if(lblNombreLocal) lblNombreLocal.textContent = nombreLocal;
        const lblNombreVisit = document.getElementById('nombre-score-visitante');
        if(lblNombreVisit) lblNombreVisit.textContent = nombreVisitante;
        
        scorePuntosLocal = 0; scorePuntosVisitante = 0;
        if(document.getElementById('score-local')) document.getElementById('score-local').textContent = "0";
        if(document.getElementById('score-visitante')) document.getElementById('score-visitante').textContent = "0";

        actualizarFiltroEquipos(idLocal, nombreLocal, idVisitante, nombreVisitante);

        const nuevoPartido = { 
            equipo_local_id: idLocal, 
            equipo_visitante_id: idVisitante,
            fecha: inFecha,
            torneo: inTorneo,
            cancha: inCancha
        };

        const { data, error } = await clienteSupabase.from('partidos').insert([nuevoPartido]).select();
        if (error) { alert("Error al crear partido: " + error.message); return; }

        partidoActualId = data[0].id;
        
        const lblPartidoId = document.getElementById('lbl-partido-id');
        if(lblPartidoId) lblPartidoId.textContent = partidoActualId;
        
        document.getElementById('panel-configuracion').classList.add('oculto');
        document.getElementById('panel-captura').classList.remove('oculto');

        cargarJugadoresDelPartido(idLocal, idVisitante);
    });
}

function crearBotonJugadorDOM(jugador, esCancha) {
    const btn = document.createElement('button');
    btn.className = 'btn-jugador';
    btn.textContent = `${jugador.nombre} (#${jugador.numero})`;
    btn.dataset.id = jugador.id;
    btn.dataset.estado = esCancha ? 'cancha' : 'banca'; 

    btn.addEventListener('click', () => {
        const accionesTiro = document.getElementById('acciones-tiro');
        if(accionesTiro) accionesTiro.classList.add('oculto');
        const menuAsist = document.getElementById('menu-asistencia');
        if(menuAsist) menuAsist.classList.add('oculto'); 

        if (btn.dataset.estado === 'banca') {
            document.querySelectorAll('.btn-jugador').forEach(b => b.classList.remove('listo-cambio'));
            btn.classList.add('listo-cambio');
            jugadorBancaListoParaCambio = btn;
            return;
        }

        if (btn.dataset.estado === 'cancha' && jugadorBancaListoParaCambio) {
            const contenedorBanca = jugadorBancaListoParaCambio.parentElement;
            const contenedorCancha = btn.parentElement;

            btn.dataset.estado = 'banca';
            btn.classList.remove('activo');
            jugadorBancaListoParaCambio.dataset.estado = 'cancha';
            jugadorBancaListoParaCambio.classList.remove('listo-cambio');

            contenedorBanca.appendChild(btn); 
            contenedorCancha.appendChild(jugadorBancaListoParaCambio); 

            jugadorBancaListoParaCambio = null;
            jugadorSeleccionadoEnCancha = null;
            return;
        }

        if (btn.dataset.estado === 'cancha' && !jugadorBancaListoParaCambio) {
            document.querySelectorAll('.btn-jugador').forEach(b => b.classList.remove('activo', 'listo-cambio'));
            btn.classList.add('activo');
            jugadorSeleccionadoEnCancha = jugador.id;
        }
    });

    return btn;
}

async function cargarJugadoresDelPartido(idLocal, idVisitante) {
    const gridLocalCancha = document.getElementById('grid-local-cancha');
    const gridLocalBanca = document.getElementById('grid-local-banca');
    const gridVisitanteCancha = document.getElementById('grid-visitante-cancha');
    const gridVisitanteBanca = document.getElementById('grid-visitante-banca');
    const selectorFiltro = document.getElementById('filtro-jugador'); 
    
    if(!gridLocalCancha) return;

    const { data, error } = await clienteSupabase.from('jugadores').select('*, equipos(nombre)').in('equipo_id', [idLocal, idVisitante]);
    if (error) return console.error("Error jugadores:", error);

    gridLocalCancha.innerHTML = ''; gridLocalBanca.innerHTML = '';
    gridVisitanteCancha.innerHTML = ''; gridVisitanteBanca.innerHTML = '';
    if(selectorFiltro) selectorFiltro.innerHTML = '<option value="todos">Todos los jugadores</option>'; 
    
    jugadorSeleccionadoEnCancha = null; 
    jugadorBancaListoParaCambio = null;

    let locales = data.filter(j => j.equipo_id == idLocal);
    let visitantes = data.filter(j => j.equipo_id == idVisitante);

    locales.forEach((jugador, index) => {
        if(selectorFiltro) selectorFiltro.innerHTML += `<option value="${jugador.id}">${jugador.nombre} (#${jugador.numero})</option>`;
        let esCancha = index < 5;
        let btn = crearBotonJugadorDOM(jugador, esCancha);
        if (esCancha) gridLocalCancha.appendChild(btn); else gridLocalBanca.appendChild(btn);
    });

    visitantes.forEach((jugador, index) => {
        if(selectorFiltro) selectorFiltro.innerHTML += `<option value="${jugador.id}">${jugador.nombre} (#${jugador.numero})</option>`;
        let esCancha = index < 5;
        let btn = crearBotonJugadorDOM(jugador, esCancha);
        if (esCancha) gridVisitanteCancha.appendChild(btn); else gridVisitanteBanca.appendChild(btn);
    });
}

function configurarCancha() {
    const cancha = document.getElementById('cancha');
    const panelTiro = document.getElementById('acciones-tiro');
    const menuAsist = document.getElementById('menu-asistencia');

    if(!cancha) return;

    cancha.addEventListener('click', function(event) {
        if (!jugadorSeleccionadoEnCancha) { 
            alert("¡Primero selecciona un jugador EN CANCHA!"); return; 
        }

        const rect = cancha.getBoundingClientRect();
        tiroActual.x = ((event.clientX - rect.left) / rect.width * 100).toFixed(1);
        tiroActual.y = ((event.clientY - rect.top) / rect.height * 100).toFixed(1);

        const svgX = (tiroActual.x / 100) * 500;
        const svgY = (tiroActual.y / 100) * 470;
        let puntosCalculados = 2; 

        if (svgY >= 290) {
            if (svgX < 45 || svgX > 455) puntosCalculados = 3;
        } else {
            const dX = svgX - 250;
            const dY = svgY - 355;
            if (Math.sqrt(dX * dX + dY * dY) > 215) puntosCalculados = 3;
        }

        const selectPuntos = document.getElementById('select-puntos');
        if(selectPuntos) selectPuntos.value = puntosCalculados;

        cancha.querySelectorAll('.marcador-tiro').forEach(e => e.remove());
        const marcador = document.createElement('div');
        marcador.className = 'marcador-tiro';
        marcador.style.left = tiroActual.x + '%';
        marcador.style.top = tiroActual.y + '%';
        cancha.appendChild(marcador);

        if(menuAsist) menuAsist.classList.add('oculto');
        if(panelTiro) {
            panelTiro.classList.remove('oculto');
            let posX = event.clientX - rect.left + 15; 
            let posY = event.clientY - rect.top + 15;
            if (posX + 170 > rect.width) posX = rect.width - 175;
            if (posY + 120 > rect.height) posY = rect.height - 125;
            panelTiro.style.left = posX + 'px';
            panelTiro.style.top = posY + 'px';
        }
    });
}

function configurarBotonesTiroFlotante() {
    const btnAcierto = document.getElementById('btn-acierto');
    const btnFallo = document.getElementById('btn-fallo');
    const panelTiro = document.getElementById('acciones-tiro');

    if(!btnAcierto || !btnFallo) return;

    const registrarTiro = async (esAcierto) => {
        const idJugador = jugadorSeleccionadoEnCancha; 
        const periodoActual = document.getElementById('select-periodo').value; 

        if (!idJugador) return; 

        const valorPuntos = parseInt(document.getElementById('select-puntos').value);
        if(valorPuntos === 1) { alert("Error: Use los botones TL para tiros libres."); return;}

        const nuevoEvento = {
            partido_id: partidoActualId, 
            jugador_id: parseInt(idJugador), 
            tipo_evento: 'Tiro', 
            resultado: esAcierto ? 'Acierto' : 'Fallo', 
            coord_x: parseFloat(tiroActual.x), 
            coord_y: parseFloat(tiroActual.y), 
            puntos: valorPuntos,
            periodo: periodoActual 
        };

        const btnOriginal = esAcierto ? btnAcierto.textContent : btnFallo.textContent;
        if(esAcierto) btnAcierto.textContent = "..."; else btnFallo.textContent = "...";

        const { error } = await clienteSupabase.from('eventos').insert([nuevoEvento]);
        if(esAcierto) btnAcierto.textContent = btnOriginal; else btnFallo.textContent = btnOriginal;

        if (error) { alert("Error: " + error.message); return; }

        if (esAcierto) {
            const btnAnotador = document.querySelector(`.btn-jugador[data-id="${idJugador}"]`);
            if(btnAnotador) {
                const esLocal = btnAnotador.closest('#grid-local-cancha') !== null;
                if (esLocal) {
                    scorePuntosLocal += valorPuntos;
                    const lblScoreL = document.getElementById('score-local');
                    if(lblScoreL) lblScoreL.textContent = scorePuntosLocal;
                } else {
                    scorePuntosVisitante += valorPuntos;
                    const lblScoreV = document.getElementById('score-visitante');
                    if(lblScoreV) lblScoreV.textContent = scorePuntosVisitante;
                }
            }
        }

        if(panelTiro) panelTiro.classList.add('oculto');
        document.getElementById('cancha').querySelectorAll('.marcador-tiro').forEach(e => e.remove());

        if (esAcierto) {
            mostrarMenuAsistencia(idJugador);
        } else {
            finalizarFlujoCaptura(`Tiro Campo Falla guardado ✔️`);
        }
    };

    btnAcierto.addEventListener('click', () => registrarTiro(true));
    btnFallo.addEventListener('click', () => registrarTiro(false));
}

function mostrarMenuAsistencia(idAnotador) {
    const menuAsistencia = document.getElementById('menu-asistencia');
    const listaAsistencias = document.getElementById('lista-asistencias');
    const panelTiroViejo = document.getElementById('acciones-tiro');
    
    if(!menuAsistencia || !listaAsistencias || !panelTiroViejo) { finalizarFlujoCaptura(`Tiro guardado ✔️`); return; }

    listaAsistencias.innerHTML = '';
    const btnAnotador = document.querySelector(`.btn-jugador[data-id="${idAnotador}"]`);
    if(!btnAnotador) { finalizarFlujoCaptura(`Tiro guardado ✔️`); return; }

    const contenedorEquipo = btnAnotador.closest('.zona-cancha');
    const companeros = contenedorEquipo.querySelectorAll(`.btn-jugador:not([data-id="${idAnotador}"])`);
    
    companeros.forEach(comp => {
        const btnAst = document.createElement('button');
        btnAst.className = 'btn-asist';
        btnAst.textContent = comp.textContent;
        
        btnAst.addEventListener('click', async () => {
            menuAsistencia.classList.add('oculto');
            await clienteSupabase.from('eventos').insert([{
                partido_id: partidoActualId, jugador_id: parseInt(comp.dataset.id), tipo_evento: 'Asistencia',
                resultado: 'Exitosa', coord_x: null, coord_y: null, puntos: 0,
                periodo: document.getElementById('select-periodo').value
            }]);
            finalizarFlujoCaptura(`¡Acierto y Asistencia Guardados! ✔️`);
        });
        listaAsistencias.appendChild(btnAst);
    });

    menuAsistencia.style.left = panelTiroViejo.style.left;
    menuAsistencia.style.top = panelTiroViejo.style.top;
    menuAsistencia.classList.remove('oculto');

    const btnSin = document.getElementById('btn-sin-asistencia');
    if(btnSin) {
        const nuevoBtnSin = btnSin.cloneNode(true);
        btnSin.parentNode.replaceChild(nuevoBtnSin, btnSin);
        nuevoBtnSin.addEventListener('click', () => {
            menuAsistencia.classList.add('oculto');
            finalizarFlujoCaptura(`Tiro sin asistencia guardado ✔️`);
        });
    }
}

function finalizarFlujoCaptura(mensaje) {
    const estado = document.getElementById('estado-conexion');
    if(estado) { estado.textContent = mensaje; estado.style.color = "blue"; }
    document.querySelectorAll('.btn-jugador').forEach(b => b.classList.remove('activo'));
    jugadorSeleccionadoEnCancha = null;
    setTimeout(() => { if(estado){estado.textContent = "Conectado. Registro en Vivo."; estado.style.color = "green";} }, 1500);
}

function configurarAccionesRapidas() {
    const botones = document.querySelectorAll('.btn-accion');
    
    botones.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const idJugador = jugadorSeleccionadoEnCancha; 
            const selectPeriodo = document.getElementById('select-periodo');
            const periodoActual = selectPeriodo ? selectPeriodo.value : "Q1"; 
            
            if (!idJugador) { alert("¡Toca el botón de un jugador EN CANCHA primero!"); return; }

            const tipo = e.target.getAttribute('data-tipo');
            const res = e.target.getAttribute('data-res');

            let coordXEnvio = null; let coordYEnvio = null; let puntosEnvio = 0;

            if (tipo === 'TL') {
                coordXEnvio = 50.0; coordYEnvio = 59.6; puntosEnvio = 1; 
                const cancha = document.getElementById('cancha');
                if (cancha) {
                    cancha.querySelectorAll('.marcador-tiro').forEach(el => el.remove());
                    const marcadorTL = document.createElement('div');
                    if (res === 'Acierto') { marcadorTL.className = 'marcador-tiro'; marcadorTL.style.backgroundColor = '#28a745'; } 
                    else { marcadorTL.className = 'marcador-shotchart fallo-pequeno'; marcadorTL.style.position = 'absolute'; }
                    marcadorTL.style.left = coordXEnvio + '%'; marcadorTL.style.top = coordYEnvio + '%';
                    cancha.appendChild(marcadorTL);
                }
            }

            const nuevoEvento = {
                partido_id: partidoActualId, jugador_id: parseInt(idJugador), tipo_evento: tipo, resultado: res,
                coord_x: coordXEnvio, coord_y: coordYEnvio, puntos: puntosEnvio, periodo: periodoActual 
            };

            const btnText = e.target.textContent; e.target.textContent = "...";
            const { error } = await clienteSupabase.from('eventos').insert([nuevoEvento]);
            e.target.textContent = btnText;

            if (error) { alert("Error: " + error.message); } 
            else {
                if(document.getElementById('acciones-tiro')) document.getElementById('acciones-tiro').classList.add('oculto');
                if(document.getElementById('menu-asistencia')) document.getElementById('menu-asistencia').classList.add('oculto');

                if(tipo === 'TL' && res === 'Acierto') {
                    const btnAnotador = document.querySelector(`.btn-jugador[data-id="${idJugador}"]`);
                    if (btnAnotador) {
                        const esLocal = btnAnotador.closest('#grid-local-cancha') !== null;
                        if (esLocal) {
                            scorePuntosLocal += 1;
                            if(document.getElementById('score-local')) document.getElementById('score-local').textContent = scorePuntosLocal;
                        } else {
                            scorePuntosVisitante += 1;
                            if(document.getElementById('score-visitante')) document.getElementById('score-visitante').textContent = scorePuntosVisitante;
                        }
                    }
                }
                finalizarFlujoCaptura(`¡${tipo} Guardado ✔️!`);
            }
        });
    });
}

function configurarDashboard() {
    const btnVerStats = document.getElementById('btn-ver-estadisticas');
    const btnVolver = document.getElementById('btn-volver-cancha');
    const panelCaptura = document.getElementById('panel-captura');
    const panelDashboard = document.getElementById('panel-dashboard');
    const secHistorial = document.getElementById('seccion-historial');
    const secPartido = document.getElementById('seccion-partido');
    
    const filtroJugador = document.getElementById('filtro-jugador');
    const filtroPeriodo = document.getElementById('filtro-periodo-dash'); 
    const filtroEquipo = document.getElementById('filtro-equipo'); 

    if(btnVerStats && btnVolver) {
        btnVerStats.addEventListener('click', async () => {
            origenDashboard = 'captura'; 
            panelCaptura.classList.add('oculto');
            panelDashboard.classList.remove('oculto');
            if(filtroJugador) filtroJugador.value = 'todos'; 
            if(filtroPeriodo) filtroPeriodo.value = 'todos'; 
            if(filtroEquipo) filtroEquipo.value = 'todos';
            setTimeout(cargarEstadisticas, 100);
        });

        btnVolver.addEventListener('click', () => {
            panelDashboard.classList.add('oculto');
            if (origenDashboard === 'historial') {
                secPartido.classList.add('oculto');
                secHistorial.classList.remove('oculto');
            } else {
                panelCaptura.classList.remove('oculto');
            }
        });
    }

    if(filtroJugador) filtroJugador.addEventListener('change', cargarEstadisticas);
    if(filtroPeriodo) filtroPeriodo.addEventListener('change', cargarEstadisticas);
    if(filtroEquipo) filtroEquipo.addEventListener('change', cargarEstadisticas); 
}

function procesarEstadisticasMaster(rawEvents) {
    const resumen = {};
    rawEvents.forEach(ev => {
        const idJugador = ev.jugador_id;
        if (!resumen[idJugador]) {
            resumen[idJugador] = {
                jugador_id: idJugador, puntos: 0,
                TC_A: 0, TC_C: 0, 
                '2P_A': 0, '2P_C': 0,
                '3P_A': 0, '3P_C': 0,
                TL_A: 0, TL_C: 0, 
                rebOfensivos: 0, rebDefensivos: 0, asistencias: 0, robos: 0, perdidas: 0, faltas: 0
            };
        }
        
        const stats = resumen[idJugador];
        const esAcierto = ev.resultado === 'Acierto';

        if (ev.tipo_evento === 'Tiro') {
            stats.TC_A++;
            if (esAcierto) {
                stats.puntos += ev.puntos;
                stats.TC_C++;
                if (ev.puntos === 2) { stats['2P_A']++; stats['2P_C']++; }
                else if (ev.puntos === 3) { stats['3P_A']++; stats['3P_C']++; }
            } else {
                const svgY = (ev.coord_y / 100) * 470;
                if (svgY >= 315) { stats['2P_A']++; } 
                else { stats['3P_A']++; } 
            }
        } 
        else if (ev.tipo_evento === 'TL') {
            stats.TL_A++;
            if (esAcierto) { stats.puntos += 1; stats.TL_C++; }
        }
        else if (ev.tipo_evento === 'Rebote') { if (ev.resultado === 'Ofensivo') stats.rebOfensivos++; else stats.rebDefensivos++; }
        else if (ev.tipo_evento === 'Asistencia') stats.asistencias++;
        else if (ev.tipo_evento === 'Robo') stats.robos++;
        else if (ev.tipo_evento === 'Perdida') stats.perdidas++;
        else if (ev.tipo_evento === 'Falta') stats.faltas++;
    });
    return resumen;
}

async function cargarEstadisticas() {
    const tbody = document.getElementById('tabla-estadisticas-cuerpo');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="15" style="padding:15px;">Calculando estadísticas avanzadas...</td></tr>';

    const selectorJugador = document.getElementById('filtro-jugador');
    const selectorPeriodo = document.getElementById('filtro-periodo-dash');
    const selectorEquipo = document.getElementById('filtro-equipo'); 
    
    const idJugadorFiltro = selectorJugador ? selectorJugador.value : 'todos';
    const periodoFiltro = selectorPeriodo ? selectorPeriodo.value : 'todos'; 
    const equipoFiltro = selectorEquipo ? selectorEquipo.value : 'todos'; 

    const { data: roster, error: errRoster } = await clienteSupabase.from('jugadores').select('id, nombre, numero, equipo_id');
    const mapeoEquipos = {};
    const mapeoNombres = {};
    if (roster) {
        roster.forEach(j => {
            mapeoEquipos[j.id] = j.equipo_id;
            mapeoNombres[j.id] = `${j.nombre} (#${j.numero})`;
        });
    }

    let queryRaw = clienteSupabase.from('eventos').select('*').eq('partido_id', partidoActualId);

    if (idJugadorFiltro !== 'todos') { queryRaw = queryRaw.eq('jugador_id', idJugadorFiltro); }
    if (periodoFiltro !== 'todos') { queryRaw = queryRaw.eq('periodo', periodoFiltro); }

    const [respRaw] = await Promise.all([queryRaw]);
    if (respRaw.error) { return; }
    
    let rawEventsData = respRaw.data;

    if (equipoFiltro !== 'todos') {
        rawEventsData = rawEventsData.filter(ev => mapeoEquipos[ev.jugador_id] == equipoFiltro);
    }

    if (rawEventsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="15" style="padding:15px;">No hay datos para este filtro.</td></tr>';
        document.getElementById('contenedor-shotchart').innerHTML = '';
        document.getElementById('contenedor-zonas').innerHTML = ''; 
        if(heatmapInstanceMatch) heatmapInstanceMatch.setData({ max: 1, data: [] });
        document.getElementById('contenedor-tarjetas').classList.add('oculto');
        return;
    }

    const resumenJugadores = procesarEstadisticasMaster(rawEventsData);
    
    let globalTC_A = 0, globalTC_C = 0, global3P_C = 0, globalPTS = 0;
    let globalAST = 0, globalTO = 0, globalREB = 0;

    Object.values(resumenJugadores).forEach(st => {
        globalTC_A += st.TC_A; globalTC_C += st.TC_C; global3P_C += st['3P_C'];
        globalPTS += st.puntos; globalAST += st.asistencias; globalTO += st.perdidas;
        globalREB += (st.rebOfensivos + st.rebDefensivos);
    });

    const global_eFG = globalTC_A > 0 ? (((globalTC_C + (0.5 * global3P_C)) / globalTC_A) * 100).toFixed(1) : "0.0";
    const global_PPS = globalTC_A > 0 ? (globalPTS / globalTC_A).toFixed(2) : "0.00";
    const global_AST_RATIO = globalTO > 0 ? (globalAST / globalTO).toFixed(2) : globalAST.toFixed(1);

    document.getElementById('global-efg').textContent = global_eFG + '%';
    document.getElementById('global-pps').textContent = global_PPS;
    document.getElementById('global-ast-ratio').textContent = global_AST_RATIO;
    document.getElementById('global-reb-ratio').textContent = globalREB;
    
    document.getElementById('contenedor-tarjetas').classList.remove('oculto');

    dibujarTablaAvanzada(tbody, resumenJugadores, mapeoNombres);

    const soloTirosVisuales = rawEventsData.filter(ev => (ev.tipo_evento === 'Tiro' || ev.tipo_evento === 'TL') && ev.coord_x !== null);
    
    renderizarShotChart(soloTirosVisuales, 'contenedor-shotchart');
    heatmapInstanceMatch = renderizarHeatmap(soloTirosVisuales, 'contenedor-heatmap', heatmapInstanceMatch);
    renderizarZonas(soloTirosVisuales, 'contenedor-zonas');
}

async function dibujarTablaAvanzada(tbody, resumenJugadores, mapeoNombres) {
    tbody.innerHTML = '';
    
    const listaJugadores = Object.values(resumenJugadores).sort((a,b) => b.puntos - a.puntos);
    if (listaJugadores.length === 0) { tbody.innerHTML = '<tr><td colspan="15">No hay datos.</td></tr>'; return; }

    listaJugadores.forEach(stats => {
        const nombreJugador = mapeoNombres[stats.jugador_id] || `Jugador ${stats.jugador_id}`;
        const calcPercent = (c, a) => a > 0 ? ((c / a) * 100).toFixed(1) : "0.0";
        const totalRebotes = stats.rebOfensivos + stats.rebDefensivos;
        const pt_TL = calcPercent(stats.TL_C, stats.TL_A);
        const pt_2P = calcPercent(stats['2P_C'], stats['2P_A']);
        const pt_3P = calcPercent(stats['3P_C'], stats['3P_A']);
        const pt_TC = calcPercent(stats.TC_C, stats.TC_A);
        
        const intentosCampo = stats.TC_A;
        const eFG = intentosCampo > 0 ? (((stats.TC_C + (0.5 * stats['3P_C'])) / intentosCampo) * 100).toFixed(1) : "0.0";
        const pps = intentosCampo > 0 ? (stats.puntos / intentosCampo).toFixed(2) : "0.00";
        
        let colorEFG = parseFloat(eFG) >= 55.0 ? "green; font-weight:bold;" : "black";
        if(parseFloat(eFG) > 0 && parseFloat(eFG) <= 45.0) colorEFG = "red";

        tbody.innerHTML += `
            <tr>
                <td style="padding: 10px; text-align:left;"><strong>${nombreJugador}</strong></td>
                <td class="col-pts">${stats.puntos}</td>
                <td style="background-color:#fefefe;">${stats.TL_C}-${stats.TL_A}</td><td>${pt_TL}%</td>
                <td style="background-color:#eafaf1;">${stats['2P_C']}-${stats['2P_A']}</td><td><strong>${pt_2P}%</strong></td>
                <td style="background-color:#e9f5ff;">${stats['3P_C']}-${stats['3P_A']}</td><td><strong>${pt_3P}%</strong></td>
                <td style="background-color:#f8f9fa; border-left: 2px solid #ccc;">${pt_TC}% (${stats.TC_C}-${stats.TC_A})</td>
                <td><strong>${totalRebotes}</strong> (${stats.rebOfensivos})</td>
                <td>${stats.asistencias}</td><td>${stats.robos}</td><td>${stats.perdidas}</td><td>${stats.faltas}</td>
                <td style="background-color:#f8f9fa; color: ${colorEFG}; font-size: 1.1em; border-left: 2px solid #ccc;">${eFG}%</td>
                <td style="background-color:#eafaf1; font-weight: bold; color: #0056b3;">${pps}</td>
            </tr>
        `;
    });
}

async function cargarJugadoresGlobales() {
    const selectorTemp = document.getElementById('filtro-jugador-temporada');
    if(!selectorTemp) return;

    const { data, error } = await clienteSupabase.from('jugadores').select('*, equipos(nombre)');
    if(error) return;

    selectorTemp.innerHTML = '<option value="">Selecciona un jugador...</option>';
    data.forEach(jugador => {
        selectorTemp.innerHTML += `<option value="${jugador.id}">${jugador.nombre} - ${jugador.equipos.nombre}</option>`;
    });

    selectorTemp.addEventListener('change', async (e) => {
        const idJugador = e.target.value;
        const panelRes = document.getElementById('panel-resultados-temporada');
        
        if(!idJugador) { panelRes.classList.add('oculto'); return; }

        panelRes.classList.remove('oculto');
        document.getElementById('tabla-temporada').innerHTML = '<tr><td colspan="7">Cargando...</td></tr>';
        
        const { data: eventosJugador, error } = await clienteSupabase.from('eventos').select('*').eq('jugador_id', idJugador);

        if (error || eventosJugador.length === 0) {
            document.getElementById('tabla-temporada').innerHTML = '<tr><td colspan="7">No hay datos.</td></tr>';
            document.getElementById('contenedor-shotchart-temp').innerHTML = '';
            document.getElementById('contenedor-zonas-temp').innerHTML = '';
            if(heatmapInstanceSeason) heatmapInstanceSeason.setData({ max: 1, data: [] });
            document.getElementById('temp-partidos').textContent = "0";
            return;
        }

        const partidosUnicos = new Set(eventosJugador.map(ev => ev.partido_id)).size;
        document.getElementById('temp-partidos').textContent = partidosUnicos;

        const statsBase = procesarEstadisticasMaster(eventosJugador);
        dibujarTablaTemporada(document.getElementById('tabla-temporada'), statsBase, partidosUnicos);

        const soloTirosVisuales = eventosJugador.filter(ev => ev.tipo_evento === 'Tiro' && ev.coord_x !== null);
        setTimeout(() => {
            renderizarShotChart(soloTirosVisuales, 'contenedor-shotchart-temp');
            heatmapInstanceSeason = renderizarHeatmap(soloTirosVisuales, 'contenedor-heatmap-temp', heatmapInstanceSeason);
            renderizarZonas(soloTirosVisuales, 'contenedor-zonas-temp');
        }, 100);
    });
}

async function dibujarTablaTemporada(tbody, resumenJugadores, divisorPartidos) {
    tbody.innerHTML = '';
    
    const stats = Object.values(resumenJugadores)[0];
    if(!stats) { tbody.innerHTML = '<tr><td colspan="7">No hay datos.</td></tr>'; return; }

    const calcAverage = (val) => (val / divisorPartidos).toFixed(1);
    const calcPercent = (c, a) => a > 0 ? ((c / a) * 100).toFixed(1) : "0.0";
    const totalRebotes = stats.rebOfensivos + stats.rebDefensivos;
    const eFG = stats.TC_A > 0 ? (((stats.TC_C + (0.5 * stats['3P_C'])) / stats.TC_A) * 100).toFixed(1) : "0.0";
    const colorEFG = parseFloat(eFG) >= 55.0 ? "green; font-weight:bold;" : "black";

    tbody.innerHTML += `
        <tr>
            <td style="font-size: 1.2em; font-weight: bold; padding: 15px;">${calcAverage(stats.puntos)}</td>
            <td>${calcAverage(totalRebotes)}</td>
            <td>${calcAverage(stats.asistencias)}</td>
            <td>${calcAverage(stats.robos)}</td>
            <td>${calcAverage(stats.perdidas)}</td>
            <td style="background-color: #f8f9fa;">${calcPercent(stats.TC_C, stats.TC_A)}% (${calcAverage(stats.TC_C)}C-${calcAverage(stats.TC_A)}A)</td>
            <td style="background-color: #eafaf1; color: ${colorEFG}; font-size: 1.1em;">${eFG}%</td>
        </tr>
    `;
}

function renderizarShotChart(eventosData, contenedorId) {
    const contenedor = document.getElementById(contenedorId);
    if(!contenedor) return;
    contenedor.innerHTML = ''; 

    eventosData.forEach(tiro => {
        const marcador = document.createElement('div');
        if (tiro.resultado === 'Acierto') marcador.className = 'marcador-shotchart acierto-pequeno';
        else marcador.className = 'marcador-shotchart fallo-pequeno';

        marcador.style.left = tiro.coord_x + '%';
        marcador.style.top = tiro.coord_y + '%';
        marcador.title = `${tiro.tipo_evento} de ${tiro.puntos}pt`;
        contenedor.appendChild(marcador);
    });
}

function renderizarHeatmap(eventosData, contenedorId, instanciaActual) {
    const contenedor = document.getElementById(contenedorId);
    if(!contenedor) return instanciaActual;

    if (!instanciaActual) {
        instanciaActual = h337.create({
            container: contenedor, 
            radius: 40, maxOpacity: 0.65, minOpacity: 0, blur: 0.85,          
            gradient: { '.2': 'blue', '.5': 'yellow', '.8': 'red' }
        });
    }

    const width = contenedor.offsetWidth || 500; 
    const height = contenedor.offsetHeight || (500 * 47 / 50);
    const puntosCalor = [];

    eventosData.forEach(tiro => {
        const xPx = Math.floor((tiro.coord_x / 100) * width);
        const yPx = Math.floor((tiro.coord_y / 100) * height);
        puntosCalor.push({ x: xPx, y: yPx, value: 1 });
    });

    let intensidadMaxima = 2; 
    if (eventosData.length > 10) intensidadMaxima = 3;
    if (eventosData.length > 25) intensidadMaxima = 5;

    instanciaActual.setData({ max: intensidadMaxima, data: puntosCalor });
    return instanciaActual;
}

function renderizarZonas(eventosData, contenedorId) {
    const contenedor = document.getElementById(contenedorId);
    if(!contenedor) return;
    contenedor.innerHTML = ''; 

    const zonas = {
        paint: { aciertos: 0, intentos: 0, nombre: "Pintura", xPos: 50, yPos: 78 },
        midLeft: { aciertos: 0, intentos: 0, nombre: "Mid Izq", xPos: 20, yPos: 65 },
        midCenter: { aciertos: 0, intentos: 0, nombre: "Mid Centro", xPos: 50, yPos: 45 },
        midRight: { aciertos: 0, intentos: 0, nombre: "Mid Der", xPos: 80, yPos: 65 },
        threeCornerL: { aciertos: 0, intentos: 0, nombre: "3P Esq. Izq", xPos: 8, yPos: 85 },
        threeTop: { aciertos: 0, intentos: 0, nombre: "3P Frontal", xPos: 50, yPos: 15 },
        threeCornerR: { aciertos: 0, intentos: 0, nombre: "3P Esq. Der", xPos: 92, yPos: 85 }
    };

    eventosData.forEach(tiro => {
        const x = tiro.coord_x;
        const y = tiro.coord_y;
        const esAcierto = tiro.resultado === 'Acierto' ? 1 : 0;

        const svgX = (x / 100) * 500;
        const svgY = (y / 100) * 470;
        const dX = svgX - 250;
        const dY = svgY - 355;
        const distanciaAro = Math.sqrt(dX * dX + dY * dY);

        let zonaDetectada = "";

        if (svgY >= 290 && (svgX < 45 || svgX > 455)) {
            zonaDetectada = svgX < 45 ? 'threeCornerL' : 'threeCornerR';
        } else if (distanciaAro > 215) {
            zonaDetectada = 'threeTop';
        } else if (svgX >= 170 && svgX <= 330 && svgY >= 280) {
            zonaDetectada = 'paint';
        } else {
            if (x < 35) zonaDetectada = 'midLeft';
            else if (x > 65) zonaDetectada = 'midRight';
            else zonaDetectada = 'midCenter';
        }

        if(zonas[zonaDetectada]) {
            zonas[zonaDetectada].intentos++;
            zonas[zonaDetectada].aciertos += esAcierto;
        }
    });

    for (const key in zonas) {
        const z = zonas[key];
        if (z.intentos === 0) continue; 

        const pct = ((z.aciertos / z.intentos) * 100).toFixed(0);
        let claseColor = "";
        
        if (pct >= 45) claseColor = "zona-caliente";
        else if (pct <= 33) claseColor = "zona-fria";

        const box = document.createElement('div');
        box.className = `zona-stat-box ${claseColor}`;
        box.style.left = z.xPos + '%';
        box.style.top = z.yPos + '%';
        box.innerHTML = `<span>${pct}%</span>${z.aciertos}/${z.intentos}`;
        
        contenedor.appendChild(box);
    }
}

iniciarApp();