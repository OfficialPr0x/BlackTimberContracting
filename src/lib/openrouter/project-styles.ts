/**
 * Build-style catalog for the Draw It Out AI mockup tool.
 * Each entry maps to a prompt fragment so image models render the right structure.
 */

export type ProjectTemplate = "deck" | "fence" | "garage" | "pergola";

export interface ProjectStyle {
  id: string;
  label: string;
  short: string;
  /** Detailed visual description for image-generation prompts. */
  prompt: string;
}

export const PROJECT_STYLES: Record<ProjectTemplate, ProjectStyle[]> = {
  fence: [
    {
      id: "chainlink",
      label: "Chain Link",
      short: "Chain Link",
      prompt:
        "galvanized chain-link fence with steel terminal posts, top rail, and tight diamond mesh weave",
    },
    {
      id: "wrought-iron",
      label: "Wrought Iron",
      short: "Wrought Iron",
      prompt:
        "black powder-coated wrought iron fence with vertical pickets, decorative finials, and welded panels",
    },
    {
      id: "pressure-treated",
      label: "Pressure Treated Privacy",
      short: "PT Privacy",
      prompt:
        "pressure-treated pine privacy fence with solid board panels, 4x4 PT posts, and horizontal rails",
    },
    {
      id: "cedar",
      label: "Western Red Cedar",
      short: "Cedar",
      prompt:
        "Western red cedar privacy fence with tight vertical boards, natural warm timber tone, and cedar posts",
    },
    {
      id: "friendly-neighbor",
      label: "Friendly Neighbor",
      short: "Friendly Neighbor",
      prompt:
        "friendly-neighbor style fence with alternating board-on-board pickets — solid on one side, open gaps on the other — cedar or PT",
    },
    {
      id: "arch-top",
      label: "Arch Top",
      short: "Arch",
      prompt:
        "cedar or PT privacy fence with gracefully arched scalloped top rail between each post bay",
    },
    {
      id: "horizontal-slat",
      label: "Horizontal Slat",
      short: "Horiz. Slat",
      prompt:
        "modern horizontal cedar slat fence with even gaps between slats and clean black-stained posts",
    },
    {
      id: "board-on-board",
      label: "Board on Board",
      short: "B-on-B",
      prompt:
        "board-on-board cedar privacy fence with overlapping vertical planks for zero sight lines",
    },
    {
      id: "ranch-rail",
      label: "Ranch Rail",
      short: "Ranch Rail",
      prompt:
        "three-rail ranch-style split-rail fence in weathered cedar or PT with corner bracing",
    },
    {
      id: "ornamental-aluminum",
      label: "Ornamental Aluminum",
      short: "Alum. Ornam.",
      prompt:
        "black ornamental aluminum fence with spear-top pickets and welded gate hardware",
    },
  ],
  deck: [
    {
      id: "pressure-treated",
      label: "Pressure Treated",
      short: "PT Deck",
      prompt:
        "pressure-treated pine deck with clean fascia, sturdy 6x6 posts, and code-compliant guardrails",
    },
    {
      id: "cedar",
      label: "Western Red Cedar",
      short: "Cedar",
      prompt:
        "Western red cedar deck with tight decking boards, natural grain, and timber post caps",
    },
    {
      id: "composite",
      label: "Composite Decking",
      short: "Composite",
      prompt:
        "premium composite decking in warm ash tone with hidden fasteners and black aluminum railing",
    },
    {
      id: "multi-level",
      label: "Multi-Level",
      short: "Multi-Level",
      prompt:
        "multi-level cedar or composite deck with stepped platforms, wide stairs, and integrated lighting",
    },
    {
      id: "wrap-around",
      label: "Wrap-Around",
      short: "Wrap",
      prompt:
        "wrap-around deck hugging the house corner with mitered fascia and continuous railing",
    },
    {
      id: "ground-level",
      label: "Ground-Level Platform",
      short: "Ground",
      prompt:
        "low-profile ground-level cedar platform deck flush to grade with minimal step-up",
    },
  ],
  garage: [
    {
      id: "timber-garage",
      label: "Timber Frame Garage",
      short: "Timber Garage",
      prompt:
        "timber-frame detached garage with cedar board-and-batten siding, pitched roof, and wide overhead door",
    },
    {
      id: "modern-shed",
      label: "Modern Shed",
      short: "Modern Shed",
      prompt:
        "modern flat-roof shed with dark stained cedar cladding, black hardware, and clean lines",
    },
    {
      id: "barn-style",
      label: "Barn Style",
      short: "Barn",
      prompt:
        "classic barn-style outbuilding with gambrel roof, double doors, and rustic cedar siding",
    },
    {
      id: "carport",
      label: "Carport",
      short: "Carport",
      prompt:
        "open timber carport with heavy posts, open truss roof, and pressure-treated or cedar framing",
    },
    {
      id: "workshop-shed",
      label: "Workshop / Storage Shed",
      short: "Workshop",
      prompt:
        "workshop storage shed with side entry door, window, and durable PT or cedar siding",
    },
  ],
  pergola: [
    {
      id: "open-timber",
      label: "Open Timber Pergola",
      short: "Open Timber",
      prompt:
        "open timber pergola with 6x6 posts, doubled beams, and evenly spaced rafters — natural cedar",
    },
    {
      id: "louvered",
      label: "Louvered Pergola",
      short: "Louvered",
      prompt:
        "louvered pergola with adjustable or fixed cedar slats on top for partial shade control",
    },
    {
      id: "attached",
      label: "Attached to House",
      short: "Attached",
      prompt:
        "pergola attached to the house with ledger beam, open rafters, and posts along the outer edge",
    },
    {
      id: "freestanding-gazebo",
      label: "Freestanding Gazebo",
      short: "Gazebo",
      prompt:
        "freestanding cedar gazebo-style pergola with four corner posts and decorative knee braces",
    },
    {
      id: "covered-roof",
      label: "Covered / Solid Roof",
      short: "Covered",
      prompt:
        "pergola with solid polycarbonate or timber roof panels for rain protection over a patio",
    },
  ],
};

export function resolveStyle(
  template: ProjectTemplate,
  styleId?: string
): ProjectStyle {
  const styles = PROJECT_STYLES[template];
  if (styleId) {
    const hit = styles.find((s) => s.id === styleId);
    if (hit) return hit;
  }
  return styles[0]!;
}

export interface MockupSpec {
  template: ProjectTemplate;
  style: ProjectStyle;
  lengthFt?: number;
  widthFt?: number;
  corners?: number;
  gates?: number;
  intent?: string;
  interpretation?: string;
  detectedFeatures?: string[];
  hasSitePhoto: boolean;
  hasSketch: boolean;
}

/** Build the image-generation prompt from project specs + vision interpretation. */
export function buildMockupPrompt(spec: MockupSpec): string {
  const parts: string[] = [
    "Photorealistic architectural concept render for a residential backyard project.",
    "Professional contractor-quality build by a high-end mountain-modern timber company in British Columbia, Canada.",
    `Project type: ${spec.template}.`,
    `Style / materials: ${spec.style.prompt}.`,
  ];

  const dims: string[] = [];
  if (spec.lengthFt && spec.lengthFt > 0) dims.push(`${spec.lengthFt} ft run length`);
  if (spec.widthFt && spec.widthFt > 0) dims.push(`${spec.widthFt} ft width / depth`);
  if (spec.corners !== undefined && spec.corners > 0) {
    dims.push(`${spec.corners} corner${spec.corners === 1 ? "" : "s"} in the layout`);
  }
  if (spec.gates !== undefined && spec.gates > 0) {
    dims.push(`${spec.gates} gate${spec.gates === 1 ? "" : "s"}`);
  }
  if (dims.length) parts.push(`Approximate dimensions: ${dims.join(", ")}.`);

  if (spec.interpretation) {
    parts.push(`Layout from client sketch: ${spec.interpretation}`);
  }
  if (spec.detectedFeatures?.length) {
    parts.push(`Structural elements to include: ${spec.detectedFeatures.join(", ")}.`);
  }
  if (spec.intent) parts.push(`Client notes: ${spec.intent}`);

  if (spec.hasSitePhoto) {
    parts.push(
      "Composite the new structure realistically into the PROVIDED yard/site photo — match perspective, lighting, shadows, and scale. Preserve existing house, trees, and terrain. The build should look like it belongs on this property."
    );
  } else if (spec.hasSketch) {
    parts.push(
      "Match the geometry and layout implied by the PROVIDED client sketch overlay. Render as a finished build in a realistic BC mountain backyard setting."
    );
  } else {
    parts.push("Render in a realistic East Kootenay BC residential backyard with mountain views.");
  }

  parts.push(
    "Daylight, sharp focus, no people, no text overlays, no watermarks. Show completed construction — not construction in progress."
  );

  return parts.join(" ");
}
