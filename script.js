

// ============================================================
// ESTADO GLOBAL
// ============================================================
let carrito = [];
let menuData = null;
let menuConfig = null;
let descripciones = {};
let imagenes = {};
let acompanamientosConfig = { grupos: {}, productos: {} };
let productoModal = null;
let adicionalesConfig = { grupos: {}, productos: {} }; // Nueva variable


// ============================================================
// CONFIGURACIÓN DE RUTAS Wasabi
// ============================================================
const BUCKET_URL = "https://nube.menwapp.com/wasabi/json"; // Ruta principal
const BACKUP_URL = "https://apiwasabi.menwapp.com/web";       // Ruta de respaldo
const cb = `?t=${new Date().getTime()}`; 

// ============================================================
// MOTOR DE CARGA CON FALLBACK
// ============================================================
async function cargarArchivo(nombreArchivo) {
    const urlPrincipal = `${BUCKET_URL}/${nombreArchivo}${cb}`;
    const urlRespaldo = `${BACKUP_URL}/${nombreArchivo}${cb}`;

    // 1. Intentar en la ruta principal
    try {
        const res = await fetch(urlPrincipal, { mode: 'cors' });
        if (res.ok) return await res.json();
    } catch (e) {
        // Silencioso para pasar al servidor de respaldo
    }

    // 2. Intentar en la ruta de respaldo
    try {
        const resRespaldo = await fetch(urlRespaldo, { mode: 'cors' });
        if (resRespaldo.ok) {
            console.log(`✅ [RESPALDO OK] Cargado: ${nombreArchivo}`);
            return await resRespaldo.json();
        }
    } catch (e) {
        // Silencioso si tampoco está en el respaldo
    }

    return null; // Si no existe en ningún lado, retorna null sin romper Promise.all
}

// ============================================================
// INICIALIZACIÓN DE LA APP
// ============================================================
async function inicializarApp() {
    console.log("🚀 Iniciando MenWapp (Wasabi)...");

    try {
        // Carga en paralelo de los 9 archivos con sus nombres originales
        const resultados = await Promise.all([
            cargarArchivo('menu.json'),
            cargarArchivo('menu_config.json'),
            cargarArchivo('descripciones.json'),
            cargarArchivo('imagenes.json'),
            cargarArchivo('promo.json'),
            cargarArchivo('sugeridos_promo.json'),
            cargarArchivo('acompanamientos.json'),
            cargarArchivo('adicionales.json'),
            cargarArchivo('grupo1.json')
        ]);

        const [mRaw, cfg, desc, img, prm, sug, acmp, adic, grupoPrincipal] = resultados;

        // --- VALIDACIÓN FUNDAMENTAL ---
        // Únicamente exige que menu.json se haya obtenido de alguna de las 2 fuentes
        if (!mRaw || !mRaw.menu) {
            throw new Error("No se pudo obtener el menú principal de ninguna ubicación.");
        }

        // Asignación de variables con valores por defecto si los JSONs opcionales no existen
        menuData = mRaw.menu;
        window.categoriaInicial = grupoPrincipal?.nombre || Object.keys(menuData)[0];
        
        menuConfig = cfg || { horarios: {}, portada: {}, recomendados: [] };
        descripciones = desc || {};
        imagenes = img || {};
        window.productosSugeridos = sug || {};
        acompanamientosConfig = acmp || { grupos: {}, productos: {} };
        adicionalesConfig = adic || { grupos: {}, productos: {} };

        // Renderizado
        aplicarPortada();
        renderMenu();

        // Control de Horarios de atención
        if (typeof verificarHorario === 'function' && !verificarHorario()) {
            const btnFlotante = document.querySelector(".btn-carrito-flotante");
            if (btnFlotante) btnFlotante.style.display = "none";

            const ahora = new Date();
            const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
            const nombreDia = dias[ahora.getDay()];
            const configHoy = menuConfig?.horarios ? menuConfig.horarios[nombreDia] : null;

            let textoHorario = "";
            if (!configHoy || configHoy.cerrado === true || configHoy.cerrado === "True") {
                textoHorario = "Hoy nos encontramos cerrados.";
            } else if (configHoy.rangos && configHoy.rangos.length > 0) {
                const rangosTexto = configHoy.rangos.map(r => `${r.inicio} a ${r.fin}`).join(" y ");
                textoHorario = `Hoy ${nombreDia} abrimos de: ${rangosTexto}`;
            }

            document.body.insertAdjacentHTML('afterbegin', `
                <div id="aviso-cerrado" style="background:#d32f2f; color:white; text-align:center; padding:12px; font-weight:bold; position:sticky; top:0; z-index:10000; font-family: Arial, sans-serif; border-bottom: 2px solid rgba(0,0,0,0.1);">
                    <div style="font-size: 1.1em;">🌙 En este momento no tenemos servicio</div>
                    <div style="font-size: 0.9em; font-weight: normal; margin-top: 4px; opacity: 0.9;">${textoHorario}</div>
                </div>`);
        }

    } catch (error) {
        console.error("Error crítico de inicialización (Ambas rutas fallaron):", error);
        
        // --- MENSAJE AUTOMÁTICO SI FALLAN AMBAS RUTAS EN CARGAR EL MENU PRINCIPAL ---
        document.body.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; text-align:center; padding:20px; font-family: 'Poppins', sans-serif; background: #fff;">
            <h1 style="font-size: 4rem;">🍔</h1>
            <h2 style="color: #333; margin: 20px 0;">En estos momentos no tenemos servicio🍔🍔🍔:</h2>
            
            <div style="width: 100%; max-width: 800px; height: 600px; border: 2px solid #333; border-radius: 10px; overflow: hidden; background: #eee;">
                <iframe 
                    src="https://drive.google.com/file/d/1DMvgJ03AbKH13kdNR-z5xib-VpB3c7wG/preview" 
                    width="100%" 
                    height="100%" 
                    frameborder="0">
                </iframe>
            </div>
        </div>
        `;
    }
}
// ============================================================
// LÓGICA DE PRODUCTOS Y MODAL
// ============================================================
function abrirModalProducto(p) {
    productoModal = p;
    const cod = String(p.codigo).trim();

    document.getElementById("modal-nombre").innerText = p.articulo;
    document.getElementById("modal-desc").innerText = descripciones[cod] || p.descripcion || "";
    document.getElementById("modal-precio").innerText = "$" + Number(p.precio).toLocaleString();
    
    const imgModal = document.getElementById("modal-img");
    const rutaImg = imagenes[cod] || p.imagen;
    imgModal.src = rutaImg ? limpiarRuta(rutaImg) : "";
    imgModal.style.display = rutaImg ? "block" : "none";

    document.getElementById("modal-obs").value = "";
    document.getElementById("modal-cantidad").value = 1;

    const listCont = document.getElementById("modal-acompanamientos-list");
    listCont.innerHTML = "";

    // --- SECCIÓN: ACOMPAÑAMIENTOS ---
    if (acompanamientosConfig?.productos?.[cod]) {
        acompanamientosConfig.productos[cod].forEach(nombreGrupo => {
            const configGrupo = acompanamientosConfig.grupos[nombreGrupo];
            
            if (configGrupo) {
                // Soporte para formato antiguo (array) o nuevo (objeto con max y opciones)
                const opciones = Array.isArray(configGrupo) ? configGrupo : (configGrupo.opciones || []);
                const maxPermitido = configGrupo.max || 1;
                
                // Determinar el tipo de input según el límite
                const inputType = maxPermitido === 1 ? "radio" : "checkbox";
                const textoMax = maxPermitido > 1 ? ` (Máx. ${maxPermitido})` : "";

                const div = document.createElement("div");
                div.className = "seccion-grupo-acomp";
                div.innerHTML = `<h4 style="margin:15px 0 8px 0; font-size:0.9rem;">Selecciona tu ${nombreGrupo}${textoMax}:</h4>`;

                opciones.forEach((op, idx) => {
                    // Para radio selecciona el primero por defecto; para checkbox se dejan desmarcados
                    const isChecked = (inputType === "radio" && idx === 0) ? "checked" : "";

                    div.innerHTML += `
                        <label class="item-acomp" style="display:flex; align-items:center; gap:8px; margin-bottom:6px; cursor:pointer;">
                            <input type="${inputType}" 
                                   name="grupo_${nombreGrupo}" 
                                   value="${op}" 
                                   data-max="${maxPermitido}" 
                                   onchange="validarSeleccionAcomp(this)" 
                                   ${isChecked}> 
                            <span>${op}</span>
                        </label>`;
                });

                listCont.appendChild(div);
            }
        });
    }

    // --- SECCIÓN: ADICIONALES ---
    if (adicionalesConfig?.productos?.[cod]) {
        adicionalesConfig.productos[cod].forEach(nombreGrupo => {
            const opciones = adicionalesConfig.grupos[nombreGrupo];
            if (opciones) {
                const divAdic = document.createElement("div");
                divAdic.className = "seccion-adicionales";
                divAdic.innerHTML = `<h4 style="margin:20px 0 10px 0; font-size:0.9rem; border-top:1px solid #eee; padding-top:10px;">${nombreGrupo}:</h4>`;
                
                opciones.forEach(op => {
                    const productoEnMenu = encontrarProductoPorCodigo(op.codigo);
                    const precioReal = productoEnMenu ? Number(productoEnMenu.precio) : 0;

                    const itemDiv = document.createElement("div");
                    itemDiv.style = "display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; background:#f4f4f4; padding:8px 12px; border-radius:10px;";
                    itemDiv.innerHTML = `
                        <div style="display:flex; flex-direction:column;">
                            <span style="font-size:0.85rem; font-weight:600; color:#333;">${op.nombre}</span>
                            <span style="font-size:0.75rem; color:#dca600; font-weight:bold;">+$${precioReal.toLocaleString()}</span>
                        </div>
                        <div class="controles-cantidad-adic" style="display:flex; align-items:center; gap:12px;">
                            <button onclick="cambiarCantAdic(this, -1)" style="width:28px; height:28px; border-radius:50%; border:1px solid #ddd; background:#fff; cursor:pointer; font-weight:bold;">-</button>
                            <input type="number" class="input-adic" 
                                   data-codigo="${op.codigo}" 
                                   data-nombre="${op.nombre}" 
                                   data-precio="${precioReal}" 
                                   value="0" readonly 
                                   style="width:25px; text-align:center; border:none; background:transparent; font-weight:bold; font-size:0.9rem;">
                            <button onclick="cambiarCantAdic(this, 1)" style="width:28px; height:28px; border-radius:50%; border:1px solid #ddd; background:#fff; cursor:pointer; font-weight:bold;">+</button>
                        </div>
                    `;
                    divAdic.appendChild(itemDiv);
                });
                listCont.appendChild(divAdic);
            }
        });
    }
}

// --- FUNCIÓN PARA VALIDAR LÍMITE DE CHECKBOXES ---
function validarSeleccionAcomp(input) {
    if (input.type !== "checkbox") return;

    const max = parseInt(input.dataset.max, 10);
    const checkboxes = document.querySelectorAll(`input[name="${input.name}"]:checked`);

    if (checkboxes.length > max) {
        input.checked = false;
        alert(`Solo puedes seleccionar hasta ${max} opción(es) para este acompañamiento.`);
    }
}
    // --- SECCIÓN: SUBTOTAL EN MODAL ---
    const divSubtotal = document.createElement("div");
    divSubtotal.id = "contenedor-subtotal-modal";
    divSubtotal.style = "margin-top:20px; padding:15px; border-top:2px dashed #ddd; text-align:right;";
    divSubtotal.innerHTML = `
        <span style="font-weight:bold; color:#666;">Subtotal:</span>
        <span id="subtotal-modal-valor" style="font-size:1.2rem; font-weight:bold; color:var(--color-principal); margin-left:10px;">$0</span>
    `;
    listCont.appendChild(divSubtotal);

    // Inicializar subtotal
    actualizarSubtotalModal();

    // Lógica del botón agregar... (se mantiene igual)
    const btnAgregar = document.querySelector(".btn-agregar-modal");
    const estaAbierto = verificarHorario(); 
    if (!estaAbierto) {
        btnAgregar.innerText = "Cerrado temporalmente";
        btnAgregar.style.background = "#555";
        btnAgregar.disabled = true;
    } else {
        btnAgregar.innerText = "Confirmar pedido 🛒";
        btnAgregar.style.background = "var(--color-principal)";
        btnAgregar.disabled = false;
    }
    btnAgregar.style.marginBottom = "30px"; 
    btnAgregar.style.position = "relative";
    document.getElementById("modal-producto").classList.add("activo");
    history.pushState({ modal: "producto" }, "");
}
function cambiarCantAdic(btn, delta) {
    const input = btn.parentElement.querySelector('.input-adic');
    let valor = parseInt(input.value) + delta;
    if (valor < 0) valor = 0;
    input.value = valor;
    
    // Cada vez que cambia una cantidad, actualizamos el subtotal
    actualizarSubtotalModal();
}

function actualizarSubtotalModal() {
    if (!productoModal) return;

    // 1. Precio base del producto (ej: 26.500)
    const precioBase = Number(productoModal.precio) || 0;
    
    // 2. Cantidad de platos principales
    const cantPrincipal = parseInt(document.getElementById("modal-cantidad").value) || 1;
    
    // 3. Sumar adicionales (Costo Total de Extras)
    // Estos NO se multiplican por cantPrincipal, son unidades fijas.
    let sumaTotalAdicionales = 0;
    const inputsAdic = document.querySelectorAll(".input-adic");
    
    inputsAdic.forEach(input => {
        const cantidadExtra = parseInt(input.value) || 0;
        const precioUnitarioExtra = Number(input.dataset.precio) || 0;
        sumaTotalAdicionales += (cantidadExtra * precioUnitarioExtra);
    });

    // 4. NUEVA FÓRMULA: (Precio Base * Cantidad Platos) + Costo Total de Adicionales
    const totalFinal = (precioBase * cantPrincipal) + sumaTotalAdicionales;

    // 5. Actualizar el valor en el modal
    const lblSubtotal = document.getElementById("subtotal-modal-valor");
    if (lblSubtotal) {
        lblSubtotal.innerText = "$" + totalFinal.toLocaleString();
    }
}

function cambiarCantAdic(btn, delta) {
    const input = btn.parentElement.querySelector('.input-adic');
    let val = parseInt(input.value) + delta;
    if (val < 0) val = 0;
    input.value = val;
    
    // ACTUALIZACIÓN INSTANTÁNEA
    actualizarSubtotalModal();
}

function cambiarCantidad(delta) {
    const input = document.getElementById("modal-cantidad");
    let val = parseInt(input.value) + delta;
    if (val < 1) val = 1;
    input.value = val;
    
    // ACTUALIZACIÓN INSTANTÁNEA
    actualizarSubtotalModal();
}

function cerrarModalProducto() {
    document.getElementById("modal-producto").classList.remove("activo");
}

// ============================================================
// CARRITO Y WHATSAPP
// ============================================================
function actualizarVistaCarrito() {
    const cont = document.getElementById("carrito-items");
    const btnFlotante = document.querySelector(".btn-carrito-flotante");
    const countFlotante = document.getElementById("carrito-count");
    
    let total = 0;
    let itemsTotales = 0;
    cont.innerHTML = "";

    carrito.forEach((p, index) => {
        total += p.precio * p.cantidad;
        itemsTotales += p.cantidad;
        cont.innerHTML += `
            <div class="carrito-item" style="display:flex; justify-content:space-between; margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:5px;">
                <div style="flex:1">
                    <strong>${p.nombre}</strong> (x${p.cantidad})<br>
                    <small style="color:#aaa;">${p.observacion}</small>
                </div>
                <div style="text-align:right;">
                    $${(p.precio * p.cantidad).toLocaleString()} 
                    <button onclick="eliminarDelCarrito(${index})" style="background:none; border:none; color:#ff4444; margin-left:15px; font-size:1.4rem; font-weight:bold; cursor:pointer; padding:5px 10px; line-height:1;">✕</button>
                </div>
            </div>`;
    });

   if (carrito.length > 0) {
        cont.innerHTML += `
            <div style="text-align: right; margin-top: 15px; margin-bottom: 10px;">
                <button onclick="vaciarCarritoCompleto()" style="background: none; border: none; color: #ff4444; font-size: 0.85rem; font-weight: bold; cursor: pointer; padding: 5px 10px; transition: 0.2s;">
                    🗑️ Vaciar Carrito
                </button>
            </div>
            <div style="margin-top:20px; 
                    padding:15px; 
                    padding-bottom: 20px; 
                    background:#1a1a1a; 
                    border-radius:12px; 
                    border:1px solid #333; 
                    margin-bottom: 50px;"> 
                <p style="font-size:0.75rem; font-weight:bold; margin-bottom:12px; text-align:center; color:#fff; letter-spacing:1px;">¿DOMICILIO O RECOGER EN LOCAL?</p>
                <div style="display:flex; gap:10px; margin-bottom:15px;">
                    <label style="flex:1; cursor:pointer;">
                        <input type="radio" name="tipo_pedido" value="RKO" style="display:none;" onchange="ajustarEstiloMetodo(this)">
                        <div class="btn-metodo" style="background:#fff; color:#000; text-align:center; padding:12px 5px; border:2px solid var(--color-principal); border-radius:10px; font-weight:bold; font-size:0.8rem; transition:0.3s;">🛵 Domicilio</div>
                    </label>
                    <label style="flex:1; cursor:pointer;">
                        <input type="radio" name="tipo_pedido" value="HBK" style="display:none;" onchange="ajustarEstiloMetodo(this)">
                        <div class="btn-metodo" style="background:#fff; color:#000; text-align:center; padding:12px 5px; border:2px solid var(--color-principal); border-radius:10px; font-weight:bold; font-size:0.8rem; transition:0.3s;">🥡 Recoger</div>
                    </label>
                </div>

                <div id="mensaje-recoger-web" style="display:none; background:#2a2015; border:1px solid #ff9900; color:#ffcc00; padding:10px; border-radius:8px; font-size:0.8rem; text-align:center; font-weight:bold; margin-top:10px; margin-bottom:15px;">
                    ⚠️ Recuerda que todo pedido para recoger se debe pagar previamente, sigue el proceso y en el chat te enviamos la llave para la transferencia
                </div>
                
                <!-- 📱 OBLIGATORIO SIEMPRE: Número de Teléfono (Se muestra al seleccionar cualquier método) -->
                <div id="contenedor-telefono-web" style="display:none; margin-top:15px; border-top:1px solid #333; padding-top:15px;">
                    <label style="color:#aaa; font-size:0.75rem; display:block; margin-bottom:4px;">Número de Celular (WhatsApp):</label>
                    <input type="tel" id="web-telefono" placeholder="Ej. 3016610768" maxlength="10" oninput="this.value = this.value.replace(/[^0-9]/g, '');" style="width:100%; padding:8px; border-radius:6px; border:1px solid #444; background:#222; color:#fff; box-sizing:border-box; font-size:0.85rem;">
                </div>

                <!-- 📍 DINÁMICO: Solo para Domicilio (Nombre, Dirección, Barrio) -->
                <div id="formulario-cliente-web" style="display:none; flex-direction:column; gap:10px; margin-top:10px;">
                    <div>
                        <label style="color:#aaa; font-size:0.75rem; display:block; margin-bottom:4px;">Tu Nombre completo:</label>
                        <input type="text" id="web-nombre" placeholder="Ej. Juan Pérez" style="width:100%; padding:8px; border-radius:6px; border:1px solid #444; background:#222; color:#fff; box-sizing:border-box; font-size:0.85rem;">
                    </div>
                    <div>
                        <label style="color:#aaa; font-size:0.75rem; display:block; margin-bottom:4px;">Dirección de Entrega:</label>
                        <input type="text" id="web-direccion" placeholder="Ej. Cra 36 # 41-45 ofc 201" style="width:100%; padding:8px; border-radius:6px; border:1px solid #444; background:#222; color:#fff; box-sizing:border-box; font-size:0.85rem;">
                    </div>
                    <div>
                        <label style="color:#aaa; font-size:0.75rem; display:block; margin-bottom:4px;">Barrio:</label>
                        <input type="text" id="web-barrio" placeholder="Ej. El prado" style="width:100%; padding:8px; border-radius:6px; border:1px solid #444; background:#222; color:#fff; box-sizing:border-box; font-size:0.85rem;">
                    </div>
                </div>
            </div>`;
    }

    document.getElementById("carrito-total").innerText = "$" + total.toLocaleString();
    document.getElementById("btn-whatsapp").disabled = (carrito.length === 0);
    if (countFlotante) countFlotante.innerText = itemsTotales;
    if (btnFlotante) btnFlotante.style.display = itemsTotales > 0 ? "flex" : "none";
}
function agregarDesdeModal() {
    if (!productoModal) return;
    
    const obs = document.getElementById("modal-obs").value.trim();
    const cantPrincipal = parseInt(document.getElementById("modal-cantidad").value) || 1;
    
    // 1. Obtener Acompañamientos (Radios originales - No suman precio)
    const seleccionados = Array.from(document.querySelectorAll("#modal-acompanamientos-list input[type='radio']:checked")).map(c => c.value);
    
    let finalObs = seleccionados.length ? "Con: " + seleccionados.join(", ") : "";
    if (obs) finalObs += (finalObs ? " | " : "") + obs;

    // 2. Agregar Producto Principal
    const itemPrincipal = { 
        codigo: String(productoModal.codigo).trim(), 
        nombre: productoModal.articulo, 
        precio: Number(productoModal.precio), 
        observacion: finalObs, 
        cantidad: cantPrincipal 
    };

    const indexPrincipal = carrito.findIndex(x => x.codigo === itemPrincipal.codigo && x.observacion === itemPrincipal.observacion);
    if (indexPrincipal > -1) carrito[indexPrincipal].cantidad += cantPrincipal; 
    else carrito.push(itemPrincipal);

    // 3. Agregar Adicionales con PRECIO REAL del menú
    const inputsAdic = document.querySelectorAll(".input-adic");
    inputsAdic.forEach(input => {
        const cantAdic = parseInt(input.value);
        if (cantAdic > 0) {
            const codAdic = String(input.dataset.codigo).trim();
            
            // BUSCAR EL PRODUCTO EN EL MENÚ PARA OBTENER SU PRECIO
            const productoEnMenu = encontrarProductoPorCodigo(codAdic); 
            const precioReal = productoEnMenu ? Number(productoEnMenu.precio) : 0;

            const adicionalItem = {
                codigo: codAdic,
                nombre: `(+) ${input.dataset.nombre}`, 
                precio: precioReal, // <--- AQUÍ ya no es 0, toma el valor del JSON
                observacion: `Adicional para: ${productoModal.articulo}`,
                cantidad: cantAdic
            };
            
            // Evitar duplicados de adicionales en el carrito
            const indexAdic = carrito.findIndex(x => x.codigo === adicionalItem.codigo && x.observacion === adicionalItem.observacion);
            if (indexAdic > -1) carrito[indexAdic].cantidad += cantAdic;
            else carrito.push(adicionalItem);
        }
    });

    actualizarVistaCarrito();
    cerrarModalProducto();
    mostrarToast(`Agregado correctamente`);
}

function vaciarCarritoCompleto() {
    if (confirm("⚠️ ¿Estás seguro de que deseas vaciar todo el carrito?")) {
        carrito = []; // Limpia el array global del carrito
        actualizarVistaCarrito(); // Refresca la interfaz
    }
}
async function enviarWhatsApp() {
    if (!verificarHorario()) {
        Swal.fire("Cerrado", "Lo sentimos, no estamos recibiendo pedidos ahora.", "error");
        return;
    }
    const metodo = document.querySelector('input[name="tipo_pedido"]:checked');
    if (!metodo) {
        mostrarToast("⚠️ Selecciona Domicilio o Recoger");
        return;
    }
    document.getElementById("modal-confirmacion").classList.add("activo");
    history.pushState({ modal: "confirmacion" }, "");
}
let numerosWhatsApp = { domicilio: "", recoger: "" };


async function precargarConfiguracion() {
    const DEFAULT_NUMBER = "3506340678";
    const cb = `?cb=${Date.now()}`;
    
    try {
        const r = await fetch(`${BUCKET_URL}/config_whatsapp1.txt${cb}`);
        
        // Si el archivo no existe o devuelve un error HTTP (ej. 404), lanzamos error para ir al catch
        if (!r.ok) {
            throw new Error(`No se encontró el archivo. Status: ${r.status}`);
        }

        const t = await r.text();
        
        // Buscamos las líneas y limpiamos espacios o retornos de carro (\r)
        const lineas = t.split('\n');
        lineas.forEach(linea => {
            if (linea.includes('domicilio=')) {
                numerosWhatsApp.domicilio = linea.split('=')[1].trim().replace(/\r/g, "");
            }
            if (linea.includes('recoger=')) {
                numerosWhatsApp.recoger = linea.split('=')[1].trim().replace(/\r/g, "");
            }
        });

        // Verificación adicional por si el archivo existía pero estaba vacío
        if (!numerosWhatsApp.domicilio) numerosWhatsApp.domicilio = DEFAULT_NUMBER;
        if (!numerosWhatsApp.recoger) numerosWhatsApp.recoger = DEFAULT_NUMBER;

        console.log("Números cargados desde archivo:", numerosWhatsApp);

    } catch (e) {
        console.warn("No se pudo cargar el archivo. Asignando número por defecto:", e.message);
        
        // Asignación de respaldo
        numerosWhatsApp.domicilio = DEFAULT_NUMBER;
        numerosWhatsApp.recoger = DEFAULT_NUMBER;
        
        console.log("Números asignados (default):", numerosWhatsApp);
    }
}

// SE EJECUTA AL CARGAR LA PÁGINA
precargarConfiguracion();

async function confirmarYEnviar() {
    const radioChecked = document.querySelector('input[name="tipo_pedido"]:checked');
    if (!radioChecked) {
        alert("Por favor selecciona un tipo de pedido");
        return;
    }
    
    // prefijo será "RKO" o "HBK" según lo tengas en el value del HTML
    const prefijo = radioChecked.value; 
    let msg = "";

    // 📱 VALIDACIÓN OBLIGATORIA DEL TELÉFONO (Aplica tanto para RKO como para HBK)
    const inputTel = document.getElementById("web-telefono");
    const telefono = inputTel ? inputTel.value.trim() : "";

    if (!telefono || telefono.length !== 10 || !telefono.startsWith("3")) {
        alert("Por favor, ingresa un número de celular válido de 10 dígitos (ej. 3016610768) para continuar.");
        if (inputTel) inputTel.focus();
        return;
    }

    // 🌟 Inyectamos primero la línea del teléfono para que server.py/Worker lo lea con la Regex
    msg += `TELEFONO|${telefono}\n`;

    // 🌟 Si es Domicilio (RKO), recolectamos y validamos los datos de entrega
    if (prefijo === "RKO") {
        const nombre = document.getElementById("web-nombre").value.trim();
        const direccion = document.getElementById("web-direccion").value.trim();
        const barrio = document.getElementById("web-barrio").value.trim();

        if (!nombre || !direccion || !barrio) {
            alert("Por favor, completa todos los campos de entrega (Nombre, Dirección y Barrio) para proceder con el domicilio.");
            return;
        }

        // Línea que el Bot leerá para los datos del cliente
        msg += `RKO|DATOS_CLIENTE|${nombre.replace(/[|\n]/g, " ")}|${direccion.replace(/[|\n]/g, " ")}|${barrio.replace(/[|\n]/g, " ")}\n`;
    }

    // 1. Construcción del mensaje (Productos y observaciones)
    carrito.forEach(p => {
        msg += `${prefijo}|${p.codigo}|${p.cantidad}\n`;
        if (p.observacion) {
            msg += `${prefijo}|CONTROLRESTRICCIONES|0|0|${p.observacion.replace(/[|\n]/g, " ")}\n`;
        }
    });

    // 2. Selección del teléfono desde tu nueva configuración
    let telDestino = (prefijo === "RKO") ? numerosWhatsApp.domicilio : numerosWhatsApp.recoger;

    // Validación de seguridad
    if (!telDestino) {
        console.error("Error: Teléfono no encontrado para el prefijo", prefijo);
        alert("Error de configuración: No se encontró el número de destino.");
        return;
    }

    const url = `https://wa.me/${telDestino}?text=${encodeURIComponent(msg)}`;

    // 3. FIX DEFINITIVO PARA ANDROID
    window.onbeforeunload = null;

    // 4. Salto a WhatsApp
    window.location.href = url;

    // 5. Cerramos el modal
    const modalConfirm = document.getElementById("modal-confirmacion");
    if (modalConfirm) {
        modalConfirm.classList.remove("activo");
    }
}

function cerrarModalConfirmacion() {
    const modalConf = document.getElementById("modal-confirmacion");
    if (modalConf) {
        modalConf.classList.remove("activo");
    }
    // Si manejas el historial del celular (botón atrás) y estás en ese estado, saca el modal del historial
    if (history.state?.modal === "confirmacion") {
        history.back();
    }
}
// ============================================================
// PROMOS Y UTILS
// ============================================================
function mostrarPromoInicio(promo) {
    if (!promo) return;
    const promoHTML = `
        <div id="modal-promo" class="modal-overlay activo" 
             style="z-index: 100000; 
                    position: fixed; 
                    top: 0; 
                    left: 0; 
                    width: 100%; 
                    height: 100%; 
                    background: rgba(0, 0, 0, 0.5); 
                    display: flex; 
                    align-items: center; 
                    justify-content: center;
                    padding: 20px;">
            
            <div class="modal-box" 
                 style="text-align:center; 
                        max-width: 330px; 
                        width: 90%; 
                        background: white; 
                        padding: 15px; 
                        border-radius: 20px; 
                        position: relative; 
                        box-shadow: 0 15px 35px rgba(0,0,0,0.4);">
                
                <button onclick="cerrarPromo()" 
                        style="position: absolute; 
                               top: 10px; 
                               right: 10px; 
                               background: rgba(0,0,0,0.8); 
                               color: #fff; 
                               border: 2px solid #fff; 
                               width: 30px; 
                               height: 30px; 
                               border-radius: 50%; 
                               cursor: pointer; 
                               font-size: 14px;
                               font-weight: bold;
                               display: flex;
                               align-items: center;
                               justify-content: center;
                               z-index: 100010;">✕</button>
                
                <h3 style="color:#dca600; margin: 5px 0 15px 0; font-size: 1.2rem; padding-right: 30px;">
                   ✨ ${promo.nombre}
                </h3>
                
                <div style="width: 100%; 
                            display: flex; 
                            justify-content: center; 
                            background: #fff; 
                            border-radius: 12px; 
                            overflow: hidden;
                            margin-bottom: 20px;">
                    <img src="${limpiarRuta(promo.imagen)}" 
                         style="max-width: 100%; 
                                height: auto; 
                                display: block; 
                                object-fit: contain;
                                border-radius: 10px;">
                </div>
                
                <button style="width:100%; 
                               background:#25D366; 
                               color:white; 
                               border:none; 
                               padding: 15px; 
                               border-radius: 12px; 
                               font-weight: bold; 
                               cursor: pointer; 
                               font-size: 1.1rem;
                               box-shadow: 0 4px 10px rgba(37, 211, 102, 0.2);" 
                        onclick="prepararCompraPromo('${promo.codigo}')">
                    🍔¡Pedir esta promo!🤤  
                </button>
            </div>
        </div>`;

    const modalAnterior = document.getElementById("modal-promo");
    if (modalAnterior) modalAnterior.remove();

    document.body.insertAdjacentHTML('beforeend', promoHTML);
    history.pushState({ modal: "promo" }, "");
}

function prepararCompraPromo(codigo) {
    const modalP = document.getElementById('modal-promo');
    if (modalP) modalP.remove();
    const p = encontrarProductoPorCodigo(codigo);
    if (p) abrirModalProducto(p);
}

function cerrarPromo() {
    const m = document.getElementById('modal-promo');
    if (m) m.remove();
}

// ============================================================
// FUNCIONES DE INFORMACIÓN (HORARIOS Y UBICACIÓN)
// ============================================================

function mostrarHorarios() {

    // Si no han cargado los datos de Supabase aún
    if (!menuConfig || !menuConfig.horarios) {
        console.warn("Horarios no cargados de Supabase");
        return;
    }

    let tablaHTML = `
        <div style="
            text-align:left;
            font-family:'Inter', sans-serif;
            color:white;
        ">
    `;

    const diasOrden = [
        "Lunes",
        "Martes",
        "Miércoles",
        "Jueves",
        "Viernes",
        "Sábado",
        "Domingo"
    ];

    diasOrden.forEach(dia => {

        const h = menuConfig.horarios[dia];

        if (!h) return;

        let status = "";

        // DÍA CERRADO
        if (h.cerrado === true || h.cerrado === "True") {

            status = `
                <span style="
                    color:#ff4444;
                    font-weight:bold;
                ">
                    Cerrado
                </span>
            `;

        } else {

            // NUEVO FORMATO CON RANGOS
            if (h.rangos && h.rangos.length > 0) {

                const horariosTexto = h.rangos
                    .map(r => `${r.inicio} - ${r.fin}`)
                    .join("<br>");

                status = `
                    <span style="
                        color:#44ff44;
                        text-align:right;
                    ">
                        ${horariosTexto}
                    </span>
                `;

            } else {

                status = `
                    <span style="color:#999;">
                        Sin horario
                    </span>
                `;
            }
        }

        tablaHTML += `
            <div style="
                display:flex;
                justify-content:space-between;
                align-items:flex-start;
                border-bottom:1px solid #333;
                padding:10px 0;
                gap:20px;
            ">
                <span style="font-weight:bold;">
                    ${dia}
                </span>

                <span>
                    ${status}
                </span>
            </div>
        `;
    });

    tablaHTML += `</div>`;

    Swal.fire({
        title: '🕒 Nuestros Horarios',
        html: tablaHTML,
        background: '#1a1a1a',
        color: '#fff',
        confirmButtonColor: 'var(--color-principal)',
        confirmButtonText: 'Entendido'
    });
}
function mostrarUbicacion() {
    const direccion = "Cl. 43 #34-25 barrio El Prado, Bucaramanga";
    
    Swal.fire({
        title: '📍 Ubicación',
        html: `
            <p style="color:#fff; margin-bottom:15px;">${direccion}</p>
            <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}" 
               target="_blank" 
               style="display:inline-block; padding:12px 25px; background:var(--color-principal); color:#000; border-radius:8px; text-decoration:none; font-weight:bold; font-size:0.9rem;">
               VER EN GOOGLE MAPS
            </a>`,
        background: '#1a1a1a',
        showConfirmButton: false,
        showCloseButton: true
    });
}

// ============================================================
// DISPARADOR DE INICIO (MODIFICADO PARA VINCULAR BOTONES)
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
    // 1. Iniciar carga de datos
    inicializarApp();

    // 2. Vincular botones de la portada (Horarios y Ubicación)
    // Buscamos los botones por su texto o clase si existen
    const btnHorario = document.querySelector('button[onclick="mostrarHorarios()"]') || 
                       Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Horario'));
    
    const btnUbi = document.querySelector('button[onclick="mostrarUbicacion()"]') || 
                   Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Ubicación'));

    if (btnHorario) btnHorario.onclick = mostrarHorarios;
    if (btnUbi) btnUbi.onclick = mostrarUbicacion;
});
// ============================================================
// SISTEMA BASE (RENDER, PORTADA, HORARIO)
// ============================================================
function toggleCategorias() {
    const sidebar = document.getElementById("sidebar-categorias");
    const overlay = document.getElementById("overlay-sidebar");
    if(sidebar && overlay) {
        sidebar.classList.toggle("activo");
        overlay.classList.toggle("activo");
    }
}

function renderMenu() {
    const menuCont = document.getElementById("menu");
    const navCont = document.getElementById("nav-categorias");

    if (!menuCont || !navCont || !menuData) return;

    menuCont.innerHTML = "";
    navCont.innerHTML = "";

    const normalizar = str =>
        str?.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const hoy = normalizar(diasSemana[new Date().getDay()]);

    const categorias = Object.keys(menuData);

    // =========================
    // ⭐ RECOMENDADOS (VISIBLE AL INICIO)
    // =========================
    if (menuConfig?.recomendados && Object.keys(menuConfig.recomendados).length > 0) {

        let htmlChef = `<h3 class="titulo-categoria">🍔⭐ Promo del día (${hoy}) ⭐🍔</h3><div class="grid-productos">`;
        let hayRecomendados = false;

        categorias.forEach(cat => {
            menuData[cat].forEach(p => {
                const cod = String(p.codigo).trim();
                const diasOriginal = menuConfig.recomendados[cod];

                const esHoy = diasOriginal?.some(d => normalizar(d) === hoy);

                if (esHoy) {
                    hayRecomendados = true;

                    const img = imagenes[cod] || p.imagen;

                    htmlChef += `
                        <div class="card-producto card-recomendado" onclick='abrirModalProducto(${JSON.stringify(p)})'>
                            <div class="contenedor-media">
                                <span class="badge-estrella">⭐ Hoy</span>
                                ${img ? `<img src="${limpiarRuta(img)}" loading="lazy" decoding="async">` : '<div class="sin-foto"></div>'}
                            </div>
                            <div class="info">
                                <span class="nombre">${p.articulo}</span>
                                ${p.descripcion ? `<p class="descripcion">${p.descripcion}</p>` : ''}
                                <span class="precio">$${Number(p.precio).toLocaleString()}</span>
                            </div>
                        </div>
                    `;
                }
            });
        });

        if (hayRecomendados) {
            // BOTÓN NAV
            const btnChef = document.createElement("button");
            btnChef.innerText = "⭐ Recomendados";

            btnChef.onclick = (e) => {
                document.querySelectorAll("#nav-categorias button").forEach(b => b.classList.remove("activo"));
                e.target.classList.add("activo");
                cambiarCategoria("recomendados");
                toggleCategorias();
            };

            navCont.appendChild(btnChef);

            // BLOQUE (VISIBLE)
            const divChef = document.createElement("div");
            divChef.className = "bloque-categoria seccion-chef";
            divChef.id = "cat-recomendados";
            divChef.style.display = "block";

            divChef.innerHTML = htmlChef + `</div>`;
            menuCont.appendChild(divChef);
        }
    }

    // =========================
    // 📂 CATEGORÍAS
    // =========================
    categorias.forEach((cat) => {

        const esInicial = (cat === window.categoriaInicial);

        // BOTÓN NAV
        const btn = document.createElement("button");
        btn.innerText = cat;

        if (esInicial) btn.classList.add("activo");

        btn.onclick = (e) => {
            document.querySelectorAll("#nav-categorias button").forEach(b => b.classList.remove("activo"));
            e.target.classList.add("activo");
            cambiarCategoria(cat);
            toggleCategorias();
        };

        navCont.appendChild(btn);

        // BLOQUE
        const divCat = document.createElement("div");
        divCat.className = "bloque-categoria";
        divCat.id = "cat-" + normalizar(cat).replace(/\s+/g, "");

        divCat.style.display = esInicial ? "block" : "none";

        let html = "";

        const banner = menuConfig?.banners_categoria?.[cat]?.trim();
        if (banner) {
            html += `<div class="banner-categoria-grupo"><img src="${limpiarRuta(banner)}"></div>`;
        }

        html += `<h3 class="titulo-categoria">${cat}</h3><div class="grid-productos">`;

        menuData[cat].forEach(p => {
            const cod = String(p.codigo).trim();
            const img = imagenes[cod] || p.imagen;
            const diasConfigurados = menuConfig?.recomendados?.[cod];

            if (
                diasConfigurados &&
                Array.isArray(diasConfigurados) &&
                diasConfigurados.length === 0
            ) {
                return;
            }
            const esRecomendadoGeneral = diasConfigurados && diasConfigurados.length > 0;
            const esRecHoy = diasConfigurados?.some(d => normalizar(d) === hoy);

            const estaDeshabilitado = esRecomendadoGeneral && !esRecHoy;

            html += `
                <div class="card-producto ${estaDeshabilitado ? 'producto-deshabilitado' : ''}" 
                     ${estaDeshabilitado ? '' : `onclick='abrirModalProducto(${JSON.stringify(p)})'`}>
                    <div class="contenedor-media">
                        ${esRecHoy ? '<span class="badge-estrella">⭐ Recomendado</span>' : ''}
                        ${estaDeshabilitado ? '<div class="overlay-deshabilitado">No disponible hoy</div>' : ''}
                        ${img ? `<img src="${limpiarRuta(img)}" style="${estaDeshabilitado ? 'filter: grayscale(1); opacity: 0.5;' : ''}">` : '<div class="sin-foto"></div>'}
                    </div>
                    <div class="info">
                        <span class="nombre">${p.articulo} ${estaDeshabilitado ? '<small>(Promo otro día)</small>' : ''}</span>
                        ${p.descripcion ? `<p class="descripcion">${p.descripcion}</p>` : ''}
                        <span class="precio" style="${estaDeshabilitado ? 'text-decoration: line-through; color: gray;' : ''}">$${Number(p.precio).toLocaleString()}</span>
                    </div>
                </div>
            `;
        });

        divCat.innerHTML = html + `</div>`;
        menuCont.appendChild(divCat);
    });
}
function verificarHorario() {

    if (!menuConfig?.horarios) return true;

    const ahora = new Date();

    const dias = [
        "Domingo",
        "Lunes",
        "Martes",
        "Miércoles",
        "Jueves",
        "Viernes",
        "Sábado"
    ];

    const config = menuConfig.horarios[dias[ahora.getDay()]];

    if (!config) return true;

    // Día cerrado
    if (config.cerrado === true || config.cerrado === "True") {
        return false;
    }

    // Sin rangos
    if (!config.rangos || config.rangos.length === 0) {
        return false;
    }

    const minutosAhora =
        ahora.getHours() * 60 + ahora.getMinutes();

    // Verificar si está dentro de ALGÚN rango
    for (const rango of config.rangos) {

        if (!rango.inicio || !rango.fin) continue;

        const [hi, mi] = rango.inicio
            .split(':')
            .map(Number);

        const [hf, mf] = rango.fin
            .split(':')
            .map(Number);

        const minutosInicio = hi * 60 + mi;
        const minutosFin = hf * 60 + mf;

        if (
            minutosAhora >= minutosInicio &&
            minutosAhora <= minutosFin
        ) {
            return true;
        }
    }

    // No cayó en ningún rango
    return false;
}

function cambiarCategoria(cat) {
    const id = "cat-" + cat.replace(/\s+/g, "");
    document.querySelectorAll(".bloque-categoria").forEach(d => d.style.display = d.id === id ? "block" : "none");
}
function ajustarEstiloMetodo(radio) {
    // 1. Restablece el estilo visual de todos los botones a su estado desactivado
    document.querySelectorAll('.btn-metodo').forEach(el => {
        el.style.background = "#222"; 
        el.style.color = "#fff";
    });
    
    // 2. Aplica el color principal al botón seleccionado
    radio.nextElementSibling.style.background = "var(--color-principal)";
    radio.nextElementSibling.style.color = "#000";

    // Opciones de control dinámico
    const contenedorTelefono = document.getElementById("contenedor-telefono-web");
    const formulario = document.getElementById("formulario-cliente-web");
    const contenedorMensajeRecoger = document.getElementById("mensaje-recoger-web");

    // 📱 EL TELÉFONO ES OBLIGATORIO EN AMBOS MÉTODOS: Se muestra siempre que seleccione una opción
    if (contenedorTelefono) {
        contenedorTelefono.style.display = "block";
    }

    // 3. Controla la visibilidad de los campos de dirección y mensajes según la opción
    if (radio.value === "RKO") {
        // --- CASO DOMICILIO ---
        if (formulario) formulario.style.display = "flex";               // Muestra Nombre, Dirección y Barrio
        if (contenedorMensajeRecoger) contenedorMensajeRecoger.style.display = "none"; // Oculta aviso de pago
        
    } else {
        // --- CASO RECOGER ---
        if (formulario) formulario.style.display = "none";               // Oculta Nombre, Dirección y Barrio
        if (contenedorMensajeRecoger) contenedorMensajeRecoger.style.display = "block"; // Muestra aviso de pago
        
        // Limpia los campos de dirección para evitar datos basura
        const inputDir = document.getElementById("web-direccion");
        const inputBarrio = document.getElementById("web-barrio");
        if (inputDir) inputDir.value = "";
        if (inputBarrio) inputBarrio.value = "";
    }
}
function limpiarRuta(r) {
    if (!r) return "";
    return r.replace(/\\/g, "/") + "?v=" + Date.now();
}

function aplicarPortada() {
    if (!menuConfig?.portada) return;
    const { banner, logo, fondo } = menuConfig.portada;

    if (banner) document.getElementById("portada").style.backgroundImage = `url('${limpiarRuta(banner)}')`;
    if (logo) document.getElementById("portada-logo").src = limpiarRuta(logo);

    // 🎨 Aplica la imagen o color de fondo general
    if (fondo) {
        document.body.style.backgroundImage = `url('${limpiarRuta(fondo)}')`;
        document.body.style.backgroundSize = "cover";
        document.body.style.backgroundPosition = "center";
        document.body.style.backgroundAttachment = "fixed"; // Mantiene el fondo fijo al hacer scroll
    }
}
function encontrarProductoPorCodigo(codigo) {
    for (let cat in menuData) {
        let p = menuData[cat].find(x => String(x.codigo).trim() === String(codigo).trim());
        if (p) return p;
    }
    return null;
}

function mostrarToast(m) {
    const t = document.getElementById("toast");
    if (t) { t.innerText = m; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2000); }
}

function toggleCarrito() {
    document.getElementById("carrito-panel").classList.toggle("activo");
}

function eliminarDelCarrito(i) {
    if (carrito[i].cantidad > 1) carrito[i].cantidad--; else carrito.splice(i, 1);
    actualizarVistaCarrito();
}

window.onpopstate = function() {
    document.getElementById("modal-producto")?.classList.remove("activo");
    document.getElementById("carrito-panel")?.classList.remove("activo");
    document.getElementById("modal-confirmacion")?.classList.remove("activo");
    document.getElementById("modal-promo")?.remove();
};

document.addEventListener("DOMContentLoaded", inicializarApp);











