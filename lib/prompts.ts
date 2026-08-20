export type SlicePrompt = {
  idx: number;
  emoji: string;
  title: string;
  prompt: string;
  hint: string;
  /** Optional tap-to-fill suggestions shown under the input. */
  quickPicks?: string[];
};

/**
 * Eight slices = 360°. Changing the number of slices changes the pizza geometry,
 * the completion rule, and how many people each player must meet, so treat
 * SLICE_PROMPTS.length as the single source of truth everywhere.
 *
 * Quick picks matter more than they look: players connect by finding someone
 * with the *same* answer, and a tap-to-fill chip makes matches far likelier
 * than free text where everyone writes "coffee" eight different ways.
 */
export const SLICE_PROMPTS: SlicePrompt[] = [
  {
    idx: 0,
    emoji: "🚇",
    title: "The Commute",
    prompt: "What MRT line do you stay on?",
    hint: "Nearest station counts if you're between lines.",
    quickPicks: [
      "East–West 🟢",
      "North–South 🔴",
      "North East 🟣",
      "Circle 🟡",
      "Downtown 🔵",
      "Thomson–East Coast 🟤",
    ],
  },
  {
    idx: 1,
    emoji: "🥤",
    title: "The Drink",
    prompt: "Coffee, tea, matcha, or water?",
    hint: "Pick your everyday one, not your special-occasion one.",
    quickPicks: ["Coffee ☕", "Tea 🍵", "Matcha 🍡", "Water 💧"],
  },
  {
    idx: 2,
    emoji: "🎯",
    title: "The Hobby",
    prompt: "What's your hobby?",
    hint: "The thing you'd do on a free Saturday without being asked.",
    quickPicks: ["Sports 🏀", "Music 🎸", "Gaming 🎮", "Baking 🧁", "Photography 📷", "Reading 📚"],
  },
  {
    idx: 3,
    emoji: "😀",
    title: "The Smile",
    prompt: "What made you smile this week?",
    hint: "Small counts. A good breakfast counts.",
  },
  {
    idx: 4,
    emoji: "🤗",
    title: "The Gratitude",
    prompt: "What are you grateful for in church?",
    hint: "A person, a moment, a ministry — anything.",
  },
  {
    idx: 5,
    emoji: "🍕",
    title: "The Favourite",
    prompt: "What is your favourite food?",
    hint: "Be specific enough that someone can agree loudly.",
    quickPicks: ["Chicken rice", "Laksa", "Pizza 🍕", "Bak chor mee", "Nasi lemak", "Korean BBQ"],
  },
  {
    idx: 6,
    emoji: "📍",
    title: "The Beginning",
    prompt: "When did you join church?",
    hint: "Tell them the year too — \"2019, at Singpost\".",
    quickPicks: ["IM", "Singpost", "Dhoby Ghaut"],
  },
  {
    idx: 7,
    emoji: "🏠",
    title: "The New Building",
    prompt: "What are you looking forward to in the new building?",
    hint: "The room, the vibe, the coffee, the parking — anything.",
  },
];

export const SLICE_COUNT = SLICE_PROMPTS.length;
