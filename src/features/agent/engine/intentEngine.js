import { extractEntities } from "./entityExtractor";

const INTENT_RULES = [
  {
    intent: "putaway",
    patterns: [
      /where\s+(should|can|do)\s+I\s+put/i,
      /best\s+bin\s+for/i,
      /put\s*away/i,
      /inbound.*(?:material|bin)/i,
      /receiving.*(?:material|where)/i,
    ],
  },
  {
    intent: "binInfo",
    patterns: [
      /what(?:'s| is)\s+in\s+(?:bin\s+)?[A-J]/i,
      /what(?:'s| is)\s+in\s+(?:bin\s+)?(?:HH|II)/i,
      /bin\s+info/i,
      /show\s+(?:me\s+)?bin\s+/i,
      /tell\s+(?:me\s+)?about\s+(?:bin\s+)?[A-J]/i,
      /tell\s+(?:me\s+)?about\s+(?:bin\s+)?(?:HH|II)/i,
    ],
  },
  {
    intent: "capacityQuery",
    patterns: [
      /how\s+much\s+(?:space|room|capacity|free)/i,
      /free\s+(?:space|capacity)/i,
      /available\s+(?:space|capacity)/i,
      /capacity\s+(?:in|of|for)\s+(?:row)?/i,
    ],
  },
  {
    intent: "materialLookup",
    patterns: [
      /where\s+is\s+(?:material\s+)?\d/i,
      /find\s+(?:material\s+)?\d/i,
      /locate\s+(?:material\s+)?\d/i,
      /which\s+bin(?:s)?\s+(?:has|have|contain)/i,
      /search\s+(?:for\s+)?(?:material\s+)?\d/i,
    ],
  },
  {
    intent: "ruleExplanation",
    patterns: [
      /why\s+can(?:'t| not|not)/i,
      /explain\s+(?:the\s+)?rule/i,
      /what(?:'s| is)\s+the\s+(?:rule|reason)/i,
      /(?:no.?mix|no.?target|segregat|r.?bin)\s*rule/i,
      /why\s+(?:is|are|was|were)\s+.*(?:block|restrict|prevent|not\s+allow)/i,
    ],
  },
  {
    intent: "tunnelPair",
    patterns: [
      /tunnel\s+(?:capacity|pair|info)/i,
      /pair(?:ed)?\s+(?:tunnel|row|capacity)/i,
      /shared\s+tunnel/i,
      /\b[A-J]\s*[-\/]\s*(?:HH|II|[A-J])\s+(?:tunnel|pair|capacity)/i,
    ],
  },
  {
    intent: "rowInfo",
    patterns: [
      /show\s+(?:me\s+)?row\s+/i,
      /row\s+[A-J]\s+(?:stats|info|status|summary|details)/i,
      /(?:stats|info|status|summary)\s+(?:for|of)\s+row/i,
    ],
  },
  {
    intent: "sideBin",
    patterns: [
      /side\s+bin/i,
      /which\s+(?:bins?\s+)?(?:are\s+)?side/i,
    ],
  },
  {
    intent: "warehouseScope",
    patterns: [
      /(?:what|which)\s+bins?\s+(?:are\s+)?in\s+WH/i,
      /(?:what|which)\s+bins?\s+(?:are\s+)?in\s+warehouse/i,
      /WH\d\s+bins/i,
      /warehouse\s+\d\s+(?:bins|scope|info)/i,
    ],
  },
  {
    intent: "moveExplanation",
    patterns: [
      /why\s+(?:was|is)\s+(?:this|that)\s+move/i,
      /(?:explain|describe)\s+(?:this|that|the)\s+move/i,
      /move\s+(?:explanation|reason|score)/i,
      /why\s+(?:move|suggest)/i,
    ],
  },
  {
    intent: "help",
    patterns: [
      /^help$/i,
      /^hi$/i,
      /^hello$/i,
      /^hey$/i,
      /what\s+can\s+you\s+do/i,
      /how\s+(?:do\s+I|can\s+I)\s+use/i,
    ],
  },
];

export function classifyIntent(rawInput) {
  const input = String(rawInput || "").trim();
  if (!input) return { intent: "help", entities: extractEntities(""), rawInput: input };

  const entities = extractEntities(input);

  for (const rule of INTENT_RULES) {
    for (const pat of rule.patterns) {
      if (pat.test(input)) {
        return { intent: rule.intent, entities, rawInput: input };
      }
    }
  }

  // Fallback heuristics
  const trimmed = input.replace(/[?.!]/g, "").trim();
  if (entities.bins.length > 0 && trimmed.length <= 6) {
    return { intent: "binInfo", entities, rawInput: input };
  }
  if (/^\d{5,18}$/.test(trimmed)) {
    return { intent: "materialLookup", entities, rawInput: input };
  }
  if (entities.rows.length > 0 && trimmed.length <= 8) {
    return { intent: "rowInfo", entities, rawInput: input };
  }

  return { intent: "help", entities, rawInput: input };
}
