/**
 * Curated SFW Prompt Library for SAP Practice Town Halls & Corporate Events
 * Tailored for enterprise consulting, ERP rollouts, cloud migrations, and team culture.
 */
const PROMPTS = [
  // SAP Practice & ERP Culture
  "If SAP actually stood for an acronym in plain English, it would mean…",
  "You know it's cutover weekend when…",
  "The most stressful 3 seconds in an SAP consultant's day is…",
  "The client asked for 'standard functionality', but what they actually wanted was…",
  "The real reason why transport requests get stuck in QA is…",
  "A custom Z-report that someone built 12 years ago that nobody dares to touch is named…",
  "The number one rule of data migration that everyone learns the hard way is…",
  "The quickest way to explain S/4HANA migration to your parents is…",
  "The unspoken secret to surviving an ERP hypercare phase is…",
  "What an SAP implementation project timeline says vs what it actually means…",
  "The real reason the BAPI returned an unexpected error code…",
  "The most heroic act an SAP consultant can perform on a Friday afternoon…",
  
  // Consulting, Client & Meeting Life
  "The real reason this 60-minute meeting could have been a 2-line email is…",
  "The most dangerous phrase in a project status deck is…",
  "What actually happens during a 'quick 5-minute sync'…",
  "The true meaning behind typing 'Per my previous email' is…",
  "The most creative reason given for keeping the camera off during client calls…",
  "A corporate buzzword that needs to be permanently retired this quarter…",
  "The fastest way to get an entire project team to immediately unmute is…",
  "If our project roadmap was an action movie, the title would be…",

  // Team & Work Culture
  "Our team's unofficial superpower when deadlines get tight is…",
  "My productivity spikes by 400% the moment I…",
  "The ultimate hack for surviving back-to-back Teams / Zoom calls…",
  "The one thing every great town hall presentation always needs…",
  "A skill that should definitely be listed on an enterprise resume: 'Expert in…'",
  "What AI will definitely NEVER be able to automate in our practice…",
  "The best part about hybrid work that nobody says out loud…",
  "The unspoken etiquette rule of our team chat channels is…",
  "What coffee really means at 4:30 PM before a steering committee meeting…"
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
