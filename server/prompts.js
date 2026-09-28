/**
 * Curated SFW Prompt Library for SAP Town Halls & Corporate Events
 */
const PROMPTS = [
  "The real reason this meeting could have been an email is…",
  "You know it's go-live week when…",
  "Our team's unofficial superpower is…",
  "The most dangerous phrase in a project plan is…",
  "My productivity increases by 400% when…",
  "The next corporate buzzword will be…",
  "One thing every town hall needs is…",
  "If SAP stood for something else, it would be…",
  "The best part of working hybrid is…",
  "The one thing nobody tells you about agile is…",
  "The quickest way to make a software engineer sweat is…",
  "The unspoken rule of our Slack channels is…",
  "What actually happens during a 'quick 5-minute sync'?",
  "The true purpose of the 'Thumbs Up' emoji in Teams is…",
  "A resume skill that should be official: 'Expert in…'",
  "What my coffee mug says vs what it really means…",
  "The most creative excuse for having camera off during a call…",
  "If our project roadmap was a movie title, it would be…",
  "The fastest way to get everyone to unmute at once…",
  "What AI will definitely NEVER be able to replace at our company…"
];

/**
 * Get random unique prompts for a game session
 */
function getRandomPrompts(count) {
  const shuffled = [...PROMPTS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, PROMPTS.length));
}

module.exports = {
  PROMPTS,
  getRandomPrompts
};
