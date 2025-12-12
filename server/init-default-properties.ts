import { db } from './db';
import { sql } from 'drizzle-orm';

/**
 * Default properties for the "Kamin" product type
 * Extracted from Kamin_properties.xlsx
 */
const DEFAULT_KAMIN_PROPERTIES = [
  { name: "Höhe in mm", description: "Höhe des Produktes in mm", expectedFormat: "", orderIndex: 1 },
  { name: "Artikelnummer", description: "Artikelnummer des Produkts", expectedFormat: "Auto-detect", orderIndex: 2 },
  { name: "Produktname", description: "Produktname", expectedFormat: "Auto-detect", orderIndex: 3 },
  { name: "Bauart 1 oder 2 (oder Mehrfachbelegung)", description: "selbstschließende Tür (Bauart 1) oder nicht selbstschließende Tür (Bauart 2) bzw. Mehrfachbelegung möglich oder nicht.", expectedFormat: "Auto-detect", orderIndex: 4 },
  { name: "Brennstoff", description: "Brennstoff mit dem Kamin zu betreiben ist", expectedFormat: "Auto-detect", orderIndex: 5 },
  { name: "Farbe", description: "Farbe des Produkts", expectedFormat: "Auto-detect", orderIndex: 6 },
  { name: "Farbe Korpus", description: "Farbe des Grundkörpers des Produkts", expectedFormat: "Auto-detect", orderIndex: 7 },
  { name: "Farbe (Filter)", description: "Farbe des Produkts", expectedFormat: "Auto-detect", orderIndex: 8 },
  { name: "Form", description: "Form des Produkts z.B. rund, rechteckig, oval", expectedFormat: "Auto-detect", orderIndex: 9 },
  { name: "Getrennte Primär- und Sekundärluft (wenn vorhanden)", description: "Getrennte Primär- und Sekundärluft möglich: ja oder nein", expectedFormat: "Auto-detect", orderIndex: 10 },
  { name: "Herkunftsland", description: "Herkunftsland aus dem das Produkt stammt", expectedFormat: "Auto-detect", orderIndex: 11 },
  { name: "Material Brennraum", description: "Material des Brennraumes des Produkts", expectedFormat: "Auto-detect", orderIndex: 12 },
  { name: "Material Korpus", description: "Material des Korpus des Produkts", expectedFormat: "Auto-detect", orderIndex: 13 },
  { name: "Material Verglasung", description: "Material der Frontscheibe des Kamins", expectedFormat: "Auto-detect", orderIndex: 14 },
  { name: "Material Verkleidung", description: "Material der Verkleidung des Kamins", expectedFormat: "Auto-detect", orderIndex: 15 },
  { name: "Nennwärmeleistung (Filter)", description: "Spanne der Nennwärmeleistung z.B. 6-7kW", expectedFormat: "Auto-detect", orderIndex: 16 },
  { name: "Nennwärmeleistung (in kW )", description: "Nennwärmeleistung (in kW ) des Produkts", expectedFormat: "Auto-detect", orderIndex: 17 },
  { name: "Nennwärmeleistung luftseitig", description: "Nennwärmeleistung luftseitig eines wasserführenden Ofens", expectedFormat: "Auto-detect", orderIndex: 18 },
  { name: "Nennwärmeleistung wasserseitig", description: "Nennwärmeleistung wasserseitig eines wasserführenden Ofens", expectedFormat: "Auto-detect", orderIndex: 19 },
  { name: "Normen", description: "erfüllte Normen, Standards und Zulassungen des Produkts", expectedFormat: "Auto-detect", orderIndex: 20 },
  { name: "Ø Rauchrohr (in mm)", description: "Durchmesser des Rauchrohres in mm", expectedFormat: "Auto-detect", orderIndex: 21 },
  { name: "Rauchrohranschluss", description: "Anschluss des Rauchrohres an den Kamin: oben, hinten, seitlich", expectedFormat: "Auto-detect", orderIndex: 22 },
  { name: "Produkttyp", description: "Kategorie des Produkts z.B. Kamin, Kaminzubehör, Grill", expectedFormat: "Auto-detect", orderIndex: 23 },
  { name: "Scheibenspülung (wenn vorhanden)", description: "automatische Scheibenspülung durch Luftzirkulation", expectedFormat: "Auto-detect", orderIndex: 24 },
  { name: "Verbrennungsluft (extern, DIBt oder RLU / wenn vorhanden)", description: "Verbrennungsluft des Produkts: extern, DIBt oder RLU", expectedFormat: "Auto-detect", orderIndex: 25 },
  { name: "Zuluftanschluss (oben, unten, links, rechts, seitlich, hinten)", description: "Zuluftanschluss des Produkts: oben, unten, links, rechts, seitlich, hinten", expectedFormat: "Auto-detect", orderIndex: 26 },
  { name: "Ø Externe Zuluft (in mm)", description: "Durchmesser Externe Zuluftanschluss in mm", expectedFormat: "Auto-detect", orderIndex: 27 },
  { name: "Verglasung", description: "Verglasung des Produkts z.B. Front, 2-seitig, Tunnel, etc.", expectedFormat: "Auto-detect", orderIndex: 28 },
  { name: "Vorteile", description: "Vorteile und Besonderheiten des Produkts", expectedFormat: "Auto-detect", orderIndex: 29 },
  { name: "Max. Raumheizvermögen (in m³)", description: "gibt max. Raumheizvermögen (in m³) des Kamins an", expectedFormat: "Auto-detect", orderIndex: 30 },
  { name: "Energieeffizienzklasse", description: "Energieeffizienzklasse des Produkts", expectedFormat: "Auto-detect", orderIndex: 31 },
  { name: "Abgasmassenstrom max. (in g/s)", description: "Abgasmassenstrom max, (in g/s) des Produkts", expectedFormat: "Auto-detect", orderIndex: 32 },
  { name: "Abgastemperatur Stutzen max. (in °C)", description: "Abgastemperatur am Stutzen max. (in °C), Rauchgasaustrittstemperatur", expectedFormat: "Auto-detect", orderIndex: 33 },
  { name: "Höhe (in mm)", description: "Höhe (in mm) des Produkts", expectedFormat: "Auto-detect", orderIndex: 34 },
  { name: "Breite (in mm)", description: "Breite (in mm) des Produkts", expectedFormat: "Auto-detect", orderIndex: 35 },
  { name: "Tiefe (in mm)", description: "Tiefe (in mm) des Produkts", expectedFormat: "Auto-detect", orderIndex: 36 },
  { name: "Höhe Brennraum (in mm) - wenn vorhanden", description: "Höhe des Brennraumes oder Feuerraumes (in mm) des Produkts", expectedFormat: "Auto-detect", orderIndex: 37 },
  { name: "Breite Brennraum (in mm) - wenn vorhanden", description: "Breite des Brennraumes oder Feuerraumes (in mm) des Produkts", expectedFormat: "Auto-detect", orderIndex: 38 },
  { name: "Tiefe Brennraum (in mm) - wenn vorhanden", description: "Tiefe des Brennraumes oder Feuerraumes (in mm) des Produkts", expectedFormat: "Auto-detect", orderIndex: 39 },
  { name: "Brennstoffverbrauch (in kg/h)", description: "Brennstoffverbrauch des Produkts (in kg/h)", expectedFormat: "Auto-detect", orderIndex: 40 },
  { name: "CO-Emission (in mg/m³)", description: "CO-Emission (in mg/m³) des Produkts", expectedFormat: "Auto-detect", orderIndex: 41 },
  { name: "Gewicht (in kg)", description: "Gewicht (in kg) des Produkts", expectedFormat: "Auto-detect", orderIndex: 42 },
  { name: "Länge Brennmaterial max. (in cm)", description: "Länge Brennmaterial max. (in cm) des Produkts", expectedFormat: "Auto-detect", orderIndex: 43 },
  { name: "Notwendiger Förderdruck bei Nennwärmeleistung (in Pa)", description: "Notwendiger Förderdruck bei Nennwärmeleistung (in Pa) des Produkts", expectedFormat: "Auto-detect", orderIndex: 44 },
  { name: "Sicherheitsabstand hinten (in mm)", description: "Sicherheitsabstand nach hinten (in mm)", expectedFormat: "Auto-detect", orderIndex: 45 },
  { name: "Sicherheitsabstand seitlich (in mm)", description: "Sicherheitsabstand zur Seite (in mm)", expectedFormat: "Auto-detect", orderIndex: 46 },
  { name: "Sicherheitsabstand vorn (in mm)", description: "Sicherheitsabstand nach vorn (in mm)", expectedFormat: "Auto-detect", orderIndex: 47 },
  { name: "Staubemission (in mg/m³)", description: "Staubemission oder Partikelemission (in mg/m³)", expectedFormat: "Auto-detect", orderIndex: 48 },
  { name: "Wirkungsgrad (in %)", description: "Wirkungsgrad (in %) des Produkts", expectedFormat: "Auto-detect", orderIndex: 49 },
  { name: "Aschekasten", description: "Ist Aschekasten fest verbaut oder entnehmbar", expectedFormat: "Auto-detect", orderIndex: 50 },
  { name: "24 h Dauerbetrieb", description: "Eignung Kamin für 24 h Dauerbetrieb", expectedFormat: "Auto-detect", orderIndex: 51 },
  { name: "Ausstattung", description: "Ausstattung des Produkts z.B. Kochplatte, Backfach, automatische Zündung, Schiebetür, kanalisierbare Warmluftverteilung", expectedFormat: "Auto-detect", orderIndex: 52 },
  { name: "Warmluftkanalisierung (oben, hinten, seitlich)", description: "Anschluss der Warmluftkanalisierung oben, hinten, seitlich", expectedFormat: "Auto-detect", orderIndex: 53 },
  { name: "Ø Warmluftkanalisierung (in mm)", description: "Ø Anschluss Warmluftkanalisierung (in mm)", expectedFormat: "Auto-detect", orderIndex: 54 },
  { name: "Drehbar", description: "ist Kamin drehbar; falls möglich mit \"ja\" ausfüllen", expectedFormat: "Auto-detect", orderIndex: 55 },
  { name: "Förderfähigkeit", description: "Förderfähigkeit nach BEG EM", expectedFormat: "Auto-detect", orderIndex: 56 },
  { name: "Material Herdplatte", description: "Material der Herdplatte des Ofens", expectedFormat: "Auto-detect", orderIndex: 57 },
  { name: "Material Topplatte", description: "Material der Topplatte des Ofens", expectedFormat: "Auto-detect", orderIndex: 58 },
  { name: "Sicherheitswärmetauscher", description: "Sicherheitswärmetauscher: wenn vorhanden, dann \"ja\"", expectedFormat: "Auto-detect", orderIndex: 59 },
  { name: "Höhe Backfach", description: "Höhe des Backfachs des Produkts", expectedFormat: "Auto-detect", orderIndex: 60 },
  { name: "Breite Backfach", description: "Breite des Backfachs des Produkts", expectedFormat: "Auto-detect", orderIndex: 61 },
  { name: "Tiefe Backfach", description: "Tiefe des Backfachs des Produkts", expectedFormat: "Auto-detect", orderIndex: 62 },
  { name: "Volumen Pelletbehälter (in kg)", description: "Befüllung Vorratsbehälter, Fassungsvermögen Pellettank in kg", expectedFormat: "Auto-detect", orderIndex: 63 },
  { name: "Spannung (in V)", description: "Spannung des Produkts", expectedFormat: "Auto-detect", orderIndex: 64 },
  { name: "Höhe bis Rauchrohranschluss hinten in mm", description: "Abstand vom Boden bis zur Mitte des Rauchrohranschlusses in mm", expectedFormat: "Auto-detect", orderIndex: 65 },
  { name: "Höhe bis Rauchrohranschluss oben in mm", description: "Abstand von Boden des Geräts bis oberen Rauchrohranschluss", expectedFormat: "Auto-detect", orderIndex: 66 },
  { name: "Höhe bis Verbrennungsluftanschluss (Mitte) (in mm)", description: "Abstand von Boden des Geräts bis zur Mitte des Verbrennungsluftanschluss", expectedFormat: "Auto-detect", orderIndex: 67 },
  { name: "Brenndauer einer Füllung mindestens in Stunden/ Max. Brenndauer [h]", description: "Funktionsdauer Kamin nach einer Befüllung mit Brennstoff in h", expectedFormat: "Auto-detect", orderIndex: 68 },
  { name: "Zugelassener Brennstoff", description: "Empfohlener Brennstoff zur ordnungsgemäßen Bedienung des Gerät", expectedFormat: "Auto-detect", orderIndex: 69 }
];

/**
 * Initialize default properties for the Kamin table
 * This function should be called when a new Kamin property table is created
 */
export async function initializeDefaultKaminProperties(propertyTableId: number): Promise<void> {
  try {
    console.log(`[INIT-DEFAULT-PROPS] Initializing ${DEFAULT_KAMIN_PROPERTIES.length} default properties for Kamin table (ID: ${propertyTableId})...`);
    
    // Check if properties already exist for this table
    const existingProps = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM product_properties 
      WHERE property_table_id = ${propertyTableId}
    `);
    
    const count = (existingProps.rows[0] as any)?.count || 0;
    
    if (count > 0) {
      console.log(`[INIT-DEFAULT-PROPS] Table already has ${count} properties, skipping initialization`);
      return;
    }
    
    // Insert all default properties
    let insertedCount = 0;
    for (const prop of DEFAULT_KAMIN_PROPERTIES) {
      try {
        await db.execute(sql`
          INSERT INTO product_properties (
            property_table_id,
            name,
            description,
            expected_format,
            order_index,
            is_required
          ) VALUES (
            ${propertyTableId},
            ${prop.name},
            ${prop.description},
            ${prop.expectedFormat},
            ${prop.orderIndex},
            ${false}
          )
        `);
        insertedCount++;
      } catch (error: any) {
        // Log but continue if a property fails
        console.error(`[INIT-DEFAULT-PROPS] Failed to insert property "${prop.name}":`, error.message);
      }
    }
    
    console.log(`[INIT-DEFAULT-PROPS] ✅ Successfully initialized ${insertedCount}/${DEFAULT_KAMIN_PROPERTIES.length} default properties`);
  } catch (error) {
    console.error('[INIT-DEFAULT-PROPS] ❌ Failed to initialize default properties:', error);
    throw error;
  }
}

/**
 * Get the count of default Kamin properties
 */
export function getDefaultKaminPropertiesCount(): number {
  return DEFAULT_KAMIN_PROPERTIES.length;
}