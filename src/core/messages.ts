// Rotating reminders on the block page / overlay (carried over from no-ai-filter).
const MESSAGES = [
  '{site} can wait. 🙅',
  "You asked me to keep you off {site}. You're welcome. 🍊",
  'Nope, {profile} is on. Go touch grass. 🌱',
  '{site} right now? Bold move. Close the tab.',
  'The internet will survive without your hot take. Step away. ⏰',
  '{site} is {topic} territory, and {profile} says no.',
  'Breathe. Stretch. Anything but {site}. 🧘',
];

export function blockMessage(
  vars: { site: string; topic: string; profile: string },
  rand: () => number = Math.random,
): string {
  const template = MESSAGES[Math.floor(rand() * MESSAGES.length) % MESSAGES.length] ?? '';
  return template
    .replace(/\{site\}/g, vars.site)
    .replace(/\{topic\}/g, vars.topic)
    .replace(/\{profile\}/g, vars.profile);
}
