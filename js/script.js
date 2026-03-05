// CONFIGURACIÓN: Enlace directo a tu GeoJSON en GitHub
const urlGeoJSON = "https://raw.githubusercontent.com/WireNext/AlertasAemet/refs/heads/main/avisos_espana.geojson";

// 1. TEMA
function initTheme() {
    const theme = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", theme);
    const btn = document.getElementById("theme-toggle");
    if (btn) {
        btn.onclick = () => {
            const current = document.documentElement.getAttribute("data-theme");
            const nuevo = current === "dark" ? "light" : "dark";
            document.documentElement.setAttribute("data-theme", nuevo);
            localStorage.setItem("theme", nuevo);
        };
    }
}

// 2. MATEMÁTICAS: Punto en Polígono (Compatible con Polygons y MultiPolygons)
function puntoEnPoligono(lat, lon, coords) {
    let inside = false;
    // Normalizamos la estructura para que siempre sea una lista de anillos
    let rings = Array.isArray(coords[0][0][0]) ? coords[0][0] : (Array.isArray(coords[0][0]) ? coords[0] : coords);

    for (let i = 0, j = rings.length - 1; i < rings.length; j = i++) {
        let xi = rings[i][0], yi = rings[i][1];
        let xj = rings[j][0], yj = rings[j][1];
        let intersect = ((yi > lat) != (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// 3. OBTENER AVISO DEL GEOJSON
async function obtenerAvisoDesdeGeoJSON(lat, lon) {
    try {
        const res = await fetch(urlGeoJSON);
        const data = await res.json();
        
        for (const feature of data.features) {
            const coords = feature.geometry.coordinates;
            if (puntoEnPoligono(lat, lon, coords)) {
                const props = feature.properties;
                const temp = document.createElement("div");
                temp.innerHTML = props.popup_html;
                
                // Extraemos la descripción que sigue a la palabra "Descripción:"
                let descDetallada = "";
                const parrafos = temp.querySelectorAll("p");
                parrafos.forEach(p => {
                    if (p.innerText.includes("Descripción:")) {
                        descDetallada = p.innerText.split("Descripción:")[1].trim();
                    }
                });

                return {
                    titulo: temp.querySelector("h3") ? temp.querySelector("h3").innerText : "Avís Actiu",
                    desc: descDetallada || (temp.querySelector("p:nth-of-type(3)") ? temp.querySelector("p:nth-of-type(3)").innerText : "Consulta els detalls."),
                    color: props.fillColor || "#f3f702"
                };
            }
        }
    } catch (e) { console.error("Error cargando avisos:", e); }
    return null;
}

// 4. LÓGICA DE TIEMPO
async function buscarTiempo(poble, targetId) {
    const container = document.getElementById(targetId);
    try {
        const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(poble)}&count=1&language=ca`);
        const geoData = await geo.json();
        if (!geoData.results) return;
        const m = geoData.results[0];
        
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${m.latitude}&longitude=${m.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,apparent_temperature,wind_speed_10m&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max&timezone=auto`);
        const d = await res.json();
        
        const aviso = await obtenerAvisoDesdeGeoJSON(m.latitude, m.longitude);
        renderizar(d, m.name, targetId, aviso);
    } catch (e) { console.error(e); }
}

function obtenerIcono(code) {
    if (code <= 1) return "☀️"; if (code <= 3) return "🌤️";
    if (code <= 48) return "🌫️"; if (code <= 67) return "🌧️";
    if (code <= 82) return "🌧️"; if (code <= 99) return "🌩️";
    return "🌡️";
}

// 5. RENDERIZAR
function renderizar(data, nombre, targetId, aviso) {
    const container = document.getElementById(targetId);
    const { current, daily, hourly } = data;
    const horaActual = new Date().getHours();

    let alertaHtml = "";
    if (aviso) {
        const textColor = (aviso.color === "#f3f702" || aviso.color === "yellow") ? "#222" : "#fff";
        alertaHtml = `
            <div class="alerta-card" style="background-color: ${aviso.color}; color: ${textColor}">
                <h4>${aviso.titulo}</h4>
                <div class="alerta-desc">${aviso.desc}</div>
                <a href="avisos.html" class="alerta-link" style="color: ${textColor}; border-color: ${textColor}">Llegir més</a>
            </div>
        `;
    }

    let html = `
        <div class="weather-hero">
            <h1 class="hero-pueblo">${nombre}</h1>
            <div class="hero-temp">${Math.round(current.temperature_2m)}°</div>
            <div class="hero-icon">${obtenerIcono(current.weather_code)}</div>
            <div class="hero-range">MÀX: ${Math.round(daily.temperature_2m_max[0])}° &nbsp;&nbsp; MÍN: ${Math.round(daily.temperature_2m_min[0])}°</div>
        </div>

        ${alertaHtml}

        <div class="column">
            <h2>Pròximes 24 hores</h2>
            <div class="scroll-x">`;
    
    for (let i = horaActual; i < horaActual + 24; i++) {
        html += `
            <div class="hora-item">
                <span class="hora-txt">${i === horaActual ? 'Ara' : (i % 24) + 'h'}</span>
                <span class="hora-icon">${obtenerIcono(hourly.weather_code[i])}</span>
                <span class="hora-temp">${Math.round(hourly.temperature_2m[i])}°</span>
            </div>`;
    }
    
    html += `</div></div><div class="column"><h2>Previsió 7 dies</h2><div class="lista-vertical">`;
    
    for (let i = 0; i < 7; i++) {
        const diaNombre = new Date(daily.time[i]).toLocaleDateString("ca", { weekday: 'long' });
        html += `
            <div class="dia-fila">
                <span class="dia-nom">${i === 0 ? 'Hui' : diaNombre}</span>
                <span class="dia-icon">${obtenerIcono(daily.weather_code[i])}</span>
                <span class="dia-temps">
                    ${Math.round(daily.temperature_2m_max[i])}° <small>${Math.round(daily.temperature_2m_min[i])}°</small>
                </span>
            </div>`;
    }
    
    html += `</div></div><div class="detalles-grid">
            <div class="detalle-card"><h3>💨 VENT</h3><div class="detalle-valor">${Math.round(current.wind_speed_10m)} <small>km/h</small></div></div>
            <div class="detalle-card"><h3>💧 HUMITAT</h3><div class="detalle-valor">${current.relative_humidity_2m}%</div></div>
            <div class="detalle-card"><h3>☀️ UV</h3><div class="detalle-valor">${Math.round(daily.uv_index_max[0])}</div></div>
            <div class="detalle-card"><h3>☔ PLUJA</h3><div class="detalle-valor">${hourly.precipitation_probability[horaActual]}%</div></div>
        </div>`;

    container.innerHTML = html;
}

// 6. INIT
document.addEventListener("DOMContentLoaded", async () => {
    initTheme();
    const input = document.getElementById("buscador-input");
    const btn = document.getElementById("btn-buscar");
    const dl = document.getElementById("municipios");

    const ejecutar = () => {
        const p = input.value.trim();
        if (p) {
            localStorage.setItem("ultimPobleBuscat", p);
            buscarTiempo(p, "resultado-tiempo-home");
            input.blur();
        }
    };

    if (btn) btn.onclick = ejecutar;
    if (input) {
        input.addEventListener("keypress", (e) => { if (e.key === "Enter") ejecutar(); });
        try {
            const res = await fetch("municipis.json");
            const data = await res.json();
            data.municipis.forEach(m => {
                const o = document.createElement("option"); o.value = m; dl.appendChild(o);
            });
        } catch (e) {}
    }

    const guardado = localStorage.getItem("ultimPobleBuscat");
    if (guardado) buscarTiempo(guardado, "resultado-tiempo-home");
});