// 10 Random Text-Based Murder Mystery Cases for the AI Boredom Zone

export const mysteryCases = [
  {
    id: 0,
    title: "The Case of the Poisoned Baron",
    intro: "Baron Sterling was found dead at his locked study's dining table. A half-empty teacup lies on the desk. You are the detective. Ask questions to find the culprit. (Hint: examine the teacup first)",
    keywords: ["teacup", "maid", "vial"],
    clues: [
      "The teacup contains traces of bitter almonds (cyanide). The maid prepared it, but says she left it on the kitchen counter for a few minutes. She saw someone near the pantry holding a glass vial.",
      "The maid recalls a shadow near the pantry holding a glass bottle. The suspect might have dropped something inside the pantry.",
      "Searching the pantry reveals a vial of poison with the butler's monogram. The butler is the murderer! You solved it! You can now exit the group."
    ],
    hints: [
      "Have you checked what the Baron was drinking? Try asking about the 'teacup' or what was on his desk.",
      "The maid prepared the tea. Ask about the 'maid' or check who had access to the kitchen.",
      "The maid saw someone holding a 'vial' near the pantry. Try asking about the 'vial' or search the pantry."
    ],
    answer: "butler"
  },
  {
    id: 1,
    title: "The Case of the Silent Library",
    intro: "The old librarian was found dead, crushed by a bookshelf. A rare book titled 'Redemption' is open on the desk. Inspect the book first.",
    keywords: ["book", "nephew", "diary"],
    clues: [
      "Inside the open book, a secret compartment is carved out. It is empty but smells of fresh varnish. Who had access to this book? The librarian's nephew was visiting.",
      "You confront the nephew. He acts nervous and claims he was in the garden, but a secret diary found under the desk contradicts him.",
      "The diary reveals the nephew was in deep debt. The nephew confesses he stole the gold coin from the secret compartment and pushed the shelf. Case solved! You can now exit the group."
    ],
    hints: [
      "Let's look at the desk. Try asking about the open 'book'.",
      "We found a secret compartment. Ask about the librarian's 'nephew' or who else was in the library.",
      "Is there a hidden journal? Ask about the 'diary' or look under the desk."
    ],
    answer: "nephew"
  },
  {
    id: 2,
    title: "The Case of the Broken Mirror",
    intro: "A famous actress was found dead in her dressing room. A shattered mirror lies on the floor, and a torn piece of velvet is stuck to the window frame.",
    keywords: ["velvet", "window", "director"],
    clues: [
      "The green velvet fabric belongs to a custom cape. Only the director and the lead actor have such capes.",
      "The window lock was broken from the outside. Muddy footprints lead to the director's seat.",
      "Confronting the director, he admits he was jealous of the actress's success and climbed through the window. Case solved! You can now exit the group."
    ],
    hints: [
      "There is a torn cloth piece. Ask about the 'velvet' fabric.",
      "How did the killer enter? Ask about the 'window' or look at the footprints.",
      "The footprints lead to a specific chair. Ask about the 'director' or the lead actor."
    ],
    answer: "director"
  },
  {
    id: 3,
    title: "The Case of the Phantom Clockmaker",
    intro: "The clockmaker was found dead in his clock tower, surrounded by ticking clocks. The main grandfather clock stopped exactly at 9:15 PM.",
    keywords: ["clock", "gears", "assistant"],
    clues: [
      "Opening the stopped clock reveals gold dust jammed inside the gears.",
      "The gears are coated in oil containing trace particles of steel shavings from the assistant's lathe.",
      "The assistant confesses he jammed the clock gears to cover his theft of the clockmaker's gold. Case solved! You can now exit the group."
    ],
    hints: [
      "Look at the stopped timepiece. Ask about the 'clock'.",
      "Open up the clock. Ask about the 'gears' or what is inside the mechanism.",
      "Who works in the shop? Ask about the clockmaker's 'assistant'."
    ],
    answer: "assistant"
  },
  {
    id: 4,
    title: "The Case of the Sunken Yacht",
    intro: "A billionaire drowned in his cabin on a docked yacht. A glass of wine and an open safe are nearby.",
    keywords: ["wine", "safe", "captain"],
    clues: [
      "The wine glass contains sleeping pills. The safe was looted of diamond deeds.",
      "The safe code was only known to the billionaire and his ship captain.",
      "The captain was caught at the port with the diamond deeds in his bag. Case solved! You can now exit the group."
    ],
    hints: [
      "Check what he was drinking. Ask about the 'wine' glass.",
      "Look at the empty safe. Ask about the 'safe' or what was stolen.",
      "Who steered the boat? Ask about the 'captain' or crew."
    ],
    answer: "captain"
  },
  {
    id: 5,
    title: "The Case of the Missing Painting",
    intro: "The museum curator was stabbed in the gallery. The famous 'Midnight Star' painting was cut out of its frame, leaving a bloody pocketknife behind.",
    keywords: ["pocketknife", "security", "guard"],
    clues: [
      "The pocketknife is engraved with a security logo. It belongs to the night guard.",
      "The night guard claims he lost it yesterday, but security logs show he turned off the cameras at midnight.",
      "The night guard is arrested with the stolen painting in his car trunk. Case solved! You can now exit the group."
    ],
    hints: [
      "Examine the murder weapon. Ask about the 'pocketknife'.",
      "Check the camera systems. Ask about the 'security' logs.",
      "Who was on patrol? Ask about the night 'guard'."
    ],
    answer: "guard"
  },
  {
    id: 6,
    title: "The Case of the Deadly Recipe",
    intro: "A food critic collapsed and died after eating the signature soup at a 3-star restaurant. A white powder residue was spotted on the spoon.",
    keywords: ["spoon", "soup", "chef"],
    clues: [
      "The spoon has traces of arsenic. The soup was cooked by the sous-chef under the main chef's orders.",
      "The main chef claims the recipe was secret, but he was seen arguing with the critic earlier.",
      "Arsenic was found in the chef's spice cabinet. He poisoned the critic for a bad review. Case solved! You can now exit the group."
    ],
    hints: [
      "Look at the eating utensil. Ask about the 'spoon'.",
      "Check what dish he ate. Ask about the 'soup'.",
      "Who cooked the food? Ask about the head 'chef'."
    ],
    answer: "chef"
  },
  {
    id: 7,
    title: "The Case of the Runaway Train",
    intro: "The train conductor was found dead in the engine room. The emergency brake lever was snapped off.",
    keywords: ["lever", "brake", "engineer"],
    clues: [
      "The snapped brake lever has finger grease from a heavy leather glove.",
      "Only the chief engineer wears heavy leather gloves to manage the engine boiler.",
      "The engineer admits he broke the brake lever to steal the gold cargo. Case solved! You can now exit the group."
    ],
    hints: [
      "Examine the broken parts. Ask about the snapped 'lever'.",
      "What was the lever for? Ask about the emergency 'brake'.",
      "Who operates the train machinery? Ask about the 'engineer'."
    ],
    answer: "engineer"
  },
  {
    id: 8,
    title: "The Case of the Whispering Gallery",
    intro: "A politician was shot through the chest in a gallery. No gunshot was heard, and a silver coin was placed in the politician's hand.",
    keywords: ["coin", "gun", "bodyguard"],
    clues: [
      "The silver coin belongs to a secret society. The bodyguard has a tattoo of the same coin on his arm.",
      "A silenced gun was found in the trash chute near the politician's seat.",
      "The bodyguard confesses he was hired by the politician's rival to carry out the hit. Case solved! You can now exit the group."
    ],
    hints: [
      "Look at what was in the dead politician's hand. Ask about the 'coin'.",
      "Find the murder weapon. Ask about the 'gun' or pistol.",
      "Who was protecting him? Ask about his 'bodyguard'."
    ],
    answer: "bodyguard"
  },
  {
    id: 9,
    title: "The Case of the Frozen Alibi",
    intro: "A wealthy jeweler was found frozen in his industrial ice vault. The door was locked from the outside.",
    keywords: ["vault", "lock", "partner"],
    clues: [
      "The vault security logs show the door was locked manually using the partner's keycard.",
      "The partner claims he was at a restaurant, but his keycard was scanned at the vault door at 8:00 PM.",
      "Surveillance video confirms the partner locked the door on the jeweler. Case solved! You can now exit the group."
    ],
    hints: [
      "Where was the jeweler trapped? Ask about the 'vault'.",
      "How did the door get closed? Ask about the 'lock' or keycard logs.",
      "Who shared the keys? Ask about the jeweler's business 'partner'."
    ],
    answer: "partner"
  }
];
