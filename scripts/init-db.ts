import { db } from '../server/db';
import { productProperties } from '../shared/schema';

// Standardeigenschaften für die Initialisierung
const defaultProperties = [
  { name: "Artikelnummer", description: "Product article/item number", expectedFormat: "text" },
  { name: "URL", description: "Product URL", expectedFormat: "url" },
  { name: "Page", description: "Page number in catalog", expectedFormat: "number" },
  { name: "ArtikelName", description: "Product name", expectedFormat: "text" },
  { name: "Title", description: "Product title", expectedFormat: "text" },
  { name: "Description", description: "Product description", expectedFormat: "text" },
  { name: "Hersteller", description: "Manufacturer", expectedFormat: "text" },
  { name: "Pflege", description: "Care instructions", expectedFormat: "text" },
  { name: "Befestigung", description: "Mounting/fastening type", expectedFormat: "text" },
  { name: "Decklung", description: "Lid type/cover", expectedFormat: "text" },
  { name: "Fangkorb", description: "Catch basket", expectedFormat: "text" },
  { name: "Höhe", description: "Height", expectedFormat: "in mm/cm" },
  { name: "Breite", description: "Width", expectedFormat: "in mm/cm" },
  { name: "Tiefe", description: "Depth", expectedFormat: "in mm/cm" },
  { name: "Durchmesser", description: "Diameter", expectedFormat: "in mm/cm" },
  { name: "Brennstoff", description: "Fuel type", expectedFormat: "text" },
  { name: "Deckel", description: "Lid information", expectedFormat: "text" },
  { name: "Sichtfenstergröße", description: "Viewing window size", expectedFormat: "in mm/cm" },
  { name: "Farbe", description: "Color", expectedFormat: "text" },
  { name: "Gewicht", description: "Weight", expectedFormat: "in kg" },
  { name: "Material", description: "Main material of the product", expectedFormat: "text" },
  { name: "Leistung", description: "Power/performance", expectedFormat: "in kW" },
  { name: "Energieeffizienzklasse", description: "Energy efficiency class", expectedFormat: "A++, A+, A, B, etc." },
  { name: "Wirkungsgrad", description: "Efficiency rating", expectedFormat: "percentage" }
];

// Datenbank mit Standardeigenschaften initialisieren
async function initDb() {
  console.log('Initialisiere Datenbank mit Standardeigenschaften...');
  
  try {
    // Prüfen, ob bereits Eigenschaften vorhanden sind
    const existingProperties = await db.select().from(productProperties);
    
    if (existingProperties.length === 0) {
      console.log('Keine Eigenschaften gefunden. Füge Standardeigenschaften hinzu...');
      
      // Eigenschaften in Batches einfügen
      for (const property of defaultProperties) {
        await db.insert(productProperties).values(property);
      }
      
      console.log(`${defaultProperties.length} Standardeigenschaften wurden hinzugefügt.`);
    } else {
      console.log(`${existingProperties.length} Eigenschaften sind bereits in der Datenbank vorhanden.`);
    }
  } catch (error) {
    console.error('Fehler beim Initialisieren der Datenbank:', error);
  }
}

// Script ausführen
initDb()
  .then(() => {
    console.log('Datenbankinitialisierung abgeschlossen.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fehler beim Ausführen des Scripts:', error);
    process.exit(1);
  });