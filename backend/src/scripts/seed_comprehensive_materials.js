import xlsx from 'xlsx';
import path from 'path';
import pool from '../config/db.js';

const STANDARD_CATALOG = [
  // 1. Civil / Structural
  { description: 'OPC 53 Grade Cement, 50 Kg Bag', spec: 'IS 12269 certified, UltraTech / Ambuja', unit: 'Bag', category: 'Civil / Structural', ref_rate: 390.00 },
  { description: 'PPC Portland Pozzolana Cement, 50 Kg Bag', spec: 'IS 1489 certified', unit: 'Bag', category: 'Civil / Structural', ref_rate: 360.00 },
  { description: 'TMT Steel Rebars Fe 550D - 8mm', spec: 'Tata Tiscon / JSW Neosteel Fe550D', unit: 'Kg', category: 'Civil / Structural', ref_rate: 68.00 },
  { description: 'TMT Steel Rebars Fe 550D - 10mm', spec: 'Tata Tiscon / JSW Neosteel Fe550D', unit: 'Kg', category: 'Civil / Structural', ref_rate: 66.00 },
  { description: 'TMT Steel Rebars Fe 550D - 12mm', spec: 'Tata Tiscon / JSW Neosteel Fe550D', unit: 'Kg', category: 'Civil / Structural', ref_rate: 65.00 },
  { description: 'TMT Steel Rebars Fe 550D - 16mm', spec: 'Tata Tiscon / JSW Neosteel Fe550D', unit: 'Kg', category: 'Civil / Structural', ref_rate: 65.00 },
  { description: 'TMT Steel Rebars Fe 550D - 20mm', spec: 'Tata Tiscon / JSW Neosteel Fe550D', unit: 'Kg', category: 'Civil / Structural', ref_rate: 65.00 },
  { description: 'River Sand (Washed Coarse Sand)', spec: 'Zone II River Sand for Structural Work', unit: 'Brass', category: 'Civil / Structural', ref_rate: 4500.00 },
  { description: 'Crushed M-Sand (Manufactured Sand)', spec: 'Zone II Washed Plaster & Concrete M-Sand', unit: 'Brass', category: 'Civil / Structural', ref_rate: 3200.00 },
  { description: 'Coarse Aggregate 20mm Metal', spec: 'Blue Basalt Metal graded for RCC', unit: 'Brass', category: 'Civil / Structural', ref_rate: 2600.00 },
  { description: 'Coarse Aggregate 10mm Grit', spec: 'Blue Basalt Metal graded for RCC', unit: 'Brass', category: 'Civil / Structural', ref_rate: 2800.00 },
  { description: 'Red Clay Burnt Bricks', spec: 'Standard 9x4x3 inch First Class', unit: '1000 Nos', category: 'Civil / Structural', ref_rate: 9500.00 },
  { description: 'AAC Lightweight Blocks (600x200x150mm)', spec: 'Grade 1 Aerated Autoclaved Concrete', unit: 'Nos', category: 'Civil / Structural', ref_rate: 65.00 },
  { description: 'AAC Lightweight Blocks (600x200x100mm)', spec: 'Grade 1 Aerated Autoclaved Concrete', unit: 'Nos', category: 'Civil / Structural', ref_rate: 48.00 },
  { description: 'Binding Wire 18 Gauge Annealed', spec: 'Black Annealed MS Wire for Rebar', unit: 'Kg', category: 'Civil / Structural', ref_rate: 75.00 },
  { description: 'Shuttering Waterproof Plywood 12mm', spec: 'Phenolic Film Faced 34 Kg', unit: 'Sheet', category: 'Civil / Structural', ref_rate: 1350.00 },

  // 2. Plaster & Masonry
  { description: 'Ready-Mix Plaster UltraTech READIPLAST, 40 Kg Bag', spec: 'Ready-to-use Polymer Modified Cement Plaster', unit: 'Bag', category: 'Plaster & Masonry', ref_rate: 241.52 },
  { description: 'Block Jointing Mortar (Thin Bed), 40 Kg Bag', spec: 'High Strength Adhesive for AAC Blocks', unit: 'Bag', category: 'Plaster & Masonry', ref_rate: 190.00 },
  { description: 'Gypsum Plaster (Saint-Gobain Elite / OneCoat), 25 Kg', spec: 'Direct application over brick/AAC wall', unit: 'Bag', category: 'Plaster & Masonry', ref_rate: 175.00 },
  { description: 'Waterproofing Chemical Dr. Fixit 101 LW+', spec: 'Integral Liquid Waterproofing Compound', unit: 'Liter', category: 'Plaster & Masonry', ref_rate: 145.00 },
  { description: 'SBR Latex Bonding Agent (Dr. Fixit Super Latex)', spec: 'Polymer Bonding Agent for Repair & Waterproofing', unit: 'Liter', category: 'Plaster & Masonry', ref_rate: 280.00 },
  { description: 'Tile Adhesive Type 1 (Ceramic & Vitrified), 20 Kg', spec: 'Polymer modified dry set cement adhesive (Roff / Laticrete)', unit: 'Bag', category: 'Plaster & Masonry', ref_rate: 320.00 },
  { description: 'Tile Adhesive Type 2 (Granite & Marble), 20 Kg', spec: 'High polymer modified adhesive (Roff Masterfix)', unit: 'Bag', category: 'Plaster & Masonry', ref_rate: 550.00 },
  { description: 'Epoxy Tile Grout 3-Component 1 Kg Set', spec: 'Stain-free chemical resistant grout', unit: 'Set', category: 'Plaster & Masonry', ref_rate: 380.00 },
  { description: 'Fibre Glass Mesh (145 GSM)', spec: 'Reinforcement mesh for plaster joints (50m roll)', unit: 'Roll', category: 'Plaster & Masonry', ref_rate: 1200.00 },

  // 3. Paint & Finishing
  { description: 'Asian Paints Apex Ultima Exterior Emulsion', spec: 'High Performance Anti-Algal Weatherproof Paint', unit: 'Liter', category: 'Paint & Finishing', ref_rate: 385.00 },
  { description: 'Asian Paints Royale Luxury Interior Emulsion', spec: 'Teflon Surface Protector Luxury Silk Sheen', unit: 'Liter', category: 'Paint & Finishing', ref_rate: 460.00 },
  { description: 'Asian Paints Tractor Emulsion (Interior White)', spec: 'Standard Interior Smooth Emulsion (20 Ltr Bucket)', unit: 'Bucket', category: 'Paint & Finishing', ref_rate: 2450.00 },
  { description: 'Birla White Wall Care Putty, 40 Kg Bag', spec: 'Water resistant white cement based wall putty', unit: 'Bag', category: 'Paint & Finishing', ref_rate: 850.00 },
  { description: 'Asian Paints Decoprime Water Thinnable Wall Primer', spec: 'Interior/Exterior Acrylic Primer (20 Ltr Bucket)', unit: 'Bucket', category: 'Paint & Finishing', ref_rate: 2100.00 },
  { description: 'Red Oxide Metal Primer', spec: 'Anti-corrosive primer for MS structural steel (20 Ltr)', unit: 'Bucket', category: 'Paint & Finishing', ref_rate: 2600.00 },
  { description: 'Synthetic Enamel Paint (White / Grey)', spec: 'High Gloss Solvent Based Enamel for Wood & Metal', unit: 'Liter', category: 'Paint & Finishing', ref_rate: 290.00 },
  { description: 'PU Polyurethane Wood Polish (Gloss / Matt)', spec: 'Two-pack scratch resistant clear coat for veneer/wood', unit: 'Liter', category: 'Paint & Finishing', ref_rate: 480.00 },
  { description: 'Paint Roller 9-inch with Handle & Frame', spec: 'High density woven fabric roller for walls', unit: 'Nos', category: 'Paint & Finishing', ref_rate: 180.00 },
  { description: 'Paint Brushes Set (2", 3", 4")', spec: 'Synthetic Bristle Brushes with Wooden Handle', unit: 'Set', category: 'Paint & Finishing', ref_rate: 220.00 },
  { description: 'Waterproof Emery Sanding Paper (P120 / P180)', spec: 'Silicon Carbide Abrasive Paper for Surface Prep', unit: 'Sheets', category: 'Paint & Finishing', ref_rate: 15.00 },
  { description: 'Crepe Paper Masking Tape 24mm (1-inch)', spec: 'Non-residue painter masking tape 25m roll', unit: 'Roll', category: 'Paint & Finishing', ref_rate: 35.00 },
  { description: 'Mineral Turpentine Oil / Thinner (Commercial)', spec: 'Paint Thinner & Cleaning Solvent (5 Ltr Tin)', unit: 'Tin', category: 'Paint & Finishing', ref_rate: 420.00 },

  // 4. Electrical
  { description: 'Polycab FRLS Copper Wire 1.5 sq mm (90m Coil)', spec: 'Fire Retardant Low Smoke PVC Insulated 1100V', unit: 'Coil', category: 'Electrical', ref_rate: 1850.00 },
  { description: 'Polycab FRLS Copper Wire 2.5 sq mm (90m Coil)', spec: 'Fire Retardant Low Smoke PVC Insulated 1100V', unit: 'Coil', category: 'Electrical', ref_rate: 2950.00 },
  { description: 'Polycab FRLS Copper Wire 4.0 sq mm (90m Coil)', spec: 'For AC & Power Circuits 1100V', unit: 'Coil', category: 'Electrical', ref_rate: 4400.00 },
  { description: 'Schneider / Legrand Modular Switch 6A 1-Way', spec: 'White Polycarbonate Silver Contacts ISI Marked', unit: 'Nos', category: 'Electrical', ref_rate: 65.00 },
  { description: 'Schneider / Legrand Modular Switch 16A with Indicator', spec: 'Heavy Duty Power Switch with Indicator', unit: 'Nos', category: 'Electrical', ref_rate: 140.00 },
  { description: 'Modular 6A / 16A Universal Socket with Shutter', spec: 'Child safety shutter 3-pin socket', unit: 'Nos', category: 'Electrical', ref_rate: 165.00 },
  { description: 'PVC Conduit Pipe 25mm Medium (3m length)', spec: 'Rigid Flame Retardant Heavy Duty Conduit (VIP / Precision)', unit: 'Length', category: 'Electrical', ref_rate: 85.00 },
  { description: 'GI Concealed Modular Metal Box (6 Module / 8 Module)', spec: 'Zinc coated anti-rust 18 gauge box', unit: 'Nos', category: 'Electrical', ref_rate: 95.00 },
  { description: 'Schneider Acti9 MCB Single Pole 16A / 32A C-Curve', spec: '10kA Short Circuit Breaking Capacity', unit: 'Nos', category: 'Electrical', ref_rate: 235.00 },
  { description: 'Distribution Board DB 8-Way Double Door IP42', spec: 'Sheet Steel Enclosure with Neutral & Earth Bar', unit: 'Nos', category: 'Electrical', ref_rate: 1650.00 },
  { description: 'LED Round Concealed Downlight 15W (Warm White / Cool White)', spec: 'Die-cast Aluminium Housing, 1200 Lumens (Philips / Crompton)', unit: 'Nos', category: 'Electrical', ref_rate: 380.00 },
  { description: 'LED 2x2 Cleanroom / Office Grid Panel Light 36W', spec: 'High Efficiency 100 lm/W Glare Free (Philips/Wipro)', unit: 'Nos', category: 'Electrical', ref_rate: 1450.00 },

  // 5. Plumbing
  { description: 'Astral CPVC Pro Pipe 1-inch (Class 1 SDR 11) - 3m', spec: 'Hot & Cold Potable Water Distribution Pipe', unit: 'Length', category: 'Plumbing', ref_rate: 340.00 },
  { description: 'Astral CPVC Pro Pipe 3/4-inch (Class 1 SDR 11) - 3m', spec: 'Hot & Cold Potable Water Distribution Pipe', unit: 'Length', category: 'Plumbing', ref_rate: 220.00 },
  { description: 'Astral UPVC SWR Drainage Pipe 110mm Ring Fit (3m)', spec: 'Soil & Waste Pipe with Rubber Ring Joint Type B', unit: 'Length', category: 'Plumbing', ref_rate: 680.00 },
  { description: 'CPVC Brass Female Threaded Adapter (FTA) 3/4" x 1/2"', spec: 'Brass Insert for Tap Connection', unit: 'Nos', category: 'Plumbing', ref_rate: 78.00 },
  { description: 'Astral CPVC Heavy Duty Solvent Cement 500ml', spec: 'Fast Setting Clear Cement for Pressure Pipes', unit: 'Tin', category: 'Plumbing', ref_rate: 360.00 },
  { description: 'Jaquar / Kohler CP Angle Valve with Wall Flange', spec: 'Quarter Turn Brass Chrome Plated 1/2-inch', unit: 'Nos', category: 'Plumbing', ref_rate: 550.00 },
  { description: 'Jaquar Health Faucet with 1.2m Flexible Hose & Hook', spec: 'ABS Body Chrome Finish with EPDM Inner Hose', unit: 'Set', category: 'Plumbing', ref_rate: 850.00 },
  { description: 'Wall Hung EWC Western Toilet with Soft Close Seat', spec: 'Rimless Ceramic Closet with Concealed Flush Tank compatibility', unit: 'Set', category: 'Plumbing', ref_rate: 6500.00 },
  { description: 'Ceramic Urinal Basin with Integrated Sensor / Push Tap', spec: 'Vitreous China Wall Mounted Commercial Urinal', unit: 'Nos', category: 'Plumbing', ref_rate: 4200.00 },
  { description: 'Ceramic Table Top / Counter Wash Basin', spec: 'Glossy White Glazed Vitreous China (Jaquar / Hindware)', unit: 'Nos', category: 'Plumbing', ref_rate: 2400.00 },
  { description: 'Floor Drain Jali SS 304 with Cockroach Trap (5"x5")', spec: 'Anti-odor Stainless Steel 304 Drain Grating', unit: 'Nos', category: 'Plumbing', ref_rate: 280.00 },

  // 6. HVAC
  { description: 'Copper Refrigerant Pipe 1/2" OD (18 Gauge)', spec: 'Seamless Deoxidized High Residual Phosphorus (DHP) Copper', unit: 'Meter', category: 'HVAC', ref_rate: 450.00 },
  { description: 'Copper Refrigerant Pipe 1/4" OD (20 Gauge)', spec: 'Seamless Copper Tubing for VRF/Split Units', unit: 'Meter', category: 'HVAC', ref_rate: 280.00 },
  { description: 'Nitrile Rubber Thermal Insulation Tube 1/2" ID x 9mm', spec: 'Closed cell elastomeric foam insulation (Armacell / K-Flex)', unit: 'Meter', category: 'HVAC', ref_rate: 65.00 },
  { description: 'GI Sheet Ducting 24 Gauge (Factory Fabricated)', spec: 'Zinc Coating 120 GSM with Flange Joints (TDF/Slip-on)', unit: 'Sq. Mtr', category: 'HVAC', ref_rate: 850.00 },
  { description: 'Aluminium Powder Coated Supply Air Diffuser (2x2 ft)', spec: '4-Way Core with Opposed Blade Volume Damper', unit: 'Nos', category: 'HVAC', ref_rate: 1100.00 },
  { description: 'Aluminium Linear Return Air Grille (1000mm x 150mm)', spec: 'Deflection Blades 0/15 degree with Filter plenum', unit: 'Nos', category: 'HVAC', ref_rate: 950.00 },
  { description: 'Duct Acoustic Lining Glass Wool 25mm 24kg/m3', spec: 'With Black Glass Tissue (BGT) Facing (Twiga / Owens Corning)', unit: 'Sq. Mtr', category: 'HVAC', ref_rate: 240.00 },
  { description: 'Refrigerant Gas R-410A / R-32 Cylinder (10 Kg)', spec: 'Zero ODP Eco Refrigerant (Floron / Honeywell)', unit: 'Cylinder', category: 'HVAC', ref_rate: 5500.00 },

  // 7. Carpentry & Hardware
  { description: 'Commercial Flush Door 35mm BWP Grade', spec: 'IS 2202 Phenol Formaldehyde Bonded Solid Core', unit: 'Sq. Ft', category: 'Carpentry & Hardware', ref_rate: 125.00 },
  { description: 'Marine Plywood 18mm BWP 710 Grade', spec: 'Century / Greenply 100% Calibrated Hardwood Marine Ply', unit: 'Sheet', category: 'Carpentry & Hardware', ref_rate: 2850.00 },
  { description: 'Commercial Plywood 12mm MR Grade', spec: 'Century / Greenply 8x4 ft Calibrated Sheet', unit: 'Sheet', category: 'Carpentry & Hardware', ref_rate: 1650.00 },
  { description: 'Decorative Laminate Sheet 1.0mm (Merino / Century)', spec: 'Scratch & Heat Resistant Suede / Gloss Finish (8x4 ft)', unit: 'Sheet', category: 'Carpentry & Hardware', ref_rate: 1450.00 },
  { description: 'SS 304 Mortise Door Lock Handle Set', spec: 'Computerized Key Lock with Brass Double Cylinder (Godrej / Yale)', unit: 'Set', category: 'Carpentry & Hardware', ref_rate: 1650.00 },
  { description: 'Hydraulic Concealed Door Closer (Heavy Duty 80 Kg)', spec: 'EN 1154 Tested with Adjustable Latch & Sweep Speed', unit: 'Nos', category: 'Carpentry & Hardware', ref_rate: 1450.00 },
  { description: 'SS 304 Ball Bearing Butt Hinges 5" x 3" x 3mm', spec: 'Smooth Swing Heavy Commercial Door Hinges', unit: 'Pair', category: 'Carpentry & Hardware', ref_rate: 220.00 },
  { description: 'Fevicol Marine Wood Adhesive (50 Kg Drum)', spec: 'Waterproof D3 Grade Synthetic Resin Adhesive', unit: 'Drum', category: 'Carpentry & Hardware', ref_rate: 8500.00 },
  { description: 'Drywall & Chipboard Screws Black Phosphate (1.5" x 8)', spec: 'Hardened Bugle Head Screws (1000 Pcs Box)', unit: 'Box', category: 'Carpentry & Hardware', ref_rate: 280.00 },

  // 8. Safety & Consumables
  { description: 'Safety Helmet ISI Marked with Ratchet Adjustment', spec: 'High Density Polyethylene (HDPE) Karam / 3M', unit: 'Nos', category: 'Safety & Consumables', ref_rate: 240.00 },
  { description: 'Steel Toe Safety Shoes ISI Marked (Leather)', spec: 'Anti-slip Polyurethane Double Density Sole (Tiger / Karam)', unit: 'Pair', category: 'Safety & Consumables', ref_rate: 950.00 },
  { description: 'Reflective Safety Jacket with High Visibility Strips', spec: 'Fluorescent Green / Orange with 2-inch Glass Bead Tape', unit: 'Nos', category: 'Safety & Consumables', ref_rate: 110.00 },
  { description: 'Full Body Safety Harness with Double Lanyard & Scaffold Hooks', spec: 'EN 361 Certified Fall Arrest Harness (Karam PN 56)', unit: 'Nos', category: 'Safety & Consumables', ref_rate: 1650.00 },
  { description: 'Heavy Duty Nitrile / Rubber Coated Safety Gloves', spec: 'Cut & Chemical Resistant Grip Gloves (Pack of 12 Pairs)', unit: 'Pack', category: 'Safety & Consumables', ref_rate: 360.00 },
  { description: 'Polycarbonate Clear Safety Goggles', spec: 'Anti-scratch UV 400 Protective Eyewear (3M 10434)', unit: 'Nos', category: 'Safety & Consumables', ref_rate: 85.00 },
  { description: 'Fire Extinguisher ABC Dry Powder 4 Kg (ISI)', spec: 'Map 50% for Class A, B, C & Electrical Fires with Pressure Gauge', unit: 'Nos', category: 'Safety & Consumables', ref_rate: 1450.00 },
  { description: 'First Aid Kit Box with Standard Medical Consumables', spec: 'Wall Mountable Metal First Aid Cabinet (Industrial Grade)', unit: 'Kit', category: 'Safety & Consumables', ref_rate: 850.00 },

  // 9. General / Other (Flooring, Partitions, Brackets)
  { description: 'Vitrified Floor Tiles 600 x 600 mm (Nano Polished)', spec: 'Stain resistant double charged vitrified tiles (Kajaria / Somany)', unit: 'Box', category: 'General / Other', ref_rate: 680.00 },
  { description: 'Ceramic Digital Wall Tiles 300 x 600 mm (Glossy / Matt)', spec: 'High definition glazed wall tiles for washrooms/pantries', unit: 'Box', category: 'General / Other', ref_rate: 420.00 },
  { description: 'Granite Slab Pearl Black / Jet Black (18mm Machine Cut)', spec: 'Pre-polished uniform granite slab for counters & sills', unit: 'Sq. Ft', category: 'General / Other', ref_rate: 165.00 },
  { description: 'Quartz / Composite Marble Vanila Beige (18mm)', spec: 'Engineered Stone Slab for Washroom Countertops', unit: 'Sq. Ft', category: 'General / Other', ref_rate: 240.00 },
  { description: 'Heavy Duty MS Bracket for Washroom Sinks & Pipe Supports', spec: 'Fabricated Anti-rust Coated Structural Angle Bracket', unit: 'Nos', category: 'General / Other', ref_rate: 220.00 },
  { description: 'Toilet Cubicle Partition 12mm Compact Laminate', spec: 'T-Line / Merino Water resistant HPL panel with SS 304 hardware', unit: 'Set', category: 'General / Other', ref_rate: 12500.00 }
];

async function seedMaterials() {
  console.log('--- Starting Materials Seeding ---');

  // 1. Insert Standard Catalog Items across all categories
  let addedStandard = 0;
  for (const m of STANDARD_CATALOG) {
    const [existing] = await pool.query(
      'SELECT id FROM materials WHERE description = ? AND category = ? LIMIT 1',
      [m.description, m.category]
    );

    if (existing.length === 0) {
      await pool.query(
        `INSERT INTO materials (description, spec, unit, category, ref_rate, is_common, active)
         VALUES (?, ?, ?, ?, ?, 1, 1)`,
        [m.description, m.spec, m.unit, m.category, m.ref_rate]
      );
      addedStandard++;
    }
  }
  console.log(`Added ${addedStandard} standard catalog materials.`);

  // 2. Also import materials from appscript/DDPL Procurement Portal — Data.xlsx
  try {
    const xlsxFile = path.resolve('../appscript/DDPL Procurement Portal — Data.xlsx');
    const wb = xlsx.readFile(xlsxFile);
    if (wb.Sheets['Materials']) {
      const rows = xlsx.utils.sheet_to_json(wb.Sheets['Materials']);
      let addedFromExcel = 0;
      
      // Map category name to standard category
      const mapCat = (c) => {
        if (!c) return 'General / Other';
        const str = String(c).trim();
        if (str.toLowerCase().includes('paint')) return 'Paint & Finishing';
        if (str.toLowerCase().includes('carpen')) return 'Carpentry & Hardware';
        if (str.toLowerCase().includes('hard')) return 'Carpentry & Hardware';
        if (str.toLowerCase().includes('plumb')) return 'Plumbing';
        if (str.toLowerCase().includes('elect')) return 'Electrical';
        if (str.toLowerCase().includes('floor') || str.toLowerCase().includes('tile')) return 'General / Other';
        if (str.toLowerCase().includes('civil')) return 'Civil / Structural';
        if (str.toLowerCase().includes('hvac')) return 'HVAC';
        return 'General / Other';
      };

      for (const r of rows) {
        let desc = r.Specification || r.Material;
        let spec = r.Material && r.Specification ? `${r.Material} - ${r.Specification}` : (r.Specification || r.Material);
        let category = mapCat(r.Category);
        let unit = r.Unit ? String(r.Unit) : 'Nos';

        if (!desc) continue;

        const [ex] = await pool.query(
          'SELECT id FROM materials WHERE description = ? LIMIT 1',
          [desc]
        );

        if (ex.length === 0) {
          await pool.query(
            `INSERT INTO materials (description, spec, unit, category, is_common, active)
             VALUES (?, ?, ?, ?, 1, 1)`,
            [desc, spec, unit, category]
          );
          addedFromExcel++;
        }
      }
      console.log(`Added ${addedFromExcel} materials from DDPL Procurement Portal Data.xlsx.`);
    }
  } catch (err) {
    console.warn('Could not read materials from Data.xlsx:', err.message);
  }

  const [total] = await pool.query('SELECT COUNT(*) as count FROM materials');
  const [byCat] = await pool.query('SELECT category, COUNT(*) as count FROM materials GROUP BY category');
  console.log(`\nTotal Materials in Database: ${total[0].count}`);
  console.table(byCat);

  process.exit(0);
}

seedMaterials().catch((err) => {
  console.error('Fatal materials seed error:', err);
  process.exit(1);
});
