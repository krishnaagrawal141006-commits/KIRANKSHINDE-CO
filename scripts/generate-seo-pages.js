const fs = require('fs');
const path = require('path');

// 185 hyper-local targeted places across Boisar, Tarapur MIDC, and Palghar District
const LOCATIONS = [
  // --- Zone 1: Tarapur MIDC & Industrial Belts (52 locations) ---
  { name: "Tarapur MIDC Zone 1", slug: "tarapur-midc-zone-1", zone: "Tarapur MIDC", pincode: "401506", landmark: "Near Boisar-Tarapur Main Road", distance: "3.5 km", type: "industrial", sectors: "Chemical, Bulk Drugs & Pharma" },
  { name: "Tarapur MIDC Zone 2", slug: "tarapur-midc-zone-2", zone: "Tarapur MIDC", pincode: "401506", landmark: "Near CETP Plant", distance: "4.2 km", type: "industrial", sectors: "Textile, Dyeing & Chemicals" },
  { name: "Tarapur MIDC Zone 3", slug: "tarapur-midc-zone-3", zone: "Tarapur MIDC", pincode: "401506", landmark: "Near Navapur Road Junction", distance: "5.1 km", type: "industrial", sectors: "Steel, Rolling Mills & Heavy Engineering" },
  { name: "Tarapur MIDC Zone 4", slug: "tarapur-midc-zone-4", zone: "Tarapur MIDC", pincode: "401506", landmark: "Near MIDC Police Station", distance: "4.8 km", type: "industrial", sectors: "Plastics, Polymers & Packaging" },
  { name: "Tarapur MIDC Zone 5", slug: "tarapur-midc-zone-5", zone: "Tarapur MIDC", pincode: "401506", landmark: "Near Tarapur Substation", distance: "5.6 km", type: "industrial", sectors: "Engineering & Specialty Chemicals" },
  { name: "Tarapur MIDC Chemical Zone", slug: "tarapur-midc-chemical-zone", zone: "Tarapur MIDC", pincode: "401506", landmark: "Chemical Corridor MIDC", distance: "4.0 km", type: "industrial", sectors: "Specialty Chemicals, Intermediates & Solvents" },
  { name: "Tarapur MIDC Bulk Drugs Zone", slug: "tarapur-midc-bulk-drugs-zone", zone: "Tarapur MIDC", pincode: "401506", landmark: "Pharma Cluster Tarapur", distance: "4.5 km", type: "industrial", sectors: "API & Active Pharmaceutical Ingredients" },
  { name: "Tarapur MIDC Textile Park", slug: "tarapur-midc-textile-park", zone: "Tarapur MIDC", pincode: "401506", landmark: "Near Textile Weaving Units", distance: "4.7 km", type: "industrial", sectors: "Textiles, Yarn, Weaving & Processing" },
  { name: "Tarapur MIDC Engineering Zone", slug: "tarapur-midc-engineering-zone", zone: "Tarapur MIDC", pincode: "401506", landmark: "Engineering Hub Boisar", distance: "3.8 km", type: "industrial", sectors: "Fabrication, Precision Engineering & Auto-components" },
  { name: "Tarapur MIDC Steel Rolling Zone", slug: "tarapur-midc-steel-rolling-zone", zone: "Tarapur MIDC", pincode: "401506", landmark: "Near Steel Foundries", distance: "5.2 km", type: "industrial", sectors: "Steel Mills, TMT Bars & Foundries" },
  { name: "Tarapur MIDC Plastics & Polymers Cluster", slug: "tarapur-midc-plastics-polymers-cluster", zone: "Tarapur MIDC", pincode: "401506", landmark: "Plastic Park Tarapur", distance: "4.3 km", type: "industrial", sectors: "Moulding, Polymer Processing & Extrusion" },
  { name: "Tarapur MIDC Packaging Hub", slug: "tarapur-midc-packaging-hub", zone: "Tarapur MIDC", pincode: "401506", landmark: "Near Corrugated Box Units", distance: "4.1 km", type: "industrial", sectors: "Corrugated Packaging, Printing & Labels" },
  { name: "Tarapur MIDC CETP Belt", slug: "tarapur-midc-cetp-belt", zone: "Tarapur MIDC", pincode: "401506", landmark: "Effluent Treatment Plant", distance: "4.9 km", type: "industrial", sectors: "Environmental Compliance & Chemical Works" },
  { name: "Tarapur MIDC Fire Station Area", slug: "tarapur-midc-fire-station-area", zone: "Tarapur MIDC", pincode: "401506", landmark: "MIDC Fire Brigade Station", distance: "3.9 km", type: "industrial", sectors: "Commercial & Industrial Safety Supplies" },
  { name: "Tarapur MIDC Administrative Area", slug: "tarapur-midc-administrative-area", zone: "Tarapur MIDC", pincode: "401506", landmark: "MIDC RO Office Building", distance: "3.6 km", type: "industrial", sectors: "Corporate Liaison & Industrial Advisory" },
  { name: "Tarapur MIDC Office Zone", slug: "tarapur-midc-office-zone", zone: "Tarapur MIDC", pincode: "401506", landmark: "Commercial Complex MIDC", distance: "3.7 km", type: "industrial", sectors: "Business Offices & Industrial Vendors" },
  { name: "Plot E-Road Tarapur MIDC", slug: "plot-e-road-tarapur-midc", zone: "Tarapur MIDC", pincode: "401506", landmark: "E-Sector Industrial Road", distance: "3.4 km", type: "industrial", sectors: "Manufacturing & Warehousing" },
  { name: "Plot G-Road Tarapur MIDC", slug: "plot-g-road-tarapur-midc", zone: "Tarapur MIDC", pincode: "401506", landmark: "G-Sector Manufacturing Belt", distance: "3.9 km", type: "industrial", sectors: "Chemical & Dye Formulation" },
  { name: "Plot J-Road Tarapur MIDC", slug: "plot-j-road-tarapur-midc", zone: "Tarapur MIDC", pincode: "401506", landmark: "J-Sector Central Line", distance: "4.1 km", type: "industrial", sectors: "Heavy Industry & Metal Fabrication" },
  { name: "Plot K-Road Tarapur MIDC", slug: "plot-k-road-tarapur-midc", zone: "Tarapur MIDC", pincode: "401506", landmark: "K-Sector Road", distance: "4.4 km", type: "industrial", sectors: "Pharmaceutical Packaging & Bulk Supply" },
  { name: "Plot L-Road Tarapur MIDC", slug: "plot-l-road-tarapur-midc", zone: "Tarapur MIDC", pincode: "401506", landmark: "L-Sector Industrial Area", distance: "4.7 km", type: "industrial", sectors: "Industrial Machinery & Processing" },
  { name: "Plot M-Road Tarapur MIDC", slug: "plot-m-road-tarapur-midc", zone: "Tarapur MIDC", pincode: "401506", landmark: "M-Sector Manufacturing Line", distance: "5.0 km", type: "industrial", sectors: "Polymers & Engineering Goods" },
  { name: "Plot N-Road Tarapur MIDC", slug: "plot-n-road-tarapur-midc", zone: "Tarapur MIDC", pincode: "401506", landmark: "N-Sector Road", distance: "5.3 km", type: "industrial", sectors: "Packaging & Light Industrial" },
  { name: "Plot W-Road Tarapur MIDC", slug: "plot-w-road-tarapur-midc", zone: "Tarapur MIDC", pincode: "401506", landmark: "W-Sector Corridor", distance: "5.5 km", type: "industrial", sectors: "Chemical Synthesis & Processing" },
  { name: "Plot OS Series Tarapur MIDC", slug: "plot-os-series-tarapur-midc", zone: "Tarapur MIDC", pincode: "401506", landmark: "Open Scheme OS Plots", distance: "5.8 km", type: "industrial", sectors: "Large Scale Plants & Refineries" },
  { name: "Navapur Road Tarapur MIDC", slug: "navapur-road-tarapur-midc", zone: "Tarapur MIDC", pincode: "401506", landmark: "Navapur Highway Arterial", distance: "4.5 km", type: "industrial", sectors: "Export Manufacturing & Logistics" },
  { name: "Kolwada Road Tarapur MIDC", slug: "kolwada-road-tarapur-midc", zone: "Tarapur MIDC", pincode: "401506", landmark: "Kolwada Crossway", distance: "4.6 km", type: "industrial", sectors: "Chemical Formulations & Storage" },
  { name: "Salwad Road Tarapur MIDC", slug: "salwad-road-tarapur-midc", zone: "Tarapur MIDC", pincode: "401506", landmark: "Salwad Industrial Link", distance: "3.2 km", type: "industrial", sectors: "Ancillary Units & Auto Spares" },
  { name: "Saravali Road Tarapur MIDC", slug: "saravali-road-tarapur-midc", zone: "Tarapur MIDC", pincode: "401506", landmark: "Saravali Industrial Connector", distance: "2.8 km", type: "industrial", sectors: "Textile Mills & Fabrication" },
  { name: "Betegaon Road Tarapur MIDC", slug: "betegaon-road-tarapur-midc", zone: "Tarapur MIDC", pincode: "401501", landmark: "Chilhar-Betegaon Junction", distance: "2.5 km", type: "industrial", sectors: "Warehouses & Steel Processing" },
  { name: "Kumbhavali Road Tarapur MIDC", slug: "kumbhavali-road-tarapur-midc", zone: "Tarapur MIDC", pincode: "401506", landmark: "Kumbhavali Link", distance: "5.4 km", type: "industrial", sectors: "Foundries & Heavy Machinery" },
  { name: "Salwad MIDC Industrial Area", slug: "salwad-midc-industrial-area", zone: "Tarapur MIDC", pincode: "401506", landmark: "Salwad Naka", distance: "3.1 km", type: "industrial", sectors: "Manufacturing & Distribution" },
  { name: "Saravali MIDC Industrial Area", slug: "saravali-midc-industrial-area", zone: "Tarapur MIDC", pincode: "401501", landmark: "Saravali Naka", distance: "2.6 km", type: "industrial", sectors: "Steel, Iron & Processing Plants" },
  { name: "Betegaon MIDC Industrial Area", slug: "betegaon-midc-industrial-area", zone: "Tarapur MIDC", pincode: "401501", landmark: "Betegaon Industrial Hub", distance: "2.4 km", type: "industrial", sectors: "Industrial Warehouses & MSME Plants" },
  { name: "Kolwada Industrial Zone", slug: "kolwada-industrial-zone", zone: "Tarapur MIDC", pincode: "401506", landmark: "Kolwada Bridge Belt", distance: "4.8 km", type: "industrial", sectors: "Intermediate Chemical Works" },
  { name: "Kumbhavali Industrial Area", slug: "kumbhavali-industrial-area", zone: "Tarapur MIDC", pincode: "401506", landmark: "Kumbhavali Phata", distance: "5.3 km", type: "industrial", sectors: "Engineering Workshops & Spares" },
  { name: "BARC Tarapur Colony", slug: "barc-tarapur-colony", zone: "Tarapur Nuclear Belt", pincode: "401504", landmark: "Bhabha Atomic Research Centre Colony", distance: "8.5 km", type: "government", sectors: "Contractors, Scientists & Defense Supply" },
  { name: "NPCIL TAPS Colony", slug: "npcil-taps-colony", zone: "Tarapur Nuclear Belt", pincode: "401504", landmark: "Nuclear Power Corporation Colony", distance: "9.0 km", type: "government", sectors: "Govt Employees, Contractors & Engineers" },
  { name: "TAPS 1 & 2 Contractor Belt", slug: "taps-1-and-2-contractor-belt", zone: "Tarapur Nuclear Belt", pincode: "401504", landmark: "Tarapur Atomic Power Station Units 1&2", distance: "9.5 km", type: "industrial", sectors: "Heavy Contractors, Civil & Electrical Firms" },
  { name: "TAPS 3 & 4 Power Plant Vicinity", slug: "taps-3-and-4-power-plant-vicinity", zone: "Tarapur Nuclear Belt", pincode: "401504", landmark: "Tarapur Atomic Power Station Units 3&4", distance: "10.0 km", type: "industrial", sectors: "Industrial Vendors & Maintenance Contractors" },
  { name: "Tarapur Atomic Power Station Belt", slug: "tarapur-atomic-power-station-belt", zone: "Tarapur Nuclear Belt", pincode: "401504", landmark: "TAPS Complex Gate", distance: "9.2 km", type: "government", sectors: "Defense Contractors & Engineering Services" },
  { name: "Tarapur Nuclear Colony", slug: "tarapur-nuclear-colony", zone: "Tarapur Nuclear Belt", pincode: "401504", landmark: "TAPS Township", distance: "8.8 km", type: "residential", sectors: "Salaried Professionals & Service Taxpayers" },
  { name: "Tarapur Chinchani Road Industrial", slug: "tarapur-chinchani-road-industrial", zone: "Tarapur MIDC", pincode: "401506", landmark: "Chinchani Junction Tarapur", distance: "6.2 km", type: "industrial", sectors: "Agro-processing & Packaging" },
  { name: "Tarapur MIDC Phase 1", slug: "tarapur-midc-phase-1", zone: "Tarapur MIDC", pincode: "401506", landmark: "Phase 1 Central Circle", distance: "3.7 km", type: "industrial", sectors: "Established Chemical & Engineering Units" },
  { name: "Tarapur MIDC Phase 2", slug: "tarapur-midc-phase-2", zone: "Tarapur MIDC", pincode: "401506", landmark: "Phase 2 Industrial Corridor", distance: "4.6 km", type: "industrial", sectors: "Modern Pharmaceutical & Export Plants" },
  { name: "Tarapur MIDC New Industrial Belt", slug: "tarapur-midc-new-industrial-belt", zone: "Tarapur MIDC", pincode: "401506", landmark: "Extension Area MIDC", distance: "5.7 km", type: "industrial", sectors: "New MSME Setups & Expansions" },
  { name: "Tarapur Chemical Manufacturing Zone", slug: "tarapur-chemical-manufacturing-zone", zone: "Tarapur MIDC", pincode: "401506", landmark: "Specialty Chemicals Block", distance: "4.2 km", type: "industrial", sectors: "Pigments, Resin & Industrial Solvents" },
  { name: "Tarapur MIDC Substation Area", slug: "tarapur-midc-substation-area", zone: "Tarapur MIDC", pincode: "401506", landmark: "MSEDCL 220kV Substation", distance: "4.4 km", type: "industrial", sectors: "High Tension Power Industry" },
  { name: "Tarapur Warehousing & Logistics Park", slug: "tarapur-warehousing-logistics-park", zone: "Tarapur MIDC", pincode: "401506", landmark: "Industrial Godowns", distance: "3.9 km", type: "industrial", sectors: "Logistics, 3PL & Supply Chain" },
  { name: "Tarapur Industrial Transport Nagar", slug: "tarapur-industrial-transport-nagar", zone: "Tarapur MIDC", pincode: "401506", landmark: "Transport Union Office", distance: "4.1 km", type: "commercial", sectors: "Fleet Owners, Transporters & Cargo" },
  { name: "Tarapur MIDC Export Processing Zone", slug: "tarapur-midc-export-processing-zone", zone: "Tarapur MIDC", pincode: "401506", landmark: "Customs Bonding Area", distance: "4.8 km", type: "industrial", sectors: "100% Export Oriented Units (EOU)" },
  { name: "Tarapur MIDC MSME Cluster", slug: "tarapur-midc-msme-cluster", zone: "Tarapur MIDC", pincode: "401506", landmark: "Small Scale Industries Park", distance: "3.5 km", type: "industrial", sectors: "Micro & Small Scale Enterprises" },

  // --- Zone 2: Boisar Core Town & Commercial Localities (46 locations) ---
  { name: "Khaira Boisar", slug: "khaira-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Opp. Railway Station (Firm Head Office)", distance: "0.0 km", type: "commercial", sectors: "Trading, CA Firm HQ & Retail" },
  { name: "Boisar Railway Station East", slug: "boisar-railway-station-east", zone: "Boisar Core", pincode: "401501", landmark: "East Station Exit", distance: "0.2 km", type: "commercial", sectors: "Station Market & Service Providers" },
  { name: "Boisar Railway Station West", slug: "boisar-railway-station-west", zone: "Boisar Core", pincode: "401501", landmark: "West Platform Road", distance: "0.3 km", type: "commercial", sectors: "Commercial Complexes & Retail" },
  { name: "Opp. Boisar Railway Station", slug: "opp-boisar-railway-station", zone: "Boisar Core", pincode: "401501", landmark: "Station Front Promenade", distance: "0.1 km", type: "commercial", sectors: "Financial Consultants & Merchants" },
  { name: "Boisar Station Road", slug: "boisar-station-road", zone: "Boisar Core", pincode: "401501", landmark: "Main Commercial Thoroughfare", distance: "0.3 km", type: "commercial", sectors: "Banks, Jewelers & Corporate Offices" },
  { name: "Boisar Market Road", slug: "boisar-market-road", zone: "Boisar Core", pincode: "401501", landmark: "Central Market", distance: "0.5 km", type: "commercial", sectors: "Wholesale & Retail Businesses" },
  { name: "Circus Ground Boisar", slug: "circus-ground-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Near Exhibition Ground", distance: "0.6 km", type: "commercial", sectors: "Commercial Establishments & Traders" },
  { name: "Bima Complex Boisar", slug: "bima-complex-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Near LIC Office", distance: "0.4 km", type: "commercial", sectors: "Insurance, Financial Services & Clinics" },
  { name: "Anand Nagar Boisar", slug: "anand-nagar-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Anand Nagar Main Road", distance: "0.8 km", type: "mixed", sectors: "Traders, Professionals & Residences" },
  { name: "Sai Baba Mandir Road Boisar", slug: "sai-baba-mandir-road-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Shirdi Sai Baba Temple", distance: "0.7 km", type: "mixed", sectors: "Local Enterprises & Housing Societies" },
  { name: "Datta Mandir Road Boisar", slug: "datta-mandir-road-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Shree Datta Mandir", distance: "0.9 km", type: "residential", sectors: "Service Sector & Housing" },
  { name: "Ganpati Mandir Boisar", slug: "ganpati-mandir-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Station Ganpati Mandir", distance: "0.3 km", type: "commercial", sectors: "Local Retail & Grocery Wholesalers" },
  { name: "Dandi Road Boisar", slug: "dandi-road-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Towards Dandi Coastal Route", distance: "1.8 km", type: "mixed", sectors: "Warehouses, Retail & Residences" },
  { name: "Navapur Naka Boisar", slug: "navapur-naka-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Navapur Naka Circle", distance: "1.2 km", type: "commercial", sectors: "Hardware, Building Materials & Transport" },
  { name: "Navapur Beach Road Boisar", slug: "navapur-beach-road-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Navapur Coastal Corridor", distance: "3.0 km", type: "mixed", sectors: "Hotels, Resorts & Retail" },
  { name: "Chinchani Road Boisar", slug: "chinchani-road-boisar", zone: "Boisar Core", pincode: "401501", landmark: "State Highway 73 Route", distance: "2.0 km", type: "mixed", sectors: "Automotive Garages & MSMEs" },
  { name: "Katkar Pada Boisar", slug: "katkar-pada-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Near Katkar Pada Bridge", distance: "1.5 km", type: "residential", sectors: "Individual Taxpayers & Contractors" },
  { name: "Shreeram Nagar Boisar", slug: "shreeram-nagar-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Shreeram Nagar Entrance", distance: "1.1 km", type: "residential", sectors: "Salaried Employees & Professionals" },
  { name: "Hanuman Nagar Boisar", slug: "hanuman-nagar-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Hanuman Temple Boisar", distance: "1.0 km", type: "mixed", sectors: "Small Scale Businesses & Housing" },
  { name: "Shivaji Nagar Boisar", slug: "shivaji-nagar-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Near Shivaji Chowk", distance: "0.7 km", type: "commercial", sectors: "Retailers, Wholesalers & Pharmacies" },
  { name: "Subhash Nagar Boisar", slug: "subhash-nagar-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Subhash Nagar Main Gate", distance: "0.9 km", type: "residential", sectors: "Government & Private Sector Employees" },
  { name: "Ambedkar Nagar Boisar", slug: "ambedkar-nagar-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Ambedkar Bhavan Road", distance: "0.8 km", type: "residential", sectors: "Contractors & Service Taxpayers" },
  { name: "Gandhi Nagar Boisar", slug: "gandhi-nagar-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Near Old Post Office", distance: "0.6 km", type: "mixed", sectors: "Local Enterprises & Service Providers" },
  { name: "Shanti Nagar Boisar", slug: "shanti-nagar-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Shanti Nagar Colony", distance: "1.3 km", type: "residential", sectors: "Residential Societies & Salaried ITR" },
  { name: "Ram Nagar Boisar", slug: "ram-nagar-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Ram Mandir Marg", distance: "0.7 km", type: "residential", sectors: "Teachers, Engineers & Bank Staff" },
  { name: "Shastri Nagar Boisar", slug: "shastri-nagar-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Shastri Nagar Enclave", distance: "1.0 km", type: "residential", sectors: "Corporate Staff & Tax Planning" },
  { name: "Ashok Nagar Boisar", slug: "ashok-nagar-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Near Ashok Stambh Circle", distance: "0.8 km", type: "mixed", sectors: "Local Merchants & Taxpayers" },
  { name: "Boisar Main Bazaar", slug: "boisar-main-bazaar", zone: "Boisar Core", pincode: "401501", landmark: "Old Vegetable & Cloth Bazaar", distance: "0.4 km", type: "commercial", sectors: "Traders, Kirana & Textiles" },
  { name: "Boisar Cloth Market", slug: "boisar-cloth-market", zone: "Boisar Core", pincode: "401501", landmark: "Kapda Market Boisar", distance: "0.4 km", type: "commercial", sectors: "Garment Retailers & Wholesalers" },
  { name: "Boisar Electronics Market", slug: "boisar-electronics-market", zone: "Boisar Core", pincode: "401501", landmark: "Station Road Electronics Lane", distance: "0.3 km", type: "commercial", sectors: "Appliance Dealers & IT Vendors" },
  { name: "Boisar Wholesale Market", slug: "boisar-wholesale-market", zone: "Boisar Core", pincode: "401501", landmark: "Grain & Hardware Wholesale", distance: "0.6 km", type: "commercial", sectors: "Wholesale Distributors & Dealers" },
  { name: "Boisar APMC Market", slug: "boisar-apmc-market", zone: "Boisar Core", pincode: "401501", landmark: "APMC Yard Boisar", distance: "1.4 km", type: "commercial", sectors: "Agricultural Commission Agents & Mandi" },
  { name: "Boisar Taxi Stand Area", slug: "boisar-taxi-stand-area", zone: "Boisar Core", pincode: "401501", landmark: "Station Auto & Taxi Stand", distance: "0.1 km", type: "commercial", sectors: "Travel Agencies & Transporters" },
  { name: "Boisar Bus Depot Area", slug: "boisar-bus-depot-area", zone: "Boisar Core", pincode: "401501", landmark: "MSRTC Boisar Bus Stand", distance: "0.5 km", type: "commercial", sectors: "Commercial Outlets & Hotels" },
  { name: "Mahavir Nagar Boisar", slug: "mahavir-nagar-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Jain Derasar Road", distance: "0.9 km", type: "mixed", sectors: "Jewelers, Traders & Investors" },
  { name: "Panchwati Boisar", slug: "panchwati-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Panchwati Colony", distance: "1.2 km", type: "residential", sectors: "Middle Class Housing & Salaried Tax" },
  { name: "Gokul Nagar Boisar", slug: "gokul-nagar-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Gokul Dairy Road", distance: "1.1 km", type: "residential", sectors: "Dairy & Local Micro Enterprises" },
  { name: "Vikas Nagar Boisar", slug: "vikas-nagar-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Vikas Nagar Crossway", distance: "1.3 km", type: "residential", sectors: "Service Employees & ITR Filers" },
  { name: "Pragati Nagar Boisar", slug: "pragati-nagar-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Pragati School Road", distance: "1.4 km", type: "residential", sectors: "Schools, Teachers & Professionals" },
  { name: "Surya Nagar Boisar", slug: "surya-nagar-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Surya Valley Road", distance: "1.5 km", type: "residential", sectors: "Housing Societies & Tax Returns" },
  { name: "Deep Nagar Boisar", slug: "deep-nagar-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Deep Nagar Housing", distance: "1.2 km", type: "residential", sectors: "Factory Staff & ITR Filers" },
  { name: "Sagar Darshan Boisar", slug: "sagar-darshan-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Near Coastal Arterial", distance: "2.1 km", type: "residential", sectors: "Homeowners & Rental Income Tax" },
  { name: "Krishna Nagar Boisar", slug: "krishna-nagar-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Krishna Nagar Mandir", distance: "0.9 km", type: "residential", sectors: "Independent Businesses & Salaried" },
  { name: "Somnath Nagar Boisar", slug: "somnath-nagar-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Somnath Temple Route", distance: "1.0 km", type: "residential", sectors: "Housing Societies & Small Firms" },
  { name: "Radha Krishna Nagar Boisar", slug: "radha-krishna-nagar-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Radha Krishna Enclave", distance: "1.1 km", type: "residential", sectors: "Family Businesses & Capital Gains" },
  { name: "Siddhivinayak Nagar Boisar", slug: "siddhivinayak-nagar-boisar", zone: "Boisar Core", pincode: "401501", landmark: "Siddhivinayak Temple Road", distance: "1.0 km", type: "residential", sectors: "Professionals & Corporate Taxpayers" },

  // --- Zone 3: Major Residential Townships & Societies in Boisar (36 locations) ---
  { name: "Ostwal Empire Boisar", slug: "ostwal-empire-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Ostwal Township Gate", distance: "1.6 km", type: "residential", sectors: "Apartment Owners, Salaried Tax & Capital Gains" },
  { name: "Tata Shubh Griha Boisar", slug: "tata-shubh-griha-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Tata Housing Mega Township", distance: "2.8 km", type: "residential", sectors: "Engineers, Managers & Salaried ITR" },
  { name: "Tata New Haven Boisar", slug: "tata-new-haven-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Tata New Haven Phase 1 & 2", distance: "3.0 km", type: "residential", sectors: "Corporate Professionals & Home Loan Rebates" },
  { name: "HDIL Paradise City Boisar", slug: "hdil-paradise-city-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Paradise City Central Avenue", distance: "3.2 km", type: "residential", sectors: "Mega Housing Community & Tax Advisory" },
  { name: "Mahindra Happinest Boisar", slug: "mahindra-happinest-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Mahindra Happinest Complex", distance: "3.4 km", type: "residential", sectors: "Modern Housing & Financial Planning" },
  { name: "Viraat Nagar Boisar", slug: "viraat-nagar-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Viraat Nagar Main Arch", distance: "1.2 km", type: "residential", sectors: "Commercial Hub & Housing Societies" },
  { name: "Yashwant Srishti Boisar", slug: "yashwant-srishti-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Yashwant Srishti Phase 1", distance: "1.5 km", type: "residential", sectors: "Salaried Employees & Senior Citizens" },
  { name: "Sagar Srishti Boisar", slug: "sagar-srishti-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Sagar Srishti Complex", distance: "1.7 km", type: "residential", sectors: "Apartment Complexes & Capital Gains" },
  { name: "Agrawal Complex Boisar", slug: "agrawal-complex-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Agrawal Supermarket Road", distance: "0.8 km", type: "mixed", sectors: "Business Community & Traders" },
  { name: "Dream City Boisar", slug: "dream-city-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Dream City Gate", distance: "2.2 km", type: "residential", sectors: "Residential Townships & Salaried ITR" },
  { name: "Krishna Valley Boisar", slug: "krishna-valley-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Krishna Valley Main Road", distance: "2.0 km", type: "residential", sectors: "Housing Societies & Tax Filing" },
  { name: "Regency Park Boisar", slug: "regency-park-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Regency Park Complex", distance: "1.4 km", type: "residential", sectors: "Premium Apartments & Investment Planning" },
  { name: "Sai Leela Complex Boisar", slug: "sai-leela-complex-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Sai Leela Commercial Center", distance: "0.9 km", type: "mixed", sectors: "Doctors, Lawyers & Retail Stores" },
  { name: "Silver City Boisar", slug: "silver-city-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Silver City Entrance", distance: "2.3 km", type: "residential", sectors: "New Home Buyers & Property Tax" },
  { name: "Green Valley Boisar", slug: "green-valley-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Green Valley Township", distance: "2.6 km", type: "residential", sectors: "Salaried Professionals & Tax Rebates" },
  { name: "Royal Palms Boisar", slug: "royal-palms-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Royal Palms Avenue", distance: "2.1 km", type: "residential", sectors: "Middle Class Families & Income Tax" },
  { name: "Palm Beach Residency Boisar", slug: "palm-beach-residency-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Near Coastal Connector", distance: "2.7 km", type: "residential", sectors: "Apartments & Capital Gains" },
  { name: "Golden City Boisar", slug: "golden-city-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Golden City Gate", distance: "2.5 km", type: "residential", sectors: "New Townships & Individual ITR" },
  { name: "Harmony Residency Boisar", slug: "harmony-residency-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Harmony Housing", distance: "1.9 km", type: "residential", sectors: "Salaried Taxpayers & Consultants" },
  { name: "Shreeji Complex Boisar", slug: "shreeji-complex-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Shreeji Commercial Plaza", distance: "0.7 km", type: "mixed", sectors: "Traders, Retailers & Tax Audits" },
  { name: "Raj Residency Boisar", slug: "raj-residency-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Raj Residency Main Arch", distance: "1.8 km", type: "residential", sectors: "Housing Societies & Tax Savings" },
  { name: "Vrindavan Park Boisar", slug: "vrindavan-park-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Vrindavan Park Gardens", distance: "1.6 km", type: "residential", sectors: "Family Residences & Mutual Fund Taxation" },
  { name: "Sai Shraddha Complex Boisar", slug: "sai-shraddha-complex-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Sai Shraddha Plaza", distance: "0.8 km", type: "mixed", sectors: "Small Enterprises & Professionals" },
  { name: "Shanti Park Boisar", slug: "shanti-park-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Shanti Park Colony", distance: "1.5 km", type: "residential", sectors: "Factory Employees & ITR Filing" },
  { name: "Arihant Residency Boisar", slug: "arihant-residency-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Arihant Enclave", distance: "1.7 km", type: "residential", sectors: "Business Families & Corporate Tax" },
  { name: "Om Sai Complex Boisar", slug: "om-sai-complex-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Om Sai Building Gate", distance: "0.6 km", type: "mixed", sectors: "Retail Shopkeepers & GST Returns" },
  { name: "Balaji Residency Boisar", slug: "balaji-residency-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Balaji Temple Road", distance: "1.3 km", type: "residential", sectors: "Housing Society Accounting & ITR" },
  { name: "Tulsi Complex Boisar", slug: "tulsi-complex-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Tulsi Commercial Wing", distance: "0.9 km", type: "mixed", sectors: "Service Providers & GST Compliance" },
  { name: "Radhe Shyam Complex Boisar", slug: "radhe-shyam-complex-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Radhe Shyam Arcade", distance: "1.1 km", type: "commercial", sectors: "Clinics, Pharmacies & Service Tax" },
  { name: "Vardhman City Boisar", slug: "vardhman-city-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Vardhman Township Gate", distance: "2.4 km", type: "residential", sectors: "Township Residents & Investment Income" },
  { name: "Marvel Park Boisar", slug: "marvel-park-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Marvel Park Avenue", distance: "2.1 km", type: "residential", sectors: "Industrial Staff & Homeowners" },
  { name: "Crown Complex Boisar", slug: "crown-complex-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Crown Commercial Wing", distance: "1.0 km", type: "mixed", sectors: "Corporate Consultants & Traders" },
  { name: "Elite City Boisar", slug: "elite-city-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Elite City Entrance", distance: "2.9 km", type: "residential", sectors: "New Township Housing & ITR" },
  { name: "Galaxy Enclave Boisar", slug: "galaxy-enclave-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Galaxy Enclave Gate", distance: "2.0 km", type: "residential", sectors: "Modern Apartments & Tax Planning" },
  { name: "Fortune Residency Boisar", slug: "fortune-residency-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Fortune Towers", distance: "1.8 km", type: "residential", sectors: "Salaried Executives & Capital Gains" },
  { name: "Navkar Residency Boisar", slug: "navkar-residency-boisar", zone: "Boisar Townships", pincode: "401501", landmark: "Navkar Complex", distance: "1.2 km", type: "residential", sectors: "Merchants & Housing Societies" },

  // --- Zone 4: Outer Boisar Villages, Coastal & Rural Belts (26 locations) ---
  { name: "Navapur Village", slug: "navapur-village", zone: "Outer Boisar & Coastal", pincode: "401501", landmark: "Navapur Gram Panchayat", distance: "3.5 km", type: "coastal", sectors: "Fisheries, Tourism & Export Units" },
  { name: "Kurgaon Village", slug: "kurgaon-village", zone: "Outer Boisar & Coastal", pincode: "401501", landmark: "Kurgaon Phata", distance: "4.2 km", type: "mixed", sectors: "Brick Kilns, MSMEs & Agro Traders" },
  { name: "Pamtembhi Village", slug: "pamtembhi-village", zone: "Outer Boisar & Coastal", pincode: "401501", landmark: "Pamtembhi Coastal Route", distance: "5.0 km", type: "coastal", sectors: "Fish Processing, Ice Plants & Cold Storage" },
  { name: "Salwad Village", slug: "salwad-village", zone: "Outer Boisar & Coastal", pincode: "401501", landmark: "Old Salwad Gaothan", distance: "2.9 km", type: "mixed", sectors: "Industrial Workforce & Contractors" },
  { name: "Saravali Village", slug: "saravali-village", zone: "Outer Boisar & Coastal", pincode: "401501", landmark: "Saravali Gram Panchayat", distance: "2.4 km", type: "mixed", sectors: "Transport Contractors & Ancillaries" },
  { name: "Maan Village Boisar", slug: "maan-village-boisar", zone: "Outer Boisar & Coastal", pincode: "401501", landmark: "Maan Phata", distance: "3.8 km", type: "mixed", sectors: "Logistics, Warehousing & Agro" },
  { name: "Betegaon Village", slug: "betegaon-village", zone: "Outer Boisar & Coastal", pincode: "401501", landmark: "Betegaon Gaothan", distance: "2.2 km", type: "mixed", sectors: "Steel Contractors & Fabrication" },
  { name: "Kumbhavali Village", slug: "kumbhavali-village", zone: "Outer Boisar & Coastal", pincode: "401506", landmark: "Kumbhavali Gaothan", distance: "5.1 km", type: "rural", sectors: "Agriculture, Brick Manufacturing & Labour" },
  { name: "Kolwada Village", slug: "kolwada-village", zone: "Outer Boisar & Coastal", pincode: "401506", landmark: "Kolwada Creek", distance: "4.5 km", type: "rural", sectors: "Chemical Transport & Agro Supply" },
  { name: "Kambalgaon Village", slug: "kambalgaon-village", zone: "Outer Boisar & Coastal", pincode: "401501", landmark: "Kambalgaon Road", distance: "4.0 km", type: "rural", sectors: "Warehouses & Real Estate" },
  { name: "Kolgaon Boisar", slug: "kolgaon-boisar", zone: "Outer Boisar & Coastal", pincode: "401501", landmark: "Kolgaon Phata", distance: "3.7 km", type: "mixed", sectors: "Local Enterprises & Small Workshops" },
  { name: "Uchheli Village", slug: "uchheli-village", zone: "Outer Boisar & Coastal", pincode: "401501", landmark: "Uchheli Beach Road", distance: "4.8 km", type: "coastal", sectors: "Fisheries & Coastal Resorts" },
  { name: "Dandi Beach Area", slug: "dandi-beach-area", zone: "Outer Boisar & Coastal", pincode: "401501", landmark: "Dandi Seashore", distance: "5.4 km", type: "coastal", sectors: "Resorts, Restaurants & Fisheries" },
  { name: "Pophran Village", slug: "pophran-village", zone: "Outer Boisar & Coastal", pincode: "401501", landmark: "Pophran Dam Road", distance: "6.0 km", type: "rural", sectors: "Horticulture, Dairy & Farm Houses" },
  { name: "Varor Village", slug: "varor-village", zone: "Outer Boisar & Coastal", pincode: "401501", landmark: "Varor Coastal Route", distance: "6.5 km", type: "coastal", sectors: "Aquaculture & Marine Farming" },
  { name: "Murbe Coastal Belt", slug: "murbe-coastal-belt", zone: "Outer Boisar & Coastal", pincode: "401501", landmark: "Murbe Fishing Harbour", distance: "7.2 km", type: "coastal", sectors: "Fishing Fleets, Export & Marine Ice Plants" },
  { name: "Nandgaon Village Boisar", slug: "nandgaon-village-boisar", zone: "Outer Boisar & Coastal", pincode: "401501", landmark: "Nandgaon Phata", distance: "6.8 km", type: "rural", sectors: "Agriculturalists & Contractors" },
  { name: "Alewadi Village", slug: "alewadi-village", zone: "Outer Boisar & Coastal", pincode: "401501", landmark: "Alewadi Coastal Line", distance: "7.5 km", type: "coastal", sectors: "Fisheries & Beach Cottages" },
  { name: "Tarapur Village", slug: "tarapur-village", zone: "Outer Boisar & Coastal", pincode: "401506", landmark: "Historic Tarapur Gaothan", distance: "6.0 km", type: "mixed", sectors: "Traditional Businesses, Gold & Retail" },
  { name: "Chinchani Beach Belt", slug: "chinchani-beach-belt", zone: "Outer Boisar & Coastal", pincode: "401503", landmark: "Chinchani Seashore", distance: "8.0 km", type: "coastal", sectors: "Educational Institutes, Tourism & Dyeing" },
  { name: "Gholvad Village", slug: "gholvad-village", zone: "Outer Boisar & Coastal", pincode: "401701", landmark: "Chiku Orchards Hub", distance: "28.0 km", type: "rural", sectors: "Chiku Farmers, Agro Processing & Tourism" },
  { name: "Bordi Border Belt", slug: "bordi-border-belt", zone: "Outer Boisar & Coastal", pincode: "401701", landmark: "Bordi Beach & Gujarat Border", distance: "35.0 km", type: "coastal", sectors: "Resorts, Agro Exports & Trade" },
  { name: "Vangaon Station Area", slug: "vangaon-station-area", zone: "Outer Boisar & Coastal", pincode: "401103", landmark: "Vangaon Railway Station", distance: "12.0 km", type: "semi-urban", sectors: "Traders, Brick Kilns & Farmers" },
  { name: "Saphale Station Area", slug: "saphale-station-area", zone: "Outer Boisar & Coastal", pincode: "401102", landmark: "Saphale Railway Junction", distance: "24.0 km", type: "semi-urban", sectors: "Industrial Ancillaries & Local Retail" },
  { name: "Kelve Beach Road", slug: "kelve-beach-road", zone: "Outer Boisar & Coastal", pincode: "401401", landmark: "Kelve Fort & Beach", distance: "20.0 km", type: "coastal", sectors: "Resorts, Tourism, Agriculture & Fish" },
  { name: "Kumbhavali Phata", slug: "kumbhavali-phata", zone: "Outer Boisar & Coastal", pincode: "401506", landmark: "Main Highway Cross", distance: "4.7 km", type: "mixed", sectors: "Transport & Spare Parts" },

  // --- Zone 5: Palghar City, Commercial Localities & Industrial Belts (31 locations) ---
  { name: "Palghar East", slug: "palghar-east", zone: "Palghar City", pincode: "401404", landmark: "Palghar Station East Wing", distance: "16.0 km", type: "commercial", sectors: "Wholesale Markets, Real Estate & Clinics" },
  { name: "Palghar West", slug: "palghar-west", zone: "Palghar City", pincode: "401404", landmark: "Palghar Main Bazar West", distance: "16.2 km", type: "commercial", sectors: "Banks, Jewelers, CA Offices & Traders" },
  { name: "Station Road Palghar", slug: "station-road-palghar", zone: "Palghar City", pincode: "401404", landmark: "Palghar Station Commercial Corridor", distance: "16.1 km", type: "commercial", sectors: "Corporate Banking & High Street Retail" },
  { name: "Kacheri Road Palghar", slug: "kacheri-road-palghar", zone: "Palghar City", pincode: "401404", landmark: "District Sessions Court & Collectorate", distance: "15.8 km", type: "government", sectors: "Advocates, Notaries, Valuers & Tax Consultants" },
  { name: "Manor Road Palghar", slug: "manor-road-palghar", zone: "Palghar City", pincode: "401404", landmark: "Palghar-Manor State Highway", distance: "16.5 km", type: "commercial", sectors: "Automotive Showrooms, Hospitals & Colleges" },
  { name: "Mahim Road Palghar", slug: "mahim-road-palghar", zone: "Palghar City", pincode: "401404", landmark: "Mahim Coastal Road", distance: "17.0 km", type: "mixed", sectors: "Educational Institutes & Housing Colonies" },
  { name: "Tembhode Palghar", slug: "tembhode-palghar", zone: "Palghar City", pincode: "401404", landmark: "Tembhode Gram Panchayat", distance: "15.0 km", type: "residential", sectors: "New Residential Townships & Small Shops" },
  { name: "Tembhode Naka", slug: "tembhode-naka", zone: "Palghar City", pincode: "401404", landmark: "Tembhode Circle", distance: "15.2 km", type: "commercial", sectors: "Commercial Retail & Building Supplies" },
  { name: "Alyali Palghar", slug: "alyali-palghar", zone: "Palghar City", pincode: "401404", landmark: "Alyali Phata", distance: "14.5 km", type: "mixed", sectors: "Industrial Sheds & Residential" },
  { name: "Alyali Phata", slug: "alyali-phata", zone: "Palghar City", pincode: "401404", landmark: "Palghar-Boisar Road Junction", distance: "14.2 km", type: "commercial", sectors: "Warehouses & Transport Hubs" },
  { name: "Shirgaon Palghar", slug: "shirgaon-palghar", zone: "Palghar City", pincode: "401407", landmark: "Shirgaon Fort & Beach Road", distance: "19.0 km", type: "coastal", sectors: "Betel Leaf Farmers, Coconut & Tourism" },
  { name: "Shirgaon Beach Road", slug: "shirgaon-beach-road", zone: "Palghar City", pincode: "401407", landmark: "Shirgaon Coastline", distance: "19.5 km", type: "coastal", sectors: "Resorts & Agri-Business" },
  { name: "Satpati Coastal Belt", slug: "satpati-coastal-belt", zone: "Palghar City", pincode: "401405", landmark: "Satpati Port", distance: "21.0 km", type: "coastal", sectors: "Major Fishery Port, Trawlers & Marine Exporters" },
  { name: "Satpati Fisheries Market", slug: "satpati-fisheries-market", zone: "Palghar City", pincode: "401405", landmark: "Fisheries Co-operative Society", distance: "21.2 km", type: "commercial", sectors: "Fish Processing, Ice Plants & Cold Chains" },
  { name: "Vevoor Palghar", slug: "vevoor-palghar", zone: "Palghar City", pincode: "401404", landmark: "Vevoor Industrial Sector", distance: "17.5 km", type: "industrial", sectors: "Paper Mills, Packaging & Fabrication" },
  { name: "Haranwali Palghar", slug: "haranwali-palghar", zone: "Palghar City", pincode: "401404", landmark: "Haranwali Naka", distance: "16.8 km", type: "mixed", sectors: "Local Businesses & MSMEs" },
  { name: "Morgaon Palghar", slug: "morgaon-palghar", zone: "Palghar City", pincode: "401404", landmark: "Morgaon Phata", distance: "17.2 km", type: "rural", sectors: "Dairy, Agro & Rural Contractors" },
  { name: "Janta Colony Palghar", slug: "janta-colony-palghar", zone: "Palghar City", pincode: "401404", landmark: "Janta Colony Main Road", distance: "16.3 km", type: "residential", sectors: "Salaried Employees & Retail Traders" },
  { name: "Anand Nagar Palghar", slug: "anand-nagar-palghar", zone: "Palghar City", pincode: "401404", landmark: "Anand Nagar Palghar Gate", distance: "16.4 km", type: "residential", sectors: "Housing Societies & Tax Returns" },
  { name: "Mahim Village Palghar", slug: "mahim-village-palghar", zone: "Palghar City", pincode: "401402", landmark: "Mahim Beach Entrance", distance: "18.5 km", type: "coastal", sectors: "Fisheries, Horticulture & Tourism" },
  { name: "Kelva Road Palghar", slug: "kelva-road-palghar", zone: "Palghar City", pincode: "401401", landmark: "Kelva Road Railway Station", distance: "22.0 km", type: "mixed", sectors: "Hotels, Homestays & Agriculture" },
  { name: "Saphale East", slug: "saphale-east", zone: "Palghar District", pincode: "401102", landmark: "Saphale Station East Market", distance: "24.5 km", type: "commercial", sectors: "Local Traders, Agro Chemical Vendors" },
  { name: "Saphale West", slug: "saphale-west", zone: "Palghar District", pincode: "401102", landmark: "Saphale West Bazaar", distance: "24.8 km", type: "commercial", sectors: "Retailers, Commission Agents & Housing" },
  { name: "Sundaram Industrial Estate Palghar", slug: "sundaram-industrial-estate-palghar", zone: "Palghar Industrial", pincode: "401404", landmark: "Sundaram Industrial Complex", distance: "17.2 km", type: "industrial", sectors: "Printing, Stationery, Polymers & Fabrication" },
  { name: "Bidco Industrial Area Palghar", slug: "bidco-industrial-area-palghar", zone: "Palghar Industrial", pincode: "401404", landmark: "Bidco Compound Palghar East", distance: "17.0 km", type: "industrial", sectors: "Light Engineering, Chemicals & Assemblies" },
  { name: "Dewan & Shah Industrial Estate Palghar", slug: "dewan-and-shah-industrial-estate-palghar", zone: "Palghar Industrial", pincode: "401404", landmark: "Dewan & Shah Complex", distance: "16.8 km", type: "industrial", sectors: "Tooling, Dies, Moulds & Small Factories" },
  { name: "Rayate Industrial Area Palghar", slug: "rayate-industrial-area-palghar", zone: "Palghar Industrial", pincode: "401404", landmark: "Rayate Phata", distance: "18.0 km", type: "industrial", sectors: "Heavy Works, Fabrication & Warehouses" },
  { name: "Palghar MIDC Industrial Area", slug: "palghar-midc-industrial-area", zone: "Palghar Industrial", pincode: "401404", landmark: "Palghar Industrial MIDC Belt", distance: "17.4 km", type: "industrial", sectors: "Plastics, Metals, Paper & Electricals" },
  { name: "Palghar Co-operative Industrial Estate", slug: "palghar-cooperative-industrial-estate", zone: "Palghar Industrial", pincode: "401404", landmark: "Co-op Industrial Society", distance: "16.9 km", type: "industrial", sectors: "Small Scale Manufacturing & Jobwork" },
  { name: "Manor NH-48 Logistics Hub", slug: "manor-nh-48-logistics-hub", zone: "Palghar District", pincode: "401403", landmark: "Mumbai-Ahmedabad Highway Corridor", distance: "22.0 km", type: "logistics", sectors: "Warehouses, 3PL, Transport & Cold Storage" },
  { name: "Wada Industrial Belt", slug: "wada-industrial-belt", zone: "Palghar District", pincode: "421303", landmark: "Kudus-Wada Industrial Corridor", distance: "45.0 km", type: "industrial", sectors: "Heavy Steel, Cement Products & Large Manufacturing" },
];

// 6 Core high-intent service focuses
const SERVICES = [
  {
    id: "chartered-accountant",
    prefix: "Chartered Accountant in",
    titlePrefix: "Best CA & Chartered Accountant in",
    metaService: "Chartered Accountant & Corporate Tax Consultant",
    focusHeading: "Chartered Accountancy & Business Advisory",
    features: [
      { title: "Statutory & Tax Compliance", desc: "Complete adherence to Income Tax, GST, MCA and statutory regulatory standards." },
      { title: "Audit & Assurance", desc: "Forensic audits, internal controls, stock audits and statutory audits for Boisar enterprises." },
      { title: "Strategic Tax Planning", desc: "Legitimate tax optimization, capital gains advisory, and business structure planning." },
      { title: "Direct Partner Supervision", desc: "FCA Kiran Kashinath Shinde personally oversees compliance and client representation." }
    ]
  },
  {
    id: "gst-consultant",
    prefix: "GST Consultant & Return Filing in",
    titlePrefix: "Top GST Consultant & Registration in",
    metaService: "GST Registration, Monthly GSTR-1, 3B & 2B ITC Reconciliation",
    focusHeading: "Goods & Services Tax (GST) Advisory",
    features: [
      { title: "GSTR-1 & GSTR-3B Filing", desc: "Zero-error monthly and quarterly GST return filing with automated validation." },
      { title: "GSTR-2B ITC Matching", desc: "Aggressive ITC reconciliation to ensure 100% genuine input tax credit without reversals." },
      { title: "GST Audit & Annual Returns", desc: "Comprehensive GSTR-9 and 9C reconciliation and audit for manufacturing and trading firms." },
      { title: "Department Notice Defense", desc: "Expert response preparation, scrutiny notice attendance and appeal representation." }
    ]
  },
  {
    id: "income-tax-filing",
    prefix: "Income Tax Return (ITR) Filing in",
    titlePrefix: "ITR Filing & Income Tax Consultant in",
    metaService: "Income Tax Return (ITR-1 to ITR-7), Capital Gains & Tax Planning",
    focusHeading: "Direct Tax & Personal / Corporate ITR",
    features: [
      { title: "Salaried & Corporate ITR", desc: "Accurate filing under Old and New tax regimes with maximum legitimate deductions." },
      { title: "Capital Gains Calculation", desc: "Precise tax computing for property sales, shares, mutual funds and indexation benefits." },
      { title: "Advance Tax & TDS Computation", desc: "Timely quarterly advance tax calculations under Section 208–211 to avoid interest penalties." },
      { title: "Defective Return & Scrutiny Help", desc: "Quick rectification under Section 139(9), 143(1) intimation handling and Section 148 appeals." }
    ]
  },
  {
    id: "statutory-audit",
    prefix: "Statutory Audit & Tax Audit in",
    titlePrefix: "Tax Audit (Sec 44AB) & Company Audit in",
    metaService: "Statutory Audit, Tax Audit Sec 44AB, Internal & DISA Systems Audit",
    focusHeading: "Corporate Audit & Assurance Practice",
    features: [
      { title: "Tax Audit under Sec 44AB", desc: "Thorough tax audits for manufacturers, contractors and traders exceeding statutory limits." },
      { title: "Statutory Company Audits", desc: "Independent audit reports complying with Companies Act 2013 and ICAI Auditing Standards." },
      { title: "DISA Systems & Information Audit", desc: "Information security, internal controls and ERP transaction audit by DISA-qualified CA." },
      { title: "Bank Concurrent & Stock Audits", desc: "Credible third-party stock valuation and bank compliance audit reports." }
    ]
  },
  {
    id: "company-registration",
    prefix: "Company Registration & ROC Compliance in",
    titlePrefix: "Private Limited & LLP Registration in",
    metaService: "Company Incorporation, LLP, Partnership Firm & MSME Udyam",
    focusHeading: "Corporate Secretarial & Startup Setup",
    features: [
      { title: "Pvt Ltd & LLP Incorporation", desc: "End-to-end setup: Name approval, MOA/AOA drafting, DIN, DSC, PAN, TAN & Bank A/C." },
      { title: "Partnership & Gumasta Setup", desc: "Drafting partnership deeds, Registrar of Firms (ROF) registration and Gumasta licenses." },
      { title: "MSME Udyam & Startup India", desc: "Priority government registrations, subsidy eligibility certificates and vendor registration." },
      { title: "Annual ROC Filings", desc: "AOC-4, MGT-7, DIR-3 KYC and corporate governance compliance." }
    ]
  },
  {
    id: "factory-accounting",
    prefix: "MIDC Factory Compliance & Accounting in",
    titlePrefix: "Factory Accounting, Payroll & TDS in",
    metaService: "Factory Accounting, TDS Returns, Payroll Management & MIDC Compliance",
    focusHeading: "Industrial Accounting & Operational Compliance",
    features: [
      { title: "Complete Books of Accounts", desc: "Tally Prime, ERP9 and custom ERP bookkeeping with accurate ledger maintenance." },
      { title: "TDS / TCS Compliance", desc: "Monthly deduction calculations, challan payment and quarterly 24Q & 26Q return filing." },
      { title: "Industrial Payroll & Compliance", desc: "Salary register structuring, professional tax (PT), PF/ESIC deduction reconciliation." },
      { title: "MIDC & Tarapur Industrial Liaison", desc: "Financial certification for bank CMA data, MIDC lease transfers and subsidies." }
    ]
  }
];

const SITE_URL = "https://cakiran.co.in";
const OUT_DIR = path.join(__dirname, "..", "locations");

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

console.log(`Generating pages for ${LOCATIONS.length} locations across 6 services...`);
console.log(`Total target pages: ${LOCATIONS.length * SERVICES.length}`);

const sitemapUrls = [
  { loc: `${SITE_URL}/`, priority: "1.0", changefreq: "daily" },
  { loc: `${SITE_URL}/services.html`, priority: "0.9", changefreq: "weekly" },
  { loc: `${SITE_URL}/team.html`, priority: "0.8", changefreq: "monthly" },
  { loc: `${SITE_URL}/tax-updates.html`, priority: "0.8", changefreq: "weekly" },
  { loc: `${SITE_URL}/calculators.html`, priority: "0.8", changefreq: "monthly" },
  { loc: `${SITE_URL}/locations/index.html`, priority: "0.9", changefreq: "daily" }
];

let generatedCount = 0;
const directoryEntries = [];

// Helper to escape HTML
function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

for (const loc of LOCATIONS) {
  for (const srv of SERVICES) {
    const filename = `${srv.id}-in-${loc.slug}.html`;
    const fullUrl = `${SITE_URL}/locations/${filename}`;
    const pageTitle = `${srv.titlePrefix} ${loc.name}, Boisar | Kiran K. Shinde & Co.`;
    const metaDescription = `Looking for ${srv.metaService} in ${loc.name}, Boisar / Palghar? Kiran K. Shinde & Co. (CA Kiran Shinde, FCA • Est. 2009) offers expert tax, GST, audit & corporate services. Just ${loc.distance} from office at Khaira Boisar. Call +91 97628 76099.`;
    const canonicalUrl = fullUrl;

    const waText = encodeURIComponent(`Hello CA Kiran Shinde, I am contacting you from ${loc.name} regarding ${srv.prefix} services.`);

    // Pick 3 related locations in the same zone or neighboring zones for internal linking
    const relatedLocs = LOCATIONS.filter(l => l.slug !== loc.slug && (l.zone === loc.zone || Math.random() > 0.6)).slice(0, 4);

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(pageTitle)}</title>
  <meta name="description" content="${esc(metaDescription)}">
  <link rel="canonical" href="${canonicalUrl}">
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
  
  <!-- Open Graph / Social -->
  <meta property="og:type" content="business.business">
  <meta property="og:title" content="${esc(pageTitle)}">
  <meta property="og:description" content="${esc(metaDescription)}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:site_name" content="Kiran K. Shinde &amp; Co., Chartered Accountants">
  
  <!-- Favicon & Styles -->
  <link rel="stylesheet" href="../style.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  
  <!-- Structured Data (JSON-LD) Local Business Schema -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "AccountingService",
    "name": "Kiran K. Shinde & Co. - ${esc(srv.prefix)} ${esc(loc.name)}",
    "image": "https://res.cloudinary.com/odxcrtwm/image/upload/f_auto,q_auto/v1794057691/zgj8pyzygicv7dgsaipv.png",
    "@id": "${canonicalUrl}",
    "url": "${canonicalUrl}",
    "telephone": "+919762876099",
    "email": "info@cakiran.co.in",
    "priceRange": "₹₹",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Opp. Railway Station, Khaira",
      "addressLocality": "Boisar, Palghar",
      "addressRegion": "Maharashtra",
      "postalCode": "401501",
      "addressCountry": "IN"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 19.8036,
      "longitude": 72.7548
    },
    "founder": {
      "@type": "Person",
      "name": "CA Kiran Kashinath Shinde",
      "jobTitle": "Fellow Chartered Accountant (FCA, DISA, FAFP)"
    },
    "areaServed": [
      {
        "@type": "Place",
        "name": "${esc(loc.name)}"
      },
      {
        "@type": "AdministrativeArea",
        "name": "Boisar"
      },
      {
        "@type": "AdministrativeArea",
        "name": "Palghar District"
      }
    ],
    "description": "${esc(metaDescription)}"
  }
  </script>

  <style>
    .loc-hero {
      background: linear-gradient(135deg, #0e1e33 0%, #173256 100%);
      color: #fff;
      padding: 60px 20px 48px;
      text-align: center;
      position: relative;
    }
    .loc-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(210, 161, 40, 0.16);
      border: 1px solid #d2a128;
      color: #f7d583;
      padding: 6px 16px;
      border-radius: 999px;
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-bottom: 18px;
      text-transform: uppercase;
    }
    .loc-title {
      font-family: Georgia, serif;
      font-size: clamp(1.85rem, 5vw, 3.2rem);
      color: #ffffff;
      margin: 0 auto 16px;
      max-width: 950px;
      line-height: 1.18;
    }
    .loc-title span {
      color: #e5b94c;
    }
    .loc-subtitle {
      font-size: 1.05rem;
      color: #c7d5e6;
      max-width: 820px;
      margin: 0 auto 28px;
      line-height: 1.6;
    }
    .loc-cta-group {
      display: flex;
      justify-content: center;
      gap: 14px;
      flex-wrap: wrap;
    }
    .loc-card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 20px;
      margin: 40px 0;
    }
    .loc-feature-card {
      background: #ffffff;
      border: 1px solid #e1e8f2;
      border-radius: 14px;
      padding: 24px;
      box-shadow: 0 8px 24px rgba(16, 36, 59, 0.05);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .loc-feature-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 12px 30px rgba(16, 36, 59, 0.1);
    }
    .loc-feature-icon {
      width: 48px;
      height: 48px;
      background: #fbf5e6;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #bd8a18;
      font-size: 1.3rem;
      margin-bottom: 16px;
    }
    .loc-feature-card h3 {
      font-size: 1.12rem;
      color: #10243b;
      margin: 0 0 8px;
    }
    .loc-feature-card p {
      color: #5e718d;
      font-size: 0.92rem;
      line-height: 1.5;
      margin: 0;
    }
    .loc-info-strip {
      background: #f8fafc;
      border: 1px solid #dce5f0;
      border-radius: 14px;
      padding: 24px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin: 30px 0;
    }
    .loc-info-item strong {
      display: block;
      color: #10243b;
      font-size: 0.88rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .loc-info-item span {
      color: #53647b;
      font-size: 0.98rem;
      font-weight: 600;
    }
    .loc-breadcrumbs {
      padding: 14px 20px;
      background: #edf3f9;
      font-size: 0.85rem;
      color: #586b84;
    }
    .loc-breadcrumbs a {
      color: #10243b;
      text-decoration: none;
      font-weight: 600;
    }
    .loc-internal-links {
      margin-top: 50px;
      padding-top: 35px;
      border-top: 1px solid #e1e8f2;
    }
    .loc-internal-links h4 {
      color: #10243b;
      font-size: 1.15rem;
      margin-bottom: 16px;
    }
    .loc-link-pill-group {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .loc-link-pill {
      display: inline-block;
      background: #ffffff;
      border: 1px solid #d2dbe5;
      border-radius: 999px;
      padding: 8px 16px;
      color: #153255;
      font-size: 0.85rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.15s ease;
    }
    .loc-link-pill:hover {
      background: #10243b;
      color: #ffffff;
      border-color: #10243b;
    }
  </style>
</head>
<body>

  <!-- Navigation Bar -->
  <header class="navbar" id="mainNavbar">
    <div class="container navbar-container">
      <a href="../index.html" class="brand-link">
        <img class="brand-logo-image ca-india-logo-image" src="https://res.cloudinary.com/odxcrtwm/image/upload/f_auto,q_auto/v1794057691/zgj8pyzygicv7dgsaipv.png" alt="Institute of Chartered Accountants of India">
        <div class="brand-text">
          <h2 class="classic-brand-title">Kiran K. Shinde and Co.</h2>
          <span class="classic-brand-sub">Chartered Accountants • 2009</span>
        </div>
      </a>
      <nav class="nav-menu" id="navMenu">
        <a href="../index.html#home" class="nav-item">Home</a>
        <a href="../index.html#about" class="nav-item">About Us</a>
        <a href="../team.html" class="nav-item">Our Team</a>
        <a href="../services.html" class="nav-item">Services</a>
        <a href="../tax-updates.html" class="nav-item">Notifications</a>
        <a href="index.html" class="nav-item">All Locations</a>
        <a href="../index.html#contact" class="nav-item">Contact</a>
        <div class="magnetic-btn">
          <a href="../index.html#appointment" class="btn btn-primary btn-shimmer nav-cta-btn">Book Consultation</a>
        </div>
      </nav>
    </div>
  </header>

  <!-- Breadcrumb Navigation -->
  <div class="loc-breadcrumbs">
    <div class="container">
      <a href="../index.html">Home</a> &gt; 
      <a href="index.html">Locations</a> &gt; 
      <span>${esc(loc.zone)}</span> &gt; 
      <strong>${esc(srv.prefix)} ${esc(loc.name)}</strong>
    </div>
  </div>

  <!-- Hero Section -->
  <section class="loc-hero">
    <div class="container">
      <div class="loc-badge">
        <i class="fa-solid fa-map-pin"></i> ${esc(loc.name)} • ${esc(loc.zone)}
      </div>
      <h1 class="loc-title">
        ${esc(srv.prefix)} <span>${esc(loc.name)}</span>
      </h1>
      <p class="loc-subtitle">
        Trusted Chartered Accountancy practice established November 2009 by CA Kiran Kashinath Shinde (FCA, DISA, FAFP). Providing reliable ${esc(srv.focusHeading.toLowerCase())}, GST, audits, and business compliance for enterprises and taxpayers in ${esc(loc.name)} (${esc(loc.distance)} from Boisar Station office).
      </p>
      <div class="loc-cta-group">
        <a href="https://wa.me/919762876099?text=${waText}" target="_blank" rel="noopener" class="btn btn-whatsapp" style="display:inline-flex;align-items:center;gap:8px;">
          <i class="fa-brands fa-whatsapp"></i> WhatsApp Consultation
        </a>
        <a href="tel:+919762876099" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:8px;">
          <i class="fa-solid fa-phone"></i> Call +91 97628 76099
        </a>
      </div>
    </div>
  </section>

  <!-- Main Content Body -->
  <main class="container" style="padding-top: 40px; padding-bottom: 60px;">
    
    <!-- Local Location Specifics -->
    <div class="loc-info-strip">
      <div class="loc-info-item">
        <strong>Target Area</strong>
        <span>${esc(loc.name)}</span>
      </div>
      <div class="loc-info-item">
        <strong>Zone / Region</strong>
        <span>${esc(loc.zone)}</span>
      </div>
      <div class="loc-info-item">
        <strong>Nearest Landmark</strong>
        <span>${esc(loc.landmark)}</span>
      </div>
      <div class="loc-info-item">
        <strong>Distance to Office</strong>
        <span>${esc(loc.distance)}</span>
      </div>
      <div class="loc-info-item">
        <strong>Head Office</strong>
        <span>Opp. Boisar Rly Station, Khaira</span>
      </div>
    </div>

    <!-- Core Specializations -->
    <h2 style="font-family: Georgia, serif; color: #10243b; font-size: 1.85rem; margin-top: 35px; margin-bottom: 10px;">
      Professional ${esc(srv.focusHeading)} in ${esc(loc.name)}
    </h2>
    <p style="color: #55677e; font-size: 1.02rem; line-height: 1.6; max-width: 880px;">
      Whether your enterprise operates in ${esc(loc.sectors || 'trade, manufacturing, or service')}, our firm provides dedicated regulatory assistance tailored to your business needs in ${esc(loc.name)}. We ensure 100% adherence to ICAI guidelines, direct tax provisions, and GST regulations.
    </p>

    <!-- 4 Specialized Features -->
    <div class="loc-card-grid">
      ${srv.features.map(f => `
      <div class="loc-feature-card">
        <div class="loc-feature-icon"><i class="fa-solid fa-check-double"></i></div>
        <h3>${esc(f.title)}</h3>
        <p>${esc(f.desc)}</p>
      </div>`).join('')}
    </div>

    <!-- Why Choose Section -->
    <section style="background: #ffffff; border: 1px solid #e1e8f2; border-radius: 16px; padding: 34px; margin-top: 30px;">
      <h3 style="font-family: Georgia, serif; color: #10243b; font-size: 1.5rem; margin-top: 0; margin-bottom: 12px;">
        Why Choose Kiran K. Shinde &amp; Co. in ${esc(loc.name)}?
      </h3>
      <ul style="color: #4b5d73; line-height: 1.8; font-size: 0.98rem; padding-left: 20px; margin-bottom: 22px;">
        <li><strong>15+ Years of Practice:</strong> Established in November 2009 with deep roots in Boisar, Tarapur MIDC, and Palghar.</li>
        <li><strong>FCA Qualified Leadership:</strong> Headed by CA Kiran Kashinath Shinde (Fellow Chartered Accountant, DISA Systems Auditor, Forensic Accounting Specialist).</li>
        <li><strong>Local Presence:</strong> Located right at Khaira, opposite Boisar Railway Station — easily accessible for client reviews and document verification.</li>
        <li><strong>Comprehensive Corporate Support:</strong> Handling complex statutory audits, GSTR-2B ITC matching, advance tax planning, and MIDC liaison.</li>
      </ul>
      <div style="background: #fbf5e6; border-left: 4px solid #bd8a18; padding: 14px 18px; border-radius: 0 8px 8px 0; color: #695219; font-size: 0.92rem;">
        <strong>ICAI Compliance Note:</strong> In accordance with the Institute of Chartered Accountants of India directives, this page serves strictly informational purposes regarding our practice areas in ${esc(loc.name)} and does not constitute solicitation.
      </div>
    </section>

    <!-- Internal Linking Cross-Pollination -->
    <div class="loc-internal-links">
      <h4>Other Services Available in ${esc(loc.name)}</h4>
      <div class="loc-link-pill-group">
        ${SERVICES.filter(s => s.id !== srv.id).map(s => `
          <a class="loc-link-pill" href="${s.id}-in-${loc.slug}.html">${esc(s.prefix)} ${esc(loc.name)}</a>
        `).join('')}
      </div>

      <h4 style="margin-top: 26px;">Nearby Locations in ${esc(loc.zone)}</h4>
      <div class="loc-link-pill-group">
        ${relatedLocs.map(rel => `
          <a class="loc-link-pill" href="${srv.id}-in-${rel.slug}.html">${esc(srv.prefix)} ${esc(rel.name)}</a>
        `).join('')}
        <a class="loc-link-pill" href="index.html" style="background:#10243b;color:#fff;">View All 185 Locations &rarr;</a>
      </div>
    </div>

  </main>

  <!-- Footer -->
  <footer class="footer" style="background:#0c1929;color:#94a3b8;padding:40px 20px 20px;">
    <div class="container" style="text-align:center;">
      <h3 style="color:#ffffff;margin-bottom:8px;">Kiran K. Shinde &amp; Co.</h3>
      <p style="font-size:0.92rem;color:#cbd5e1;max-width:700px;margin:0 auto 16px;">
        Chartered Accountants • Headquartered Opp. Railway Station, Khaira, Boisar, Palghar - 401501.<br>
        Serving ${esc(loc.name)}, Tarapur MIDC, Palghar &amp; Maharashtra since 2009.
      </p>
      <p style="font-size:0.85rem;color:#64748b;margin:0;">
        &copy; 2026 Kiran K. Shinde &amp; Co. All Rights Reserved.
      </p>
    </div>
  </footer>

</body>
</html>`;

    fs.writeFileSync(path.join(OUT_DIR, filename), html, 'utf8');
    sitemapUrls.push({
      loc: fullUrl,
      priority: loc.zone.includes("Tarapur") ? "0.85" : "0.75",
      changefreq: "weekly"
    });
    generatedCount++;
  }

  directoryEntries.push({
    name: loc.name,
    slug: loc.slug,
    zone: loc.zone,
    pincode: loc.pincode,
    distance: loc.distance
  });
}

// Generate the Master Locations Directory Page (locations/index.html)
const zones = [...new Set(LOCATIONS.map(l => l.zone))];
const directoryHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Locations Directory - Boisar, Tarapur MIDC & Palghar | Kiran K. Shinde & Co.</title>
  <meta name="description" content="Explore Chartered Accountancy, GST, ITR, Audit & Company Registration services across all 185+ micro-localities, industrial zones and townships of Boisar, Tarapur MIDC and Palghar.">
  <link rel="canonical" href="${SITE_URL}/locations/index.html">
  <link rel="stylesheet" href="../style.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>
    .dir-hero {
      background: linear-gradient(135deg, #0e1e33 0%, #173256 100%);
      color: #fff;
      padding: 60px 20px 40px;
      text-align: center;
    }
    .dir-zone {
      margin: 45px 0 25px;
      padding-bottom: 12px;
      border-bottom: 2px solid #d2a128;
      color: #10243b;
      font-family: Georgia, serif;
      font-size: 1.6rem;
    }
    .dir-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }
    .dir-card {
      background: #ffffff;
      border: 1px solid #e1e8f2;
      border-radius: 12px;
      padding: 18px;
      box-shadow: 0 4px 12px rgba(16, 36, 59, 0.04);
      transition: all 0.15s ease;
    }
    .dir-card:hover {
      border-color: #d2a128;
      box-shadow: 0 8px 20px rgba(16, 36, 59, 0.09);
      transform: translateY(-2px);
    }
    .dir-card h3 {
      font-size: 1.05rem;
      color: #10243b;
      margin: 0 0 6px;
    }
    .dir-card .dir-meta {
      font-size: 0.82rem;
      color: #64748b;
      margin-bottom: 12px;
    }
    .dir-links {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .dir-links a {
      color: #087fbd;
      font-size: 0.84rem;
      font-weight: 600;
      text-decoration: none;
    }
    .dir-links a:hover {
      text-decoration: underline;
    }
    .dir-search {
      max-width: 500px;
      margin: 20px auto 0;
    }
    .dir-search input {
      width: 100%;
      padding: 12px 18px;
      border-radius: 999px;
      border: 1px solid #cbd5e1;
      font-size: 1rem;
      box-sizing: border-box;
    }
  </style>
</head>
<body>
  <header class="navbar" id="mainNavbar">
    <div class="container navbar-container">
      <a href="../index.html" class="brand-link">
        <img class="brand-logo-image ca-india-logo-image" src="https://res.cloudinary.com/odxcrtwm/image/upload/f_auto,q_auto/v1794057691/zgj8pyzygicv7dgsaipv.png" alt="Institute of Chartered Accountants of India">
        <div class="brand-text">
          <h2 class="classic-brand-title">Kiran K. Shinde and Co.</h2>
          <span class="classic-brand-sub">Chartered Accountants • 2009</span>
        </div>
      </a>
      <nav class="nav-menu" id="navMenu">
        <a href="../index.html#home" class="nav-item">Home</a>
        <a href="../index.html#about" class="nav-item">About Us</a>
        <a href="../team.html" class="nav-item">Our Team</a>
        <a href="../services.html" class="nav-item">Services</a>
        <a href="../tax-updates.html" class="nav-item">Notifications</a>
        <a href="../index.html#contact" class="nav-item">Contact</a>
        <div class="magnetic-btn">
          <a href="../index.html#appointment" class="btn btn-primary btn-shimmer nav-cta-btn">Book Consultation</a>
        </div>
      </nav>
    </div>
  </header>

  <section class="dir-hero">
    <div class="container">
      <div style="color:#e5b94c;font-weight:800;letter-spacing:1px;text-transform:uppercase;font-size:0.85rem;margin-bottom:10px;">
        Local Search Coverage • Boisar &amp; Palghar District
      </div>
      <h1 style="font-family: Georgia, serif; font-size: clamp(2rem, 5vw, 3.2rem); margin: 0 0 12px;">
        Chartered Accountant Directory Across 185+ Locations
      </h1>
      <p style="color:#cbd5e1;max-width:750px;margin:0 auto;font-size:1.05rem;">
        Find dedicated CA, GST, ITR, Company Audit and Factory Compliance landing pages for every sector of Tarapur MIDC, Boisar Town, Townships, Coastal Belts and Palghar.
      </p>
      <div class="dir-search">
        <input type="text" id="searchInput" placeholder="Search area (e.g. Tarapur MIDC, Ostwal, Khaira, Palghar)..." onkeyup="filterDirectory()">
      </div>
    </div>
  </section>

  <main class="container" style="padding-bottom: 70px;">
    ${zones.map(z => {
      const zLocs = LOCATIONS.filter(l => l.zone === z);
      return `
        <h2 class="dir-zone">${esc(z)} (${zLocs.length} Localities)</h2>
        <div class="dir-grid">
          ${zLocs.map(l => `
            <div class="dir-card" data-name="${esc(l.name.toLowerCase())}">
              <h3>${esc(l.name)}</h3>
              <div class="dir-meta">
                <i class="fa-solid fa-location-dot" style="color:#bd8a18;"></i> ${esc(l.distance)} from Boisar Station • PIN ${esc(l.pincode)}
              </div>
              <div class="dir-links">
                <a href="chartered-accountant-in-${l.slug}.html">&bull; Chartered Accountant in ${esc(l.name)}</a>
                <a href="gst-consultant-in-${l.slug}.html">&bull; GST Consultant in ${esc(l.name)}</a>
                <a href="income-tax-filing-in-${l.slug}.html">&bull; ITR Filing in ${esc(l.name)}</a>
                <a href="statutory-audit-in-${l.slug}.html">&bull; Statutory &amp; Tax Audit in ${esc(l.name)}</a>
                <a href="factory-accounting-in-${l.slug}.html">&bull; Factory &amp; Accounting in ${esc(l.name)}</a>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }).join('')}
  </main>

  <footer class="footer" style="background:#0c1929;color:#94a3b8;padding:40px 20px 20px;">
    <div class="container" style="text-align:center;">
      <h3 style="color:#ffffff;margin-bottom:8px;">Kiran K. Shinde &amp; Co.</h3>
      <p style="font-size:0.92rem;color:#cbd5e1;max-width:700px;margin:0 auto 16px;">
        Chartered Accountants • Headquartered Opp. Railway Station, Khaira, Boisar, Palghar - 401501.
      </p>
      <p style="font-size:0.85rem;color:#64748b;margin:0;">
        &copy; 2026 Kiran K. Shinde &amp; Co. All Rights Reserved.
      </p>
    </div>
  </footer>

  <script>
    function filterDirectory() {
      const term = document.getElementById('searchInput').value.toLowerCase().trim();
      document.querySelectorAll('.dir-card').forEach(card => {
        const name = card.dataset.name;
        if (!term || name.includes(term)) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    }
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(OUT_DIR, "index.html"), directoryHtml, 'utf8');

// Generate sitemap.xml
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>2026-11-09</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

fs.writeFileSync(path.join(__dirname, "..", "sitemap.xml"), sitemapXml, 'utf8');

// Generate robots.txt
const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;

fs.writeFileSync(path.join(__dirname, "..", "robots.txt"), robotsTxt, 'utf8');

console.log(`\nSUCCESS: Generated ${generatedCount} programmatic location pages!`);
console.log(`Generated Locations Directory: ${path.join(OUT_DIR, "index.html")}`);
console.log(`Generated sitemap.xml with ${sitemapUrls.length} total URLs!`);
console.log(`Generated robots.txt pointing to ${SITE_URL}/sitemap.xml!`);
