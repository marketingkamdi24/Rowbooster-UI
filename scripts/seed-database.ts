/**
 * Database Seed Script
 * 
 * This script populates the PostgreSQL database with:
 * - Default admin user (admin/admin123)
 * - Default product properties
 * 
 * Run this script ONCE after creating the database tables.
 */

import { db } from '../server/db';
import { users, productProperties } from '../shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

// Default product properties to seed
const defaultProperties = [
  { name: "Artikelnummer", description: "Product article/item number", expectedFormat: "text", orderIndex: 1 },
  { name: "URL", description: "Product URL", expectedFormat: "url", orderIndex: 2 },
  { name: "Page", description: "Page number in catalog", expectedFormat: "number", orderIndex: 3 },
  { name: "ArtikelName", description: "Product name", expectedFormat: "text", orderIndex: 4 },
  { name: "Title", description: "Product title", expectedFormat: "text", orderIndex: 5 },
  { name: "Description", description: "Product description", expectedFormat: "text", orderIndex: 6 },
  { name: "Hersteller", description: "Manufacturer", expectedFormat: "text", orderIndex: 7 },
  { name: "Pflege", description: "Care instructions", expectedFormat: "text", orderIndex: 8 },
  { name: "Befestigung", description: "Mounting/fastening type", expectedFormat: "text", orderIndex: 9 },
  { name: "Decklung", description: "Lid type/cover", expectedFormat: "text", orderIndex: 10 },
  { name: "Fangkorb", description: "Catch basket", expectedFormat: "text", orderIndex: 11 },
  { name: "Höhe", description: "Height", expectedFormat: "in mm/cm", orderIndex: 12 },
  { name: "Breite", description: "Width", expectedFormat: "in mm/cm", orderIndex: 13 },
  { name: "Tiefe", description: "Depth", expectedFormat: "in mm/cm", orderIndex: 14 },
  { name: "Durchmesser", description: "Diameter", expectedFormat: "in mm/cm", orderIndex: 15 },
  { name: "Brennstoff", description: "Fuel type", expectedFormat: "text", orderIndex: 16 },
  { name: "Deckel", description: "Lid information", expectedFormat: "text", orderIndex: 17 },
  { name: "Sichtfenstergröße", description: "Viewing window size", expectedFormat: "in mm/cm", orderIndex: 18 },
  { name: "Farbe", description: "Color", expectedFormat: "text", orderIndex: 19 },
  { name: "Gewicht", description: "Weight", expectedFormat: "in kg", orderIndex: 20 },
  { name: "Material", description: "Main material of the product", expectedFormat: "text", orderIndex: 21 },
  { name: "Leistung", description: "Power/performance", expectedFormat: "in kW", orderIndex: 22 },
  { name: "Energieeffizienzklasse", description: "Energy efficiency class", expectedFormat: "A++, A+, A, B, etc.", orderIndex: 23 },
  { name: "Wirkungsgrad", description: "Efficiency rating", expectedFormat: "percentage", orderIndex: 24 }
];

async function seedDatabase() {
  try {
    console.log('[SEED] Starting database seeding...');

    // Verify database connection
    if (!db) {
      throw new Error('Database connection is not available. Please check your DATABASE_URL in .env file.');
    }

    // Check if admin user already exists
    const existingAdmins = await db.select().from(users).where(eq(users.role, 'admin'));
    
    if (existingAdmins.length === 0) {
      console.log('[SEED] Creating default admin user...');
      
      // Hash the password
      const hashedPassword = await bcrypt.hash('admin123', 12);
      
      // Create admin user
      await db.insert(users).values({
        username: 'admin',
        password: hashedPassword,
        email: 'admin@example.com',
        role: 'admin',
        isActive: true,
        failedLoginAttempts: 0
      });
      
      console.log('[SEED] ✓ Default admin user created (username: admin, password: admin123)');
    } else {
      console.log('[SEED] ℹ Admin user already exists, skipping...');
    }

    // Check if properties already exist
    const existingProperties = await db.select().from(productProperties);
    
    if (existingProperties.length === 0) {
      console.log('[SEED] Creating default product properties...');
      
      // Insert all default properties
      for (const prop of defaultProperties) {
        await db.insert(productProperties).values(prop);
      }
      
      console.log(`[SEED] ✓ Created ${defaultProperties.length} default product properties`);
    } else {
      console.log(`[SEED] ℹ Found ${existingProperties.length} existing properties, skipping...`);
    }

    console.log('[SEED] ✅ Database seeding completed successfully!');
    console.log('[SEED]');
    console.log('[SEED] You can now log in with:');
    console.log('[SEED]   Username: admin');
    console.log('[SEED]   Password: admin123');
    console.log('[SEED]');
    
    process.exit(0);
  } catch (error) {
    console.error('[SEED] ❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Run the seed function
seedDatabase();