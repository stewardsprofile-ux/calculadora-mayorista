const SUPABASE_URL = "https://wpcsqjcaxxckldwfwsrn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZXxwRu-TXDFdCLhrKtNKfA_emZA1NNN";
const GOLD_SETTINGS_ID = 1;
const RENEWAL_SETTINGS_ID = 1;
const COLON = "\u20A1";
const ENVIO_PLAN_ROJO = 4000;
const EXTRA_PRIMA_PLANES = 4000;
const CUOTA_MINIMA_ORO = 15000;
const GOLD_SETTINGS_LOCAL_KEY = "elite_gold_settings_extra";
const RENEWAL_SETTINGS_LOCAL_KEY = "elite_renewal_settings";

let perfumes = [];
let estadoSinPrima = {};
let supabaseClient = null;
let busquedaTimer = null;
let precioCompraUpgrade = 0;

const defaultRenewalSettings = {
    costo_fundir: 7500,
    precio_financiado_fundir: 12000,
    precio_contado_fundir: 10000
};

const defaultGoldSettings = {
    precio_contado_nacional: 50000,
    precio_pagos_nacional: 70000,
    costo_nacional: 36000,
    costo_fundicion: 7500,
    precio_contado_italiano: 50000,
    precio_pagos_italiano: 70000,
    costo_italiano: 44000
};

let goldSettings = { ...defaultGoldSettings };
let renewalSettings = { ...defaultRenewalSettings };

function colones(numero) {
    const valor = Number(numero) || 0;
    return `${COLON}${Math.round(valor).toLocaleString("es-CR").replace(/,/g, ".")}`;
}

function redondear1000(valor) {
    const residuo = valor % 1000;
    return residuo < 500
        ? Math.floor(valor / 1000) * 1000
        : Math.ceil(valor / 1000) * 1000;
}

function calcularCuotaOro(precioPagos) {
    if (precioPagos > 1000000) {
        return 30000;
    }

    if (precioPagos > 500000) {
        return 20000;
    }

    return CUOTA_MINIMA_ORO;
}

function normalizarNumero(valor) {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : 0;
}

function limpiarNumeroMoneda(valor) {
    return String(valor ?? "").replace(/[^\d]/g, "");
}

function normalizarTexto(valor) {
    return String(valor ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function escaparHTML(valor) {
    const div = document.createElement("div");
    div.textContent = String(valor ?? "");
    return div.innerHTML;
}

function parsearMoneda(valor) {
    const limpio = limpiarNumeroMoneda(valor);
    return limpio ? Number(limpio) : 0;
}

function formatearMeses(cuotas) {
    const meses = cuotas / 2;
    return Number.isInteger(meses) ? `${meses}` : `${meses.toFixed(1)}`;
}

function parsearFechaLocal(valor) {
    const partes = String(valor || "").split("-").map(Number);
    if (partes.length !== 3 || partes.some(parte => !Number.isFinite(parte))) {
        return null;
    }

    return new Date(partes[0], partes[1] - 1, partes[2]);
}

function formatearFechaCorta(fecha) {
    return fecha.toLocaleDateString("es-CR", {
        day: "numeric",
        month: "numeric",
        year: "numeric"
    });
}

function formatearDiaPago(fecha) {
    const dia = fecha.toLocaleDateString("es-CR", { weekday: "long" });
    return dia.charAt(0).toUpperCase() + dia.slice(1);
}

function sumarDias(fecha, dias) {
    return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + dias);
}

function obtenerDiaCierreMes(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function obtenerSiguienteFechaPago(fecha) {
    const year = fecha.getFullYear();
    const month = fecha.getMonth();
    const day = fecha.getDate();
    const diaCierre = obtenerDiaCierreMes(year, month);

    if (day < 15) {
        return new Date(year, month, 15);
    }

    if (day < diaCierre) {
        return new Date(year, month, diaCierre);
    }

    return new Date(year, month + 1, 15);
}

function obtenerProximaFechaPago(fecha) {
    return obtenerSiguienteFechaPago(fecha);
}

function calcularDiasEntre(inicio, fin) {
    const milisegundosDia = 1000 * 60 * 60 * 24;
    return Math.max(1, Math.ceil((fin - inicio) / milisegundosDia));
}

function setGoldStatus(mensaje, esError = false) {
    const status = document.getElementById("gold-status");
    if (!status) {
        return;
    }

    status.textContent = mensaje;
    status.classList.toggle("error", esError);
}

function toggleGoldVisibility(mostrar) {
    const goldTitle = document.getElementById("gold-title");
    const goldCard = document.getElementById("gold-card");
    const loanCard = document.getElementById("loan-card");
    const upgradeCard = document.getElementById("upgrade-card");
    const renewalCard = document.getElementById("renewal-card");

    if (goldTitle) {
        goldTitle.style.display = "none";
    }

    if (goldCard) {
        goldCard.style.display = "none";
    }

    if (loanCard) {
        loanCard.style.display = "none";
    }

    if (upgradeCard) {
        upgradeCard.style.display = "none";
    }

    if (renewalCard) {
        renewalCard.style.display = "none";
    }
}

function llenarFormularioOro(settings) {
    document.getElementById("precio-contado-nacional").value = colones(settings.precio_contado_nacional ?? 0);
    document.getElementById("precio-pagos-nacional").value = colones(settings.precio_pagos_nacional ?? 0);
    document.getElementById("costo-nacional").value = colones(settings.costo_nacional ?? 0);
    document.getElementById("costo-fundicion").value = colones(settings.costo_fundicion ?? 0);
    document.getElementById("precio-contado-italiano").value = colones(settings.precio_contado_italiano ?? 0);
    document.getElementById("precio-pagos-italiano").value = colones(settings.precio_pagos_italiano ?? 0);
    document.getElementById("costo-italiano").value = colones(settings.costo_italiano ?? 0);
}

function leerFormularioOro() {
    return {
        precio_contado_nacional: parsearMoneda(document.getElementById("precio-contado-nacional").value),
        precio_pagos_nacional: parsearMoneda(document.getElementById("precio-pagos-nacional").value),
        costo_nacional: parsearMoneda(document.getElementById("costo-nacional").value),
        costo_fundicion: parsearMoneda(document.getElementById("costo-fundicion").value),
        precio_contado_italiano: parsearMoneda(document.getElementById("precio-contado-italiano").value),
        precio_pagos_italiano: parsearMoneda(document.getElementById("precio-pagos-italiano").value),
        costo_italiano: parsearMoneda(document.getElementById("costo-italiano").value)
    };
}

function llenarFormularioRenovacion(settings) {
    document.getElementById("renewal-costo-fundir").value = colones(settings.costo_fundir ?? 0);
    document.getElementById("renewal-precio-financiado").value = colones(settings.precio_financiado_fundir ?? 0);
    document.getElementById("renewal-precio-contado").value = colones(settings.precio_contado_fundir ?? 0);
}

function leerFormularioRenovacion() {
    return {
        costo_fundir: parsearMoneda(document.getElementById("renewal-costo-fundir").value),
        precio_financiado_fundir: parsearMoneda(document.getElementById("renewal-precio-financiado").value),
        precio_contado_fundir: parsearMoneda(document.getElementById("renewal-precio-contado").value)
    };
}

function cargarGoldSettingsLocales() {
    try {
        return JSON.parse(localStorage.getItem(GOLD_SETTINGS_LOCAL_KEY) || "{}");
    } catch (error) {
        console.error(error);
        return {};
    }
}

function cargarRenewalSettingsLocales() {
    try {
        return JSON.parse(localStorage.getItem(RENEWAL_SETTINGS_LOCAL_KEY) || "{}");
    } catch (error) {
        console.error(error);
        return {};
    }
}

function guardarGoldSettingsLocales(settings) {
    localStorage.setItem(GOLD_SETTINGS_LOCAL_KEY, JSON.stringify({
        costo_fundicion: normalizarNumero(settings.costo_fundicion)
    }));
}

function guardarRenewalSettingsLocales(settings) {
    localStorage.setItem(RENEWAL_SETTINGS_LOCAL_KEY, JSON.stringify(settings));
}

function formatearInputMoneda(input) {
    const valor = parsearMoneda(input.value);
    input.value = valor ? colones(valor) : "";
}

function registrarFormatoMoneda() {
    const ids = [
        "precio-contado-nacional",
        "precio-pagos-nacional",
        "costo-nacional",
        "costo-fundicion",
        "precio-contado-italiano",
        "precio-pagos-italiano",
        "costo-italiano",
        "renewal-costo-fundir",
        "renewal-precio-financiado",
        "renewal-precio-contado",
        "upgrade-precio-compra",
        "loan-monto"
    ];

    ids.forEach(id => {
        const input = document.getElementById(id);
        if (!input) {
            return;
        }

        input.addEventListener("input", () => {
            const limpio = limpiarNumeroMoneda(input.value);
            input.value = limpio;
        });

        input.addEventListener("blur", () => {
            formatearInputMoneda(input);
        });
    });
}

function initSupabase() {
    if (!window.supabase || !SUPABASE_URL || SUPABASE_ANON_KEY.includes("PEGA_AQUI")) {
        return null;
    }

    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function calcularPrecioMayorista(costoInterno) {
    const costo = normalizarNumero(costoInterno);

    if (costo < 25000) return costo + 4000;
    if (costo < 45000) return costo + 5000;
    if (costo <= 70000) return costo + 6000;

    return Math.ceil((costo * 1.10) / 1000) * 1000;
}

async function cargarPerfumes() {
    try {
        const respuesta = await fetch("perfumes.json");
        if (!respuesta.ok) {
            throw new Error(`No se pudo cargar perfumes.json (${respuesta.status})`);
        }

        const data = await respuesta.json();
        perfumes = data.map(perfume => ({
            ...perfume,
            nombreBusqueda: normalizarTexto(perfume.nombre)
        }));
    } catch (error) {
        console.error(error);
    }
}

function calcularPlanes(costo, sinPrima = false) {
    const contado = calcularPrecioMayorista(costo);
    const precioNaranja = Math.ceil((costo * 1.65) / 1000) * 1000;
    const primaNaranja = sinPrima ? 0 : redondear1000(costo * 0.65) + EXTRA_PRIMA_PLANES;
    const saldoNaranja = Math.max(precioNaranja - primaNaranja, 0);
    const cuotaNaranja = Math.round(saldoNaranja / 2);

    const precioRojoBase = Math.ceil((costo * 2.0) / 1000) * 1000;
    const precioRojo = precioRojoBase + ENVIO_PLAN_ROJO;
    const primaRojo = sinPrima ? 0 : costo / 2 + EXTRA_PRIMA_PLANES;
    const saldoRojo = Math.max(precioRojo - primaRojo, 0);
    const cuotaRojo = Math.round(saldoRojo / 4);

    return {
        contado,
        naranja: { precio: saldoNaranja, precioBase: precioNaranja, prima: primaNaranja, cuota: cuotaNaranja, cuotas: 2, meses: "1" },
        rojo: { precio: saldoRojo, precioBase: precioRojo, prima: primaRojo, cuota: cuotaRojo, cuotas: 4, meses: "2" }
    };
}

function renderDetalleCuotas(cuotas, meses) {
    return `
        <div class="cuotas-popover">
            <button class="btn-cuotas" type="button">Plazo</button>
            <div class="cuotas-card">
                <span>${cuotas} Cuotas</span>
                <span>${meses} Meses</span>
            </div>
        </div>
    `;
}

function renderPlanes(plan) {
    return `
        <div class="plan-container">
            <div class="contado">${colones(plan.contado)}</div>
        </div>
    `;
}

function renderModalLogo() {
    return `<img class="modal-logo" src="imagenes/logo.png" alt="Logo Elite">`;
}

function renderCotizacionPerfume(perfume) {
    const estadoKey = encodeURIComponent(perfume.nombre);
    const sinPrima = Boolean(estadoSinPrima[estadoKey]);
    const plan = calcularPlanes(perfume.costo, sinPrima);
    const nombre = escaparHTML(perfume.nombre);
    const costo = normalizarNumero(perfume.costo);

    return `
        <div class="perfume-cotizacion">
            ${renderModalLogo()}
            <div class="info">
                <h3>${nombre}</h3>
            </div>
            <div class="planes" id="planes-modal-perfume">${renderPlanes(plan)}</div>
            <div class="resultado-acciones">
                <button
                    id="btn-modal-perfume"
                    class="btn-prima${sinPrima ? " activo" : ""}"
                    type="button"
                    data-id-visual="modal-perfume"
                    data-estado-key="${estadoKey}"
                    data-costo="${costo}"
                >SIN PRIMA</button>
            </div>
        </div>
    `;
}

function mostrarPerfumes(lista) {
    const contenedor = document.getElementById("resultados");
    const html = lista.map((perfume) => {
        const nombre = escaparHTML(perfume.nombre);
        const precio = calcularPrecioMayorista(perfume.costo);

        return `
            <div class="perfume-opcion">
                <span class="perfume-nombre">${nombre}</span>
                <strong class="perfume-precio">${colones(precio)}</strong>
            </div>
        `;
    }).join("");

    contenedor.innerHTML = html ? `<div class="perfume-lista">${html}</div>` : "";
}

window.toggleSinPrima = function toggleSinPrima(idVisual, estadoKey, costo) {
    estadoSinPrima[estadoKey] = !estadoSinPrima[estadoKey];
    const activo = estadoSinPrima[estadoKey];
    const plan = calcularPlanes(costo, activo);
    document.getElementById(`planes-${idVisual}`).innerHTML = renderPlanes(plan);
    const boton = document.getElementById(`btn-${idVisual}`);
    boton.classList.toggle("activo", activo);
};

function obtenerConfigPorTipo(tipo) {
    if (tipo === "italiano") {
        return {
            contado: normalizarNumero(goldSettings.precio_contado_italiano),
            pagos: normalizarNumero(goldSettings.precio_pagos_italiano),
            costo: normalizarNumero(goldSettings.costo_italiano),
            titulo: "Oro Italiano"
        };
    }

    return {
        contado: normalizarNumero(goldSettings.precio_contado_nacional),
        pagos: normalizarNumero(goldSettings.precio_pagos_nacional),
        costo: normalizarNumero(goldSettings.costo_nacional),
        titulo: "Oro Nacional"
    };
}

function calcularCotizacionOro({ peso, tipo }) {
    const config = obtenerConfigPorTipo(tipo);
    let precioContado = redondear1000(peso * config.contado);
    if (peso < 2.5) {
        precioContado += 4000;
    }
    const precioPagosBase = redondear1000(peso * config.pagos);
    const prima = redondear1000((peso * config.costo) / 2);
    const cuota = calcularCuotaOro(precioPagosBase);
    const restante = Math.max(precioPagosBase - prima, 0);
    const cuotas = restante === 0 ? 0 : Math.max(1, Math.round(restante / cuota));
    const meses = cuotas === 0 ? "0" : formatearMeses(cuotas);

    return {
        peso,
        tipo,
        titulo: config.titulo,
        contado: precioContado,
        pagosBase: precioPagosBase,
        prima,
        cuota,
        cuotas,
        meses,
        precioPagosFinal: precioPagosBase,
        saldoFinanciar: restante
    };
}

function renderCotizacionOro(cotizacion) {
    return `
        ${renderModalLogo()}
        <div class="gold-resumen">
            <span>${cotizacion.peso} Gramos</span>
            <span>${cotizacion.titulo}</span>
            <small class="gold-resumen-subtitulo">Cotizacion a Pagos:</small>
        </div>

        <div class="planes">
            <div class="plan-container has-cuotas">
                <div class="badge badge-left badge-best">LA MEJOR CUOTA</div>
                <div class="plan rojo">
                    <span>Cuota ${colones(cotizacion.cuota)}</span>
                    <span>Prima ${colones(cotizacion.prima)}</span>
                    <span>Saldo ${colones(cotizacion.saldoFinanciar)}</span>
                </div>
                ${renderDetalleCuotas(cotizacion.cuotas, cotizacion.meses)}
            </div>

            <div class="plan-container">
                <div class="contado">
                    Precio de Contado ${colones(cotizacion.contado)}
                </div>
                <div class="gold-modal-note">
                    Cuotas cada 15 dias
                </div>
            </div>
        </div>
    `;
}

function calcularCotizacionRenovacion(peso) {
    const config = { ...defaultRenewalSettings, ...renewalSettings };
    const precioFinanciado = redondear1000(peso * normalizarNumero(config.precio_financiado_fundir));
    const precioContado = redondear1000(peso * normalizarNumero(config.precio_contado_fundir));
    const prima = redondear1000(peso * normalizarNumero(config.costo_fundir));
    const cuota = calcularCuotaOro(precioFinanciado);

    const saldoFinanciar = Math.max(precioFinanciado - prima, 0);
    const cuotas = saldoFinanciar === 0 ? 0 : Math.max(1, Math.round(saldoFinanciar / cuota));
    const meses = cuotas === 0 ? "0" : formatearMeses(cuotas);

    return {
        peso,
        prima,
        cuota,
        cuotas,
        meses,
        saldoFinanciar,
        contado: precioContado
    };
}

function renderCotizacionRenovacion(cotizacion) {
    return `
        ${renderModalLogo()}
        <div class="gold-resumen">
            <span>${cotizacion.peso} Gramos</span>
            <span>Renovacion ELITE</span>
            <small class="gold-resumen-subtitulo">Cotizacion a Pagos:</small>
        </div>

        <div class="planes">
            <div class="plan-container has-cuotas">
                <div class="badge badge-left badge-best">LA MEJOR CUOTA</div>
                <div class="plan rojo">
                    <span>Cuota ${colones(cotizacion.cuota)}</span>
                    <span>Prima ${colones(cotizacion.prima)}</span>
                    <span>Saldo ${colones(cotizacion.saldoFinanciar)}</span>
                </div>
            </div>

            <div class="plan-container">
                <div class="contado">
                    Precio de Contado ${colones(cotizacion.contado)}
                </div>
            </div>
        </div>
    `;
}

function calcularPrestamo(monto, fechaPrestamo) {
    const totalCincoSemanas = monto * 1.2;
    const cuotaCincoSemanas = totalCincoSemanas / 5;
    const interesSemanal = monto * 0.05;
    const proximaFechaPago = obtenerProximaFechaPago(fechaPrestamo);
    const diasPrimeraCuota = calcularDiasEntre(fechaPrestamo, proximaFechaPago);
    const diasCobrablesPrimeraCuota = diasPrimeraCuota <= 3 ? 0 : diasPrimeraCuota;
    const primeraCuotaProporcional = (interesSemanal / 7) * diasCobrablesPrimeraCuota;
    const proximaFechaSemanal = sumarDias(fechaPrestamo, 7);

    return {
        monto,
        fechaPrestamo,
        diaPago: formatearDiaPago(fechaPrestamo),
        proximaFechaSemanal,
        proximaFechaPago,
        diasPrimeraCuota,
        diasCobrablesPrimeraCuota,
        primeraCuotaProporcional,
        totalCincoSemanas,
        cuotaCincoSemanas,
        interesSemanal,
        interesQuincenal: interesSemanal * 2
    };
}

function calcularPrimaUpgrade(gramosCliente, precioPieza) {
    const costoNacional = normalizarNumero(goldSettings.costo_nacional || defaultGoldSettings.costo_nacional);
    const costoFundicion = normalizarNumero(goldSettings.costo_fundicion || defaultGoldSettings.costo_fundicion);
    const gramosObjetivo = gramosCliente + 2;
    const gramosAdicionales = Math.max(gramosObjetivo - gramosCliente, 0);
    const valorOroEntregado = precioPieza * 0.8;
    const costoFundir = gramosCliente * costoFundicion;
    const costoGramosAdicionales = gramosAdicionales * costoNacional;
    const totalInversion = costoFundir + costoGramosAdicionales;
    const costoPiezaObjetivo = gramosObjetivo * costoNacional;
    const primaSugerida = redondear1000(valorOroEntregado);
    const precioPagosFinal = redondear1000(gramosObjetivo * 60000);
    const cuota = calcularCuotaOro(precioPagosFinal);

    const saldoFinanciar = Math.max(precioPagosFinal - primaSugerida, 0);
    const cuotas = saldoFinanciar === 0 ? 0 : Math.max(1, Math.round(saldoFinanciar / cuota));
    const meses = cuotas === 0 ? "0" : formatearMeses(cuotas);
    const totalGanancia = saldoFinanciar - totalInversion;

    return {
        gramosCliente,
        precioPieza,
        costoNacional,
        costoFundicion,
        gramosObjetivo,
        gramosAdicionales,
        valorOroEntregado,
        costoFundir,
        costoGramosAdicionales,
        totalInversion,
        totalGanancia,
        costoPiezaObjetivo,
        primaSugerida,
        cotizacionPagos: {
            peso: gramosObjetivo,
            cuota,
            cuotas,
            meses,
            saldoFinanciar
        }
    };
}

function formatearGramos(valor) {
    return Number(valor).toLocaleString("es-CR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function renderPrimaUpgrade(cotizacion) {
    return `
        <div class="upgrade-cotizacion">
            ${renderModalLogo()}
            <div class="upgrade-hero">
                <p class="upgrade-frase">Con su oro actual puede subir de nivel sin pagar todo de una.</p>
            </div>

            <div class="upgrade-main-value">
                <span>Valor generado por su oro:</span>
                <strong>${colones(cotizacion.primaSugerida)}</strong>
            </div>

            <div class="upgrade-metrics">
                <div class="upgrade-metric">
                    <span>Oro que entrega</span>
                    <strong>${formatearGramos(cotizacion.gramosCliente)} g</strong>
                </div>
                <div class="upgrade-metric">
                    <span>Nueva Pieza</span>
                    <strong>${formatearGramos(cotizacion.gramosObjetivo)} g</strong>
                </div>
            </div>

            <div class="upgrade-payment-quote">
                <div class="gold-resumen upgrade-payment-heading">
                    <small class="gold-resumen-subtitulo">Cotizacion a Pagos:</small>
                </div>

                <div class="plan-container has-cuotas">
                    <div class="badge badge-left badge-best">LA MEJOR CUOTA</div>
                    <div class="plan rojo upgrade-payment-plan">
                        <span>Cuota ${colones(cotizacion.cotizacionPagos.cuota)}</span>
                        <span>Saldo ${colones(cotizacion.cotizacionPagos.saldoFinanciar)}</span>
                    </div>
                </div>
            </div>

            <div class="upgrade-actions">
                <button class="upgrade-quote-button" type="button" data-upgrade-quote-toggle>Cotizacion</button>
            </div>

            <div class="upgrade-internal-quote" data-upgrade-quote hidden>
                <h4>Cotizacion interna</h4>
                <div class="loan-line">
                    <span>Costo por fundir</span>
                    <strong>${colones(cotizacion.costoFundir)}</strong>
                </div>
                <div class="loan-line">
                    <span>${formatearGramos(cotizacion.gramosAdicionales)} g adicionales</span>
                    <strong>${colones(cotizacion.costoGramosAdicionales)}</strong>
                </div>
                <div class="loan-line upgrade-total-line">
                    <span>Total inversion</span>
                    <strong>${colones(cotizacion.totalInversion)}</strong>
                </div>
                <div class="loan-line upgrade-total-line">
                    <span>Total de ganancia</span>
                    <strong>${colones(cotizacion.totalGanancia)}</strong>
                </div>
            </div>
        </div>
    `;
}

function renderCotizacionPrestamo(prestamo) {
    const mostrarProximaCuota = prestamo.primeraCuotaProporcional > 0;

    return `
        <div class="loan-cotizacion">
            <div class="loan-resumen">
                ${renderModalLogo()}
                <div class="loan-monto">Monto solicitado ${colones(prestamo.monto)}</div>

                <div class="loan-plan loan-plan-indefinido">
                    <div class="loan-plan-header">
                        <h4>Tiempo indefinido</h4>
                        <button
                            class="loan-pill"
                            type="button"
                            data-loan-semanal="${Math.round(prestamo.interesSemanal)}"
                            data-loan-quincenal="${Math.round(prestamo.interesQuincenal)}"
                            data-loan-proxima-monto="${Math.round(prestamo.primeraCuotaProporcional)}"
                        >Quincenal</button>
                    </div>
                    ${mostrarProximaCuota ? `
                    <div class="loan-line loan-proxima-line" hidden>
                        <span>Proxima cuota (${formatearFechaCorta(prestamo.proximaFechaPago)} - ${prestamo.diasCobrablesPrimeraCuota} dias)</span>
                        <strong>${colones(prestamo.primeraCuotaProporcional)}</strong>
                    </div>
                    ` : ""}
                    <div class="loan-line">
                        <span class="loan-cuota-label">Cuota Semanal</span>
                        <strong class="loan-cuota-monto">${colones(prestamo.interesSemanal)}</strong>
                    </div>
                    <div class="loan-line loan-dia-semanal-line">
                        <span>Dia de pago</span>
                        <strong>${prestamo.diaPago}</strong>
                    </div>
                </div>

                <div class="loan-plan">
                    <h4>Pago por Semana / 5 Semanas</h4>
                    <div class="loan-line">
                        <span>Total a pagar</span>
                        <strong>${colones(prestamo.totalCincoSemanas)}</strong>
                    </div>
                    <div class="loan-line">
                        <span>Cuota semanal</span>
                        <strong>${colones(prestamo.cuotaCincoSemanas)}</strong>
                    </div>
                    <div class="loan-line">
                        <span>Dia de pago</span>
                        <strong>${prestamo.diaPago}</strong>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function abrirModalCotizacion(html) {
    const modal = document.getElementById("gold-modal");
    const body = document.getElementById("gold-modal-body");

    if (!modal || !body) {
        return;
    }

    body.innerHTML = html;

    modal.classList.add("visible");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function abrirCotizacionPerfume(perfume) {
    abrirModalCotizacion(renderCotizacionPerfume(perfume));
}

function cerrarModalCotizacion() {
    const modal = document.getElementById("gold-modal");

    if (!modal) {
        return;
    }

    modal.classList.remove("visible");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

function togglePanelActualizacion(forzarVisible) {
    const panel = document.getElementById("gold-settings-panel");
    const boton = document.getElementById("toggle-gold-settings");

    if (!panel || !boton) {
        return;
    }

    const mostrar = typeof forzarVisible === "boolean" ? forzarVisible : panel.hidden;
    panel.hidden = !mostrar;
    boton.textContent = mostrar ? "Ocultar" : "Actualizar";
}

function togglePanelRenovacion(forzarVisible) {
    const panel = document.getElementById("renewal-settings-panel");
    const boton = document.getElementById("toggle-renewal-settings");

    if (!panel || !boton) {
        return;
    }

    const mostrar = typeof forzarVisible === "boolean" ? forzarVisible : panel.hidden;
    panel.hidden = !mostrar;
    boton.textContent = mostrar ? "Ocultar" : "Datos";
}

async function cargarConfiguracionOro() {
    if (!supabaseClient) {
        goldSettings = { ...defaultGoldSettings, ...cargarGoldSettingsLocales() };
        llenarFormularioOro(goldSettings);
        setGoldStatus("Falta pegar tu anon key de Supabase en script.js para sincronizar entre dispositivos.", true);
        return;
    }

    setGoldStatus("Cargando configuracion de oro...");

    try {
        const { data, error } = await supabaseClient
            .from("gold_settings")
            .select("*")
            .eq("id", GOLD_SETTINGS_ID)
            .maybeSingle();

        if (error) {
            throw error;
        }

        goldSettings = { ...defaultGoldSettings, ...cargarGoldSettingsLocales(), ...(data || {}) };
        llenarFormularioOro(goldSettings);

        if (!data) {
            setGoldStatus("No habia configuracion guardada en Supabase. Se cargaron los valores base.");
            return;
        }

        setGoldStatus("Configuracion de oro cargada desde Supabase.");
    } catch (error) {
        console.error(error);
        goldSettings = { ...defaultGoldSettings, ...cargarGoldSettingsLocales() };
        llenarFormularioOro(goldSettings);
        setGoldStatus(`No pude leer gold_settings en Supabase: ${error.message || "error desconocido"}.`, true);
    }
}

async function guardarConfiguracionOro() {
    const payload = {
        id: GOLD_SETTINGS_ID,
        ...leerFormularioOro(),
        updated_at: new Date().toISOString()
    };

    goldSettings = { ...payload };
    guardarGoldSettingsLocales(payload);

    if (!supabaseClient) {
        setGoldStatus("No se puede guardar aun: falta configurar la anon key de Supabase.", true);
        return;
    }

    setGoldStatus("Guardando configuracion de oro...");

    try {
        const { error } = await supabaseClient
            .from("gold_settings")
            .upsert(payload, { onConflict: "id" });

        if (error) {
            throw error;
        }

        setGoldStatus("Datos guardados correctamente en Supabase.");
    } catch (error) {
        console.error(error);
        if (String(error.message || "").toLowerCase().includes("costo_fundicion")) {
            const payloadCompatible = { ...payload };
            delete payloadCompatible.costo_fundicion;

            try {
                const { error: retryError } = await supabaseClient
                    .from("gold_settings")
                    .upsert(payloadCompatible, { onConflict: "id" });

                if (retryError) {
                    throw retryError;
                }

                setGoldStatus("Datos guardados. La fundicion quedo guardada localmente hasta actualizar la tabla.", true);
                return;
            } catch (retryError) {
                console.error(retryError);
            }
        }

        setGoldStatus("No pude guardar los datos en Supabase. Revisa permisos y estructura de la tabla.", true);
    }
}

function cotizarOro() {
    goldSettings = { ...goldSettings, ...leerFormularioOro() };

    const peso = normalizarNumero(document.getElementById("gold-peso").value);
    const tipo = document.getElementById("gold-tipo").value;
    const resultado = document.getElementById("gold-resultado");

    if (peso <= 0) {
        resultado.innerHTML = "";
        setGoldStatus("Ingresa un peso mayor a 0 para cotizar.", true);
        return;
    }

    const cotizacion = calcularCotizacionOro({ peso, tipo });
    const htmlCotizacion = renderCotizacionOro(cotizacion);
    resultado.innerHTML = htmlCotizacion;
    abrirModalCotizacion(htmlCotizacion);
    setGoldStatus(`Cotizacion lista para ${cotizacion.titulo.toLowerCase()}.`);
}

function calcularPrestamoCliente() {
    const input = document.getElementById("loan-monto");
    const fechaInput = document.getElementById("loan-fecha");
    const monto = parsearMoneda(input.value);
    const fechaPrestamo = parsearFechaLocal(fechaInput.value);

    if (monto <= 0) {
        input.focus();
        return;
    }

    if (!fechaPrestamo) {
        fechaInput.focus();
        return;
    }

    input.value = colones(monto);
    abrirModalCotizacion(renderCotizacionPrestamo(calcularPrestamo(monto, fechaPrestamo)));
}

function calcularUpgradeCliente() {
    goldSettings = { ...goldSettings, ...leerFormularioOro() };

    const input = document.getElementById("upgrade-gramos");
    const precioInput = document.getElementById("upgrade-precio-compra");
    const gramosCliente = normalizarNumero(input.value);
    const precioPieza = parsearMoneda(precioInput.value);

    if (gramosCliente <= 0) {
        input.focus();
        return;
    }

    if (precioPieza <= 0) {
        precioInput.focus();
        return;
    }

    precioCompraUpgrade = precioPieza;
    precioInput.value = colones(precioPieza);
    abrirModalCotizacion(renderPrimaUpgrade(calcularPrimaUpgrade(gramosCliente, precioCompraUpgrade)));
}

async function cargarConfiguracionRenovacion() {
    if (!supabaseClient) {
        renewalSettings = { ...defaultRenewalSettings, ...cargarRenewalSettingsLocales() };
        llenarFormularioRenovacion(renewalSettings);
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from("renewal_settings")
            .select("*")
            .eq("id", RENEWAL_SETTINGS_ID)
            .maybeSingle();

        if (error) {
            throw error;
        }

        renewalSettings = { ...defaultRenewalSettings, ...cargarRenewalSettingsLocales(), ...(data || {}) };
        llenarFormularioRenovacion(renewalSettings);
    } catch (error) {
        console.error(error);
        renewalSettings = { ...defaultRenewalSettings, ...cargarRenewalSettingsLocales() };
        llenarFormularioRenovacion(renewalSettings);
    }
}

async function guardarConfiguracionRenovacion() {
    const payload = {
        id: RENEWAL_SETTINGS_ID,
        ...leerFormularioRenovacion(),
        updated_at: new Date().toISOString()
    };

    renewalSettings = { ...defaultRenewalSettings, ...payload };
    guardarRenewalSettingsLocales(renewalSettings);

    if (!supabaseClient) {
        togglePanelRenovacion(false);
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("renewal_settings")
            .upsert(payload, { onConflict: "id" });

        if (error) {
            throw error;
        }

        togglePanelRenovacion(false);
    } catch (error) {
        console.error(error);
        document.getElementById("renewal-status").textContent = "";
    }
}

function cotizarRenovacion() {
    renewalSettings = { ...defaultRenewalSettings, ...leerFormularioRenovacion() };
    guardarRenewalSettingsLocales(renewalSettings);

    const input = document.getElementById("renewal-peso");
    const peso = normalizarNumero(input.value);

    if (peso <= 0) {
        input.focus();
        return;
    }

    abrirModalCotizacion(renderCotizacionRenovacion(calcularCotizacionRenovacion(peso)));
}

function abrirActualizacionUpgrade() {
    togglePanelActualizacion(true);
    const panel = document.getElementById("gold-settings-panel");
    if (panel) {
        panel.scrollIntoView({ behavior: "smooth", block: "center" });
    }
}

function registrarEventosOro() {
    document.getElementById("guardar-oro").addEventListener("click", guardarConfiguracionOro);
    document.getElementById("recargar-oro").addEventListener("click", cargarConfiguracionOro);
    document.getElementById("cotizar-oro").addEventListener("click", cotizarOro);
    document.getElementById("calcular-prestamo").addEventListener("click", calcularPrestamoCliente);
    document.getElementById("calcular-upgrade").addEventListener("click", calcularUpgradeCliente);
    document.getElementById("cotizar-renovacion").addEventListener("click", cotizarRenovacion);
    document.getElementById("guardar-renovacion").addEventListener("click", guardarConfiguracionRenovacion);
    document.getElementById("toggle-gold-settings").addEventListener("click", () => togglePanelActualizacion());
    document.getElementById("toggle-upgrade-settings").addEventListener("click", abrirActualizacionUpgrade);
    document.getElementById("toggle-renewal-settings").addEventListener("click", () => togglePanelRenovacion());
    document.getElementById("gold-modal-close").addEventListener("click", cerrarModalCotizacion);
    document.getElementById("gold-modal").addEventListener("click", event => {
        if (event.target.id === "gold-modal") {
            cerrarModalCotizacion();
        }
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            cerrarModalCotizacion();
        }
    });

    document.getElementById("gold-peso").addEventListener("keydown", event => {
        if (event.key === "Enter") {
            cotizarOro();
        }
    });

    document.getElementById("loan-monto").addEventListener("keydown", event => {
        if (event.key === "Enter") {
            calcularPrestamoCliente();
        }
    });

    document.getElementById("loan-fecha").addEventListener("keydown", event => {
        if (event.key === "Enter") {
            calcularPrestamoCliente();
        }
    });

    document.getElementById("upgrade-gramos").addEventListener("keydown", event => {
        if (event.key === "Enter") {
            calcularUpgradeCliente();
        }
    });

    document.getElementById("upgrade-precio-compra").addEventListener("keydown", event => {
        if (event.key === "Enter") {
            calcularUpgradeCliente();
        }
    });

    document.getElementById("renewal-peso").addEventListener("keydown", event => {
        if (event.key === "Enter") {
            cotizarRenovacion();
        }
    });
}

function registrarBuscadorPerfumes() {
    document.getElementById("buscador").addEventListener("input", function onInput() {
        clearTimeout(busquedaTimer);

        busquedaTimer = setTimeout(() => {
            const texto = normalizarTexto(this.value);
            if (texto.length < 2) {
                document.getElementById("resultados").innerHTML = "";
                toggleGoldVisibility(true);
                return;
            }

            toggleGoldVisibility(false);

            const filtrados = perfumes
                .filter(perfume => perfume.nombreBusqueda.includes(texto))
                .slice(0, 15);

            mostrarPerfumes(filtrados);
        }, 120);
    });

    document.getElementById("gold-modal-body").addEventListener("click", event => {
        const botonQuincenal = event.target.closest(".loan-pill");
        if (botonQuincenal) {
            const plan = botonQuincenal.closest(".loan-plan");
            const label = plan ? plan.querySelector(".loan-cuota-label") : null;
            const monto = plan ? plan.querySelector(".loan-cuota-monto") : null;
            const proxima = plan ? plan.querySelector(".loan-proxima-line") : null;
            const diaSemanal = plan ? plan.querySelector(".loan-dia-semanal-line") : null;
            if (label && monto) {
                const mostrarSemanal = botonQuincenal.classList.contains("activo");
                label.textContent = mostrarSemanal ? "Cuota Semanal" : "Cuota Quincenal";
                monto.textContent = colones(normalizarNumero(
                    mostrarSemanal ? botonQuincenal.dataset.loanSemanal : botonQuincenal.dataset.loanQuincenal
                ));
                if (proxima) {
                    const proximaMonto = normalizarNumero(botonQuincenal.dataset.loanProximaMonto);
                    proxima.hidden = mostrarSemanal || proximaMonto <= 0;
                    if (proximaMonto <= 0) {
                        proxima.remove();
                    }
                }
                if (diaSemanal) {
                    diaSemanal.hidden = !mostrarSemanal;
                }
                botonQuincenal.textContent = mostrarSemanal ? "Quincenal" : "Semanal";
                botonQuincenal.classList.toggle("activo", !mostrarSemanal);
            }
            return;
        }

        const botonCotizacionInterna = event.target.closest("[data-upgrade-quote-toggle]");
        if (botonCotizacionInterna) {
            const cotizacionInterna = document.querySelector("[data-upgrade-quote]");
            if (cotizacionInterna) {
                const mostrarCotizacion = cotizacionInterna.hidden;
                cotizacionInterna.hidden = !mostrarCotizacion;
                botonCotizacionInterna.classList.toggle("activo", mostrarCotizacion);

                if (mostrarCotizacion) {
                    cotizacionInterna.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }
            }
            return;
        }

        const boton = event.target.closest(".btn-prima");
        if (!boton) {
            return;
        }

        window.toggleSinPrima(
            boton.dataset.idVisual,
            boton.dataset.estadoKey,
            normalizarNumero(boton.dataset.costo)
        );
    });
}

async function iniciarApp() {
    supabaseClient = initSupabase();
    renewalSettings = { ...defaultRenewalSettings, ...cargarRenewalSettingsLocales() };
    registrarEventosOro();
    registrarFormatoMoneda();
    registrarBuscadorPerfumes();
    togglePanelActualizacion(false);
    togglePanelRenovacion(false);
    llenarFormularioOro(goldSettings);
    llenarFormularioRenovacion(renewalSettings);
    document.getElementById("upgrade-precio-compra").value = precioCompraUpgrade > 0 ? colones(precioCompraUpgrade) : "";
    toggleGoldVisibility(true);
    await Promise.all([cargarPerfumes(), cargarConfiguracionOro(), cargarConfiguracionRenovacion()]);
}

iniciarApp();
