const { ipcRenderer } = require("electron");

document.addEventListener("DOMContentLoaded", () => {
    // Agregar el código del panel colapsable al inicio
    const markersPanel = document.getElementById('markers-panel');
    const toggleButton = document.getElementById('toggle-panel');
    let isPanelVisible = false;

    toggleButton.addEventListener('click', () => {
        isPanelVisible = !isPanelVisible;
        markersPanel.classList.toggle('visible');
        toggleButton.textContent = isPanelVisible ? '▶' : '◀';
    });

    const map = L.map("map").setView([38.7886, 0.1629], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const searchInput = document.getElementById("search-input");
    const searchButton = document.getElementById("search-btn");

    function searchLocation() {
        const query = searchInput.value.trim();
        if (query === "") return;

        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                if (data.length > 0) {
                    const { lat, lon } = data[0];
                    map.setView([lat, lon], 13);
                } else {
                    alert("Ubicación no encontrada.");
                }
            })
            .catch(error => console.error("Error en la búsqueda:", error));
    }

    searchButton.addEventListener("click", searchLocation);
    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") searchLocation();
    });

    let selectedLocation = null;
    const sidePanel = document.getElementById("side-panel");
    const coordinatesDisplay = document.getElementById("coordinates-display");
    const cancelButton = document.getElementById("cancel-place");

    map.on("click", (e) => {
        const { lat, lng } = e.latlng;
        selectedLocation = { lat, lng };
        
        // Mostrar el panel lateral y actualizar las coordenadas
        sidePanel.style.display = "block";
        coordinatesDisplay.textContent = `Coordenadas: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        
        // Limpiar el formulario
        document.getElementById("place-name").value = "";
        document.getElementById("description").value = "";
        document.getElementById("question").value = "";
        document.getElementById("correct").value = "";
        document.getElementById("wrong1").value = "";
        document.getElementById("wrong2").value = "";
        document.getElementById("wrong3").value = "";
    });

    cancelButton.addEventListener("click", () => {
        sidePanel.style.display = "none";
        selectedLocation = null;
    });

    document.getElementById("save-place").addEventListener("click", () => {
        if (!selectedLocation) return;

        const nombre = document.getElementById("place-name").value.trim();
        const descripcion = document.getElementById("description").value.trim();
        const texto = document.getElementById("question").value.trim();
        const correct = document.getElementById("correct").value.trim();
        const wrong1 = document.getElementById("wrong1").value.trim();
        const wrong2 = document.getElementById("wrong2").value.trim();
        const wrong3 = document.getElementById("wrong3").value.trim();

        if (!nombre || !descripcion || !texto || !correct || !wrong1 || !wrong2 || !wrong3) {
            alert("Todos los campos son obligatorios.");
            return;
        }

        const placeData = {
            nombre,
            descripcion,
            coordenadas: { 
                lat: selectedLocation.lat.toFixed(6), 
                lng: selectedLocation.lng.toFixed(6) 
            },
            pregunta: {
                texto,
                opciones: [correct, wrong1, wrong2, wrong3]
            }
        };

        // Agregar el marcador al mapa y obtener la referencia
        const marker = addMarker(placeData);
        markersMap.set(placeData.nombre, marker);

        // Crear y agregar la tarjeta al panel de marcadores
        const markersList = document.getElementById('markers-list');
        const card = document.createElement('div');
        card.className = 'marker-card';
        
        card.innerHTML = `
            <h3>${placeData.nombre}</h3>
            <p class="coords">Lat: ${placeData.coordenadas.lat}, Lng: ${placeData.coordenadas.lng}</p>
            <p>${placeData.descripcion}</p>
            <div class="question">
                <strong>Pregunta:</strong> ${placeData.pregunta.texto}
            </div>
            <button class="locate-btn">Localizar en mapa</button>
            <button class="delete-btn" style="background: #dc3545; margin-left: 10px;">Eliminar</button>
        `;

        const locateBtn = card.querySelector('.locate-btn');
        locateBtn.addEventListener('click', () => {
            const lat = parseFloat(placeData.coordenadas.lat);
            const lng = parseFloat(placeData.coordenadas.lng);
            if (!isNaN(lat) && !isNaN(lng)) {
                map.setView([lat, lng], 15);
            }
        });

        const deleteBtn = card.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => {
            if (confirm('¿Estás seguro de que quieres eliminar este marcador?')) {
                map.removeLayer(marker);
                markersMap.delete(placeData.nombre);
                card.remove();
                ipcRenderer.send("delete-location", placeData);
            }
        });

        markersList.appendChild(card);

        // Enviar la información al proceso principal
        ipcRenderer.send("save-location", placeData);
        
        // Limpiar y cerrar el formulario
        sidePanel.style.display = "none";
        selectedLocation = null;
    });

    let markersMap = new Map(); // Para mantener un registro de los marcadores

    function addMarker(placeData) {
        const { nombre, descripcion, coordenadas, pregunta } = placeData;
    
        const marker = L.marker([parseFloat(coordenadas.lat), parseFloat(coordenadas.lng)], { draggable: true }).addTo(map);
        markersMap.set(nombre, marker);
    
        marker.on("click", () => {
            if (pregunta) {
                const opciones = [...pregunta.opciones].sort(() => Math.random() - 0.5);
                const opcionesHtml = opciones.map(op => `<button class="option-btn">${op}</button>`).join("<br>");
    
                const html = `
                    <b>${nombre}</b><br>
                    <p style="color: #666; margin: 5px 0;">${descripcion}</p>
                    <small>Coordenadas: ${coordenadas.lat}, ${coordenadas.lng}</small><br><br>
                    <i>${pregunta.texto}</i><br><br>
                    ${opcionesHtml}
                `;
    
                const popup = L.popup({
                    closeOnClick: false,
                    autoClose: false,
                    className: 'question-popup'
                }).setLatLng(marker.getLatLng()).setContent(html);
    
                marker.bindPopup(popup).openPopup();
    
                const closePopup = () => {
                    popup.remove();
                    marker.unbindPopup();
                    map.off('click', handleMapClick);
                };
    
                const handleMapClick = (e) => {
                    const clickedElement = e.originalEvent.target;
                    if (!clickedElement.closest('.leaflet-popup')) {
                        closePopup();
                    }
                };
    
                map.on('click', handleMapClick);
    
                setTimeout(() => {
                    document.querySelectorAll(".option-btn").forEach(btn => {
                        btn.addEventListener("click", () => {
                            if (btn.textContent === pregunta.opciones[0]) {
                                alert("✅ ¡Correcto!");
                            } else {
                                alert("❌ Incorrecto.");
                            }
                            closePopup();
                        });
                    });
                }, 100);
            }
        });

    marker.on("dragend", (e) => {
        const { lat, lng } = e.target.getLatLng();
        const updated = {
            nombre,
            descripcion,
            coordenadas: { lat: lat.toFixed(6), lng: lng.toFixed(6) },
            pregunta
        };
        ipcRenderer.send("update-location", updated);
    });

    return marker; // Retornamos el marcador para poder referenciarlo después
}

function updateMarkersList(locations) {
    const markersList = document.getElementById('markers-list');
    if (!markersList) return;
    
    // Limpiar marcadores antiguos del mapa
    markersMap.forEach(marker => map.removeLayer(marker));
    markersMap.clear();
    markersList.innerHTML = '';
    
    locations.forEach(location => {
        const card = document.createElement('div');
        card.className = 'marker-card';
        
        const description = location.descripcion || 'Sin descripción';
        
        card.innerHTML = `
            <h3>${location.nombre}</h3>
            <p class="coords">Lat: ${location.coordenadas.lat}, Lng: ${location.coordenadas.lng}</p>
            <p>${description}</p>
            <div class="question">
                <strong>Pregunta:</strong> ${location.pregunta.texto}
            </div>
            <button class="locate-btn">Localizar en mapa</button>
            <button class="delete-btn" style="background: #dc3545; margin-left: 10px;">Eliminar</button>
        `;

        const marker = addMarker(location);

        const locateBtn = card.querySelector('.locate-btn');
        locateBtn.addEventListener('click', () => {
            const lat = parseFloat(location.coordenadas.lat);
            const lng = parseFloat(location.coordenadas.lng);
            if (!isNaN(lat) && !isNaN(lng)) {
                map.setView([lat, lng], 15);
            }
        });

        const deleteBtn = card.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => {
            if (confirm('¿Estás seguro de que quieres eliminar este marcador?')) {
                map.removeLayer(marker);
                markersMap.delete(location.nombre);
                card.remove();
                ipcRenderer.send("delete-location", location);
            }
        });

        markersList.appendChild(card);
    });
}

    // Cargar marcadores al inicio
    ipcRenderer.on("load-locations", (event, locations) => {
        if (Array.isArray(locations)) {
            updateMarkersList(locations);
        }
    });

    // Actualizar cuando se guarda un nuevo marcador
    document.getElementById("save-place").addEventListener("click", () => {
        if (!selectedLocation) return;

        const nombre = document.getElementById("place-name").value.trim();
        const descripcion = document.getElementById("description").value.trim();
        const texto = document.getElementById("question").value.trim();
        const correct = document.getElementById("correct").value.trim();
        const wrong1 = document.getElementById("wrong1").value.trim();
        const wrong2 = document.getElementById("wrong2").value.trim();
        const wrong3 = document.getElementById("wrong3").value.trim();

        if (!nombre || !descripcion || !texto || !correct || !wrong1 || !wrong2 || !wrong3) {
            alert("Todos los campos son obligatorios.");
            return;
        }

        const placeData = {
            nombre,
            descripcion,
            coordenadas: { 
                lat: selectedLocation.lat.toFixed(6), 
                lng: selectedLocation.lng.toFixed(6) 
            },
            pregunta: {
                texto,
                opciones: [correct, wrong1, wrong2, wrong3]
            }
        };

        // Primero agregamos el marcador al mapa
        addMarker(placeData);

        // Luego actualizamos la lista de marcadores
        const markersList = document.getElementById('markers-list');
        const card = document.createElement('div');
        card.className = 'marker-card';
        
        card.innerHTML = `
            <h3>${placeData.nombre}</h3>
            <p class="coords">Lat: ${placeData.coordenadas.lat}, Lng: ${placeData.coordenadas.lng}</p>
            <p>${placeData.descripcion}</p>
            <div class="question">
                <strong>Pregunta:</strong> ${placeData.pregunta.texto}
            </div>
            <button class="locate-btn">Localizar en mapa</button>
            <button class="delete-btn" style="background: #dc3545; margin-left: 10px;">Eliminar</button>
        `;

        const locateBtn = card.querySelector('.locate-btn');
        locateBtn.addEventListener('click', () => {
            const lat = parseFloat(placeData.coordenadas.lat);
            const lng = parseFloat(placeData.coordenadas.lng);
            if (!isNaN(lat) && !isNaN(lng)) {
                map.setView([lat, lng], 15);
            }
        });

        const deleteBtn = card.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => {
            if (confirm('¿Estás seguro de que quieres eliminar este marcador?')) {
                const marker = markersMap.get(placeData.nombre);
                if (marker) {
                    map.removeLayer(marker);
                    markersMap.delete(placeData.nombre);
                }
                card.remove();
                ipcRenderer.send("delete-location", placeData);
            }
        });

        markersList.appendChild(card);

        // Enviamos la información al proceso principal
        ipcRenderer.send("save-location", placeData);
        
        // Limpiamos y cerramos el formulario
        sidePanel.style.display = "none";
        selectedLocation = null;
    });
});