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
 * Five slices = 360°. Changing the number of slices changes the pizza geometry,
 * the completion rule, and how many people each player must meet, so treat
 * SLICE_PROMPTS.length as the single source of truth everywhere.
 */
export const SLICE_PROMPTS: SlicePrompt[] = [
  {
    idx: 0,
    emoji: "🚇",
    title: "The Commute",
    prompt: "Which MRT line or region do you live on?",
    hint: "Bonus: your go-to podcast or playlist on the way to church.",
    quickPicks: ["East–West 🟢", "North–South 🔴", "North East 🟣", "Circle 🟡", "Downtown 🔵", "Thomson–East Coast 🟤"],
  },
  {
    idx: 1,
    emoji: "🙌",
    title: "The Calling",
    prompt: "Which ministry do you serve in?",
    hint: "Not serving yet? Name a hidden talent you'd bring to a church camp talent show.",
  },
  {
    idx: 2,
    emoji: "☕",
    title: "The Non-Negotiable",
    prompt: "Your exact kopi/teh order — or the one hawker dish you could eat daily for a month.",
    hint: "Be precise. \"Kopi C kosong siew dai\" energy.",
    quickPicks: ["Kopi O", "Kopi C siew dai", "Teh peng", "Milo dinosaur", "Chicken rice", "Laksa"],
  },
  {
    idx: 3,
    emoji: "🌶️",
    title: "The Harmless Hot Take",
    prompt: "Pick one and defend it in five words.",
    hint: "Pineapple on pizza: genius or crime? · McSpicy is mid · Snoozing 5x vs. instant wake-up",
    quickPicks: ["Pineapple = genius 🍍", "Pineapple = crime 🚫", "McSpicy is mid", "Snooze 5x forever", "Up at first alarm"],
  },
  {
    idx: 4,
    emoji: "😴",
    title: "The Sunday Ritual",
    prompt: "What's your immediate plan after service?",
    hint: "Nap, sports, cafe hopping, studying, or something stranger.",
    quickPicks: ["Nap 😴", "Sports 🏀", "Cafe hopping ☕", "Studying 📚", "Family lunch 🍚"],
  },
];

export const SLICE_COUNT = SLICE_PROMPTS.length;
