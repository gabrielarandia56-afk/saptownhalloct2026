/**
 * Funny, SFW SAP & Corporate Team Names
 */
const TEAM_NAMES = [
  "The ABAP Wizards",
  "Cloud Synergizers",
  "Hypercare Heroes",
  "The S/4 Slayers",
  "BAPI Bandits",
  "Fiori Firestarters",
  "The Cutover Crew",
  "Transport Champions",
  "Agile Architects",
  "The Hana Mavericks",
  "Scope Creep Survivors",
  "The Coffee Consultants"
];

function getRandomTeamNames(count) {
  const shuffled = [...TEAM_NAMES].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

module.exports = {
  TEAM_NAMES,
  getRandomTeamNames
};
