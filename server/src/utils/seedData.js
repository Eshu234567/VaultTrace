const bcrypt = require('bcryptjs');
const {
  User,
  LostReport,
  FoundItem,
  MatchCandidate,
  Claim,
  Notification,
  ItemEvent,
  DisposalRecord,
  AuditLog,
  CampusLocation,
} = require('../models');
const { syncAllIndexes } = require('../config/db');
const { runFullReconciliation } = require('../services/matchingService');

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function seedDatabase({ forceReset = false } = {}) {
  const existingUsers = await User.countDocuments();
  if (existingUsers > 0 && !forceReset) {
    return { seeded: false, message: 'Database already populated.' };
  }

  if (forceReset) {
    await Promise.all([
      User.deleteMany({}),
      LostReport.deleteMany({}),
      FoundItem.deleteMany({}),
      MatchCandidate.deleteMany({}),
      Claim.deleteMany({}),
      Notification.deleteMany({}),
      ItemEvent.deleteMany({}),
      DisposalRecord.deleteMany({}),
      AuditLog.deleteMany({}),
      CampusLocation.deleteMany({}),
    ]);
  }

  await syncAllIndexes();

  // 1. Seed Controlled Campus Locations (RVCE Zones)
  const campusLocationsData = [
    {
      name: 'ISE Department Block - Lab 302',
      buildingZone: 'ISE & CSE Academic Cluster',
      roomOrLandmark: '3rd Floor, High Performance Computing Lab',
      storageCode: 'VLT-ISE-A1',
      defaultVaultBin: 'Central Vault Rack A • Bin #01 (ISE/CSE)',
      coordinates: { x: 28, y: 32 },
    },
    {
      name: 'Central Library Reading Hall (2nd Floor)',
      buildingZone: 'Central Library & Admin',
      roomOrLandmark: 'Reference Section & Digital Library Desk',
      storageCode: 'VLT-LIB-B1',
      defaultVaultBin: 'Central Vault Rack B • Bin #02 (Library)',
      coordinates: { x: 52, y: 26 },
    },
    {
      name: 'Mingos Canteen & Food Court',
      buildingZone: 'Student Amenities & Food Court',
      roomOrLandmark: 'Outdoor Seating & Juice Counter',
      storageCode: 'VLT-MNG-C1',
      defaultVaultBin: 'Central Vault Rack C • Bin #03 (Canteen)',
      coordinates: { x: 68, y: 58 },
    },
    {
      name: 'IEM Auditorium & Seminar Complex',
      buildingZone: 'Auditorium & Sports Complex',
      roomOrLandmark: 'Main Foyer & Left Wing Seating',
      storageCode: 'VLT-AUD-D1',
      defaultVaultBin: 'Central Vault Rack D • Bin #04 (Auditorium)',
      coordinates: { x: 38, y: 66 },
    },
    {
      name: 'CSE Seminar Hall & Turing Lounge',
      buildingZone: 'ISE & CSE Academic Cluster',
      roomOrLandmark: 'Ground Floor Near Notice Board',
      storageCode: 'VLT-CSE-A2',
      defaultVaultBin: 'Central Vault Rack A • Bin #05 (CSE)',
      coordinates: { x: 22, y: 44 },
    },
    {
      name: 'ECE & Instrumentation Block Corridor',
      buildingZone: 'Core Engineering Blocks',
      roomOrLandmark: '1st Floor VLSI Lab Entrance',
      storageCode: 'VLT-ECE-E1',
      defaultVaultBin: 'Central Vault Rack E • Bin #06 (Core Blocks)',
      coordinates: { x: 76, y: 34 },
    },
    {
      name: 'Kotak Mahindra Bank ATM & Main Gate Kiosk',
      buildingZone: 'Central Library & Admin',
      roomOrLandmark: 'Security Desk Entrance',
      storageCode: 'VLT-SEC-S1',
      defaultVaultBin: 'High-Value Security Safe #01 (Main Gate)',
      coordinates: { x: 48, y: 82 },
    },
    {
      name: 'Cauvery & Chamundi Hostel Mess',
      buildingZone: 'Hostel & Residential Zone',
      roomOrLandmark: 'Dining Hall Wash Area',
      storageCode: 'VLT-HST-H1',
      defaultVaultBin: 'Hostel Warden Desk Bin #02',
      coordinates: { x: 84, y: 74 },
    },
  ];

  await CampusLocation.insertMany(campusLocationsData);

  // 2. Seed Users (Admin, Staff, and Students)
  const passwordHash = await bcrypt.hash('VaultPass@123', 10);

  const users = await User.insertMany([
    {
      name: 'Dr. Raghavendra Rao (Chief Custodian)',
      email: 'admin@vaulttrace.edu',
      passwordHash,
      role: 'admin',
      department: 'Campus Estate & Security Administration',
      identifierCode: 'ADM-RV-001',
      phone: '+91 98450 11223',
    },
    {
      name: 'Suresh Gowda (Vault Intake Officer)',
      email: 'staff@vaulttrace.edu',
      passwordHash,
      role: 'staff',
      department: 'Central Library & Lost Property Desk',
      identifierCode: 'STF-RV-104',
      phone: '+91 98450 44556',
    },
    {
      name: 'Aarav Sharma',
      email: 'student@vaulttrace.edu',
      passwordHash,
      role: 'student',
      department: 'Information Science and Engineering',
      identifierCode: 'STU-ISE-042',
      phone: '+91 99001 22334',
    },
    {
      name: 'Diya Nair',
      email: 'diya.nair@vaulttrace.edu',
      passwordHash,
      role: 'student',
      department: 'Computer Science and Engineering',
      identifierCode: 'STU-CSE-089',
      phone: '+91 99001 77889',
    },
    {
      name: 'Karthik Hegde',
      email: 'karthik.hegde@vaulttrace.edu',
      passwordHash,
      role: 'student',
      department: 'Electronics and Communication Engineering',
      identifierCode: 'STU-ECE-019',
      phone: '+91 99001 55667',
    },
  ]);

  const [adminUser, staffUser, studentAarav, studentDiya, studentKarthik] = users;

  // 3. Seed Found Items across lifecycle statuses & retention classes
  const foundItems = await FoundItem.insertMany([
    {
      itemCode: 'FND-2026-101',
      createdBy: staffUser._id,
      submittedByRole: 'staff',
      category: 'Electronics',
      itemName: 'Apple AirPods Pro (2nd Gen) Charging Case',
      description: 'White MagSafe charging case with a matte charcoal silicone cover found on workstation desk.',
      visibleAttributes: {
        colour: 'White / Charcoal',
        brand: 'Apple',
        size: 'Pocket / Small',
        material: 'Plastic / Silicone',
        tags: ['airpods', 'earbuds', 'case', 'magsafe', 'silicone'],
      },
      restrictedProof: {
        serialOrIdFragment: 'GX9K4L88Q',
        hiddenMarkOrScratch: 'Tiny blue ink dot inside lid hinge + mini Batman sticker under silicone cover',
        lockedScreenOrContents: 'Both L and R earbuds inside',
        verificationPrompt: 'Provide the last 4 characters of the serial number or describe the hidden sticker/mark inside the silicone case.',
      },
      foundAt: daysAgo(2),
      foundLocation: 'ISE Department Block - Lab 302',
      foundBuildingZone: 'ISE & CSE Academic Cluster',
      storageLocation: 'High-Value Security Safe #01 (Main Gate) • Slot A4',
      finderDetails: { finderName: 'Lab Instructor Ramesh', finderContact: 'Ext 302' },
      status: 'Stored',
      estimatedValueBand: 'High (> ₹3,000)',
      retentionClass: 'High-Value / Sensitive',
      retentionDays: 180,
      eligibleForDisposalAt: daysFromNow(178),
      imageRefs: [
        {
          url: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=600&q=80',
          caption: 'AirPods Pro case in charcoal sleeve',
        },
      ],
    },
    {
      itemCode: 'FND-2026-102',
      createdBy: staffUser._id,
      submittedByRole: 'staff',
      category: 'Calculator / Lab Gear',
      itemName: 'Casio fx-991EX ClassWiz Scientific Calculator',
      description: 'Black and white solar scientific calculator with slide-on hard cover found after DBMS internals.',
      visibleAttributes: {
        colour: 'Black',
        brand: 'Casio',
        size: 'Medium / Handheld',
        material: 'Plastic',
        tags: ['calculator', 'casio', '991ex', 'classwiz', 'scientific'],
      },
      restrictedProof: {
        serialOrIdFragment: 'CAS-8821',
        hiddenMarkOrScratch: 'Engraved initials "A.S." on the back battery plate and formula sticky note inside slide cover',
        lockedScreenOrContents: 'Slide cover has a small crack on bottom right corner',
        verificationPrompt: 'What initials or markings are written on the back or inside the slide cover?',
      },
      foundAt: daysAgo(3),
      foundLocation: 'Central Library Reading Hall (2nd Floor)',
      foundBuildingZone: 'Central Library & Admin',
      storageLocation: 'Central Vault Rack B • Bin #02 (Library)',
      finderDetails: { finderName: 'Library Assistant', finderContact: 'Desk 2' },
      status: 'Claim Pending',
      estimatedValueBand: 'Medium (₹500 - ₹3,000)',
      retentionClass: 'Standard',
      retentionDays: 90,
      eligibleForDisposalAt: daysFromNow(87),
      claimFreeze: true,
      imageRefs: [
        {
          url: 'https://images.unsplash.com/photo-1587145820266-a5951ee6f620?auto=format&fit=crop&w=600&q=80',
          caption: 'Casio fx-991EX Calculator',
        },
      ],
    },
    {
      itemCode: 'FND-2026-103',
      createdBy: staffUser._id,
      submittedByRole: 'staff',
      category: 'Bottle / Flask',
      itemName: 'Milton Thermosteel 1L Matte Teal Flask',
      description: 'Insulated stainless steel water bottle in matte teal finish found near juice counter.',
      visibleAttributes: {
        colour: 'Teal / Blue',
        brand: 'Milton',
        size: 'Medium / Handheld',
        material: 'Stainless Steel',
        tags: ['bottle', 'flask', 'milton', 'teal', 'thermosteel'],
      },
      restrictedProof: {
        serialOrIdFragment: 'N/A',
        hiddenMarkOrScratch: 'Small dent near the base rim + GitHub Octocat sticker on the bottom base',
        lockedScreenOrContents: 'Half full of water',
        verificationPrompt: 'Describe the sticker on the base of the bottle or the exact location of the dent.',
      },
      foundAt: daysAgo(5),
      foundLocation: 'Mingos Canteen & Food Court',
      foundBuildingZone: 'Student Amenities & Food Court',
      storageLocation: 'Central Vault Rack C • Bin #03 (Canteen)',
      finderDetails: { finderName: 'Canteen Staff', finderContact: 'Mingos Desk' },
      status: 'Approved',
      estimatedValueBand: 'Medium (₹500 - ₹3,000)',
      retentionClass: 'Standard',
      retentionDays: 90,
      eligibleForDisposalAt: daysFromNow(85),
      claimFreeze: true,
      imageRefs: [
        {
          url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=600&q=80',
          caption: 'Teal insulated flask',
        },
      ],
    },
    {
      itemCode: 'FND-2026-104',
      createdBy: adminUser._id,
      submittedByRole: 'admin',
      category: 'Wallet / Purse',
      itemName: 'Tommy Hilfiger Brown Leather Bi-Fold Wallet',
      description: 'Dark brown textured leather bi-fold wallet found near auditorium foyer.',
      visibleAttributes: {
        colour: 'Brown',
        brand: 'Tommy Hilfiger',
        size: 'Pocket / Small',
        material: 'Leather',
        tags: ['wallet', 'leather', 'brown', 'bifold'],
      },
      restrictedProof: {
        serialOrIdFragment: 'Namma Metro Card ending 4491',
        hiddenMarkOrScratch: 'Contains ₹650 cash, Namma Metro card, and a laminated passport photo',
        lockedScreenOrContents: 'Zippered coin pocket has a brass key',
        verificationPrompt: 'State the approximate cash amount and other cards/items inside the wallet.',
      },
      foundAt: daysAgo(14),
      foundLocation: 'IEM Auditorium & Seminar Complex',
      foundBuildingZone: 'Auditorium & Sports Complex',
      storageLocation: 'High-Value Security Safe #01 (Main Gate) • Slot B1',
      status: 'Returned',
      estimatedValueBand: 'High (> ₹3,000)',
      retentionClass: 'High-Value / Sensitive',
      retentionDays: 180,
      eligibleForDisposalAt: daysFromNow(166),
      returnedAt: daysAgo(11),
      handoverDetails: {
        recipientName: 'Karthik Hegde',
        recipientIdentifier: 'STU-ECE-019',
        verifiedByAdminId: adminUser._id,
        handoverCondition: 'Intact with all cash and cards verified',
        handoverNotes: 'Verified Namma Metro card digits and college ID in person.',
        handedOverAt: daysAgo(11),
      },
      imageRefs: [
        {
          url: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=600&q=80',
          caption: 'Brown leather bi-fold wallet',
        },
      ],
    },
    {
      itemCode: 'FND-2026-105',
      createdBy: staffUser._id,
      submittedByRole: 'staff',
      category: 'Stationery',
      itemName: 'Stationery Batch: Assorted Pilot V7 & Pentel Gel Pens (Lot #14)',
      description: 'Batch of 18 unclaimed black/blue rollerball pens, mechanical pencils, and erasers collected from exam halls.',
      visibleAttributes: {
        colour: 'Assorted Black / Blue',
        brand: 'Pilot / Pentel / Faber-Castell',
        size: 'Pocket / Small',
        material: 'Plastic / Metal',
        tags: ['pen', 'pencil', 'stationery', 'pilot', 'batch', 'eraser'],
      },
      restrictedProof: {
        serialOrIdFragment: 'BATCH-LOT-14',
        hiddenMarkOrScratch: 'Includes 7 Pilot V7 Blue, 6 Pentel EnerGel Black, 5 0.7mm mechanical pencils',
        lockedScreenOrContents: 'Stored in transparent stationery tray #04',
        verificationPrompt: 'Specify pen brand, ink colour, and grip style.',
      },
      foundAt: daysAgo(36),
      foundLocation: 'ISE Department Block - Lab 302',
      foundBuildingZone: 'ISE & CSE Academic Cluster',
      storageLocation: 'Central Vault Rack A • Stationery Box #04',
      status: 'Disposal Review',
      estimatedValueBand: 'Low (< ₹500)',
      retentionClass: 'Small / Low-Value',
      retentionDays: 30,
      eligibleForDisposalAt: daysAgo(6),
      isBatchStationery: true,
      batchQuantity: 18,
      batchLabel: 'BOX-STAT-2026-14',
      imageRefs: [
        {
          url: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=600&q=80',
          caption: 'Stationery batch box',
        },
      ],
    },
    {
      itemCode: 'FND-2026-106',
      createdBy: staffUser._id,
      submittedByRole: 'staff',
      category: 'Stationery',
      itemName: 'Stationery Batch: Unclaimed Geometry & Drafting Instruments (Lot #09)',
      description: 'Batch of 12 rulers, protractors, and gel pens from previous semester exam cycle.',
      visibleAttributes: {
        colour: 'Clear / Blue',
        brand: 'Camlin / DOMS',
        size: 'Pocket / Small',
        material: 'Plastic',
        tags: ['ruler', 'geometry', 'stationery', 'drafting', 'pens'],
      },
      restrictedProof: {
        serialOrIdFragment: 'BATCH-LOT-09',
        hiddenMarkOrScratch: 'Unclaimed after 30-day window; donated to NSS school drive',
        lockedScreenOrContents: '12 pieces total',
        verificationPrompt: 'Describe specific instrument brand.',
      },
      foundAt: daysAgo(55),
      foundLocation: 'ECE & Instrumentation Block Corridor',
      foundBuildingZone: 'Core Engineering Blocks',
      storageLocation: 'Donated Archive • NSS Transfer',
      status: 'Donated',
      estimatedValueBand: 'Low (< ₹500)',
      retentionClass: 'Small / Low-Value',
      retentionDays: 30,
      eligibleForDisposalAt: daysAgo(25),
      isBatchStationery: true,
      batchQuantity: 12,
      batchLabel: 'BOX-STAT-2026-09',
      imageRefs: [
        {
          url: 'https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?auto=format&fit=crop&w=600&q=80',
          caption: 'Drafting & stationery donation batch',
        },
      ],
    },
    {
      itemCode: 'FND-2026-107',
      createdBy: staffUser._id,
      submittedByRole: 'staff',
      category: 'Keys / Keychain',
      itemName: 'Honda Activa Key with Red Ferrari Metal Keychain',
      description: 'Single vehicle ignition key with a metallic red racing keychain and a small brass locker key.',
      visibleAttributes: {
        colour: 'Silver / Red',
        brand: 'Honda',
        size: 'Pocket / Small',
        material: 'Metal',
        tags: ['key', 'keychain', 'honda', 'activa', 'scooter'],
      },
      restrictedProof: {
        serialOrIdFragment: 'KEY-409',
        hiddenMarkOrScratch: 'Key tag number 409 stamped on the brass ring',
        lockedScreenOrContents: 'Two keys total on ring',
        verificationPrompt: 'What number is stamped on the small brass key or tag ring?',
      },
      foundAt: daysAgo(26),
      foundLocation: 'Kotak Mahindra Bank ATM & Main Gate Kiosk',
      foundBuildingZone: 'Central Library & Admin',
      storageLocation: 'High-Value Security Safe #01 (Main Gate) • Hook #12',
      status: 'Stored',
      estimatedValueBand: 'Medium (₹500 - ₹3,000)',
      retentionClass: 'Small / Low-Value',
      retentionDays: 30,
      eligibleForDisposalAt: daysFromNow(4), // Due soon in 4 days!
      imageRefs: [
        {
          url: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=600&q=80',
          caption: 'Vehicle key with red keychain',
        },
      ],
    },
    {
      itemCode: 'FND-2026-108',
      createdBy: studentDiya._id,
      submittedByRole: 'student',
      category: 'ID / Smart Card',
      itemName: 'Blue Lanyard with Campus Library Smart Card',
      description: 'Found a blue woven lanyard with an RFID smart card sleeve near the CSE Turing Lounge bench.',
      visibleAttributes: {
        colour: 'Blue',
        brand: 'RVCE RFID',
        size: 'Pocket / Small',
        material: 'Fabric / PVC',
        tags: ['id', 'card', 'lanyard', 'library', 'smartcard'],
      },
      restrictedProof: {
        serialOrIdFragment: 'RFID-7741',
        hiddenMarkOrScratch: 'Has an Enactus club enamel pin attached to the lanyard strap',
        lockedScreenOrContents: 'Handed to CSE department clerk awaiting Vault transfer',
        verificationPrompt: 'Describe the club pin attached to the lanyard or last 4 digits of the card.',
      },
      foundAt: daysAgo(1),
      foundLocation: 'CSE Seminar Hall & Turing Lounge',
      foundBuildingZone: 'ISE & CSE Academic Cluster',
      storageLocation: 'Pending Staff Intake Verification',
      status: 'Pending Verification',
      estimatedValueBand: 'Low (< ₹500)',
      retentionClass: 'High-Value / Sensitive',
      retentionDays: 180,
      eligibleForDisposalAt: daysFromNow(179),
      imageRefs: [
        {
          url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
          caption: 'Blue lanyard tip submitted by student',
        },
      ],
    },
  ]);

  const [
    itemAirpods,
    itemCalculator,
    itemBottle,
    itemWallet,
    itemStationeryReview,
    itemStationeryDonated,
    itemKeys,
    itemStudentTip,
  ] = foundItems;

  // 4. Seed Lost Reports
  const lostReports = await LostReport.insertMany([
    {
      reportCode: 'LST-2026-501',
      reporterId: studentAarav._id,
      itemName: 'Apple AirPods Pro 2nd Gen in Charcoal Case',
      category: 'Electronics',
      description: 'Lost my white AirPods Pro inside a dark grey/charcoal silicone protective sleeve during afternoon lab session.',
      attributes: {
        colour: 'White / Charcoal',
        brand: 'Apple',
        size: 'Pocket / Small',
        material: 'Plastic / Silicone',
        distinctiveMarks: 'Mini Batman sticker inside the silicone sleeve',
        tags: ['airpods', 'apple', 'earbuds', 'charcoal', 'magsafe'],
      },
      lastSeen: {
        date: daysAgo(2),
        location: 'ISE Department Block - Lab 302',
        buildingZone: 'ISE & CSE Academic Cluster',
      },
      status: 'Possible Match',
    },
    {
      reportCode: 'LST-2026-502',
      reporterId: studentAarav._id,
      itemName: 'Casio fx-991EX Scientific Calculator',
      category: 'Calculator / Lab Gear',
      description: 'Left my black Casio ClassWiz 991EX calculator on the 2nd floor reading table while preparing for DBMS exam.',
      attributes: {
        colour: 'Black',
        brand: 'Casio',
        size: 'Medium / Handheld',
        material: 'Plastic',
        distinctiveMarks: 'Initials A.S. scratched on back plate',
        tags: ['calculator', 'casio', '991ex', 'classwiz'],
      },
      lastSeen: {
        date: daysAgo(3),
        location: 'Central Library Reading Hall (2nd Floor)',
        buildingZone: 'Central Library & Admin',
      },
      status: 'Claim Pending',
      matchedFoundItemId: itemCalculator._id,
    },
    {
      reportCode: 'LST-2026-503',
      reporterId: studentDiya._id,
      itemName: 'Milton 1 Litre Matte Teal Water Bottle',
      category: 'Bottle / Flask',
      description: 'Forgot my matte teal stainless steel Milton flask at Mingos outdoor table after lunch.',
      attributes: {
        colour: 'Teal / Blue',
        brand: 'Milton',
        size: 'Medium / Handheld',
        material: 'Stainless Steel',
        distinctiveMarks: 'GitHub Octocat sticker on the bottom',
        tags: ['bottle', 'milton', 'teal', 'flask'],
      },
      lastSeen: {
        date: daysAgo(5),
        location: 'Mingos Canteen & Food Court',
        buildingZone: 'Student Amenities & Food Court',
      },
      status: 'Claim Pending',
      matchedFoundItemId: itemBottle._id,
    },
    {
      reportCode: 'LST-2026-504',
      reporterId: studentKarthik._id,
      itemName: 'Tommy Hilfiger Brown Leather Wallet',
      category: 'Wallet / Purse',
      description: 'Dropped my brown leather bi-fold wallet containing Namma Metro card and cash during seminar.',
      attributes: {
        colour: 'Brown',
        brand: 'Tommy Hilfiger',
        size: 'Pocket / Small',
        material: 'Leather',
        distinctiveMarks: 'Metro card ending 4491',
        tags: ['wallet', 'brown', 'leather'],
      },
      lastSeen: {
        date: daysAgo(14),
        location: 'IEM Auditorium & Seminar Complex',
        buildingZone: 'Auditorium & Sports Complex',
      },
      status: 'Resolved',
      matchedFoundItemId: itemWallet._id,
    },
    {
      reportCode: 'LST-2026-505',
      reporterId: studentDiya._id,
      itemName: 'Black Sony WH-1000XM4 Wireless Headphones',
      category: 'Electronics',
      description: 'Matte black over-ear Sony headphones in hard fabric zip case.',
      attributes: {
        colour: 'Black',
        brand: 'Sony',
        size: 'Medium / Handheld',
        material: 'Plastic / Faux Leather',
        distinctiveMarks: 'Red cable tie on USB-C charging cord',
        tags: ['headphones', 'sony', 'xm4', 'audio'],
      },
      lastSeen: {
        date: daysAgo(1),
        location: 'CSE Seminar Hall & Turing Lounge',
        buildingZone: 'ISE & CSE Academic Cluster',
      },
      status: 'Active',
    },
  ]);

  const [reportAirpods, reportCalculator, reportBottle, reportWallet] = lostReports;

  // 5. Run matching engine to populate MatchCandidates & Notifications
  await runFullReconciliation();

  // 6. Seed Claims across Pending, Approved, and Handed Over states
  await Claim.insertMany([
    {
      claimCode: 'CLM-2026-801',
      lostReportId: reportCalculator._id,
      foundItemId: itemCalculator._id,
      claimantId: studentAarav._id,
      claimAnswers: {
        identifyingDetailAnswer: 'My initials "A.S." are engraved on the back plastic cover, and there is a small crack on the bottom right of the slide cover.',
        serialOrContentsDetail: 'Serial ends with 8821; inside the cover is a yellow sticky note with Normal Forms (1NF-BCNF) summary.',
        additionalContext: 'Left it at table #4 in the 2nd floor reading hall around 4:15 PM.',
      },
      status: 'Pending',
      submittedAt: daysAgo(2),
    },
    {
      claimCode: 'CLM-2026-802',
      lostReportId: reportBottle._id,
      foundItemId: itemBottle._id,
      claimantId: studentDiya._id,
      claimAnswers: {
        identifyingDetailAnswer: 'There is a black-and-white GitHub Octocat vinyl sticker on the bottom base and a slight dent near the bottom rim.',
        serialOrContentsDetail: '1 Litre Milton Thermosteel matte teal.',
        additionalContext: 'Verified by staff at Mingos.',
      },
      status: 'Approved',
      reviewedBy: adminUser._id,
      reviewNotesPrivate: 'Octocat sticker and base dent match restricted proof 100%. Approved for desk collection.',
      adminFeedbackToClaimant: 'Ownership verified! Please present Handover Pass HND-PASS-802 at Central Vault Rack C (Admin Office) between 10 AM and 4 PM.',
      handoverPassCode: 'HND-PASS-802',
      submittedAt: daysAgo(4),
      decidedAt: daysAgo(1),
    },
    {
      claimCode: 'CLM-2026-803',
      lostReportId: reportWallet._id,
      foundItemId: itemWallet._id,
      claimantId: studentKarthik._id,
      claimAnswers: {
        identifyingDetailAnswer: 'Contains ₹650 cash (one ₹500 note, one ₹100 note, one ₹50 note), Namma Metro card ending 4491, and brass locker key in coin pouch.',
        serialOrContentsDetail: 'Metro Card #4491',
        additionalContext: 'Lost during 3rd hour seminar in IEM Auditorium.',
      },
      status: 'Handed Over',
      reviewedBy: adminUser._id,
      reviewNotesPrivate: 'Exact match on currency denomination, Metro card digits, and brass key.',
      adminFeedbackToClaimant: 'Handed over in person after checking college ID.',
      handoverPassCode: 'HND-PASS-803',
      submittedAt: daysAgo(13),
      decidedAt: daysAgo(11),
    },
  ]);

  // 7. Seed Disposal Record for the donated stationery batch
  await DisposalRecord.create({
    disposalCode: 'DSP-2026-301',
    foundItemId: itemStationeryDonated._id,
    itemCodeSnapshot: itemStationeryDonated.itemCode,
    itemNameSnapshot: itemStationeryDonated.itemName,
    categorySnapshot: itemStationeryDonated.category,
    quantityDisposed: 12,
    reason: '30-day small-item stationery retention window expired with zero active claims or matches. Approved for campus reuse & NSS stationery drive.',
    eligibilityDate: itemStationeryDonated.eligibleForDisposalAt,
    approvedBy: adminUser._id,
    disposalMethod: 'Donate to Campus NGO / Drive',
    recipientOrWitness: {
      organizationOrDept: 'RVCE NSS Student Chapter - Government School Kit Drive',
      witnessName: 'Suresh Gowda (Vault Officer)',
      acknowledgementNote: 'Batch Lot #09 (12 items) handed over intact.',
    },
    disposedAt: daysAgo(20),
  });

  // 8. Seed Item Events (Append-Only Custody History)
  await ItemEvent.insertMany([
    {
      foundItemId: itemAirpods._id,
      actorId: staffUser._id,
      eventType: 'INTAKE_STORED',
      fromStatus: null,
      toStatus: 'Stored',
      note: 'Logged into High-Value Security Safe #01 • Slot A4.',
      timestamp: daysAgo(2),
    },
    {
      foundItemId: itemCalculator._id,
      actorId: staffUser._id,
      eventType: 'INTAKE_STORED',
      fromStatus: null,
      toStatus: 'Stored',
      note: 'Registered at Library Desk and placed in Central Vault Rack B • Bin #02.',
      timestamp: daysAgo(3),
    },
    {
      foundItemId: itemCalculator._id,
      actorId: studentAarav._id,
      eventType: 'CLAIM_SUBMITTED',
      fromStatus: 'Stored',
      toStatus: 'Claim Pending',
      note: 'Claim CLM-2026-801 submitted by Aarav Sharma; disposal eligibility frozen.',
      timestamp: daysAgo(2),
    },
    {
      foundItemId: itemBottle._id,
      actorId: staffUser._id,
      eventType: 'INTAKE_STORED',
      fromStatus: null,
      toStatus: 'Stored',
      note: 'Received from Mingos Canteen staff.',
      timestamp: daysAgo(5),
    },
    {
      foundItemId: itemBottle._id,
      actorId: adminUser._id,
      eventType: 'CLAIM_APPROVED',
      fromStatus: 'Claim Pending',
      toStatus: 'Approved',
      note: 'Claim CLM-2026-802 verified by Dr. Raghavendra Rao. Handover pass HND-PASS-802 generated.',
      timestamp: daysAgo(1),
    },
    {
      foundItemId: itemWallet._id,
      actorId: adminUser._id,
      eventType: 'INTAKE_STORED',
      fromStatus: null,
      toStatus: 'Stored',
      note: 'Placed in High-Value Security Safe #01.',
      timestamp: daysAgo(14),
    },
    {
      foundItemId: itemWallet._id,
      actorId: adminUser._id,
      eventType: 'CLAIM_APPROVED',
      fromStatus: 'Claim Pending',
      toStatus: 'Approved',
      note: 'Verified cash denominations and Namma Metro card #4491.',
      timestamp: daysAgo(12),
    },
    {
      foundItemId: itemWallet._id,
      actorId: adminUser._id,
      eventType: 'HANDOVER_COMPLETED',
      fromStatus: 'Approved',
      toStatus: 'Returned',
      note: 'Handed over to Karthik Hegde (STU-ECE-019) upon physical ID verification.',
      timestamp: daysAgo(11),
    },
    {
      foundItemId: itemStationeryReview._id,
      actorId: adminUser._id,
      eventType: 'RETENTION_REVIEW_FLAGGED',
      fromStatus: 'Stored',
      toStatus: 'Disposal Review',
      note: '30-day small-item retention policy elapsed for Stationery Batch Lot #14 (18 items). Flagged for admin disposal/donation review.',
      timestamp: daysAgo(6),
    },
    {
      foundItemId: itemStationeryDonated._id,
      actorId: adminUser._id,
      eventType: 'DONATION_EXECUTED',
      fromStatus: 'Disposal Review',
      toStatus: 'Donated',
      note: 'Approved batch donation (12 stationery items) to RVCE NSS Drive (DSP-2026-301).',
      timestamp: daysAgo(20),
    },
    {
      foundItemId: itemStudentTip._id,
      actorId: studentDiya._id,
      eventType: 'TIP_SUBMITTED',
      fromStatus: null,
      toStatus: 'Pending Verification',
      note: 'Student Found-Item Tip submitted by Diya Nair. Awaiting physical verification by Vault Staff.',
      timestamp: daysAgo(1),
    },
  ]);

  // 9. Seed Audit Logs
  await AuditLog.insertMany([
    {
      actorId: adminUser._id,
      actorRole: 'admin',
      action: 'CLAIM_APPROVED',
      entityType: 'Claim',
      entityId: (await Claim.findOne({ claimCode: 'CLM-2026-802' }))._id,
      beforeSummary: { status: 'Pending', itemStatus: 'Claim Pending' },
      afterSummary: { status: 'Approved', itemStatus: 'Approved', handoverPassCode: 'HND-PASS-802' },
      timestamp: daysAgo(1),
    },
    {
      actorId: adminUser._id,
      actorRole: 'admin',
      action: 'PHYSICAL_HANDOVER_COMPLETED',
      entityType: 'FoundItem',
      entityId: itemWallet._id,
      beforeSummary: { status: 'Approved' },
      afterSummary: { status: 'Returned', recipientIdentifier: 'STU-ECE-019' },
      timestamp: daysAgo(11),
    },
    {
      actorId: adminUser._id,
      actorRole: 'admin',
      action: 'BATCH_STATIONERY_DONATION_APPROVED',
      entityType: 'FoundItem',
      entityId: itemStationeryDonated._id,
      beforeSummary: { status: 'Disposal Review', batchQuantity: 12 },
      afterSummary: { status: 'Donated', disposalCode: 'DSP-2026-301', method: 'Donate to Campus NGO / Drive' },
      timestamp: daysAgo(20),
    },
  ]);

  return {
    seeded: true,
    counts: {
      users: users.length,
      campusLocations: campusLocationsData.length,
      foundItems: foundItems.length,
      lostReports: lostReports.length,
    },
  };
}

module.exports = {
  seedDatabase,
};
