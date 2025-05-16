const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");

let mainWindow;

app.whenReady().then(() => {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });

    mainWindow.loadFile("index.html");

    mainWindow.webContents.once("did-finish-load", () => {
        const locations = readLocations();
        mainWindow.webContents.send("load-locations", locations);
    });
});

const locationsPath = path.join(__dirname, "locations");
const filePath = path.join(locationsPath, "locations.json");

if (!fs.existsSync(locationsPath)) {
    fs.mkdirSync(locationsPath);
}

const readLocations = () => {
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, "utf8");
            return JSON.parse(data);
        }
    } catch (error) {
        console.error("Error al leer el archivo:", error);
    }
    return [];
};

const writeLocations = (data) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    } catch (error) {
        console.error("Error al escribir en el archivo:", error);
    }
};

ipcMain.on("save-location", (event, newLocation) => {
    const locations = readLocations();
    locations.push(newLocation);
    writeLocations(locations);
});

ipcMain.on("update-location", (event, updatedLocation) => {
    let locations = readLocations();
    locations = locations.map((loc) =>
        loc.nombre === updatedLocation.nombre ? updatedLocation : loc
    );
    writeLocations(locations);
});

ipcMain.on("delete-location", (event, locationToDelete) => {
    const locations = readLocations();
    const updatedLocations = locations.filter(
        loc => loc.nombre !== locationToDelete.nombre
    );
    writeLocations(updatedLocations);
});