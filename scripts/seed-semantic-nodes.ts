import { db } from "../src/server/db.ts";

type SeedNode = {
  id: string;
  label: string;
  type: string;
  tags: string[];
  description: string;
  x: number;
  y: number;
  size: number;
  color: string;
  hot: number;
};

const TYPE_META: Record<string, { color: string; center: [number, number] }> = {
  Person: { color: "#4cc9f0", center: [-220, 140] },
  Organization: { color: "#f59e0b", center: [140, 120] },
  Equipment: { color: "#ef4444", center: [220, -40] },
  Location: { color: "#22c55e", center: [-40, -180] },
  Event: { color: "#a855f7", center: [10, 10] },
  Document: { color: "#f472b6", center: [-180, -40] },
  Technology: { color: "#818cf8", center: [180, 210] },
};

const TYPE_DEFINITIONS: Array<{
  type: keyof typeof TYPE_META;
  prefix: string;
  labels: string[];
  tags: string[][];
  descriptions: string[];
}> = [
  {
    type: "Person",
    prefix: "person",
    labels: [
      "Lin Zhou",
      "Shen Yao",
      "Gu Xing",
      "Xu Lan",
      "He An",
      "Luo Qian",
      "Pei Zhi",
    ],
    tags: [
      ["command", "coordination"],
      ["analysis", "research"],
      ["field", "support"],
      ["archive", "editor"],
      ["engineering", "platform"],
      ["intelligence", "fusion"],
      ["training", "knowledge-base"],
    ],
    descriptions: [
      "Regional coordination lead for cross-team operations.",
      "Senior analyst focused on complex pattern recognition.",
      "Field support officer for equipment deployment tasks.",
      "Documentation specialist maintaining node archives.",
      "Platform engineer responsible for map and coordinate services.",
      "Intelligence fusion operator for multi-source signals.",
      "Training coordinator for new knowledge workflows.",
    ],
  },
  {
    type: "Organization",
    prefix: "org",
    labels: [
      "North Frontier Lab",
      "Sea Data Center",
      "Sunrise Coordination Net",
      "Redstone Validation Lab",
      "Clear Archive Hall",
      "Longwatch Telecom Bureau",
      "Cloudbridge Liaison Desk",
    ],
    tags: [
      ["research", "security"],
      ["data", "operations"],
      ["coordination", "dispatch"],
      ["validation", "testing"],
      ["archives", "reference"],
      ["network", "communication"],
      ["liaison", "edge"],
    ],
    descriptions: [
      "Research unit focused on frontier security scenarios.",
      "Central store for multimodal knowledge data.",
      "Coordination network for cross-organization operations.",
      "Validation center for prototype and stress testing.",
      "Archive institution for event and source documents.",
      "Bureau in charge of resilient communication links.",
      "Edge-facing coordination office for remote access.",
    ],
  },
  {
    type: "Equipment",
    prefix: "equip",
    labels: [
      "Blackbird Recon Vehicle",
      "Sky Relay Drone",
      "Frost Portable Terminal",
      "Starstone Locator Buoy",
      "Morning Compressed Battery",
      "Windstack Micro Radar",
      "Slate Secure Capsule",
    ],
    tags: [
      ["recon", "mobile"],
      ["relay", "uav"],
      ["terminal", "portable"],
      ["locator", "marine"],
      ["power", "emergency"],
      ["radar", "short-range"],
      ["storage", "security"],
    ],
    descriptions: [
      "Mobile reconnaissance platform for rapid field deployment.",
      "Temporary airborne relay for unstable communication areas.",
      "Portable terminal for offline knowledge access in the field.",
      "Marine locator buoy with long-running beacon telemetry.",
      "High-density battery pack for mobile mission continuity.",
      "Compact radar for short-range terrain monitoring.",
      "Sealed container for sensitive files and key material.",
    ],
  },
  {
    type: "Location",
    prefix: "geo",
    labels: [
      "Blue Harbor",
      "North Ridge Corridor",
      "Cloud Isle",
      "Black Sand Bay",
      "Farcrest Base",
      "Watchtide Point",
      "Maple Junction",
    ],
    tags: [
      ["harbor", "logistics"],
      ["corridor", "mountain"],
      ["island", "outpost"],
      ["coast", "landing"],
      ["base", "inland"],
      ["monitoring", "weather"],
      ["city", "junction"],
    ],
    descriptions: [
      "Supply harbor used for transit and loading tasks.",
      "Mountain corridor connecting the northern route network.",
      "Island outpost with forward monitoring responsibilities.",
      "Coastal landing zone for temporary staging activity.",
      "Inland support base for equipment storage and response.",
      "Observation point combining weather and site monitoring.",
      "Urban junction connecting several source organizations.",
    ],
  },
  {
    type: "Event",
    prefix: "event",
    labels: [
      "Northern Joint Exercise",
      "Offshore Comms Outage",
      "Harbor Heat Alert",
      "Border Route Congestion",
      "Mirror Recovery Drill",
      "Island Supply Sync",
      "Storm Season Rehearsal",
    ],
    tags: [
      ["exercise", "joint"],
      ["communication", "incident"],
      ["alert", "sensor"],
      ["route", "traffic"],
      ["recovery", "data"],
      ["supply", "coordination"],
      ["weather", "drill"],
    ],
    descriptions: [
      "Flagship annual joint exercise across multiple teams.",
      "A major communication outage affecting offshore links.",
      "Sensor-driven alert tied to unusual harbor heat signatures.",
      "Operational congestion detected along a key route segment.",
      "Recovery drill for replicated knowledge data mirrors.",
      "Coordinated supply event across island support points.",
      "Seasonal rehearsal for severe weather response readiness.",
    ],
  },
  {
    type: "Document",
    prefix: "doc",
    labels: [
      "Edge Deployment Manual",
      "Joint Exercise Notes",
      "Harbor Weekly Report",
      "Equipment Test Whitepaper",
      "Comms Failure Checklist",
      "Island Mission Brief",
      "Galaxy Design Notes",
    ],
    tags: [
      ["manual", "deployment"],
      ["minutes", "exercise"],
      ["report", "harbor"],
      ["whitepaper", "testing"],
      ["checklist", "incident"],
      ["brief", "mission"],
      ["design", "semantic-map"],
    ],
    descriptions: [
      "Field manual for setting up edge nodes and validation steps.",
      "Meeting notes summarizing the major exercise findings.",
      "Weekly report capturing harbor observations and anomalies.",
      "Whitepaper summarizing equipment tests and recommendations.",
      "Incident checklist for communication failure response.",
      "Mission brief shared with collaborating support teams.",
      "Design notes for the semantic map and galaxy experience.",
    ],
  },
  {
    type: "Technology",
    prefix: "tech",
    labels: [
      "Semantic Embedding Search",
      "UMAP Projection",
      "WebGL Scatter Rendering",
      "Bun SQLite Runtime",
      "Viewport Incremental Loading",
      "Offline Coordinate Pipeline",
      "Hotness Visual Encoding",
      "Spatial XY Indexing",
    ],
    tags: [
      ["embedding", "search"],
      ["umap", "projection"],
      ["deck.gl", "rendering"],
      ["bun", "sqlite"],
      ["viewport", "lazy-load"],
      ["python", "pipeline"],
      ["hot", "visual"],
      ["sqlite", "index"],
    ],
    descriptions: [
      "Embedding-based search over semantic node neighborhoods.",
      "Projecting high-dimensional vectors into a two-dimensional plane.",
      "GPU scatter rendering for large semantic maps.",
      "Lightweight application runtime backed by SQLite storage.",
      "Viewport-based incremental loading strategy for large datasets.",
      "Offline coordinate generation with embeddings and dimensionality reduction.",
      "Visual encoding based on hotness and semantic importance.",
      "XY indexing strategy for efficient viewport range queries.",
    ],
  },
];

function buildSeedData(): SeedNode[] {
  const items: SeedNode[] = [];
  TYPE_DEFINITIONS.forEach((group) => {
    const meta = TYPE_META[group.type];
    group.labels.forEach((label, index) => {
      const x = meta.center[0] + (index % 3) * 34 - 24 + Math.floor(index / 3) * 8;
      const y = meta.center[1] - Math.floor(index / 3) * 36 + (index % 2) * 18;
      items.push({
        id: `${group.prefix}_${String(index + 1).padStart(3, "0")}`,
        label,
        type: group.type,
        tags: group.tags[index] || [],
        description: group.descriptions[index] || `${label} semantic seed node.`,
        x,
        y,
        size: Math.max(4, 10 - index),
        color: meta.color,
        hot: Math.max(18, 98 - index * 9),
      });
    });
  });
  return items;
}

const seedData = buildSeedData();

const insertStmt = db.query(`
  INSERT OR REPLACE INTO semantic_nodes (
    id, label, type, tags, description, x, y, size, color, hot, created_at, updated_at
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
    COALESCE((SELECT created_at FROM semantic_nodes WHERE id = ?), CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP
  )
`);

let inserted = 0;
for (const item of seedData) {
  insertStmt.run(
    item.id,
    item.label,
    item.type,
    JSON.stringify(item.tags),
    item.description,
    item.x,
    item.y,
    item.size,
    item.color,
    item.hot,
    item.id,
  );
  inserted += 1;
}

console.log(`Seeded semantic_nodes with ${inserted} records.`);
